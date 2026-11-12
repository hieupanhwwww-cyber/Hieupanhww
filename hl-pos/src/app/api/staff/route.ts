import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase/server';
import { adminSupabase } from '@/lib/supabase/admin';

/** Chủ tạo tài khoản nhân viên mới. */
export async function POST(req: Request) {
  const sb = await serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
  const { data: isOwner } = await sb.rpc('is_owner');
  if (isOwner !== true) return NextResponse.json({ error: 'Chỉ chủ cửa hàng được tạo tài khoản.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const fullName = String(body.full_name ?? '').trim();
  if (!email || !fullName) return NextResponse.json({ error: 'Nhập đủ tên và email.' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'Mật khẩu tối thiểu 8 ký tự.' }, { status: 400 });

  const { error } = await adminSupabase().auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName },
  });
  if (error) {
    const msg = /already/i.test(error.message) ? 'Email này đã có tài khoản.' : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
