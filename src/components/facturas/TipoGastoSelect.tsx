'use client';

import { useState } from 'react';
import { TIPOS_GASTO } from '@/lib/tipos-gasto';
import { supabase } from '@/lib/supabase';

interface TipoGastoSelectProps {
  id: number;
  initialTipoGasto?: string | null;
  initialSubtipoGasto?: string | null;
}

export function TipoGastoSelect({ id, initialTipoGasto, initialSubtipoGasto }: TipoGastoSelectProps) {
  const [tipo, setTipo] = useState(initialTipoGasto || '');
  const [subtipo, setSubtipo] = useState(initialSubtipoGasto || '');
  const [saving, setSaving] = useState(false);

  const selectedTipo = TIPOS_GASTO.find(t => t.valor === tipo);

  const handleTipoChange = async (nuevoTipo: string) => {
    setTipo(nuevoTipo);
    setSubtipo(''); // Reset subtipo when tipo changes
    setSaving(true);
    await supabase.from('facturas').update({ tipo_gasto: nuevoTipo || null, subtipo_gasto: null }).eq('id', id);
    setSaving(false);
  };

  const handleSubtipoChange = async (nuevoSubtipo: string) => {
    setSubtipo(nuevoSubtipo);
    setSaving(true);
    await supabase.from('facturas').update({ subtipo_gasto: nuevoSubtipo || null }).eq('id', id);
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      <select
        value={tipo}
        onChange={e => handleTipoChange(e.target.value)}
        disabled={saving}
        onClick={e => e.stopPropagation()}
        className={`px-2 py-1 text-xs rounded-lg border cursor-pointer outline-none transition-colors
          ${tipo
            ? 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/30 text-violet-800 dark:text-violet-300 font-semibold'
            : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-gray-700 text-gray-500'
          } focus:ring-2 focus:ring-violet-500/30`}
      >
        <option value="">Tipo de Gasto…</option>
        {TIPOS_GASTO.map(t => (
          <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
        ))}
      </select>

      {selectedTipo && selectedTipo.subtipos.length > 0 && (
        <select
          value={subtipo}
          onChange={e => handleSubtipoChange(e.target.value)}
          disabled={saving}
          onClick={e => e.stopPropagation()}
          className={`px-2 py-1 text-xs rounded-lg border cursor-pointer outline-none transition-colors
            ${subtipo
              ? 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/30 text-violet-700 dark:text-violet-400'
              : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-gray-700 text-gray-400'
            } focus:ring-2 focus:ring-violet-500/30`}
        >
          <option value="">Subtipo…</option>
          {selectedTipo.subtipos.map(s => (
            <option key={s.valor} value={s.valor}>{s.etiqueta}</option>
          ))}
        </select>
      )}
    </div>
  );
}
