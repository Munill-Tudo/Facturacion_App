'use client';

import { useState, useTransition } from 'react';
import { changeTipoDefectoProveedor } from '@/app/proveedores/actions';

export function TipoDefectoSelect({ id, initialTipo }: { id: string, initialTipo?: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [currentVal, setCurrentVal] = useState(initialTipo || '');

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setCurrentVal(val); // Optimistic UI update
    startTransition(() => changeTipoDefectoProveedor(id, val));
  };

  return (
    <div onClick={e => e.stopPropagation()}>
      <select 
        value={currentVal} 
        onChange={handleChange}
        disabled={isPending}
        className={`text-[10px] md:text-xs font-semibold px-2 py-1 rounded-full border outline-none cursor-pointer appearance-none transition-all hover:scale-105 ${
          isPending ? 'opacity-50' : ''
        } ${
          currentVal === 'Suplido' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' : 
          currentVal === 'Fijo' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20' : 
          currentVal === 'Variable' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20' :
          'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-gray-800'
        }`}
      >
        <option value="" className="text-gray-900 bg-white dark:bg-gray-900 dark:text-gray-100 font-medium">Auto (Vacío)</option>
        <option value="Variable" className="text-gray-900 bg-white dark:bg-gray-900 dark:text-gray-100 font-medium">Variable</option>
        <option value="Fijo" className="text-gray-900 bg-white dark:bg-gray-900 dark:text-gray-100 font-medium">Fijo</option>
        <option value="Suplido" className="text-gray-900 bg-white dark:bg-gray-900 dark:text-gray-100 font-medium">Suplido</option>
      </select>
    </div>
  );
}
