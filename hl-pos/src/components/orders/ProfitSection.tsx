'use client';
/* Lãi của một đơn (chỉ chủ): giá nhập từng dòng, giá vốn phát sinh, vận chuyển; chi phí thực đã ghi. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, errorText } from '@/lib/supabase/client';
import { loadCatalogCosts, saveOrderCosts } from '@/lib/booksApi';
import { profitOf, catKey, type BooksOrder, type CatalogCosts } from '@/lib/books';
import { lastVersion, fmtDate, type Order } from '@/lib/orderMoney';
import { formatVnd } from '@/lib/money';
import type { OrderFull } from '@/lib/ordersApi';
import { MoneyInput } from '@/components/MoneyInput';

type Costs = { rows: Record<string, number>; chg: Record<string, number>; ship: number };

function toBooks(head: OrderFull['head'], o: Order, costs: Costs | null, spend: number, stock: number): BooksOrder {
  const v = lastVersion(o);
  return { id: o.id, code: o.code, status: o.status, customer: head.customer_name, project: head.project, closedAt: o.closedAt,
    versions: o.versions.map((x) => ({ no: x.no, total: x.total, closedAt: x.closedAt })),
    rows: (v?.quote.rows ?? o.draft?.rows ?? []).map((r) => ({ id: r.id, name: r.name, qty: r.qty, price: r.price })),
    changes: o.changes.filter((c) => c.status === 'confirmed').map((c) => ({ id: c.id, sign: c.sign, amount: c.amount, title: c.title, confirmedAt: c.confirmedAt ?? '' })),
    costs, spend, stock_cost: stock };
}

export function ProfitSection({ full }: { full: OrderFull }) {
  const id = full.head.id;
  const [costs, setCosts] = useState<Costs | null>(null);
  const [cat, setCat] = useState<CatalogCosts>(new Map());
  const [spend, setSpend] = useState<{ date: string; amount: number; cat: string; note: string }[]>([]);
  const [stock, setStock] = useState(0);
  const [edit, setEdit] = useState<Costs | null>(null);
  const [msg, setMsg] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const sb = supabase();
    Promise.all([
      sb.from('order_costs').select('rows, chg, ship').eq('order_id', id).maybeSingle(),
      loadCatalogCosts(),
      sb.from('cash_entries').select('date, amount, cat, note').eq('order_id', id).eq('type', 'out').order('date'),
      sb.from('stock_movements').select('quantity, stock_movement_costs(unit_cost)').eq('order_id', id).eq('type', 'out'),
    ]).then(([c, k, s, m]) => {
      setCosts(c.data ? { rows: c.data.rows ?? {}, chg: c.data.chg ?? {}, ship: Number(c.data.ship) } : null);
      setCat(k);
      setSpend((s.data ?? []).map((x) => ({ ...x, amount: Number(x.amount) })));
      const rows = (m.data ?? []) as unknown as { quantity: number; stock_movement_costs: { unit_cost: number } | { unit_cost: number }[] | null }[];
      setStock(rows.reduce((t, x) => { const c = Array.isArray(x.stock_movement_costs) ? x.stock_movement_costs[0] : x.stock_movement_costs; return t + Math.round(Number(x.quantity) * Number(c?.unit_cost ?? 0)); }, 0));
    }, (e) => setMsg(errorText(e)));
  }, [id, version]);

  const spent = spend.reduce((t, x) => t + x.amount, 0);
  const b = toBooks(full.head, full.order, costs, spent, stock);
  const p = profitOf(b, cat);
  const real = spent + stock;
  const realProfit = p.rev - real;

  async function save() {
    if (!edit) return;
    try { await saveOrderCosts(id, edit.rows, edit.chg, edit.ship); setEdit(null); setVersion((v) => v + 1); setMsg('Đã lưu giá nhập.'); }
    catch (e) { setMsg(errorText(e)); }
  }
  const rowCost = (r: BooksOrder['rows'][number]) => (edit ?? costs)?.rows[r.id] ?? cat.get(catKey(r.name)) ?? 0;

  return (
    <section className="card space-y-2" data-profit-section>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Lãi đơn <span className="text-xs font-normal text-muted">(chỉ chủ thấy)</span></h2>
        {!edit && <button className="btn-ghost py-1 text-sm" onClick={() => setEdit(costs ?? { rows: {}, chg: {}, ship: 0 })}>Nhập giá nhập</button>}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div><div className="text-xs text-muted">Doanh thu</div><b>{formatVnd(p.rev)}</b></div>
        <div><div className="text-xs text-muted">Chi phí ước tính</div><b>{formatVnd(p.cost)}</b></div>
        <div><div className="text-xs text-muted">Lãi ước tính</div><b className={p.profit < 0 ? 'text-danger' : 'text-ok'} data-profit-est>{formatVnd(p.profit)}</b><div className="text-xs text-muted">{p.rev ? `${Math.round(p.pct * 10) / 10}%` : ''}</div></div>
      </div>
      {p.missing > 0 && <p className="text-xs text-amber-800">{p.missing} dòng chưa có giá nhập (nhập ở đây hoặc trong Danh mục).</p>}
      {real > 0 && (
        <div className="rounded-xl bg-brand-soft p-2 text-sm">
          Chi phí thực đã ghi: <b>{formatVnd(real)}</b> ({formatVnd(spent)} khoản chi gắn đơn + {formatVnd(stock)} vật tư xuất kho) → lãi thực <b className={realProfit < 0 ? 'text-danger' : 'text-ok'}>{formatVnd(realProfit)}</b>
          {spend.length > 0 && <ul className="mt-1 text-xs text-muted">{spend.map((x, i) => <li key={i}>{fmtDate(x.date)} · {x.cat}{x.note ? ` · ${x.note}` : ''}: {formatVnd(x.amount)}</li>)}</ul>}
        </div>
      )}
      <p className="text-xs text-muted">Ghi khoản chi cho đơn ở <Link className="underline" href="/so-thu-chi">Sổ thu chi</Link> (chọn đơn).</p>
      {edit && (
        <div className="space-y-2 border-t border-line pt-2">
          {b.rows.map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{r.name} <span className="text-muted">× {r.qty}</span></span>
              <MoneyInput className="w-36" value={edit.rows[r.id] ?? rowCost(r)} onChange={(v) => setEdit({ ...edit, rows: { ...edit.rows, [r.id]: v } })} />
            </div>
          ))}
          {b.changes.map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">PS: {c.title}</span>
              <MoneyInput className="w-36" value={edit.chg[c.id] ?? 0} onChange={(v) => setEdit({ ...edit, chg: { ...edit.chg, [c.id]: v } })} />
            </div>
          ))}
          <div className="flex items-center gap-2 text-sm"><span className="flex-1">Vận chuyển, lắp đặt</span><MoneyInput className="w-36" value={edit.ship} onChange={(v) => setEdit({ ...edit, ship: v })} /></div>
          <div className="flex gap-2"><button className="btn-primary flex-1" onClick={save}>Lưu giá nhập</button><button className="btn-ghost" onClick={() => setEdit(null)}>Hủy</button></div>
        </div>
      )}
      {msg && <p className="text-xs text-muted">{msg}</p>}
    </section>
  );
}
