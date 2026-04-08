'use client';

import { useState, useEffect } from "react";
import { Cliente, getClientes, eliminarCliente } from "@/app/clientes/actions";
import { Users, Search, Plus, Trash2 } from "lucide-react";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { useAuth } from "@/components/auth/AuthProvider";

export function ClientesTable() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingCli, setDeletingCli] = useState<Cliente | null>(null);
  const { role } = useAuth();
  const isDireccion = role === 'administracion' || role === 'direccion';

  const fetchCli = async () => {
    setLoading(true);
    const data = await getClientes();
    setClientes(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCli();
  }, []);

  const filtered = clientes.filter(c => {
    const q = search.toLowerCase();
    return !q || c.nombre.toLowerCase().includes(q) || c.nif.toLowerCase().includes(q) || (c.email && c.email.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-emerald-500" />
            Directorio de Clientes
          </h1>
          <p className="text-gray-500 mt-1">Directorio maestro de clientes. Creado automáticamente al subir facturas emitidas.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0a0a0a] rounded-3xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            value={search} onChange={e => setSearch(e.target.value)} 
            placeholder="Buscar por Razón Social, NIF o Email..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-black text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/30 text-sm" 
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="hidden md:table w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-emerald-50 dark:bg-emerald-500/5 border-b border-emerald-100 dark:border-emerald-500/20 text-gray-500">
              <tr>
                <th className="px-6 py-4 font-semibold">Razón Social</th>
                <th className="px-6 py-4 font-semibold">NIF</th>
                <th className="px-6 py-4 font-semibold">Contacto</th>
                <th className="px-6 py-4 font-semibold">Ref. RF Maestras</th>
                <th className="px-6 py-4 font-semibold">IBAN Bancario</th>
                <th className="px-6 py-4 font-semibold">Población</th>
                {isDireccion && <th className="px-6 py-4 font-semibold text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {loading && clientes.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">Cargando directorio...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">Ningún cliente encontrado.</td></tr>
              ) : (
                filtered.map(c => (
                  <tr 
                    key={c.id} 
                    className="hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors group select-none"
                  >
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900 dark:text-white transition-colors">{c.nombre}</p>
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-600 dark:text-gray-400">{c.nif}</td>
                    <td className="px-6 py-4 text-gray-500">
                      <p>{c.email || '-'}</p>
                      <p className="text-xs">{c.telefono}</p>
                    </td>
                    <td className="px-6 py-4 font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {c.referencia_rf || 'Automático'}
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-500 text-xs">{c.iban || 'No registrado'}</td>
                    <td className="px-6 py-4 text-gray-500">{c.poblacion || '-'}</td>
                    {isDireccion && (
                      <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={e => { e.stopPropagation(); setDeletingCli(c); }}
                          title="Eliminar cliente"
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

        <div className="md:hidden divide-y divide-gray-50 dark:divide-gray-800/60">
          {loading && clientes.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">Cargando directorio...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">Ningún cliente encontrado.</div>
          ) : (
            filtered.map(c => (
              <div 
                key={`c-${c.id}`} 
                className="p-4 hover:bg-gray-50/80 dark:hover:bg-white/5 transition-colors group"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white text-base leading-tight mb-1">
                      {c.nombre}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500 mt-1">
                      <span className="font-mono bg-gray-100 dark:bg-[#1a1a1a] px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">{c.nif}</span>
                      {c.poblacion && <span>• {c.poblacion}</span>}
                    </div>
                  </div>
                  
                  {isDireccion && (
                    <div className="shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={e => { e.stopPropagation(); setDeletingCli(c); }}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Contacto</span>
                    <p className="text-gray-700 dark:text-gray-300 truncate text-xs">{c.email || '—'}</p>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">RF Maestro</span>
                    <p className="font-mono text-emerald-600 font-bold text-[11px] break-all">{c.referencia_rf || 'Automático'}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {deletingCli && (
        <ConfirmDeleteModal
          title="¿Eliminar cliente?"
          message={`El cliente "${deletingCli.nombre}" se moverá a la papelera.`}
          onClose={() => setDeletingCli(null)}
          onConfirm={async () => {
            await eliminarCliente(deletingCli.id);
            setDeletingCli(null);
            fetchCli();
          }}
        />
      )}
    </div>
  );
}
