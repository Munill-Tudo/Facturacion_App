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
  const resEscaneo = await autoEscanearNominasEImpuestos();

  revalidatePath('/movimientos');
  revalidatePath('/conciliacion');

  return { inserted: paraInsertar.length, duplicates, autoconciliados: resAuto.conciliados };
}

// ─── Helpers del motor de scoring ────────────────────────────────────────────

const STOP_WORDS = new Set([
  's.a.', 'sa', 'sl', 's.l.', 'slp', 's.l.p.', 'slu', 'sll',
  'spain', 'espana', 'espanya', 'sociedad', 'limitada', 'anonima',
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'e', 'en', 'con',
]);

/** Normaliza texto: minúsculas, sin acentos, sin puntuación */
function normalizar(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ');
}

/** Palabras significativas de un nombre de proveedor (>= 4 letras, sin stop words) */
function palabrasSignificativas(nombre: string): string[] {
  return normalizar(nombre)
    .split(/\s+/)
    .filter(p => p.length >= 4 && !STOP_WORDS.has(p));
}

/**
 * Calcula una puntuación de coincidencia entre un movimiento bancario y una factura.
 * - 100 pts: nombre completo del proveedor encontrado en el texto del banco
 * - 30 pts por cada palabra significativa del proveedor encontrada
 * - Se busca en: concepto + beneficiario + observaciones
 * - Nivel Aprendizaje Automático: +500 si el texto encaja con un movimiento pasado previamente asignado a este proveedor.
 */
function calcularScore(mov: any, factura: any, historicoMap?: Map<string, string[]>): number {
  const normalBankFull = normalizar(
    [mov.concepto, mov.beneficiario, mov.observaciones].filter(Boolean).join(' ')
  );
  
  const rawProvName = factura.nombre_proveedor || factura.cliente || '';
  const nombreProv = normalizar(rawProvName);

  if (!nombreProv || nombreProv.length < 3) return 0;

  let score = 0;

  // Match completo del nombre del proveedor
  if (normalBankFull.includes(nombreProv)) {
    score += 100;
  } else {
    // Match por palabras significativas
    const palabras = palabrasSignificativas(rawProvName);
    if (palabras.length > 0) {
      for (const p of palabras) {
        if (normalBankFull.includes(p)) score += 30;
      }
    }
  }

  // --- Auto-Aprendizaje Histórico ---
  if (historicoMap && historicoMap.has(nombreProv)) {
    const pastBankTexts = historicoMap.get(nombreProv)!;
    
    // Extraemos texto limpio del movimiento actual (beneficiario + concepto prioritarios)
    const curBankClean = normalizar([mov.beneficiario, mov.concepto].filter(Boolean).join(' '));
    const currentWords = curBankClean.split(/\s+/).filter(w => w.length >= 4 && !STOP_WORDS.has(w));

    let matchedHist = false;
    for (const pastStr of pastBankTexts) {
      // 1. Coincidencia exacta (mismo beneficiario y concepto repetido, ej. recibo mensual identico)
      if (curBankClean === pastStr) {
        matchedHist = true; break;
      }
      
      // 2. Coincidencia difusa histórica (comparten al menos 2 palabras clave, ej. "SEPA Vodafone" y "SEPA Vodafone Ene")
      const pastWords = pastStr.split(/\s+/).filter(w => w.length >= 4 && !STOP_WORDS.has(w));
      let common = 0;
      for (const cw of currentWords) {
        if (pastWords.includes(cw)) common++;
      }
      if (common >= 2) {
        matchedHist = true; break;
      }
    }

    if (matchedHist) score += 500;
  }

  return score;
}

// ─── Motor principal ──────────────────────────────────────────────────────────

export async function autoConciliarPagos(): Promise<{ conciliados: number; errores: string[] }> {
  let conciliados = 0;
  const errores: string[] = [];

  try {
    // 1. Obtener TODOS los pagos pendientes (tipo Pago = negativos)
    const { data: pagos, error: pagosErr } = await supabase
      .from('movimientos')
      .select('*')
      .eq('estado_conciliacion', 'Pendiente')
      .eq('tipo', 'Pago');

    if (pagosErr) throw pagosErr;
    if (!pagos || pagos.length === 0) return { conciliados: 0, errores: [] };

    // 2. Obtener TODAS las facturas pendientes
    const { data: facturas, error: facturasErr } = await supabase
      .from('facturas')
      .select('id, nombre_proveedor, cliente, importe, num_expediente, tipo, estado')
      .eq('estado', 'Pendiente');

    if (facturasErr) throw facturasErr;
    if (!facturas || facturas.length === 0) return { conciliados: 0, errores: [] };

    // 3. Obtener Histórico de Auto-Aprendizaje
    // Buscamos movimientos pasados que ya tengan una factura vinculada
    const { data: historial } = await supabase
      .from('movimientos')
      .select('concepto, beneficiario, facturas(nombre_proveedor, cliente)')
      .eq('estado_conciliacion', 'Conciliado')
      .not('factura_id', 'is', null);

    const historicoMap = new Map<string, string[]>();
    if (historial) {
      for (const h of historial) {
        const facs = h.facturas;
        if (!facs) continue;
        const facHist = Array.isArray(facs) ? facs[0] : facs;
        if (!facHist) continue;
        
        const pName = normalizar(facHist.nombre_proveedor || facHist.cliente || '');
        if (!pName) continue;
        
        // Guardamos la firma del banco normalizada (beneficiario + concepto)
        const bankStr = normalizar([h.beneficiario, h.concepto].filter(Boolean).join(' '));
        if (!historicoMap.has(pName)) historicoMap.set(pName, []);
        historicoMap.get(pName)!.push(bankStr);
      }
    }

    // Copia mutable para marcar facturas ya usadas en esta sesión
    const facturasDisponibles = [...facturas];

    for (const mov of pagos) {
      const absImporte = Math.abs(Number(mov.importe));

      // Candidatas por importe exacto
      const candidatas = facturasDisponibles.filter(
        f => Math.abs(Number(f.importe)) === absImporte
      );

      if (candidatas.length === 0) continue;

      let facturaElegida: any = null;
      let nivelConfianza = '';

      if (candidatas.length === 1) {
        // — Caso A: única candidata con ese importe —
        const score = calcularScore(mov, candidatas[0], historicoMap);

        if (score >= 500) {
          facturaElegida = candidatas[0];
          nivelConfianza = 'histórico';
        } else if (score >= 30) {
          // Nivel 1/2: nombre coincide (completo o parcial)
          facturaElegida = candidatas[0];
          nivelConfianza = score >= 100 ? 'exacto' : 'fuzzy';
        } else {
          // Nivel 3: único importe, sin nombre coincidente — conciliamos igualmente
          facturaElegida = candidatas[0];
          nivelConfianza = 'solo_importe';
        }
      } else {
        // — Caso B: múltiples candidatas con ese importe — buscar la con mejor score —
        let mejorScore = 0;
        let mejorCandidatas: any[] = [];

        for (const c of candidatas) {
          const score = calcularScore(mov, c, historicoMap);
          if (score > mejorScore) {
            mejorScore = score;
            mejorCandidatas = [c];
          } else if (score === mejorScore && score > 0) {
            mejorCandidatas.push(c);
          }
        }

        if (mejorScore >= 30 && mejorCandidatas.length >= 1) {
          // Ganador claro por nombre, o empate entre varias facturas del MISMO PROVEEDOR
          // Si hay empate, cogemos la más antigua (menor ID)
          mejorCandidatas.sort((a, b) => a.id - b.id);
          facturaElegida = mejorCandidatas[0];
          nivelConfianza = mejorScore >= 500 ? 'histórico' : (mejorScore >= 100 ? 'exacto' : 'fuzzy');
        }
        // Si hay empate o score=0 con múltiples candidatas → dejar para revisión manual
      }

      // 3. Aplicar conciliación si hay factura elegida
      if (facturaElegida) {
        const { error: updMov } = await supabase
          .from('movimientos')
          .update({
            estado_conciliacion: 'Conciliado',
            factura_id: facturaElegida.id,
            cliente_expediente: facturaElegida.num_expediente
              || facturaElegida.nombre_proveedor
              || facturaElegida.cliente
              || null,
          })
          .eq('id', mov.id);

        if (updMov) {
          errores.push(`Movimiento ${mov.id}: ${updMov.message}`);
          continue;
        }

        const { error: updFact } = await supabase
          .from('facturas')
          .update({
            estado: 'Pagada',
            fecha_pago: mov.fecha,
          })
          .eq('id', facturaElegida.id);

        if (updFact) {
          errores.push(`Factura ${facturaElegida.id}: ${updFact.message}`);
          continue;
        }

        // Quitar de disponibles para no reutilizar en la misma sesión
        const idx = facturasDisponibles.findIndex(f => f.id === facturaElegida.id);
        if (idx > -1) facturasDisponibles.splice(idx, 1);

        console.log(
          `[AutoConciliación] ✅ "${mov.concepto}" (${absImporte}€) → Factura #${facturaElegida.id} "${facturaElegida.nombre_proveedor || facturaElegida.cliente}" [${nivelConfianza}]`
        );
        conciliados++;
      }
    }
  } catch (err: any) {
    console.error("Error en motor de auto-conciliacion:", err);
    errores.push(err?.message || 'Error desconocido');
  }

  return { conciliados, errores };
}

// ─── Motor de Extracción: Nóminas e Impuestos ───────────────────────────────

export async function autoEscanearNominasEImpuestos(): Promise<{ procesados: number; errores: string[] }> {
  let procesados = 0;
  const errores: string[] = [];

  try {
    // 1. Obtener todos los movimientos pendientes (pagos negativos)
    const { data: pendientes, error: errPend } = await supabase
      .from('movimientos')
      .select('*')
      .eq('estado_conciliacion', 'Pendiente')
      .eq('tipo', 'Pago');

    if (errPend) throw errPend;
    if (!pendientes || pendientes.length === 0) return { procesados: 0, errores: [] };

    for (const mov of pendientes) {
      const concepto = (mov.concepto || '').toUpperCase();
      const obs = (mov.observaciones || '').toUpperCase();
      const rawText = `${concepto} ${obs}`;

      // A) NÓMINAS
      if (rawText.includes('PAGO DE NOMINAS POR SU CUENTA') || rawText.includes('NOMINA')) {
        // Observación típica: "NOMINA LAURA GARCIA MORAL MUNILL ABOGADOS SLP - MARZO 2026"
        // Regex: /NOMINA\s+(.*?)\s+MUNILL ABOGADOS.*-\s+(.*)/i
        let empleado = 'Empleado Desconocido';
        let periodo = 'Periodo Desconocido';

        const match = obs.match(/NOMINA\s+(.*?)\s+MUNILL ABOGADOS.*?-\s+(.*)/i);
        if (match) {
          empleado = match[1].trim();
          periodo = match[2].trim();
        } else {
          // Fallback, tratar de extraer algo razonable o usar por defecto
          empleado = 'Revisar Empleado';
          periodo = mov.fecha.substring(0, 7); // YYYY-MM
        }

        // Crear registro en nominas
        const { error: errNom } = await supabase.from('nominas').insert([{
          empleado,
          periodo,
          importe: Math.abs(Number(mov.importe)),
          fecha_pago: mov.fecha,
          estado: 'Conciliado',
          movimiento_id: mov.id
        }]);

        if (errNom) {
          errores.push(`Error creando nómina mov ${mov.id}: ${errNom.message}`);
          continue;
        }

        // Marcar movimiento como conciliado
        await supabase.from('movimientos').update({
          estado_conciliacion: 'Conciliado',
          cliente_expediente: `Nómina: ${empleado} (${periodo})`
        }).eq('id', mov.id);

        procesados++;
        continue;
      }

      // B) IMPUESTOS - SEGURIDAD SOCIAL
      if (rawText.includes('TGSS') || rawText.includes('SEGUROS SOCIALES') || rawText.includes('COTIZACION')) {
        const { error: errImp } = await supabase.from('impuestos').insert([{
          concepto: mov.concepto,
          tipo: 'Mensual',
          periodo: mov.fecha.substring(0, 7), // YYYY-MM
          importe: Math.abs(Number(mov.importe)),
          fecha_devengo: mov.fecha,
          fecha_pago: mov.fecha,
          estado: 'Conciliado',
          movimiento_id: mov.id,
          notas: 'Auto-detectado Seguridad Social'
        }]);

        if (errImp) {
          errores.push(`Error creando impuesto TGSS mov ${mov.id}: ${errImp.message}`);
          continue;
        }

        await supabase.from('movimientos').update({
          estado_conciliacion: 'Conciliado',
          cliente_expediente: `Impuesto (Seguridad Social)`
        }).eq('id', mov.id);

        procesados++;
        continue;
      }

      // C) IMPUESTOS - AYUNTAMIENTO
      if (rawText.includes('RECAUDACION MUNICIPAL') || rawText.includes('AJUNTAMENT') || rawText.includes('AYUNTAMIENTO')) {
        const { error: errImp } = await supabase.from('impuestos').insert([{
          concepto: mov.concepto,
          tipo: 'Ayuntamiento',
          periodo: new Date(mov.fecha).getFullYear().toString(),
          importe: Math.abs(Number(mov.importe)),
          fecha_devengo: mov.fecha,
          fecha_pago: mov.fecha,
          estado: 'Conciliado',
          movimiento_id: mov.id,
          notas: 'Auto-detectado Ayuntamiento'
        }]);

        if (errImp) {
          errores.push(`Error creando impuesto Ayto mov ${mov.id}: ${errImp.message}`);
          continue;
        }

        await supabase.from('movimientos').update({
          estado_conciliacion: 'Conciliado',
          cliente_expediente: `Impuesto (Ayuntamiento)`
        }).eq('id', mov.id);

        procesados++;
        continue;
      }

      // D) IMPUESTOS - AEAT
      const esPagoTarjeta = rawText.includes('PAGO CON TARJETA DE TASA') || rawText.includes('TARJETA');
      if (!esPagoTarjeta && (rawText.includes('AEAT') || rawText.includes('AGENCIA TRIBUTARIA') || rawText.includes('IMPUESTO'))) {
        const { error: errImp } = await supabase.from('impuestos').insert([{
          concepto: mov.concepto,
          tipo: 'Trimestral', // Por defecto; el usuario puede revisarlo
          periodo: new Date(mov.fecha).getFullYear().toString(),
          importe: Math.abs(Number(mov.importe)),
          fecha_devengo: mov.fecha,
          fecha_pago: mov.fecha,
          estado: 'Conciliado',
          movimiento_id: mov.id,
          notas: 'Auto-detectado Agencia Tributaria'
        }]);

        if (errImp) {
          errores.push(`Error creando impuesto AEAT mov ${mov.id}: ${errImp.message}`);
          continue;
        }

        await supabase.from('movimientos').update({
          estado_conciliacion: 'Conciliado',
          cliente_expediente: `Impuesto (Agencia Tributaria)`
        }).eq('id', mov.id);

        procesados++;
        continue;
      }
    }

  } catch (err: any) {
    console.error("Error en motor de extracción:", err);
    errores.push(err?.message || 'Error desconocido');
  }

  return { procesados, errores };
}
