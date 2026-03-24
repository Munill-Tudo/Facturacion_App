'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Settings, CreditCard, PiggyBank, ArrowRightLeft, Users, Trash2, ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

export function Sidebar({ isCollapsed, setIsCollapsed }: { isCollapsed: boolean, setIsCollapsed: (val: boolean) => void }) {
  const pathname = usePathname();
  const { role } = useAuth();


  return (
    <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white/60 dark:bg-black/80 backdrop-blur-xl border-r border-gray-200/50 dark:border-gray-800/50 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200/50 dark:border-gray-800/50">
        <div className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 whitespace-nowrap">
            FacturApp
          </span>
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 transition-colors shrink-0 ${isCollapsed ? 'mx-auto' : ''}`}
          title={isCollapsed ? "Expandir" : "Colapsar"}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto overflow-x-hidden">
        {!isCollapsed && (
          <p className="px-2 mb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Menú</p>
        )}
        {role !== 'administracion' && (
          <NavItem href="/" icon={<LayoutDashboard className="w-5 h-5 shrink-0" />} label="Dashboard" isCollapsed={isCollapsed} active={pathname === '/'} />
        )}
        <NavItem href="/facturas" icon={<FileText className="w-5 h-5 shrink-0" />} label="Facturas" isCollapsed={isCollapsed} active={pathname?.startsWith('/facturas')} />
        <NavItem href="/suplidos" icon={<CreditCard className="w-5 h-5 shrink-0" />} label="Suplidos" isCollapsed={isCollapsed} active={pathname === '/suplidos'} />
        <NavItem href="/proveedores" icon={<Settings className="w-5 h-5 shrink-0" />} label="Proveedores" isCollapsed={isCollapsed} active={pathname === '/proveedores'} />
        <NavItem href="/movimientos" icon={<PiggyBank className="w-5 h-5 shrink-0" />} label="Mov. Bancarios" isCollapsed={isCollapsed} active={pathname === '/movimientos'} />
        <NavItem href="/conciliacion" icon={<ArrowRightLeft className="w-5 h-5 shrink-0" />} label="Conciliar" isCollapsed={isCollapsed} active={pathname === '/conciliacion'} />
        <NavItem href="/papelera" icon={<Trash2 className="w-5 h-5 shrink-0" />} label="Papelera" isCollapsed={isCollapsed} active={pathname === '/papelera'}
          colorClass="text-red-500 hover:text-red-600 hover:bg-red-50/60 dark:text-red-400 dark:hover:bg-red-500/10" />

        {!isCollapsed && (
          <p className="px-2 mt-6 mb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Sistema</p>
        )}
        <NavItem href="/settings" icon={<Settings className="w-5 h-5 shrink-0" />} label="Ajustes" isCollapsed={isCollapsed} active={pathname === '/settings'} />
      </nav>

      {/* User Footer */}
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
      </div>
    </aside>
  );
}

function NavItem({ href, icon, label, isCollapsed, active, colorClass }: {
  href: string; icon: React.ReactNode; label: string; isCollapsed: boolean; active?: boolean; colorClass?: string;
}) {
  const activeClass = "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 font-semibold";
  const defaultClass = "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/60 dark:hover:bg-white/5";
  const finalClass = active ? (colorClass ? colorClass + " font-semibold" : activeClass) : (colorClass || defaultClass);

  return (
    <Link
      href={href}
      title={isCollapsed ? label : undefined}
      className={`flex items-center gap-3 rounded-xl font-medium transition-all duration-200 ${finalClass} ${isCollapsed ? 'p-2.5 justify-center' : 'px-3 py-2.5'}`}
    >
      {icon}
      {!isCollapsed && <span className="whitespace-nowrap">{label}</span>}
    </Link>
  );
}
