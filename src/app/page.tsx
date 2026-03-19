"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingDown, DollarSign, Wallet, FileText, RefreshCcw, Building2, ExternalLink, CreditCard } from "lucide-react";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    gastosTotales: 0,
    gastosPendientes: 0,
    ivaTotal: 0,
    facturasPendientesCount: 0,
    suplidosPendientes: 0,
    suplidosAbonados: 0,
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [suplidosPieData, setSuplidosPieData] = useState<any[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("facturas")
        .select("*")
        .neq("estado", "Eliminada")
        .order("fecha", { ascending: true });

      if (!data) return;

      let gTotales = 0, gPendientes = 0, ivaT = 0, fPendientesCount = 0;
      let suplidosPend = 0, suplidosAbon = 0;

      const mesesNombres = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
      const monthlyData: Record<string, { base: number; iva: number }> = {};
      mesesNombres.forEach(m => monthlyData[m] = { base: 0, iva: 0 });

      data.forEach((inv) => {
        const importe = Number(inv.importe) || 0;
        const base = Number(inv.total_base) || 0;
        const iva = Number(inv.total_iva) || 0;

        // Suplidos: contar separado, NO sumar al total
        if (inv.tipo === 'Suplido') {
          if (inv.estado === 'Pendiente') suplidosPend += importe;
          else suplidosAbon += importe;
          return; // Excluir del cómputo general
        }

        gTotales += importe;
        ivaT += iva;
        if (inv.estado === 'Pendiente') { gPendientes += importe; fPendientesCount++; }

        if (inv.fecha) {
          const mes = mesesNombres[new Date(inv.fecha).getMonth()];
          monthlyData[mes].base += base;
          monthlyData[mes].iva += iva;
        }
      });

      setMetrics({ gastosTotales: gTotales, gastosPendientes: gPendientes, ivaTotal: ivaT, facturasPendientesCount: fPendientesCount, suplidosPendientes: suplidosPend, suplidosAbonados: suplidosAbon });
      setChartData(mesesNombres.map(mes => ({ name: mes, base: Number(monthlyData[mes].base.toFixed(2)), iva: Number(monthlyData[mes].iva.toFixed(2)) })));
      setSuplidosPieData([
        { name: 'Pendientes de cobro', value: Number(suplidosPend.toFixed(2)), color: '#f97316' },
        { name: 'Abonados', value: Number(suplidosAbon.toFixed(2)), color: '#10b981' },
      ]);
      setRecentInvoices([...data].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5));
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const fmt = (val: number) => `€ ${val.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <RefreshCcw className="w-8 h-8 text-indigo-500 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Resumen Financiero</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Métricas en tiempo real (suplidos contabilizados por separado).</p>
        </div>
        <button onClick={fetchData} className="px-4 py-2 bg-white dark:bg-black/40 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all shadow-sm font-medium flex items-center gap-2">
          <RefreshCcw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Gastos Totales (sin suplidos)" value={fmt(metrics.gastosTotales)} sub="Fijos + Variables" icon={<DollarSign className="w-6 h-6 text-red-500" />} colorClass="bg-red-500/10 dark:bg-red-500/20" />
        <MetricCard title="Gastos Pendientes" value={fmt(metrics.gastosPendientes)} sub="Por pagar" icon={<Wallet className="w-6 h-6 text-orange-500" />} colorClass="bg-orange-500/10 dark:bg-orange-500/20" />
        <MetricCard title="IVA Soportado" value={fmt(metrics.ivaTotal)} sub="Deducible" icon={<TrendingDown className="w-6 h-6 text-indigo-500" />} colorClass="bg-indigo-500/10 dark:bg-indigo-500/20" />
        <MetricCard title="Suplidos Pendientes" value={fmt(metrics.suplidosPendientes)} sub="Sin abonar al cliente" icon={<CreditCard className="w-6 h-6 text-emerald-500" />} colorClass="bg-emerald-500/10 dark:bg-emerald-500/20" highlight />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Evolución de Gastos (Base vs IVA)</h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBase" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorIva" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} tickFormatter={(v) => `€${v}`} />
                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', background: 'rgba(255,255,255,0.95)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} itemStyle={{ color: '#111' }} formatter={(v: any) => [`€ ${Number(v).toLocaleString()}`, '']} />
                <Area type="monotone" name="Base Imponible" dataKey="base" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorBase)" />
                <Area type="monotone" name="IVA" dataKey="iva" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorIva)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Suplidos Chart */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Estado de Suplidos</h2>
          <p className="text-xs text-gray-400 mb-4">Pendientes de cobrar vs ya abonados</p>
          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={suplidosPieData} cx="50%" cy="45%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                  {suplidosPieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(v: any) => [`€ ${Number(v).toLocaleString('es-ES', {minimumFractionDigits:2})}`, '']} />
                <Legend formatter={(value) => <span className="text-xs text-gray-600 dark:text-gray-400">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Mini summary */}
          <div className="mt-2 space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span> Pendientes</span>
              <span className="font-semibold text-orange-600">{fmt(metrics.suplidosPendientes)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Abonados</span>
              <span className="font-semibold text-emerald-600">{fmt(metrics.suplidosAbonados)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Últimas 5 Facturas Recibidas</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-sm text-gray-500">
                <th className="pb-3 font-medium px-4">Nº Rec.</th>
                <th className="pb-3 font-medium px-4">Fecha</th>
                <th className="pb-3 font-medium px-4">Proveedor</th>
                <th className="pb-3 font-medium px-4">Tipo</th>
                <th className="pb-3 font-medium px-4">Importe</th>
                <th className="pb-3 font-medium px-4">Estado</th>
                <th className="pb-3 font-medium px-4 text-right">PDF</th>
              </tr>
            </thead>
            <tbody className="text-sm border-t border-gray-100 dark:border-gray-800">
              {recentInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <td className="py-4 px-4 font-mono font-medium text-emerald-600 dark:text-emerald-400">REC-{String(inv.id).padStart(4,'0')}</td>
                  <td className="py-4 px-4 text-gray-500">{inv.fecha ? new Date(inv.fecha).toLocaleDateString('es-ES') : '—'}</td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                        <Building2 className="w-3 h-3 text-indigo-500" />
                      </div>
                      <span className="text-gray-700 dark:text-gray-300 font-medium">{inv.cliente || '—'}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full border ${
                      inv.tipo === 'Suplido' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' :
                      inv.tipo === 'Fijo' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20' :
                      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'
                    }`}>{inv.tipo || 'Variable'}</span>
                  </td>
                  <td className="py-4 px-4 font-semibold">{inv.importe != null ? fmt(Number(inv.importe)) : '—'}</td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${inv.estado === 'Pagada' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20' : 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${inv.estado === 'Pagada' ? 'bg-green-500' : 'bg-orange-500'}`}></span>
                      {inv.estado}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    {inv.file_url ? (
                      <a href={inv.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    ) : (
                      <span className="inline-flex p-1.5 text-gray-200 dark:text-gray-800"><ExternalLink className="w-4 h-4" /></span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, sub, icon, colorClass, highlight }: any) {
  return (
    <div className={`p-6 rounded-3xl bg-white dark:bg-[#0a0a0a] border shadow-sm relative overflow-hidden group ${highlight ? 'border-emerald-200 dark:border-emerald-800/50' : 'border-gray-100 dark:border-gray-800'}`}>
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={`p-3 rounded-2xl ${colorClass}`}>{icon}</div>
      </div>
      <div className="relative z-10">
        <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">{title}</h3>
        <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</p>
        <p className="text-xs text-gray-400 mt-1">{sub}</p>
      </div>
    </div>
  );
}
