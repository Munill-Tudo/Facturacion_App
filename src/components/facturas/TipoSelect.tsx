'use client';

import { useTransition } from 'react';
import { changeTipoFactura } from '@/app/facturas/actions';

export function TipoSelect({ id, initialTipo }: { id: number, initialTipo?: string }) {
  const [isPending, startTransition] = useTransition();
  const currentVal = initialTipo || 'Variable';

  return (
    <select 
      value={currentVal} 
      onChange={(e) => startTransition(() => changeTipoFactura(id, e.target.value))}
      disabled={isPending}
      className={`text-xs font-semibold px-2.5 py-1 rounded-full border outline-none cursor-pointer appearance-none transition-all hover:scale-105 ${
        isPending ? 'opacity-50' : ''
      } ${
        currentVal === 'Suplido' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' : 
        currentVal === 'Fijo' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20' : 
        'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'
      }`}
    >
      <option value="Variable" className="text-gray-900 bg-white dark:bg-gray-900 dark:text-gray-100 font-medium">Variable</option>
      <option value="Fijo" className="text-gray-900 bg-white dark:bg-gray-900 dark:text-gray-100 font-medium">Fijo</option>
      <option value="Suplido" className="text-gray-900 bg-white dark:bg-gray-900 dark:text-gray-100 font-medium">Suplido</option>
    </select>
  );
}
