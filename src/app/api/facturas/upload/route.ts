import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { buscarOCrearProveedorPorNIF } from '@/app/proveedores/actions';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `Eres un asistente experto en contabilidad española. Extrae los siguientes datos de la factura adjunta en formato JSON exacto.
Si un dato no existe, devuelve null. Valores numéricos sin símbolos de moneda. Formato de fecha YYYY-MM-DD.
Campos requeridos:
- cliente (nombre del proveedor/emisor de la factura)
- nif (CIF/NIF del proveedor)
- domicilio (calle y número)
- poblacion
- provincia
- cp (código postal)
- fecha (YYYY-MM-DD)
- numero (número de factura)
- concepto (breve descripción del servicio o producto)
- importe (total final a pagar en euros, como número float)`;

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Falta la clave OPENAI_API_KEY en las variables de entorno' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No se ha subido ningún archivo' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64PDF = buffer.toString('base64');

    // 1. Extraer datos del PDF con OpenAI Responses API (soporta PDFs nativamente via base64)
    const response = await (openai as any).responses.create({
      model: 'gpt-4o',
      instructions: SYSTEM_PROMPT,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_file',
              filename: file.name,
              file_data: `data:application/pdf;base64,${base64PDF}`,
            },
            {
              type: 'input_text',
              text: 'Extrae los datos de esta factura en formato JSON según las instrucciones.',
            },
          ],
        },
      ],
      text: {
        format: { type: 'json_object' },
      },
    });

    const aiContent = response.output_text;
    if (!aiContent) throw new Error('No se pudo extraer el contenido con IA');

    const extractedData = JSON.parse(aiContent);

    // 2. Subir archivo a Google Drive mediante n8n (o Supabase Storage como fallback)
    let archivo_url = null;
    const n8nDriveWebhook = process.env.N8N_DRIVE_WEBHOOK_URL;

    if (n8nDriveWebhook) {
      try {
        const driveFormData = new FormData();
        driveFormData.append('file', file);
        driveFormData.append('data', JSON.stringify(extractedData));

        const n8nRes = await fetch(n8nDriveWebhook, {
          method: 'POST',
          body: driveFormData,
        });

        if (n8nRes.ok) {
          const n8nData = await n8nRes.json();
          archivo_url = n8nData.archivo_url || null;
        } else {
          console.error('El webhook de n8n devolvió un error:', await n8nRes.text());
        }
      } catch (err) {
        console.error('Error enviando el archivo al webhook de n8n para Drive:', err);
      }
    } else {
      // Fallback: Supabase Storage
      try {
        const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        const { error: storageError } = await supabase.storage
          .from('facturas')
          .upload(fileName, buffer, { contentType: 'application/pdf' });

        if (!storageError) {
          const { data: publicUrlData } = supabase.storage.from('facturas').getPublicUrl(fileName);
          archivo_url = publicUrlData.publicUrl;
        }
      } catch (err) {
        console.warn('Error subiendo a Supabase Storage (fallback):', err);
      }
    }

    // 3. Insertar en Supabase
    const { fecha, cliente, concepto, importe, numero, nif, domicilio, cp, poblacion, provincia } = extractedData;

    if (!cliente || importe === undefined || importe === null) {
      return NextResponse.json(
        { error: 'No se pudieron extraer campos obligatorios (cliente, importe) del PDF.', extractedData },
        { status: 400 }
      );
    }

    let tipoAsignado = null;
    if (nif) {
      const prov = await buscarOCrearProveedorPorNIF({
        nif: nif.toUpperCase(),
        nombre: cliente,
        direccion: domicilio || null,
        cp: cp || null,
        poblacion: poblacion || null,
        provincia: provincia || null,
      });
      if (prov && prov.tipo_defecto) {
        tipoAsignado = prov.tipo_defecto;
      }
    }

    const { data: insertData, error: insertError } = await supabase
      .from('facturas')
      .insert([{
        numero: numero || null,
        fecha: fecha || new Date().toISOString().split('T')[0],
        cliente: cliente,
        nombre_proveedor: cliente,
        nif_proveedor: nif || null,
        direccion_proveedor: domicilio || null,
        poblacion_proveedor: poblacion || null,
        concepto: concepto || 'Recepción Manual',
        importe: parseFloat(importe),
        estado: 'Pendiente',
        tipo: tipoAsignado || null,
        archivo_url: archivo_url,
      }])
      .select();

    if (insertError) {
      console.error('Error insertando en Supabase:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      factura: insertData[0],
      extracted: extractedData,
    });

  } catch (err: any) {
    console.error('Error en upload factura:', err);
    return NextResponse.json(
      { error: 'Error procesando la factura', details: err.message },
      { status: 500 }
    );
  }
}
