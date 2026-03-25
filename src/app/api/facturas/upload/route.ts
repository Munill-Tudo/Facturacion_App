import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { buscarOCrearProveedorPorNIF } from '@/app/proveedores/actions';
import OpenAI from 'openai';

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

    // 1. Subir el PDF a la API de OpenAI para que lo lea directamente (sin pdf-parse)
    const openaiFile = await openai.files.create({
      file: new File([buffer], file.name, { type: 'application/pdf' }),
      purpose: 'user_data',
    });

    // 2. Extraer datos con gpt-4o que puede leer PDFs nativamente
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Eres un asistente experto en contabilidad española. Extrae los siguientes datos de la factura adjunta en formato JSON exacto.
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
- importe (total final a pagar, número float sin IVA no, TOTAL a pagar)`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extrae los datos de esta factura en el formato JSON indicado.'
            },
            {
              // @ts-ignore – File input type is supported by gpt-4o via Files API
              type: 'file',
              file: { file_id: openaiFile.id }
            }
          ]
        }
      ],
      response_format: { type: 'json_object' }
    });

    // Limpiar el archivo de OpenAI después de usarlo
    await openai.files.del(openaiFile.id).catch(() => {});

    const aiContent = completion.choices[0]?.message?.content;
    if (!aiContent) throw new Error('No se pudo extraer el contenido con IA');

    const extractedData = JSON.parse(aiContent);

    // 3. Subir archivo a Google Drive mediante n8n (o a Supabase Storage como fallback)
    let archivo_url = null;
    const n8nDriveWebhook = process.env.N8N_DRIVE_WEBHOOK_URL;

    if (n8nDriveWebhook) {
      try {
        const driveFormData = new FormData();
        driveFormData.append('file', file);
        driveFormData.append('data', JSON.stringify(extractedData));

        const n8nRes = await fetch(n8nDriveWebhook, {
          method: 'POST',
          body: driveFormData
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

    // 4. Insertar en Supabase
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
        provincia: provincia || null
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
        archivo_url: archivo_url
      }])
      .select();

    if (insertError) {
      console.error('Error insertando en Supabase:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      factura: insertData[0],
      extracted: extractedData
    });

  } catch (err: any) {
    console.error('Error en upload factura:', err);
    return NextResponse.json(
      { error: 'Error procesando la factura', details: err.message },
      { status: 500 }
    );
  }
}
