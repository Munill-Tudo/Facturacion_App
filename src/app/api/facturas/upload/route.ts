import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { buscarOCrearProveedorPorNIF } from '@/app/proveedores/actions';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `Eres un asistente experto en contabilidad española analizando facturas recibidas por el despacho "Munill Abogados SLP" (CIF: B44650307).

REGLA CRÍTICA: La empresa "Munill Abogados SLP" o "Munill-Tudó Abogados" y el CIF "B44650307" son SIEMPRE el RECEPTOR/DESTINATARIO de la factura. NUNCA deben aparecer como proveedor/emisor en tu respuesta.

Tu tarea es extraer los datos del EMISOR/PROVEEDOR: la empresa o persona física que HA EMITIDO esta factura Y QUE COBRA el dinero. Es decir, quien aparece en el encabezado de la factura como "De:", "Emisor:", "Proveedor:", o cuyo nombre y CIF aparece en la parte superior del documento emitiendo la factura.

Si un dato no existe, devuelve null. Valores numéricos sin símbolos de moneda. Formato de fecha YYYY-MM-DD.

Devuelve ÚNICAMENTE este JSON:
- cliente (nombre del EMISOR de la factura, quien cobra)
- nif (CIF/NIF del EMISOR, quien cobra)
- domicilio (dirección del EMISOR)
- poblacion (población del EMISOR)
- provincia (provincia del EMISOR)
- cp (código postal del EMISOR)
- fecha (fecha de emisión de la factura, YYYY-MM-DD)
- numero (número de factura)
- concepto (descripción del servicio o producto facturado)
- importe (total final a pagar en euros, número float, incluido IVA si aplica)`;

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
    let n8nError: string | null = null;
    const n8nDriveWebhook = process.env.N8N_DRIVE_WEBHOOK_URL;

    if (n8nDriveWebhook) {
      try {
        // Creamos un nuevo File desde el buffer ya leído para asegurar que es legible
        const fileForN8n = new File([buffer], file.name || 'factura.pdf', {
          type: file.type || 'application/pdf',
        });

        const driveFormData = new FormData();
        driveFormData.append('file', fileForN8n);
        driveFormData.append('data', JSON.stringify(extractedData));

        const n8nRes = await fetch(n8nDriveWebhook, {
          method: 'POST',
          body: driveFormData,
        });

        if (n8nRes.ok) {
          const n8nData = await n8nRes.json();
          archivo_url = n8nData.archivo_url || null;
        } else {
          n8nError = `Status ${n8nRes.status}: ${await n8nRes.text()}`;
          console.error('El webhook de n8n devolvió un error:', n8nError);
        }
      } catch (err: any) {
        n8nError = err.message;
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
