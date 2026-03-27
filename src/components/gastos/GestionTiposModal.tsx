'use client';

import { useState } from 'react';
import { X, Plus, Trash2, ChevronRight, Settings2, Loader2 } from 'lucide-react';
import { addTipoGasto, deleteTipoGasto } from '@/app/gastos/actions';

interface ItemGasto {
  id: string;
  valor: string;
  etiqueta: string;
  subtipos?: ItemGasto[];
}

export function GestionTiposModal({ 
  tipos, 
  onClose 
}: { 
  tipos: ItemGasto[]; 
  onClose: () => void 
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [newTipo, setNewTipo] = useState('');
  const [newSubtipo, setNewSubtipo] = useState<Record<string, string>>({});

  const handleAdd = async (etiqueta: string, parentId: string | null = null) => {
    if (!etiqueta.trim()) return;
    setLoading(parentId || 'tipo_principal');
    const { error } = await addTipoGasto(etiqueta, parentId);
    if (!error) {
      if (!parentId) setNewTipo('');
      else setNewSubtipo(prev => ({ ...prev, [parentId]: '' }));
    }
    setLoading(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que quieres eliminar este tipo? Se eliminarán también sus subtipos.')) return;
    setLoading(id);
    await deleteTipoGasto(id);
    setLoading(null);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-[#0a0a0a] w-full max-w-2xl rounded-3xl border border-gray-100 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-violet-50/50 dark:bg-violet-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Settings2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Gestionar Tipos de Gasto</h2>
              <p className="text-sm text-gray-500">Añade o elimina categorías y subcategorías</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Add Main Type */}
          <div className="flex gap-2">
            <input 
              value={newTipo}
              onChange={e => setNewTipo(e.target.value)}
              placeholder="Nuevo tipo principal (ej: Gasto Oficina)"
              className="flex-1 px-4 py-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 outline-none focus:ring-2 focus:ring-violet-500/30 transition-all"
            />
            <button 
              onClick={() => handleAdd(newTipo)}
              disabled={loading === 'tipo_principal'}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold shadow-lg shadow-violet-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading === 'tipo_principal' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Añadir
            </button>
          </div>

          <div className="space-y-4">
            {tipos.map(tipo => (
              <div key={tipo.id} className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-white/3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-wider text-xs">
                    <ChevronRight className="w-3 h-3 text-violet-500" />
                    {tipo.etiqueta}
                  </span>
                  <button 
                    onClick={() => handleDelete(tipo.id)}
                    disabled={!!loading}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Subtypes List */}
                <div className="pl-5 space-y-2">
                  {tipo.subtipos?.map(sub => (
                    <div key={sub.id} className="flex items-center justify-between py-1 border-l-2 border-violet-100 dark:border-violet-900/30 pl-3">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{sub.etiqueta}</span>
                      <button 
                        onClick={() => handleDelete(sub.id)}
                        disabled={!!loading}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  
                  {/* Add Subtype */}
                  <div className="flex gap-2 pt-1 uppercase">
                    <input 
                      value={newSubtipo[tipo.id] || ''}
                      onChange={e => setNewSubtipo(prev => ({ ...prev, [tipo.id]: e.target.value }))}
                      placeholder="Nuevo subtipo..."
                      className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-white dark:bg-black border border-gray-200 dark:border-gray-800 outline-none"
                    />
                    <button 
                      onClick={() => handleAdd(newSubtipo[tipo.id] || '', tipo.id)}
                      disabled={loading === tipo.id}
                      className="px-3 py-1.5 bg-gray-900 dark:bg-white dark:text-black text-white text-xs rounded-lg font-bold disabled:opacity-50"
                    >
                      {loading === tipo.id ? '...' : 'Añadir'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
