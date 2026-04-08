"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Wallet, RefreshCcw, Building2, ExternalLink, CreditCard, ChevronDown, Percent, Scale, Activity } from "lucide-react";

function getQuarter(d: Date): number { return Math.floor(d.getMonth() / 3) + 1; }

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<{ emitidas: any[]; recibidas: any[] }>({ emitidas: [], recibidas: [] });

  const [periodMode, setPeriodMode] = useState<'todo' | 'libre' | 'mes' | 'trimestre' | 'año'>('año');
  const [selYear, setSelYear] = useState(new Date().getFullYear().toString());
  const [selMonth, setSelMonth] = useState((new Date().getMonth() + 1).toString());
  const [selQ, setSelQ] = useState(getQuarter(new Date()).toString());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recibidasRes, emitidasRes] = await Promise.all([
        supabase.from("facturas").select("*").neq("estado", "Eliminada"),
        supabase.from("facturas_emitidas").select("*").neq("estado", "Eliminada")
      ]);
      setRawData({
        recibidas: recibidasRes.data || [],
        emitidas: emitidasRes.data || []
      });
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const years = useMemo(() => {
    const ys = new Set([
      ...rawData.recibidas.map(i => i.fecha ? new Date(i.fecha).getFullYear().toString() : ''),
      ...rawData.emitidas.map(i => i.fecha ? new Date(i.fecha).getFullYear().toString() : '')
    ].filter(Boolean));
    return Array.from(ys).sort().reverse();
  }, [rawData]);

  const { filteredE, filteredR } = useMemo(() => {
    const filterFn = (inv: any) => {
      if (!inv.fecha && periodMode !== 'todo') return false;
      const d = inv.fecha ? new Date(inv.fecha) : null;
      if (!d) return periodMode === 'todo';
      if (periodMode === 'mes') return d.getFullYear().toString() === selYear && (d.getMonth() + 1).toString() === selMonth;
      if (periodMode === 'trimestre') return d.getFullYear().toString() === selYear && getQuarter(d).toString() === selQ;
      if (periodMode === 'año') return d.getFullYear().toString() === selYear;
      if (periodMode === 'libre') {
        const from = dateFrom ? new Date(dateFrom) : null;
        const to = dateTo ? new Date(dateTo + 'T23:59:59') : null;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      }
      return true;
    };
    return {
      filteredE: rawData.emitidas.filter(filterFn),
      filteredR: rawData.recibidas.filter(filterFn)
    };
  }, [rawData, periodMode, selYear, selMonth, selQ, dateFrom, dateTo]);

  const metrics = useMemo(() => {
    let ingBase = 0, gasBase = 0;
    let ingPdte = 0, gasPdte = 0, supPdte = 0, supAbon = 0;
    let ivaRep = 0, ivaSop = 0;

    filteredE.forEach(e => {
       ingBase += Number(e.total_base) || 0;
       ivaRep += Number(e.total_iva) || 0;
       if (e.estado === 'Pendiente') ingPdte += Number(e.importe) || 0;
    });

    filteredR.forEach(r => {
      const imp = Number(r.importe) || 0;
      if (r.tipo === 'Suplido') {
         if (r.estado === 'Pendiente') supPdte += imp;
         else supAbon += imp;
      } else {
         gasBase += Number(r.total_base) || 0;
         ivaSop += Number(r.total_iva) || 0;
         if (r.estado === 'Pendiente') gasPdte += imp;
      }
    });

    const beneficio = ingBase - gasBase;
    const margen = ingBase > 0 ? (beneficio / ingBase) * 100 : 0;
    const ivaDiferencia = ivaRep - ivaSop;

    return { ingBase, gasBase, beneficio, margen, ingPdte, gasPdte, supPdte, supAbon, ivaRep, ivaSop, ivaDiferencia };
  }, [filteredE, filteredR]);

  const chartData = useMemo(() => {
    const mesesNombres = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    const monthlyData: Record<string, { ingresos: number; gastos: number }> = {};
    mesesNombres.forEach(m => monthlyData[m] = { ingresos: 0, gastos: 0 });

    filteredE.forEach(e => {
        if (e.fecha) {
            const mes = mesesNombres[new Date(e.fecha).getMonth()];
            monthlyData[mes].ingresos += Number(e.total_base) || 0;
        }
    });

    filteredR.forEach(r => {
        if (r.tipo !== 'Suplido' && r.fecha) {
            const mes = mesesNombres[new Date(r.fecha).getMonth()];
            monthlyData[mes].gastos += Number(r.total_base) || 0;
        }
    });

    return mesesNombres.map(mes => ({
        name: mes, 
        Ingresos: Number(monthlyData[mes].ingresos.toFixed(2)), 
        Gastos: Number(monthlyData[mes].gastos.toFixed(2))
    }));
  }, [filteredE, filteredR]);

  const recentEvents = useMemo(() => {
    const evts = [
        ...filteredE.map(e => ({ ...e, __origen: 'emitida' })),
        ...filteredR.map(r => ({ ...r, __origen: 'recibida' }))
    ].sort((a, b) => new Date(b.created_at || b.fecha).getTime() - new Date(a.created_at || a.fecha).getTime()).slice(0, 7);
    return evts;
  }, [filteredE, filteredR]);

  const fmt = (val: number) => `€ ${val.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <RefreshCcw className="w-10 h-10 text-emerald-500 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto">
      
      {/* HEADER & FILTERS */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 bg-white/70 dark:bg-[#0a0a0a]/70 backdrop-blur-3xl p-5 rounded-3xl border border-white/40 dark:border-gray-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none relative overflow-hidden z-10">
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl -z-10"></div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-500 dark:from-white dark:to-gray-400">Cuadro de Mandos</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">Control Financiero Analítico a Tiempo Real.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex flex-wrap gap-2 items-center bg-gray-100/50 dark:bg-black/50 p-1.5 rounded-2xl border border-gray-200/50 dark:border-gray-800">
            {(['todo','libre','mes','trimestre','año'] as const).map(m => (
              <button key={m} onClick={() => setPeriodMode(m)}
                className={`px-4 py-1.5 text-sm rounded-xl font-bold transition-all ${periodMode === m ? 'bg-white dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-gray-200/50 dark:ring-emerald-500/30' : 'text-gray-500 hover:text-gray-900 dark:text-gray-500 dark:hover:text-gray-200'}`}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {periodMode === 'libre' && (
              <>
                <div className="flex items-center gap-2 text-sm bg-white dark:bg-[#111] border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2 shadow-sm">
                  <span className="text-gray-400 text-xs font-bold">Desde</span>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-transparent text-gray-700 dark:text-gray-200 focus:outline-none appearance-none font-medium text-xs w-full" />
                </div>
                <div className="flex items-center gap-2 text-sm bg-white dark:bg-[#111] border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2 shadow-sm">
                  <span className="text-gray-400 text-xs font-bold">Hasta</span>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-transparent text-gray-700 dark:text-gray-200 focus:outline-none appearance-none font-medium text-xs w-full" />
                </div>
              </>
            )}
            
            {(periodMode === 'mes' || periodMode === 'trimestre' || periodMode === 'año') && (
              <div className="relative">
                <select value={selYear} onChange={e => setSelYear(e.target.value)} className="pl-4 pr-10 py-2 text-sm font-bold border border-gray-100 dark:border-gray-800 rounded-xl bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 appearance-none shadow-sm cursor-pointer">
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                  {!years.includes(new Date().getFullYear().toString()) && <option value={new Date().getFullYear().toString()}>{new Date().getFullYear()}</option>}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 pointer-events-none" />
              </div>
            )}
            
            {periodMode === 'mes' && (
              <div className="relative">
                <select value={selMonth} onChange={e => setSelMonth(e.target.value)} className="pl-4 pr-10 py-2 text-sm font-bold border border-gray-100 dark:border-gray-800 rounded-xl bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 appearance-none shadow-sm cursor-pointer">
                  {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m,i) => (<option key={i+1} value={(i+1).toString()}>{m}</option>))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 pointer-events-none" />
              </div>
            )}
            
            {periodMode === 'trimestre' && (
              <div className="relative">
                <select value={selQ} onChange={e => setSelQ(e.target.value)} className="pl-4 pr-10 py-2 text-sm font-bold border border-gray-100 dark:border-gray-800 rounded-xl bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 appearance-none shadow-sm cursor-pointer">
                  <option value="1">1er Trimestre</option><option value="2">2º Trimestre</option><option value="3">3er Trimestre</option><option value="4">4º Trimestre</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 pointer-events-none" />
              </div>
            )}

            <button onClick={fetchData} className="p-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-all shadow-sm">
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* TITANIC METRICS ROW (Beneficio Real) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-500 text-white to-emerald-600 shadow-lg shadow-emerald-500/20 relative overflow-hidden flex flex-col justify-between min-h-[140px] group">
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
          <div>
            <p className="text-emerald-100 font-medium text-sm flex items-center gap-2"><TrendingUp className="w-5 h-5"/> Ingresos Operativos</p>
            <p className="text-xs text-emerald-200 mt-1 uppercase tracking-wider font-semibold">BASE IMPONIBLE (Sin Iva)</p>
          </div>
          <p className="text-4xl font-extrabold tracking-tight mt-2">{fmt(metrics.ingBase)}</p>
        </div>

        <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-500 text-white to-indigo-600 shadow-lg shadow-indigo-500/20 relative overflow-hidden flex flex-col justify-between min-h-[140px] group">
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
          <div>
            <p className="text-indigo-100 font-medium text-sm flex items-center gap-2"><TrendingDown className="w-5 h-5"/> Gastos Operativos</p>
            <p className="text-xs text-indigo-200 mt-1 uppercase tracking-wider font-semibold">BASE IMPONIBLE (Sin Suplidos)</p>
          </div>
          <p className="text-4xl font-extrabold tracking-tight mt-2">{fmt(metrics.gasBase)}</p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#0a0a0a] border-2 border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[140px]">
          <div className="flex justify-between items-start">
            <div>
                <p className="text-gray-500 dark:text-gray-400 font-medium text-sm flex items-center gap-2"><Activity className="w-5 h-5 text-gray-800 dark:text-white"/> Beneficio Neto Bruto</p>
                <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider font-semibold">Diferencia Neta Ex-IVA</p>
            </div>
            {metrics.beneficio > 0 && (
                <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-bold flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> {metrics.margen.toFixed(1)}% Margen
                </div>
            )}
          </div>
          <p className={`text-4xl font-extrabold tracking-tight mt-2 ${metrics.beneficio < 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>{fmt(metrics.beneficio)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* BIG MIXED CHART */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex justify-between items-center">
            Flujo de Rentabilidad Acumulado en el Periodo
            <span className="text-[10px] font-bold uppercase text-gray-400 bg-gray-50 dark:bg-white/5 py-1 px-3 rounded-full tracking-wider">Base Imponible</span>
          </h2>
          <div className="flex-1 w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIng" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorGas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.1} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12, fontWeight: 500 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#888', fontSize: 12 }} tickFormatter={(v) => `€${v}`} />
                <RechartsTooltip contentStyle={{ borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)', background: 'rgba(255,255,255,0.95)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} itemStyle={{ color: '#111', fontWeight: 600 }} formatter={(v: any) => [`€ ${Number(v).toLocaleString()}`, '']} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '13px', fontWeight: 500, paddingTop: '10px' }} />
                <Area type="monotone" name="Ingresos" dataKey="Ingresos" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIng)" />
                <Area type="monotone" name="Gastos" dataKey="Gastos" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorGas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SIDE METRICS & DEBTS */}
        <div className="space-y-4 flex flex-col">
          {/* DEBTS BOX */}
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 rounded-3xl p-5 shadow-sm flex-1">
             <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider flex items-center gap-2"><Wallet className="w-4 h-4"/> Estado de Liquidez y Riesgo</h3>
             
             <div className="space-y-4">
                <div className="p-3 bg-red-50/50 dark:bg-red-500/5 rounded-2xl border border-red-100/50 dark:border-red-500/10 flex justify-between items-center group cursor-default">
                   <div>
                       <p className="text-xs font-semibold text-red-600 dark:text-red-400">Gastos sin pagar</p>
                       <p className="text-[10px] text-red-400/80">Con IVA incluido</p>
                   </div>
                   <span className="font-extrabold text-red-700 dark:text-red-300 group-hover:scale-105 transition-transform">{fmt(metrics.gasPdte)}</span>
                </div>

                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-500/5 rounded-2xl border border-emerald-100/50 dark:border-emerald-500/10 flex justify-between items-center group cursor-default">
                   <div>
                       <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Ingresos bloqueados</p>
                       <p className="text-[10px] text-emerald-400/80">Falta cobro por cliente</p>
                   </div>
                   <span className="font-extrabold text-emerald-700 dark:text-emerald-300 group-hover:scale-105 transition-transform">{fmt(metrics.ingPdte)}</span>
                </div>

                <div className="p-3 bg-orange-50/50 dark:bg-orange-500/5 rounded-2xl border border-orange-100/50 dark:border-orange-500/10 flex justify-between items-center group cursor-default">
                   <div>
                       <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">Suplidos pend. abonar</p>
                       <p className="text-[10px] text-orange-400/80">Dinero adelantado</p>
                   </div>
                   <span className="font-extrabold text-orange-700 dark:text-orange-300 group-hover:scale-105 transition-transform">{fmt(metrics.supPdte)}</span>
                </div>
             </div>
          </div>

          {/* IVA BOX */}
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 rounded-3xl p-5 shadow-sm">
             <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider flex items-center gap-2"><Scale className="w-4 h-4"/> Balanza de IVA</h3>
             
             <div className="flex items-end justify-between border-b border-gray-100 dark:border-gray-800 pb-3 mb-3">
                 <div>
                     <p className="text-xs font-semibold text-gray-500">Repercutido (Cobrado)</p>
                     <p className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{fmt(metrics.ivaRep)}</p>
                 </div>
                 <div className="text-right">
                     <p className="text-xs font-semibold text-gray-500">Soportado (Pagado)</p>
                     <p className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{fmt(metrics.ivaSop)}</p>
                 </div>
             </div>
             <div className="flex justify-between items-center">
                 <p className="text-xs font-semibold text-gray-500">Resultado a Liquidar</p>
                 <span className={`text-sm font-extrabold px-2.5 py-1 rounded-lg ${metrics.ivaDiferencia > 0 ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400'}`}>
                     {metrics.ivaDiferencia > 0 ? 'Pagar al ente' : 'A Compensar'} {fmt(Math.abs(metrics.ivaDiferencia))}
                 </span>
             </div>
          </div>
        </div>

      </div>

      {/* COMBINED RECENT ACTIVITY */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Actividad y Registros Recientes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-sm text-gray-400 uppercase tracking-wider">
                <th className="pb-3 font-semibold px-4">Referencia</th>
                <th className="pb-3 font-semibold px-4">Fecha</th>
                <th className="pb-3 font-semibold px-4">Tercero Mplicado</th>
                <th className="pb-3 font-semibold px-4">Importe C/IVA</th>
                <th className="pb-3 font-semibold px-4">Nicho</th>
                <th className="pb-3 font-semibold px-4">Estado</th>
              </tr>
            </thead>
            <tbody className="text-sm border-t border-gray-100 dark:border-gray-800">
              {recentEvents.length > 0 ? recentEvents.map((evt: any) => (
                <tr key={`${evt.__origen}-${evt.id}`} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors group cursor-default">
                  <td className="py-4 px-4 font-mono font-bold text-gray-600 dark:text-gray-400 text-xs">
                    {evt.numero || (evt.__origen === 'emitida' ? `Emi-${evt.id}` : `Rec-${evt.id}`)}
                  </td>
                  <td className="py-4 px-4 text-gray-500 font-medium">{evt.fecha ? new Date(evt.fecha).toLocaleDateString('es-ES') : '—'}</td>
                  <td className="py-4 px-4">
                    <span className="text-gray-800 dark:text-gray-200 font-bold whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px] block">{evt.cliente || evt.nombre_proveedor || '—'}</span>
                  </td>
                  <td className={`py-4 px-4 font-extrabold ${evt.__origen === 'emitida' ? 'text-emerald-600' : 'text-indigo-600'}`}>
                    {evt.__origen === 'emitida' ? '+' : '-'}{fmt(Number(evt.importe) || 0)}
                  </td>
                  <td className="py-4 px-4">
                    <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                      evt.__origen === 'emitida' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' :
                      'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
                    }`}>
                      {evt.__origen === 'emitida' ? 'Ingreso' : 'Gasto'}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${['Pagada', 'Cobrada'].includes(evt.estado === 'Pagada' && evt.__origen==='emitida'?'Cobrada':evt.estado) ? 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400' : 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400'}`}>
                      {evt.estado === 'Pagada' && evt.__origen==='emitida'?'Cobrada':evt.estado}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500 font-medium">
                    Sin movimientos para el periodo seleccionado.
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
