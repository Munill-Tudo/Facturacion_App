'use client';

import { useState, useEffect } from "react";
import { Proveedor, getProveedores, eliminarProveedor } from "@/app/proveedores/actions";
import { Users, Search, Plus, Trash2 } from "lucide-react";
import { ModalEditarProveedor } from "@/components/proveedores/ModalEditarProveedor";
import { TipoDefectoSelect } from "@/components/proveedores/TipoDefectoSelect";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { useAuth } from "@/components/auth/AuthProvider";

export function ProveedoresTable() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingProv, setEditingProv] = useState<Partial<Proveedor> | null>(null);
  const [deletingProv, setDeletingProv] = useState<Proveedor | null>(null);
  const { role } = useAuth();
  const isDireccion = role === 'direccion';

  const fetchProv = async () => {
    setLoading(true);
    const data = await getProveedores();
    setProveedores(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchProv();
  }, []);

  const filtered = proveedores.filter(p => {
    const q = search.toLowerCase();
    return !q || p.nombre.toLowerCase().includes(q) || p.nif.toLowerCase().includes(q) || (p.email && p.email.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-500" />
            Directorio de Proveedores
          </h1>
          <p className="text-gray-500 mt-1">Directorio maestro. Haz doble clic en una fila para editar sus datos.</p>
        </div>
        <button 
          onClick={() => setEditingProv({})}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/20 font-bold flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> Nuevo Proveedor
        </button>
      </div>

      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            value={search} onChange={e => setSearch(e.target.value)} 
            placeholder="Buscar por Razón Social, NIF o Email..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm" 
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="hidden md:table w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-gray-800 text-gray-500">
              <tr>
                <th className="px-6 py-4 font-semibold">Razón Social</th>
                <th className="px-6 py-4 font-semibold">NIF</th>
                <th className="px-6 py-4 font-semibold">Contacto</th>
                <th className="px-6 py-4 font-semibold">Clasificación Automática</th>
                <th className="px-6 py-4 font-semibold">IBAN Bancario</th>
                <th className="px-6 py-4 font-semibold">Población</th>
                {isDireccion && <th className="px-6 py-4 font-semibold text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {loading && proveedores.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Cargando directorio...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Ningún proveedor encontrado.</td></tr>
              ) : (
                filtered.map(p => (
                  <tr 
                    key={p.id} 
                    onDoubleClick={() => setEditingProv(p)}
                    className="hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors cursor-pointer group select-none"
                    title="Doble clic para editar"
                  >
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{p.nombre}</p>
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-600 dark:text-gray-400">{p.nif}</td>
                    <td className="px-6 py-4 text-gray-500">
                      <p>{p.email || '-'}</p>
                      <p className="text-xs">{p.telefono}</p>
                    </td>
                    <td className="px-6 py-4">
                      <TipoDefectoSelect id={p.id} initialTipo={p.tipo_defecto} />
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-500 text-xs">{p.iban || 'No registrado'}</td>
                    <td className="px-6 py-4 text-gray-500">{p.poblacion || '-'}</td>
                    {isDireccion && (
                      <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          onDoubleClick={e => e.stopPropagation()}
                          onClick={e => { e.stopPropagation(); setDeletingProv(p); }}
                          title="Eliminar proveedor"
                          className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* VISTA MÓVIL: Tarjetas */}
        <div className="md:hidden divide-y divide-gray-50 dark:divide-gray-800/60">
          {loading && proveedores.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">Cargando directorio...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">Ningún proveedor encontrado.</div>
          ) : (
            filtered.map(p => (
              <div 
                key={`p-${p.id}`} 
                onDoubleClick={() => setEditingProv(p)}
                className="p-4 hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors group cursor-pointer"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white text-base leading-tight mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {p.nombre}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500 mt-1">
                      <span className="font-mono bg-gray-100 dark:bg-[#1a1a1a] px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">{p.nif}</span>
                      {p.poblacion && <span>• {p.poblacion}</span>}
                    </div>
                  </div>
                  
                  {isDireccion && (
                    <div className="shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={e => { e.stopPropagation(); setDeletingProv(p); }}
                        className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Contacto</span>
                    <p className="text-gray-700 dark:text-gray-300 truncate text-xs">{p.email || '—'}</p>
                    {p.telefono && <p className="text-gray-500 text-xs mt-0.5">{p.telefono}</p>}
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">IBAN</span>
                    <p className="font-mono text-gray-600 dark:text-gray-400 text-[11px] break-all">{p.iban || 'No registrado'}</p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800" onClick={e => e.stopPropagation()}>
                  <span className="block text-[10px] uppercase tracking-wider text-gray-400 mb-1.5">Clasificación Automática</span>
                  <TipoDefectoSelect id={p.id} initialTipo={p.tipo_defecto} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {editingProv && (
        <ModalEditarProveedor 
          proveedor={editingProv} 
          onClose={() => setEditingProv(null)} 
          onSave={() => { setEditingProv(null); fetchProv(); }} 
        />
      )}

      {deletingProv && (
        <ConfirmDeleteModal
          title="¿Eliminar proveedor?"
          message={`El proveedor "${deletingProv.nombre}" se moverá a la papelera. Solo Dirección puede eliminarlo definitivamente.`}
          onClose={() => setDeletingProv(null)}
          onConfirm={async () => {
            await eliminarProveedor(deletingProv.id);
            setDeletingProv(null);
            fetchProv();
          }}
        />
      )}
    </div>
  );
}
