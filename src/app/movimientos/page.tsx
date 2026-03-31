'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PiggyBank, RefreshCcw, Search, UploadCloud, ArrowDownRight, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { ImportadorCSVModal } from '@/components/movimientos/ImportadorCSVModal';

const fmt = (v: number) => `€ ${Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;

export default function MovimientosPage() {
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTipoMov, setFilterTipoMov] = useState<'Todos'|'Cobro'|'Pago'>('Todos');
  const [showImporter, setShowImporter] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchMovimientos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('movimientos')
      .select('*')
      .order('fecha', { ascending: false });
    
    setMovimientos(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchMovimientos();
  }, []);

  const handleImportSuccess = (msg: string) => {
    setShowImporter(false);
    setSuccessMsg(msg);
    fetchMovimientos();
    setTimeout(() => setSuccessMsg(null), 8000);
  };

  const filtered = movimientos.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || (m.concepto || '').toLowerCase().includes(q) || (m.cliente_expediente || '').toLowerCase().includes(q);
    const matchTipo = filterTipoMov === 'Todos' || m.tipo === filterTipoMov;
    return matchSearch && matchTipo;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <PiggyBank className="w-8 h-8 text-indigo-500" />
            Historial de Movimientos
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">El libro mayor de todas tus cuentas bancarias. Sube los extractos aquí.</p>
        </div>
        
        <div className="shrink-0 flex items-center gap-3 flex-wrap justify-end">
          <div className="flex bg-gray-50 dark:bg-black/50 p-1 rounded-2xl border border-gray-200 dark:border-gray-800 shrink-0">
            {(['Todos', 'Cobro', 'Pago'] as const).map(t => (
              <button key={t} onClick={() => setFilterTipoMov(t)}
                className={`px-3 py-1.5 text-sm rounded-xl font-medium transition-all ${filterTipoMov === t ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
                {t === 'Todos' ? 'Todos' : t === 'Cobro' ? 'Cobros (+)' : 'Pagos (-)'}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setShowImporter(true)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 font-bold text-sm"
          >
            <UploadCloud className="w-4 h-4" /> Importar CSV (BBVA)
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-emerald-700 dark:text-emerald-400 font-medium flex gap-2 items-center">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          {successMsg}
        </div>
      )}

      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            value={search} onChange={e => setSearch(e.target.value)} 
            placeholder="Buscar por concepto o cliente..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm" 
          />
        </div>
        <button onClick={fetchMovimientos} className="p-2 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300">
          <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin text-indigo-500' : ''}`} />
        </button>
      </div>

      <div className="bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-gray-800 text-gray-500">
              <tr>
                <th className="px-6 py-4 font-semibold shrink-0 w-16">Tipo</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Fechas</th>
                <th className="px-6 py-4 font-semibold">Cód.</th>
                <th className="px-6 py-4 font-semibold">Concepto / Beneficiario</th>
                <th className="px-6 py-4 font-semibold">Observaciones / Detalles</th>
                <th className="px-6 py-4 font-semibold">Estado</th>
                <th className="px-6 py-4 font-semibold text-right">Importe</th>
                <th className="px-6 py-4 font-semibold text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {loading && movimientos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">Cargando movimientos...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No hay movimientos todavía. ¡Importa tu primer CSV!
                  </td>
                </tr>
              ) : (
                filtered.map(mov => (
                  <tr key={mov.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${mov.tipo === 'Cobro' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400'}`}>
                        {mov.tipo === 'Cobro' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-gray-900 dark:text-white font-medium text-sm">{new Date(mov.fecha).toLocaleDateString('es-ES')}</span>
                        {mov.f_valor && <span className="text-xs text-gray-400">Val: {new Date(mov.f_valor).toLocaleDateString('es-ES')}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 font-mono text-xs">{mov.codigo || '-'}</td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900 dark:text-white line-clamp-1">{mov.concepto}</p>
                      {mov.beneficiario && <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-1">{mov.beneficiario}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 min-w-[150px]">{mov.observaciones || '-'}</p>
                      {mov.remesa && <p className="text-[10px] text-gray-400 mt-1 uppercase font-semibold">Remesa: {mov.remesa}</p>}
                      {mov.oficina && <p className="text-[10px] text-gray-400 mt-0.5 uppercase">Sucursal: {mov.oficina}</p>}
                    </td>
                    <td className="px-6 py-4">
                      {mov.estado_conciliacion === 'Conciliado' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {mov.cliente_expediente || 'Conciliado'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400 text-xs font-semibold">
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className={`font-bold text-base whitespace-nowrap ${mov.tipo === 'Cobro' ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}`}>
                        {mov.tipo === 'Cobro' ? '+' : ''}{fmt(Number(mov.importe))}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500 font-mono text-sm whitespace-nowrap">
                      {mov.saldo ? `${fmt(Number(mov.saldo))}` : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showImporter && (
        <ImportadorCSVModal 
          onComplete={handleImportSuccess}
          onCancel={() => setShowImporter(false)}
        />
      )}
    </div>
  );
}
