'use client';

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { BottomNav } from "./BottomNav";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-[#050505]">
      {/* Sidebar: solo visible en desktop (md+) */}
      <div className="hidden md:block">
        <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      </div>

      {/* Sidebar Mobile Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[60] flex animate-in slide-in-from-left-full duration-300">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] cursor-pointer" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative flex-1 w-full max-w-[280px]">
            <Sidebar isCollapsed={false} setIsCollapsed={() => {}} onMobileClose={() => setIsMobileMenuOpen(false)} isMobile={true} />
          </div>
        </div>
      )}

      {/* Área de contenido principal */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isCollapsed ? 'md:pl-20' : 'md:pl-64'}`}>
        {/* Topbar */}
        <Header onOpenMobileNav={() => setIsMobileMenuOpen(true)} />

        {/* Contenido */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pt-4 md:pt-8 pb-20 md:pb-12 px-4 md:px-10">
          <div className="w-full max-w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom Navigation: solo en móvil */}
      <BottomNav />
    </div>
  );
}
