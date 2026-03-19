import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Building2, Calendar, Hash, ExternalLink, CreditCard } from "lucide-react";
import Link from "next/link";

export default async function FacturaDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const { data: inv } = await supabase
    .from('facturas')
    .select('*')
    .eq('id', id)
    .single();

  if (!inv) return notFound();

  const fmt = (v: number | null | undefined) =>
    v != null ? `€ ${Number(v).toLocaleString('es-ES', { minimumFractionDigits: 2 })}` : '—';

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/facturas" className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Detalle de Factura
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            REC-{String(inv.id).padStart(4, '0')} · {inv.numero || 'Sin número de factura'}
          </p>
        </div>
        {inv.file_url && (
          <a href={inv.file_url} target="_blank" rel="noopener noreferrer"
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm transition-colors shadow-sm">
            <ExternalLink className="w-4 h-4" />
            Ver PDF Original
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status badges */}
        <div className="md:col-span-3 flex flex-wrap gap-3">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${
            inv.tipo === 'Suplido' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' :
            inv.tipo === 'Fijo' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20' :
            'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'
          }`}>{inv.tipo || 'Variable'}</span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${
            inv.estado === 'Pagada' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20' :
            'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${inv.estado === 'Pagada' ? 'bg-green-500' : 'bg-orange-500'}`} />
            {inv.estado || 'Pendiente'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Proveedor */}
        <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl">
              <Building2 className="w-5 h-5 text-indigo-500" />
            </div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Proveedor</h2>
          </div>
          <div className="space-y-3">
            <InfoRow label="Razón Social" value={inv.cliente} />
            <InfoRow label="NIF/CIF" value={inv.nif_proveedor} mono />
            <InfoRow label="Dirección" value={inv.direccion_proveedor} />
            <InfoRow label="Población" value={inv.poblacion_proveedor} />
          </div>
        </div>

        {/* Factura */}
        <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-purple-50 dark:bg-purple-500/10 rounded-xl">
              <FileText className="w-5 h-5 text-purple-500" />
            </div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Datos de la Factura</h2>
          </div>
          <div className="space-y-3">
            <InfoRow label="Nº Factura" value={inv.numero} mono />
            <InfoRow label="Fecha Factura" value={inv.fecha ? new Date(inv.fecha).toLocaleDateString('es-ES') : undefined} />
            <InfoRow label="Fecha de Pago" value={inv.fecha_pago ? new Date(inv.fecha_pago).toLocaleDateString('es-ES') : 'No registrada'} />
            {inv.num_expediente && <InfoRow label="Nº Expediente" value={inv.num_expediente} mono />}
            {inv.cliente_expediente && <InfoRow label="Cliente Expediente" value={inv.cliente_expediente} />}
          </div>
        </div>
      </div>

      {/* Importes */}
      <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl">
            <CreditCard className="w-5 h-5 text-emerald-500" />
          </div>
          <h2 className="font-semibold text-gray-900 dark:text-white">Importes</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AmountCard label="Base Imponible" value={fmt(inv.total_base)} color="indigo" />
          <AmountCard label="IVA" value={fmt(inv.total_iva)} sublabel={inv.total_base ? `${Math.round((Number(inv.total_iva)/Number(inv.total_base))*100)}%` : ''} color="blue" />
          <AmountCard label="IRPF Retenido" value={fmt(inv.total_irpf)} sublabel={inv.total_irpf && Number(inv.total_irpf) > 0 ? 'Retenido' : 'Sin IRPF'} color="orange" />
          <AmountCard label="Total Factura" value={fmt(inv.importe)} color="emerald" highlight />
        </div>
      </div>

      {/* Líneas */}
      {inv.lineas && Array.isArray(inv.lineas) && inv.lineas.length > 0 && (
        <div className="bg-white dark:bg-[#0a0a0a] rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-gray-50 dark:bg-white/5 rounded-xl">
              <Hash className="w-5 h-5 text-gray-500" />
            </div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Líneas de Factura</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500">
                <th className="pb-2 font-medium text-left">Concepto</th>
                <th className="pb-2 font-medium text-right">Base</th>
                <th className="pb-2 font-medium text-right">% IVA</th>
                <th className="pb-2 font-medium text-right">IVA</th>
                <th className="pb-2 font-medium text-right">% IRPF</th>
                <th className="pb-2 font-medium text-right">IRPF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {inv.lineas.map((linea: any, i: number) => (
                <tr key={i}>
                  <td className="py-2 text-gray-700 dark:text-gray-300">{linea.concepto}</td>
                  <td className="py-2 text-right font-medium">{fmt(linea.importe_base)}</td>
                  <td className="py-2 text-right text-gray-500">{linea.porcentaje_iva}%</td>
                  <td className="py-2 text-right text-blue-600 dark:text-blue-400">{fmt(linea.importe_iva)}</td>
                  <td className="py-2 text-right text-gray-500">{linea.porcentaje_irpf || 0}%</td>
                  <td className="py-2 text-right text-orange-600 dark:text-orange-400">{fmt(linea.importe_irpf)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-gray-500 text-sm flex-shrink-0">{label}</span>
      <span className={`text-sm text-right font-medium text-gray-900 dark:text-white ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function AmountCard({ label, value, sublabel, color, highlight }: { label: string; value: string; sublabel?: string; color: string; highlight?: boolean }) {
  const colors: Record<string, string> = {
    indigo: 'from-indigo-50 to-indigo-100/50 dark:from-indigo-500/10 dark:to-indigo-500/5 border-indigo-200/50 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300',
    blue: 'from-blue-50 to-blue-100/50 dark:from-blue-500/10 dark:to-blue-500/5 border-blue-200/50 dark:border-blue-500/20 text-blue-700 dark:text-blue-300',
    orange: 'from-orange-50 to-orange-100/50 dark:from-orange-500/10 dark:to-orange-500/5 border-orange-200/50 dark:border-orange-500/20 text-orange-700 dark:text-orange-300',
    emerald: 'from-emerald-50 to-emerald-100/50 dark:from-emerald-500/10 dark:to-emerald-500/5 border-emerald-200/50 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  };
  return (
    <div className={`p-4 rounded-xl bg-gradient-to-br border ${colors[color]} ${highlight ? 'ring-2 ring-emerald-400/30' : ''}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-2xl' : ''}`}>{value}</p>
      {sublabel && <p className="text-xs mt-1 opacity-70">{sublabel}</p>}
    </div>
  );
}
