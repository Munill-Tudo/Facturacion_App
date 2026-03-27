'use client';

import { useState } from 'react';
import { Trash2, ShieldAlert, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function VaciarPapeleraBtn({ role }: { role: string | null }) {
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  if (role !== 'direccion') return null;

  const handleEmpty = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/papelera/vaciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Verificación fallida');
      }

      setShowModal(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setShowModal(true)}
        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-red-500/20 transition-all"
      >
        <Trash2 className="w-4 h-4" />
        Vaciar Papelera Definitivamente
      </button>

      {showModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#0a0a0a] w-full max-w-md rounded-3xl border border-red-200 dark:border-red-900/30 p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/10 text-red-600 flex items-center justify-center mx-auto mb-4 animate-bounce">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Acción Crítica</h2>
              <p className="text-sm text-gray-500">
                Para eliminar permanentemente todos los elementos de la papelera, confirma con el email y contraseña de Dirección.
              </p>
            </div>

            <form onSubmit={handleEmpty} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Email de Dirección</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ejemplo@munilltudoabogados.es"
                  required
                  className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 outline-none focus:ring-2 focus:ring-red-500/30 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Contraseña</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 outline-none focus:ring-2 focus:ring-red-500/30 transition-all"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-900/30 text-xs text-red-600 font-medium text-center">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="flex-[2] py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-xl shadow-red-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ELIMINAR TODO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
