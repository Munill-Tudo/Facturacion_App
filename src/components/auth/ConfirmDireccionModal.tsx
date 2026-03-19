'use client';

import { useState } from 'react';
import { Loader2, Lock, ShieldAlert, X } from 'lucide-react';

interface Props {
  onConfirmed: () => void;
  onCancel: () => void;
  actionLabel?: string;
}

export function ConfirmDireccionModal({ onConfirmed, onCancel, actionLabel = 'esta acción' }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setError('Contraseña incorrecta. Acción no autorizada.');
        setLoading(false);
        return;
      }

      setLoading(false);
      onConfirmed();
    } catch (err) {
      setError('Error verificando la contraseña.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-50 dark:bg-red-500/10">
              <ShieldAlert className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Acción restringida</h3>
              <p className="text-xs text-gray-500">Requiere autorización de Dirección</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5 bg-gray-50 dark:bg-white/5 rounded-xl p-3">
          Para <strong>{actionLabel}</strong> necesitas la contraseña de <strong className="text-indigo-600 dark:text-indigo-400">Dirección</strong>.
        </p>

        <form onSubmit={handleConfirm} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              <Lock className="w-3.5 h-3.5 inline mr-1" />
              Contraseña de Dirección
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoFocus
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-xl">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 font-medium text-sm transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-sm shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 disabled:opacity-60 transition-all">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
