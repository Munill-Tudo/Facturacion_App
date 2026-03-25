import { supabase } from "@/lib/supabase";
import { FileText, Building2, Calendar, Hash, RefreshCcw, Trash2, Users } from "lucide-react";
import { revalidatePath } from "next/cache";
import { getProveedoresEliminados } from "@/app/proveedores/actions";

async function restaurarFactura(id: number) {
  'use server'
  await supabase.from('facturas').update({ estado: 'Pendiente' }).eq('id', id);
  revalidatePath('/facturas');
  revalidatePath('/papelera');
}

async function eliminarDefinitivo(id: number) {
  'use server'
  await supabase.from('facturas').delete().eq('id', id);
  revalidatePath('/facturas');
  revalidatePath('/papelera');
}

async function restaurarProveedorAction(id: string) {
  'use server'
  await supabase.from('proveedores').update({ eliminado: false }).eq('id', id);
  revalidatePath('/proveedores');
  revalidatePath('/papelera');
}

async function eliminarProveedorDefinitivoAction(id: string) {
  'use server'
  await supabase.from('proveedores').delete().eq('id', id);
  revalidatePath('/proveedores');
  revalidatePath('/papelera');
}

export default async function PapeleraList() {
  const { data: invoices, error } = await supabase
    .from('facturas')
    .select('*')
    .eq('estado', 'Eliminada')
    .order('created_at', { ascending: false });

  if (error) console.error("Error cargando papelera:", error);
  const facturasData = invoices || [];

  const proveedoresEliminados = await getProveedoresEliminados();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-red-600 dark:text-red-500 flex items-center gap-3">
          <Trash2 className="w-8 h-8" />
          Papelera
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Los elementos eliminados se guardan aquí hasta que Dirección los elimine definitivamente.
        </p>
      </div>

      {/* FACTURAS ELIMINADAS */}
      <section>
        <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-red-500" />
          Facturas eliminadas ({facturasData.length})
        </h2>
        <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl border border-red-100 dark:border-red-900/30 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-red-50/50 dark:bg-red-500/5 border-b border-red-100 dark:border-red-900/30 text-gray-500">
                  <th className="py-3 font-medium px-4">Nº Rec.</th>
                  <th className="py-3 font-medium px-4">Nº Factura</th>
                  <th className="py-3 font-medium px-4">Fecha</th>
                  <th className="py-3 font-medium px-4">Proveedor</th>
                  <th className="py-3 font-medium px-4 font-semibold">Total</th>
                  <th className="py-3 font-medium px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {facturasData.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-500 text-sm">No hay facturas en la papelera.</td></tr>
                )}
                {facturasData.map((inv) => (
                  <tr key={inv.id} className="hover:bg-red-50/30 dark:hover:bg-red-500/5 transition-colors group">
                    <td className="py-3 px-4 font-mono font-medium text-emerald-600 dark:text-emerald-400 text-xs">Fc. Rec.-{String(inv.id).padStart(4, '0')}</td>
                    <td className="py-3 px-4 font-mono font-medium text-indigo-600 dark:text-indigo-400">
                      <div className="flex items-center gap-1.5"><Hash className="w-3 h-3" />{inv.numero || <span className="text-gray-400 text-xs">Sin nº</span>}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3" />{inv.fecha ? new Date(inv.fecha).toLocaleDateString('es-ES') : '—'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                        </div>
                        <p className="font-medium text-gray-900 dark:text-white">{inv.cliente || '—'}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                      {inv.importe != null ? `€ ${Number(inv.importe).toLocaleString('es-ES', {minimumFractionDigits: 2})}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <form action={restaurarFactura.bind(null, inv.id)}>
                          <button type="submit" className="flex items-center gap-1 px-3 py-1.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 transition-colors rounded-lg font-medium text-xs">
                            <RefreshCcw className="w-3.5 h-3.5" /> Restaurar
                          </button>
                        </form>
                        <form action={eliminarDefinitivo.bind(null, inv.id)}>
                          <button type="submit" title="Eliminar definitivamente" className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* PROVEEDORES ELIMINADOS */}
      <section>
        <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-red-500" />
          Proveedores eliminados ({proveedoresEliminados.length})
        </h2>
        <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl border border-red-100 dark:border-red-900/30 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-red-50/50 dark:bg-red-500/5 border-b border-red-100 dark:border-red-900/30 text-gray-500">
                  <th className="py-3 font-medium px-4">Razón Social</th>
                  <th className="py-3 font-medium px-4">NIF</th>
                  <th className="py-3 font-medium px-4">Email</th>
                  <th className="py-3 font-medium px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {proveedoresEliminados.length === 0 && (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-500 text-sm">No hay proveedores en la papelera.</td></tr>
                )}
                {proveedoresEliminados.map((p) => (
                  <tr key={p.id} className="hover:bg-red-50/30 dark:hover:bg-red-500/5 transition-colors">
                    <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">{p.nombre}</td>
                    <td className="py-3 px-4 font-mono text-gray-600 dark:text-gray-400">{p.nif}</td>
                    <td className="py-3 px-4 text-gray-500">{p.email || '-'}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <form action={restaurarProveedorAction.bind(null, p.id)}>
                          <button type="submit" className="flex items-center gap-1 px-3 py-1.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 transition-colors rounded-lg font-medium text-xs">
                            <RefreshCcw className="w-3.5 h-3.5" /> Restaurar
                          </button>
                        </form>
                        <form action={eliminarProveedorDefinitivoAction.bind(null, p.id)}>
                          <button type="submit" title="Eliminar definitivamente" className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
