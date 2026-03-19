'use client';

import { useState, useMemo } from 'react';
import { Search, Hash, Building2, ExternalLink, Trash2, ChevronDown, CheckSquare } from 'lucide-react';
import { TipoSelect } from '@/components/facturas/TipoSelect';
import { EstadoSelect } from '@/components/facturas/EstadoSelect';
import { moverAPapeleraClient, bulkUpdateFacturaEstado } from '@/app/facturas/actions';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { ConfirmDireccionModal } from '@/components/auth/ConfirmDireccionModal';

const fmt = (v: number) => `€ ${v.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;

function getISOWeek(d: Date): number {
  const date = new Date(d);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getQuarter(d: Date): number {
  return Math.floor(d.getMonth() / 3) + 1;
}

interface Factura {
  id: number; numero?: string; fecha?: string; fecha_pago?: string;
  cliente?: string; nombre_proveedor?: string;
  nif_proveedor?: string; poblacion_proveedor?: string;
  tipo?: string; total_base?: number; total_iva?: number; total_irpf?: number;
  importe?: number; estado?: string; file_url?: string; archivo_url?: string;
}

export function FacturasTable({ data }: { data: Factura[] }) {
  const router = useRouter();
  const { role } = useAuth();
  const [confirmModal, setConfirmModal] = useState<{ id: number } | null>(null);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
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
    return Array.from(ys).sort().reverse();
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter(inv => {
      if (!inv.fecha && periodMode !== 'libre') return false;
      const d = inv.fecha ? new Date(inv.fecha) : null;

      const matchPeriod = (() => {
        if (!d) return periodMode === 'libre';
        if (periodMode === 'mes') return d.getFullYear().toString() === selYear && (d.getMonth() + 1).toString() === selMonth;
        if (periodMode === 'trimestre') return d.getFullYear().toString() === selYear && getQuarter(d).toString() === selQ;
        if (periodMode === 'año') return d.getFullYear().toString() === selYear;
        // libre
        const from = dateFrom ? new Date(dateFrom) : null;
        const to = dateTo ? new Date(dateTo + 'T23:59:59') : null;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      })();

      const proveedor = (inv.nombre_proveedor || inv.cliente || '').toLowerCase();
      const matchSearch = !q || proveedor.includes(q) || inv.numero?.toLowerCase().includes(q) || inv.nif_proveedor?.toLowerCase().includes(q);
      const matchEstado = !filterEstado || inv.estado === filterEstado;
      const matchTipo = !filterTipo || inv.tipo === filterTipo;
      return matchPeriod && matchSearch && matchEstado && matchTipo;
    });
  }, [data, search, filterEstado, filterTipo, periodMode, dateFrom, dateTo, selYear, selMonth, selQ]);

  const totalImporte = filtered.reduce((s, i) => s + (Number(i.importe) || 0), 0);
  const totalPendiente = filtered.filter(i => i.estado === 'Pendiente').reduce((s, i) => s + (Number(i.importe) || 0), 0);
  const totalBase = filtered.reduce((s, i) => s + (Number(i.total_base) || 0), 0);
  const totalFijos = filtered.filter(i => i.tipo === 'Fijo').reduce((s, i) => s + (Number(i.importe) || 0), 0);
  const totalVariables = filtered.filter(i => i.tipo === 'Variable').reduce((s, i) => s + (Number(i.importe) || 0), 0);
  const totalSuplidos = filtered.filter(i => i.tipo === 'Suplido').reduce((s, i) => s + (Number(i.importe) || 0), 0);

  return (
    <div className="space-y-4">
      {/* TOP TOTALS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <TotalCard label="Total Facturas" value={fmt(totalImporte)} color="indigo" />
        <TotalCard label="Pendiente de pago" value={fmt(totalPendiente)} color="orange" />
        <TotalCard label="Base Imponible" value={fmt(totalBase)} color="purple" />
        <TotalCard label="Gastos Fijos" value={fmt(totalFijos)} color="blue" />
        <TotalCard label="Gastos Variables" value={fmt(totalVariables)} color="sky" />
        <TotalCard label="Suplidos" value={fmt(totalSuplidos)} color="emerald" />
      </div>

      {/* FILTERS */}
      <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-3">
        {/* Period mode selector */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-500 font-medium">Período:</span>
          {(['libre','mes','trimestre','año'] as const).map(m => (
            <button key={m} onClick={() => setPeriodMode(m)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${periodMode === m ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/20'}`}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        {/* Period-specific controls */}
        <div className="flex flex-wrap gap-3 items-center">
          {periodMode === 'libre' && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 text-xs">Desde:</span>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 text-xs">Hasta:</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
            </>
          )}
          {(periodMode === 'mes' || periodMode === 'trimestre' || periodMode === 'año') && (
            <div className="relative">
              <select value={selYear} onChange={e => setSelYear(e.target.value)} className="pl-3 pr-8 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 appearance-none">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
                {!years.includes(new Date().getFullYear().toString()) && <option value={new Date().getFullYear().toString()}>{new Date().getFullYear()}</option>}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          )}
          {periodMode === 'mes' && (
            <div className="relative">
              <select value={selMonth} onChange={e => setSelMonth(e.target.value)} className="pl-3 pr-8 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 appearance-none">
                {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m,i) => (
                  <option key={i+1} value={(i+1).toString()}>{m}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          )}
          {periodMode === 'trimestre' && (
            <div className="relative">
              <select value={selQ} onChange={e => setSelQ(e.target.value)} className="pl-3 pr-8 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 appearance-none">
                <option value="1">1er Trimestre (Ene-Mar)</option>
                <option value="2">2º Trimestre (Abr-Jun)</option>
                <option value="3">3er Trimestre (Jul-Sep)</option>
                <option value="4">4º Trimestre (Oct-Dic)</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Text + Estado + Tipo filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar proveedor, NIF, número..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
          </div>
          <div className="relative">
            <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className="pl-3 pr-8 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 appearance-none cursor-pointer">
              <option value="">Todos los estados</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Pagada">Pagada</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className="pl-3 pr-8 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 appearance-none cursor-pointer">
              <option value="">Todos los tipos</option>
              <option value="Fijo">Fijo</option>
              <option value="Variable">Variable</option>
              <option value="Suplido">Suplido</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
          <span className="text-xs text-gray-400">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* BULK ACTIONS BAR */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-medium text-indigo-900 dark:text-indigo-300">
              {selectedIds.length} factura{selectedIds.length > 1 ? 's' : ''} seleccionada{selectedIds.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mr-1">Marcar como:</span>
            <button onClick={() => handleBulkChange('Pagada')} disabled={isBulking} className="px-3 py-1.5 text-xs font-semibold bg-green-500 hover:bg-green-600 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50">
              Pagada
            </button>
            <button onClick={() => handleBulkChange('Pendiente')} disabled={isBulking} className="px-3 py-1.5 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50">
              Pendiente
            </button>
          </div>
        </div>
      )}

      {/* Confirm Direccion Modal */}
      {confirmModal && (
        <ConfirmDireccionModal
          actionLabel="mover la factura a la papelera"
          onConfirmed={async () => {
            setConfirmModal(null);
            await moverAPapeleraClient(confirmModal.id);
          }}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {/* TABLE */}
      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-gray-800 text-gray-500">
                <th className="py-3 px-4 w-12">
                  <input type="checkbox" 
                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={e => setSelectedIds(e.target.checked ? filtered.map(f => f.id) : [])}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer" />
                </th>
                <th className="py-3 font-medium px-4">Nº Rec.</th>
                <th className="py-3 font-medium px-4">Nº Factura</th>
                <th className="py-3 font-medium px-4">Fecha</th>
                <th className="py-3 font-medium px-4">Proveedor</th>
                <th className="py-3 font-medium px-4">NIF</th>
                <th className="py-3 font-medium px-4">Tipo</th>
                <th className="py-3 font-medium px-4">Población</th>
                <th className="py-3 font-medium px-4">Base</th>
                <th className="py-3 font-medium px-4">Total</th>
                <th className="py-3 font-medium px-4">Estado</th>
                <th className="py-3 font-medium px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="py-12 text-center text-gray-500">No se encontraron facturas con esos filtros.</td></tr>
              )}
              {filtered.map((inv) => (
                <tr key={inv.id} onDoubleClick={() => router.push(`/facturas/${inv.id}`)}
                  className={`hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5 transition-colors group cursor-pointer ${selectedIds.includes(inv.id) ? 'bg-indigo-50/40 dark:bg-indigo-500/10' : ''}`} title="Doble clic para ver detalle">
                  <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" 
                      checked={selectedIds.includes(inv.id)}
                      onChange={e => setSelectedIds(s => e.target.checked ? [...s, inv.id] : s.filter(id => id !== inv.id))}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer" />
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-emerald-600 dark:text-emerald-400 text-xs">REC-{String(inv.id).padStart(4, '0')}</td>
                  <td className="py-3 px-4 font-mono font-medium text-indigo-600 dark:text-indigo-400">
                    <div className="flex items-center gap-1.5"><Hash className="w-3 h-3" />{inv.numero || <span className="text-gray-400 text-xs">—</span>}</div>
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-xs">
                    {inv.fecha ? new Date(inv.fecha).toLocaleDateString('es-ES') : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">{inv.nombre_proveedor || inv.cliente || '—'}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-gray-500 text-xs">{inv.nif_proveedor || '—'}</td>
                  <td className="py-3 px-4"><TipoSelect id={inv.id} initialTipo={inv.tipo} /></td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-xs">{inv.poblacion_proveedor || '—'}</td>
                  <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{inv.total_base != null ? fmt(Number(inv.total_base)) : '—'}</td>
                  <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">{inv.importe != null ? fmt(Number(inv.importe)) : '—'}</td>
                  <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                    <EstadoSelect id={inv.id} initialEstado={inv.estado || 'Pendiente'} context="factura" />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {(inv.file_url || inv.archivo_url) ? (
                        <a href={inv.file_url || inv.archivo_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 flex items-center">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="p-1.5 text-gray-200 dark:text-gray-800 flex items-center"><ExternalLink className="w-4 h-4" /></span>
                      )}
                      <form action={role === 'administracion' ? undefined : moverAPapeleraClient.bind(null, inv.id)}>
                        <button type={role === 'administracion' ? 'button' : 'submit'}
                          onClick={e => { e.stopPropagation(); if (role === 'administracion') setConfirmModal({ id: inv.id }); }}
                          className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </form>
                    </div>
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

function TotalCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    indigo: 'border-indigo-100 dark:border-indigo-800/30 text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-500/5',
    orange: 'border-orange-100 dark:border-orange-800/30 text-orange-700 dark:text-orange-300 bg-orange-50/50 dark:bg-orange-500/5',
    purple: 'border-purple-100 dark:border-purple-800/30 text-purple-700 dark:text-purple-300 bg-purple-50/50 dark:bg-purple-500/5',
    blue:   'border-blue-100 dark:border-blue-800/30 text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-500/5',
    sky:    'border-sky-100 dark:border-sky-800/30 text-sky-700 dark:text-sky-300 bg-sky-50/50 dark:bg-sky-500/5',
    emerald:'border-emerald-100 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-500/5',
  };
  return (
    <div className={`p-3 rounded-2xl border ${colors[color]}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="font-bold text-sm">{value}</p>
    </div>
  );
}
