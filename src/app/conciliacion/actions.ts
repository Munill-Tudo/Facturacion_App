'use server';

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { autoConciliarPagos, autoConciliarCobros, autoEscanearNominasEImpuestos } from "@/app/movimientos/actions";
import { createConciliacionLink, resolveIncidencias, syncIncidenciasBasicas } from "@/lib/operativa";

export async function asociarPagoAFactura(movimientoId: string, facturaId: number) {
  const { data: fac } = await supabase
    .from('facturas')
    .select('nombre_proveedor, cliente, num_expediente')
    .eq('id', facturaId)
    .single();

  const { data: mov } = await supabase
    .from('movimientos')
    .select('importe')
    .eq('id', movimientoId)
    .single();

  const clienteExp = fac ? (fac.num_expediente || fac.nombre_proveedor || fac.cliente || null) : null;

  await supabase.from('movimientos')
    .update({
      estado_conciliacion: 'Conciliado',
      factura_id: facturaId,
      cliente_expediente: clienteExp
    })
    .eq('id', movimientoId);

  await supabase.from('facturas')
    .update({ estado: 'Pagada' })
    .eq('id', facturaId);

  await createConciliacionLink({
    movimientoId,
    documentoTipo: 'factura_recibida',
    documentoId: facturaId,
    relacionTipo: 'manual',
    importeAplicado: Math.abs(Number(mov?.importe || 0)),
    origen: 'manual',
    observacion: 'Asociación manual desde pantalla de conciliación',
  });

  await resolveIncidencias({ entidadTipo: 'movimiento', entidadId: movimientoId, tipos: ['movimiento_sin_soporte', 'fecha_dudosa'] });
  await resolveIncidencias({ entidadTipo: 'factura_recibida', entidadId: facturaId, tipos: ['factura_sin_movimiento', 'fecha_dudosa'] });
  await syncIncidenciasBasicas();

  revalidatePath('/');
  revalidatePath('/facturas');
  revalidatePath('/conciliacion');
  revalidatePath('/bandeja');
}

export async function asignarCobroACliente(movimientoId: string, clienteExpediente: string) {
  await supabase.from('movimientos')
    .update({
      estado_conciliacion: 'Conciliado',
      cliente_expediente: clienteExpediente
    })
    .eq('id', movimientoId);

  await resolveIncidencias({ entidadTipo: 'movimiento', entidadId: movimientoId, tipos: ['cobro_sin_asignar', 'fecha_dudosa'] });
  await syncIncidenciasBasicas();

  revalidatePath('/conciliacion');
  revalidatePath('/bandeja');
}

export async function lanzarAutoConciliacion(): Promise<{ conciliados: number; errores: string[] }> {
  const resultado = await autoConciliarPagos();
  const resCobros = await autoConciliarCobros();
  const resNominasEImpuestos = await autoEscanearNominasEImpuestos();
  await syncIncidenciasBasicas();

  revalidatePath('/');
  revalidatePath('/facturas');
  revalidatePath('/emitidas');
  revalidatePath('/conciliacion');
  revalidatePath('/movimientos');
  revalidatePath('/nominas');
  revalidatePath('/impuestos');
  revalidatePath('/bandeja');

  return {
    conciliados: resultado.conciliados + resCobros.conciliados + resNominasEImpuestos.procesados,
    errores: [...resultado.errores, ...resCobros.errores, ...resNominasEImpuestos.errores],
  };
}
