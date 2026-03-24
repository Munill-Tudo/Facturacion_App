import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { buscarOCrearProveedorPorNIF } from '@/app/proveedores/actions';

// Seguridad básica: Puedes definir un secreto en tu .env (.env.local)
// N8N_WEBHOOK_SECRET=mi-secreto-super-seguro
// Y n8n tendrá que enviarlo en los headers o query params.

export async function POST(request: Request) {
  try {
    // 1. Verificar Seguridad (opcional pero recomendado)
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    
    // Si quieres usar el secreto:
    /*
    if (token !== process.env.N8N_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    */

    // 2. Leer el JSON que envía n8n
    const body = await request.json();
    
    // Esperamos un formato similar a este enviado desde n8n
    const { 
      fecha, 
      cliente, 
      concepto, 
      importe, 
      estado = 'Pendiente', 
      archivo_url, 
      numero,
      nif,
      emisor_nif,
      domicilio,
      cp,
      poblacion,
      provincia,
      emisor_nombre
    } = body;

    const nombreReal = emisor_nombre || cliente;
    const nifReal = emisor_nif || nif;

    // Validación básica
    if (!nombreReal || importe === undefined) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios (cliente/emisor_nombre, importe)' }, 
        { status: 400 }
      );
    }

    // Novedad: Interconexión con la Base de Maestros Proveedores
    if (nifReal) {
      // Intentar auto-crear un proveedor en la sombra
      await buscarOCrearProveedorPorNIF({
        nif: nifReal.toUpperCase(),
        nombre: nombreReal,
        direccion: domicilio || null,
        cp: cp || null,
        poblacion: poblacion || null,
        provincia: provincia || null
      });
    }

    // 3. Insertar en la Base de Datos de Supabase
    const { data, error } = await supabase
      .from('facturas')
      .insert([
        { 
          numero: numero || null, 
          fecha: fecha || new Date().toISOString().split('T')[0], // Si no hay fecha, usa la de hoy
          cliente: nombreReal,
          emisor_nombre: nombreReal,
          emisor_nif: nifReal || null,
          emisor_domicilio: domicilio || null,
          emisor_cp: cp || null,
          emisor_poblacion: poblacion || null,
          emisor_provincia: provincia || null,
          concepto: concepto || 'Recepción Automática (Web)', 
          importe: parseFloat(importe), 
          estado, 
          archivo_url: archivo_url || null
        }
      ])
      .select();

    if (error) {
      console.error('Error insertando en Supabase:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 4. Devolver una respuesta exitosa a n8n
    return NextResponse.json({ 
      success: true, 
      message: 'Factura registrada y guardada exitosamente.',
      data: data[0]
    });

  } catch (err: any) {
    console.error('Error procesando webhook de n8n:', err);
    return NextResponse.json(
      { error: 'Error interno procesando webhook', details: err.message }, 
      { status: 500 }
    );
  }
}
