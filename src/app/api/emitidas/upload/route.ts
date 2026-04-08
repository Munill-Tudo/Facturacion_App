import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generarRFCreditorReference } from '@/lib/normalizacion';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `Eres un asistente experto en contabilidad española analizando facturas EMITIDAS por el despacho "Munill Abogados SLP" o "Munill-Tudó Abogados" (CIF: B44650307).

REGLA CRÍTICA: La empresa "Munill Abogados SLP" o "Munill-Tudó Abogados" es el EMISOR de la factura. Tu tarea es extraer los datos del CLIENTE/DESTINATARIO: la persona o empresa a la que se le factura el servicio y que DEBE PAGAR.

Si un dato no existe, devuelve null. Valores numéricos sin símbolos de moneda. Formato de fecha YYYY-MM-DD.

Devuelve ÚNICAMENTE este JSON:
- cliente (nombre del CLIENTE a quien se dirige la factura)
- nif_cliente (CIF/NIF del CLIENTE)
- poblacion_cliente (Población del CLIENTE)
- fecha (fecha de emisión de la factura, YYYY-MM-DD)
- numero (número de factura)
- concepto (descripción del servicio o producto facturado, un resumen corto)
- total_base (base imponible sin IVA ni retenciones, número float)
- total_iva (importe del IVA, número float)
- total_irpf (importe de la retención IRPF si la hay, número float)
- importe (total final de la factura en euros, número float)`;

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

    // 1. Extraer datos del PDF con OpenAI Responses API
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
              text: 'Extrae los datos de esta factura emitida en formato JSON.',
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
    const { fecha, cliente, concepto, importe, numero, nif_cliente, poblacion_cliente, total_base, total_iva, total_irpf } = extractedData;

    if (!cliente || importe === undefined || importe === null) {
      return NextResponse.json(
        { error: 'No se pudieron extraer campos obligatorios (cliente, importe) del PDF.', extractedData },
        { status: 400 }
      );
    }

    // 2. Insertar en Supabase facturas_emitidas
    const { data: insertData, error: insertError } = await supabase
      .from('facturas_emitidas')
      .insert([{
        numero: numero || null,
        fecha: fecha || new Date().toISOString().split('T')[0],
        cliente: cliente,
        nif_cliente: nif_cliente || null,
        poblacion_cliente: poblacion_cliente || null,
        concepto: concepto || 'Venta referenciada',
        total_base: total_base ? parseFloat(total_base) : null,
        total_iva: total_iva ? parseFloat(total_iva) : null,
        total_irpf: total_irpf ? parseFloat(total_irpf) : null,
        importe: parseFloat(importe),
        estado: 'Pendiente',
        referencia_rf: generarRFCreditorReference(numero || ''),
        archivo_url: null, // Se actualizará después con la URL de Drive en n8n si es necesario
      }])
      .select();

    if (insertError) {
      console.error('Error insertando en Supabase:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const facturaId: number = insertData[0]?.id;

    // 3. Subir archivo a Google Drive mediante n8n (opcional)
    let archivo_url: string | null = null;
    const n8nDriveWebhook = process.env.N8N_DRIVE_WEBHOOK_URL;

    if (n8nDriveWebhook) {
      try {
        const fileForN8n = new File([buffer], file.name || 'factura_emitida.pdf', {
          type: file.type || 'application/pdf',
        });

        const driveFormData = new FormData();
        driveFormData.append('file', fileForN8n);
        driveFormData.append('factura_emitida_id', String(facturaId));
        driveFormData.append('factura_fecha', extractedData.fecha || '');
        driveFormData.append('factura_cliente', extractedData.cliente || '');
        driveFormData.append('factura_importe', String(extractedData.importe || 0));
        driveFormData.append('factura_numero', extractedData.numero || '');
        driveFormData.append('data', JSON.stringify(extractedData));
        driveFormData.append('tipo_documento', 'Emitida'); // To inform n8n this is an outgoing invoice

        const n8nRes = await fetch(n8nDriveWebhook, {
          method: 'POST',
          body: driveFormData,
        });

        if (n8nRes.ok) {
          const n8nData = await n8nRes.json();
          archivo_url = n8nData.archivo_url || null;

          if (archivo_url && facturaId) {
             await supabase.from('facturas_emitidas').update({ archivo_url }).eq('id', facturaId);
          }
        }
      } catch (err: any) {
        console.error('Error enviando el archivo de emitida al webhook de n8n para Drive:', err.message);
      }
    }

    return NextResponse.json({
      success: true,
      factura: { ...insertData[0], archivo_url },
      extracted: extractedData,
    });

  } catch (err: any) {
    console.error('Error en upload factura emitida:', err);
    return NextResponse.json(
      { error: 'Error procesando la factura emitida', details: err.message },
      { status: 500 }
    );
  }
}
