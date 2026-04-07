'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import {
  Landmark, Plus, RefreshCcw, Search, AlertCircle, CheckCircle2, Zap,
  Calendar, Link2, Unlink, Pencil, Trash2, X, Save, FileText,
  TrendingDown, Clock, Building, Download, GripVertical
} from 'lucide-react';
import {
  crearImpuesto, actualizarImpuesto, eliminarImpuesto,
  vincularMovimiento, desvincularMovimiento, autoConciliarImpuestos,
  ImpuestoInput
} from './actions';
import { exportToXlsx } from '@/lib/exportXlsx';
import { useResizableColumns } from '@/lib/useResizableColumns';

/* ─── helpers ─── */
const fmt = (v: number) =>
  `€ ${Math.abs(Number(v)).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
const fmtDate = (d?: string | null) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('es-ES') : '—';

const TIPOS = ['Trimestral', 'Anual', 'Mensual', 'Ayuntamiento'] as const;
type Tipo = typeof TIPOS[number];

const TIPO_COLORS: Record<Tipo, string> = {
  Trimestral: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  Anual: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
  Mensual: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  Ayuntamiento: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
};

const ESTADO_COLORS: Record<string, string> = {
  Pendiente: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/20',
  Pagado: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20',
  Conciliado: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
};

/* ─── SQL for setup ─── */
const SETUP_SQL = `CREATE TABLE IF NOT EXISTS public.impuestos (
  id uuid default gen_random_uuid() primary key,
  concepto text not null,
  tipo text not null check (tipo in ('Trimestral','Anual','Mensual','Ayuntamiento')),
  periodo text not null,
  importe numeric not null,
  fecha_devengo date not null,
  fecha_pago date,
  estado text not null default 'Pendiente'
    check (estado in ('Pendiente','Pagado','Conciliado')),
  movimiento_id bigint references public.movimientos(id) on delete set null,
  notas text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.impuestos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "impuestos_all" ON public.impuestos FOR ALL USING (true);`;

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
   MODAL: Crear / Editar Impuesto
═══════════════════════════════════════════════════ */
function ImpuestoModal({
  initial,
  onSave,
  onClose,
  isSaving,
}: {
  initial?: any;
  onSave: (data: ImpuestoInput) => void;
  onClose: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<ImpuestoInput>({
    concepto: initial?.concepto ?? '',
    tipo: initial?.tipo ?? 'Trimestral',
    periodo: initial?.periodo ?? '',
    importe: initial?.importe ?? '',
    fecha_devengo: initial?.fecha_devengo ?? '',
    fecha_pago: initial?.fecha_pago ?? '',
    notas: initial?.notas ?? '',
  } as any);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const isEdit = !!initial;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-[#0f0f0f] rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom-4 duration-300 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Landmark className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {isEdit ? 'Editar Impuesto' : 'Nuevo Impuesto'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Concepto *</label>
            <input value={form.concepto} onChange={e => set('concepto', e.target.value)} placeholder="ej: IVA 1T, IRPF Anual, IAE..."
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Tipo *</label>
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm">
                {TIPOS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Período *</label>
              <input value={form.periodo} onChange={e => set('periodo', e.target.value)} placeholder="ej: 1T 2025, Enero 2026..."
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Importe (€) *</label>
            <input type="number" step="0.01" value={form.importe} onChange={e => set('importe', e.target.value)} placeholder="0.00"
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Fecha Devengo *</label>
              <input type="date" value={form.fecha_devengo} onChange={e => set('fecha_devengo', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Fecha Pago</label>
              <input type="date" value={form.fecha_pago ?? ''} onChange={e => set('fecha_pago', e.target.value || null)}
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Notas</label>
            <textarea rows={2} value={form.notas ?? ''} onChange={e => set('notas', e.target.value || null)} placeholder="Observaciones opcionales..."
              className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm resize-none" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 font-medium text-sm transition-colors">Cancelar</button>
          <button
            onClick={() => { if (!form.concepto || !form.periodo || !form.importe || !form.fecha_devengo) return; onSave({ ...form, importe: Number(form.importe) }); }}
            disabled={isSaving || !form.concepto || !form.periodo || !form.importe || !form.fecha_devengo}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50 text-sm">
            {isSaving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? 'Guardar Cambios' : 'Añadir Impuesto'}
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
  impuesto, movimientos, onVincular, onClose, isSaving,
}: {
  impuesto: any; movimientos: any[]; onVincular: (movimientoId: number) => void; onClose: () => void; isSaving: boolean;
}) {
  const [search, setSearch] = useState('');
  const impImporte = Math.abs(Number(impuesto.importe));

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return movimientos
      .filter(m => m.estado_conciliacion === 'Pendiente')
      .filter(m => !q || m.concepto.toLowerCase().includes(q) || String(Math.abs(Number(m.importe))).includes(q))
      .sort((a, b) => {
        const aMatch = Math.abs(Number(a.importe)) === impImporte;
        const bMatch = Math.abs(Number(b.importe)) === impImporte;
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      });
  }, [movimientos, search, impImporte]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-[#0f0f0f] rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Link2 className="w-5 h-5 text-indigo-500" /> Vincular Movimiento Bancario
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{impuesto.concepto} — {fmt(impuesto.importe)}</p>
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
              const match = Math.abs(Number(mov.importe)) === impImporte;
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
                        <span className="text-xs px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400">{mov.banco}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{mov.concepto}</p>
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
   MODAL: Confirmación Eliminar
═══════════════════════════════════════════════════ */
function ConfirmDeleteModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white dark:bg-[#0f0f0f] rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 p-6 animate-in slide-in-from-bottom-4 duration-300">
        <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-6 h-6 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-center text-gray-900 dark:text-white mb-2">¿Eliminar impuesto?</h3>
        <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-6">Esta acción no se puede deshacer.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-medium text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors shadow-lg shadow-red-500/20">Eliminar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PAGE PRINCIPAL
═══════════════════════════════════════════════════ */
export default function ImpuestosPage() {
  const { role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (role && role !== 'direccion') router.replace('/facturas');
  }, [role, router]);

  const [impuestos, setImpuestos] = useState<any[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState<'Todos' | Tipo>('Todos');
  const [filterEstado, setFilterEstado] = useState<'Todos' | 'Pendiente' | 'Pagado' | 'Conciliado'>('Todos');

  // Sort
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'fecha_devengo', direction: 'desc' });

  // Modals
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-conciliar
  const [autoConciliando, setAutoConciliando] = useState(false);
  const [autoResultado, setAutoResultado] = useState<{ conciliados: number; errores: string[] } | null>(null);

  const { widths, onMouseDown } = useResizableColumns('cols_impuestos', {
    tipo: 100, concepto: 180, periodo: 100, fecha_devengo: 100, fecha_pago: 100, importe: 100, estado: 100, movimiento: 160, acciones: 120,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setDbError(null);
    try {
      const [{ data: imp, error: errImp }, { data: movs }] = await Promise.all([
        supabase.from('impuestos').select('*').order('fecha_devengo', { ascending: false }),
        supabase.from('movimientos').select('id, banco, fecha, concepto, importe, estado_conciliacion').order('fecha', { ascending: false }),
      ]);

      if (errImp) {
        if (errImp.code === '42P01') setDbError('La tabla "impuestos" no existe. Ejecuta el SQL de configuración en Supabase.');
        else setDbError(errImp.message);
        setLoading(false);
        return;
      }

      setImpuestos(imp || []);
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
      pendiente: impuestos.filter(i => i.estado === 'Pendiente').reduce((s, i) => s + Number(i.importe), 0),
      pagadoAnio: impuestos
        .filter(i => (i.estado === 'Pagado' || i.estado === 'Conciliado') && new Date(i.fecha_devengo).getFullYear() === year)
        .reduce((s, i) => s + Number(i.importe), 0),
      sinConciliar: impuestos.filter(i => i.estado === 'Pagado').length,
      totalItems: impuestos.length,
    };
  }, [impuestos]);

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return impuestos.filter(i => {
      if (filterTipo !== 'Todos' && i.tipo !== filterTipo) return false;
      if (filterEstado !== 'Todos' && i.estado !== filterEstado) return false;
      if (q && !i.concepto.toLowerCase().includes(q) && !i.periodo.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [impuestos, filterTipo, filterEstado, search]);

  // Sorted list
  const sortedData = useMemo(() => {
    let items = [...filtered];
    if (sortConfig) {
      items.sort((a, b) => {
        let aVal: any, bVal: any;
        if (sortConfig.key === 'fecha_devengo' || sortConfig.key === 'fecha_pago') {
          aVal = a[sortConfig.key] ? new Date(a[sortConfig.key]).getTime() : 0;
          bVal = b[sortConfig.key] ? new Date(b[sortConfig.key]).getTime() : 0;
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
  const handleSave = async (data: ImpuestoInput) => {
    setIsSaving(true);
    try {
      if (editing) { await actualizarImpuesto(editing.id, data); setEditing(null); }
      else { await crearImpuesto(data); setShowNew(false); }
      await fetchData();
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    await eliminarImpuesto(deletingId);
    setDeletingId(null);
    await fetchData();
  };

  const handleVincular = async (movimientoId: number) => {
    if (!vinculando) return;
    setIsSaving(true);
    try { await vincularMovimiento(vinculando.id, movimientoId); setVinculando(null); await fetchData(); }
    finally { setIsSaving(false); }
  };

  const handleDesvincular = async (imp: any) => {
    if (!imp.movimiento_id) return;
    await desvincularMovimiento(imp.id, Number(imp.movimiento_id));
    await fetchData();
  };

  const handleAutoConciliar = async () => {
    setAutoConciliando(true);
    setAutoResultado(null);
    try { const res = await autoConciliarImpuestos(); setAutoResultado(res); await fetchData(); }
    finally { setAutoConciliando(false); }
  };

  const handleExport = () => {
    exportToXlsx(sortedData, [
      { header: 'Tipo', key: 'tipo' },
      { header: 'Concepto', key: 'concepto' },
      { header: 'Período', key: 'periodo' },
      { header: 'F. Devengo', key: 'fecha_devengo', format: v => fmtDate(v) },
      { header: 'F. Pago', key: 'fecha_pago', format: v => fmtDate(v) },
      { header: 'Importe', key: 'importe', format: v => v != null ? Number(v).toFixed(2) : '' },
      { header: 'Estado', key: 'estado' },
      { header: 'Notas', key: 'notas' },
    ], `Impuestos_${new Date().toISOString().slice(0,10)}`);
  };

  /* ── Render guards ── */
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
            <Landmark className="w-8 h-8 text-indigo-500" />
            Impuestos
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Registra y concilia los impuestos con tus movimientos bancarios.</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {stats.sinConciliar > 0 && (
            <button id="btn-auto-conciliar-impuestos" onClick={handleAutoConciliar} disabled={autoConciliando}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-60 text-sm">
              {autoConciliando
                ? <><RefreshCcw className="w-4 h-4 animate-spin" /> Analizando...</>
                : <><Zap className="w-4 h-4" /> Auto-Conciliar ({stats.sinConciliar})</>
              }
            </button>
          )}
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 rounded-xl transition-colors">
            <Download className="w-4 h-4" /> Exportar XLSX
          </button>
          <button id="btn-nuevo-impuesto" onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 font-bold rounded-xl shadow-lg transition-all text-sm">
            <Plus className="w-4 h-4" /> Añadir Impuesto
          </button>
        </div>
      </div>

      {/* ── Banner auto-conciliar ── */}
      {autoResultado !== null && (
        <div className={`p-4 rounded-2xl border flex items-start gap-3 animate-in slide-in-from-top-2 duration-300 ${
          autoResultado.conciliados > 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20'
        }`}>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            autoResultado.conciliados > 0 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
          }`}>
            {autoResultado.conciliados > 0 ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            {autoResultado.conciliados > 0
              ? <p className="font-semibold text-emerald-800 dark:text-emerald-300">✅ {autoResultado.conciliados} impuesto{autoResultado.conciliados !== 1 ? 's' : ''} conciliado{autoResultado.conciliados !== 1 ? 's' : ''} automáticamente</p>
              : <p className="font-semibold text-amber-800 dark:text-amber-300">No se encontraron coincidencias automáticas por importe</p>
            }
            {autoResultado.errores.length > 0 && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{autoResultado.errores[0]}</p>}
          </div>
          <button onClick={() => setAutoResultado(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>
      )}

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Clock className="w-5 h-5" />} label="Pendiente de Pago" value={fmt(stats.pendiente)} color="orange" />
        <StatCard icon={<TrendingDown className="w-5 h-5" />} label={`Pagado ${new Date().getFullYear()}`} value={fmt(stats.pagadoAnio)} color="violet" />
        <StatCard icon={<Link2 className="w-5 h-5" />} label="Sin Conciliar" value={String(stats.sinConciliar)} color="blue" suffix={stats.sinConciliar > 0 ? 'impuestos' : '✓ Al día'} />
        <StatCard icon={<Landmark className="w-5 h-5" />} label="Total Registros" value={String(stats.totalItems)} color="indigo" />
      </div>

      {/* ── Filtros ── */}
      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por concepto o período..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm" />
        </div>
        <div className="flex bg-gray-50 dark:bg-black/50 p-1 rounded-2xl border border-gray-200 dark:border-gray-800">
          {(['Todos', 'Pendiente', 'Pagado', 'Conciliado'] as const).map(e => (
            <button key={e} onClick={() => setFilterEstado(e)}
              className={`px-3 py-1.5 text-xs rounded-xl font-medium transition-all ${filterEstado === e ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
              {e}
            </button>
          ))}
        </div>
        <div className="flex bg-gray-50 dark:bg-black/50 p-1 rounded-2xl border border-gray-200 dark:border-gray-800">
          {(['Todos', ...TIPOS] as const).map(t => (
            <button key={t} onClick={() => setFilterTipo(t as any)}
              className={`px-3 py-1.5 text-xs rounded-xl font-medium transition-all ${filterTipo === t ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
              {t}
            </button>
          ))}
        </div>
        {(search || filterTipo !== 'Todos' || filterEstado !== 'Todos') && (
          <button onClick={() => { setSearch(''); setFilterTipo('Todos'); setFilterEstado('Todos'); }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Limpiar Filtros</button>
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
                  ['tipo', 'Tipo'],
                  ['concepto', 'Concepto'],
                  ['periodo', 'Período'],
                  ['fecha_devengo', 'F. Devengo'],
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
                <tr><td colSpan={9} className="py-12 text-center text-gray-500">
                  <Landmark className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  No hay impuestos para este filtro.
                </td></tr>
              ) : (
                sortedData.map(imp => {
                  const mov = movimientos.find(m => m.id === imp.movimiento_id);
                  return (
                    <tr key={imp.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5 transition-colors group">
                      <td className="py-3 px-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${TIPO_COLORS[imp.tipo as Tipo]}`}>{imp.tipo}</span>
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-white text-xs truncate">{imp.concepto}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{imp.periodo}</td>
                      <td className="py-3 px-4 text-gray-700 dark:text-gray-300 text-xs">{fmtDate(imp.fecha_devengo)}</td>
                      <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 text-xs font-medium">{fmtDate(imp.fecha_pago)}</td>
                      <td className="py-3 px-4 font-bold text-gray-900 dark:text-white text-xs tabular-nums">{fmt(imp.importe)}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold ${ESTADO_COLORS[imp.estado]}`}>{imp.estado}</span>
                      </td>
                      <td className="py-3 px-4">
                        {mov ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium truncate flex-1">
                              {mov.concepto?.substring(0, 30)}...
                            </span>
                            <button onClick={() => handleDesvincular(imp)} title="Desvincular"
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
                          {imp.estado !== 'Conciliado' && !imp.movimiento_id && (
                            <button onClick={() => setVinculando(imp)} title="Vincular" className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 transition-colors">
                              <Link2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => setEditing(imp)} title="Editar" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 hover:text-gray-700 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeletingId(imp.id)} title="Eliminar" className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors">
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
            <div className="p-12 text-center text-gray-500 text-sm">No hay impuestos registrados.</div>
          ) : (
            sortedData.map(imp => {
              const mov = movimientos.find(m => m.id === imp.movimiento_id);
              return (
                <div key={`m-${imp.id}`} className="p-4 flex flex-col gap-2 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${TIPO_COLORS[imp.tipo as Tipo]}`}>{imp.tipo}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md border font-semibold ${ESTADO_COLORS[imp.estado]}`}>{imp.estado}</span>
                        <span className="text-xs text-gray-500">{imp.periodo}</span>
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{imp.concepto}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Devengo: {fmtDate(imp.fecha_devengo)} {imp.fecha_pago ? `· Pago: ${fmtDate(imp.fecha_pago)}` : ''}</p>
                    </div>
                    <p className="font-bold text-gray-900 dark:text-white text-base tabular-nums shrink-0">{fmt(imp.importe)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {mov && <span className="text-[10px] text-emerald-700 truncate flex-1">🔗 {mov.concepto?.substring(0, 40)}</span>}
                    <div className="flex gap-1 shrink-0 ml-auto">
                      {imp.estado !== 'Conciliado' && !imp.movimiento_id && (
                        <button onClick={() => setVinculando(imp)} className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600"><Link2 className="w-3.5 h-3.5" /></button>
                      )}
                      <button onClick={() => setEditing(imp)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeletingId(imp.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {(showNew || editing) && (
        <ImpuestoModal initial={editing} onSave={handleSave} onClose={() => { setShowNew(false); setEditing(null); }} isSaving={isSaving} />
      )}
      {vinculando && <VincularModal impuesto={vinculando} movimientos={movimientos} onVincular={handleVincular} onClose={() => setVinculando(null)} isSaving={isSaving} />}
      {deletingId && <ConfirmDeleteModal onConfirm={handleDelete} onCancel={() => setDeletingId(null)} />}
    </div>
  );
}

/* ─── Stat Card ─── */
function StatCard({ icon, label, value, color, suffix }: {
  icon: React.ReactNode; label: string; value: string; color: string; suffix?: string;
}) {
  const colors: Record<string, string> = {
    orange: 'from-orange-500 to-amber-500',
    violet: 'from-violet-500 to-purple-600',
    blue: 'from-blue-500 to-cyan-500',
    indigo: 'from-indigo-500 to-blue-600',
  };

  return (
    <div className="bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white mb-3 shadow-lg shadow-${color}-500/20`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {suffix && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{suffix}</p>}
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}
