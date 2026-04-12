'use client';

import { useState, useEffect } from 'react';
import { 
  ShieldAlert, Trash2, Hash, Loader2, CheckCircle, 
  AlertTriangle, RefreshCw, Settings
} from 'lucide-react';

export default function AjustesPage() {
  const [lastId, setLastId] = useState<number | null>(null);
  const [nextId, setNextId] = useState<number | null>(null);
  const [nuevoNumero, setNuevoNumero] = useState('');

  // Reset form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'idle' | 'confirm' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{ sequenceWarning?: string; error?: string } | null>(null);

  useEffect(() => {
    fetch('/api/ajustes/secuencia')
      .then(r => r.json())
      .then(d => { setLastId(d.lastId); setNextId(d.nextId); });
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/ajustes/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, password,
          nuevoNumero: nuevoNumero ? Number(nuevoNumero) : undefined 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      setStep('done');
      setLastId(0);
      setNextId(nuevoNumero ? Number(nuevoNumero) : 1);
    } catch (err: any) {
      setResult({ error: err.message });
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
          <Settings className="w-8 h-8 text-indigo-500" />
          Ajustes del Sistema
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Gestión avanzada de datos · Solo Dirección
        </p>
      </div>

      {/* Sequence Info */}
      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl border border-gray-100 dark:border-gray-800 p-6 space-y-3">
        <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Hash className="w-5 h-5 text-indigo-500" />
          Numeración de Facturas
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-500 mb-1">Última Fc. generada</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white">
              {lastId !== null ? lastId === 0 ? '—' : `Fc. Rec.-${String(lastId).padStart(4,'0')}` : '...'}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-1 font-semibold">Siguiente Nº asignado</p>
            <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300">
              {nextId !== null ? `Fc. Rec.-${String(nextId).padStart(4,'0')}` : '...'}
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          El cambio del número de inicio solo se aplica si reseteas los datos desde abajo, o ejecutando el SQL indicado manualmente en Supabase.
        </p>
      </div>

      {/* Reset Section */}
      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl border border-red-100 dark:border-red-900/30 p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white">Reset de Datos</h2>
            <p className="text-sm text-gray-500 mt-1">
              Elimina <strong>todas</strong> las facturas y movimientos de la base de datos. 
              Esta acción es <strong>irreversible</strong>. Requiere credenciales de Dirección.
            </p>
          </div>
        </div>

        {step === 'done' ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Datos eliminados correctamente.</p>
            </div>
            {result?.sequenceWarning && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-2">⚠️ Ejecuta esto en Supabase para fijar el contador:</p>
                <pre className="text-xs bg-white dark:bg-black p-3 rounded-xl font-mono overflow-x-auto text-gray-800 dark:text-gray-300">
                  {result.sequenceWarning.split('\n').slice(1).join('\n').trim()}
                </pre>
              </div>
            )}
            <button onClick={() => { setStep('idle'); setEmail(''); setPassword(''); setNuevoNumero(''); }}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
              <RefreshCw className="w-4 h-4" /> Hacer otro reset
            </button>
          </div>
        ) : step === 'error' ? (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">Error en la operación</p>
              <p className="text-xs text-red-500 mt-0.5">{result?.error}</p>
            </div>
          </div>
        ) : step === 'idle' ? (
          <button
            onClick={() => setStep('confirm')}
            className="w-full py-3 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 font-bold hover:bg-red-100 dark:hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
          >
            <ShieldAlert className="w-5 h-5" />
            Iniciar proceso de reset
          </button>
        ) : (
          // Confirm form
          <form onSubmit={handleReset} className="space-y-4">
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-700 font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              Se eliminará todo. Confirma tu identidad y el número de inicio que prefieres para las nuevas facturas.
            </div>

            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase">Empezar desde el número</label>
              <input
                type="number"
                min={1}
                value={nuevoNumero}
                onChange={e => setNuevoNumero(e.target.value)}
                placeholder="Ej: 1 (por defecto), o 150, 200..."
                className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-black border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-sm"
              />
              <p className="text-[11px] text-gray-400">
                La siguiente Fc. Recibida tendrá el nº indicado. Deja vacío para continuar desde el 1.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Email de Dirección</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="email@munilltudoabogados.es" required
                  className="w-full mt-1 px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 outline-none focus:ring-2 focus:ring-red-500/30 transition-all text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Contraseña</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  className="w-full mt-1 px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 outline-none focus:ring-2 focus:ring-red-500/30 transition-all text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep('idle')}
                className="flex-1 py-2.5 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-200 transition-all text-sm">
                Cancelar
              </button>
              <button type="submit" disabled={loading}
                className="flex-[2] py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black shadow-xl shadow-red-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {loading ? 'Eliminando...' : 'CONFIRMAR RESET'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
