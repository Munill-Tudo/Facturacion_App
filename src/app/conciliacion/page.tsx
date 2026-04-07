'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PiggyBank, RefreshCcw, Search, AlertCircle, ArrowRightLeft, ArrowDownRight, ArrowUpRight, Link2, UserPlus, CheckCircle2, Zap, Download, ChevronDown, GripVertical } from 'lucide-react';
import { AsociarFacturaModal } from '@/components/conciliacion/AsociarFacturaModal';
import { AsignarClienteModal } from '@/components/conciliacion/AsignarClienteModal';
import { asociarPagoAFactura, asignarCobroACliente, lanzarAutoConciliacion } from './actions';
import { exportToXlsx } from '@/lib/exportXlsx';
import { useResizableColumns } from '@/lib/useResizableColumns';

const fmt = (v: number) => `€ ${Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
const fmtDate = (d?: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-ES') : '—';
function getQuarter(d: Date) { return Math.floor(d.getMonth() / 3) + 1; }

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

export default function ConciliacionPage() {
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [facturas, setFacturas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pendientes' | 'conciliados'>('pendientes');
  const [search, setSearch] = useState('');
  const [filterTipoMov, setFilterTipoMov] = useState<'Todos'|'Cobro'|'Pago'>('Todos');
  
  // Period filters
  const [periodMode, setPeriodMode] = useState<'libre' | 'mes' | 'trimestre' | 'año'>('libre');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selYear, setSelYear] = useState(new Date().getFullYear().toString());
  const [selMonth, setSelMonth] = useState((new Date().getMonth() + 1).toString());
  const [selQ, setSelQ] = useState('1');

  // Sort
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'fecha', direction: 'desc' });

  // Auto-conciliar state
  const [autoConciliando, setAutoConciliando] = useState(false);
  const [autoResultado, setAutoResultado] = useState<{ conciliados: number; errores: string[] } | null>(null);

  // Modals state
  const [pagoAsociando, setPagoAsociando] = useState<any | null>(null);
  const [cobroAsignando, setCobroAsignando] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { widths, onMouseDown } = useResizableColumns('cols_conciliacion', {
    tipo: 60, fecha: 100, codigo: 80, concepto: 200, beneficiario: 160, observaciones: 180, estado: 140, importe: 120, acciones: 120,
  });

  const fetchData = async () => {
    setLoading(true);
    setDbError(null);
    try {
      const { data: movs, error: movsErr } = await supabase
        .from('movimientos')
        .select('*, facturas(fecha)')
        .order('fecha', { ascending: false });

      if (movsErr) {
        if (movsErr.code === '42P01') {
          setDbError('La tabla "movimientos" no existe. Debes ejecutar el script SQL en Supabase.');
        } else {
          setDbError(movsErr.message);
        }
        setLoading(false);
        return;
      }

      setMovimientos(movs || []);

      const { data: fact } = await supabase
        .from('facturas')
        .select('id, cliente, nombre_proveedor, num_expediente, importe, tipo, estado')
        .eq('estado', 'Pendiente');
      
      if (fact) setFacturas(fact);

    } catch (err) {
      console.error(err);
      setDbError('Error de conexión con la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const years = useMemo(() => {
    const ys = new Set(movimientos.map(m => m.fecha ? new Date(m.fecha).getFullYear().toString() : '').filter(Boolean));
    const arr = Array.from(ys).sort().reverse();
    if (!arr.includes(new Date().getFullYear().toString())) arr.unshift(new Date().getFullYear().toString());
    return arr;
  }, [movimientos]);

  const filtered = useMemo(() => {
    return movimientos.filter(m => {
      const matchTab = activeTab === 'pendientes' 
        ? m.estado_conciliacion === 'Pendiente'
        : m.estado_conciliacion === 'Conciliado';
      
      const matchTipo = filterTipoMov === 'Todos' || m.tipo === filterTipoMov;
      
      const q = search.toLowerCase();
      const matchSearch = !q || m.concepto.toLowerCase().includes(q) || (m.cliente_expediente || '').toLowerCase().includes(q) || (m.beneficiario || '').toLowerCase().includes(q);

      // Period filter
      const d = m.fecha ? new Date(m.fecha) : null;
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
      
      return matchTab && matchTipo && matchSearch && matchPeriod;
    });
  }, [movimientos, activeTab, filterTipoMov, search, periodMode, dateFrom, dateTo, selYear, selMonth, selQ]);

  const sortedData = useMemo(() => {
    let items = [...filtered];
    if (sortConfig) {
      items.sort((a, b) => {
        let aVal: any, bVal: any;
        if (sortConfig.key === 'fecha') { aVal = a.fecha ? new Date(a.fecha).getTime() : 0; bVal = b.fecha ? new Date(b.fecha).getTime() : 0; }
        else if (sortConfig.key === 'importe') { aVal = Number(a.importe); bVal = Number(b.importe); }
        else { aVal = (a[sortConfig.key] || '').toLowerCase(); bVal = (b[sortConfig.key] || '').toLowerCase(); }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [filtered, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (!current || current.key !== key) return { key, direction: 'asc' };
      if (current.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  };

  const handleAsociarFactura = async (facturaId: number) => {
    if (!pagoAsociando) return;
    setIsSubmitting(true);
    await asociarPagoAFactura(pagoAsociando.id, facturaId);
    setPagoAsociando(null);
    setIsSubmitting(false);
    fetchData();
  };

  const handleAsignarCliente = async (cliente: string) => {
    if (!cobroAsignando) return;
    setIsSubmitting(true);
    await asignarCobroACliente(cobroAsignando.id, cliente);
    setCobroAsignando(null);
    setIsSubmitting(false);
    fetchData();
  };

  const handleAutoConciliar = async () => {
    setAutoConciliando(true);
    setAutoResultado(null);
    try {
      const resultado = await lanzarAutoConciliacion();
      setAutoResultado(resultado);
      await fetchData();
    } catch (err) {
      console.error(err);
      setAutoResultado({ conciliados: 0, errores: ['Error inesperado al ejecutar la conciliación.'] });
    } finally {
      setAutoConciliando(false);
    }
  };

  const handleExport = () => {
    exportToXlsx(sortedData, [
      { header: 'Tipo', key: 'tipo' },
      { header: 'Banco', key: 'banco' },
      { header: 'Fecha', key: 'fecha', format: v => v ? new Date(v).toLocaleDateString('es-ES') : '' },
      { header: 'F. Valor', key: 'f_valor', format: v => v ? new Date(v).toLocaleDateString('es-ES') : '' },
      { header: 'Código', key: 'codigo' },
      { header: 'Concepto', key: 'concepto' },
      { header: 'Beneficiario', key: 'beneficiario' },
      { header: 'Observaciones', key: 'observaciones' },
      { header: 'Estado', key: 'estado_conciliacion' },
      { header: 'Vinculado a', key: 'cliente_expediente' },
      { header: 'Importe', key: 'importe', format: v => v != null ? Number(v).toFixed(2) : '' },
    ], `Conciliacion_${activeTab}_${new Date().toISOString().slice(0,10)}`);
  };

  const totales = useMemo(() => ({
    pendientes: movimientos.filter(m => m.estado_conciliacion === 'Pendiente').length,
    conciliados: movimientos.filter(m => m.estado_conciliacion === 'Conciliado').length,
    cobros: movimientos.filter(m => m.tipo === 'Cobro').length,
    pagos: movimientos.filter(m => m.tipo === 'Pago').length,
  }), [movimientos]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <RefreshCcw className="w-8 h-8 text-indigo-500 animate-spin" />
    </div>
  );

  if (dbError) return (
    <div className="max-w-2xl mx-auto mt-12 p-8 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-3xl text-center shadow-xl">
      <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-red-700 dark:text-red-400 mb-2">Falta configuración de Base de Datos</h2>
      <p className="text-red-600 dark:text-red-300 mb-6">{dbError}</p>
      <button onClick={fetchData} className="mt-6 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-all shadow-lg flex items-center gap-2 mx-auto">
        <RefreshCcw className="w-4 h-4" /> Ya lo he ejecutado, reintentar
      </button>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <PiggyBank className="w-8 h-8 text-indigo-500" />
            Conciliación Bancaria
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Conecta y cuadra tus movimientos con facturas y clientes.</p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          {activeTab === 'pendientes' && totales.pendientes > 0 && (
            <button
              id="btn-auto-conciliar"
              onClick={handleAutoConciliar}
              disabled={autoConciliando}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {autoConciliando ? (
                <><RefreshCcw className="w-4 h-4 animate-spin" /> Analizando {totales.pendientes} pagos...</>
              ) : (
                <><Zap className="w-4 h-4" /> Auto-Conciliar</>
              )}
            </button>
          )}

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" /> Exportar XLSX
          </button>
        </div>
      </div>

      {/* Banner resultado auto-conciliación */}
      {autoResultado !== null && (
        <div className={`p-4 rounded-2xl border flex items-start gap-3 animate-in slide-in-from-top-2 duration-300 ${
          autoResultado.conciliados > 0
            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
            : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20'
        }`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            autoResultado.conciliados > 0
              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
              : 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
          }`}>
            {autoResultado.conciliados > 0 ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            {autoResultado.conciliados > 0 ? (
              <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                ✅ {autoResultado.conciliados} pago{autoResultado.conciliados !== 1 ? 's' : ''} conciliado{autoResultado.conciliados !== 1 ? 's' : ''} automáticamente
              </p>
            ) : (
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                No se encontraron coincidencias automáticas
              </p>
            )}
            {autoResultado.errores.length > 0 && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                {autoResultado.errores.length} error(es): {autoResultado.errores[0]}
              </p>
            )}
            {autoResultado.conciliados === 0 && autoResultado.errores.length === 0 && (
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                Los movimientos restantes requieren asociación manual: usa el botón &quot;Buscar Factura&quot; en cada pago.
              </p>
            )}
          </div>
          <button onClick={() => setAutoResultado(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none">×</button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex bg-gray-50 dark:bg-black/50 p-1 rounded-2xl border border-gray-200 dark:border-gray-800 shrink-0">
            {(['Todos', 'Cobro', 'Pago'] as const).map(t => (
              <button key={t} onClick={() => setFilterTipoMov(t)}
                className={`px-3 py-1.5 text-sm rounded-xl font-medium transition-all ${filterTipoMov === t ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                {t === 'Todos' ? `Todos (${movimientos.length})` : t === 'Cobro' ? `Cobros (+${totales.cobros})` : `Pagos (-${totales.pagos})`}
              </button>
            ))}
          </div>

          <div className="flex bg-gray-50 dark:bg-black/50 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-800 shrink-0">
            <button onClick={() => setActiveTab('pendientes')}
              className={`px-4 py-2 text-sm rounded-xl font-medium transition-all ${activeTab === 'pendientes' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
              Pendientes ({totales.pendientes})
            </button>
            <button onClick={() => setActiveTab('conciliados')}
              className={`px-4 py-2 text-sm rounded-xl font-medium transition-all ${activeTab === 'conciliados' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
              Conciliados ({totales.conciliados})
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-gray-500 font-medium">Período:</span>
            {(['libre','mes','trimestre','año'] as const).map(m => (
              <button key={m} onClick={() => setPeriodMode(m)}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${periodMode === m ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/20'}`}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>

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
                <option value="1">1T (Ene-Mar)</option>
                <option value="2">2T (Abr-Jun)</option>
                <option value="3">3T (Jul-Sep)</option>
                <option value="4">4T (Oct-Dic)</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          )}

          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por concepto o cliente..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm" />
          </div>
          {(search || filterTipoMov !== 'Todos' || periodMode !== 'libre' || dateFrom || dateTo) && (
            <button onClick={() => { setSearch(''); setFilterTipoMov('Todos'); setPeriodMode('libre'); setDateFrom(''); setDateTo(''); }}
              className="px-3 py-2 border border-transparent hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-gray-500 hover:text-gray-800 dark:text-gray-400 transition-colors text-sm font-medium flex items-center gap-1 shrink-0">
               Limpiar Filtros
            </button>
          )}
          <button onClick={fetchData} className="p-2 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300">
            <RefreshCcw className="w-5 h-5" />
          </button>
          <span className="text-xs text-gray-400 shrink-0">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* TABLE VIEW */}
      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="hidden md:table w-full text-left text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-gray-800 text-gray-500">
                {([
                  ['tipo', 'Tipo'],
                  ['fecha', 'Fecha'],
                  ['codigo', 'Cód.'],
                  ['concepto', 'Concepto'],
                  ['beneficiario', 'Beneficiario'],
                  ['observaciones', 'Observaciones'],
                  ['estado', 'Estado'],
                  ['importe', 'Importe'],
                  ['acciones', 'Acciones'],
                ] as [string, string][]).map(([col, label]) => (
                  <th
                    key={col}
                    onClick={col !== 'acciones' ? () => handleSort(col) : undefined}
                    style={{ minWidth: widths[col], width: widths[col] }}
                    className={`py-3 px-4 font-medium relative group/th whitespace-nowrap overflow-hidden text-ellipsis ${col !== 'acciones' ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10' : ''} transition-colors`}
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
              {sortedData.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-gray-500">
                  <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  No hay movimientos para este filtro.
                </td></tr>
              ) : (
                sortedData.map(mov => (
                  <tr key={mov.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5 transition-colors group">
                    <td className="py-3 px-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${mov.tipo === 'Cobro' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400'}`}>
                        {mov.tipo === 'Cobro' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-gray-900 dark:text-white font-medium text-xs">{fmtDate(mov.fecha)}</span>
                        {mov.f_valor && mov.f_valor !== mov.fecha && <span className="text-[10px] text-gray-400">V: {fmtDate(mov.f_valor)}</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-500 font-mono text-xs">{mov.codigo || '—'}</td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900 dark:text-white text-xs line-clamp-2">{mov.concepto}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-indigo-600 dark:text-indigo-400 font-semibold truncate">{mov.beneficiario || '—'}</td>
                    <td className="py-3 px-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{mov.observaciones || '—'}</p>
                      {mov.remesa && <p className="text-[9px] text-gray-400 mt-0.5 uppercase font-semibold">Rem: {mov.remesa}</p>}
                    </td>
                    <td className="py-3 px-4">
                      {mov.estado_conciliacion === 'Conciliado' ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 text-[10px] font-semibold w-fit">
                            <CheckCircle2 className="w-3 h-3" />
                            {mov.cliente_expediente || 'Conciliado'}
                          </span>
                          {mov.facturas?.fecha && <span className="text-[9px] text-gray-500">Fc: {fmtDate(mov.facturas.fecha)}</span>}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400 text-[10px] font-semibold">
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <p className={`font-bold text-sm whitespace-nowrap tabular-nums ${mov.tipo === 'Cobro' ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>
                        {mov.tipo === 'Cobro' ? '+' : ''}{fmt(Number(mov.importe))}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      {activeTab === 'pendientes' && (
                        <div className="shrink-0">
                          {mov.tipo === 'Pago' ? (
                            <button onClick={() => setPagoAsociando(mov)} className="px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 dark:text-indigo-300 rounded-lg font-medium text-[10px] transition-colors flex items-center gap-1 border border-indigo-200 dark:border-indigo-500/20 whitespace-nowrap">
                              <Link2 className="w-3 h-3" /> Buscar Fc.
                            </button>
                          ) : (
                            <button onClick={() => setCobroAsignando(mov)} className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:text-emerald-300 rounded-lg font-medium text-[10px] transition-colors flex items-center gap-1 border border-emerald-200 dark:border-emerald-500/20 whitespace-nowrap">
                              <UserPlus className="w-3 h-3" /> Asignar
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE VIEW */}
        <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
          {sortedData.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No hay movimientos para este filtro.</div>
          ) : (
            sortedData.map(mov => (
              <div key={`m-${mov.id}`} className="p-4 flex flex-col gap-3 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                <div className="flex justify-between items-start gap-3">
                  <div className={`w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center shadow-inner ${mov.tipo === 'Cobro' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400'}`}>
                    {mov.tipo === 'Cobro' ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white line-clamp-2 text-sm">{mov.concepto}</p>
                    <div className="flex flex-wrap gap-2 items-center mt-1">
                      <span className="text-xs text-gray-500">{fmtDate(mov.fecha)}</span>
                      {mov.beneficiario && <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold truncate">{mov.beneficiario}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-bold text-base tabular-nums ${mov.tipo === 'Cobro' ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>
                      {mov.tipo === 'Cobro' ? '+' : ''}{fmt(Number(mov.importe))}
                    </p>
                  </div>
                </div>
                <div className="ml-[52px] flex items-center justify-between gap-2">
                  {mov.estado_conciliacion === 'Conciliado' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 text-[10px] font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> {mov.cliente_expediente || 'Conciliado'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400 text-[10px] font-semibold">Pendiente</span>
                  )}
                  {activeTab === 'pendientes' && mov.tipo === 'Pago' && (
                    <button onClick={() => setPagoAsociando(mov)} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-semibold flex items-center gap-1">
                      <Link2 className="w-3 h-3" /> Buscar Fc.
                    </button>
                  )}
                  {activeTab === 'pendientes' && mov.tipo === 'Cobro' && (
                    <button onClick={() => setCobroAsignando(mov)} className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md text-[10px] font-semibold flex items-center gap-1">
                      <UserPlus className="w-3 h-3" /> Asignar
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {pagoAsociando && (
        <AsociarFacturaModal
          movimiento={pagoAsociando}
          facturas={facturas}
          isSubmitting={isSubmitting}
          onConfirm={handleAsociarFactura}
          onCancel={() => setPagoAsociando(null)}
        />
      )}

      {cobroAsignando && (
        <AsignarClienteModal
          movimiento={cobroAsignando}
          isSubmitting={isSubmitting}
          onConfirm={handleAsignarCliente}
          onCancel={() => setCobroAsignando(null)}
        />
      )}
    </div>
  );
}
