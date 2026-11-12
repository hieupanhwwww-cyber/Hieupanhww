'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase, errorText } from '@/lib/supabase/client';
import { useProfile } from '@/lib/useProfile';
import { loadLedger, saveCashEntry, deleteCashEntry } from '@/lib/booksApi';
import { cashList, cashSum, ym, ymLabel, CASH_IN, CASH_OUT, type LedgerData, type CashItem } from '@/lib/books';
import { vnToday, fmtDate, PAY_METHOD } from '@/lib/orderMoney';
import { formatVnd } from '@/lib/money';
import { Modal } from '@/components/Modal';
import { MoneyInput } from '@/components/MoneyInput';
import { BooksTabs } from '@/components/BooksTabs';

type OrderOpt = { id: string; code: string; customer_name: string };

export default function CashPage() {
  const { role } = useProfile();
  if (role !== 'owner') return <p className="text-muted">Chỉ chủ cửa hàng xem được sổ thu chi.</p>;
  return <Cash />;
}

function Cash() {
  const [data, setData] = useState<LedgerData | null>(null);
  const [orders, setOrders] = useState<OrderOpt[]>([]);
  const [month, setMonth] = useState(useSearchParams().get('thang') ?? ym(vnToday()));
  const [editing, setEditing] = useState<CashItem | 'in' | 'out' | null>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    Promise.all([loadLedger(), supabase().from('orders').select('id, code, customer_name').neq('status', 'quote').order('created_at', { ascending: false }).limit(300)])
      .then(([d, o]) => { setData(d); setOrders((o.data ?? []) as OrderOpt[]); }, (e) => setError(errorText(e)));
  }, [version]);
  const list = useMemo(() => (data ? cashList(data, `${month}-01`, `${month}-31`) : []), [data, month]);
  const sum = cashSum(list);
  const closed = !!data?.books[month];
  const shift = (k: number) => { const [y, m] = month.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + k, 1)); setMonth(d.toISOString().slice(0, 7)); };

  return (
    <div className="space-y-4">
      <BooksTabs />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Sổ thu chi</h1>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setEditing('in')}>+ Khoản thu</button>
          <button className="btn-primary" onClick={() => setEditing('out')}>+ Khoản chi</button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="btn-ghost px-3 py-1" aria-label="Tháng trước" onClick={() => shift(-1)}>‹</button>
        <input type="month" className="input w-auto py-1.5" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        <button className="btn-ghost px-3 py-1" aria-label="Tháng sau" onClick={() => shift(1)}>›</button>
        {closed && <span className="chip bg-green-50 text-ok">Đã chốt sổ</span>}
      </div>
      {error && <p className="text-danger">{error}</p>}
      <div className="grid grid-cols-3 gap-2">
        <div className="card p-3"><div className="text-xs text-muted">Thu</div><div className="font-bold text-ok" data-sum-in>{formatVnd(sum.in)}</div></div>
        <div className="card p-3"><div className="text-xs text-muted">Chi</div><div className="font-bold text-danger" data-sum-out>{formatVnd(sum.out)}</div></div>
        <div className="card p-3"><div className="text-xs text-muted">Chênh lệch</div><div className="font-bold">{formatVnd(sum.net)}</div></div>
      </div>
      <p className="text-xs text-muted">Tiền khách trả (phiếu thu) và tiền bán lẻ tự hiện ở đây, không cần nhập lại. Tiền mua vật tư <b>nhập kho</b> ghi chi nhưng <b>không gắn đơn</b> (vật tư xuất cho đơn đã được tính vào chi phí đơn theo giá vốn).</p>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {list.map((e) => (
          <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm" data-cash={e.cat}>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{e.cat}</div>
              <div className="truncate text-xs text-muted">{fmtDate(e.date)}{e.note ? ` · ${e.note}` : ''}{e.src === 'cash' && e.order_id ? ` · đơn ${orders.find((o) => o.id === e.order_id)?.code ?? ''}` : ''}</div>
            </div>
            <b className={e.type === 'in' ? 'text-ok' : 'text-danger'}>{e.type === 'in' ? '+' : '−'}{formatVnd(e.amount)}</b>
            {e.src === 'cash' ? <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(e)}>Sửa</button>
              : e.src === 'pay' ? <Link className="text-xs text-brand underline" href={`/don-noi-that/${e.order_id}`}>Đơn</Link> : <Link className="text-xs text-brand underline" href="/bao-cao">Xem</Link>}
          </li>
        ))}
        {data && !list.length && <li className="px-3 py-4 text-sm text-muted">{ymLabel(month)} chưa có khoản nào.</li>}
      </ul>
      {sum.cats.length > 0 && (
        <section className="card">
          <h2 className="mb-2 font-semibold">Chi theo nhóm</h2>
          <ul className="space-y-1 text-sm">{sum.cats.map((c) => <li key={c.g} className="flex justify-between"><span>{c.g}</span><span>{formatVnd(c.v)}</span></li>)}</ul>
        </section>
      )}
      {editing && <EntryForm entry={typeof editing === 'string' ? null : editing} type={typeof editing === 'string' ? editing : editing.type} orders={orders}
        closedMonths={data?.books ?? {}} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setVersion((v) => v + 1); }} />}
    </div>
  );
}

function EntryForm({ entry, type: type0, orders, closedMonths, onClose, onSaved }: { entry: CashItem | null; type: 'in' | 'out'; orders: OrderOpt[]; closedMonths: LedgerData['books']; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<'in' | 'out'>(type0);
  const [date, setDate] = useState(entry?.date ?? vnToday());
  const [amount, setAmount] = useState(entry?.amount ?? 0);
  const [cat, setCat] = useState(entry?.cat ?? (type0 === 'out' ? CASH_OUT[0] : CASH_IN[0]));
  const [note, setNote] = useState(entry?.note ?? '');
  const [method, setMethod] = useState<'cash' | 'transfer'>((entry?.method as 'cash' | 'transfer') || 'cash');
  const [orderId, setOrderId] = useState(entry?.order_id ?? '');
  const [error, setError] = useState('');
  const locked = !!closedMonths[ym(date)] || (!!entry && !!closedMonths[ym(entry.date)]);
  const cats = type === 'out' ? CASH_OUT : CASH_IN;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (locked && !confirm('Tháng này đã chốt sổ. Vẫn sửa?')) return;
    try { await saveCashEntry({ id: entry?.id ?? null, type, date, amount, cat, note, method, order_id: orderId || null, confirm: locked }); onSaved(); }
    catch (err) { setError(errorText(err)); }
  }
  async function remove() {
    if (!entry || !confirm(`Xóa khoản ${entry.cat} ${formatVnd(entry.amount)}?`)) return;
    try { await deleteCashEntry(entry.id, locked); onSaved(); } catch (err) { setError(errorText(err)); }
  }
  return (
    <Modal title={entry ? 'Sửa khoản thu chi' : type === 'out' ? 'Khoản chi' : 'Khoản thu'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(['out', 'in'] as const).map((t) => <button type="button" key={t} className={type === t ? 'btn-primary' : 'btn-ghost'} onClick={() => { setType(t); setCat((t === 'out' ? CASH_OUT : CASH_IN)[0]); }}>{t === 'out' ? 'Chi' : 'Thu'}</button>)}
        </div>
        <div><label className="label" htmlFor="ce-amt">Số tiền</label><MoneyInput id="ce-amt" value={amount} onChange={setAmount} /></div>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => <button type="button" key={c} onClick={() => setCat(c)} className={`chip border px-3 py-1 text-sm ${cat === c ? 'border-brand bg-brand text-white' : 'border-line bg-surface'}`}>{c}</button>)}
        </div>
        <div><label className="label" htmlFor="ce-date">Ngày</label><input id="ce-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2">
          {(['cash', 'transfer'] as const).map((m) => <button type="button" key={m} className={method === m ? 'btn-primary' : 'btn-ghost'} onClick={() => setMethod(m)}>{PAY_METHOD[m]}</button>)}
        </div>
        {type === 'out' && (
          <div><label className="label" htmlFor="ce-order">Chi cho đơn (để tính lãi đơn)</label>
            <select id="ce-order" className="input" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
              <option value="">— Chi chung, không gắn đơn —</option>
              {orders.map((o) => <option key={o.id} value={o.id}>{o.code} · {o.customer_name}</option>)}
            </select></div>
        )}
        <div><label className="label" htmlFor="ce-note">Ghi chú</label><input id="ce-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        {locked && <p className="text-sm text-amber-800">Tháng này đã chốt sổ.</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn-primary w-full" disabled={!(amount > 0)}>Lưu</button>
        {entry && <button type="button" className="btn-danger w-full" onClick={remove}>Xóa khoản này</button>}
      </form>
    </Modal>
  );
}
