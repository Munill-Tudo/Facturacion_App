import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generarRFCreditorReference } from '@/lib/normalizacion';
import { buscarOCrearClientePorNIF } from '@/app/clientes/actions';
import { getTrimestreFiscal } from '@/lib/trimestre';
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

    const parsedData = JSON.parse(aiContent);
    let facturasArray: any[] = [];
    if (parsedData.facturas && Array.isArray(parsedData.facturas)) {
      facturasArray = parsedData.facturas;
    } else if (Array.isArray(parsedData)) {
      facturasArray = parsedData;
    } else {
      facturasArray = [parsedData];
    }

    if (facturasArray.length === 0) {
      return NextResponse.json(
        { error: 'No se procesó ninguna factura válida a partir del documento.', AIResponse: parsedData },
        { status: 400 }
      );
    }

    const insertedFacturas = [];

    for (const extractedData of facturasArray) {
      const {
        fecha,
        cliente,
        concepto,
        importe,
        numero,
        nif_cliente,
        direccion_cliente,
        poblacion_cliente,
        provincia_cliente,
        cp_cliente,
        total_base,
        total_iva,
        total_irpf,
      } = extractedData;

      if (!cliente || importe === undefined || importe === null) {
        console.warn('Se saltó una factura por faltar datos críticos', extractedData);
        continue;
      }

      try {
        if (nif_cliente || cliente) {
          await buscarOCrearClientePorNIF({
            nif: nif_cliente || null,
            nombre: cliente,
            direccion: direccion_cliente || null,
            poblacion: poblacion_cliente || null,
            provincia: provincia_cliente || null,
            cp: cp_cliente || null,
          });
        }
      } catch (err) {
        console.error('Error auto-generando cliente en CRM', err);
      }

      const fechaFinal = fecha || new Date().toISOString().split('T')[0];
      const rfFactura = generarRFCreditorReference(numero || '');

      const { data: insertData, error: insertError } = await supabase
        .from('facturas_emitidas')
        .insert([{
          numero: numero || null,
          fecha: fechaFinal,
          trimestre_fiscal: getTrimestreFiscal(fechaFinal),
          cliente: cliente,
          nif_cliente: nif_cliente || null,
          poblacion_cliente: poblacion_cliente || null,
          concepto: concepto || 'Venta referenciada',
          total_base: total_base ? parseFloat(total_base) : null,
          total_iva: total_iva ? parseFloat(total_iva) : null,
          total_irpf: total_irpf ? parseFloat(total_irpf) : null,
          importe: parseFloat(importe),
          estado: 'Pendiente',
          estado_documental: 'pendiente_documento',
          origen_carga: 'pdf_ia',
          referencia_rf: rfFactura,
          archivo_url: null,
        }])
        .select();

      if (insertError) {
        console.error('Error insertando factura:', insertError);
        continue;
      }

      insertedFacturas.push({
        ...insertData[0],
        archivo_url: null,
      });
    }

    if (insertedFacturas.length === 0) {
      return NextResponse.json({ error: 'No se pudo insertar ninguna de las facturas leídas.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      factura: insertedFacturas[0],
      extracted: parsedData,
      count: insertedFacturas.length,
    });
  } catch (err: any) {
    console.error('Error en upload factura emitida:', err);
    return NextResponse.json(
      { error: 'Error procesando el array de facturas', details: err.message },
      { status: 500 }
    );
  }
}
