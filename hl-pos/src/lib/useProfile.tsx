'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabase/client';

export type Profile = { id: string; full_name: string; role: 'owner' | 'staff'; email?: string };

const Ctx = createContext<Profile | null>(null);

/** Người đang đăng nhập. Chỉ dùng bên trong ProfileProvider. */
export function useProfile(): Profile {
  const p = useContext(Ctx);
  if (!p) throw new Error('useProfile ngoài ProfileProvider');
  return p;
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const sb = supabase();
    let alive = true;
    async function load() {
      const { data } = await sb.auth.getUser();
      if (!data.user) { router.replace('/login'); return; }
      const { data: p, error } = await sb.from('profiles').select('id, full_name, role').eq('id', data.user.id).single();
      if (!alive) return;
      if (error) setError('Không tải được tài khoản. Kiểm tra mạng rồi tải lại trang.');
      else setProfile({ ...(p as Profile), email: data.user.email });
    }
    load();
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.replace('/login');
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [router]);

  if (error) return <p className="p-6 text-danger">{error}</p>;
  if (!profile) return <p className="p-6 text-muted">Đang tải…</p>;
  return <Ctx.Provider value={profile}>{children}</Ctx.Provider>;
}
