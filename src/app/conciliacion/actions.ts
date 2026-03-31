'use server';

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { autoConciliarPagos } from "@/app/movimientos/actions";

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

/**
 * Lanza el motor de auto-conciliación sobre TODOS los pagos pendientes actuales.
 * Útil para reprocesar movimientos ya existentes sin necesidad de volver a importarlos.
 */
export async function lanzarAutoConciliacion(): Promise<{ conciliados: number; errores: string[] }> {
  const resultado = await autoConciliarPagos();

  revalidatePath('/');
  revalidatePath('/facturas');
  revalidatePath('/conciliacion');
  revalidatePath('/movimientos');

  return resultado;
}
