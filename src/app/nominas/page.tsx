'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import {
  Users, Plus, RefreshCcw, Search, AlertCircle, CheckCircle2,
  Calendar, Link2, Unlink, Pencil, Trash2, X, Save, TrendingDown,
  Clock, ScanSearch
} from 'lucide-react';
import {
  crearNomina, actualizarNomina, eliminarNomina,
  vincularMovimientoNomina, desvincularMovimientoNomina,
  NominaInput
} from './actions';

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

/* ═══════════════════════════════════════════════════
   MODAL: Crear / Editar Nómina
═══════════════════════════════════════════════════ */
function NominaModal({
  initial,
  onSave,
  onClose,
  isSaving,
}: {
  initial?: any;
  onSave: (data: NominaInput) => void;
  onClose: () => void;
  isSaving: boolean;
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
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {isEdit ? 'Editar Nómina' : 'Nueva Nómina'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Empleado */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
              Empleado *
            </label>
            <input
              value={form.empleado}
              onChange={e => set('empleado', e.target.value)}
              placeholder="ej: LAURA GARCIA MORAL"
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm"
            />
          </div>

          {/* Período + Importe */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                Período *
              </label>
              <input
                value={form.periodo}
                onChange={e => set('periodo', e.target.value)}
                placeholder="ej: MARZO 2026"
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                Importe (€) *
              </label>
              <input
                type="number"
                step="0.01"
                value={form.importe}
                onChange={e => set('importe', e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm"
              />
            </div>
          </div>

          {/* Fecha Pago */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
              Fecha Pago *
            </label>
            <input
              type="date"
              value={form.fecha_pago}
              onChange={e => set('fecha_pago', e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 font-medium text-sm transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!form.empleado || !form.periodo || !form.importe || !form.fecha_pago) return;
              onSave({ ...form, importe: Number(form.importe) });
            }}
            disabled={isSaving || !form.empleado || !form.periodo || !form.importe || !form.fecha_pago}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50 text-sm"
          >
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
  nomina,
  movimientos,
  onVincular,
  onClose,
  isSaving,
}: {
  nomina: any;
  movimientos: any[];
  onVincular: (movimientoId: number) => void;
  onClose: () => void;
  isSaving: boolean;
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
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Link2 className="w-5 h-5 text-indigo-500" />
              Vincular Movimiento Bancario
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Nómina a favor de {nomina.empleado} — {fmt(nomina.importe)}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por concepto o importe..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm"
            />
          </div>
        </div>

        {/* Lista movimientos */}
        <div className="max-h-80 overflow-y-auto px-4 py-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">
              No hay movimientos pendientes de conciliar
            </div>
          ) : (
            filtered.map(mov => {
              const match = Math.abs(Number(mov.importe)) === importAbs;
              return (
                <button
                  key={mov.id}
                  onClick={() => onVincular(mov.id)}
                  disabled={isSaving}
                  className={`w-full text-left p-3 rounded-xl border transition-all hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5 group ${
                    match
                      ? 'border-indigo-200 dark:border-indigo-700 bg-indigo-50/30 dark:bg-indigo-500/5'
                      : 'border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/2'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        {match && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 shrink-0">
                            ✓ Coincide
                          </span>
                        )}
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
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 font-medium text-sm transition-colors">
            Cancelar
          </button>
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

  // Modals
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setDbError(null);
    try {
      const [{ data: nom, error: errNom }, { data: movs }] = await Promise.all([
        supabase.from('nominas').select('*').order('fecha_pago', { ascending: false }),
        supabase.from('movimientos').select('id, banco, fecha, concepto, observaciones, importe, estado_conciliacion').order('fecha', { ascending: false }),
      ]);

      if (errNom) {
        if (errNom.code === '42P01') {
          setDbError('La tabla "nominas" no existe. Ejecuta el SQL de configuración en Supabase.');
        } else {
          setDbError(errNom.message);
        }
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
      pagadoAnio: nominas
        .filter(n => new Date(n.fecha_pago).getFullYear() === year)
        .reduce((s, n) => s + Number(n.importe), 0),
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

  // Handlers
  const handleSave = async (data: NominaInput) => {
    setIsSaving(true);
    try {
      if (editing) {
        await actualizarNomina(editing.id, data);
        setEditing(null);
      } else {
        await crearNomina(data);
        setShowNew(false);
      }
      await fetchData();
    } finally {
      setIsSaving(false);
    }
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
    try {
      await vincularMovimientoNomina(vinculando.id, movimientoId);
      setVinculando(null);
      await fetchData();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDesvincular = async (nom: any) => {
    if (!nom.movimiento_id) return;
    await desvincularMovimientoNomina(nom.id, Number(nom.movimiento_id));
    await fetchData();
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
          <button
            onClick={() => router.push('/conciliacion')}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition-all text-sm"
          >
            <ScanSearch className="w-4 h-4" /> Ir a Conciliación (Auto-Escanear)
          </button>

          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 font-bold rounded-xl shadow-lg transition-all text-sm"
          >
            <Plus className="w-4 h-4" /> Añadir Nómina Manual
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={<TrendingDown className="w-5 h-5" />} label={`Pagado en ${new Date().getFullYear()}`} value={fmt(stats.pagadoAnio)} color="violet" />
        <StatCard icon={<Link2 className="w-5 h-5" />} label="Sin Conciliar" value={String(stats.sinConciliar)} color="blue" suffix={stats.sinConciliar > 0 ? 'nóminas' : '✓ Todas vinculadas al banco'} />
        <StatCard icon={<Users className="w-5 h-5" />} label="Total Registros" value={String(stats.totalItems)} color="indigo" />
      </div>

      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por empleado o período..." className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm" />
        </div>

        <div className="flex bg-gray-50 dark:bg-black/50 p-1 rounded-2xl border border-gray-200 dark:border-gray-800">
          {(['Todos', 'Pagado', 'Conciliado'] as const).map(e => (
            <button key={e} onClick={() => setFilterEstado(e)} className={`px-3 py-1.5 text-xs rounded-xl font-medium transition-all ${filterEstado === e ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
              {e}
            </button>
          ))}
        </div>

        {(search || filterEstado !== 'Todos') && (
          <button onClick={() => { setSearch(''); setFilterEstado('Todos'); }} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-800 font-medium hover:bg-gray-100 rounded-xl transition-colors">Limpiar</button>
        )}
        <button onClick={fetchData} className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 ml-auto"><RefreshCcw className="w-5 h-5" /></button>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 rounded-3xl border-dashed">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">No hay nóminas registradas</p>
            <p className="text-sm mb-6">Se autogeneran al pulsar el botón "Ver Auto-Conciliación" (desde la pantalla de Conciliación) o puedes añadir manuales.</p>
          </div>
        ) : (
          filtered.map(nom => (
            <NominaRow
              key={nom.id}
              nom={nom}
              movimientos={movimientos}
              onEdit={() => setEditing(nom)}
              onDelete={() => setDeletingId(nom.id)}
              onVincular={() => setVinculando(nom)}
              onDesvincular={() => handleDesvincular(nom)}
            />
          ))
        )}
      </div>

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

function NominaRow({ nom, movimientos, onEdit, onDelete, onVincular, onDesvincular }: { nom: any, movimientos: any[], onEdit: () => void, onDelete: () => void, onVincular: () => void, onDesvincular: () => void }) {
  const mov = movimientos.find(m => m.id === nom.movimiento_id);
  return (
    <div className={`p-5 bg-white dark:bg-[#0a0a0a] border rounded-2xl shadow-sm hover:border-indigo-100 transition-all flex flex-col sm:flex-row gap-4 ${nom.estado === 'Conciliado' ? 'border-emerald-100' : 'border-gray-100'}`}>
      <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-inner bg-blue-50 text-blue-600"><Users className="w-5 h-5" /></div>
      <div className="flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-md border font-semibold ${ESTADO_COLORS[nom.estado]}`}>{nom.estado}</span>
          <span className="text-xs text-gray-500 font-medium">{nom.periodo}</span>
        </div>
        <h3 className="font-semibold">{nom.empleado}</h3>
        <p className="text-xs text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3"/> Fecha de pago: {fmtDate(nom.fecha_pago)}</p>
        
        {mov && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-emerald-50 border border-emerald-100 rounded-xl">
            <Link2 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs text-emerald-700 font-medium flex-1 truncate">{mov.concepto} — {fmtDate(mov.fecha)}</span>
            <button onClick={onDesvincular} className="p-1 rounded-lg text-gray-400 hover:text-red-500"><Unlink className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </div>
      <div className="flex items-center sm:items-end justify-between sm:justify-center gap-3 sm:flex-col sm:pl-4 sm:border-l">
        <p className="text-xl font-bold tabular-nums">{fmt(nom.importe)}</p>
        <div className="flex gap-2">
          {nom.estado !== 'Conciliado' && !nom.movimiento_id && <button onClick={onVincular} className="p-2 rounded-xl text-indigo-600 bg-indigo-50"><Link2 className="w-4 h-4" /></button>}
          <button onClick={onEdit} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400"><Pencil className="w-4 h-4" /></button>
          <button onClick={onDelete} className="p-2 rounded-xl hover:bg-red-50 text-gray-400"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}
