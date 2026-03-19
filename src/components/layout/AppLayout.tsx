"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-[#050505]">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      
      <div className={`flex-1 flex flex-col transition-all duration-300 ${isCollapsed ? 'pl-20' : 'pl-64'}`}>
        <Header />
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden pt-8 pb-12 px-6 md:px-12">
          {/* Al usar w-full en vez de max-w-7xl la tabla se expande, matando el margen gigante */}
          <div className="w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
