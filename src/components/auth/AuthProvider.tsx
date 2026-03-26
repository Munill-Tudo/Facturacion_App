'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface AuthUser {
  email: string;
  role: 'direccion' | 'administracion';
}

interface AuthContextType {
  user: AuthUser | null;
  role: 'direccion' | 'administracion' | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, role: null, loading: true, signOut: async () => {}
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Auto-logout on browser/tab close:
    // sessionStorage is cleared when the browser window is closed.
    // If we open the app fresh (no session flag) but a cookie exists → force logout.
    const hasTabSession = typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('app_session_active')
      : null;

    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data?.user) {
          if (!hasTabSession) {
            // Cookie from old session — user closed & reopened browser → force logout
            fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
              window.location.href = '/login';
            });
          } else {
            setUser(data.user);
          }
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signOut = async () => {
    sessionStorage.removeItem('app_session_active');
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    window.location.href = '/login';
  };

  const role = user?.role ?? null;

  return (
    <AuthContext.Provider value={{ user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
