export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Clock3, Inbox, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function priorityRank(value?: string | null) {
  if (value === 'critica') return 0;
  if (value === 'alta') return 1;
  if (value === 'media') return 2;
  return 3;
}

function priorityLabel(value?: string | null) {
  if (value === 'critica') return 'Crítica';
  if (value === 'alta') return 'Alta';
  if (value === 'media') return 'Media';
  return 'Baja';
}

function actionHref(item: any) {
  if (item.entidad_tipo === 'movimiento') return item.tipo === 'fecha_dudosa' ? '/movimientos' : '/conciliacion';
  if (item.entidad_tipo === 'factura_recibida') return '/facturas';
  if (item.entidad_tipo === 'factura_emitida') return '/emitidas';
  if (item.entidad_tipo === 'impuesto') return '/impuestos';
  if (item.entidad_tipo === 'nomina') return '/nominas';
  return '/';
}

export default async function BandejaPage() {
  const { data, error } = await supabase
    .from('incidencias')
    .select('*')
    .in('estado', ['abierta', 'en_revision'])
    .order('fecha_detectada', { ascending: true });

  if (error) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-amber-600 dark:text-amber-300" />
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">Bandeja operativa</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                Ejecuta primero la migración SQL de la fase operativa v1. La tabla incidencias todavía no está lista.
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">Error: {error.message}</p>
        </div>
      </div>
    );
  }

  const incidencias = (data || []).sort((a: any, b: any) => {
    const diffPriority = priorityRank(a.prioridad) - priorityRank(b.prioridad);
    if (diffPriority !== 0) return diffPriority;
    return new Date(a.fecha_detectada).getTime() - new Date(b.fecha_detectada).getTime();
  });

  const criticas = incidencias.filter((i: any) => i.prioridad === 'critica').length;
  const altas = incidencias.filter((i: any) => i.prioridad === 'alta').length;
  const abiertas = incidencias.length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-[#0a0a0a]">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            <Inbox className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">Bandeja operativa</h1>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Trabajo pendiente real. Aquí tienen que vivir las excepciones del día a día.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm dark:border-red-500/20 dark:bg-red-500/10">
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Críticas</p>
          <p className="mt-2 text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">{criticas}</p>
        </div>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10">
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Alta prioridad</p>
          <p className="mt-2 text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">{altas}</p>
        </div>
        <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#0a0a0a]">
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Abiertas</p>
          <p className="mt-2 text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">{abiertas}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-[#0a0a0a]">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Incidencias abiertas</h2>
        <div className="mt-5 space-y-3">
          {incidencias.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              No hay incidencias abiertas.
            </div>
          ) : incidencias.map((item: any) => (
            <div key={item.id} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#0a0a0a]">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-gray-700 dark:bg-white/10 dark:text-gray-300">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {String(item.tipo || '').replaceAll('_', ' ')}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-400">
                      {priorityLabel(item.prioridad)}
                    </span>
                    {item.trimestre_fiscal && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-400">
                        {item.trimestre_fiscal}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-base font-semibold text-gray-900 dark:text-white">{item.motivo}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      Detectada: {new Date(item.fecha_detectada).toLocaleString('es-ES')}
                    </span>
                    <span>Entidad: {item.entidad_tipo} #{item.entidad_id}</span>
                  </div>
                </div>
                <Link href={actionHref(item)} className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10">
                  Resolver
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
