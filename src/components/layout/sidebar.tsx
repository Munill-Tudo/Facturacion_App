import Link from "next/link";
import { LayoutDashboard, FileText, Settings, CreditCard, PiggyBank, Receipt, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

export function Sidebar({ isCollapsed, setIsCollapsed }: { isCollapsed: boolean, setIsCollapsed: (val: boolean) => void }) {
  return (
    <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white/50 dark:bg-black/50 backdrop-blur-xl border-r border-gray-200/50 dark:border-gray-800/50 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
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
          title={isCollapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto overflow-x-hidden">
        <div className={`mb-4 transition-all duration-300 ${isCollapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100 h-auto'}`}>
          <p className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
            Menu Principal
          </p>
        </div>
        
        <NavItem href="/" icon={<LayoutDashboard className="w-5 h-5 shrink-0" />} label="Dashboard" isCollapsed={isCollapsed} colorClass="text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-500/10" />
        <NavItem href="/facturas" icon={<FileText className="w-5 h-5 shrink-0" />} label="Facturas" isCollapsed={isCollapsed} />
        <NavItem href="/suplidos" icon={<CreditCard className="w-5 h-5 shrink-0" />} label="Suplidos" isCollapsed={isCollapsed} />
        <NavItem href="/conciliacion" icon={<PiggyBank className="w-5 h-5 shrink-0" />} label="Bancos" isCollapsed={isCollapsed} />
        <NavItem href="/papelera" icon={<Trash2 className="w-5 h-5 shrink-0" />} label="Papelera" isCollapsed={isCollapsed} colorClass="text-red-500/80 hover:text-red-600 hover:bg-red-50 dark:text-red-400/80 dark:hover:text-red-400 dark:hover:bg-red-500/10" />

        <div className={`mt-8 mb-4 transition-all duration-300 ${isCollapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100 h-auto'}`}>
          <p className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
            Configuración
          </p>
        </div>

        <NavItem href="/settings" icon={<Settings className="w-5 h-5 shrink-0" />} label="Ajustes" isCollapsed={isCollapsed} />
      </nav>

      <div className="p-4 border-t border-gray-200/50 dark:border-gray-800/50">
        <div className={`flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-gray-800 overflow-hidden transition-all duration-300 ${isCollapsed ? 'p-1 justify-center' : 'px-3 py-2'}`}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-400 to-indigo-500 shrink-0"></div>
          <div className={`flex-1 overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">MT Dirección</p>
            <p className="text-xs text-gray-500 truncate">Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ href, icon, label, isCollapsed, colorClass }: { href: string, icon: React.ReactNode, label: string, isCollapsed: boolean, colorClass?: string }) {
  const defaultColorClass = "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-white/5";
  const finalColorClass = colorClass || defaultColorClass;
  
  return (
    <Link href={href} className={`flex items-center gap-3 rounded-xl font-medium transition-all duration-200 group ${finalColorClass} ${isCollapsed ? 'p-2.5 justify-center' : 'px-3 py-2.5'}`} title={isCollapsed ? label : undefined}>
      {icon}
      <span className={`whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 overflow-hidden hidden' : 'w-auto opacity-100'}`}>
        {label}
      </span>
    </Link>
  );
}
