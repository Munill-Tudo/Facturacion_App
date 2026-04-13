import { supabase } from '@/lib/supabase';
import { getTrimestreFiscal } from '@/lib/trimestre';

type EntityType = 'movimiento' | 'factura_recibida' | 'factura_emitida' | 'impuesto' | 'nomina' | 'soporte';
type DocumentoTipo = 'factura_recibida' | 'factura_emitida' | 'impuesto' | 'nomina' | 'justificante_otro' | 'comision_bancaria';

type EnsureIncidenciaInput = {
  entidadTipo: EntityType;
  entidadId: number | string;
  movimientoId?: number | string | null;
  tipo: string;
  prioridad?: string;
  motivo: string;
  trimestreFiscal?: string | null;
  sugerencia?: Record<string, any> | null;
  responsable?: string | null;
};

type ResolveIncidenciasInput = {
  entidadTipo: EntityType;
  entidadId: number | string;
  tipos?: string[];
  resolucionTipo?: string | null;
  resolucionNota?: string | null;
};

type ConciliacionLinkInput = {
  movimientoId: number | string;
  documentoTipo: DocumentoTipo;
  documentoId: number | string;
  relacionTipo?: string;
  importeAplicado: number;
  confianzaAuto?: number | null;
  origen?: string;
  observacion?: string | null;
  createdBy?: string | null;
};

function isSchemaNotReady(error: any) {
  const msg = String(error?.message || '').toLowerCase();
  return error?.code === '42P01' || msg.includes('does not exist') || msg.includes('relation') || msg.includes('column');
}

function toPositiveAmount(value: number | string | null | undefined) {
  return Math.abs(Number(value || 0));
}

export async function ensureIncidencia(input: EnsureIncidenciaInput) {
  try {
    const { data: existing, error: findError } = await supabase
      .from('incidencias')
      .select('id')
      .eq('entidad_tipo', input.entidadTipo)
      .eq('entidad_id', Number(input.entidadId))
      .eq('tipo', input.tipo)
      .in('estado', ['abierta', 'en_revision'])
      .limit(1);

    if (findError) throw findError;

    const payload = {
      movimiento_id: input.movimientoId != null ? Number(input.movimientoId) : null,
      prioridad: input.prioridad || 'media',
      motivo: input.motivo,
      trimestre_fiscal: input.trimestreFiscal || null,
      sugerencia: input.sugerencia || null,
      responsable: input.responsable || null,
      estado: 'abierta',
    };

    if (existing && existing.length > 0) {
      await supabase.from('incidencias').update(payload).eq('id', existing[0].id);
      return existing[0].id;
    }

    const { data: created, error: insertError } = await supabase
      .from('incidencias')
      .insert([{
        entidad_tipo: input.entidadTipo,
        entidad_id: Number(input.entidadId),
        tipo: input.tipo,
        ...payload,
      }])
      .select('id')
      .single();

    if (insertError) throw insertError;
    return created?.id;
  } catch (error: any) {
    if (isSchemaNotReady(error)) return null;
    console.error('[Operativa] ensureIncidencia', error);
    return null;
  }
}

export async function resolveIncidencias(input: ResolveIncidenciasInput) {
  try {
    let query = supabase
      .from('incidencias')
      .update({
        estado: 'resuelta',
        fecha_resuelta: new Date().toISOString(),
        resolucion_tipo: input.resolucionTipo || 'manual',
        resolucion_nota: input.resolucionNota || null,
      })
      .eq('entidad_tipo', input.entidadTipo)
      .eq('entidad_id', Number(input.entidadId))
      .in('estado', ['abierta', 'en_revision']);

    if (input.tipos && input.tipos.length > 0) {
      query = query.in('tipo', input.tipos);
    }

    const { error } = await query;
    if (error) throw error;
  } catch (error: any) {
    if (isSchemaNotReady(error)) return;
    console.error('[Operativa] resolveIncidencias', error);
  }
}

export async function createConciliacionLink(input: ConciliacionLinkInput) {
  try {
    const movementId = Number(input.movimientoId);
    const docId = Number(input.documentoId);
    const amount = Number(input.importeAplicado || 0);

    const { data: existing, error: findError } = await supabase
      .from('conciliacion_links')
      .select('id')
      .eq('movimiento_id', movementId)
      .eq('documento_tipo', input.documentoTipo)
      .eq('documento_id', docId)
      .eq('relacion_tipo', input.relacionTipo || 'total')
      .eq('importe_aplicado', amount)
      .limit(1);

    if (findError) throw findError;
    if (existing && existing.length > 0) return existing[0].id;

    const { data, error } = await supabase
      .from('conciliacion_links')
      .insert([{
        movimiento_id: movementId,
        documento_tipo: input.documentoTipo,
        documento_id: docId,
        relacion_tipo: input.relacionTipo || 'total',
        importe_aplicado: amount,
        confianza_auto: input.confianzaAuto ?? null,
        origen: input.origen || 'manual',
        observacion: input.observacion || null,
        created_by: input.createdBy || null,
      }])
      .select('id')
      .single();

    if (error) throw error;
    return data?.id;
  } catch (error: any) {
    if (isSchemaNotReady(error)) return null;
    console.error('[Operativa] createConciliacionLink', error);
    return null;
  }
}

export async function syncIncidenciasBasicas() {
  try {
    const { data: movimientos, error: movimientosError } = await supabase
      .from('movimientos')
      .select('id, tipo, fecha, importe, concepto, beneficiario, trimestre_fiscal, estado_conciliacion, fecha_dudosa, cliente_expediente, factura_id');

    if (movimientosError) throw movimientosError;

    const linkedFacturaIds = new Set<number>();
    const linkedEmitidaIds = new Set<number>();

    const { data: links, error: linksError } = await supabase
      .from('conciliacion_links')
      .select('documento_tipo, documento_id');

    if (linksError && !isSchemaNotReady(linksError)) throw linksError;

    for (const link of links || []) {
      if (link.documento_tipo === 'factura_recibida') linkedFacturaIds.add(Number(link.documento_id));
      if (link.documento_tipo === 'factura_emitida') linkedEmitidaIds.add(Number(link.documento_id));
    }

    for (const mov of movimientos || []) {
      const tri = mov.trimestre_fiscal || (mov.fecha ? getTrimestreFiscal(mov.fecha) : null);
      const label = [mov.concepto, mov.beneficiario].filter(Boolean).join(' · ') || 'Movimiento bancario';

      if (mov.estado_conciliacion === 'Pendiente') {
        const tipoInc = mov.tipo === 'Cobro' ? 'cobro_sin_asignar' : 'movimiento_sin_soporte';
        const prioridad = mov.tipo === 'Cobro' ? 'media' : 'alta';
        await ensureIncidencia({
          entidadTipo: 'movimiento',
          entidadId: mov.id,
          movimientoId: mov.id,
          tipo: tipoInc,
          prioridad,
          trimestreFiscal: tri,
          motivo: `${label} sigue pendiente de conciliación o soporte.`,
          sugerencia: { ruta: '/conciliacion', accion: 'resolver' },
        });
      } else {
        await resolveIncidencias({
          entidadTipo: 'movimiento',
          entidadId: mov.id,
          tipos: ['movimiento_sin_soporte', 'cobro_sin_asignar', 'importe_no_cuadra', 'clasificacion_dudosa'],
          resolucionTipo: 'conciliado',
        });
      }

      if (mov.fecha_dudosa) {
        await ensureIncidencia({
          entidadTipo: 'movimiento',
          entidadId: mov.id,
          movimientoId: mov.id,
          tipo: 'fecha_dudosa',
          prioridad: 'alta',
          trimestreFiscal: tri,
          motivo: `${label} tiene la fecha marcada como dudosa.`,
          sugerencia: { ruta: '/movimientos', accion: 'corregir_fecha' },
        });
      } else {
        await resolveIncidencias({
          entidadTipo: 'movimiento',
          entidadId: mov.id,
          tipos: ['fecha_dudosa'],
          resolucionTipo: 'fecha_validada',
        });
      }
    }

    const { data: facturas, error: facturasError } = await supabase
      .from('facturas')
      .select('id, fecha, importe, estado, nombre_proveedor, cliente, fecha_dudosa');

    if (facturasError) throw facturasError;

    for (const factura of facturas || []) {
      const tri = factura.fecha ? getTrimestreFiscal(factura.fecha) : null;
      const label = factura.nombre_proveedor || factura.cliente || `Factura ${factura.id}`;
      const linkedByLegacy = (movimientos || []).some(m => Number(m.factura_id) === Number(factura.id));
      const isLinked = linkedByLegacy || linkedFacturaIds.has(Number(factura.id));

      if (factura.estado === 'Pendiente' && !isLinked) {
        await ensureIncidencia({
          entidadTipo: 'factura_recibida',
          entidadId: factura.id,
          tipo: 'factura_sin_movimiento',
          prioridad: 'alta',
          trimestreFiscal: tri,
          motivo: `${label} sigue pendiente y no tiene movimiento conciliado.`,
          sugerencia: { ruta: '/facturas', accion: 'asociar_movimiento' },
        });
      } else {
        await resolveIncidencias({
          entidadTipo: 'factura_recibida',
          entidadId: factura.id,
          tipos: ['factura_sin_movimiento'],
          resolucionTipo: 'asociada',
        });
      }

      if (factura.fecha_dudosa) {
        await ensureIncidencia({
          entidadTipo: 'factura_recibida',
          entidadId: factura.id,
          tipo: 'fecha_dudosa',
          prioridad: 'alta',
          trimestreFiscal: tri,
          motivo: `${label} tiene la fecha marcada como dudosa.`,
          sugerencia: { ruta: '/facturas', accion: 'corregir_fecha' },
        });
      } else {
        await resolveIncidencias({
          entidadTipo: 'factura_recibida',
          entidadId: factura.id,
          tipos: ['fecha_dudosa'],
          resolucionTipo: 'fecha_validada',
        });
      }
    }

    const { data: emitidas, error: emitidasError } = await supabase
      .from('facturas_emitidas')
      .select('id, fecha, importe, estado, cliente');

    if (emitidasError) throw emitidasError;

    for (const factura of emitidas || []) {
      const tri = factura.fecha ? getTrimestreFiscal(factura.fecha) : null;
      const label = factura.cliente || `Factura emitida ${factura.id}`;
      const isLinked = linkedEmitidaIds.has(Number(factura.id));

      if (factura.estado === 'Pendiente' && !isLinked) {
        await ensureIncidencia({
          entidadTipo: 'factura_emitida',
          entidadId: factura.id,
          tipo: 'factura_emitida_sin_cobro',
          prioridad: 'media',
          trimestreFiscal: tri,
          motivo: `${label} sigue pendiente de cobro o asignación.`,
          sugerencia: { ruta: '/emitidas', accion: 'revisar_cobro' },
        });
      } else {
        await resolveIncidencias({
          entidadTipo: 'factura_emitida',
          entidadId: factura.id,
          tipos: ['factura_emitida_sin_cobro'],
          resolucionTipo: 'cobrada',
        });
      }
    }

    const { data: impuestos, error: impuestosError } = await supabase
      .from('impuestos')
      .select('id, concepto, tipo, periodo, trimestre_fiscal, estado_documental, archivo_url');

    if (impuestosError) throw impuestosError;

    for (const impuesto of impuestos || []) {
      const pendienteDoc = impuesto.estado_documental === 'pendiente_documento' || !impuesto.archivo_url;
      const label = impuesto.concepto || impuesto.tipo || `Impuesto ${impuesto.id}`;

      if (pendienteDoc) {
        await ensureIncidencia({
          entidadTipo: 'impuesto',
          entidadId: impuesto.id,
          tipo: 'impuesto_sin_documento',
          prioridad: 'alta',
          trimestreFiscal: impuesto.trimestre_fiscal,
          motivo: `${label} sigue sin soporte documental validado.`,
          sugerencia: { ruta: '/impuestos', accion: 'subir_documento' },
        });
      } else {
        await resolveIncidencias({
          entidadTipo: 'impuesto',
          entidadId: impuesto.id,
          tipos: ['impuesto_sin_documento'],
          resolucionTipo: 'documentado',
        });
      }
    }

    const { data: nominas, error: nominasError } = await supabase
      .from('nominas')
      .select('id, empleado, periodo, trimestre_fiscal, estado_documental, archivo_url');

    if (nominasError) throw nominasError;

    for (const nomina of nominas || []) {
      const pendienteDoc = nomina.estado_documental === 'pendiente_documento' || !nomina.archivo_url;
      const label = nomina.empleado || `Nómina ${nomina.id}`;

      if (pendienteDoc) {
        await ensureIncidencia({
          entidadTipo: 'nomina',
          entidadId: nomina.id,
          tipo: 'nomina_sin_documento',
          prioridad: 'alta',
          trimestreFiscal: nomina.trimestre_fiscal,
          motivo: `${label} sigue sin soporte documental validado.`,
          sugerencia: { ruta: '/nominas', accion: 'subir_documento' },
        });
      } else {
        await resolveIncidencias({
          entidadTipo: 'nomina',
          entidadId: nomina.id,
          tipos: ['nomina_sin_documento'],
          resolucionTipo: 'documentada',
        });
      }
    }
  } catch (error: any) {
    if (isSchemaNotReady(error)) return;
    console.error('[Operativa] syncIncidenciasBasicas', error);
  }
}

export function guessRelacionTipo(totalDocumento: number, importeAplicado: number) {
  return toPositiveAmount(importeAplicado) + 0.05 < toPositiveAmount(totalDocumento) ? 'parcial' : 'total';
}

export function scorePasoConciliacion(paso: string) {
  if (!paso) return null;
  if (paso.includes('RF')) return 95;
  if (paso.includes('Nombre Exacto')) return 88;
  if (paso.includes('Único Importe')) return 82;
  if (paso.includes('FIFO')) return 70;
  return 60;
}
