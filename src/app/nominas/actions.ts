'use server';

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export type NominaInput = {
  empleado: string;
  periodo: string;
  importe: number;
  fecha_pago: string;
};

export async function crearNomina(data: NominaInput) {
  const { error } = await supabase.from('nominas').insert([{
    empleado: data.empleado,
    periodo: data.periodo,
    importe: data.importe,
    fecha_pago: data.fecha_pago,
    estado: 'Pagado',
  }]);
  if (error) throw new Error(error.message);
  revalidatePath('/nominas');
}

export async function actualizarNomina(id: string, data: NominaInput) {
  const { error } = await supabase.from('nominas').update({
    empleado: data.empleado,
    periodo: data.periodo,
    importe: data.importe,
    fecha_pago: data.fecha_pago,
  }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/nominas');
}

export async function eliminarNomina(id: string) {
  const { error } = await supabase.from('nominas').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/nominas');
}

export async function vincularMovimientoNomina(nominaId: string, movimientoId: number) {
  // 1. Actualizar nómina
  const { error: errNom } = await supabase.from('nominas').update({
    movimiento_id: movimientoId,
    estado: 'Conciliado',
  }).eq('id', nominaId);
  if (errNom) throw new Error(errNom.message);

  // 2. Marcar movimiento como conciliado
  const { data: nom } = await supabase
    .from('nominas')
    .select('empleado, periodo')
    .eq('id', nominaId)
    .single();

  const label = nom ? `Nómina: ${nom.empleado} (${nom.periodo})` : 'Nómina';

  await supabase.from('movimientos').update({
    estado_conciliacion: 'Conciliado',
    cliente_expediente: label,
  }).eq('id', movimientoId);

  revalidatePath('/nominas');
  revalidatePath('/conciliacion');
  revalidatePath('/movimientos');
}

export async function desvincularMovimientoNomina(nominaId: string, movimientoId: number) {
  await supabase.from('nominas').update({
    movimiento_id: null,
    estado: 'Pagado',
  }).eq('id', nominaId);

  await supabase.from('movimientos').update({
    estado_conciliacion: 'Pendiente',
    cliente_expediente: null,
  }).eq('id', movimientoId);

  revalidatePath('/nominas');
  revalidatePath('/conciliacion');
  revalidatePath('/movimientos');
}
