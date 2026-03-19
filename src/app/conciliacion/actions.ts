'use server';

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function asociarPagoAFactura(movimientoId: string, facturaId: number) {
  // 1. Marcar movimiento como conciliado y enlazar factura
  await supabase.from('movimientos')
    .update({ 
      estado_conciliacion: 'Conciliado', 
      factura_id: facturaId 
    })
    .eq('id', movimientoId);

  // 2. Marcar factura como Pagada
  await supabase.from('facturas')
    .update({ estado: 'Pagada' })
    .eq('id', facturaId);

  revalidatePath('/');
  revalidatePath('/facturas');
  revalidatePath('/conciliacion');
}

export async function asignarCobroACliente(movimientoId: string, clienteExpediente: string) {
  await supabase.from('movimientos')
    .update({ 
      estado_conciliacion: 'Conciliado', 
      cliente_expediente: clienteExpediente 
    })
    .eq('id', movimientoId);

  revalidatePath('/conciliacion');
}
