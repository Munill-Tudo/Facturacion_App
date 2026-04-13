export const dynamic = 'force-dynamic';

import Link from 'next/link';
import {
  CheckCircle2,
  AlertTriangle,
  FileWarning,
  PiggyBank,
  FolderKanban,
  ArrowRight,
  Clock3,
  CalendarRange,
  Landmark,
  Users,
  Download,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

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

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(`${d}T00:00:00`).toLocaleDateString('es-ES');
}

function fmtMoney(v?: number | string | null) {
  if (v == null) return '—';
  return Number(v).toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  });
}

function parseYear(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 2020 || parsed > 2100) return fallback;
  return parsed;
}

function parseQuarter(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4) return fallback;
  return parsed;
}

function MetricCard({
  title,
  value,
  subtitle,
  tone = 'neutral',
  icon,
}: {
  title: string;
  value: number;
  subtitle: string;
  tone?: 'neutral' | 'good' | 'warn';
  icon: React.ReactNode;
}) {
  const toneClass =
    tone === 'good'
      ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/10'
        : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-[#0a0a0a]';

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${toneClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{title}</p>
          <p className="mt-2 text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">{value}</p>
          <p className="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
        <div className="rounded-2xl bg-white/80 p-3 text-gray-700 shadow-sm dark:bg-white/10 dark:text-gray-200">
          {icon}
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  href,
  hrefLabel,
  children,
}: {
  title: string;
  subtitle: string;
  href: string;
  hrefLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-[#0a0a0a]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
        >
          {hrefLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
      {text}
    </div>
  );
}

function BlockTypeCard({
  title,
  value,
  href,
  hrefLabel,
  tone = 'neutral',
}: {
  title: string;
  value: number;
  href: string;
  hrefLabel: string;
  tone?: 'neutral' | 'good' | 'warn';
}) {
  const toneClass =
    tone === 'good'
      ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/10'
        : 'border-gray-100 bg-white dark:border-gray-800 dark:bg-[#0a0a0a]';

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${toneClass}`}>
      <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{title}</p>
      <p className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">{value}</p>
      <div className="mt-4">
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
        >
          {hrefLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

export default async function CierrePage({
  searchParams,
}: {
  searchParams?: Promise<{ year?: string; quarter?: string }>;
}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = getCurrentQuarter(now);
  const params = (await searchParams) || {};
  const year = parseYear(params.year, currentYear);
  const quarter = parseQuarter(params.quarter, currentQuarter);
  const range = getQuarterRange(year, quarter);
  const availableYears = Array.from({ length: 5 }, (_, idx) => currentYear - 2 + idx);

  const [
    movimientosRes,
    pendientesRes,
    facturasSinArchivoRes,
    emitidasPendientesRes,
    impuestosSinDocumentoRes,
    nominasSinDocumentoRes,
    movimientosPendientesListRes,
    facturasSinArchivoListRes,
    emitidasPendientesListRes,
    impuestosSinDocumentoListRes,
    nominasSinDocumentoListRes,
  ] = await Promise.all([
    supabase
      .from('movimientos')
      .select('*', { count: 'exact', head: true })
      .gte('fecha', range.from)
      .lte('fecha', range.to),
    supabase
      .from('movimientos')
      .select('*', { count: 'exact', head: true })
      .eq('estado_conciliacion', 'Pendiente')
      .gte('fecha', range.from)
      .lte('fecha', range.to),
    supabase
      .from('facturas')
      .select('*', { count: 'exact', head: true })
      .is('archivo_url', null)
      .gte('fecha', range.from)
      .lte('fecha', range.to),
    supabase
      .from('facturas_emitidas')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'Pendiente')
      .gte('fecha', range.from)
      .lte('fecha', range.to),
    supabase
      .from('impuestos')
      .select('*', { count: 'exact', head: true })
      .eq('trimestre_fiscal', range.label)
      .or('archivo_url.is.null,estado_documental.eq.pendiente_documento'),
    supabase
      .from('nominas')
      .select('*', { count: 'exact', head: true })
      .eq('trimestre_fiscal', range.label)
      .or('archivo_url.is.null,estado_documental.eq.pendiente_documento'),
    supabase
      .from('movimientos')
      .select('id, fecha, concepto, beneficiario, importe, tipo, estado_conciliacion')
      .eq('estado_conciliacion', 'Pendiente')
      .gte('fecha', range.from)
      .lte('fecha', range.to)
      .order('fecha', { ascending: false })
      .limit(6),
    supabase
      .from('facturas')
      .select('id, fecha, numero, cliente, nombre_proveedor, importe, archivo_url')
      .is('archivo_url', null)
      .gte('fecha', range.from)
      .lte('fecha', range.to)
      .order('fecha', { ascending: false })
      .limit(6),
    supabase
      .from('facturas_emitidas')
      .select('id, fecha, numero, cliente, importe, estado')
      .eq('estado', 'Pendiente')
      .gte('fecha', range.from)
      .lte('fecha', range.to)
      .order('fecha', { ascending: false })
      .limit(6),
    supabase
      .from('impuestos')
      .select('id, concepto, tipo, periodo, importe, fecha_pago, archivo_url, estado_documental')
      .eq('trimestre_fiscal', range.label)
      .or('archivo_url.is.null,estado_documental.eq.pendiente_documento')
      .order('fecha_pago', { ascending: false })
      .limit(6),
    supabase
      .from('nominas')
      .select('id, empleado, periodo, importe, fecha_pago, archivo_url, estado_documental')
      .eq('trimestre_fiscal', range.label)
      .or('archivo_url.is.null,estado_documental.eq.pendiente_documento')
      .order('fecha_pago', { ascending: false })
      .limit(6),
  ]);

  const movimientosTotales = movimientosRes.count || 0;
  const movimientosPendientes = pendientesRes.count || 0;
  const movimientosListos = Math.max(movimientosTotales - movimientosPendientes, 0);
  const facturasSinArchivo = facturasSinArchivoRes.count || 0;
  const emitidasPendientes = emitidasPendientesRes.count || 0;
  const impuestosSinDocumento = impuestosSinDocumentoRes.count || 0;
  const nominasSinDocumento = nominasSinDocumentoRes.count || 0;
  const documentosPendientes = facturasSinArchivo + impuestosSinDocumento + nominasSinDocumento;
  const cierreListo = movimientosPendientes === 0 && documentosPendientes === 0 && emitidasPendientes === 0;
  const completionPct = movimientosTotales > 0
    ? Math.max(0, Math.min(100, Math.round((movimientosListos / movimientosTotales) * 100)))
    : 100;

  const movimientosPendientesList = movimientosPendientesListRes.data || [];
  const facturasSinArchivoList = facturasSinArchivoListRes.data || [];
  const emitidasPendientesList = emitidasPendientesListRes.data || [];
  const impuestosSinDocumentoList = impuestosSinDocumentoListRes.data || [];
  const nominasSinDocumentoList = nominasSinDocumentoListRes.data || [];

  const bloqueos = [
    movimientosPendientes > 0
      ? `${movimientosPendientes} movimiento(s) bancario(s) siguen sin conciliación completa.`
      : null,
    facturasSinArchivo > 0
      ? `${facturasSinArchivo} factura(s) recibida(s) siguen sin archivo documental enlazado.`
      : null,
    emitidasPendientes > 0
      ? `${emitidasPendientes} factura(s) emitida(s) siguen pendientes de cobro o revisión.`
      : null,
    impuestosSinDocumento > 0
      ? `${impuestosSinDocumento} impuesto(s) siguen sin soporte documental completo.`
      : null,
    nominasSinDocumento > 0
      ? `${nominasSinDocumento} nómina(s) siguen sin soporte documental completo.`
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-[#0a0a0a]">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <FolderKanban className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">Cierre trimestral</h1>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Vista operativa del trimestre {range.label}. El objetivo es dejar cada movimiento bancario apoyado por su factura o justificante.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/cierre/export?year=${year}&quarter=${quarter}`}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
            >
              <Download className="h-4 w-4" />
              Exportar Excel
            </a>
            <a
              href={`/api/cierre/zip?year=${year}&quarter=${quarter}`}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-colors hover:bg-indigo-700"
            >
              <Download className="h-4 w-4" />
              ZIP documental
            </a>
          </div>
        </div>

        <form method="GET" className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-white/5 md:flex-row md:items-end">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <CalendarRange className="h-4 w-4 text-indigo-500" />
            Seleccionar trimestre
          </div>
          <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-4">
            <label className="text-sm md:col-span-1">
              <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Año</span>
              <select
                name="year"
                defaultValue={String(year)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-[#0a0a0a] dark:text-white"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
            <label className="text-sm md:col-span-1">
              <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Trimestre</span>
              <select
                name="quarter"
                defaultValue={String(quarter)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-[#0a0a0a] dark:text-white"
              >
                <option value="1">1T · Enero a Marzo</option>
                <option value="2">2T · Abril a Junio</option>
                <option value="3">3T · Julio a Septiembre</option>
                <option value="4">4T · Octubre a Diciembre</option>
              </select>
            </label>
            <div className="flex items-end gap-2 md:col-span-2">
              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-colors hover:bg-indigo-700"
              >
                Aplicar
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          title="Movimientos del trimestre"
          value={movimientosTotales}
          subtitle="Base de trabajo del cierre"
          icon={<PiggyBank className="h-5 w-5" />}
        />
        <MetricCard
          title="Listos o conciliados"
          value={movimientosListos}
          subtitle="Movimientos ya tratados"
          tone={movimientosPendientes === 0 ? 'good' : 'neutral'}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <MetricCard
          title="Pendientes de revisar"
          value={movimientosPendientes}
          subtitle="Movimientos todavía no cerrados"
          tone={movimientosPendientes > 0 ? 'warn' : 'good'}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <MetricCard
          title="Facturas sin archivo"
          value={facturasSinArchivo}
          subtitle="Documentación recibida incompleta"
          tone={facturasSinArchivo > 0 ? 'warn' : 'good'}
          icon={<FileWarning className="h-5 w-5" />}
        />
        <MetricCard
          title="Impuestos sin documento"
          value={impuestosSinDocumento}
          subtitle="Fiscal pendiente de soporte"
          tone={impuestosSinDocumento > 0 ? 'warn' : 'good'}
          icon={<Landmark className="h-5 w-5" />}
        />
        <MetricCard
          title="Nóminas sin documento"
          value={nominasSinDocumento}
          subtitle="Laboral pendiente de soporte"
          tone={nominasSinDocumento > 0 ? 'warn' : 'good'}
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <div className={`xl:col-span-2 rounded-3xl border p-6 shadow-sm ${cierreListo ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10' : 'border-amber-200 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/10'}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Estado del trimestre</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                {cierreListo ? 'Listo para revisión final' : 'Bloqueado'}
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {cierreListo
                  ? 'No se detectan bloqueos básicos de conciliación, documentación o cobro para este trimestre.'
                  : 'Aún quedan frentes abiertos antes de poder considerar este trimestre realmente cerrable.'}
              </p>
            </div>
            <div className={`rounded-2xl p-3 ${cierreListo ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'}`}>
              {cierreListo ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400">
              <span>Avance por movimientos tratados</span>
              <span>{completionPct}%</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/70 dark:bg-white/10">
              <div
                className={`h-full rounded-full ${cierreListo ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
        </div>

        <BlockTypeCard
          title="Pendiente conciliación"
          value={movimientosPendientes}
          href="/conciliacion"
          hrefLabel="Resolver movimientos"
          tone={movimientosPendientes > 0 ? 'warn' : 'good'}
        />
        <BlockTypeCard
          title="Pendiente documentación"
          value={documentosPendientes}
          href="/facturas"
          hrefLabel="Revisar soportes"
          tone={documentosPendientes > 0 ? 'warn' : 'good'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-[#0a0a0a]">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Qué bloquea hoy el cierre</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Esta pantalla ya te marca los frentes principales del trimestre y te manda directo a resolverlos.
          </p>

          <div className="mt-5 space-y-3">
            {bloqueos.length === 0 ? (
              <EmptyState text="No se detectan bloqueos básicos para el trimestre seleccionado." />
            ) : (
              bloqueos.map((bloqueo, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
                >
                  {bloqueo}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-[#0a0a0a]">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Foco inmediato</h2>
          <div className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-300">
            <p>1. Importar todos los movimientos del trimestre y eliminar duplicidades reales.</p>
            <p>2. Subir o enlazar todas las facturas recibidas pendientes.</p>
            <p>3. Resolver conciliación bancaria antes de exportar documentación a gestoría.</p>
            <p>4. Completar soporte documental de impuestos y nóminas del trimestre.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SectionCard
          title="Movimientos pendientes"
          subtitle="Los movimientos que todavía te impiden cerrar el trimestre."
          href="/conciliacion"
          hrefLabel="Ir a conciliación"
        >
          {movimientosPendientesList.length === 0 ? (
            <EmptyState text="No hay movimientos pendientes en el trimestre seleccionado." />
          ) : (
            <div className="space-y-3">
              {movimientosPendientesList.map((mov: any) => (
                <div key={mov.id} className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">{mov.concepto || 'Movimiento bancario'}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {fmtDate(mov.fecha)} · {mov.beneficiario || mov.tipo || 'Sin beneficiario'}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-sm font-bold text-orange-600 dark:text-orange-400">
                      {fmtMoney(mov.importe)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Facturas sin archivo"
          subtitle="Registradas, pero todavía sin soporte documental enlazado."
          href="/facturas"
          hrefLabel="Ir a facturas"
        >
          {facturasSinArchivoList.length === 0 ? (
            <EmptyState text="No hay facturas recibidas sin archivo en este trimestre." />
          ) : (
            <div className="space-y-3">
              {facturasSinArchivoList.map((factura: any) => (
                <div key={factura.id} className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">
                        {factura.nombre_proveedor || factura.cliente || 'Proveedor sin nombre'}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {factura.numero || 'Sin número'} · {fmtDate(factura.fecha)}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                      {fmtMoney(factura.importe)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Emitidas pendientes"
          subtitle="Cobros o revisiones todavía abiertas en el trimestre actual."
          href="/emitidas"
          hrefLabel="Ir a emitidas"
        >
          {emitidasPendientesList.length === 0 ? (
            <EmptyState text="No hay facturas emitidas pendientes en este trimestre." />
          ) : (
            <div className="space-y-3">
              {emitidasPendientesList.map((factura: any) => (
                <div key={factura.id} className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">
                        {factura.cliente || 'Cliente sin nombre'}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {factura.numero || 'Sin número'} · {fmtDate(factura.fecha)}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {fmtMoney(factura.importe)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard
          title="Impuestos sin documento"
          subtitle="Registros fiscales del trimestre que todavía no tienen soporte documental completo."
          href="/impuestos"
          hrefLabel="Ir a impuestos"
        >
          {impuestosSinDocumentoList.length === 0 ? (
            <EmptyState text="No hay impuestos pendientes de documento en este trimestre." />
          ) : (
            <div className="space-y-3">
              {impuestosSinDocumentoList.map((imp: any) => (
                <div key={imp.id} className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">{imp.concepto || imp.tipo || 'Impuesto'}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {imp.periodo || 'Sin período'} · {fmtDate(imp.fecha_pago)}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-sm font-bold text-amber-600 dark:text-amber-400">
                      {fmtMoney(imp.importe)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Nóminas sin documento"
          subtitle="Registros laborales del trimestre que todavía no tienen soporte documental completo."
          href="/nominas"
          hrefLabel="Ir a nóminas"
        >
          {nominasSinDocumentoList.length === 0 ? (
            <EmptyState text="No hay nóminas pendientes de documento en este trimestre." />
          ) : (
            <div className="space-y-3">
              {nominasSinDocumentoList.map((nom: any) => (
                <div key={nom.id} className="rounded-2xl border border-gray-100 p-4 dark:border-gray-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">{nom.empleado || 'Empleado sin nombre'}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {nom.periodo || 'Sin período'} · {fmtDate(nom.fecha_pago)}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-sm font-bold text-pink-600 dark:text-pink-400">
                      {fmtMoney(nom.importe)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-[#0a0a0a]">
        <div className="flex items-center gap-2 text-gray-900 dark:text-white">
          <Clock3 className="h-5 w-5 text-indigo-500" />
          <h2 className="text-lg font-bold">Siguiente mejora</h2>
        </div>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          El siguiente salto será convertir estos bloqueos en una bandeja de incidencias real con tipos de soporte, estado documental y validación final de trimestre.
        </p>
      </div>
    </div>
  );
}
