'use client';

import { useState, useMemo } from 'react';
import { TipoGasto } from '@/lib/tipos-gasto';
import { ChevronDown } from 'lucide-react';

const fmt = (v: number) => `€ ${v.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;

type Factura = {
  id: number;
  fecha?: string;
  importe?: number;
  total_base?: number;
  total_iva?: number;
  tipo_gasto?: string;
  subtipo_gasto?: string;
  nombre_proveedor?: string;
  estado?: string;
};

type PeriodoMode = 'libre' | 'mes' | 'trimestre' | 'año';

export function GastosAnalisisClient({ facturas, tipos }: { facturas: Factura[]; tipos: TipoGasto[] }) {
  const now = new Date();
  const [periodo, setPeriodo] = useState<PeriodoMode>('año');
  const [selYear, setSelYear] = useState(now.getFullYear().toString());
  const [selMonth, setSelMonth] = useState((now.getMonth() + 1).toString());
  const [selQ, setSelQ] = useState(Math.ceil((now.getMonth() + 1) / 3).toString());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterTipo, setFilterTipo] = useState('');

  const años = useMemo(() => {
    const ys = new Set(facturas.map(f => f.fecha ? new Date(f.fecha).getFullYear().toString() : '').filter(Boolean));
    return Array.from(ys).sort().reverse();
  }, [facturas]);

  const filtered = useMemo(() => {
    return facturas.filter(f => {
      if (!f.fecha) return false;
      const d = new Date(f.fecha);
      const y = d.getFullYear().toString();
      const m = (d.getMonth() + 1);
      const q = Math.ceil(m / 3);

      if (periodo === 'año') return y === selYear;
      if (periodo === 'mes') return y === selYear && m.toString() === selMonth;
      if (periodo === 'trimestre') return y === selYear && q.toString() === selQ;
      // libre
      const from = dateFrom ? new Date(dateFrom) : null;
      const to = dateTo ? new Date(dateTo + 'T23:59:59') : null;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    }).filter(f => !filterTipo || f.tipo_gasto === filterTipo);
  }, [facturas, periodo, selYear, selMonth, selQ, dateFrom, dateTo, filterTipo]);

  // Group by tipo_gasto
  const byTipo = useMemo(() => {
    const map: Record<string, { total: number; facts: Factura[] }> = {};
    for (const f of filtered) {
      const key = f.tipo_gasto || '__sin_tipo__';
      if (!map[key]) map[key] = { total: 0, facts: [] };
      map[key].total += Number(f.importe) || 0;
      map[key].facts.push(f);
    }
    return map;
  }, [filtered]);

  // Calculate period label for average
  const meses = useMemo(() => {
    if (filtered.length === 0) return 1;
    const ds = filtered.map(f => new Date(f.fecha!).getTime());
    const min = new Date(Math.min(...ds));
    const max = new Date(Math.max(...ds));
    const months = (max.getFullYear() - min.getFullYear()) * 12 + (max.getMonth() - min.getMonth()) + 1;
    return Math.max(1, months);
  }, [filtered]);

  const totalPeriodo = filtered.reduce((s, f) => s + (Number(f.importe) || 0), 0);
  const sinTipo = filtered.filter(f => !f.tipo_gasto).length;

  const tiposOrdenados = [...tipos].sort((a, b) => {
    const ta = byTipo[a.valor]?.total ?? 0;
    const tb = byTipo[b.valor]?.total ?? 0;
    return tb - ta;
  });

  const mesesLabels = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-500 font-medium">Período:</span>
          {(['libre','mes','trimestre','año'] as PeriodoMode[]).map(m => (
            <button key={m} onClick={() => setPeriodo(m)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${periodo === m ? 'bg-violet-600 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/20'}`}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          {(periodo === 'año' || periodo === 'mes' || periodo === 'trimestre') && (
            <div className="relative">
              <select value={selYear} onChange={e => setSelYear(e.target.value)} className="pl-3 pr-8 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black outline-none appearance-none">
                {años.map(y => <option key={y} value={y}>{y}</option>)}
                {!años.includes(now.getFullYear().toString()) && <option value={now.getFullYear().toString()}>{now.getFullYear()}</option>}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          )}
          {periodo === 'mes' && (
            <div className="relative">
              <select value={selMonth} onChange={e => setSelMonth(e.target.value)} className="pl-3 pr-8 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black outline-none appearance-none">
                {mesesLabels.map((m, i) => <option key={i+1} value={(i+1).toString()}>{m}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          )}
          {periodo === 'trimestre' && (
            <div className="relative">
              <select value={selQ} onChange={e => setSelQ(e.target.value)} className="pl-3 pr-8 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black outline-none appearance-none">
                <option value="1">1T (Ene-Mar)</option>
                <option value="2">2T (Abr-Jun)</option>
                <option value="3">3T (Jul-Sep)</option>
                <option value="4">4T (Oct-Dic)</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          )}
          {periodo === 'libre' && (
            <>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black outline-none" />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black outline-none" />
            </>
          )}
          {/* Filter by tipo */}
          <div className="relative ml-auto">
            <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className="pl-3 pr-8 py-1.5 text-sm border border-violet-200 dark:border-violet-500/30 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-700 outline-none appearance-none cursor-pointer">
              <option value="">Todos los tipos</option>
              {tipos.map(t => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-violet-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20">
          <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 mb-1">Total Período</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white">{fmt(totalPeriodo)}</p>
        </div>
        <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">Media Mensual</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white">{fmt(totalPeriodo / meses)}</p>
        </div>
        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800">
          <p className="text-xs font-semibold text-gray-500 mb-1">Nº Facturas</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white">{filtered.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20">
          <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-1">Sin Clasificar</p>
          <p className="text-2xl font-black text-gray-900 dark:text-white">{sinTipo}</p>
        </div>
      </div>

      {/* By tipo breakdown */}
      <div className="space-y-3">
        {tiposOrdenados.map(tipo => {
          const data = byTipo[tipo.valor];
          if (!data) return null;
          const pct = totalPeriodo > 0 ? (data.total / totalPeriodo) * 100 : 0;
          const mediaMensual = data.total / meses;

          // Subtipos breakdown
          const bySubtipo: Record<string, number> = {};
          for (const f of data.facts) {
            const sk = f.subtipo_gasto || '__sin_subtipo__';
            bySubtipo[sk] = (bySubtipo[sk] || 0) + (Number(f.importe) || 0);
          }

          return (
            <div key={tipo.valor} className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-bold text-gray-900 dark:text-white">{tipo.etiqueta}</span>
                  <span className="ml-2 text-xs text-gray-400">{data.facts.length} factura{data.facts.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="text-right">
                  <p className="font-black text-gray-900 dark:text-white">{fmt(data.total)}</p>
                  <p className="text-xs text-gray-500">media: {fmt(mediaMensual)}/mes · {pct.toFixed(1)}%</p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              {/* Subtypes */}
              {Object.entries(bySubtipo).length > 1 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                  {Object.entries(bySubtipo).sort((a, b) => b[1] - a[1]).map(([sk, stotal]) => {
                    const subtipo = tipo.subtipos.find(s => s.valor === sk);
                    return (
                      <div key={sk} className="flex justify-between items-center px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-white/5 text-xs">
                        <span className="text-gray-600 dark:text-gray-400">{subtipo?.etiqueta || 'Sin subtipo'}</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{fmt(stotal)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Sin tipo */}
        {byTipo['__sin_tipo__'] && (
          <div className="bg-gray-50 dark:bg-white/3 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 p-5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-500">Sin clasificar</span>
              <p className="font-black text-gray-700 dark:text-gray-300">{fmt(byTipo['__sin_tipo__'].total)}</p>
            </div>
            <p className="text-xs text-gray-400 mt-1">{byTipo['__sin_tipo__'].facts.length} facturas sin tipo de gasto asignado. Asígnalos manualmente en la tabla.</p>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500">No hay facturas para este período.</div>
        )}
      </div>
    </div>
  );
}
