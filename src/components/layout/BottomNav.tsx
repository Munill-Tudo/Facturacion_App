'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, CreditCard, Trash2, PiggyBank } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();

  const items = [
    { href: "/", icon: LayoutDashboard, label: "Inicio" },
    { href: "/facturas", icon: FileText, label: "Facturas" },
    { href: "/suplidos", icon: CreditCard, label: "Suplidos" },
    { href: "/papelera", icon: Trash2, label: "Papelera" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-black/90 backdrop-blur-xl border-t border-gray-200/60 dark:border-gray-800/60 md:hidden safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {items.map(({ href, icon: Icon, label }) => {
          const isActive = href === "/" ? pathname === "/" : pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 text-xs font-medium transition-all duration-200 ${
                isActive
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-200 ${isActive ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
