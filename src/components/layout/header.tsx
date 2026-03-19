'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { Receipt, LogOut } from 'lucide-react';

export function Header() {
  const { user, role, signOut } = useAuth();
  const initials = user?.email?.[0]?.toUpperCase() ?? '?';
  const label = role === 'direccion' ? 'Dirección' : role === 'administracion' ? 'Administración' : '';

  return (
    <header className="h-14 md:h-16 sticky top-0 z-40 flex items-center justify-between px-4 md:px-8 bg-white/70 dark:bg-black/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50">
      {/* Logo: solo en móvil */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow shadow-indigo-500/20">
          <Receipt className="w-4 h-4 text-white" />
        </div>
        <span className="text-base font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">
          FacturApp
        </span>
      </div>

      {/* Spacer desktop */}
      <div className="hidden md:flex flex-1" />

      {/* User info + logout */}
      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-1.5">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {initials}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 leading-tight">{label}</p>
                <p className="text-[10px] text-gray-400 leading-tight truncate max-w-[120px]">{user.email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              title="Cerrar sesión"
              className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
