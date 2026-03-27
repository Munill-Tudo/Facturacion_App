import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/ajustes/reset
 * Body: { email, password, nuevoNumero?: number }
 * - Verifies Dirección credentials
 * - Deletes all facturas, suplidos-type facturas, movimientos
 * - If nuevoNumero is provided, sets the sequence to start from that number
 */
export async function POST(request: Request) {
  try {
    const { email, password, nuevoNumero } = await request.json();

    // Verify Dirección credentials
    const direccionEmails = [
      'orecio@munilltudoabogados.es',
      'mariona@munilltudoabogados.es',
      'nmunill@munilltudoabogados.es',
    ];

    if (!direccionEmails.includes(email) || password !== process.env.DIRECCION_PASSWORD) {
      return NextResponse.json({ error: 'Credenciales de Dirección no válidas' }, { status: 401 });
    }

    const errors: string[] = [];

    // Delete all movimientos
    const { error: e1 } = await supabase.from('movimientos').delete().neq('id', 0);
    if (e1) errors.push(`movimientos: ${e1.message}`);

    // Delete all facturas (all states)
    const { error: e2 } = await supabase.from('facturas').delete().neq('id', 0);
    if (e2) errors.push(`facturas: ${e2.message}`);

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 500 });
    }

    // If a new starting number is requested, set the PostgreSQL sequence
    if (nuevoNumero && nuevoNumero >= 1) {
      // We need to use the Supabase admin RPC or raw SQL
      // This sets the next value of the sequence to nuevoNumero
      const startFrom = Number(nuevoNumero);
      const { error: seqErr } = await supabase.rpc('reset_facturas_sequence', { next_val: startFrom });
      if (seqErr) {
        // If RPC not available, return a message telling user to run SQL manually
        return NextResponse.json({ 
          success: true, 
          sequenceWarning: `Datos eliminados. Para cambiar el número inicial a ${startFrom}, ejecuta en Supabase SQL Editor:\n\nSELECT setval('facturas_id_seq', ${startFrom - 1}, true);` 
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
