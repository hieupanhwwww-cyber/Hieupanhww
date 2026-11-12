'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase, errorText } from '@/lib/supabase/client';
import { STATUSES, STATUS_LABEL, STATUS_COLOR, defaultPayments, scheduleWarning, type OrderStatus } from '@/lib/orders';
import { matches } from '@/lib/products';
import { formatVnd } from '@/lib/money';
import { Modal } from '@/components/Modal';
import { MoneyInput } from '@/components/MoneyInput';

type Row = { id: string; code: string; customer_name: string; phone: string; total_value: number; status: OrderStatus; created_at: string; remaining: number };

export default function OrdersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<OrderStatus | 'all' | 'debt'>('all');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const sb = supabase();
    Promise.all([
      sb.from('interior_orders').select('id, code, customer_name, phone, total_value, status, created_at').order('created_at', { ascending: false }),
      sb.from('order_balances').select('order_id, remaining'),
    ]).then(([o, b]) => {
      const err = o.error ?? b.error;
      if (err) { setError(errorText(err)); return; }
      const rem = new Map((b.data ?? []).map((x) => [x.order_id, Number(x.remaining)]));
      setRows((o.data ?? []).map((r) => ({ ...r, total_value: Number(r.total_value), remaining: rem.get(r.id) ?? 0 })) as Row[]);
    });
  }, []);

  const shown = useMemo(() => rows.filter((r) =>
    (status === 'all' || (status === 'debt' ? r.remaining > 0 : r.status === status)) &&
    matches({ code: `${r.code} ${r.phone}`, name: r.customer_name }, query),
  ), [rows, status, query]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Đơn nội thất</h1>
        <button className="btn-primary" onClick={() => setCreating(true)}>+ Tạo đơn</button>
      </div>
      <input className="input" placeholder="Tìm tên khách, SĐT, mã đơn…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {([['all', 'Tất cả'], ...STATUSES.map((s) => [s, STATUS_LABEL[s]]), ['debt', 'Còn nợ']] as [typeof status, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setStatus(k)}
            className={`chip border px-3 py-1 text-sm ${status === k ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-muted'}`}>{label}</button>
        ))}
      </div>
      {error && <p className="text-danger">{error}</p>}
      <ul className="space-y-2">
        {shown.map((r) => (
          <li key={r.id}>
            <Link href={`/don-noi-that/${r.id}`} className="card flex items-center gap-3 hover:border-brand">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{r.customer_name} <span className="text-sm font-normal text-muted">· {r.code}</span></div>
                <div className="text-sm text-muted">{r.phone} · {formatVnd(r.total_value)}</div>
              </div>
              <div className="text-right">
                <span className={`chip ${STATUS_COLOR[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                <div className={`mt-1 text-sm ${r.remaining > 0 ? 'text-danger' : 'text-ok'}`}>
                  {r.remaining > 0 ? `Còn nợ ${formatVnd(r.remaining)}` : 'Đã thu đủ'}
                </div>
              </div>
            </Link>
          </li>
        ))}
        {!shown.length && !error && <li className="text-muted">Chưa có đơn.</li>}
      </ul>
      {creating && <CreateOrder onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateOrder({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({ customer_name: '', phone: '', address: '', total: 0 });
  const [pays, setPays] = useState(defaultPayments(0));
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const warn = scheduleWarning(f.total, pays);

  function setTotal(total: number) {
    setF({ ...f, total });
    if (!touched) setPays(defaultPayments(total));
  }
  function setPay(i: number, patch: Partial<{ label: string; amount: number }>) {
    setTouched(true);
    setPays(pays.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (warn || f.total <= 0) { setError(warn || 'Nhập giá trị đơn.'); return; }
    setBusy(true);
    const { data, error } = await supabase().rpc('create_order', {
      p_customer_name: f.customer_name, p_phone: f.phone, p_address: f.address, p_total_value: f.total,
      p_payments: pays.filter((p) => p.amount > 0),
    });
    setBusy(false);
    if (error) setError(errorText(error)); else router.push(`/don-noi-that/${data}`);
  }

  return (
    <Modal title="Tạo đơn nội thất" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div><label className="label">Tên khách</label><input className="input" required value={f.customer_name} onChange={(e) => setF({ ...f, customer_name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Điện thoại</label><input className="input" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div><label className="label">Giá trị đơn</label><MoneyInput value={f.total} onChange={setTotal} /></div>
        </div>
        <div><label className="label">Địa chỉ</label><input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
        <div className="space-y-2">
          <div className="label">Các đợt thanh toán</div>
          {pays.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input className="input flex-1" value={p.label} onChange={(e) => setPay(i, { label: e.target.value })} />
              <MoneyInput className="w-40" value={p.amount} onChange={(n) => setPay(i, { amount: n })} />
              <button type="button" className="btn-ghost px-3" aria-label="Bỏ đợt" onClick={() => { setTouched(true); setPays(pays.filter((_, j) => j !== i)); }}>✕</button>
            </div>
          ))}
          <button type="button" className="btn-ghost w-full py-1.5 text-sm" onClick={() => { setTouched(true); setPays([...pays, { label: `Đợt ${pays.length + 1}`, amount: 0 }]); }}>+ Thêm đợt</button>
          {f.total > 0 && warn && <p className="text-sm text-danger">{warn}</p>}
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>Tạo đơn</button>
      </form>
    </Modal>
  );
}
