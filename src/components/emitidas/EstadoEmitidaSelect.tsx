'use client';

import { useState } from 'react';
import { updateEmitidaField } from '@/app/emitidas/actions';
import { Loader2 } from 'lucide-react';

export function EstadoEmitidaSelect({ id, initialEstado, showIcon = true }: { id: number, initialEstado: string, showIcon?: boolean }) {
  const [estado, setEstado] = useState(initialEstado);
  const [updating, setUpdating] = useState(false);

  const opciones = ['Pendiente', 'Pagada', 'Rechazada'];

  const getColors = (st: string) => {
    if (st.includes('Pendiente')) return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20';
    if (st.includes('Pagada')) return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20';
    if (st.includes('Rechazad')) return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const getDotColor = (st: string) => {
    if (st.includes('Pendiente')) return 'bg-orange-500';
    if (st.includes('Pagada')) return 'bg-green-500';
    if (st.includes('Rechazad')) return 'bg-red-500';
    return 'bg-gray-500';
  };

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevoEstado = e.target.value;
    setUpdating(true);
    setEstado(nuevoEstado);
    await updateEmitidaField(id, 'estado', nuevoEstado);
    setUpdating(false);
  };

  return (
    <div className="relative inline-flex items-center group">
      <select
        value={estado}
        onChange={handleChange}
        disabled={updating}
        className={`appearance-none cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium pl-6 pr-6 py-1 rounded-full border transition-all hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${getColors(estado)} ${updating ? 'opacity-70' : ''}`}
      >
        {opciones.map(opt => (
          <option key={opt} value={opt} className="bg-white text-black dark:bg-[#111] dark:text-white">
            {opt === 'Pagada' ? 'Cobrada' : opt}
          </option>
        ))}
      </select>
      
      {showIcon && (
        <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full pointer-events-none ${getDotColor(estado)}`}></span>
      )}
      <span className={`absolute left-2.5 pointer-events-none text-xs font-medium pl-3 ${updating ? 'opacity-50' : 'opacity-0'}`}>
        {estado === 'Pagada' ? 'Cobrada' : estado}
      </span>
      
      {updating && (
        <Loader2 className="w-3 h-3 animate-spin absolute right-2 text-current pointer-events-none" />
      )}
      {!updating && (
        <span className="absolute right-2 opacity-50 group-hover:opacity-100 transition-opacity pointer-events-none text-[10px]">▼</span>
      )}
    </div>
  );
}
