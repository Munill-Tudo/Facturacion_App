'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, Hash, ExternalLink, Trash2, ChevronDown, CheckSquare, GripVertical, Download } from 'lucide-react';
import { exportToXlsx } from '@/lib/exportXlsx';
import { TipoSelect } from '@/components/facturas/TipoSelect';
import { EstadoSelect } from '@/components/facturas/EstadoSelect';
import { TipoGastoSelect } from '@/components/facturas/TipoGastoSelect';
import { moverAPapeleraClient, bulkUpdateFacturaEstado } from '@/app/facturas/actions';
import { useResizableColumns } from '@/lib/useResizableColumns';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal';
import { ModalEditarFactura } from '@/components/facturas/ModalEditarFactura';

const fmt = (v: number) => `€ ${v.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
function getISOWeek(d: Date): number {
  const date = new Date(d);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
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

interface Factura {
  id: number; numero?: string; fecha?: string; fecha_pago?: string;
  cliente?: string; nombre_proveedor?: string;
  nif_proveedor?: string; poblacion_proveedor?: string;
  tipo?: string; total_base?: number; total_iva?: number; total_irpf?: number;
  importe?: number; estado?: string; file_url?: string; archivo_url?: string;
  tipo_gasto?: string; subtipo_gasto?: string; numero_recepcion?: string;
  concepto?: string;
}

// Module-level to avoid re-creation every render
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

export function FacturasTable({ data }: { data: Factura[] }) {
  const router = useRouter();
  const { role } = useAuth();
  const [confirmModal, setConfirmModal] = useState<{ id: number } | null>(null);
  
  // Persisted Filters
  const [search, setSearch] = useLocalStorage('ft_search', '');
  const [filterConciliada, setFilterConciliada] = useLocalStorage<'Todas' | 'Pendiente' | 'Pagada'>('ft_concil', 'Todas');
  const [filterTipo, setFilterTipo] = useLocalStorage('ft_tipo', '');
  const [periodMode, setPeriodMode] = useLocalStorage<'libre' | 'mes' | 'trimestre' | 'año'>('ft_period_mode', 'libre');
  const [dateFrom, setDateFrom] = useLocalStorage('ft_dateFrom', '');
  const [dateTo, setDateTo] = useLocalStorage('ft_dateTo', '');
  const [selYear, setSelYear] = useLocalStorage('ft_year', new Date().getFullYear().toString());
  const [selMonth, setSelMonth] = useLocalStorage('ft_month', (new Date().getMonth() + 1).toString());
  const [selQ, setSelQ] = useLocalStorage('ft_q', '1');
  
  // Transient state
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBulking, setIsBulking] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [editingFactura, setEditingFactura] = useState<any>(null);

  // Pagination and Sort State
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'fecha', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterConciliada, filterTipo, periodMode, dateFrom, dateTo, selYear, selMonth, selQ, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (!current || current.key !== key) return { key, direction: 'asc' };
      if (current.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  };

  const { widths, onMouseDown } = useResizableColumns('cols_facturas', {
    num_rec: 110, fecha: 90, fecha_pago: 90, proveedor: 180, concepto: 160,
    tipo_gasto: 160, tipo: 90, base: 90, iva: 80, pct_iva: 70, 
    irpf: 80, pct_irpf: 72, total: 90, estado: 110, acciones: 80,
  });

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
      const matchEstado = filterConciliada === 'Todas' || inv.estado === filterConciliada;
      const matchTipo = !filterTipo || inv.tipo === filterTipo;
      return matchPeriod && matchSearch && matchEstado && matchTipo;
    });
  }, [data, search, filterConciliada, filterTipo, periodMode, dateFrom, dateTo, selYear, selMonth, selQ]);

  const sortedData = useMemo(() => {
    let sortableItems = [...filtered];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof Factura];
        let bValue: any = b[sortConfig.key as keyof Factura];
        
        if (sortConfig.key === 'proveedor') {
           aValue = (a.nombre_proveedor || a.cliente || '').toLowerCase();
           bValue = (b.nombre_proveedor || b.cliente || '').toLowerCase();
        } else if (sortConfig.key === 'fecha') {
           aValue = a.fecha ? new Date(a.fecha).getTime() : 0;
           bValue = b.fecha ? new Date(b.fecha).getTime() : 0;
        } else if (sortConfig.key === 'fecha_pago') {
           aValue = a.fecha_pago ? new Date(a.fecha_pago).getTime() : 0;
           bValue = b.fecha_pago ? new Date(b.fecha_pago).getTime() : 0;
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
  const countConciliadas = data.filter(i => i.estado === 'Pagada').length;

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

        {/* Toggles + Text + Tipo filters */}
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          {/* Toggle Conciliadas / Pendientes */}
          <div className="flex bg-gray-50 dark:bg-black/50 p-1 rounded-2xl border border-gray-200 dark:border-gray-800 shrink-0">
            <button onClick={() => setFilterConciliada('Todas')} className={`px-4 py-2 text-sm rounded-xl font-medium transition-all ${filterConciliada === 'Todas' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
              Todas ({countTotal})
            </button>
            <button onClick={() => setFilterConciliada('Pendiente')} className={`px-4 py-2 text-sm rounded-xl font-medium transition-all ${filterConciliada === 'Pendiente' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
              ⚠️ Pendientes ({countPendientes})
            </button>
            <button onClick={() => setFilterConciliada('Pagada')} className={`px-4 py-2 text-sm rounded-xl font-medium transition-all ${filterConciliada === 'Pagada' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
              ✅ Conciliadas ({countConciliadas})
            </button>
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar proveedor, NIF, número..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
          </div>
          <div className="relative shrink-0">
            <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className="pl-3 pr-8 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 appearance-none cursor-pointer">
              <option value="">Todos los tipos</option>
              <option value="Fijo">Fijo</option>
              <option value="Variable">Variable</option>
              <option value="Suplido">Suplido</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
          <span className="text-xs text-gray-400 shrink-0">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
          <button
            onClick={() => exportToXlsx(sortedData, [
              { header: 'Nº Factura', key: 'numero_recepcion', format: (v, r) => v || `Fc. Rec.-${String(r.id).padStart(4, '0')}` },
              { header: 'Fecha', key: 'fecha', format: v => v ? new Date(v).toLocaleDateString('es-ES') : '' },
              { header: 'Fecha Pago', key: 'fecha_pago', format: v => v ? new Date(v).toLocaleDateString('es-ES') : '' },
              { header: 'Proveedor', key: 'nombre_proveedor', format: (v, r) => v || r.cliente || '' },
              { header: 'NIF', key: 'nif_proveedor' },
              { header: 'Concepto', key: 'concepto' },
              { header: 'Tipo Gasto', key: 'tipo_gasto' },
              { header: 'Subtipo Gasto', key: 'subtipo_gasto' },
              { header: 'Tipo', key: 'tipo' },
              { header: 'Base Imponible', key: 'total_base', format: v => v != null ? Number(v).toFixed(2) : '' },
              { header: 'IVA (€)', key: 'total_iva', format: v => v != null ? Number(v).toFixed(2) : '' },
              { header: 'IRPF (€)', key: 'total_irpf', format: v => v != null && v !== 0 ? Number(v).toFixed(2) : '' },
              { header: 'Total', key: 'importe', format: v => v != null ? Number(v).toFixed(2) : '' },
              { header: 'Estado', key: 'estado' },
            ], `Facturas_Recibidas_${new Date().toISOString().slice(0,10)}`)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 rounded-xl transition-colors shrink-0"
          >
            <Download className="w-4 h-4" /> Exportar XLSX
          </button>
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
              Conciliada
            </button>
            <button onClick={() => handleBulkChange('Pendiente')} disabled={isBulking} className="px-3 py-1.5 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50">
              Pendiente
            </button>
            {role && (
              <button onClick={() => setBulkDeleteConfirm(true)} disabled={isBulking}
                className="px-3 py-1.5 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center gap-1 disabled:opacity-50">
                <Trash2 className="w-3 h-3" /> Borrar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Confirm single delete */}
      {confirmModal && (
        <ConfirmDeleteModal
          title="¿Mover factura a la papelera?"
          message="La factura se moverá a la papelera. Podrás restaurarla desde ahí."
          confirmLabel="Sí, mover"
          onConfirm={async () => { await moverAPapeleraClient(confirmModal.id); setConfirmModal(null); router.refresh(); }}
          onClose={() => setConfirmModal(null)}
        />
      )}

      {/* Confirm bulk delete */}
      {bulkDeleteConfirm && (
        <ConfirmDeleteModal
          title={`¿Mover ${selectedIds.length} facturas a la papelera?`}
          message="Todas las seleccionadas se moverán a la papelera."
          confirmLabel="Sí, mover todas"
          onConfirm={async () => {
            for (const id of selectedIds) await moverAPapeleraClient(id);
            setSelectedIds([]);
            setBulkDeleteConfirm(false);
            router.refresh();
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
                  <input type="checkbox" 
                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={e => setSelectedIds(e.target.checked ? filtered.map(f => f.id) : [])}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer" />
                </th>
                {([
                  ['num_rec',   'Nº Fac. Recibida'],
                  ['fecha',     'Fecha'],
                  ['fecha_pago','F. Pago'],
                  ['proveedor', 'Proveedor'],
                  ['concepto',  'Concepto'],
                  ['tipo_gasto','Tipo de Gasto'],
                  ['tipo',      'Tipo'],
                  ['base',      'Base'],
                  ['iva',       'IVA (€)'],
                  ['pct_iva',   'IVA %'],
                  ['irpf',      'IRPF (€)'],
                  ['pct_irpf',  'IRPF %'],
                  ['total',     'Total'],
                  ['estado',    'Estado'],
                  ['acciones',  'Acciones'],
                ] as [string, string][]).map(([col, label]) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    style={{ minWidth: widths[col], width: widths[col] }}
                    className="py-3 font-medium px-4 relative group/th whitespace-normal break-words cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      {label}
                      {sortConfig?.key === col && (
                        <span className="text-xs text-indigo-500">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                    <ResizeHandle col={col} onMouseDown={onMouseDown} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {paginatedData.length === 0 && (
                <tr><td colSpan={11} className="py-12 text-center text-gray-500">No se encontraron facturas con esos filtros.</td></tr>
              )}
              {paginatedData.map((inv) => (
                <tr key={inv.id} onDoubleClick={() => setEditingFactura(inv)}
                  className={`hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5 transition-colors group cursor-pointer ${selectedIds.includes(inv.id) ? 'bg-indigo-50/40 dark:bg-indigo-500/10' : ''}`} title="Doble clic para editar factura">
                  <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" 
                      checked={selectedIds.includes(inv.id)}
                      onChange={e => setSelectedIds(s => e.target.checked ? [...s, inv.id] : s.filter(id => id !== inv.id))}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer" />
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-emerald-600 dark:text-emerald-400 text-xs break-words" title={inv.numero_recepcion || `Fc. Rec.-${String(inv.id).padStart(4, '0')}`}>
                    {inv.numero_recepcion || `Fc. Rec.-${String(inv.id).padStart(4, '0')}`}
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400 text-xs">
                    {inv.fecha ? new Date(inv.fecha).toLocaleDateString('es-ES') : '—'}
                  </td>
                  <td className="py-3 px-4 text-emerald-600 dark:text-emerald-500 font-medium text-xs">
                    {inv.fecha_pago ? new Date(inv.fecha_pago).toLocaleDateString('es-ES') : '—'}
                  </td>
                  <td className="py-2 px-3 font-medium text-gray-900 dark:text-white truncate" title={inv.nombre_proveedor || inv.cliente || ''}>
                    {inv.nombre_proveedor || inv.cliente || '—'}
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-[11px] truncate" title={inv.concepto || ''}>
                    {inv.concepto || '—'}
                  </td>
                  <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                    <TipoGastoSelect id={inv.id} initialTipoGasto={inv.tipo_gasto} initialSubtipoGasto={inv.subtipo_gasto} />
                  </td>
                  <td className="py-3 px-4"><TipoSelect id={inv.id} initialTipo={inv.tipo} /></td>
                  <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{inv.total_base != null ? fmt(Number(inv.total_base)) : '—'}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs">{inv.total_iva != null ? fmt(Number(inv.total_iva)) : '—'}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs">
                    {inv.total_iva != null && inv.total_base ? `${((inv.total_iva / inv.total_base) * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs">{inv.total_irpf != null && inv.total_irpf !== 0 ? fmt(Number(inv.total_irpf)) : '—'}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs">
                    {inv.total_irpf != null && inv.total_irpf !== 0 && inv.total_base ? `${((inv.total_irpf / inv.total_base) * 100).toFixed(0)}%` : '—'}
                  </td>
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

        {/* VISTA MÓVIL: Tarjetas */}
        <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
          {paginatedData.length === 0 && (
            <div className="py-12 text-center text-gray-500 text-sm">No se encontraron facturas con esos filtros.</div>
          )}
          {paginatedData.map((inv) => (
            <div key={`mob-${inv.id}`} onDoubleClick={() => setEditingFactura(inv)}
              className={`p-4 flex flex-col gap-3 transition-colors ${selectedIds.includes(inv.id) ? 'bg-indigo-50/40 dark:bg-indigo-500/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}>
              
              <div className="flex items-start gap-3">
                <input type="checkbox" 
                  checked={selectedIds.includes(inv.id)}
                  onChange={e => setSelectedIds(s => e.target.checked ? [...s, inv.id] : s.filter(id => id !== inv.id))}
                  className="mt-1 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer shrink-0" 
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 text-[10px] font-medium px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-md">
                      {inv.numero_recepcion || `Fc. Rec.-${String(inv.id).padStart(4, '0')}`}
                    </span>
                    <span className="text-gray-400 text-xs">{inv.fecha ? new Date(inv.fecha).toLocaleDateString('es-ES') : '—'}</span>
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white line-clamp-1 text-sm">{inv.nombre_proveedor || inv.cliente || '—'}</p>
                  <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{inv.concepto || 'Sin concepto'}</p>
                </div>
                
                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-900 dark:text-white text-base">{inv.importe != null ? fmt(Number(inv.importe)) : '—'}</p>
                  <div className="mt-1 flex justify-end" onClick={e => e.stopPropagation()}>
                    <EstadoSelect id={inv.id} initialEstado={inv.estado || 'Pendiente'} context="factura" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800/60 mt-1">
                <div className="flex items-center gap-2 overflow-x-auto pb-1" onClick={e => e.stopPropagation()}>
                  <TipoGastoSelect id={inv.id} initialTipoGasto={inv.tipo_gasto} initialSubtipoGasto={inv.subtipo_gasto} />
                  <div className="shrink-0"><TipoSelect id={inv.id} initialTipo={inv.tipo} /></div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {(inv.file_url || inv.archivo_url) ? (
                    <a href={inv.file_url || inv.archivo_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded-xl bg-gray-50 dark:bg-white/5 flex items-center">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : (
                    <span className="p-2 text-gray-300 dark:text-gray-700 bg-gray-50 dark:bg-white/5 rounded-xl flex items-center"><ExternalLink className="w-4 h-4" /></span>
                  )}
                  <form action={role === 'administracion' ? undefined : moverAPapeleraClient.bind(null, inv.id)}>
                    <button type={role === 'administracion' ? 'button' : 'submit'}
                      onClick={e => { e.stopPropagation(); if (role === 'administracion') setConfirmModal({ id: inv.id }); }}
                      className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 rounded-2xl mt-4">
          <span className="text-sm text-gray-500">
            Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, sortedData.length)} de {sortedData.length} facturas
          </span>
          <div className="flex gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors">Anterior</button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors">Siguiente</button>
          </div>
        </div>
      )}

      {editingFactura && (
        <ModalEditarFactura
          factura={editingFactura}
          onClose={() => setEditingFactura(null)}
          onSave={() => {
            setEditingFactura(null);
            router.refresh(); // Refresh page data from server component
          }}
        />
      )}
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
