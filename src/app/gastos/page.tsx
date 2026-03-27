export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabase';
import { GastosAnalisisClient } from '@/components/gastos/GastosAnalisisClient';
import { BarChart3 } from 'lucide-react';
import { TIPOS_GASTO } from '@/lib/tipos-gasto';
import { getTiposGastoFromDB } from './actions';

export default async function GastosPage() {
  const [
    { data: facturas },
    dbTipos
  ] = await Promise.all([
    supabase
      .from('facturas')
      .select('id, fecha, importe, total_base, total_iva, tipo_gasto, subtipo_gasto, nombre_proveedor, estado')
      .neq('estado', 'Eliminada')
      .order('fecha', { ascending: false }),
    getTiposGastoFromDB()
  ]);

  // Fallback to static types if DB is empty (initial state)
  const finalTipos = dbTipos.length > 0 ? dbTipos : TIPOS_GASTO;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-violet-500" />
          Análisis de Gastos
        </h1>
        <p className="text-gray-500 mt-1">Estadísticas por tipo de gasto · Filtra por período</p>
      </div>
      <GastosAnalisisClient facturas={facturas || []} tipos={finalTipos as any} />
    </div>
  );
}
