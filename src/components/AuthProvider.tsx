'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getDB, isSupabaseMode } from '@/lib/db';
import type { Profile } from '@/lib/types';

interface AuthCtx {
  user: Profile | null;
  loading: boolean;
  supabaseMode: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}
const Ctx = createContext<AuthCtx>({ user: null, loading: true, supabaseMode: false, refresh: async () => {}, signOut: async () => {} });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabaseMode = isSupabaseMode();
  const refresh = async () => {
    try { setUser(await getDB().getSession()); } catch { setUser(null); } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);
  const signOut = async () => { await getDB().signOut(); setUser(null); };
  return <Ctx.Provider value={{ user, loading, supabaseMode, refresh, signOut }}>{children}</Ctx.Provider>;
}
