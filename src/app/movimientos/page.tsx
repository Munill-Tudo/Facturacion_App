'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PiggyBank, RefreshCcw, Search, UploadCloud, ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronDown, Download, Pencil } from 'lucide-react';
import { ImportadorCSVModal } from '@/components/movimientos/ImportadorCSVModal';
import { EditarMovimientoModal } from '@/components/movimientos/EditarMovimientoModal';
import { exportToXlsx } from '@/lib/exportXlsx';

const fmt = (v: number) => `€ ${Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
function getQuarter(d: Date) { return Math.floor(d.getMonth() / 3) + 1; }
function parseBool(value: any) { return value === true || value === 'true' || value === 't' || value === 1 || value === '1'; }

export default function MovimientosPage() {
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTipoMov, setFilterTipoMov] = useState<'Todos'|'Cobro'|'Pago'>('Todos');
  const [showImporter, setShowImporter] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [editingMovimiento, setEditingMovimiento] = useState<any | null>(null);

  const [periodMode, setPeriodMode] = useState<'libre' | 'mes' | 'trimestre' | 'año'>('libre');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selYear, setSelYear] = useState(new Date().getFullYear().toString());
  const [selMonth, setSelMonth] = useState((new Date().getMonth() + 1).toString());
  const [selQ, setSelQ] = useState('1');

  const fetchMovimientos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('movimientos')
      .select('*, facturas(fecha)')
      .order('fecha', { ascending: false });

    setMovimientos(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchMovimientos(); }, []);

  const handleImportSuccess = (msg: string) => {
    setShowImporter(false);
    setSuccessMsg(msg);
    fetchMovimientos();
    setTimeout(() => setSuccessMsg(null), 8000);
  };

  const handleEditSaved = async () => {
    setEditingMovimiento(null);
    setSuccessMsg('Movimiento actualizado y bandeja operativa sincronizada.');
    await fetchMovimientos();
    setTimeout(() => setSuccessMsg(null), 6000);
  };

  const years = useMemo(() => {
    const ys = new Set(movimientos.map(m => m.fecha ? new Date(m.fecha).getFullYear().toString() : '').filter(Boolean));
    const arr = Array.from(ys).sort().reverse();
    if (!arr.includes(new Date().getFullYear().toString())) arr.unshift(new Date().getFullYear().toString());
    return arr;
  }, [movimientos]);

  const filtered = useMemo(() => movimientos.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || (m.concepto || '').toLowerCase().includes(q) || (m.cliente_expediente || '').toLowerCase().includes(q) || (m.beneficiario || '').toLowerCase().includes(q);
    const matchTipo = filterTipoMov === 'Todos' || m.tipo === filterTipoMov;
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
    return matchSearch && matchTipo && matchPeriod;
  }), [movimientos, search, filterTipoMov, periodMode, dateFrom, dateTo, selYear, selMonth, selQ]);

  const countTodos = movimientos.length;
  const countCobros = movimientos.filter(m => m.tipo === 'Cobro').length;
  const countPagos = movimientos.filter(m => m.tipo === 'Pago').length;

  const handleExport = () => {
    exportToXlsx(filtered, [
      { header: 'Tipo', key: 'tipo' },
      { header: 'Fecha', key: 'fecha', format: v => v ? new Date(v).toLocaleDateString('es-ES') : '' },
      { header: 'F. Valor', key: 'f_valor', format: v => v ? new Date(v).toLocaleDateString('es-ES') : '' },
      { header: 'Ref. RF', key: 'referencia_rf' },
      { header: 'Código', key: 'codigo' },
      { header: 'Concepto', key: 'concepto' },
      { header: 'Beneficiario', key: 'beneficiario' },
      { header: 'Observaciones', key: 'observaciones' },
      { header: 'Remesa', key: 'remesa' },
      { header: 'Banco', key: 'banco' },
      { header: 'Importe', key: 'importe', format: v => v != null ? Number(v).toFixed(2) : '' },
      { header: 'Estado', key: 'estado_conciliacion' },
    ], `Movimientos_Bancarios_${new Date().toISOString().slice(0,10)}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3"><PiggyBank className="w-8 h-8 text-indigo-500" />Historial de Movimientos</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">El libro mayor de todas tus cuentas bancarias. Sube los extractos aquí.</p>
        </div>
        <div className="shrink-0 flex items-center gap-3 flex-wrap justify-end">
          <button onClick={() => setShowImporter(true)} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 font-bold text-sm"><UploadCloud className="w-4 h-4" /> Importar CSV (BBVA)</button>
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 rounded-xl transition-colors"><Download className="w-4 h-4" /> Exportar XLSX</button>
        </div>
      </div>

      {successMsg && <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-emerald-700 dark:text-emerald-400 font-medium flex gap-2 items-center"><CheckCircle2 className="w-5 h-5 shrink-0" />{successMsg}</div>}

      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex bg-gray-50 dark:bg-black/50 p-1 rounded-2xl border border-gray-200 dark:border-gray-800 shrink-0">
            {([['Todos', `Todos (${countTodos})`], ['Cobro', `Cobros (${countCobros})`], ['Pago', `Pagos (${countPagos})`]] as const).map(([val, label]) => (
              <button key={val} onClick={() => setFilterTipoMov(val as any)} className={`px-3 py-1.5 text-sm rounded-xl font-medium transition-all ${filterTipoMov === val ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>{label}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-gray-500 font-medium">Período:</span>
            {(['libre','mes','trimestre','año'] as const).map(m => <button key={m} onClick={() => setPeriodMode(m)} className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${periodMode === m ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/20'}`}>{m.charAt(0).toUpperCase() + m.slice(1)}</button>)}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {periodMode === 'libre' && <><div className="flex items-center gap-2 text-sm"><span className="text-gray-500 text-xs">Desde:</span><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30" /></div><div className="flex items-center gap-2 text-sm"><span className="text-gray-500 text-xs">Hasta:</span><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30" /></div></>}
          {(periodMode === 'mes' || periodMode === 'trimestre' || periodMode === 'año') && <div className="relative"><select value={selYear} onChange={e => setSelYear(e.target.value)} className="pl-3 pr-8 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 appearance-none">{years.map(y => <option key={y} value={y}>{y}</option>)}</select><ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" /></div>}
          {periodMode === 'mes' && <div className="relative"><select value={selMonth} onChange={e => setSelMonth(e.target.value)} className="pl-3 pr-8 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 appearance-none">{['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m,i) => <option key={i+1} value={(i+1).toString()}>{m}</option>)}</select><ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" /></div>}
          {periodMode === 'trimestre' && <div className="relative"><select value={selQ} onChange={e => setSelQ(e.target.value)} className="pl-3 pr-8 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 appearance-none"><option value="1">1T (Ene-Mar)</option><option value="2">2T (Abr-Jun)</option><option value="3">3T (Jul-Sep)</option><option value="4">4T (Oct-Dic)</option></select><ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" /></div>}
          <div className="relative flex-1 min-w-[180px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por concepto o cliente..." className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm" /></div>
          <button onClick={fetchMovimientos} className="p-2 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300"><RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin text-indigo-500' : ''}`} /></button>
          <span className="text-xs text-gray-400 shrink-0">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="hidden md:table w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-gray-800 text-gray-500"><tr><th className="px-6 py-4 font-semibold shrink-0 w-16">Tipo</th><th className="px-6 py-4 font-semibold whitespace-nowrap">Fechas</th><th className="px-6 py-4 font-semibold">Ref. RF / Cód.</th><th className="px-6 py-4 font-semibold">Concepto / Beneficiario</th><th className="px-6 py-4 font-semibold">Observaciones / Detalles</th><th className="px-6 py-4 font-semibold">Estado</th><th className="px-6 py-4 font-semibold text-right">Importe</th><th className="px-6 py-4 font-semibold text-right">Acciones</th></tr></thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {loading && movimientos.length === 0 ? <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500">Cargando movimientos...</td></tr> : filtered.length === 0 ? <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500">No hay movimientos todavía. ¡Importa tu primer CSV!</td></tr> : filtered.map(mov => (
                <tr key={mov.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-3"><div className={`w-8 h-8 rounded-lg flex items-center justify-center ${mov.tipo === 'Cobro' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400'}`}>{mov.tipo === 'Cobro' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}</div></td>
                  <td className="px-6 py-4 whitespace-nowrap"><div className="flex flex-col gap-0.5"><span className="text-gray-900 dark:text-white font-medium text-sm">{new Date(mov.fecha).toLocaleDateString('es-ES')}</span>{mov.f_valor && <span className="text-xs text-gray-400">Val: {new Date(mov.f_valor).toLocaleDateString('es-ES')}</span>}{parseBool(mov.fecha_dudosa) && <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Fecha dudosa</span>}</div></td>
                  <td className="px-6 py-4 font-mono text-xs">{mov.referencia_rf && <p className="font-bold text-indigo-600 dark:text-indigo-400 mb-1">{mov.referencia_rf}</p>}<p className="text-gray-500 dark:text-gray-400">{mov.codigo || '-'}</p></td>
                  <td className="px-6 py-4"><p className="font-medium text-gray-900 dark:text-white line-clamp-1">{mov.concepto}</p>{mov.beneficiario && <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-1">{mov.beneficiario}</p>}</td>
                  <td className="px-6 py-4"><p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 min-w-[150px]">{mov.observaciones || '-'}</p>{mov.remesa && <p className="text-[10px] text-gray-400 mt-1 uppercase font-semibold">Remesa: {mov.remesa}</p>}{mov.oficina && <p className="text-[10px] text-gray-400 mt-0.5 uppercase">Sucursal: {mov.oficina}</p>}</td>
                  <td className="px-6 py-4">{mov.estado_conciliacion === 'Conciliado' ? <div className="flex flex-col gap-1 items-start"><span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 text-xs font-semibold"><CheckCircle2 className="w-3.5 h-3.5" />{mov.cliente_expediente || 'Conciliado'}</span>{mov.facturas?.fecha && <span className="text-[10px] text-gray-500 font-medium">Fc: {new Date(mov.facturas.fecha).toLocaleDateString('es-ES')}</span>}</div> : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400 text-xs font-semibold">Pendiente</span>}</td>
                  <td className="px-6 py-4 text-right"><p className={`font-bold text-base whitespace-nowrap ${mov.tipo === 'Cobro' ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>{mov.tipo === 'Cobro' ? '+' : ''}{fmt(Number(mov.importe))}</p></td>
                  <td className="px-6 py-4 text-right"><button onClick={() => setEditingMovimiento(mov)} className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"><Pencil className="w-3.5 h-3.5" />Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-gray-50 dark:divide-gray-800/60">
          {loading && movimientos.length === 0 ? <div className="p-8 text-center text-gray-500 text-sm">Cargando movimientos...</div> : filtered.length === 0 ? <div className="p-8 text-center text-gray-500 text-sm">No hay movimientos todavía.</div> : filtered.map(mov => (
            <div key={`m-${mov.id}`} className="p-4 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors flex flex-col gap-3 group">
              <div className="flex justify-between items-start gap-3">
                <div className={`w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center shadow-inner ${mov.tipo === 'Cobro' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400'}`}>{mov.tipo === 'Cobro' ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}</div>
                <div className="flex-1 min-w-0 pt-0.5"><p className="font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug">{mov.concepto}</p><div className="flex flex-wrap gap-2 items-center mt-1"><span className="text-gray-900 dark:text-white font-medium text-xs">{new Date(mov.fecha).toLocaleDateString('es-ES')}</span>{mov.beneficiario && <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold truncate bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded-md">{mov.beneficiario}</span>}{parseBool(mov.fecha_dudosa) && <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Fecha dudosa</span>}</div></div>
                <div className="text-right shrink-0 pt-0.5"><p className={`font-bold text-base tabular-nums ${mov.tipo === 'Cobro' ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>{mov.tipo === 'Cobro' ? '+' : ''}{fmt(Number(mov.importe))}</p></div>
              </div>
              <div className="ml-[52px] flex flex-col gap-2">{mov.observaciones && <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 bg-gray-50 dark:bg-[#1a1a1a] p-2 rounded-xl border border-gray-100 dark:border-gray-800">{mov.observaciones}</p>}<div className="flex flex-wrap items-center justify-between gap-2 mt-1"><div className="flex items-center gap-2">{mov.estado_conciliacion === 'Conciliado' ? <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 text-[10px] font-semibold"><CheckCircle2 className="w-3 h-3" />{mov.cliente_expediente || 'Conciliado'}</span> : <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400 text-[10px] font-semibold">Pendiente</span>}{mov.referencia_rf && <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold text-[10px]">RF: {mov.referencia_rf}</span>}{mov.codigo && <span className="text-gray-400 dark:text-gray-500 font-mono text-[10px]">Cód: {mov.codigo}</span>}</div>{mov.remesa && <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Remesa: {mov.remesa}</span>}</div><div className="flex justify-end pt-1"><button onClick={() => setEditingMovimiento(mov)} className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"><Pencil className="w-3.5 h-3.5" />Editar</button></div></div>
            </div>
          ))}
        </div>
      </div>

      {showImporter && <ImportadorCSVModal onComplete={handleImportSuccess} onCancel={() => setShowImporter(false)} />}
      {editingMovimiento && <EditarMovimientoModal movimiento={editingMovimiento} onClose={() => setEditingMovimiento(null)} onSaved={handleEditSaved} />}
    </div>
  );
}
