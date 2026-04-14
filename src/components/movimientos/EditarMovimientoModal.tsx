'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Save, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getTrimestreFiscal } from '@/lib/trimestre';

export function EditarMovimientoModal({ movimiento, onClose, onSaved }: { movimiento: any | null; onClose: () => void; onSaved: () => void; }) {
  const [fecha, setFecha] = useState('');
  const [fechaValor, setFechaValor] = useState('');
  const [concepto, setConcepto] = useState('');
  const [beneficiario, setBeneficiario] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [tipo, setTipo] = useState<'Cobro' | 'Pago'>('Pago');
  const [fechaDudosa, setFechaDudosa] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!movimiento) return;
    setFecha((movimiento.fecha || '').slice(0, 10));
    setFechaValor((movimiento.f_valor || '').slice(0, 10));
    setConcepto(movimiento.concepto || '');
    setBeneficiario(movimiento.beneficiario || '');
    setObservaciones(movimiento.observaciones || '');
    setTipo((movimiento.tipo || 'Pago') as 'Cobro' | 'Pago');
    setFechaDudosa(Boolean(movimiento.fecha_dudosa));
    setError(null);
  }, [movimiento]);

  const trimestreFiscal = useMemo(() => getTrimestreFiscal(fecha), [fecha]);
  if (!movimiento) return null;

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const payload = {
        fecha,
        f_valor: fechaValor || null,
        concepto,
        beneficiario: beneficiario || null,
        observaciones: observaciones || null,
        tipo,
        fecha_dudosa: fechaDudosa,
        trimestre_fiscal: trimestreFiscal,
        fecha_operativa: fecha || null,
        fecha_contable: fechaValor || fecha || null,
        ultima_revision_at: new Date().toISOString(),
      };

      const { data: updatedRows, error: updateError } = await supabase.from('movimientos').update(payload).eq('id', movimiento.id).select('id, fecha_dudosa');
      if (updateError) throw updateError;
      if (!updatedRows || updatedRows.length === 0) throw new Error('El movimiento no se ha actualizado en base de datos.');

      const syncRes = await fetch('/api/operativa/movimiento-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movimientoId: movimiento.id }),
      });
      if (!syncRes.ok) {
        const body = await syncRes.json().catch(() => ({}));
        throw new Error(body?.error || 'No se pudo sincronizar la bandeja del movimiento');
      }
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'No se pudo guardar el movimiento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-[#0a0a0a]">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Editar movimiento</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Movimiento #{movimiento.id}</p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">
          <label className="text-sm"><span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Fecha banco</span><input value={fecha} onChange={e => setFecha(e.target.value)} type="date" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-black dark:text-white" /></label>
          <label className="text-sm"><span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Fecha valor</span><input value={fechaValor} onChange={e => setFechaValor(e.target.value)} type="date" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-black dark:text-white" /></label>
          <label className="text-sm md:col-span-2"><span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Concepto</span><input value={concepto} onChange={e => setConcepto(e.target.value)} type="text" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-black dark:text-white" /></label>
          <label className="text-sm"><span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Beneficiario</span><input value={beneficiario} onChange={e => setBeneficiario(e.target.value)} type="text" className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-black dark:text-white" /></label>
          <label className="text-sm"><span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Tipo</span><select value={tipo} onChange={e => setTipo(e.target.value as 'Cobro' | 'Pago')} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-black dark:text-white"><option value="Pago">Pago</option><option value="Cobro">Cobro</option></select></label>
          <label className="text-sm md:col-span-2"><span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Observaciones</span><textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={4} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-gray-700 dark:bg-black dark:text-white" /></label>
          <div className="md:col-span-2 flex flex-col gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/5">
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-gray-900 dark:text-white">Fecha dudosa</p><p className="text-xs text-gray-500 dark:text-gray-400">Márcalo si este movimiento necesita revisión humana de trimestre o fecha.</p></div><label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" checked={fechaDudosa} onChange={e => setFechaDudosa(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" /></label></div>
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300"><AlertTriangle className="h-4 w-4 text-amber-500" />Trimestre fiscal calculado: <strong>{trimestreFiscal || '—'}</strong></div>
          </div>
          {error && (<div className="md:col-span-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">{error}</div>)}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
          <button onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5">Cancelar</button>
          <button disabled={saving || !fecha || !concepto} onClick={handleSave} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Guardando...' : 'Guardar cambios'}</button>
        </div>
      </div>
    </div>
  );
}
