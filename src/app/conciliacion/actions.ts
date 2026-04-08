'use server';

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { autoConciliarPagos, autoConciliarCobros, autoEscanearNominasEImpuestos } from "@/app/movimientos/actions";

export async function asociarPagoAFactura(movimientoId: string, facturaId: number) {
  // 1. Obtener datos de la factura para rellenar el nombre en el movimiento
  const { data: fac } = await supabase
    .from('facturas')
    .select('nombre_proveedor, cliente, num_expediente')
    .eq('id', facturaId)
    .single();

  const clienteExp = fac ? (fac.num_expediente || fac.nombre_proveedor || fac.cliente || null) : null;

  // 2. Marcar movimiento como conciliado y enlazar factura con el nombre guardado
  await supabase.from('movimientos')
    .update({ 
      estado_conciliacion: 'Conciliado', 
      factura_id: facturaId,
      cliente_expediente: clienteExp
    })
    .eq('id', movimientoId);

  // 3. Marcar factura como Pagada (Conciliada)
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
  const resCobros = await autoConciliarCobros();
  const resNominasEImpuestos = await autoEscanearNominasEImpuestos();

  revalidatePath('/');
  revalidatePath('/facturas');
  revalidatePath('/emitidas');
  revalidatePath('/conciliacion');
  revalidatePath('/movimientos');
  revalidatePath('/nominas');
  revalidatePath('/impuestos');

  return {
    conciliados: resultado.conciliados + resCobros.conciliados + resNominasEImpuestos.procesados,
    errores: [...resultado.errores, ...resCobros.errores, ...resNominasEImpuestos.errores],
  };
}
