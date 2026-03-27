import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    const direccionEmails = ['orecio@munilltudoabogados.es', 'mariona@munilltudoabogados.es', 'nmunill@munilltudoabogados.es'];
    
    if (!direccionEmails.includes(email) || password !== process.env.DIRECCION_PASSWORD) {
      return NextResponse.json({ error: 'Credenciales de Dirección no válidas' }, { status: 401 });
    }

    // Perform permanent deletions
    // 1. Delete invoices in 'Eliminada' state
    const { error: err1 } = await supabase
      .from('facturas')
      .delete()
      .eq('estado', 'Eliminada');

    // 2. Delete providers in 'eliminado' state
    // We assume 'proveedores' table has an 'eliminado' boolean column
    const { error: err2 } = await supabase
      .from('proveedores')
      .delete()
      .eq('eliminado', true);

    if (err1 || err2) {
      return NextResponse.json({ error: 'Error al eliminar algunos registros' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
