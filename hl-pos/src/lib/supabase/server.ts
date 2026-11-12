import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Kết nối Supabase phía máy chủ, theo phiên đăng nhập của người gọi. */
export async function serverSupabase() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch {}
        },
      },
    },
  );
}
