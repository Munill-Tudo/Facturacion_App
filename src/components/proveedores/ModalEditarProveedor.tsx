import { useState } from 'react';
import { Proveedor, guardarProveedor } from '@/app/proveedores/actions';
import { X, Save, Building2, MapPin, Phone, Mail, CreditCard } from 'lucide-react';

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111] w-full max-w-2xl rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            <Building2 className="w-5 h-5 text-indigo-500" />
            {isNew ? 'Nuevo Proveedor' : 'Editar Proveedor'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="proveedor-form" onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-200">
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

        <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50/50 dark:bg-white/5">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="px-5 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors font-medium">
            Cancelar
          </button>
          <button type="submit" form="proveedor-form" disabled={isSubmitting} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 font-bold flex items-center gap-2 transition-all disabled:opacity-50">
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Guardando...' : 'Guardar Proveedor'}
          </button>
        </div>
      </div>
    </div>
  );
}
