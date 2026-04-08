'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, ExternalLink, Trash2, ChevronDown, CheckSquare, GripVertical, Download } from 'lucide-react';
import { exportToXlsx } from '@/lib/exportXlsx';
import { EstadoEmitidaSelect } from '@/components/emitidas/EstadoEmitidaSelect';
import { moverEmitidaAPapeleraClient, bulkUpdateEmitidaEstado } from '@/app/emitidas/actions';
import { useResizableColumns } from '@/lib/useResizableColumns';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal';

const fmt = (v: number) => `€ ${v.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
function getQuarter(d: Date): number { return Math.floor(d.getMonth() / 3) + 1; }

function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }, 0);
      }
    } catch (err) { }
  };

  return [storedValue, setValue] as const;
}

interface Emitida {
  id: number; numero?: string; fecha?: string; fecha_cobro?: string;
  cliente?: string; nif_cliente?: string; poblacion_cliente?: string;
  concepto?: string; total_base?: number; total_iva?: number; total_irpf?: number;
  importe?: number; estado?: string; file_url?: string; archivo_url?: string;
  numero_emision?: string; referencia_rf?: string;
}

function ResizeHandle({ col, onMouseDown }: { col: string; onMouseDown: (col: string, e: React.MouseEvent) => void }) {
  return (
    <span
      onMouseDown={e => onMouseDown(col, e)}
      className="absolute right-0 top-0 h-full w-2 cursor-col-resize flex items-center justify-center opacity-0 group-hover/th:opacity-60 hover:!opacity-100 select-none z-10"
    >
      <GripVertical className="w-3 h-3 text-gray-400" />
    </span>
  );
}

export function FacturasEmitidasTable({ data }: { data: Emitida[] }) {
  const router = useRouter();
  const { role } = useAuth();
  const [confirmModal, setConfirmModal] = useState<{ id: number } | null>(null);
  
  const [search, setSearch] = useLocalStorage('em_search', '');
  const [filterConciliada, setFilterConciliada] = useLocalStorage<'Todas' | 'Pendiente' | 'Cobrada'>('em_concil', 'Todas');
  const [periodMode, setPeriodMode] = useLocalStorage<'libre' | 'mes' | 'trimestre' | 'año'>('em_period_mode', 'libre');
  const [dateFrom, setDateFrom] = useLocalStorage('em_dateFrom', '');
  const [dateTo, setDateTo] = useLocalStorage('em_dateTo', '');
  const [selYear, setSelYear] = useLocalStorage('em_year', new Date().getFullYear().toString());
  const [selMonth, setSelMonth] = useLocalStorage('em_month', (new Date().getMonth() + 1).toString());
  const [selQ, setSelQ] = useLocalStorage('em_q', '1');
  
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBulking, setIsBulking] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'fecha', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterConciliada, periodMode, dateFrom, dateTo, selYear, selMonth, selQ, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (!current || current.key !== key) return { key, direction: 'asc' };
      if (current.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  };

  const { widths, onMouseDown } = useResizableColumns('cols_emitidas', {
    rf: 140, num_emi: 110, fecha: 90, fecha_cobro: 90, cliente: 180, concepto: 160,
    base: 90, iva: 80, pct_iva: 70, irpf: 80, pct_irpf: 72, total: 90, estado: 110, acciones: 80,
  });

  const handleBulkChange = async (estado: string) => {
    if (!selectedIds.length) return;
    setIsBulking(true);
    await bulkUpdateEmitidaEstado(selectedIds, estado);
    setSelectedIds([]);
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
        const from = dateFrom ? new Date(dateFrom) : null;
        const to = dateTo ? new Date(dateTo + 'T23:59:59') : null;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      })();

      const cliente = (inv.cliente || '').toLowerCase();
      const matchSearch = !q || cliente.includes(q) || inv.numero?.toLowerCase().includes(q) || inv.nif_cliente?.toLowerCase().includes(q);
      
      const realStatus = inv.estado === 'Pagada' ? 'Cobrada' : inv.estado; // For emitted, Pagada -> Cobrada in UI
      const filterToUse = filterConciliada;
      const matchEstado = filterConciliada === 'Todas' || realStatus === filterToUse;
      
      return matchPeriod && matchSearch && matchEstado;
    });
  }, [data, search, filterConciliada, periodMode, dateFrom, dateTo, selYear, selMonth, selQ]);

  const sortedData = useMemo(() => {
    let sortableItems = [...filtered];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof Emitida];
        let bValue: any = b[sortConfig.key as keyof Emitida];
        
        if (sortConfig.key === 'cliente') {
           aValue = (a.cliente || '').toLowerCase();
           bValue = (b.cliente || '').toLowerCase();
        } else if (sortConfig.key === 'fecha') {
           aValue = a.fecha ? new Date(a.fecha).getTime() : 0;
           bValue = b.fecha ? new Date(b.fecha).getTime() : 0;
        } else if (sortConfig.key === 'fecha_cobro') {
           aValue = a.fecha_cobro ? new Date(a.fecha_cobro).getTime() : 0;
           bValue = b.fecha_cobro ? new Date(b.fecha_cobro).getTime() : 0;
        }

        if (aValue == null) return 1;
        if (bValue == null) return -1;

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filtered, sortConfig]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(start, start + itemsPerPage);
  }, [sortedData, currentPage]);
  
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  const countTotal = data.length;
  const countPendientes = data.filter(i => i.estado === 'Pendiente').length;
  // Use "Pagada" because the db might store it as Pagada, but we display it as Cobrada
  const countCobradas = data.filter(i => i.estado === 'Pagada' || i.estado === 'Cobrada').length;

  const totalImporte = filtered.reduce((s, i) => s + (Number(i.importe) || 0), 0);
  const totalPendiente = filtered.filter(i => i.estado === 'Pendiente').reduce((s, i) => s + (Number(i.importe) || 0), 0);
  const totalBase = filtered.reduce((s, i) => s + (Number(i.total_base) || 0), 0);

  return (
    <div className="space-y-4">
      {/* TOP TOTALS */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <TotalCard label="Total Facturado" value={fmt(totalImporte)} color="emerald" />
        <TotalCard label="Pendiente de cobro" value={fmt(totalPendiente)} color="orange" />
        <TotalCard label="Base Imponible" value={fmt(totalBase)} color="purple" />
      </div>

      {/* FILTERS */}
      <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-500 font-medium">Período:</span>
          {(['libre','mes','trimestre','año'] as const).map(m => (
            <button key={m} onClick={() => setPeriodMode(m)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${periodMode === m ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/20'}`}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex bg-gray-50 dark:bg-black/50 p-1 rounded-2xl border border-gray-200 dark:border-gray-800 shrink-0">
            <button onClick={() => setFilterConciliada('Todas')} className={`px-4 py-2 text-sm rounded-xl font-medium transition-all ${filterConciliada === 'Todas' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
              Todas ({countTotal})
            </button>
            <button onClick={() => setFilterConciliada('Pendiente')} className={`px-4 py-2 text-sm rounded-xl font-medium transition-all ${filterConciliada === 'Pendiente' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
              ⚠️ Pendientes ({countPendientes})
            </button>
            <button onClick={() => setFilterConciliada('Cobrada')} className={`px-4 py-2 text-sm rounded-xl font-medium transition-all ${filterConciliada === 'Cobrada' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
              ✅ Cobradas ({countCobradas})
            </button>
          </div>

          <div className="relative flex-1 min-w-[200px]">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente, número..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
          </div>
          <span className="text-xs text-gray-400 shrink-0">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
          <button
            onClick={() => exportToXlsx(sortedData, [
              { header: 'Nº Factura', key: 'numero', format: (v, r) => v || `Fc. Emi.-${String(r.id).padStart(4, '0')}` },
              { header: 'Fecha', key: 'fecha', format: v => v ? new Date(v).toLocaleDateString('es-ES') : '' },
              { header: 'Cliente', key: 'cliente' },
              { header: 'NIF', key: 'nif_cliente' },
              { header: 'Concepto', key: 'concepto' },
              { header: 'Base Imponible', key: 'total_base', format: v => v != null ? Number(v).toFixed(2) : '' },
              { header: 'IVA (€)', key: 'total_iva', format: v => v != null ? Number(v).toFixed(2) : '' },
              { header: 'Total', key: 'importe', format: v => v != null ? Number(v).toFixed(2) : '' },
              { header: 'Estado', key: 'estado' },
            ], `Facturas_Emitidas_${new Date().toISOString().slice(0,10)}`)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 rounded-xl transition-colors shrink-0"
          >
            <Download className="w-4 h-4" /> Exportar XLSX
          </button>
        </div>
      </div>

      {/* BULK ACTIONS */}
      {selectedIds.length > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium text-emerald-900 dark:text-emerald-300">
              {selectedIds.length} factura{selectedIds.length > 1 ? 's' : ''} seleccionada{selectedIds.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleBulkChange('Pagada')} disabled={isBulking} className="px-3 py-1.5 text-xs font-semibold bg-green-500 hover:bg-green-600 text-white rounded-lg shadow-sm">
              Cobrada
            </button>
            <button onClick={() => handleBulkChange('Pendiente')} disabled={isBulking} className="px-3 py-1.5 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-sm">
              Pendiente
            </button>
            {role && (
              <button onClick={() => setBulkDeleteConfirm(true)} disabled={isBulking} className="px-3 py-1.5 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Borrar
              </button>
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      {confirmModal && (
        <ConfirmDeleteModal
          title="¿Mover a la papelera?"
          message="La factura se moverá a la papelera."
          confirmLabel="Sí, mover"
          onConfirm={async () => { await moverEmitidaAPapeleraClient(confirmModal.id); setConfirmModal(null); router.refresh(); }}
          onClose={() => setConfirmModal(null)}
        />
      )}
      {bulkDeleteConfirm && (
        <ConfirmDeleteModal
          title={`¿Mover ${selectedIds.length} facturas a la papelera?`}
          message="Todas se moverán a la papelera."
          confirmLabel="Sí, mover"
          onConfirm={async () => {
            for (const id of selectedIds) await moverEmitidaAPapeleraClient(id);
            setSelectedIds([]); setBulkDeleteConfirm(false); router.refresh();
          }}
          onClose={() => setBulkDeleteConfirm(false)}
        />
      )}

      {/* TABLE */}
      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="hidden md:table w-full text-left border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-gray-800 text-gray-500">
                <th className="py-3 px-4 w-12">
                  <input type="checkbox" checked={filtered.length > 0 && selectedIds.length === filtered.length} onChange={e => setSelectedIds(e.target.checked ? filtered.map(f => f.id) : [])} className="w-4 h-4 rounded text-emerald-600" />
                </th>
                {([
                  ['num_emi',   'Nº Factura'],
                  ['fecha',     'Fecha'],
                  ['cliente',   'Cliente'],
                  ['concepto',  'Concepto'],
                  ['base',      'Base'],
                  ['iva',       'IVA (€)'],
                  ['total',     'Total'],
                  ['estado',    'Estado'],
                  ['acciones',  'Acciones'],
                ] as [string, string][]).map(([col, label]) => (
                  <th key={col} onClick={() => handleSort(col)} style={{ minWidth: widths[col], width: widths[col] }} className="py-3 font-medium px-4 relative group/th cursor-pointer hover:bg-gray-100">
                    <div className="flex items-center gap-1">{label} {sortConfig?.key === col && <span className="text-xs text-emerald-500">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>}</div>
                    <ResizeHandle col={col} onMouseDown={onMouseDown} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {paginatedData.map((inv) => (
                <tr key={inv.id} className="hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5 transition-colors group">
                  <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.includes(inv.id)} onChange={e => setSelectedIds(s => e.target.checked ? [...s, inv.id] : s.filter(id => id !== inv.id))} className="w-4 h-4 rounded text-emerald-600" />
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-emerald-600 dark:text-emerald-400 text-xs">
                    {inv.numero_emision || inv.numero || `Fc. Emi.-${String(inv.id).padStart(4, '0')}`}
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-xs text-nowrap">
                    {inv.fecha ? new Date(inv.fecha).toLocaleDateString('es-ES') : '—'}
                  </td>
                  <td className="py-2 px-3 font-medium text-gray-900 dark:text-white truncate" title={inv.cliente || ''}>
                    {inv.cliente || '—'}
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-[11px] truncate" title={inv.concepto || ''}>
                    {inv.concepto || '—'}
                  </td>
                  <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{inv.total_base != null ? fmt(Number(inv.total_base)) : '—'}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs">{inv.total_iva != null ? fmt(Number(inv.total_iva)) : '—'}</td>
                  <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">{inv.importe != null ? fmt(Number(inv.importe)) : '—'}</td>
                  <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                    <EstadoEmitidaSelect id={inv.id} initialEstado={inv.estado || 'Pendiente'} />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {(inv.file_url || inv.archivo_url) ? (
                        <a href={inv.file_url || inv.archivo_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-1.5 text-gray-400 hover:text-emerald-600 transition-colors">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      ) : <span className="p-1.5 text-gray-200"><ExternalLink className="w-4 h-4" /></span>}
                      <form action={role === 'administracion' ? undefined : moverEmitidaAPapeleraClient.bind(null, inv.id)}>
                        <button type={role === 'administracion' ? 'button' : 'submit'} onClick={e => { e.stopPropagation(); if (role === 'administracion') setConfirmModal({ id: inv.id }); }} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors">
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
        <div className="md:hidden p-4 space-y-4">
           <div className="text-gray-500 text-sm">Próximamente versión móvil</div>
        </div>
      </div>
      
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-[#0a0a0a] border border-gray-100 rounded-2xl mt-4">
           {/* Pagination simple logic */}
        </div>
      )}
    </div>
  );
}

function TotalCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    emerald:'border-emerald-100 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-500/5',
    orange: 'border-orange-100 dark:border-orange-800/30 text-orange-700 dark:text-orange-300 bg-orange-50/50 dark:bg-orange-500/5',
    purple: 'border-purple-100 dark:border-purple-800/30 text-purple-700 dark:text-purple-300 bg-purple-50/50 dark:bg-purple-500/5',
  };
  return (
    <div className={`p-3 rounded-2xl border ${colors[color]}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="font-bold text-sm">{value}</p>
    </div>
  );
}
