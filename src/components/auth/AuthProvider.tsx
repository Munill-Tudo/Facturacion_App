'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  role: 'direccion' | 'administracion' | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, role: null, loading: true, signOut: async () => {}
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const role = user?.user_metadata?.role as 'direccion' | 'administracion' | null ?? null;

  return (
    <AuthContext.Provider value={{ user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
