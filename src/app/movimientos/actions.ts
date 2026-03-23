'use server';

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function bulkInsertMovimientos(nuevosMovimientos: any[]) {
  if (!nuevosMovimientos.length) return { inserted: 0, duplicates: 0 };

  // 1. Obtener el rango de fechas para no descargar toda la BD
  const fechas = nuevosMovimientos.map(m => m.fecha);
  const minDate = fechas.reduce((min, f) => f < min ? f : min, fechas[0]);
  const maxDate = fechas.reduce((max, f) => f > max ? f : max, fechas[0]);

  // 2. Traer movimientos existentes en ese rango
  const { data: existentes, error } = await supabase
    .from('movimientos')
    .select('fecha, concepto, importe')
    .gte('fecha', minDate)
    .lte('fecha', maxDate);

  if (error) {
    console.error("Error validando duplicados:", error);
    throw new Error("No se constató duplicidad. Cancelado por seguridad.");
  }

  const existingSet = new Set(
    (existentes || []).map(e => `${e.fecha}_${e.concepto}_${Number(e.importe)}`)
  );

  const paraInsertar = [];
  let duplicates = 0;

  for (const mov of nuevosMovimientos) {
    const key = `${mov.fecha}_${mov.concepto}_${Number(mov.importe)}`;
    if (existingSet.has(key)) {
      duplicates++;
    } else {
      paraInsertar.push(mov);
      // lo agregamos al set por si hay duplicados dentro del mismo excel
      existingSet.add(key);
    }
  }

  if (paraInsertar.length > 0) {
    const { error: insertErr } = await supabase
      .from('movimientos')
      .insert(paraInsertar);

    if (insertErr) {
      console.error(insertErr);
      throw new Error("Error guardando movimientos: " + insertErr.message);
    }
  }

  revalidatePath('/movimientos');
  revalidatePath('/conciliacion');

  return { inserted: paraInsertar.length, duplicates };
}
