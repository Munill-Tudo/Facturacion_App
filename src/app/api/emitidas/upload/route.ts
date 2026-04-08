import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generarRFCreditorReference } from '@/lib/normalizacion';
import { buscarOCrearClientePorNIF } from '@/app/clientes/actions';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `Eres un asistente experto en contabilidad española analizando facturas EMITIDAS por el despacho "Munill Abogados SLP" o "Munill-Tudó Abogados" (CIF: B44650307).

REGLA CRÍTICA: La empresa "Munill Abogados SLP" o "Munill-Tudó Abogados" es el EMISOR de las facturas. Tu tarea es extraer los datos de los CLIENTES/DESTINATARIOS: la persona o empresa a la que se le factura el servicio y que DEBE PAGAR.

El documento adjunto puede contener MÚLTIPLES facturas (por ejemplo, una factura por página o varias facturas juntas).
Tu trabajo es identificar CADA UNA de las facturas presentes en el documento y extraer sus datos.
Devuelve SIEMPRE un documento JSON con una UNICA clave primaria llamada "facturas", que sea un ARRAY de objetos JSON, donde cada objeto represente una factura.

Para CADA factura extraída, si un dato no existe, devuelve null. Valores numéricos sin símbolos de moneda. Formato de fecha YYYY-MM-DD.

El formato JSON estricto esperado para cada objeto dentro del array 'facturas' es:
- cliente (nombre del CLIENTE a quien se dirige la factura)
- nif_cliente (CIF/NIF del CLIENTE)
- direccion_cliente (Dirección postal del CLIENTE)
- poblacion_cliente (Población del CLIENTE)
- provincia_cliente (Provincia del CLIENTE)
- cp_cliente (Código Postal del CLIENTE)
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
              text: 'Extrae TODAS las facturas emitidas de este documento en el array JSON solicitado.',
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

    let parsedData = JSON.parse(aiContent);
    // Asegurarnos de que tenemos un array en parsedData.facturas
    let facturasArray: any[] = [];
    if (parsedData.facturas && Array.isArray(parsedData.facturas)) {
      facturasArray = parsedData.facturas;
    } else if (Array.isArray(parsedData)) {
      facturasArray = parsedData;
    } else {
      // Si la IA devuelve un solo objeto suelto por error, lo forzamos a array
      facturasArray = [parsedData];
    }

    if (facturasArray.length === 0) {
      return NextResponse.json(
        { error: 'No se procesó ninguna factura válida a partir del documento.', AIResponse: parsedData },
        { status: 400 }
      );
    }

    const insertedFacturas = [];
    const n8nDriveWebhook = process.env.N8N_DRIVE_WEBHOOK_URL;
    
    // Convert buffer to file once for all N8N requests if needed
    const fileForN8n = new File([buffer], file.name || 'factura_emitida.pdf', {
      type: file.type || 'application/pdf',
    });

    // Procesar CADA factura encontrada
    for (const extractedData of facturasArray) {
       const { fecha, cliente, concepto, importe, numero, nif_cliente, direccion_cliente, poblacion_cliente, provincia_cliente, cp_cliente, total_base, total_iva, total_irpf } = extractedData;

       if (!cliente || importe === undefined || importe === null) {
         console.warn("Se saltó una factura por faltar datos críticos", extractedData);
         continue; // Omitir facturas mal parseadas pero seguir con las demás
       }

       // 2. Logica CRM Clientes auto-creación
       let _clienteObj = null;
       try {
           if (nif_cliente || cliente) {
               _clienteObj = await buscarOCrearClientePorNIF({
                   nif: nif_cliente || null,
                   nombre: cliente,
                   direccion: direccion_cliente || null,
                   poblacion: poblacion_cliente || null,
                   provincia: provincia_cliente || null,
                   cp: cp_cliente || null,
               });
           }
       } catch (err) {
           console.error("Error auto-generando cliente en CRM", err);
       }

       // 3. Insertar en Supabase facturas_emitidas
       const rfFactura = generarRFCreditorReference(numero || '');
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
           referencia_rf: rfFactura,
           archivo_url: null, // Se actualizará después en n8n
         }])
         .select();

       if (insertError) {
         console.error('Error insertando factura:', insertError);
         continue;
       }

       const facturaId = insertData[0]?.id;
       let archivo_url = null;

       // 4. Subir a GDrive mediante n8n (opcional) de cada una
       // OJO: Se enviará el mismo PDF de multipágina por cada registro. 
       // Si es un PDF con 4 facturas, n8n subirá el PDF 4 veces en las carpetas respectivas, lo cual suele ser el comportamiento deseado para trazar la procedencia de cada hoja, o pueden dividirse en el futuro.
       if (n8nDriveWebhook && facturaId) {
         try {
           const driveFormData = new FormData();
           driveFormData.append('file', fileForN8n);
           driveFormData.append('factura_emitida_id', String(facturaId));
           driveFormData.append('factura_fecha', fecha || '');
           driveFormData.append('factura_cliente', cliente || '');
           driveFormData.append('factura_importe', String(importe || 0));
           driveFormData.append('factura_numero', numero || '');
           driveFormData.append('data', JSON.stringify(extractedData));
           driveFormData.append('tipo_documento', 'Emitida');
           driveFormData.append('rf_factura', rfFactura);
           if (_clienteObj?.referencia_rf) {
               driveFormData.append('rf_cliente', _clienteObj.referencia_rf);
           }

           // Llamada en fire-and-forget o await
           const n8nRes = await fetch(n8nDriveWebhook, { method: 'POST', body: driveFormData });
           if (n8nRes.ok) {
             const n8nData = await n8nRes.json();
             archivo_url = n8nData.archivo_url || null;
             if (archivo_url) {
                await supabase.from('facturas_emitidas').update({ archivo_url }).eq('id', facturaId);
             }
           }
         } catch (err: any) {
           console.error('Error enviando a n8n:', err.message);
         }
       }

       insertedFacturas.push({
          ...insertData[0],
          archivo_url
       });
    }

    if (insertedFacturas.length === 0) {
        return NextResponse.json({ error: 'No se pudo insertar ninguna de las facturas leídas.' }, { status: 500 });
    }

    // Devolvemos success indicando la cantidad procesada. En el frontend se mostrará como único ítem pero sabemos que cargamos múltiples
    return NextResponse.json({
      success: true,
      factura: insertedFacturas[0], // para que el modal ponga check verde sobre el archivo (toma el primero al menos)
      extracted: parsedData,
      count: insertedFacturas.length
    });

  } catch (err: any) {
    console.error('Error en upload factura emitida:', err);
    return NextResponse.json(
      { error: 'Error procesando el array de facturas', details: err.message },
      { status: 500 }
    );
  }
}
