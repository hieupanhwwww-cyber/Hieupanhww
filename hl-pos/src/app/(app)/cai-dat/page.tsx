'use client';
import { useEffect, useState } from 'react';
import { supabase, errorText } from '@/lib/supabase/client';
import { useProfile } from '@/lib/useProfile';

type Store = { name: string; address: string; phone: string; note: string | null };
type Member = { id: string; full_name: string; role: 'owner' | 'staff' };

export default function SettingsPage() {
  const me = useProfile();
  const isOwner = me.role === 'owner';

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Cài đặt</h1>
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold">{me.full_name || me.email}</div>
          <div className="text-sm text-muted">{me.email} · {me.role === 'owner' ? 'Chủ cửa hàng' : 'Nhân viên'}</div>
        </div>
        <button className="btn-ghost" onClick={() => supabase().auth.signOut()}>Đăng xuất</button>
      </section>
      <StoreForm canEdit={isOwner} />
      {isOwner && <Members myId={me.id} />}
    </div>
  );
}

function StoreForm({ canEdit }: { canEdit: boolean }) {
  const [store, setStore] = useState<Store | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase().from('store_settings').select('name, address, phone, note').single()
      .then(({ data, error }) => (error ? setMsg(errorText(error)) : setStore(data as Store)));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!store) return;
    setBusy(true);
    const { error } = await supabase().from('store_settings').update(store).eq('id', 1);
    setBusy(false);
    setMsg(error ? errorText(error) : 'Đã lưu.');
  }

  if (!store) return <section className="card text-muted">{msg || 'Đang tải…'}</section>;
  const field = (key: keyof Store, label: string) => (
    <div>
      <label className="label">{label}</label>
      <input className="input" disabled={!canEdit} value={store[key] ?? ''}
        onChange={(e) => setStore({ ...store, [key]: e.target.value })} />
    </div>
  );
  return (
    <form onSubmit={save} className="card space-y-3">
      <h2 className="font-semibold">Thông tin in trên hóa đơn</h2>
      {field('name', 'Tên cửa hàng')}
      {field('address', 'Địa chỉ')}
      {field('phone', 'Điện thoại')}
      {field('note', 'Lời nhắn cuối hóa đơn')}
      {canEdit && <button className="btn-primary" disabled={busy}>Lưu</button>}
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </form>
  );
}

function Members({ myId }: { myId: string }) {
  const [list, setList] = useState<Member[]>([]);
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const [version, setVersion] = useState(0);
  const load = () => setVersion((v) => v + 1);
  useEffect(() => {
    supabase().from('profiles').select('id, full_name, role').order('created_at')
      .then(({ data }) => setList((data as Member[]) ?? []));
  }, [version]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/staff', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
      const body = await res.json();
      if (!res.ok) setMsg(body.error);
      else { setMsg('Đã tạo tài khoản. Gửi email + mật khẩu cho nhân viên.'); setForm({ full_name: '', email: '', password: '' }); load(); }
    } catch (err) {
      setMsg(errorText(err));
    }
    setBusy(false);
  }

  async function setRole(id: string, role: Member['role']) {
    const { error } = await supabase().from('profiles').update({ role }).eq('id', id);
    if (error) setMsg(errorText(error)); else load();
  }

  return (
    <section className="card space-y-4">
      <h2 className="font-semibold">Tài khoản</h2>
      <ul className="divide-y divide-line">
        {list.map((m) => (
          <li key={m.id} className="flex items-center justify-between py-2">
            <span>{m.full_name || '(chưa đặt tên)'}</span>
            {m.id === myId ? (
              <span className="chip bg-brand-soft text-brand">Chủ (bạn)</span>
            ) : (
              <select className="input w-36" value={m.role} onChange={(e) => setRole(m.id, e.target.value as Member['role'])}>
                <option value="staff">Nhân viên</option>
                <option value="owner">Chủ</option>
              </select>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={create} className="grid gap-3 md:grid-cols-4">
        <input className="input" placeholder="Tên nhân viên" required value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        <input className="input" type="email" placeholder="Email đăng nhập" required value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="input" type="text" placeholder="Mật khẩu (≥ 8 ký tự)" required minLength={8} value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button className="btn-primary" disabled={busy}>Tạo tài khoản</button>
      </form>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </section>
  );
}
