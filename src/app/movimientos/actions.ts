'use server';

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { 
  obtenerFirmaContrapartida, 
  extraerYValidarISO11649, 
  generarHashTransaccion 
} from "@/lib/normalizacion";

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
    (existentes || []).map(e => generarHashTransaccion(e.fecha, e.concepto, Number(e.importe)))
  );

  const paraInsertar = [];
  let duplicates = 0;

  for (const mov of nuevosMovimientos) {
    const key = generarHashTransaccion(mov.fecha, mov.concepto, Number(mov.importe));
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
  const resCobros = await autoConciliarCobros();
  const resEscaneo = await autoEscanearNominasEImpuestos();

  revalidatePath('/movimientos');
  revalidatePath('/conciliacion');

  return { inserted: paraInsertar.length, duplicates, autoconciliados: resAuto.conciliados + resCobros.conciliados };
}

// ─── Motor principal de Autoconciliación (Pasadas Estrictas) ─────────────────

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
    // Se extraen todos los campos para normalizarlos en memoria
    const { data: facturas, error: facturasErr } = await supabase
      .from('facturas')
      .select('id, nombre_proveedor, cliente, importe, num_expediente, tipo, estado')
      .eq('estado', 'Pendiente');

    if (facturasErr) throw facturasErr;
    if (!facturas || facturas.length === 0) return { conciliados: 0, errores: [] };

    // 2b. Obtener la suma de movimientos ya conciliados para estas facturas (Pagos Parciales)
    const facturasIds = facturas.map(f => f.id);
    const { data: movsConciliados, error: errMovs } = await supabase
      .from('movimientos')
      .select('factura_id, importe')
      .in('factura_id', facturasIds)
      .eq('estado_conciliacion', 'Conciliado');

    if (errMovs) throw errMovs;

    const pagadoPorFactura: Record<number, number> = {};
    for (const id of facturasIds) pagadoPorFactura[id] = 0;
    for (const m of (movsConciliados || [])) {
      if (m.factura_id) {
        pagadoPorFactura[m.factura_id] += Math.abs(Number(m.importe));
      }
    }

    // Preparar facturas normalizadas en memoria
    const facturasNorm = facturas.map(f => {
      const rf_raw = extraerYValidarISO11649(f.nombre_proveedor || '') || extraerYValidarISO11649(f.cliente || '');
      const pagado = pagadoPorFactura[f.id] || 0;
      return {
        ...f,
        firma_contrapartida: obtenerFirmaContrapartida(f.nombre_proveedor || f.cliente || ''),
        referencia_rf: rf_raw, // Si hubiera campo en BD se usaría ese, temporalmente extraemos del texto
        saldo_pendiente: Number(f.importe) - pagado
      };
    });

    // Copia mutable para pilar facturas y no re-conciliarlas
    const facturasDisponibles = [...facturasNorm];

    for (const mov of pagos) {
      const absImporte = Math.abs(Number(mov.importe));
      const strBanco = [mov.concepto, mov.beneficiario, mov.observaciones].filter(Boolean).join(' ');
      
      let facturaElegida: any = null;
      let pasoConciliacion = '';

      // --- PASADA B: Regla Determinística 1:1 Máxima (RF) ---
      const rfMovimiento = extraerYValidarISO11649(strBanco);
      
      if (rfMovimiento) {
        // Buscar factura que comparta exactamente esa RF
        const candidatasRF = facturasDisponibles.filter(f => f.referencia_rf === rfMovimiento);
        
        if (candidatasRF.length === 1) {
          facturaElegida = candidatasRF[0];
          pasoConciliacion = 'PASADA B (RF Exacto)';
        } else if (candidatasRF.length > 1) {
           // En el extraño caso de que haya dos facturas con MISMA RF, abortamos autoconciliación
           errores.push(`Movimiento ${mov.id}: Múltiples facturas comparten la RF ${rfMovimiento}. Ambigüedad detectada.`);
           continue; 
        }
      }

      // --- PASADA C: Regla 1:1 Mismo Importe + Contrapartida Estricta ---
      if (!facturaElegida) {
        // En esta capa, SI O SI el importe tiene que cruzar al 100% con el SALDO PENDIENTE (Tolerancia 5 cents)
        const candidatasImporte = facturasDisponibles.filter(f => Math.abs(f.saldo_pendiente - absImporte) < 0.05);
        
        if (candidatasImporte.length > 0) {
          // Extraemos firma de la contrapartida en el banco
          const firmaBanco = obtenerFirmaContrapartida(strBanco);
          
          let candidatasFuertes: any[] = [];
          
          if (candidatasImporte.length === 1) {
             // Si solo hay una candidata con ese importe exacto...
             // SOLO conciliamos si hay un match razonable en el texto.
             // Para evitar matches ciegos por importe, validamos si la firma de la factura aparece en el banco
             const fCandidata = candidatasImporte[0];
             if (fCandidata.firma_contrapartida.length > 3 && firmaBanco.includes(fCandidata.firma_contrapartida)) {
                 facturaElegida = fCandidata;
                 pasoConciliacion = 'PASADA C (Único Importe + Nombre coincide)';
             }
             // Si el importe es único pero el nombre NO coincide en absoluto, NO conciliamos. (Adiós error de adivinanza).
          } else {
             // Si hay varias facturas del mismo importe exacto
             // Filtramos las que compartan la misma firma
             for (const cand of candidatasImporte) {
                if (cand.firma_contrapartida.length > 3 && firmaBanco.includes(cand.firma_contrapartida)) {
                  candidatasFuertes.push(cand);
                }
             }

             if (candidatasFuertes.length === 1) {
                facturaElegida = candidatasFuertes[0];
                pasoConciliacion = 'PASADA C (Desempate por Nombre Exacto)';
             } else if (candidatasFuertes.length > 1) {
                // EXCEPCIÓN: Varias facturas del MISMO IMPORTE y MISMO PROVEEDOR. No adivinamos.
                console.warn(`[AutoConciliación] Ambigüedad: Movimiento ${mov.id} ${absImporte} tiene múltiples facturas de idéntico proveedor.`);
                errores.push(`Movimiento ${mov.id}: Varias facturas del saldo pendiente y proveedor idénticos. Requiere revisión manual.`);
             }
          }
        }
      }

      // --- PASADA D: Pagos Parciales Lógicos FIFO (N:1) ---
      if (!facturaElegida) {
         const firmaBanco = obtenerFirmaContrapartida(strBanco);
         if (firmaBanco.length > 5) {
             // Buscamos facturas cuya firma principal esté en el banco
             // Excluyendo facturas que ya no tienen saldo suficiente para absorber entero este movimiento (tolerancia 5 cents)
             const candidatasNombre = facturasDisponibles.filter(f => 
                  f.firma_contrapartida.length > 3 && 
                  firmaBanco.includes(f.firma_contrapartida) &&
                  f.saldo_pendiente >= (absImporte - 0.05)
             ).sort((a,b) => a.id - b.id); // Orden FIFO: la más antigua primero
             
             if (candidatasNombre.length > 0) {
                 facturaElegida = candidatasNombre[0];
                 pasoConciliacion = 'PASADA D (Asignación Parcial FIFO)';
             }
         }
      }

      // --- APLICAR CONCILIACIÓN si hubo victoria clara ---
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

        // Restar el pago al saldo pendiente en memoria para la siguiente iteración de movimientos
        facturaElegida.saldo_pendiente -= absImporte;
        
        let nuevoEstado = 'Pendiente';
        if (facturaElegida.saldo_pendiente < 0.05) {
            nuevoEstado = 'Pagada';
            // Quitar de facturas disponibles ya que su saldo quedó en 0
            const idx = facturasDisponibles.findIndex(f => f.id === facturaElegida.id);
            if (idx > -1) facturasDisponibles.splice(idx, 1);
        }

        const { error: updFact } = await supabase
          .from('facturas')
          .update({
            estado: nuevoEstado,
            fecha_pago: nuevoEstado === 'Pagada' ? mov.fecha : facturaElegida.fecha_pago,
          })
          .eq('id', facturaElegida.id);

        if (updFact) {
          errores.push(`Factura ${facturaElegida.id}: ${updFact.message}`);
          continue;
        }

        console.log(
          `[AutoConciliación] ✅ [${pasoConciliacion}] -> Movimiento ${mov.id} (${absImporte}€) -> Fact. #${facturaElegida.id} (${nuevoEstado === 'Pagada' ? 'Liquidada Válida' : `Restan ${facturaElegida.saldo_pendiente.toFixed(2)}€`})`
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

// ─── Motor de Conciliación de Ingresos y Remesas TPV ────────────────────────
export async function autoConciliarCobros(): Promise<{ conciliados: number; errores: string[] }> {
  let conciliados = 0;
  const errores: string[] = [];

  try {
    // 1. Obtener ingresos pendientes
    const { data: ingresos, error: ingErr } = await supabase
      .from('movimientos')
      .select('*')
      .eq('estado_conciliacion', 'Pendiente')
      .eq('tipo', 'Ingreso');

    if (ingErr) throw ingErr;
    if (!ingresos || ingresos.length === 0) return { conciliados: 0, errores: [] };

    // 2. Obtener Facturas Emitidas pendientes
    const { data: facturas, error: facturasErr } = await supabase
      .from('facturas_emitidas')
      .select('*')
      .eq('estado', 'Pendiente')
      .order('fecha', { ascending: true });

    if (facturasErr) throw facturasErr;
    if (!facturas || facturas.length === 0) return { conciliados: 0, errores: [] };

    const facturasDisponibles = [...facturas];

    for (const mov of ingresos) {
      if (facturasDisponibles.length === 0) break;
      const originalImporte = Number(mov.importe) || 0;
      if (originalImporte <= 0) continue;

      const strBanco = [mov.concepto, mov.beneficiario, mov.observaciones].filter(Boolean).join(' ').toUpperCase();

      // --- MODO REMESA TPV ---
      if (strBanco.includes('LIQUIDACION REMESA DE COMERCIOS') || strBanco.includes('LIQUIDACION REMESA')) {
         const movDate = new Date(mov.fecha);
         // Filtrar facturas emitidas hasta 7 días antes del movimiento
         const fCandidatas = facturasDisponibles.filter(f => {
            const fd = new Date(f.fecha);
            const diffDays = (movDate.getTime() - fd.getTime()) / (1000 * 3600 * 24);
            return diffDays >= -1 && diffDays <= 7;
         });

         if (fCandidatas.length > 0) {
            const validSubsets: any[][] = [];
            const dfs = (idx: number, currentSum: number, currentSubset: any[]) => {
               // El banco ingresa MENOS, luego currentSum (facturas) debe ser MAYOR (facturas = banco + comisión)
               // Aceptamos entre un 0% y un 2% extra sobre el ingreso como límite de comisión
               const maxTolerado = originalImporte * 1.025; 
               
               // Pequeño margen para compensar redondeos: originalImporte - 0.05
               if (currentSum >= (originalImporte - 0.05) && currentSum <= maxTolerado) {
                   validSubsets.push([...currentSubset]);
               }
               if (currentSum > maxTolerado) return;
               
               for (let i = idx; i < fCandidatas.length; i++) {
                   const f = fCandidatas[i];
                   currentSubset.push(f);
                   dfs(i + 1, currentSum + Number(f.importe), currentSubset);
                   currentSubset.pop();
               }
            };
            dfs(0, 0, []);

            if (validSubsets.length > 0) {
               // Ordenamos para coger el subset con menor diferencia (comisión más ajustada)
               validSubsets.sort((a,b) => {
                   const sa = a.reduce((acc, f) => acc + Number(f.importe), 0);
                   const sb = b.reduce((acc, f) => acc + Number(f.importe), 0);
                   return Math.abs(sa - originalImporte) - Math.abs(sb - originalImporte);
               });

               const bestSubset = validSubsets[0];
               const totalSubset = bestSubset.reduce((acc, f) => acc + Number(f.importe), 0);
               const comision = totalSubset - originalImporte;

               const facturasIds = bestSubset.map((f: any) => f.numero || f.id);
               
               // 1. Marcar movimiento bancario
               await supabase.from('movimientos').update({
                  estado_conciliacion: 'Conciliado',
                  cliente_expediente: `TPV Remesa (${facturasIds.length} fc: ${facturasIds.join(',')})`
               }).eq('id', mov.id);

               // 2. Marcar facturas involucradas
               for (const f of bestSubset) {
                  await supabase.from('facturas_emitidas').update({ estado: 'Pagada' }).eq('id', f.id);
                  const idx = facturasDisponibles.findIndex(fd => fd.id === f.id);
                  if (idx > -1) facturasDisponibles.splice(idx, 1);
               }

               // 3. Crear gasto automático por la comisión bancaria (Si > 0.05€)
               if (comision > 0.05) {
                  await supabase.from('movimientos').insert([{
                     fecha: mov.fecha,
                     concepto: 'Comisión TPV Bancaria (Auto)',
                     observaciones: `Comisión retenida de la remesa de comercios. Fcs: ${facturasIds.join(',')}`,
                     importe: -parseFloat(comision.toFixed(2)),
                     tipo: 'Pago',
                     estado_conciliacion: 'Conciliado',
                     cliente_expediente: 'Liquidación TPV'
                  }]);
               }

               conciliados++;
               continue; // Siguiente movimiento
            }
         }
      }

      // --- MODO NORMAL (1:1 o Tolerancia Céntimos) ---
      let facturaElegida: any = null;

      // Por RF Maestro
      const rfMovimiento = extraerYValidarISO11649(strBanco);
      if (rfMovimiento) {
         const candidatasRF = facturasDisponibles.filter(f => f.referencia_rf === rfMovimiento);
         if (candidatasRF.length === 1) {
             facturaElegida = candidatasRF[0];
         }
      }

      // Por Tolerancia (±0.05)
      if (!facturaElegida) {
         const candidatasImporte = facturasDisponibles.filter(f => Math.abs(Number(f.importe) - originalImporte) <= 0.05);

         if (candidatasImporte.length === 1) {
             facturaElegida = candidatasImporte[0];
         } else if (candidatasImporte.length > 1) {
             // Desempate por nombre
             const fnameMatched = candidatasImporte.filter(f => strBanco.includes(f.cliente.toUpperCase().split(' ')[0]));
             if (fnameMatched.length === 1) facturaElegida = fnameMatched[0];
         }
      }

      if (facturaElegida) {
          const diferencia = originalImporte - Number(facturaElegida.importe);
          
          await supabase.from('movimientos').update({
              estado_conciliacion: 'Conciliado',
              factura_id: facturaElegida.id, // Si ampliamos el schema para soportarlo
              cliente_expediente: facturaElegida.cliente
          }).eq('id', mov.id);

          await supabase.from('facturas_emitidas').update({ estado: 'Pagada' }).eq('id', facturaElegida.id);

          // Si el cliente nos pagó mal (céntimos de diferencia), es asumible y se da por saldada
          if (Math.abs(diferencia) > 0.005) {
               // Podríamos crear un mini-movimiento de ajuste en el futuro.
          }

          const idx = facturasDisponibles.findIndex(fd => fd.id === facturaElegida.id);
          if (idx > -1) facturasDisponibles.splice(idx, 1);

          conciliados++;
      }
    }

  } catch (err: any) {
    console.error("Error auto-conciliando cobros:", err);
    errores.push("Error cobros: " + err?.message);
  }

  return { conciliados, errores };
}
