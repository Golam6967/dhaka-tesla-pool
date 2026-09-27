'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, saveSession, clearSession } from '../lib/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setSession(getSession());
    setReady(true);
  }, []);

  function login(nextSession) {
    saveSession(nextSession);
    setSession(nextSession);
  }

  function logout() {
    clearSession();
    setSession(null);
    router.push('/login');
  }

  return (
    <AuthContext.Provider value={{ session, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
