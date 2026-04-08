export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabase';
import { FileText } from 'lucide-react';
import { FacturasEmitidasTable } from '@/components/emitidas/FacturasEmitidasTable';
import { UploadEmitidaButton } from '@/components/emitidas/UploadEmitidaButton';

export default async function FacturasEmitidasList() {
  const { data: invoices } = await supabase
    .from('facturas_emitidas')
    .select('*')
    .neq('estado', 'Eliminada')
    .order('created_at', { ascending: false });

  const facturas = invoices || [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <FileText className="w-8 h-8 text-emerald-500" />
            Facturas Emitidas
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {facturas.length} facturas emitidas en total · Doble clic en una fila para ver el detalle completo · Arrastra un PDF para procesar
          </p>
        </div>
        <div>
          <UploadEmitidaButton />
        </div>
      </div>

      <FacturasEmitidasTable data={facturas} />
    </div>
  );
}
