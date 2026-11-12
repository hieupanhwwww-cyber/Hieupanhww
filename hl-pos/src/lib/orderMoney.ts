/* =========================================================
   TIỀN CỦA MỘT ĐƠN NỘI THẤT — mọi con số về tiền của đơn đều lấy từ đây
   (thẻ đơn, trang đơn, Hôm nay, phiếu thu, báo giá in).
   Quy tắc chép nguyên từ Sổ Nội Thất (parts/core.js) để hai app ra cùng con số.
   ========================================================= */

export type Unit = 'm²' | 'md' | 'bộ' | 'cái' | 'gói' | 'cánh' | 'điểm' | 'công';
export type Dims = { a: number; b: number; n: number; u: 'mm' | 'cm' | 'm' };
export type QuoteRow = { id: string; name: string; material: string; unit: Unit; qty: number; price: number; dims: Dims | null };
export type Trigger = 'sign' | 'progress' | 'accept' | 'date';
export type PlanRow = { id: string; label: string; pct: number; trigger: Trigger; fixed?: boolean; amt?: number; due?: string; reached?: boolean; one?: boolean };
export type Discount = { type: 'percent' | 'amount'; value: number };
export type Quote = {
  date: string; customer: { name: string; phone: string; address: string }; project: string; rows: QuoteRow[];
  discount: Discount; note: string; terms: string; validUntil: string; plan: PlanRow[];
};
export type SignRecord = { img: string; name: string; at: string; hash: string };
export type Version = { no: number; quote: Quote; sub: number; disc: number; total: number; closedAt: string; sign: SignRecord | null };
export type Payment = { id: string; no: number; amount: number; date: string; method: 'transfer' | 'cash'; note: string; deposit: boolean };
export type Change = {
  id: string; sign: 1 | -1; title: string; amount: number; reason: string; note: string;
  status: 'pending' | 'confirmed' | 'cancelled'; confirmedAt: string | null; signRec: SignRecord | null;
};
export type Handover = { date: string; warrantyMonths: number; warrantyUntil: string; note: string; sign: SignRecord | null };
export type OrderStatus = 'quote' | 'closed' | 'building' | 'done';
export type Order = {
  id: string; code: string; status: OrderStatus; draft: Quote | null; versions: Version[]; plan: PlanRow[]; payDue: string;
  payments: Payment[]; changes: Change[]; handover: Handover | null; closedAt: string | null;
};

export const UNITS: Unit[] = ['m²', 'md', 'bộ', 'cái', 'gói', 'cánh', 'điểm', 'công'];
export const UNIT_NAMES: Record<Unit, string> = { 'm²': 'm² (mét vuông)', md: 'md (mét dài)', bộ: 'bộ', cái: 'cái', gói: 'gói', cánh: 'cánh', điểm: 'điểm', công: 'công' };
export const STATUS: Record<OrderStatus, { label: string; cls: string }> = {
  quote: { label: 'Đang báo giá', cls: 'bg-amber-50 text-amber-800' },
  closed: { label: 'Đã chốt', cls: 'bg-blue-50 text-blue-800' },
  building: { label: 'Đang thi công', cls: 'bg-purple-50 text-purple-800' },
  done: { label: 'Hoàn thành', cls: 'bg-green-50 text-ok' },
};
export const TRIGGERS: Record<Trigger, string> = { sign: 'Khi chốt đơn', progress: 'Khi bắt đầu thi công', accept: 'Khi nghiệm thu, bàn giao', date: 'Theo ngày hẹn' };
export const PLAN_STATE = {
  paid: { label: 'Đã thu', cls: 'bg-green-50 text-ok' },
  overdue: { label: 'Quá hạn', cls: 'bg-red-50 text-danger' },
  due: { label: 'Đến hạn', cls: 'bg-amber-50 text-amber-800' },
  later: { label: 'Chưa đến hạn', cls: 'bg-brand-soft text-muted' },
} as const;
export type PlanState = keyof typeof PLAN_STATE;
export const PAY_METHOD = { transfer: 'Chuyển khoản', cash: 'Tiền mặt' } as const;

type PlanTpl = Partial<PlanRow>;
export const DEFAULT_PLAN: PlanTpl[] = [
  { label: 'Đặt cọc khi ký hợp đồng', pct: 50, trigger: 'sign' },
  { label: 'Khi bắt đầu lắp đặt', pct: 40, trigger: 'progress' },
  { label: 'Sau nghiệm thu, bàn giao', pct: 0, trigger: 'accept' },
];
export const PLAN_PRESETS: Record<'2' | '3' | '4', { label: string; rows: PlanTpl[] }> = {
  '2': { label: '2 đợt', rows: [{ label: 'Đặt cọc khi ký hợp đồng', pct: 50, trigger: 'sign' }, { label: 'Sau nghiệm thu, bàn giao', pct: 0, trigger: 'accept' }] },
  '3': { label: '3 đợt', rows: DEFAULT_PLAN },
  '4': { label: '4 đợt', rows: [{ label: 'Đặt cọc khi ký hợp đồng', pct: 30, trigger: 'sign' }, { label: 'Khi bắt đầu sản xuất, thi công', pct: 30, trigger: 'progress' }, { label: 'Khi lắp đặt xong', pct: 30, trigger: 'date' }, { label: 'Sau nghiệm thu, bàn giao', pct: 0, trigger: 'accept' }] },
};

/* ---------- tiện ích ngày, số ---------- */
const pad2 = (n: number) => String(n).padStart(2, '0');
const NF = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const QF = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 });
export const money = (n: number) => NF.format(Math.round(Number(n) || 0));
export const fmtQty = (n: number) => QF.format(Number(n) || 0);
export const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
/** Hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD. */
export const vnToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
export const fmtDate = (s: string | null | undefined) => { if (!s) return ''; const [y, m, d] = String(s).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
const fromYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const toYmd = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
export function addDays(s: string, n: number): string { const d = fromYmd(s); d.setUTCDate(d.getUTCDate() + n); return toYmd(d); }
/** Cộng tháng, kẹp về cuối tháng nếu ngày không tồn tại (31/08 + 6 tháng = 28/02). */
export function addMonths(s: string, m: number): string {
  const [y, mo, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1 + m, d));
  if (dt.getUTCDate() !== d) dt.setUTCDate(0);
  return toYmd(dt);
}
export const round3 = (v: number) => Math.round(v * 1000) / 1000;
/** "2,88" → 2.88; "1.234,5" → 1234.5; chữ → 0 */
export function parseQty(s: string): number {
  let t = String(s ?? '').trim().replace(/\s/g, '');
  if (!t) return 0;
  t = t.replace(/,/g, '.');
  const parts = t.split('.');
  if (parts.length > 2) t = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
  const v = parseFloat(t);
  return Number.isFinite(v) && v > 0 ? round3(v) : 0;
}

/* ---------- số tiền bằng chữ ---------- */
const DIG = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
function read3(n: number, full: boolean): string {
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), u = n % 10, out: string[] = [];
  if (h > 0 || full) out.push(DIG[h] + ' trăm');
  if (t > 1) {
    out.push(DIG[t] + ' mươi');
    if (u === 1) out.push('mốt'); else if (u === 4) out.push('tư'); else if (u === 5) out.push('lăm'); else if (u > 0) out.push(DIG[u]);
  } else if (t === 1) {
    out.push('mười');
    if (u === 5) out.push('lăm'); else if (u > 0) out.push(DIG[u]);
  } else if (u > 0) {
    if (h > 0 || full) out.push('linh');
    out.push(DIG[u]);
  }
  return out.join(' ');
}
function readBelowBillion(n: number, full: boolean): string {
  const g = [Math.floor(n / 1e6), Math.floor(n / 1e3) % 1000, n % 1000], names = ['triệu', 'nghìn', ''];
  const parts: string[] = []; let started = full;
  for (let i = 0; i < 3; i++) {
    if (g[i] === 0) continue;
    parts.push(read3(g[i], started) + (names[i] ? ' ' + names[i] : ''));
    started = true;
  }
  return parts.join(' ');
}
function readNum(n: number): string {
  if (n === 0) return 'không';
  if (n >= 1e9) { const hi = Math.floor(n / 1e9), lo = n % 1e9; return readNum(hi) + ' tỷ' + (lo ? ' ' + readBelowBillion(lo, true) : ''); }
  return readBelowBillion(n, false);
}
export function moneyWords(n: number): string {
  const v = Math.round(Math.abs(Number(n) || 0));
  const s = readNum(v) + ' đồng';
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}

/* ---------- báo giá ---------- */
export const rowAmount = (r: Pick<QuoteRow, 'qty' | 'price'>) => Math.round((Number(r.qty) || 0) * (Number(r.price) || 0));
export function quoteTotals(q: Pick<Quote, 'rows' | 'discount'> | null | undefined): { sub: number; disc: number; total: number } {
  const sub = (q?.rows || []).reduce((s, r) => s + rowAmount(r), 0);
  const d = q?.discount || { type: 'amount', value: 0 };
  let disc = 0;
  if (d.type === 'percent') disc = Math.round((sub * Math.min(Math.max(Number(d.value) || 0, 0), 100)) / 100);
  else disc = Math.min(Math.max(Math.round(Number(d.value) || 0), 0), sub);
  return { sub, disc, total: sub - disc };
}
const DIM_UNIT = { mm: 0.001, cm: 0.01, m: 1 } as const;
export function dimsQty(unit: Unit, d: Dims): number {
  const k = DIM_UNIT[d.u] || 0.001, n = Number(d.n) || 0;
  if (unit === 'm²') return round3((Number(d.a) || 0) * k * (Number(d.b) || 0) * k * n);
  if (unit === 'md') return round3((Number(d.a) || 0) * k * n);
  return round3(n);
}
export function dimText(unit: Unit, d: Dims | null): string {
  if (!d) return '';
  const a = QF.format(Number(d.a) || 0), b = QF.format(Number(d.b) || 0), n = Number(d.n) || 1;
  let s: string;
  if (unit === 'm²') s = `${a} × ${b} ${d.u}`;
  else if (unit === 'md') s = `dài ${a} ${d.u}`;
  else s = Number(d.a) || Number(d.b) ? `${a} × ${b} ${d.u}` : '';
  if (n !== 1) s += (s ? ' × ' : '') + `${QF.format(n)}`;
  return s;
}
export const newRow = (p: Partial<QuoteRow> = {}): QuoteRow => ({ id: uid('r'), name: '', material: '', unit: 'm²', qty: 0, price: 0, dims: null, ...p });
export const receiptNo = (code: string, no: number) => `PT-${code}-${pad2(no || 0)}`;

/* ---------- lịch thanh toán theo đợt ---------- */
export const planRow = (r: PlanTpl): PlanRow => ({
  id: r.id || uid('d'), label: r.label || '', pct: Number(r.pct) || 0, trigger: r.trigger && TRIGGERS[r.trigger] ? r.trigger : 'date',
  ...(r.fixed ? { fixed: true, amt: Math.max(0, Math.round(Number(r.amt) || 0)) } : {}),
});
export const newPlan = (tpl: PlanTpl[] = DEFAULT_PLAN): PlanRow[] => tpl.map((r) => planRow({ ...r, id: '' }));
export function mergePlan(oldPlan: PlanRow[] | null | undefined, rows: PlanRow[] | null | undefined): PlanRow[] {
  return (rows || []).map((r) => { const old = (oldPlan || []).find((x) => x.id === r.id); return { ...planRow(r), due: old?.due || r.due || '', reached: old?.reached || false }; });
}
export const planPctSum = (plan: PlanRow[]) => (plan || []).slice(0, -1).reduce((s, r) => s + (r.fixed ? 0 : Number(r.pct) || 0), 0);
export type PlanAmount = PlanRow & { n: number; last: boolean; amount: number; raw: number };
export function planAmounts(plan: PlanRow[] | null | undefined, total: number): PlanAmount[] {
  const rows = plan || []; let used = 0;
  return rows.map((r, i) => {
    const last = i === rows.length - 1;
    let amount: number;
    if (last) amount = total - used;
    else { amount = r.fixed ? Math.round(Number(r.amt) || 0) : Math.round((total * (Number(r.pct) || 0)) / 100); used += amount; }
    return { ...r, n: i + 1, last, amount: Math.max(0, amount), raw: amount };
  });
}
/** Các đợt trước đã chiếm hết giá trị đơn → đợt cuối bằng 0. */
export function planOver(plan: PlanRow[] | null | undefined, total: number): boolean {
  if (!plan || plan.length < 2) return false;
  if (!(total > 0)) return planPctSum(plan) >= 100;
  return planAmounts(plan, total)[plan.length - 1].raw <= 0;
}
export function planWarnText(plan: PlanRow[], total: number): string {
  if (!(total > 0)) return `Các đợt trước đã chiếm ${QF.format(planPctSum(plan))}%. Đợt cuối sẽ bằng 0, hãy giảm bớt.`;
  const used = planAmounts(plan, total).slice(0, -1).reduce((s, r) => s + r.raw, 0);
  return `Các đợt trước đã chiếm ${money(used)} đ, bằng hoặc hơn giá trị ${money(total)} đ. Đợt cuối sẽ bằng 0, hãy giảm bớt.`;
}

/* ---------- đơn ---------- */
export const isClosed = (o: Pick<Order, 'status'>) => o.status !== 'quote';
export const lastVersion = (o: Pick<Order, 'versions'>) => (o.versions && o.versions.length ? o.versions[o.versions.length - 1] : null);
export const headQuote = (o: Order): Quote | null => (isClosed(o) ? lastVersion(o)?.quote ?? null : o.draft);
export const changeSigned = (c: Pick<Change, 'sign' | 'amount'>) => (c.sign < 0 ? -c.amount : c.amount);
export const confirmedChanges = (o: Pick<Order, 'changes'>) => (o.changes || []).filter((c) => c.status === 'confirmed').reduce((s, c) => s + changeSigned(c), 0);
export const orderPaid = (o: Pick<Order, 'payments'>) => (o.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
export function orderTotal(o: Order): number {
  if (!isClosed(o)) return quoteTotals(o.draft).total;
  const v = lastVersion(o);
  return (v ? v.total : 0) + confirmedChanges(o);
}
/** Không chia đợt: coi như một khoản thu một lần, đến hạn khi nghiệm thu hoặc theo ngày hẹn. */
const effPlan = (o: Order): PlanRow[] =>
  Array.isArray(o.plan) && o.plan.length > 0 ? o.plan : [{ id: 'all', label: 'Thanh toán phần còn lại', pct: 0, trigger: 'accept', due: o.payDue || '', one: true }];
function triggerReached(o: Order, r: PlanRow): boolean {
  if (r.reached) return true;
  if (r.trigger === 'sign') return isClosed(o);
  if (r.trigger === 'progress') return o.status === 'building' || o.status === 'done' || !!o.handover;
  if (r.trigger === 'accept') return o.status === 'done' || !!o.handover;
  return false;
}
export const dotLabel = (r: { one?: boolean; n: number }) => (r.one ? 'Thanh toán' : 'Đợt ' + r.n);
export const payNote = (r: { one?: boolean; n: number; label?: string }) => (r.one ? 'Thanh toán phần còn lại' : `Thanh toán đợt ${r.n}: ${r.label || ''}`);

export type MoneyRow = PlanAmount & { paid: number; left: number; state: PlanState };
export type OrderMoney = { base: number; chg: number; total: number; paid: number; due: number; over: number; rows: MoneyRow[]; next: MoneyRow | null };
/**
 * orderMoney(đơn, tùy chọn) → { base, chg, total, paid, due, over, rows, next }
 *   base : giá trị báo giá làm gốc chia đợt (bản chốt mới nhất, hoặc báo giá đang soạn)
 *   chg  : phát sinh đã xác nhận (cộng vào đợt cuối; giảm thì trừ lùi dần từ đợt cuối)
 * Tùy chọn: quote = tính theo báo giá này (bản đang sửa, bản cũ); plan = dùng lịch này;
 *           pays = false: không trừ tiền đã trả (in bản cũ đã bị thay); today = ngày hôm nay (để test).
 */
export function orderMoney(o: Order, { quote = null, plan = null, pays = true, today = vnToday() }: { quote?: Quote | null; plan?: PlanRow[] | null; pays?: boolean; today?: string } = {}): OrderMoney {
  const closed = isClosed(o), v = lastVersion(o);
  const base = quote ? quoteTotals(quote).total : closed ? (v ? v.total : 0) : quoteTotals(o.draft).total;
  const chg = closed && pays ? confirmedChanges(o) : 0;
  const P = plan || (quote ? quote.plan || [] : closed ? effPlan(o) : o.draft?.plan || []);
  const rows = planAmounts(P, base) as MoneyRow[];
  let adj = chg;
  for (let i = rows.length - 1; i >= 0 && adj !== 0; i--) {
    const nv = rows[i].amount + adj;
    if (nv >= 0 || i === 0) { rows[i].amount = Math.max(0, nv); adj = 0; }
    else { adj = nv; rows[i].amount = 0; }
  }
  const paid = pays ? orderPaid(o) : 0;
  let pool = paid;
  for (const r of rows) {
    r.paid = Math.min(pool, r.amount); pool -= r.paid; r.left = r.amount - r.paid;
    r.state = r.left <= 0 ? 'paid' : r.due && r.due < today ? 'overdue' : closed && (triggerReached(o, r) || (!!r.due && r.due <= today)) ? 'due' : 'later';
  }
  const total = base + chg;
  return { base, chg, total, paid, due: closed ? Math.max(0, total - paid) : 0, over: Math.max(0, paid - total), rows, next: closed ? rows.find((r) => r.left > 0) || null : null };
}
export const planStatus = (o: Order, today = vnToday()) => (isClosed(o) ? orderMoney(o, { today }).rows : []);
export const overdueAmount = (o: Order, today = vnToday()) => planStatus(o, today).filter((r) => r.state === 'overdue').reduce((s, r) => s + r.left, 0);
export const dueNowAmount = (o: Order, today = vnToday()) => planStatus(o, today).filter((r) => r.state === 'overdue' || r.state === 'due').reduce((s, r) => s + r.left, 0);

/* ---------- doanh thu của đơn theo thời điểm (để chia theo tháng) ---------- */
export type ValueEvent = { date: string; amount: number; kind: 'close' | 'revise' | 'change'; label: string };
export function valueEvents(o: Pick<Order, 'status' | 'versions' | 'changes'>): ValueEvent[] {
  if (!isClosed(o)) return [];
  const ev: ValueEvent[] = [];
  (o.versions || []).forEach((v, i, arr) => {
    if (i === 0) ev.push({ date: v.closedAt, amount: v.total, kind: 'close', label: 'Chốt đơn' + (arr.length > 1 ? ' (bản 1)' : '') });
    else ev.push({ date: v.closedAt, amount: v.total - arr[i - 1].total, kind: 'revise', label: `Chốt bản ${v.no} (điều chỉnh báo giá)` });
  });
  (o.changes || []).filter((c) => c.status === 'confirmed').forEach((c) => ev.push({ date: c.confirmedAt || '', amount: changeSigned(c), kind: 'change', label: 'Phát sinh: ' + c.title }));
  return ev;
}
