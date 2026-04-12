import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

function parseYear(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 2020 || parsed > 2100) return fallback;
  return parsed;
}

function parseQuarter(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4) return fallback;
  return parsed;
}

function getCurrentQuarter(date = new Date()) {
  return Math.floor(date.getMonth() / 3) + 1;
}

function getQuarterRange(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0));
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    label: `${year}-T${quarter}`,
  };
}

function normalizeRows<T extends Record<string, any>>(rows: T[] | null | undefined) {
  return (rows || []).map((row) => {
    const normalized: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key] = value == null ? '' : value;
    }
    return normalized;
  });
}

export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuarter = getCurrentQuarter(now);

    const year = parseYear(request.nextUrl.searchParams.get('year'), currentYear);
    const quarter = parseQuarter(request.nextUrl.searchParams.get('quarter'), currentQuarter);
    const range = getQuarterRange(year, quarter);

    const [
      movimientosRes,
      pendientesRes,
      facturasSinArchivoRes,
      emitidasPendientesRes,
      impuestosSinDocumentoRes,
      nominasSinDocumentoRes,
    ] = await Promise.all([
      supabase
        .from('movimientos')
        .select('id, fecha, concepto, beneficiario, observaciones, importe, tipo, estado_conciliacion, cliente_expediente, factura_id')
        .gte('fecha', range.from)
        .lte('fecha', range.to)
        .order('fecha', { ascending: true }),
      supabase
        .from('movimientos')
        .select('id, fecha, concepto, beneficiario, observaciones, importe, tipo, estado_conciliacion')
        .eq('estado_conciliacion', 'Pendiente')
        .gte('fecha', range.from)
        .lte('fecha', range.to)
        .order('fecha', { ascending: true }),
      supabase
        .from('facturas')
        .select('id, fecha, numero, cliente, nombre_proveedor, nif_proveedor, concepto, importe, estado, archivo_url')
        .is('archivo_url', null)
        .gte('fecha', range.from)
        .lte('fecha', range.to)
        .order('fecha', { ascending: true }),
      supabase
        .from('facturas_emitidas')
        .select('id, fecha, numero, cliente, nif_cliente, concepto, importe, estado, archivo_url')
        .eq('estado', 'Pendiente')
        .gte('fecha', range.from)
        .lte('fecha', range.to)
        .order('fecha', { ascending: true }),
      supabase
        .from('impuestos')
        .select('id, concepto, tipo, periodo, importe, fecha_devengo, fecha_pago, estado, estado_documental, archivo_url, notas')
        .eq('trimestre_fiscal', range.label)
        .or('archivo_url.is.null,estado_documental.eq.pendiente_documento')
        .order('fecha_pago', { ascending: true }),
      supabase
        .from('nominas')
        .select('id, empleado, periodo, importe, fecha_pago, estado, estado_documental, archivo_url')
        .eq('trimestre_fiscal', range.label)
        .or('archivo_url.is.null,estado_documental.eq.pendiente_documento')
        .order('fecha_pago', { ascending: true }),
    ]);

    const movimientos = movimientosRes.data || [];
    const movimientosPendientes = pendientesRes.data || [];
    const facturasSinArchivo = facturasSinArchivoRes.data || [];
    const emitidasPendientes = emitidasPendientesRes.data || [];
    const impuestosSinDocumento = impuestosSinDocumentoRes.data || [];
    const nominasSinDocumento = nominasSinDocumentoRes.data || [];

    const movimientosTotales = movimientos.length;
    const movimientosListos = Math.max(movimientosTotales - movimientosPendientes.length, 0);
    const documentosPendientes = facturasSinArchivo.length + impuestosSinDocumento.length + nominasSinDocumento.length;
    const cierreListo = movimientosPendientes.length === 0 && documentosPendientes === 0 && emitidasPendientes.length === 0;
    const completionPct = movimientosTotales > 0
      ? Math.max(0, Math.min(100, Math.round((movimientosListos / movimientosTotales) * 100)))
      : 100;

    const resumenRows = [
      { metrica: 'Trimestre', valor: range.label },
      { metrica: 'Fecha inicio', valor: range.from },
      { metrica: 'Fecha fin', valor: range.to },
      { metrica: 'Estado del trimestre', valor: cierreListo ? 'Listo para revisión final' : 'Bloqueado' },
      { metrica: 'Avance por movimientos (%)', valor: completionPct },
      { metrica: 'Movimientos del trimestre', valor: movimientosTotales },
      { metrica: 'Movimientos listos o conciliados', valor: movimientosListos },
      { metrica: 'Movimientos pendientes', valor: movimientosPendientes.length },
      { metrica: 'Facturas recibidas sin archivo', valor: facturasSinArchivo.length },
      { metrica: 'Facturas emitidas pendientes', valor: emitidasPendientes.length },
      { metrica: 'Impuestos sin documento', valor: impuestosSinDocumento.length },
      { metrica: 'Nóminas sin documento', valor: nominasSinDocumento.length },
      { metrica: 'Documentación pendiente total', valor: documentosPendientes },
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(resumenRows),
      'Resumen'
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(normalizeRows(movimientos)),
      'Movimientos'
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(normalizeRows(movimientosPendientes)),
      'Pendientes_Conciliacion'
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(normalizeRows(facturasSinArchivo)),
      'Facturas_Sin_Archivo'
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(normalizeRows(emitidasPendientes)),
      'Emitidas_Pendientes'
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(normalizeRows(impuestosSinDocumento)),
      'Impuestos_Sin_Doc'
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(normalizeRows(nominasSinDocumento)),
      'Nominas_Sin_Doc'
    );

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const fileName = `cierre-trimestral-${range.label}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('Error exportando cierre trimestral:', error);
    return NextResponse.json(
      { error: 'No se pudo generar la exportación del cierre trimestral', details: error?.message || 'Error desconocido' },
      { status: 500 }
    );
  }
}
