'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase, errorText } from '@/lib/supabase/client';
import { STATUSES, STATUS_LABEL, orderRemaining, scheduleWarning, type OrderStatus } from '@/lib/orders';
import { loadProducts, matches, type Product } from '@/lib/products';
import { formatVnd, formatQty } from '@/lib/money';
import { Modal } from '@/components/Modal';
import { MoneyInput } from '@/components/MoneyInput';

type Order = { id: string; code: string; customer_name: string; phone: string; address: string; total_value: number; status: OrderStatus; note: string | null; created_at: string };
type Payment = { id: string; label: string; amount: number; paid: boolean; paid_at: string | null };
type Material = { id: string; quantity: number; created_at: string; product_id: string };

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [pays, setPays] = useState<Payment[]>([]);
  const [mats, setMats] = useState<Material[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editPay, setEditPay] = useState<Payment | 'new' | null>(null);
  const [addingMat, setAddingMat] = useState(false);
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    const sb = supabase();
    Promise.all([
      sb.from('interior_orders').select('id, code, customer_name, phone, address, total_value, status, note, created_at').eq('id', id).single(),
      sb.from('order_payments').select('id, label, amount, paid, paid_at').eq('order_id', id).order('sort'),
      sb.from('stock_movements').select('id, quantity, created_at, product_id').eq('order_id', id).order('created_at'),
      loadProducts(false),
    ]).then(([o, p, m, prods]) => {
      const err = o.error ?? p.error ?? m.error;
      if (err || !o.data) { setError(err ? errorText(err) : 'Không tìm thấy đơn.'); return; }
      setOrder({ ...o.data, total_value: Number(o.data.total_value) } as Order);
      setPays((p.data ?? []).map((x) => ({ ...x, amount: Number(x.amount) })) as Payment[]);
      setMats((m.data ?? []).map((x) => ({ ...x, quantity: Number(x.quantity) })) as Material[]);
      setProducts(prods);
    }, (e) => setError(errorText(e)));
  }, [id, version]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  async function call(fn: string, args: Record<string, unknown>) {
    setBusy(true);
    setError('');
    const { error } = await supabase().rpc(fn, args);
    setBusy(false);
    if (error) setError(errorText(error)); else reload();
  }

  if (!order) return <p className={error ? 'text-danger' : 'text-muted'}>{error || 'Đang tải đơn…'}</p>;
  const remaining = orderRemaining(order.total_value, pays);
  const warn = scheduleWarning(order.total_value, pays);

  return (
    <div className="space-y-4">
      <Link href="/don-noi-that" className="text-sm text-muted">← Danh sách đơn</Link>
      <section className="card space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-bold">{order.customer_name}</h1>
          <button className="btn-ghost py-1 text-sm" onClick={() => setEditing(true)}>Sửa</button>
        </div>
        <div className="text-sm text-muted">{order.code} · tạo {new Date(order.created_at).toLocaleDateString('vi-VN')}</div>
        {order.phone && <div>📞 <a className="text-brand" href={`tel:${order.phone}`}>{order.phone}</a></div>}
        {order.address && <div>📍 {order.address}</div>}
        {order.note && <div className="text-sm text-muted">Ghi chú: {order.note}</div>}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Tiến độ</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STATUSES.map((s, i) => {
            const cur = STATUSES.indexOf(order.status);
            return (
              <button key={s} disabled={busy} onClick={() => call('set_order_status', { p_order_id: order.id, p_status: s })}
                className={`btn py-2 text-sm ${i === cur ? 'bg-brand text-white' : i < cur ? 'bg-brand-soft text-brand' : 'border border-line bg-surface text-muted'}`}>
                {i < cur ? '✓ ' : ''}{STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Thanh toán</h2>
          <button className="btn-ghost py-1 text-sm" onClick={() => setEditPay('new')}>+ Thêm đợt</button>
        </div>
        <ul className="divide-y divide-line">
          {pays.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <div className="flex-1">
                <div className="font-medium">{p.label} · {formatVnd(p.amount)}</div>
                <div className="text-sm text-muted">{p.paid ? `Đã thu ngày ${new Date(p.paid_at!).toLocaleDateString('vi-VN')}` : 'Chưa thu'}</div>
              </div>
              {!p.paid && <button className="btn-ghost py-1 text-sm" onClick={() => setEditPay(p)}>Sửa</button>}
              <button disabled={busy} onClick={() => call('set_payment_paid', { p_payment_id: p.id, p_paid: !p.paid, p_paid_at: p.paid ? null : today() })}
                className={p.paid ? 'btn-ghost py-1 text-sm' : 'btn-primary py-1 text-sm'}>
                {p.paid ? 'Bỏ đánh dấu' : 'Đã thu'}
              </button>
            </li>
          ))}
        </ul>
        {warn && <p className="text-sm text-amber-700">⚠ {warn}</p>}
        <div className="flex justify-between border-t border-line pt-3">
          <span>Giá trị đơn {formatVnd(order.total_value)}</span>
          <span className={`font-bold ${remaining > 0 ? 'text-danger' : 'text-ok'}`}>{remaining > 0 ? `Còn nợ ${formatVnd(remaining)}` : 'Đã thu đủ'}</span>
        </div>
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Vật tư đã dùng</h2>
          <button className="btn-ghost py-1 text-sm" onClick={() => setAddingMat(true)}>+ Thêm vật tư</button>
        </div>
        {!mats.length ? <p className="text-sm text-muted">Chưa ghi vật tư.</p> : (
          <ul className="divide-y divide-line text-sm">
            {mats.map((m) => {
              const p = productById.get(m.product_id);
              return (
                <li key={m.id} className="flex justify-between py-2">
                  <span>{p?.name ?? '—'} <span className="text-muted">· {new Date(m.created_at).toLocaleDateString('vi-VN')}</span></span>
                  <span>{formatQty(m.quantity)} {p?.unit}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {error && <p className="text-danger">{error}</p>}
      {editing && <EditOrder order={order} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
      {editPay && <EditPayment orderId={order.id} payment={editPay === 'new' ? null : editPay} onClose={() => setEditPay(null)} onSaved={() => { setEditPay(null); reload(); }} />}
      {addingMat && <AddMaterial orderId={order.id} products={products.filter((p) => p.active)} onClose={() => setAddingMat(false)} onSaved={() => { setAddingMat(false); reload(); }} />}
    </div>
  );
}

function EditOrder({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ ...order, note: order.note ?? '' });
  const [error, setError] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase().rpc('update_order', {
      p_order_id: order.id, p_customer_name: f.customer_name, p_phone: f.phone, p_address: f.address,
      p_total_value: f.total_value, p_note: f.note.trim() || null,
    });
    if (error) setError(errorText(error)); else onSaved();
  }
  return (
    <Modal title="Sửa đơn" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div><label className="label">Tên khách</label><input className="input" required value={f.customer_name} onChange={(e) => setF({ ...f, customer_name: e.target.value })} /></div>
        <div><label className="label">Điện thoại</label><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <div><label className="label">Địa chỉ</label><input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
        <div><label className="label">Giá trị đơn</label><MoneyInput value={f.total_value} onChange={(n) => setF({ ...f, total_value: n })} /></div>
        <div><label className="label">Ghi chú</label><textarea className="input" rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn-primary w-full">Lưu</button>
      </form>
    </Modal>
  );
}

function EditPayment({ orderId, payment, onClose, onSaved }: { orderId: string; payment: Payment | null; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(payment?.label ?? '');
  const [amount, setAmount] = useState(payment?.amount ?? 0);
  const [error, setError] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (amount <= 0) { setError('Số tiền phải lớn hơn 0.'); return; }
    const { error } = await supabase().rpc('save_payment', { p_id: payment?.id ?? null, p_order_id: orderId, p_label: label, p_amount: amount });
    if (error) setError(errorText(error)); else onSaved();
  }
  async function remove() {
    if (!payment || !confirm(`Xóa đợt "${payment.label}"?`)) return;
    const { error } = await supabase().rpc('delete_payment', { p_id: payment.id });
    if (error) setError(errorText(error)); else onSaved();
  }
  return (
    <Modal title={payment ? 'Sửa đợt thanh toán' : 'Thêm đợt thanh toán'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div><label className="label">Tên đợt</label><input className="input" required value={label} onChange={(e) => setLabel(e.target.value)} /></div>
        <div><label className="label">Số tiền</label><MoneyInput value={amount} onChange={setAmount} /></div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn-primary w-full">Lưu</button>
        {payment && <button type="button" className="btn-danger w-full" onClick={remove}>Xóa đợt này</button>}
      </form>
    </Modal>
  );
}

function AddMaterial({ orderId, products, onClose, onSaved }: { orderId: string; products: Product[]; onClose: () => void; onSaved: () => void }) {
  const [query, setQuery] = useState('');
  const [pick, setPick] = useState<Product | null>(null);
  const [qty, setQty] = useState('');
  const [error, setError] = useState('');
  const shown = products
    .filter((p) => matches(p, query))
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'material' ? -1 : 1))
    .slice(0, 30);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const q = Number(qty.replace(',', '.'));
    if (!pick || !(q > 0)) { setError('Chọn vật tư và nhập số lượng lớn hơn 0.'); return; }
    const { error } = await supabase().rpc('add_order_material', { p_order_id: orderId, p_product_id: pick.id, p_quantity: q });
    if (error) setError(errorText(error)); else onSaved();
  }
  return (
    <Modal title="Thêm vật tư đã dùng" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        {!pick ? (
          <>
            <input className="input" autoFocus placeholder="Tìm vật tư…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <ul className="max-h-72 divide-y divide-line overflow-y-auto">
              {shown.map((p) => (
                <li key={p.id}>
                  <button type="button" className="flex w-full justify-between py-2 text-left" onClick={() => setPick(p)}>
                    <span>{p.name} <span className="text-sm text-muted">· {p.code}</span></span>
                    <span className="text-sm text-muted">tồn {formatQty(p.stock)} {p.unit}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-xl bg-brand-soft px-3 py-2">
              <span>{pick.name} · tồn {formatQty(pick.stock)} {pick.unit}</span>
              <button type="button" className="text-sm text-brand" onClick={() => setPick(null)}>Đổi</button>
            </div>
            <div><label className="label">Số lượng ({pick.unit})</label>
              <input className="input" autoFocus inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
            <button className="btn-primary w-full">Ghi xuất kho cho đơn</button>
          </>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
