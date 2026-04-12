export const dynamic = 'force-dynamic';

import { CheckCircle2, AlertTriangle, FileWarning, PiggyBank, FolderKanban } from 'lucide-react';
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

export default async function CierrePage() {
  const now = new Date();
  const year = now.getFullYear();
  const quarter = getCurrentQuarter(now);
  const range = getQuarterRange(year, quarter);

  const [
    movimientosRes,
    pendientesRes,
    facturasSinArchivoRes,
    emitidasPendientesRes,
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
  ]);

  const movimientosTotales = movimientosRes.count || 0;
  const movimientosPendientes = pendientesRes.count || 0;
  const movimientosListos = Math.max(movimientosTotales - movimientosPendientes, 0);
  const facturasSinArchivo = facturasSinArchivoRes.count || 0;
  const emitidasPendientes = emitidasPendientesRes.count || 0;

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
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-3 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-[#0a0a0a]">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <FolderKanban className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">Cierre trimestral</h1>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Vista operativa del trimestre {range.label}. El objetivo es dejar cada movimiento bancario apoyado por su factura o justificante.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
          subtitle="Documentación todavía incompleta"
          tone={facturasSinArchivo > 0 ? 'warn' : 'good'}
          icon={<FileWarning className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-[#0a0a0a]">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Qué bloquea hoy el cierre</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Esta pantalla irá ganando precisión con la nueva capa de soportes, pero ya sirve como cabina rápida del trimestre.
          </p>

          <div className="mt-5 space-y-3">
            {bloqueos.length === 0 ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                No se detectan bloqueos básicos para el trimestre actual.
              </div>
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
            <p>4. Revisar cobros emitidos y remesas TPV para cerrar la trazabilidad completa.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
