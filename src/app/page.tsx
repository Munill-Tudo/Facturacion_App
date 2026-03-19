"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingDown, DollarSign, Wallet, RefreshCcw, Building2, ExternalLink, CreditCard, ChevronDown } from "lucide-react";

function getISOWeek(d: Date): number {
  const date = new Date(d);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getQuarter(d: Date): number {
  return Math.floor(d.getMonth() / 3) + 1;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<any[]>([]);

  // Filters State
  const [periodMode, setPeriodMode] = useState<'todo' | 'mes' | 'trimestre' | 'año'>('todo');
  const [selYear, setSelYear] = useState(new Date().getFullYear().toString());
  const [selMonth, setSelMonth] = useState((new Date().getMonth() + 1).toString());
  const [selQ, setSelQ] = useState(getQuarter(new Date()).toString());

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("facturas")
        .select("*")
        .neq("estado", "Eliminada")
        .order("fecha", { ascending: true });

      if (data) {
        setRawData(data);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const years = useMemo(() => {
    const ys = new Set(rawData.map(i => i.fecha ? new Date(i.fecha).getFullYear().toString() : '').filter(Boolean));
    return Array.from(ys).sort().reverse();
  }, [rawData]);

  const filteredData = useMemo(() => {
    return rawData.filter(inv => {
      if (!inv.fecha && periodMode !== 'todo') return false;
      const d = inv.fecha ? new Date(inv.fecha) : null;

      if (!d) return periodMode === 'todo';
      if (periodMode === 'mes') return d.getFullYear().toString() === selYear && (d.getMonth() + 1).toString() === selMonth;
      if (periodMode === 'trimestre') return d.getFullYear().toString() === selYear && getQuarter(d).toString() === selQ;
      if (periodMode === 'año') return d.getFullYear().toString() === selYear;
      return true; // 'todo'
    });
  }, [rawData, periodMode, selYear, selMonth, selQ]);

  const metrics = useMemo(() => {
    let gTotales = 0, gPendientes = 0, ivaT = 0, fPendientesCount = 0;
    let suplidosPend = 0, suplidosAbon = 0;

    filteredData.forEach((inv) => {
      const importe = Number(inv.importe) || 0;
      const iva = Number(inv.total_iva) || 0;

      if (inv.tipo === 'Suplido') {
        if (inv.estado === 'Pendiente') suplidosPend += importe;
        else suplidosAbon += importe;
        return;
      }

      gTotales += importe;
      ivaT += iva;
      if (inv.estado === 'Pendiente') { gPendientes += importe; fPendientesCount++; }
    });

    return { gastosTotales: gTotales, gastosPendientes: gPendientes, ivaTotal: ivaT, facturasPendientesCount: fPendientesCount, suplidosPendientes: suplidosPend, suplidosAbonados: suplidosAbon };
  }, [filteredData]);

  const chartData = useMemo(() => {
    const mesesNombres = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    const monthlyData: Record<string, { base: number; iva: number }> = {};
    mesesNombres.forEach(m => monthlyData[m] = { base: 0, iva: 0 });

    filteredData.forEach((inv) => {
      if (inv.tipo === 'Suplido') return;
      const base = Number(inv.total_base) || 0;
      const iva = Number(inv.total_iva) || 0;
      if (inv.fecha) {
        const mes = mesesNombres[new Date(inv.fecha).getMonth()];
        monthlyData[mes].base += base;
        monthlyData[mes].iva += iva;
      }
    });

    // Si está en 'mes', igual mostrar todo el año del selected year pero filtrando el mes? 
    // Wait, the line chart over months only makes sense if we show multiple months.
    // If period is 'año', we show all months of that year.
    // If period is 'todo', we show all months aggregated by all years or just all months.
    // Let's keep the exact same chart logic (it groups by month abbreviation).
    return mesesNombres.map(mes => ({ name: mes, base: Number(monthlyData[mes].base.toFixed(2)), iva: Number(monthlyData[mes].iva.toFixed(2)) }));
  }, [filteredData]);

  const suplidosPieData = useMemo(() => {
    return [
      { name: 'Pendientes de cobro', value: Number(metrics.suplidosPendientes.toFixed(2)), color: '#f97316' },
      { name: 'Abonados', value: Number(metrics.suplidosAbonados.toFixed(2)), color: '#10b981' },
    ];
  }, [metrics]);

  const recentInvoices = useMemo(() => {
    return [...filteredData].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
  }, [filteredData]);

  const fmt = (val: number) => `€ ${val.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <RefreshCcw className="w-8 h-8 text-indigo-500 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* HEADER & FILTERS */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 bg-white dark:bg-[#0a0a0a] p-5 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Resumen General</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Métricas en tiempo real basadas en tu selección temporal.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex flex-wrap gap-2 items-center bg-gray-50 dark:bg-black/50 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-800">
            {(['todo','mes','trimestre','año'] as const).map(m => (
              <button key={m} onClick={() => setPeriodMode(m)}
                className={`px-4 py-1.5 text-sm rounded-xl font-medium transition-all ${periodMode === m ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {(periodMode === 'mes' || periodMode === 'trimestre' || periodMode === 'año') && (
              <div className="relative">
                <select value={selYear} onChange={e => setSelYear(e.target.value)} className="pl-4 pr-10 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-[#111] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 appearance-none font-medium shadow-sm">
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                  {!years.includes(new Date().getFullYear().toString()) && <option value={new Date().getFullYear().toString()}>{new Date().getFullYear()}</option>}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            )}
            
            {periodMode === 'mes' && (
              <div className="relative">
                <select value={selMonth} onChange={e => setSelMonth(e.target.value)} className="pl-4 pr-10 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-[#111] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 appearance-none font-medium shadow-sm">
                  {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m,i) => (
                    <option key={i+1} value={(i+1).toString()}>{m}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            )}
            
            {periodMode === 'trimestre' && (
              <div className="relative">
                <select value={selQ} onChange={e => setSelQ(e.target.value)} className="pl-4 pr-10 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-[#111] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 appearance-none font-medium shadow-sm">
                  <option value="1">1er Trimestre</option>
                  <option value="2">2º Trimestre</option>
                  <option value="3">3er Trimestre</option>
                  <option value="4">4º Trimestre</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            )}

            <button onClick={fetchData} className="p-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-all shadow-sm flex items-center justify-center">
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex justify-between items-center">
            Evolución de Gastos (Base vs IVA)
            {periodMode !== 'todo' && <span className="text-xs font-normal text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-full">Según filtros</span>}
          </h2>
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
          <div className="flex justify-between items-start mb-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Estado de Suplidos</h2>
            {periodMode !== 'todo' && <span className="text-xs font-normal text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full">{periodMode === 'mes' ? 'Mes actual' : 'Filtrado'}</span>}
          </div>
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
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Últimas 5 Facturas (Período Seleccionado)</h2>
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
              {recentInvoices.length > 0 ? recentInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <td className="py-4 px-4 font-mono font-medium text-emerald-600 dark:text-emerald-400">REC-{String(inv.id).padStart(4,'0')}</td>
                  <td className="py-4 px-4 text-gray-500">{inv.fecha ? new Date(inv.fecha).toLocaleDateString('es-ES') : '—'}</td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                        <Building2 className="w-3 h-3 text-indigo-500" />
                      </div>
                      <span className="text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">{inv.cliente || '—'}</span>
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
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${inv.estado === 'Pagada' || inv.estado === 'Abonado' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20' : 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${inv.estado === 'Pagada' || inv.estado === 'Abonado' ? 'bg-green-500' : 'bg-orange-500'}`}></span>
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
              )) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    No hay facturas en el período seleccionado.
                  </td>
                </tr>
              )}
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
