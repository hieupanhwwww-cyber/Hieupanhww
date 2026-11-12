'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

/** Kết nối Supabase phía trình duyệt (tạo 1 lần). */
export function supabase(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
  }
  return client;
}

/** Đổi lỗi kỹ thuật thành câu dễ hiểu. */
export function errorText(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Mất mạng hoặc máy chủ không phản hồi. Chưa có gì được lưu, hãy thử lại.';
  if (/Invalid login credentials/i.test(msg)) return 'Sai email hoặc mật khẩu.';
  if (/duplicate key.*code/i.test(msg)) return 'Mã hàng đã tồn tại.';
  return msg;
}
