import { useState, useEffect } from 'react';
import { X, Save, FileText, Search, Building2, CheckCircle2 } from 'lucide-react';
import { Proveedor, getProveedores } from '@/app/proveedores/actions';
import { supabase } from '@/lib/supabase';

export function ModalEditarFactura({ 
  factura, 
  onClose, 
  onSave 
}: { 
  factura: any, 
  onClose: () => void, 
  onSave: () => void 
}) {
  const [formData, setFormData] = useState<any>(factura);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Proveedor search state
  const [searchProv, setSearchProv] = useState("");
  const [showProvDropdown, setShowProvDropdown] = useState(false);

  useEffect(() => {
    getProveedores().then(setProveedores);
  }, []);

  const handleSelectProveedor = (p: Proveedor) => {
    setFormData((prev: any) => ({
      ...prev,
      nombre_proveedor: p.nombre,
      nif_proveedor: p.nif,
      direccion_proveedor: p.direccion || prev.direccion_proveedor,
      poblacion_proveedor: p.poblacion || prev.poblacion_proveedor,
      // Se guardaban CP y Provincia si existieran en la DB Facturas, por ahora la base no parece tener cp_proveedor
    }));
    setSearchProv(p.nombre);
    setShowProvDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const { id, created_at, ...updateData } = formData;
    
    const { error: saveErr } = await supabase
      .from('facturas')
      .update(updateData)
      .eq('id', id);

    if (saveErr) {
      setError(saveErr.message);
      setIsSubmitting(false);
      return;
    }

    onSave();
  };

  const filteredProv = proveedores.filter(p => 
    p.nombre.toLowerCase().includes(searchProv.toLowerCase()) || 
    p.nif.toLowerCase().includes(searchProv.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111] w-full max-w-4xl rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            <FileText className="w-5 h-5 text-indigo-500" />
            Editar Factura: {formData.numero_factura || 'Sin Número'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30 dark:bg-black/20">
          <form id="factura-form" onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-200">
                {error}
              </div>
            )}

            <div className="bg-white dark:bg-[#111] border border-indigo-100 dark:border-indigo-500/30 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-4">
                <Building2 className="w-4 h-4" />
                Vincular Inteligente con Proveedor Maestro
              </h3>
              
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    placeholder="Escribe para buscar un proveedor en tu base de datos..."
                    value={searchProv}
                    onChange={e => {
                      setSearchProv(e.target.value);
                      setShowProvDropdown(true);
                    }}
                    onFocus={() => setShowProvDropdown(true)}
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-black border border-indigo-200 dark:border-indigo-500/50 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder-gray-400" 
                  />
                  {formData.nombre_proveedor && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/20 px-2 py-1 rounded-md">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Vinculado
                    </div>
                  )}
                </div>

                {showProvDropdown && searchProv && (
                  <div className="absolute z-10 top-full mt-2 w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                    {filteredProv.length > 0 ? (
                      <ul className="py-2">
                        {filteredProv.map(p => (
                          <li 
                            key={p.id}
                            onClick={() => handleSelectProveedor(p)}
                            className="px-4 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 cursor-pointer flex justify-between items-center group"
                          >
                            <span className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{p.nombre}</span>
                            <span className="text-xs font-mono text-gray-500">{p.nif}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-4 text-sm text-gray-500 text-center">No hay proveedores que coincidan.</div>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">Al seleccionar un proveedor se autocompletarán los campos del emisor de esta factura cruzando los datos actualizados.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
              
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">Datos del Emisor de la Factura</h3>
                
                <div className="space-y-1 mt-3">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Razón Social</label>
                  <input required value={formData.nombre_proveedor || formData.cliente || ''} onChange={e => setFormData({ ...formData, nombre_proveedor: e.target.value })} 
                    className="w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none" />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">NIF/CIF</label>
                  <input required value={formData.nif_proveedor || ''} onChange={e => setFormData({ ...formData, nif_proveedor: e.target.value.toUpperCase() })} 
                    className="w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none font-mono" />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Domicilio Completo</label>
                  <input value={formData.direccion_proveedor || ''} onChange={e => setFormData({ ...formData, direccion_proveedor: e.target.value })} 
                    className="w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Población</label>
                  <input value={formData.poblacion_proveedor || ''} onChange={e => setFormData({ ...formData, poblacion_proveedor: e.target.value })} 
                    className="w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none" />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">Información Económica y Fechas</h3>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Nº Fac. Recibida</label>
                    <input 
                      value={formData.numero_recepcion || `Fc. Rec.-${String(formData.id).padStart(4,'0')}`} 
                      onChange={e => setFormData({ ...formData, numero_recepcion: e.target.value })}
                      placeholder={`Fc. Rec.-${String(formData.id).padStart(4,'0')}`}
                      className="w-full px-3 py-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500/50 outline-none font-mono font-bold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Núm. Factura</label>
                    <input value={formData.numero_factura || ''} onChange={e => setFormData({ ...formData, numero_factura: e.target.value })} 
                      className="w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none font-bold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha Emisión</label>
                    <input type="date" value={formData.fecha_emision || ''} onChange={e => setFormData({ ...formData, fecha_emision: e.target.value })} 
                      className="w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-gray-100/50 dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-gray-800 mt-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">B. Imponible (€)</label>
                    <input type="number" step="0.01" value={formData.total_base || ''} onChange={e => setFormData({ ...formData, total_base: parseFloat(e.target.value) })} 
                      className="w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none text-right font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">IVA (€)</label>
                    <input type="number" step="0.01" value={formData.total_iva || ''} onChange={e => setFormData({ ...formData, total_iva: parseFloat(e.target.value) })} 
                      className="w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none text-right font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">IRPF (€)</label>
                    <input type="number" step="0.01" value={formData.total_irpf || ''} onChange={e => setFormData({ ...formData, total_irpf: parseFloat(e.target.value) })} 
                      className="w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none text-right font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">TOTAL a Pagar (€)</label>
                    <input type="number" step="0.01" value={formData.importe || ''} onChange={e => setFormData({ ...formData, importe: parseFloat(e.target.value) })} 
                      className="w-full px-3 py-2 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-900 dark:text-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500/50 outline-none text-right font-mono font-bold text-lg" />
                  </div>
                </div>

              </div>

            </div>
          </form>
        </div>

        <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50/50 dark:bg-white/5">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="px-5 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors font-medium">
            Descartar Cambios
          </button>
          <button type="submit" form="factura-form" disabled={isSubmitting} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 font-bold flex items-center gap-2 transition-all disabled:opacity-50">
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Guardando...' : 'Guardar Factura'}
          </button>
        </div>
      </div>
    </div>
  );
}
