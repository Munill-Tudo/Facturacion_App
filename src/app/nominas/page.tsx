'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import {
  Users, Plus, RefreshCcw, Search, AlertCircle, CheckCircle2,
  Calendar, Link2, Unlink, Pencil, Trash2, X, Save, TrendingDown,
  Clock, ScanSearch, Download, GripVertical
} from 'lucide-react';
import {
  crearNomina, actualizarNomina, eliminarNomina,
  vincularMovimientoNomina, desvincularMovimientoNomina,
  NominaInput
} from './actions';
import { exportToXlsx } from '@/lib/exportXlsx';
import { useResizableColumns } from '@/lib/useResizableColumns';

/* ─── helpers ─── */
const fmt = (v: number) =>
  `€ ${Math.abs(Number(v)).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
const fmtDate = (d?: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('es-ES') : '—';

const ESTADO_COLORS: Record<string, string> = {
  Pagado: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20',
  Conciliado: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
};

/* ─── SQL for setup ─── */
const SETUP_SQL = `CREATE TABLE IF NOT EXISTS public.nominas (
  id uuid default gen_random_uuid() primary key,
  empleado text not null,
  periodo text not null,
  importe numeric not null,
  fecha_pago date not null,
  estado text not null default 'Conciliado'
    check (estado in ('Pagado','Conciliado')),
  movimiento_id bigint references public.movimientos(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.nominas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nominas_all" ON public.nominas FOR ALL USING (true);`;

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

/* ═══════════════════════════════════════════════════
   MODAL: Crear / Editar Nómina
═══════════════════════════════════════════════════ */
function NominaModal({
  initial, onSave, onClose, isSaving,
}: {
  initial?: any; onSave: (data: NominaInput) => void; onClose: () => void; isSaving: boolean;
}) {
  const [form, setForm] = useState<NominaInput>({
    empleado: initial?.empleado ?? '',
    periodo: initial?.periodo ?? '',
    importe: initial?.importe ?? '',
    fecha_pago: initial?.fecha_pago ?? '',
  } as any);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const isEdit = !!initial;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-[#0f0f0f] rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom-4 duration-300 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{isEdit ? 'Editar Nómina' : 'Nueva Nómina'}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Empleado *</label>
            <input value={form.empleado} onChange={e => set('empleado', e.target.value)} placeholder="ej: LAURA GARCIA MORAL"
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Período *</label>
              <input value={form.periodo} onChange={e => set('periodo', e.target.value)} placeholder="ej: MARZO 2026"
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Importe (€) *</label>
              <input type="number" step="0.01" value={form.importe} onChange={e => set('importe', e.target.value)} placeholder="0.00"
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Fecha Pago *</label>
            <input type="date" value={form.fecha_pago} onChange={e => set('fecha_pago', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 font-medium text-sm transition-colors">Cancelar</button>
          <button
            onClick={() => { if (!form.empleado || !form.periodo || !form.importe || !form.fecha_pago) return; onSave({ ...form, importe: Number(form.importe) }); }}
            disabled={isSaving || !form.empleado || !form.periodo || !form.importe || !form.fecha_pago}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50 text-sm">
            {isSaving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? 'Guardar Cambios' : 'Añadir Nómina'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MODAL: Vincular Movimiento
═══════════════════════════════════════════════════ */
function VincularModal({
  nomina, movimientos, onVincular, onClose, isSaving,
}: {
  nomina: any; movimientos: any[]; onVincular: (movimientoId: number) => void; onClose: () => void; isSaving: boolean;
}) {
  const [search, setSearch] = useState('');
  const importAbs = Math.abs(Number(nomina.importe));

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return movimientos
      .filter(m => m.estado_conciliacion === 'Pendiente')
      .filter(m => !q || m.concepto.toLowerCase().includes(q) || String(Math.abs(Number(m.importe))).includes(q) || (m.observaciones || '').toLowerCase().includes(q))
      .sort((a, b) => {
        const aMatch = Math.abs(Number(a.importe)) === importAbs;
        const bMatch = Math.abs(Number(b.importe)) === importAbs;
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      });
  }, [movimientos, search, importAbs]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-[#0f0f0f] rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Link2 className="w-5 h-5 text-indigo-500" /> Vincular Movimiento Bancario
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">Nómina a favor de {nomina.empleado} — {fmt(nomina.importe)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por concepto o importe..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm" />
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto px-4 py-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">No hay movimientos pendientes de conciliar</div>
          ) : (
            filtered.map(mov => {
              const match = Math.abs(Number(mov.importe)) === importAbs;
              return (
                <button key={mov.id} onClick={() => onVincular(mov.id)} disabled={isSaving}
                  className={`w-full text-left p-3 rounded-xl border transition-all hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5 group ${
                    match ? 'border-indigo-200 dark:border-indigo-700 bg-indigo-50/30 dark:bg-indigo-500/5' : 'border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/2'
                  }`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        {match && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 shrink-0">✓ Coincide</span>}
                        <span className="text-xs text-gray-500">{fmtDate(mov.fecha)}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{mov.concepto}</p>
                      {mov.observaciones && <p className="text-xs text-gray-500 truncate mt-0.5">{mov.observaciones}</p>}
                    </div>
                    <span className={`text-sm font-bold tabular-nums shrink-0 ${Number(mov.importe) < 0 ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {fmt(mov.importe)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 font-medium text-sm transition-colors">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PAGE PRINCIPAL
═══════════════════════════════════════════════════ */
export default function NominasPage() {
  const { role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (role && role !== 'direccion') router.replace('/facturas');
  }, [role, router]);

  const [nominas, setNominas] = useState<any[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState<'Todos' | 'Pagado' | 'Conciliado'>('Todos');

  // Sort
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'fecha_pago', direction: 'desc' });

  // Modals
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { widths, onMouseDown } = useResizableColumns('cols_nominas', {
    empleado: 200, periodo: 120, fecha_pago: 100, importe: 100, estado: 100, movimiento: 180, acciones: 120,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setDbError(null);
    try {
      const [{ data: nom, error: errNom }, { data: movs }] = await Promise.all([
        supabase.from('nominas').select('*').order('fecha_pago', { ascending: false }),
        supabase.from('movimientos').select('id, banco, fecha, concepto, observaciones, importe, estado_conciliacion').order('fecha', { ascending: false }),
      ]);

      if (errNom) {
        if (errNom.code === '42P01') setDbError('La tabla "nominas" no existe. Ejecuta el SQL de configuración en Supabase.');
        else setDbError(errNom.message);
        setLoading(false);
        return;
      }

      setNominas(nom || []);
      setMovimientos(movs || []);
    } catch {
      setDbError('Error de conexión con la base de datos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Computed stats
  const stats = useMemo(() => {
    const year = new Date().getFullYear();
    return {
      pagadoAnio: nominas.filter(n => new Date(n.fecha_pago).getFullYear() === year).reduce((s, n) => s + Number(n.importe), 0),
      sinConciliar: nominas.filter(n => n.estado === 'Pagado').length,
      totalItems: nominas.length,
    };
  }, [nominas]);

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return nominas.filter(n => {
      if (filterEstado !== 'Todos' && n.estado !== filterEstado) return false;
      if (q && !n.empleado.toLowerCase().includes(q) && !n.periodo.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [nominas, filterEstado, search]);

  // Sorted list
  const sortedData = useMemo(() => {
    let items = [...filtered];
    if (sortConfig) {
      items.sort((a, b) => {
        let aVal: any, bVal: any;
        if (sortConfig.key === 'fecha_pago') {
          aVal = a.fecha_pago ? new Date(a.fecha_pago).getTime() : 0;
          bVal = b.fecha_pago ? new Date(b.fecha_pago).getTime() : 0;
        } else if (sortConfig.key === 'importe') {
          aVal = Number(a.importe); bVal = Number(b.importe);
        } else {
          aVal = (a[sortConfig.key] || '').toLowerCase(); bVal = (b[sortConfig.key] || '').toLowerCase();
        }
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

  // Handlers
  const handleSave = async (data: NominaInput) => {
    setIsSaving(true);
    try {
      if (editing) { await actualizarNomina(editing.id, data); setEditing(null); }
      else { await crearNomina(data); setShowNew(false); }
      await fetchData();
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    await eliminarNomina(deletingId);
    setDeletingId(null);
    await fetchData();
  };

  const handleVincular = async (movimientoId: number) => {
    if (!vinculando) return;
    setIsSaving(true);
    try { await vincularMovimientoNomina(vinculando.id, movimientoId); setVinculando(null); await fetchData(); }
    finally { setIsSaving(false); }
  };

  const handleDesvincular = async (nom: any) => {
    if (!nom.movimiento_id) return;
    await desvincularMovimientoNomina(nom.id, Number(nom.movimiento_id));
    await fetchData();
  };

  const handleExport = () => {
    exportToXlsx(sortedData, [
      { header: 'Empleado', key: 'empleado' },
      { header: 'Período', key: 'periodo' },
      { header: 'Fecha Pago', key: 'fecha_pago', format: v => fmtDate(v) },
      { header: 'Importe', key: 'importe', format: v => v != null ? Number(v).toFixed(2) : '' },
      { header: 'Estado', key: 'estado' },
    ], `Nominas_${new Date().toISOString().slice(0,10)}`);
  };

  if (role && role !== 'direccion') return null;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <RefreshCcw className="w-8 h-8 text-indigo-500 animate-spin" />
    </div>
  );

  if (dbError) return (
    <div className="max-w-2xl mx-auto mt-12 p-8 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-3xl text-center shadow-xl">
      <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-red-700 dark:text-red-400 mb-2">Tabla no configurada</h2>
      <p className="text-red-600 dark:text-red-300 mb-6">{dbError}</p>
      <div className="bg-white dark:bg-black/40 p-4 rounded-xl text-left border border-red-100 dark:border-red-900 overflow-x-auto mb-6">
        <p className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Ejecuta esto en el SQL Editor de Supabase:</p>
        <code className="text-xs text-gray-600 dark:text-gray-400 block whitespace-pre">{SETUP_SQL}</code>
      </div>
      <button onClick={fetchData} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-all shadow-lg flex items-center gap-2 mx-auto">
        <RefreshCcw className="w-4 h-4" /> Ya lo he ejecutado, reintentar
      </button>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-500" />
            Nóminas
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Control de pagos de empleados auto-escaneados desde el banco.</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => router.push('/conciliacion')}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition-all text-sm">
            <ScanSearch className="w-4 h-4" /> Ir a Conciliación (Auto-Escanear)
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 rounded-xl transition-colors">
            <Download className="w-4 h-4" /> Exportar XLSX
          </button>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 font-bold rounded-xl shadow-lg transition-all text-sm">
            <Plus className="w-4 h-4" /> Añadir Nómina Manual
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={<TrendingDown className="w-5 h-5" />} label={`Pagado en ${new Date().getFullYear()}`} value={fmt(stats.pagadoAnio)} color="violet" />
        <StatCard icon={<Link2 className="w-5 h-5" />} label="Sin Conciliar" value={String(stats.sinConciliar)} color="blue" suffix={stats.sinConciliar > 0 ? 'nóminas' : '✓ Todas vinculadas al banco'} />
        <StatCard icon={<Users className="w-5 h-5" />} label="Total Registros" value={String(stats.totalItems)} color="indigo" />
      </div>

      {/* ── Filtros ── */}
      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por empleado o período..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm" />
        </div>
        <div className="flex bg-gray-50 dark:bg-black/50 p-1 rounded-2xl border border-gray-200 dark:border-gray-800">
          {(['Todos', 'Pagado', 'Conciliado'] as const).map(e => (
            <button key={e} onClick={() => setFilterEstado(e)}
              className={`px-3 py-1.5 text-xs rounded-xl font-medium transition-all ${filterEstado === e ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
              {e}
            </button>
          ))}
        </div>
        {(search || filterEstado !== 'Todos') && (
          <button onClick={() => { setSearch(''); setFilterEstado('Todos'); }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-800 font-medium hover:bg-gray-100 rounded-xl transition-colors">Limpiar</button>
        )}
        <button onClick={fetchData} className="p-2 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 ml-auto">
          <RefreshCcw className="w-5 h-5" />
        </button>
      </div>

      {/* ── TABLE ── */}
      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="hidden md:table w-full text-left text-sm border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-gray-800 text-gray-500">
                {([
                  ['empleado', 'Empleado'],
                  ['periodo', 'Período'],
                  ['fecha_pago', 'F. Pago'],
                  ['importe', 'Importe'],
                  ['estado', 'Estado'],
                  ['movimiento', 'Mov. Vinculado'],
                  ['acciones', 'Acciones'],
                ] as [string, string][]).map(([col, label]) => (
                  <th key={col}
                    onClick={col !== 'acciones' && col !== 'movimiento' ? () => handleSort(col) : undefined}
                    style={{ minWidth: widths[col], width: widths[col] }}
                    className={`py-3 px-4 font-medium relative group/th whitespace-nowrap overflow-hidden text-ellipsis ${col !== 'acciones' && col !== 'movimiento' ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10' : ''} transition-colors`}>
                    <div className="flex items-center gap-1">
                      {label}
                      {sortConfig?.key === col && <span className="text-xs text-indigo-500">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>}
                    </div>
                    <ResizeHandle col={col} onMouseDown={onMouseDown} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sortedData.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-gray-500">
                  <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  No hay nóminas para este filtro.
                </td></tr>
              ) : (
                sortedData.map(nom => {
                  const mov = movimientos.find(m => m.id === nom.movimiento_id);
                  return (
                    <tr key={nom.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5 transition-colors group">
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-white text-xs truncate">{nom.empleado}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{nom.periodo}</td>
                      <td className="py-3 px-4 text-gray-700 dark:text-gray-300 text-xs">{fmtDate(nom.fecha_pago)}</td>
                      <td className="py-3 px-4 font-bold text-gray-900 dark:text-white text-xs tabular-nums">{fmt(nom.importe)}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold ${ESTADO_COLORS[nom.estado]}`}>{nom.estado}</span>
                      </td>
                      <td className="py-3 px-4">
                        {mov ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium truncate flex-1">
                              {mov.concepto?.substring(0, 30)}... — {fmtDate(mov.fecha)}
                            </span>
                            <button onClick={() => handleDesvincular(nom)} title="Desvincular"
                              className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors shrink-0">
                              <Unlink className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          {nom.estado !== 'Conciliado' && !nom.movimiento_id && (
                            <button onClick={() => setVinculando(nom)} title="Vincular" className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 transition-colors">
                              <Link2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => setEditing(nom)} title="Editar" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 hover:text-gray-700 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeletingId(nom.id)} title="Eliminar" className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE VIEW */}
        <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
          {sortedData.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">No hay nóminas registradas.</div>
          ) : (
            sortedData.map(nom => {
              const mov = movimientos.find(m => m.id === nom.movimiento_id);
              return (
                <div key={`m-${nom.id}`} className="p-4 flex flex-col gap-2 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold ${ESTADO_COLORS[nom.estado]}`}>{nom.estado}</span>
                        <span className="text-xs text-gray-500">{nom.periodo}</span>
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{nom.empleado}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Pago: {fmtDate(nom.fecha_pago)}</p>
                    </div>
                    <p className="font-bold text-gray-900 dark:text-white text-base tabular-nums shrink-0">{fmt(nom.importe)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {mov && <span className="text-[10px] text-emerald-700 truncate flex-1">🔗 {mov.concepto?.substring(0, 40)}</span>}
                    <div className="flex gap-1 shrink-0 ml-auto">
                      {nom.estado !== 'Conciliado' && !nom.movimiento_id && (
                        <button onClick={() => setVinculando(nom)} className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600"><Link2 className="w-3.5 h-3.5" /></button>
                      )}
                      <button onClick={() => setEditing(nom)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeletingId(nom.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {(showNew || editing) && <NominaModal initial={editing} onSave={handleSave} onClose={() => { setShowNew(false); setEditing(null); }} isSaving={isSaving} />}
      {vinculando && <VincularModal nomina={vinculando} movimientos={movimientos} onVincular={handleVincular} onClose={() => setVinculando(null)} isSaving={isSaving} />}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-[#0f0f0f] rounded-2xl p-6">
            <h3 className="text-lg font-bold text-center mb-2">¿Eliminar nómina?</h3>
            <p className="text-sm text-center text-gray-500 mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingId(null)} className="flex-1 py-2 rounded-xl border text-sm font-medium">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-bold">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color, suffix }: {
  icon: React.ReactNode; label: string; value: string; color: string; suffix?: string;
}) {
  const colors: Record<string, string> = {
    violet: 'from-violet-500 to-purple-600',
    blue: 'from-blue-500 to-cyan-500',
    indigo: 'from-indigo-500 to-blue-600',
  };
  return (
    <div className="bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white mb-3 shadow-lg shadow-${color}-500/20`}>{icon}</div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {suffix && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{suffix}</p>}
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}
