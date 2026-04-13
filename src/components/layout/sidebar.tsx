'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, CreditCard, PiggyBank, ArrowRightLeft, Users, Trash2, ChevronLeft, ChevronRight, Receipt, BarChart3, Settings, SlidersHorizontal, Landmark, X, FolderKanban, Inbox } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

export function Sidebar({ isCollapsed, setIsCollapsed, isMobile, onMobileClose }: { isCollapsed: boolean, setIsCollapsed: (val: boolean) => void, isMobile?: boolean, onMobileClose?: () => void }) {
  const pathname = usePathname();
  const { role } = useAuth();

  return (
    <aside className={`flex flex-col bg-white/60 dark:bg-black/80 backdrop-blur-xl border-r border-gray-200/50 dark:border-gray-800/50 transition-all duration-300 ${isMobile ? 'relative w-full h-full z-[60]' : `fixed inset-y-0 left-0 z-50 ${isCollapsed ? 'w-20' : 'w-64'}`}`}>
      <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200/50 dark:border-gray-800/50">
        <div className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 whitespace-nowrap">
            FacturApp
          </span>
        </div>
        {isMobile ? (
          <button
            onClick={onMobileClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 transition-colors shrink-0"
            title="Cerrar Menú"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 transition-colors shrink-0 ${isCollapsed ? 'mx-auto' : ''}`}
            title={isCollapsed ? "Expandir" : "Colapsar"}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto overflow-x-hidden">
        {!isCollapsed && (
          <p className="px-2 mb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Principal</p>
        )}
        {role !== 'administracion' && (
          <>
            <NavItem
              onClick={onMobileClose}
              href="/bandeja"
              icon={<Inbox className="w-5 h-5 shrink-0" />}
              label="Bandeja operativa"
              shortLabel="Bandeja"
              isCollapsed={isCollapsed}
              active={pathname?.startsWith('/bandeja')}
              colorClass="text-fuchsia-600 hover:text-fuchsia-700 hover:bg-fuchsia-50/60 dark:text-fuchsia-400 dark:hover:bg-fuchsia-500/10"
            />
            <NavItem
              onClick={onMobileClose}
              href="/cierre"
              icon={<FolderKanban className="w-5 h-5 shrink-0" />}
              label="Cierre trimestral"
              shortLabel="Cierre"
              isCollapsed={isCollapsed}
              active={pathname?.startsWith('/cierre')}
              colorClass="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/60 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
            />
            <NavItem onClick={onMobileClose} href="/" icon={<LayoutDashboard className="w-5 h-5 shrink-0" />} label="Dashboard" isCollapsed={isCollapsed} active={pathname === '/'} />
          </>
        )}

        {!isCollapsed && (
          <p className="px-2 mt-6 mb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Ingresos & Clientes</p>
        )}
        <NavItem onClick={onMobileClose} href="/emitidas" icon={<FileText className="w-5 h-5 shrink-0 text-emerald-500" />} label="Fc. Emitidas" shortLabel="Emitidas" isCollapsed={isCollapsed} active={pathname?.startsWith('/emitidas')} colorClass="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50/60 dark:text-emerald-400 dark:hover:bg-emerald-500/10" />
        <NavItem onClick={onMobileClose} href="/clientes" icon={<Users className="w-5 h-5 shrink-0 text-emerald-500" />} label="Clientes" shortLabel="Clientes" isCollapsed={isCollapsed} active={pathname === '/clientes'} colorClass="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50/60 dark:text-emerald-400 dark:hover:bg-emerald-500/10" />

        {!isCollapsed && (
          <p className="px-2 mt-6 mb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Gastos & Proveedores</p>
        )}
        <NavItem onClick={onMobileClose} href="/facturas" icon={<FileText className="w-5 h-5 shrink-0" />} label="Fc. Recibidas" shortLabel="Recibidas" isCollapsed={isCollapsed} active={pathname?.startsWith('/facturas')} />
        <NavItem onClick={onMobileClose} href="/gastos" icon={<BarChart3 className="w-5 h-5 shrink-0" />} label="Análisis Gastos" shortLabel="Análisis" isCollapsed={isCollapsed} active={pathname?.startsWith('/gastos')}
          colorClass="text-violet-600 hover:text-violet-700 hover:bg-violet-50/60 dark:text-violet-400 dark:hover:bg-violet-500/10" />
        <NavItem onClick={onMobileClose} href="/suplidos" icon={<CreditCard className="w-5 h-5 shrink-0" />} label="Suplidos" shortLabel="Suplidos" isCollapsed={isCollapsed} active={pathname === '/suplidos'} />
        <NavItem onClick={onMobileClose} href="/proveedores" icon={<Settings className="w-5 h-5 shrink-0" />} label="Proveedores" shortLabel="Provee." isCollapsed={isCollapsed} active={pathname === '/proveedores'} />

        {!isCollapsed && (
          <p className="px-2 mt-6 mb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Tesorería</p>
        )}
        <NavItem onClick={onMobileClose} href="/movimientos" icon={<PiggyBank className="w-5 h-5 shrink-0" />} label="Mov. Bancarios" shortLabel="Mov.Banc" isCollapsed={isCollapsed} active={pathname === '/movimientos'} />
        <NavItem onClick={onMobileClose} href="/conciliacion" icon={<ArrowRightLeft className="w-5 h-5 shrink-0" />} label="Conciliar" shortLabel="Conciliar" isCollapsed={isCollapsed} active={pathname === '/conciliacion'} />

        {role !== 'administracion' && (
          <>
            {!isCollapsed && (
              <p className="px-2 mt-6 mb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Fiscal y Laboral</p>
            )}
            <NavItem onClick={onMobileClose} href="/impuestos" icon={<Landmark className="w-5 h-5 shrink-0" />} label="Impuestos" shortLabel="Imptos." isCollapsed={isCollapsed} active={pathname?.startsWith('/impuestos')}
              colorClass="text-amber-600 hover:text-amber-700 hover:bg-amber-50/60 dark:text-amber-400 dark:hover:bg-amber-500/10" />
            <NavItem onClick={onMobileClose} href="/nominas" icon={<Users className="w-5 h-5 shrink-0" />} label="Nóminas" shortLabel="Nóminas" isCollapsed={isCollapsed} active={pathname?.startsWith('/nominas')}
              colorClass="text-pink-600 hover:text-pink-700 hover:bg-pink-50/60 dark:text-pink-400 dark:hover:bg-pink-500/10" />
          </>
        )}

        {!isCollapsed && (
          <p className="px-2 mt-6 mb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Sistema</p>
        )}
        <NavItem onClick={onMobileClose} href="/papelera" icon={<Trash2 className="w-5 h-5 shrink-0" />} label="Papelera" shortLabel="Papelera" isCollapsed={isCollapsed} active={pathname === '/papelera'}
          colorClass="text-red-500 hover:text-red-600 hover:bg-red-50/60 dark:text-red-400 dark:hover:bg-red-500/10" />
        <NavItem onClick={onMobileClose} href="/ajustes" icon={<SlidersHorizontal className="w-5 h-5 shrink-0" />} label="Ajustes" shortLabel="Ajustes" isCollapsed={isCollapsed} active={pathname === '/ajustes'} />
      </nav>

      <div className="p-4 border-t border-gray-200/50 dark:border-gray-800/50">
        <div className={`flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 transition-all duration-300 ${isCollapsed ? 'p-1.5 justify-center' : 'px-3 py-2'}`}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-400 to-indigo-500 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">MT</span>
          </div>
          {!isCollapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">MT Dirección</p>
              <p className="text-xs text-gray-500 truncate">Admin</p>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <p className="mt-3 text-center text-[10px] font-mono text-gray-300 dark:text-gray-700 select-none">
            v1.012
          </p>
        )}
      </div>
    </aside>
  );
}

function NavItem({ href, icon, label, shortLabel, isCollapsed, active, colorClass, onClick }: {
  href: string; icon: React.ReactNode; label: string; shortLabel?: string; isCollapsed: boolean; active?: boolean; colorClass?: string; onClick?: () => void;
}) {
  const activeClass = "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 font-semibold";
  const defaultClass = "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/60 dark:hover:bg-white/5";
  const finalClass = active ? (colorClass ? colorClass + " font-semibold" : activeClass) : (colorClass || defaultClass);

  return (
    <Link
      href={href}
      onClick={onClick}
      title={isCollapsed && !shortLabel ? label : undefined}
      className={`flex items-center gap-3 rounded-xl font-medium transition-all duration-200 ${finalClass} ${isCollapsed ? 'p-2.5 justify-center flex-col gap-1' : 'px-3 py-2.5'}`}
    >
      {icon}
      {!isCollapsed && <span className="whitespace-nowrap">{label}</span>}
      {isCollapsed && shortLabel && <span className="text-[10px] font-semibold leading-none text-center">{shortLabel}</span>}
    </Link>
  );
}
