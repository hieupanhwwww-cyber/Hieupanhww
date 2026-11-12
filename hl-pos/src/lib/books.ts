/* =========================================================
   SỔ SÁCH — sổ quỹ theo tháng, lãi theo đơn chốt, lãi một đơn.
   Quy tắc chép từ Sổ Nội Thất (parts/ledger.js, cash.js, profit.js), thêm:
   - tiền bán lẻ (hóa đơn) là một khoản thu của sổ quỹ (nhóm "Bán lẻ");
   - chi phí thực của đơn cộng cả vật tư xuất kho cho đơn × giá vốn lúc xuất.
   ========================================================= */
import { valueEvents, type OrderStatus } from './orderMoney';
import { normalize } from './products';

export const CASH_OUT = ['Vật tư, ván', 'Phụ kiện, thiết bị', 'Nhân công, thợ', 'Thuê ngoài, gia công', 'Vận chuyển', 'Quảng cáo', 'Lương', 'Thuê xưởng, mặt bằng', 'Điện, nước, xăng', 'Dụng cụ, máy móc', 'Tiếp khách', 'Chi khác'];
export const CASH_IN = ['Thu khác', 'Bán phế liệu', 'Góp vốn, vay'];
export const CAPITAL_CAT = 'Góp vốn, vay';
export const CUST_CAT = 'Tiền khách trả';
export const RETAIL_CAT = 'Bán lẻ';

export type CashEntry = { id: string; type: 'in' | 'out'; date: string; amount: number; cat: string; note: string; method: 'cash' | 'transfer'; order_id: string | null };
export type PaymentRow = { id: string; date: string; amount: number; order_id: string; code: string; customer: string; no: number; method: 'cash' | 'transfer' };
export type LedgerData = {
  cash: CashEntry[]; payments: PaymentRow[]; retail: { date: string; amount: number }[];
  start: { date: string; amount: number } | null; books: Record<string, { in: number; out: number; closedAt: string }>;
};
export type CashItem = { id: string; src: 'cash' | 'pay' | 'retail'; type: 'in' | 'out'; date: string; amount: number; cat: string; note: string; order_id: string | null; method: string };

/** Số liệu từ máy chủ (ledger_data) có thể là chuỗi số → đổi về số. */
export function toLedgerData(raw: Record<string, unknown>): LedgerData {
  const n = Number;
  const r = raw as unknown as LedgerData;
  return {
    cash: (r.cash ?? []).map((e) => ({ ...e, amount: n(e.amount) })),
    payments: (r.payments ?? []).map((p) => ({ ...p, amount: n(p.amount), no: n(p.no) })),
    retail: (r.retail ?? []).map((x) => ({ date: x.date, amount: n(x.amount) })),
    start: r.start ? { date: r.start.date, amount: n(r.start.amount) } : null,
    books: Object.fromEntries(Object.entries(r.books ?? {}).map(([k, v]) => [k, { in: n(v.in), out: n(v.out), closedAt: v.closedAt }])),
  };
}

export const ym = (d: string) => String(d || '').slice(0, 7);
export const ymLabel = (m: string) => { const [y, mm] = m.split('-'); return `Tháng ${+mm}/${y}`; };
export const ymShort = (m: string) => { const [y, mm] = m.split('-'); return `T${+mm}/${y.slice(2)}`; };
export function monthsBack(n: number, today: string): string[] {
  const [y, m] = today.split('-').map(Number), out: string[] = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(Date.UTC(y, m - 1 - i, 1)); out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`); }
  return out;
}

/** Mọi khoản thu chi trong kỳ (gồm tiền khách trả trong đơn và tiền bán lẻ), mới nhất trước. */
export function cashList(d: LedgerData, from?: string, to?: string): CashItem[] {
  const inR = (x: string) => (!from || x >= from) && (!to || x <= to);
  const out: CashItem[] = [];
  for (const e of d.cash) if (inR(e.date)) out.push({ ...e, src: 'cash' });
  for (const p of d.payments) if (inR(p.date)) out.push({ id: 'p_' + p.id, src: 'pay', type: 'in', date: p.date, amount: p.amount, cat: CUST_CAT, note: `${p.customer} · ${p.code}`, order_id: p.order_id, method: p.method });
  for (const r of d.retail) if (inR(r.date)) out.push({ id: 'r_' + r.date, src: 'retail', type: 'in', date: r.date, amount: r.amount, cat: RETAIL_CAT, note: 'Tổng hóa đơn bán lẻ trong ngày', order_id: null, method: '' });
  const rank = { retail: 0, pay: 1, cash: 2 } as const;
  return out.sort((a, b) => b.date.localeCompare(a.date) || rank[a.src] - rank[b.src]);
}
export function cashSum(list: CashItem[]) {
  let i = 0, ic = 0, ir = 0, o = 0; const cats = new Map<string, number>();
  for (const e of list) {
    if (e.type === 'out') { o += e.amount; cats.set(e.cat, (cats.get(e.cat) || 0) + e.amount); }
    else { i += e.amount; if (e.src === 'pay') ic += e.amount; if (e.src === 'retail') ir += e.amount; }
  }
  return { in: i, inCust: ic, inRetail: ir, inOther: i - ic - ir, out: o, net: i - o, cats: [...cats].map(([g, v]) => ({ g, v })).sort((a, b) => b.v - a.v) };
}

export type LedgerRow = {
  m: string; before: boolean; open: number | null; in: number; inCust: number; inRetail: number; inOther: number; capital: number; income: number;
  out: number; profit: number; pct: number | null; close: number | null; cats: { g: string; v: number }[]; es: CashItem[]; n: number;
  book: { in: number; out: number; closedAt: string } | null; changed: boolean;
};
/** Sổ quỹ: tồn đầu tháng + thu − chi = tồn cuối. Lãi tháng = thu (không tính góp vốn, vay) − chi. */
export function ledger(months: string[], d: LedgerData): LedgerRow[] {
  const all = cashList(d), st = d.start, sd = st?.date || '';
  const valid = (e: CashItem) => !sd || e.date >= sd;
  const sm = ym(sd), amt = Number(st?.amount) || 0;
  const firstData = all.filter(valid).reduce((mn, e) => (!mn || ym(e.date) < mn ? ym(e.date) : mn), '');
  const startM = sm || firstData;
  let bal = sm && sm < months[0] ? amt : 0;
  for (const e of all) if (valid(e) && ym(e.date) < months[0]) bal += e.type === 'in' ? e.amount : -e.amount;
  return months.map((m) => {
    if (sm && m === sm) bal += amt;
    const before = !startM || m < startM;
    const es = all.filter((e) => ym(e.date) === m && valid(e)), s = cashSum(es);
    const capital = es.filter((e) => e.type === 'in' && e.cat === CAPITAL_CAT).reduce((t, e) => t + e.amount, 0);
    const income = s.in - capital, open = before ? null : bal, close = before ? null : bal + s.in - s.out;
    if (!before) bal = close!;
    const profit = income - s.out, bk = d.books[m] || null;
    return { m, before, open, in: s.in, inCust: s.inCust, inRetail: s.inRetail, inOther: s.inOther - capital, capital, income, out: s.out, profit,
      pct: income ? (profit / income) * 100 : null, close, cats: s.cats, es, n: es.length, book: bk, changed: !!bk && (bk.in !== s.in || bk.out !== s.out) };
  });
}

/* ---------- lãi theo đơn ---------- */
export type BooksOrder = {
  id: string; code: string; status: OrderStatus; customer: string; project: string; closedAt: string | null;
  versions: { no: number; total: number; closedAt: string }[]; rows: { id: string; name: string; qty: number; price: number }[];
  changes: { id: string; sign: number; amount: number; title: string; confirmedAt: string }[];
  costs: { rows: Record<string, number>; chg: Record<string, number>; ship: number } | null; spend: number; stock_cost: number;
};
export function toBooksOrders(raw: unknown[]): BooksOrder[] {
  const n = Number;
  return (raw as BooksOrder[]).map((o) => ({
    ...o, spend: n(o.spend), stock_cost: n(o.stock_cost),
    versions: (o.versions ?? []).map((v) => ({ ...v, total: n(v.total) })),
    rows: (o.rows ?? []).map((r) => ({ ...r, qty: n(r.qty), price: n(r.price) })),
    changes: (o.changes ?? []).map((c) => ({ ...c, sign: n(c.sign), amount: n(c.amount) })),
    costs: o.costs ? { rows: o.costs.rows ?? {}, chg: o.costs.chg ?? {}, ship: n(o.costs.ship) } : null,
  }));
}
/** Giá nhập danh mục theo tên đã chuẩn hóa (không dấu, chữ thường). */
export type CatalogCosts = Map<string, number>;
export const catKey = (name: string) => normalize(name);

export function profitOf(o: BooksOrder, cat: CatalogCosts) {
  const c = o.costs ?? { rows: {}, chg: {}, ship: 0 };
  let goods = 0, missing = 0;
  for (const r of o.rows) {
    const amount = Math.round(r.qty * r.price);
    if (!r.name.trim() && !amount) continue;
    const own = c.rows[r.id];
    const u = own != null ? Number(own) : cat.get(catKey(r.name)) ?? cat.get(r.name.trim().toLowerCase()) ?? 0;
    if (!(u > 0)) { if (amount > 0) missing++; continue; }
    goods += Math.round(r.qty * u);
  }
  let rev = o.versions.at(-1)?.total ?? 0, chgCost = 0;
  for (const g of o.changes) { rev += g.sign < 0 ? -g.amount : g.amount; chgCost += Number(c.chg[g.id]) || 0; }
  const ship = Number(c.ship) || 0, cost = goods + chgCost + ship, profit = rev - cost;
  return { rev, goods, chgCost, ship, cost, profit, pct: rev > 0 ? (profit / rev) * 100 : 0, missing, any: cost > 0 };
}
export function orderCostInfo(o: BooksOrder, cat: CatalogCosts): { cost: number; kind: 'real' | 'est' | 'none' } {
  const spent = o.spend + o.stock_cost;
  if (spent > 0) return { cost: spent, kind: 'real' };
  const p = profitOf(o, cat);
  if (p.cost > 0) return { cost: p.cost, kind: 'est' };
  return { cost: 0, kind: 'none' };
}
const eventsOf = (o: BooksOrder) => valueEvents({
  status: o.status,
  versions: o.versions.map((v) => ({ ...v, quote: null as never, sub: v.total, disc: 0, sign: null })),
  changes: o.changes.map((c) => ({ ...c, sign: c.sign < 0 ? -1 : 1, reason: '', note: '', status: 'confirmed', signRec: null })),
});

export type AccrualRow = {
  m: string; rev: number; ocost: number; gen: number; oin: number; est: number; none: number; profit: number; pct: number | null;
  orders: { code: string; id: string; customer: string; v: number; ci: { cost: number; kind: string } | null; adj?: boolean }[]; gens: CashEntry[];
};
/** Lãi theo đơn chốt: giá trị đơn vào tháng chốt (bản sửa, phát sinh vào tháng xảy ra), chi phí đơn ở tháng chốt, chi chung = chi không gắn đơn đã chốt. */
export function accrual(months: string[], orders: BooksOrder[], cash: CashEntry[], cat: CatalogCosts): AccrualRow[] {
  const M: Record<string, AccrualRow> = Object.fromEntries(months.map((m) => [m, { m, rev: 0, ocost: 0, gen: 0, oin: 0, est: 0, none: 0, profit: 0, pct: null, orders: [], gens: [] }]));
  const closedIds = new Set<string>();
  for (const o of orders) {
    if (o.status === 'quote' || !o.closedAt) continue;
    closedIds.add(o.id);
    const per: Record<string, number> = {};
    for (const e of eventsOf(o)) { const k = ym(e.date); if (M[k]) per[k] = (per[k] || 0) + e.amount; }
    const cm = ym(o.closedAt);
    const book = (r: AccrualRow) => { const ci = orderCostInfo(o, cat); r.ocost += ci.cost; if (ci.kind === 'est') r.est++; if (ci.kind === 'none') r.none++; return ci; };
    for (const [k, v] of Object.entries(per)) {
      const r = M[k]; r.rev += v;
      if (k === cm) r.orders.push({ code: o.code, id: o.id, customer: o.customer, v, ci: book(r) });
      else r.orders.push({ code: o.code, id: o.id, customer: o.customer, v, ci: null, adj: true });
    }
    if (!per[cm] && M[cm]) M[cm].orders.push({ code: o.code, id: o.id, customer: o.customer, v: 0, ci: book(M[cm]) });
  }
  for (const e of cash) {
    const r = M[ym(e.date)]; if (!r) continue;
    if (e.type === 'in') { if (e.cat !== CAPITAL_CAT) r.oin += e.amount; continue; }
    if (!e.order_id || !closedIds.has(e.order_id)) { r.gen += e.amount; r.gens.push(e); }
  }
  return months.map((m) => { const r = M[m]; r.profit = r.rev + r.oin - r.ocost - r.gen; r.pct = r.rev ? (r.profit / r.rev) * 100 : null; return r; });
}
