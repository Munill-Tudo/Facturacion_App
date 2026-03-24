'use client';

import { useState, useMemo } from 'react';
import { Search, Building2, Calendar, ExternalLink, CheckCircle2, Circle, ChevronDown, CheckSquare } from 'lucide-react';
import { TipoSelect } from '@/components/facturas/TipoSelect';
import { EditableCell } from '@/components/facturas/EditableCell';
import { EstadoSelect } from '@/components/facturas/EstadoSelect';
import { bulkUpdateFacturaEstado } from '@/app/facturas/actions';
import { useRouter } from 'next/navigation';

const fmt = (v: number) => `€ ${v.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
function getQuarter(d: Date) { return Math.floor(d.getMonth() / 3) + 1; }

export function SuplidosTableClient({ data }: { data: any[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [periodMode, setPeriodMode] = useState<'libre' | 'mes' | 'trimestre' | 'año'>('libre');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selYear, setSelYear] = useState(new Date().getFullYear().toString());
  const [selMonth, setSelMonth] = useState((new Date().getMonth() + 1).toString());
  const [selQ, setSelQ] = useState('1');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBulking, setIsBulking] = useState(false);

  const handleBulkChange = async (estado: string) => {
    if (!selectedIds.length) return;
    setIsBulking(true);
    await bulkUpdateFacturaEstado(selectedIds, estado);
    setSelectedIds([]); // clean after bulk
    setIsBulking(false);
  };

  const years = useMemo(() => {
    const ys = new Set(data.map(i => i.fecha ? new Date(i.fecha).getFullYear().toString() : '').filter(Boolean));
    const arr = Array.from(ys).sort().reverse();
    if (!arr.includes(new Date().getFullYear().toString())) arr.unshift(new Date().getFullYear().toString());
    return arr;
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter(inv => {
      const d = inv.fecha ? new Date(inv.fecha) : null;
      const matchPeriod = (() => {
        if (!d) return periodMode === 'libre' && !dateFrom && !dateTo;
        if (periodMode === 'mes') return d.getFullYear().toString() === selYear && (d.getMonth()+1).toString() === selMonth;
        if (periodMode === 'trimestre') return d.getFullYear().toString() === selYear && getQuarter(d).toString() === selQ;
        if (periodMode === 'año') return d.getFullYear().toString() === selYear;
        const from = dateFrom ? new Date(dateFrom) : null;
        const to = dateTo ? new Date(dateTo + 'T23:59:59') : null;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      })();
      const proveedor = (inv.nombre_proveedor || inv.cliente || '').toLowerCase();
      const matchSearch = !q || proveedor.includes(q) || inv.num_expediente?.toLowerCase().includes(q) || inv.cliente_expediente?.toLowerCase().includes(q);
      const matchEstado = !filterEstado || inv.estado === filterEstado;
      return matchPeriod && matchSearch && matchEstado;
    });
  }, [data, search, filterEstado, periodMode, dateFrom, dateTo, selYear, selMonth, selQ]);

  const totalImporte = filtered.reduce((s, i) => s + (Number(i.importe) || 0), 0);
  const totalPendiente = filtered.filter(i => i.estado === 'Pendiente').reduce((s, i) => s + (Number(i.importe) || 0), 0);
  const totalBase = filtered.reduce((s, i) => s + (Number(i.total_base) || 0), 0);

  return (
    <div className="space-y-4">
      {/* TOP TOTALS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 bg-emerald-50/50 dark:bg-emerald-500/5">
          <p className="text-xs text-gray-500 mb-1">Total Suplidos</p>
          <p className="font-bold text-emerald-700 dark:text-emerald-300">{fmt(totalImporte)}</p>
        </div>
        <div className="p-4 rounded-2xl border border-orange-100 dark:border-orange-800/30 bg-orange-50/50 dark:bg-orange-500/5">
          <p className="text-xs text-gray-500 mb-1">Pendiente de cobrar</p>
          <p className="font-bold text-orange-600 dark:text-orange-400">{fmt(totalPendiente)}</p>
        </div>
        <div className="p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800/30 bg-indigo-50/50 dark:bg-indigo-500/5">
          <p className="text-xs text-gray-500 mb-1">Base Imponible</p>
          <p className="font-bold text-indigo-700 dark:text-indigo-300">{fmt(totalBase)}</p>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-500 font-medium">Período:</span>
          {(['libre','mes','trimestre','año'] as const).map(m => (
            <button key={m} onClick={() => setPeriodMode(m)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${periodMode === m ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          {periodMode === 'libre' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-xs">Desde:</span>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-xs">Hasta:</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
              </div>
            </>
          )}
          {(periodMode === 'mes' || periodMode === 'trimestre' || periodMode === 'año') && (
            <div className="relative">
              <select value={selYear} onChange={e => setSelYear(e.target.value)} className="pl-3 pr-8 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-700 dark:text-gray-300 focus:outline-none appearance-none">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          )}
          {periodMode === 'mes' && (
            <div className="relative">
              <select value={selMonth} onChange={e => setSelMonth(e.target.value)} className="pl-3 pr-8 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-700 dark:text-gray-300 focus:outline-none appearance-none">
                {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m,i) => (
                  <option key={i+1} value={(i+1).toString()}>{m}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          )}
          {periodMode === 'trimestre' && (
            <div className="relative">
              <select value={selQ} onChange={e => setSelQ(e.target.value)} className="pl-3 pr-8 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-700 dark:text-gray-300 focus:outline-none appearance-none">
                <option value="1">1er Trimestre (Ene-Mar)</option>
                <option value="2">2º Trimestre (Abr-Jun)</option>
                <option value="3">3er Trimestre (Jul-Sep)</option>
                <option value="4">4º Trimestre (Oct-Dic)</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar proveedor, expediente, cliente..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
          </div>
          <div className="relative">
            <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className="pl-3 pr-8 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-700 dark:text-gray-300 focus:outline-none appearance-none cursor-pointer">
              <option value="">Todos los estados</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Pagada">Pagada</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
          <span className="text-xs text-gray-400">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* BULK ACTIONS BAR */}
      {selectedIds.length > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium text-emerald-900 dark:text-emerald-300">
              {selectedIds.length} suplido{selectedIds.length > 1 ? 's' : ''} seleccionado{selectedIds.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mr-1">Cambiar estado a:</span>
            <button onClick={() => handleBulkChange('Abonado')} disabled={isBulking} className="px-3 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50">
              Abonado
            </button>
            <button onClick={() => handleBulkChange('Pendiente')} disabled={isBulking} className="px-3 py-1.5 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50">
              Pendiente
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500 bg-gray-50/50 dark:bg-white/5">
                <th className="py-4 px-4 w-12">
                  <input type="checkbox" 
                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={e => setSelectedIds(e.target.checked ? filtered.map(f => f.id) : [])}
                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer" />
                </th>
                <th className="py-4 font-medium px-4">Nº Rec.</th>
                <th className="py-4 font-medium px-4">Fecha</th>
                <th className="py-4 font-medium px-4">Proveedor</th>
                <th className="py-4 font-medium px-4">Nº Expediente</th>
                <th className="py-4 font-medium px-4">Cliente</th>
                <th className="py-4 font-medium px-4">Tipo</th>
                <th className="py-4 font-medium px-4">Importe</th>
                <th className="py-4 font-medium px-4">Estado</th>
                <th className="py-4 font-medium px-4 text-right">Doc</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="py-12 text-center text-gray-500">No se encontraron suplidos con esos filtros.</td></tr>
              )}
              {filtered.map((inv) => (
                <tr key={inv.id} onDoubleClick={() => router.push(`/facturas/${inv.id}`)}
                  className={`hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5 transition-colors cursor-pointer ${selectedIds.includes(inv.id) ? 'bg-emerald-50/40 dark:bg-emerald-500/10' : ''}`} title="Doble clic para ver detalle">
                  <td className="py-4 px-4" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" 
                      checked={selectedIds.includes(inv.id)}
                      onChange={e => setSelectedIds(s => e.target.checked ? [...s, inv.id] : s.filter(id => id !== inv.id))}
                      className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer" />
                  </td>
                  <td className="py-4 px-4 font-mono font-medium text-emerald-600 dark:text-emerald-400 text-xs">Fc. Rec.-{String(inv.id).padStart(4, '0')}</td>
                  <td className="py-4 px-4 text-gray-500">
                    <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3" />{inv.fecha ? new Date(inv.fecha).toLocaleDateString('es-ES') : '—'}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">{inv.nombre_proveedor || inv.cliente || '—'}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4"><EditableCell id={inv.id} field="num_expediente" value={inv.num_expediente} placeholder="Añadir exp..." /></td>
                  <td className="py-4 px-4"><EditableCell id={inv.id} field="cliente_expediente" value={inv.cliente_expediente} placeholder="Añadir cliente..." /></td>
                  <td className="py-4 px-4"><TipoSelect id={inv.id} initialTipo={inv.tipo} /></td>
                  <td className="py-4 px-4 font-bold text-gray-900 dark:text-white">{inv.importe != null ? fmt(Number(inv.importe)) : '—'}</td>
                  <td className="py-4 px-4" onClick={e => e.stopPropagation()}>
                    <EstadoSelect id={inv.id} initialEstado={inv.estado || 'Pendiente'} context="suplido" />
                  </td>
                  <td className="py-4 px-4 text-right">
                    {(inv.file_url || inv.archivo_url) ? (
                      <a href={inv.file_url || inv.archivo_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="inline-flex p-2 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    ) : (
                      <span className="inline-flex p-2 text-gray-200 dark:text-gray-800"><ExternalLink className="w-4 h-4" /></span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
