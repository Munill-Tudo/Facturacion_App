import { useState } from 'react';
import { UserPlus, X, Check } from 'lucide-react';

export function AsignarClienteModal({ 
  movimiento, 
  onConfirm, 
  onCancel,
  isSubmitting 
}: { 
  movimiento: any, 
  onConfirm: (cliente: string) => void, 
  onCancel: () => void,
  isSubmitting: boolean
}) {
  const [cliente, setCliente] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111] w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-500" /> Asignar Ingreso
          </h2>
          <button onClick={onCancel} className="p-2 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-gray-800">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Concepto Bancario</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{movimiento.concepto}</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-2">
              +{Number(movimiento.importe).toLocaleString('es-ES')}€
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Cliente o Expediente
            </label>
            <input 
              autoFocus
              type="text"
              value={cliente}
              onChange={e => setCliente(e.target.value)}
              placeholder="Ej. Juan Pérez / Exp 2024-15"
              className="w-full px-4 py-3 bg-white dark:bg-black border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 font-medium"
            />
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/5 flex justify-end gap-3">
          <button 
            disabled={isSubmitting}
            onClick={onCancel} 
            className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button 
            disabled={isSubmitting || !cliente.trim()}
            onClick={() => onConfirm(cliente.trim())}
            className="px-5 py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <Check className="w-4 h-4" /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
