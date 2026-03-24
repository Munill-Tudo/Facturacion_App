'use client';

import { useState, useEffect } from "react";
import { Proveedor, getProveedores } from "@/app/proveedores/actions";
import { Users, Search, Plus } from "lucide-react";
import { ModalEditarProveedor } from "@/components/proveedores/ModalEditarProveedor";

export function ProveedoresTable() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingProv, setEditingProv] = useState<Partial<Proveedor> | null>(null);

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
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-gray-800 text-gray-500">
              <tr>
                <th className="px-6 py-4 font-semibold">Razón Social</th>
                <th className="px-6 py-4 font-semibold">NIF</th>
                <th className="px-6 py-4 font-semibold">Contacto</th>
                <th className="px-6 py-4 font-semibold">IBAN Bancario</th>
                <th className="px-6 py-4 font-semibold">Población</th>
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
                    <td className="px-6 py-4 font-mono text-gray-500 text-xs">{p.iban || 'No registrado'}</td>
                    <td className="px-6 py-4 text-gray-500">{p.poblacion || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingProv && (
        <ModalEditarProveedor 
          proveedor={editingProv} 
          onClose={() => setEditingProv(null)} 
          onSave={() => { setEditingProv(null); fetchProv(); }} 
        />
      )}
    </div>
  );
}
