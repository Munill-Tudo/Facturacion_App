export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabase';
import { FileText } from 'lucide-react';
import { FacturasTable } from '@/components/facturas/FacturasTable';
import { UploadInvoiceButton } from '@/components/facturas/UploadInvoiceButton';

export default async function FacturasList() {
  const { data: invoices } = await supabase
    .from('facturas')
    .select('*')
    .neq('estado', 'Eliminada')
    .order('created_at', { ascending: false });

  const facturas = invoices || [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <FileText className="w-8 h-8 text-indigo-500" />
            Facturas Recibidas
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {facturas.length} facturas en total · Doble clic en una fila para ver el detalle completo · Arrastra un PDF para subir
          </p>
        </div>
        <div>
          <UploadInvoiceButton />
        </div>
      </div>

      <FacturasTable data={facturas} />
    </div>
  );
}
