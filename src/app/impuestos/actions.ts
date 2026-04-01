'use server';

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export type ImpuestoInput = {
  concepto: string;
  tipo: 'Trimestral' | 'Anual' | 'Mensual' | 'Ayuntamiento';
  periodo: string;
  importe: number;
  fecha_devengo: string;
  fecha_pago?: string | null;
  notas?: string | null;
};

export async function crearImpuesto(data: ImpuestoInput) {
  const { error } = await supabase.from('impuestos').insert([{
    concepto: data.concepto,
    tipo: data.tipo,
    periodo: data.periodo,
    importe: data.importe,
    fecha_devengo: data.fecha_devengo,
    fecha_pago: data.fecha_pago || null,
    estado: data.fecha_pago ? 'Pagado' : 'Pendiente',
    notas: data.notas || null,
  }]);
  if (error) throw new Error(error.message);
  revalidatePath('/impuestos');
}

export async function actualizarImpuesto(id: string, data: ImpuestoInput) {
  const { error } = await supabase.from('impuestos').update({
    concepto: data.concepto,
    tipo: data.tipo,
    periodo: data.periodo,
    importe: data.importe,
    fecha_devengo: data.fecha_devengo,
    fecha_pago: data.fecha_pago || null,
    // Si ya estaba conciliado, no retroceder el estado
    notas: data.notas || null,
  }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/impuestos');
}

export async function eliminarImpuesto(id: string) {
  const { error } = await supabase.from('impuestos').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/impuestos');
}

export async function vincularMovimiento(impuestoId: string, movimientoId: number) {
  // 1. Actualizar impuesto
  const { error: errImp } = await supabase.from('impuestos').update({
    movimiento_id: movimientoId,
    estado: 'Conciliado',
  }).eq('id', impuestoId);
  if (errImp) throw new Error(errImp.message);

  // 2. Marcar movimiento como conciliado
  const { data: impuesto } = await supabase
    .from('impuestos')
    .select('concepto, periodo')
    .eq('id', impuestoId)
    .single();

  const label = impuesto ? `Impuesto: ${impuesto.concepto} (${impuesto.periodo})` : 'Impuesto';

  await supabase.from('movimientos').update({
    estado_conciliacion: 'Conciliado',
    cliente_expediente: label,
  }).eq('id', movimientoId);

  revalidatePath('/impuestos');
  revalidatePath('/conciliacion');
  revalidatePath('/movimientos');
}

export async function desvincularMovimiento(impuestoId: string, movimientoId: number) {
  // Revertir impuesto a Pagado (si tenía fecha_pago) o Pendiente
  const { data: imp } = await supabase
    .from('impuestos')
    .select('fecha_pago')
    .eq('id', impuestoId)
    .single();

  await supabase.from('impuestos').update({
    movimiento_id: null,
    estado: imp?.fecha_pago ? 'Pagado' : 'Pendiente',
  }).eq('id', impuestoId);

  // Revertir movimiento a Pendiente
  await supabase.from('movimientos').update({
    estado_conciliacion: 'Pendiente',
    cliente_expediente: null,
  }).eq('id', movimientoId);

  revalidatePath('/impuestos');
  revalidatePath('/conciliacion');
  revalidatePath('/movimientos');
}

/**
 * Auto-conciliación de impuestos:
 * Busca impuestos en estado 'Pagado' (sin movimiento vinculado) y los cruza
 * con movimientos bancarios 'Pendiente' cuyo importe coincida exactamente.
 */
export async function autoConciliarImpuestos(): Promise<{ conciliados: number; errores: string[] }> {
  const errores: string[] = [];
  let conciliados = 0;

  // 1. Obtener impuestos pagados sin conciliar
  const { data: impuestos, error: errImp } = await supabase
    .from('impuestos')
    .select('id, concepto, periodo, importe')
    .eq('estado', 'Pagado')
    .is('movimiento_id', null);

  if (errImp) return { conciliados: 0, errores: [errImp.message] };
  if (!impuestos || impuestos.length === 0) return { conciliados: 0, errores: [] };

  // 2. Obtener movimientos bancarios pendientes (pagos negativos o cualquier pendiente)
  const { data: movimientos, error: errMov } = await supabase
    .from('movimientos')
    .select('id, importe, concepto, fecha')
    .eq('estado_conciliacion', 'Pendiente');

  if (errMov) return { conciliados: 0, errores: [errMov.message] };
  if (!movimientos || movimientos.length === 0) return { conciliados: 0, errores: [] };

  // 3. Cruzar por importe exacto (valor absoluto)
  const movUsados = new Set<string>();

  for (const imp of impuestos) {
    const impImporte = Math.abs(Number(imp.importe));
    const match = movimientos.find(m =>
      !movUsados.has(m.id) && Math.abs(Number(m.importe)) === impImporte
    );

    if (!match) continue;

    try {
      movUsados.add(match.id);
      const label = `Impuesto: ${imp.concepto} (${imp.periodo})`;

      await supabase.from('impuestos').update({
        movimiento_id: match.id,
        estado: 'Conciliado',
      }).eq('id', imp.id);

      await supabase.from('movimientos').update({
        estado_conciliacion: 'Conciliado',
        cliente_expediente: label,
      }).eq('id', match.id);

      conciliados++;
    } catch (err: any) {
      errores.push(`Error conciliando ${imp.concepto}: ${err.message}`);
    }
  }

  revalidatePath('/impuestos');
  revalidatePath('/conciliacion');
  revalidatePath('/movimientos');

  return { conciliados, errores };
}
