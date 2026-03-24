import { useState, useEffect, useMemo } from 'react';
import { Proveedor, guardarProveedor } from '@/app/proveedores/actions';
import { getFacturasDeProveedor } from '@/app/proveedores/dashboardActions';
import { X, Save, Building2, MapPin, Phone, Mail, CreditCard, LayoutDashboard, FileText, Calendar, Filter, CheckCircle2 } from 'lucide-react';

const fmt = (v: number) => `€ ${Number(v || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;

export function ModalEditarProveedor({ 
  proveedor, 
  onClose, 
  onSave 
}: { 
  proveedor?: Partial<Proveedor> | null, 
  onClose: () => void, 
  onSave: () => void 
}) {
  const [formData, setFormData] = useState<Partial<Proveedor>>(proveedor || {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Dashboard & Tabs State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'editar'>(proveedor?.id ? 'dashboard' : 'editar');
  const [facturas, setFacturas] = useState<any[]>([]);
  const [loadingFac, setLoadingFac] = useState(false);
  
  // Date Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (proveedor?.id) {
      setLoadingFac(true);
      getFacturasDeProveedor(proveedor.nif || '', proveedor.nombre || '').then(data => {
        setFacturas(data);
        setLoadingFac(false);
      });
    }
  }, [proveedor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const { error: saveErr } = await guardarProveedor(formData);
    if (saveErr) {
      setError(saveErr);
      setIsSubmitting(false);
      return;
    }

    onSave();
  };

  const isNew = !proveedor?.id;

  const facturasFiltradas = useMemo(() => {
    return facturas.filter(f => {
      if (!f.fecha) return true;
      const d = new Date(f.fecha);
      const from = dateFrom ? new Date(dateFrom) : null;
      const to = dateTo ? new Date(dateTo + 'T23:59:59') : null;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [facturas, dateFrom, dateTo]);

  const totalFacturado = facturasFiltradas.reduce((acc, f) => acc + (Number(f.importe) || 0), 0);
  const totalPagado = facturasFiltradas.filter(f => f.estado === 'Pagada').reduce((acc, f) => acc + (Number(f.importe) || 0), 0);
  const totalPendiente = facturasFiltradas.filter(f => f.estado === 'Pendiente').reduce((acc, f) => acc + (Number(f.importe) || 0), 0);
  const baseImponible = facturasFiltradas.reduce((acc, f) => acc + (Number(f.total_base) || 0), 0);
  const totalIva = facturasFiltradas.reduce((acc, f) => acc + (Number(f.total_iva) || 0), 0);
  const totalIrpf = facturasFiltradas.reduce((acc, f) => acc + (Number(f.total_irpf) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111] w-full max-w-5xl rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* HEADER */}
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-inner">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-1">
                {isNew ? 'Nuevo Proveedor' : formData.nombre}
              </h2>
              {!isNew && <p className="text-sm font-mono text-gray-500 mt-0.5">NIF: {formData.nif}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && (
              <div className="bg-gray-100 dark:bg-black p-1 rounded-xl flex items-center gap-1 mr-4 border border-gray-200 dark:border-gray-800">
                <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 text-sm font-bold flex items-center gap-2 rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
                  <LayoutDashboard className="w-4 h-4" /> Dashboard
                </button>
                <button onClick={() => setActiveTab('editar')} className={`px-4 py-2 text-sm font-bold flex items-center gap-2 rounded-lg transition-all ${activeTab === 'editar' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
                  <Building2 className="w-4 h-4" /> Ficha
                </button>
              </div>
            )}
            <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* CONTENIDO INTERNO */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'dashboard' && !isNew ? (
            <div className="p-6 space-y-6 animate-in fade-in duration-300">
              {/* FILTROS DASHBOARD */}
              <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex flex-wrap items-center gap-4 justify-between shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                  <Filter className="w-4 h-4 text-indigo-500" /> Filtrar Resumen:
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 text-xs uppercase tracking-wider font-bold">Desde</span>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white cursor-pointer" />
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 text-xs uppercase tracking-wider font-bold">Hasta</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white cursor-pointer" />
                  </div>
                  {(dateFrom || dateTo) && (
                    <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 underline underline-offset-2">Limpiar</button>
                  )}
                </div>
              </div>

              {/* GRIDS DASHBOARD */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-500/5 flex flex-col justify-center">
                  <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mb-1">Total Facturado</p>
                  <p className="text-3xl font-black text-gray-900 dark:text-white">{fmt(totalFacturado)}</p>
                  <p className="text-xs text-gray-500 mt-2 font-medium">B.I: {fmt(baseImponible)} | IVA: {fmt(totalIva)} {totalIrpf > 0 ? `| IRPF: ${fmt(totalIrpf)}` : ''}</p>
                </div>
                <div className="p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-500/5 flex flex-col justify-center">
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-1">Total Pagado</p>
                  <p className="text-3xl font-black text-gray-900 dark:text-white">{fmt(totalPagado)}</p>
                </div>
                <div className="p-5 rounded-2xl border border-orange-100 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-500/5 flex flex-col justify-center">
                  <p className="text-sm font-bold text-orange-600 dark:text-orange-400 mb-1">Total Pendiente (Deuda)</p>
                  <p className="text-3xl font-black text-gray-900 dark:text-white">{fmt(totalPendiente)}</p>
                </div>
              </div>

              {/* LISTADO FACTURAS RELATIVO */}
              <div className="border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden bg-white dark:bg-black shadow-sm">
                <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-500" /> Histórico de Facturas ({facturasFiltradas.length})
                  </h3>
                </div>
                <div className="max-h-[350px] overflow-y-auto">
                  {loadingFac ? (
                    <div className="p-10 text-center text-gray-500 font-medium animate-pulse">Cargando facturas de este proveedor...</div>
                  ) : facturasFiltradas.length === 0 ? (
                    <div className="p-10 text-center text-gray-500 font-medium">No se han encontrado facturas en estos márgenes.</div>
                  ) : (
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-gray-800 text-gray-500">
                        <tr>
                          <th className="px-5 py-3 font-semibold">Fecha</th>
                          <th className="px-5 py-3 font-semibold">Número</th>
                          <th className="px-5 py-3 font-semibold text-right">Importe</th>
                          <th className="px-5 py-3 font-semibold text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                        {facturasFiltradas.map(f => (
                          <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                            <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{f.fecha ? new Date(f.fecha).toLocaleDateString('es-ES') : '-'}</td>
                            <td className="px-5 py-3 font-mono font-medium text-gray-900 dark:text-white">{f.numero || 'Sin Número'}</td>
                            <td className="px-5 py-3 text-right font-bold text-gray-900 dark:text-white">{fmt(f.importe)}</td>
                            <td className="px-5 py-3 text-center">
                              {f.estado === 'Pagada' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 text-xs font-bold ring-1 ring-inset ring-emerald-600/20">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Pagada
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 text-xs font-bold ring-1 ring-inset ring-orange-600/20">
                                  Pendiente
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 animate-in fade-in duration-300">
              <form id="proveedor-form" onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-200 font-medium">
                    {error}
                  </div>
                )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Razón Social / Nombre *</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input required value={formData.nombre || ''} onChange={e => setFormData({ ...formData, nombre: e.target.value })} 
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">NIF / CIF *</label>
                <input required value={formData.nif || ''} onChange={e => setFormData({ ...formData, nif: e.target.value.toUpperCase() })} 
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none uppercase" />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cuenta Bancaria (IBAN)</label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={formData.iban || ''} onChange={e => setFormData({ ...formData, iban: e.target.value.toUpperCase().replace(/\s/g, '') })} 
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none uppercase font-mono text-sm" placeholder="ES0000..." />
                </div>
              </div>

              <h3 className="md:col-span-2 text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2 mt-2">Datos de Contacto</h3>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="email" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} 
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Teléfono</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="tel" value={formData.telefono || ''} onChange={e => setFormData({ ...formData, telefono: e.target.value })} 
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none" />
                </div>
              </div>

              <h3 className="md:col-span-2 text-sm font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2 mt-2">Dirección Facturación</h3>

              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Domicilio</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <textarea rows={2} value={formData.direccion || ''} onChange={e => setFormData({ ...formData, direccion: e.target.value })} 
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none resize-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Población</label>
                <input value={formData.poblacion || ''} onChange={e => setFormData({ ...formData, poblacion: e.target.value })} 
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">C.P.</label>
                  <input value={formData.cp || ''} onChange={e => setFormData({ ...formData, cp: e.target.value })} 
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Provincia</label>
                  <input value={formData.provincia || ''} onChange={e => setFormData({ ...formData, provincia: e.target.value })} 
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none" />
                </div>
              </div>
            </div>
              </form>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS ONLY IN EDIT MODE OR IF NEW */}
        {(activeTab === 'editar' || isNew) && (
          <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50/50 dark:bg-white/5">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-5 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors font-bold text-sm">
              Cancelar
            </button>
            <button type="submit" form="proveedor-form" disabled={isSubmitting} className="px-6 py-2.5 text-sm rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 font-bold flex items-center gap-2 transition-all disabled:opacity-50">
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Guardando...' : 'Guardar Ficha del Proveedor'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
