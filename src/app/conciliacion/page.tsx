'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PiggyBank, RefreshCcw, Search, AlertCircle, ArrowRightLeft, ArrowDownRight, ArrowUpRight, Link2, UserPlus, CheckCircle2 } from 'lucide-react';
import { AsociarFacturaModal } from '@/components/conciliacion/AsociarFacturaModal';
import { AsignarClienteModal } from '@/components/conciliacion/AsignarClienteModal';
import { asociarPagoAFactura, asignarCobroACliente } from './actions';

const fmt = (v: number) => `€ ${Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;

export default function ConciliacionPage() {
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [facturas, setFacturas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pendientes' | 'conciliados'>('pendientes');
  const [search, setSearch] = useState('');
  
  // Modals state
  const [pagoAsociando, setPagoAsociando] = useState<any | null>(null);
  const [cobroAsignando, setCobroAsignando] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setDbError(null);
    try {
      // Fetch movimientos
      const { data: movs, error: movsErr } = await supabase
        .from('movimientos')
        .select('*')
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

      // Fetch facturas pendientes (para cruzar con pagos)
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

  const filtered = useMemo(() => {
    return movimientos.filter(m => {
      const matchTab = activeTab === 'pendientes' 
        ? m.estado_conciliacion === 'Pendiente'
        : m.estado_conciliacion === 'Conciliado';
      
      const q = search.toLowerCase();
      const matchSearch = !q || m.concepto.toLowerCase().includes(q) || (m.cliente_expediente || '').toLowerCase().includes(q);
      
      return matchTab && matchSearch;
    });
  }, [movimientos, activeTab, search]);

  const handleAsociarFactura = async (facturaId: number) => {
    if (!pagoAsociando) return;
    setIsSubmitting(true);
    await asociarPagoAFactura(pagoAsociando.id, facturaId);
    setPagoAsociando(null);
    setIsSubmitting(false);
    fetchData(); // Refresh UI
  };

  const handleAsignarCliente = async (cliente: string) => {
    if (!cobroAsignando) return;
    setIsSubmitting(true);
    await asignarCobroACliente(cobroAsignando.id, cliente);
    setCobroAsignando(null);
    setIsSubmitting(false);
    fetchData();
  };

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
      <div className="bg-white dark:bg-black/40 p-4 rounded-xl text-left border border-red-100 dark:border-red-900 overflow-x-auto">
        <p className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Ejecuta esto en el SQL Editor de Supabase:</p>
        <code className="text-xs text-gray-600 dark:text-gray-400 block whitespace-pre">
{`CREATE TABLE IF NOT EXISTS public.movimientos (
  id uuid default gen_random_uuid() primary key,
  banco text not null,
  fecha date not null,
  concepto text not null,
  importe numeric not null,
  tipo text not null, 
  estado_conciliacion text not null default 'Pendiente',
  factura_id bigint references public.facturas(id) on delete set null,
  cliente_expediente text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a anonimos en movimientos" ON public.movimientos FOR ALL USING (true);`}
        </code>
      </div>
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
        
        <div className="flex bg-gray-50 dark:bg-black/50 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-800 shrink-0">
          <button onClick={() => setActiveTab('pendientes')}
            className={`px-4 py-2 text-sm rounded-xl font-medium transition-all ${activeTab === 'pendientes' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
            Pendientes ({movimientos.filter(m => m.estado_conciliacion === 'Pendiente').length})
          </button>
          <button onClick={() => setActiveTab('conciliados')}
            className={`px-4 py-2 text-sm rounded-xl font-medium transition-all ${activeTab === 'conciliados' ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
            Conciliados
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por concepto o cliente..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm" />
        </div>
        <button onClick={fetchData} className="p-2 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300">
          <RefreshCcw className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 rounded-3xl border-dashed">
            <ArrowRightLeft className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">No hay movimientos</p>
            <p className="text-sm">No se encontraron registros para tu búsqueda o filtro actual.</p>
          </div>
        ) : (
          filtered.map(mov => (
            <div key={mov.id} className="flex flex-col sm:flex-row gap-4 p-5 bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm hover:border-indigo-100 dark:hover:border-indigo-900/50 transition-colors group">
              
              <div className="flex-1 flex gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${mov.tipo === 'Cobro' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400'}`}>
                  {mov.tipo === 'Cobro' ? <ArrowDownRight className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{new Date(mov.fecha).toLocaleDateString('es-ES')}</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 font-medium">{mov.banco}</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1">{mov.concepto}</h3>
                  {mov.estado_conciliacion === 'Conciliado' && (
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Vinculado a {mov.cliente_expediente || 'Factura'}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-6 sm:pl-4 sm:border-l border-gray-100 dark:border-gray-800">
                <div className="text-right">
                  <p className={`text-xl font-bold ${mov.tipo === 'Cobro' ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>
                    {mov.tipo === 'Cobro' ? '+' : ''}{fmt(Number(mov.importe))}
                  </p>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mt-0.5">{mov.tipo}</p>
                </div>
                
                {activeTab === 'pendientes' && (
                  <div className="shrink-0 flex gap-2">
                    {mov.tipo === 'Pago' ? (
                      <button onClick={() => setPagoAsociando(mov)} className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 dark:text-indigo-300 rounded-xl font-medium text-sm transition-colors flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-500/20 shadow-sm">
                        <Link2 className="w-4 h-4" /> Buscar Factura
                      </button>
                    ) : (
                      <button onClick={() => setCobroAsignando(mov)} className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:text-emerald-300 rounded-xl font-medium text-sm transition-colors flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-500/20 shadow-sm">
                        <UserPlus className="w-4 h-4" /> Asignar a Cliente
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
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
