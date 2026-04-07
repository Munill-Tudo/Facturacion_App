import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { buscarOCrearProveedorPorNIF } from '@/app/proveedores/actions';
import { generarRFCreditorReference } from '@/lib/normalizacion';
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
- total_base (base imponible sin IVA ni retenciones, número float)
- total_iva (importe del IVA, número float)
- total_irpf (importe de la retención IRPF si la hay, número float)
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
    const { fecha, cliente, concepto, importe, numero, nif, domicilio, cp, poblacion, provincia, total_base, total_iva, total_irpf } = extractedData;

    if (!cliente || importe === undefined || importe === null) {
      return NextResponse.json(
        { error: 'No se pudieron extraer campos obligatorios (cliente, importe) del PDF.', extractedData },
        { status: 400 }
      );
    }

    // 2. Buscar o crear proveedor
    let tipoAsignado = null;
    let tipoGastoAsignado: string | null = null;
    let subtipoGastoAsignado: string | null = null;
    if (nif) {
      const prov = await buscarOCrearProveedorPorNIF({
        nif: nif.toUpperCase(),
        nombre: cliente,
        direccion: domicilio || null,
        cp: cp || null,
        poblacion: poblacion || null,
        provincia: provincia || null,
      });
      if (prov) {
        tipoAsignado = prov.tipo_defecto || null;
        tipoGastoAsignado = (prov as any).tipo_gasto_defecto || null;
        subtipoGastoAsignado = (prov as any).subtipo_gasto_defecto || null;
      }
    }

    // 3. Insertar en Supabase PRIMERO para obtener el ID incremental
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
        total_base: total_base ? parseFloat(total_base) : null,
        total_iva: total_iva ? parseFloat(total_iva) : null,
        total_irpf: total_irpf ? parseFloat(total_irpf) : null,
        importe: parseFloat(importe),
        estado: 'Pendiente',
        tipo: tipoAsignado || null,
        tipo_gasto: tipoGastoAsignado,
        subtipo_gasto: subtipoGastoAsignado,
        referencia_rf: generarRFCreditorReference(numero || ''),
        archivo_url: null, // Se actualizará después con la URL de Drive
      }])
      .select();

    if (insertError) {
      console.error('Error insertando en Supabase:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const facturaId: number = insertData[0]?.id;

    // 4. Subir archivo a Google Drive mediante n8n (con el ID ya generado)
    let archivo_url: string | null = null;
    const n8nDriveWebhook = process.env.N8N_DRIVE_WEBHOOK_URL;

    if (n8nDriveWebhook) {
      try {
        const fileForN8n = new File([buffer], file.name || 'factura.pdf', {
          type: file.type || 'application/pdf',
        });

        const driveFormData = new FormData();
        driveFormData.append('file', fileForN8n);
        // Campos individuales accesibles en n8n como $input.item.json.body.*
        driveFormData.append('factura_id', String(facturaId));
        driveFormData.append('factura_fecha', extractedData.fecha || '');
        driveFormData.append('factura_cliente', extractedData.cliente || '');
        driveFormData.append('factura_importe', String(extractedData.importe || 0));
        driveFormData.append('factura_numero', extractedData.numero || '');
        driveFormData.append('data', JSON.stringify(extractedData));

        const n8nRes = await fetch(n8nDriveWebhook, {
          method: 'POST',
          body: driveFormData,
        });

        if (n8nRes.ok) {
          const n8nData = await n8nRes.json();
          archivo_url = n8nData.archivo_url || null;

          // 5. Actualizar el registro con la URL de Drive
          if (archivo_url && facturaId) {
            await supabase.from('facturas').update({ archivo_url }).eq('id', facturaId);
          }
        } else {
          console.error('El webhook de n8n devolvió un error:', await n8nRes.text());
        }
      } catch (err: any) {
        console.error('Error enviando el archivo al webhook de n8n para Drive:', err.message);
      }
    }

    return NextResponse.json({
      success: true,
      factura: { ...insertData[0], archivo_url },
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
