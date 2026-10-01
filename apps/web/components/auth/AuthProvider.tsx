'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthResponse, AuthUser } from '@viecpro/shared';
import { apiRequest, restoreWebSession, setAccessToken } from '@/lib/api';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  acceptSession: (session: AuthResponse) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void restoreWebSession().then((session) => {
      if (active) {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const acceptSession = useCallback((session: AuthResponse) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, acceptSession, signOut }), [user, loading, acceptSession, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải được dùng bên trong <AuthProvider>');
  return context;
}
