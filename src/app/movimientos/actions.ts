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
    return { error: "No se pudo validar duplicados en la base de datos." };
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
      // Eliminar campos de UI antes de insertar en BD
      const { _idUnico, ...dbMov } = mov;
      paraInsertar.push(dbMov);
      // lo agregamos al set por si hay duplicados dentro del mismo excel
      existingSet.add(key);
    }
  }

  if (paraInsertar.length > 0) {
    const { error: insertErr } = await supabase
      .from('movimientos')
      .insert(paraInsertar);

    if (insertErr) {
      console.error("Error Insertando:", insertErr);
      return { error: `Error guardando movimientos: ${insertErr.message || JSON.stringify(insertErr)}` };
    }
  }

  // Desencadenar auto-conciliador inteligente
  const resAuto = await autoConciliarPagos();

  revalidatePath('/movimientos');
  revalidatePath('/conciliacion');

  return { inserted: paraInsertar.length, duplicates, autoconciliados: resAuto.conciliados };
}

export async function autoConciliarPagos() {
  let conciliados = 0;

  try {
    // 1. Obtener pagos pendientes
    const { data: pagos } = await supabase
      .from('movimientos')
      .select('*')
      .eq('estado_conciliacion', 'Pendiente')
      .eq('tipo', 'Pago');

    if (!pagos || pagos.length === 0) return { conciliados: 0 };

    // 2. Obtener facturas pendientes
    const { data: facturas } = await supabase
      .from('facturas')
      .select('*')
      .eq('estado', 'Pendiente');

    if (!facturas || facturas.length === 0) return { conciliados: 0 };

    // 3. Evaluar cada pago huérfano
    for (const mov of pagos) {
      const absImporte = Math.abs(Number(mov.importe));
      
      // Facturas con importe exacto
      const candidatas = facturas.filter(f => Math.abs(Number(f.importe)) === absImporte);
      
      if (candidatas.length === 0) continue;

      let facturaAConciliar = null;

      if (candidatas.length === 1) {
        // Solo 1 candidata con este importe. Verificamos la coincidencia de nombre (Nivel 1)
        const concepto = (mov.concepto || '').toLowerCase();
        const provNombre = (candidatas[0].nombre_proveedor || candidatas[0].cliente || '').toLowerCase();
        
        // Si el nombre del proveedor tiene más de 3 letras y está contenido en el concepto del banco
        if (provNombre && provNombre.length > 3 && concepto.includes(provNombre)) {
          facturaAConciliar = candidatas[0];
        } else {
          // Si el proveedor tiene múltiples palabras (ej. "VODAFONE ESPAÑA"), miramos si al menos la primera palabra principal está en el concepto
          const palabras = provNombre.split(' ').filter((p: string) => p.length > 3);
          if (palabras.length > 0 && concepto.includes(palabras[0])) {
            facturaAConciliar = candidatas[0];
          }
        }
      }

      // 4. Aplicar Auto-Conciliación
      if (facturaAConciliar) {
        // Actualizar Movimiento
        await supabase.from('movimientos').update({
          estado_conciliacion: 'Conciliado',
          factura_id: facturaAConciliar.id
        }).eq('id', mov.id);

        // Actualizar Factura
        await supabase.from('facturas').update({
          estado: 'Pagada',
          fecha_pago: mov.fecha
        }).eq('id', facturaAConciliar.id);

        // Quitar de la lista en memoria para que no se vuelva a emparejar
        const fIndex = facturas.findIndex(f => f.id === facturaAConciliar.id);
        if (fIndex > -1) facturas.splice(fIndex, 1);

        conciliados++;
      }
    }
  } catch (err) {
    console.error("Error en motor de auto-conciliacion:", err);
  }

  return { conciliados };
}
