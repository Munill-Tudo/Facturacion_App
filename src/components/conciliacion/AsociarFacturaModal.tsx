import { useState } from 'react';
import { Search, Link2, Check, X } from 'lucide-react';

export function AsociarFacturaModal({ 
  movimiento, 
  facturas, 
  onConfirm, 
  onCancel,
  isSubmitting 
}: { 
  movimiento: any, 
  facturas: any[], 
  onConfirm: (facturaId: number) => void, 
  onCancel: () => void,
  isSubmitting: boolean
}) {
  const [search, setSearch] = useState('');
  const absImporte = Math.abs(Number(movimiento.importe));

  // Ordenar: primero las facturas que cuadran exacto en importe, luego por fecha/id (para mvp: primero exactas)
  const sortedFacturas = [...facturas].sort((a, b) => {
    const aMatch = Number(a.importe) === absImporte;
    const bMatch = Number(b.importe) === absImporte;
    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    return b.id - a.id;
  });

  const filtered = sortedFacturas.filter(f => {
    const q = search.toLowerCase();
    return !q || 
      (f.nombre_proveedor || '').toLowerCase().includes(q) || 
      (f.cliente || '').toLowerCase().includes(q) ||
      (f.num_expediente || '').toLowerCase().includes(q) ||
      String(f.importe).includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111] w-full max-w-2xl rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Asociar Pago a Factura</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
              <span className="font-medium px-2 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 rounded-md">
                Movimiento: -{absImporte.toLocaleString('es-ES')}€
              </span>
              <span className="truncate max-w-[200px]">{movimiento.concepto}</span>
            </p>
          </div>
          <button onClick={onCancel} className="p-2 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              autoFocus
              value={search} onChange={e => setSearch(e.target.value)} 
              placeholder="Buscar por importe exacto, proveedor o expediente..."
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-8 text-gray-500">No se encontraron facturas pendientes.</div>
          )}
          {filtered.map(f => {
            const isMatch = Number(f.importe) === absImporte;
            return (
              <div key={f.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isMatch ? 'border-indigo-200 bg-indigo-50/50 dark:border-indigo-500/30 dark:bg-indigo-500/5' : 'border-gray-100 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-[#0a0a0a] dark:hover:border-gray-700'}`}>
                <div>
                  <div className="flex gap-2 items-center mb-1">
                    <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">Fc. Rec.-{String(f.id).padStart(4,'0')}</span>
                    {isMatch && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 rounded uppercase tracking-wider">Recomendado</span>}
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{f.nombre_proveedor || f.cliente || 'Sin proveedor'}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{f.num_expediente ? `Exp: ${f.num_expediente}` : 'Sin expediente'} • {f.tipo}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-lg font-bold ${isMatch ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>
                    {Number(f.importe).toLocaleString('es-ES')}€
                  </span>
                  <button 
                    disabled={isSubmitting}
                    onClick={() => onConfirm(f.id)}
                    className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-colors disabled:opacity-50"
                  >
                    <Link2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
