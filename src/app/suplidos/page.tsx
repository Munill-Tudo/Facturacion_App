export const dynamic = 'force-dynamic';

import { supabase } from "@/lib/supabase";
import { CreditCard, CheckCircle2, Circle, AlertCircle, Building2, Calendar, ExternalLink, Search, ChevronDown } from "lucide-react";
import { TipoSelect } from "@/components/facturas/TipoSelect";
import { EditableCell } from "@/components/facturas/EditableCell";
import { SuplidosTableClient } from "@/components/facturas/SuplidosTableClient";

export default async function SuplidosList() {
  const { data: invoices } = await supabase
    .from('facturas')
    .select('*')
    .eq('tipo', 'Suplido')
    .neq('estado', 'Eliminada')
    .order('created_at', { ascending: false });

  const facturasData = invoices || [];
  const pendingAmount = facturasData
    .filter(i => i.estado === 'Pendiente')
    .reduce((acc, curr) => acc + (Number(curr.importe) || 0) + Math.abs(Number(curr.total_irpf) || 0), 0);
  const pendingCount = facturasData.filter(i => i.estado === 'Pendiente').length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-emerald-500" />
            Control de Suplidos
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {facturasData.length} suplidos · Doble clic en una fila para ver el detalle
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 text-white shadow-lg shadow-emerald-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <h3 className="text-emerald-50 font-medium mb-1 relative z-10">Total Suplidos Pendientes de Cobrar</h3>
        <div className="flex items-end gap-4 relative z-10">
          <p className="text-4xl font-bold tracking-tight">€ {pendingAmount.toLocaleString('es-ES', {minimumFractionDigits: 2})}</p>
          <span className="mb-1 flex items-center gap-1 text-sm bg-white/20 px-2 py-1 rounded-lg backdrop-blur-md">
            <AlertCircle className="w-4 h-4" /> {pendingCount} pendientes
          </span>
        </div>
      </div>

      <SuplidosTableClient data={facturasData} />
    </div>
  );
}
