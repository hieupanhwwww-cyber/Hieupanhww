/* Đọc file sao lưu của Sổ Nội Thất và đổi thành dữ liệu để nhập vào HL Bán Hàng (hàm import_snt trên máy chủ). */
import { UNITS, orderMoney, planRow, uid, fmtDate, type Quote, type QuoteRow, type PlanRow, type SignRecord, type Handover, type Order, type OrderStatus, type Unit } from './orderMoney';
import { formatVnd } from './money';

type Raw = Record<string, unknown>;
type Cols = { orders: Raw[]; customers: Raw[]; catalog: Raw[]; costs?: Raw[]; cash?: Raw[]; app?: Raw[] };

/** Nhận file sao lưu định dạng mới ("so-noi-that" bản 2) và định dạng cũ (trước 20/10/2026). */
export function readBackup(raw: unknown): { at: string; cols: Cols } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Raw;
  const data = r.data as Raw | undefined;
  if (r.format === 'so-noi-that' && data && Array.isArray(data.orders)) {
    return { at: String(r.exportedAt ?? ''), cols: { orders: data.orders as Raw[], customers: (data.customers as Raw[]) ?? [], catalog: (data.catalog as Raw[]) ?? [], costs: (data.costs as Raw[]) ?? [], cash: (data.cash as Raw[]) ?? [], app: (data.app as Raw[]) ?? [] } };
  }
  if (Array.isArray(r.orders) && (r.app === 'so-noi-that' || Array.isArray(r.app)) && Array.isArray(r.catalog ?? []) && Array.isArray(r.customers ?? [])) {
    return { at: String(r.exportedAt ?? ''), cols: { orders: r.orders as Raw[], customers: (r.customers as Raw[]) ?? [], catalog: (r.catalog as Raw[]) ?? [], app: Array.isArray(r.app) ? (r.app as Raw[]) : [] } };
  }
  return null;
}

export type ImportOrder = {
  legacy_id: string; code: string; status: OrderStatus; created_at: string | null; closed_at: string | null; customer_legacy_id: string | null;
  plan: PlanRow[]; pay_due: string; handover: Handover | null; draft: Quote | null;
  versions: { no: number; quote: Quote; closed_at: string; sign: SignRecord | null; file_total: number }[];
  payments: { legacy_id: string; no: number; amount: number; date: string; method: 'transfer' | 'cash'; note: string; deposit: boolean }[];
  changes: { legacy_id: string; sign: 1 | -1; title: string; amount: number; reason: 'other'; note: string; status: 'pending' | 'confirmed' | 'cancelled'; confirmed_at: string | null; sign_rec: SignRecord | null }[];
  notes: { text: string; at: string }[]; log: { at: string; text: string }[];
  costs: { rows: Record<string, number>; chg: Record<string, number>; ship: number } | null;
};
export type ImportPayload = {
  customers: { legacy_id: string; name: string; phone: string; address: string }[];
  catalog: { legacy_id: string; name: string; material: string; unit: Unit; price: number; cost: number | null }[];
  orders: ImportOrder[];
  cash: { legacy_id: string; type: 'in' | 'out'; date: string; amount: number; cat: string; note: string; method: 'cash' | 'transfer'; order_legacy_id: string | null }[];
  skipped: { kind: 'demo' | 'payReq' | 'attachment' | 'unit' | 'invalid'; id: string; why: string }[];
};

const str = (v: unknown) => (v == null ? '' : String(v));
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const date10 = (v: unknown) => (v ? String(v).slice(0, 10) : '');

function normQuote(q: Raw, skipped: ImportPayload['skipped'], code: string): Quote {
  const c = (q.customer as Raw) ?? {};
  const rows: QuoteRow[] = ((q.rows as Raw[]) ?? []).map((r) => {
    let unit = str(r.unit) as Unit;
    if (!UNITS.includes(unit)) { skipped.push({ kind: 'unit', id: code, why: `Đơn ${code}: dòng "${str(r.name)}" có đơn vị "${unit}" lạ, đổi thành "cái"` }); unit = 'cái'; }
    const d = r.dims as Raw | null | undefined;
    return { id: str(r.id) || uid('r'), name: str(r.name), material: str(r.material), unit, qty: num(r.qty), price: Math.round(num(r.price)),
      dims: d ? { a: num(d.a), b: num(d.b), n: num(d.n) || 1, u: (['mm', 'cm', 'm'].includes(str(d.u)) ? str(d.u) : 'mm') as 'mm' } : null };
  });
  const disc = (q.discount as Raw) ?? {};
  return {
    date: date10(q.date), customer: { name: str(c.name), phone: str(c.phone), address: str(c.address) }, project: str(q.project), rows,
    discount: { type: disc.type === 'percent' ? 'percent' : 'amount', value: num(disc.value) }, note: str(q.note), terms: str(q.terms),
    validUntil: date10(q.validUntil), plan: ((q.plan as Raw[]) ?? []).map((p) => planRow(p as Partial<PlanRow>)).map((p, i) => ({ ...p, id: str(((q.plan as Raw[])[i]).id) || p.id })),
  };
}
const sign = (s: unknown): SignRecord | null => { const r = s as Raw | null; return r && r.img ? { img: str(r.img), name: str(r.name), at: str(r.at), hash: str(r.hash) } : null; };

export function toImportPayload(cols: Cols): ImportPayload {
  const skipped: ImportPayload['skipped'] = [];
  const costs = new Map((cols.costs ?? []).map((c) => [str(c.id), c]));
  const customers = cols.customers.filter((c) => !c.demo && str(c.name).trim()).map((c) => ({ legacy_id: str(c.id), name: str(c.name).trim(), phone: str(c.phone), address: str(c.address) }));
  const catalog = cols.catalog.filter((k) => !k.demo && str(k.name).trim()).map((k) => {
    const cc = costs.get('k_' + str(k.id));
    const unit = (UNITS.includes(str(k.unit) as Unit) ? str(k.unit) : 'cái') as Unit;
    return { legacy_id: str(k.id), name: str(k.name).trim(), material: str(k.material), unit, price: Math.round(num(k.price)), cost: cc && num(cc.cost) > 0 ? Math.round(num(cc.cost)) : null };
  });
  const orders: ImportOrder[] = [];
  for (const o of cols.orders) {
    const code = str(o.code) || str(o.id);
    if (o.demo) { skipped.push({ kind: 'demo', id: str(o.id), why: `Đơn mẫu ${code} (dữ liệu demo) không nhập` }); continue; }
    const status = (['quote', 'closed', 'building', 'done'].includes(str(o.status)) ? str(o.status) : 'quote') as OrderStatus;
    const versions = ((o.versions as Raw[]) ?? []).map((v) => ({ no: num(v.no), quote: normQuote((v.quote as Raw) ?? {}, skipped, code), closed_at: date10(v.closedAt), sign: sign(v.sign), file_total: Math.round(num(v.total)) }))
      .sort((a, b) => a.no - b.no);
    const draft = o.draft ? normQuote(o.draft as Raw, skipped, code) : null;
    if (!versions.length && !draft) { skipped.push({ kind: 'invalid', id: str(o.id), why: `Đơn ${code} không có báo giá, bỏ qua` }); continue; }
    if (status !== 'quote' && !versions.length) { skipped.push({ kind: 'invalid', id: str(o.id), why: `Đơn ${code} đã chốt nhưng không có bản chốt, bỏ qua` }); continue; }
    // số phiếu thu: giữ số cũ, phiếu thiếu số được đánh tiếp theo thứ tự thời gian
    const pays = [...((o.payments as Raw[]) ?? [])].sort((a, b) => str(a.createdAt || a.date).localeCompare(str(b.createdAt || b.date)));
    let maxNo = pays.reduce((m, p) => Math.max(m, num(p.no)), 0);
    const payments = pays.filter((p) => num(p.amount) > 0).map((p) => ({
      legacy_id: str(p.id), no: num(p.no) || ++maxNo, amount: Math.round(num(p.amount)), date: date10(p.date), method: (p.method === 'cash' ? 'cash' : 'transfer') as 'cash' | 'transfer',
      note: str(p.note), deposit: /đặt cọc/i.test(str(p.note)),
    })).sort((a, b) => a.no - b.no);
    for (const r of (o.payReqs as Raw[]) ?? []) if (r.status === 'pending') {
      skipped.push({ kind: 'payReq', id: str(r.id), why: `Đơn ${code}: "${str(r.byName) || 'ai đó'}" báo đã thu ${formatVnd(num(r.amount))} ngày ${fmtDate(date10(r.date))} nhưng chưa được xác nhận – kiểm tra lại rồi ghi phiếu thu tay nếu đúng` });
    }
    for (const a of (o.attachments as Raw[]) ?? []) skipped.push({ kind: 'attachment', id: str(a.id), why: `Đơn ${code}: ảnh/tệp "${str(a.name) || str(a.id)}" cần tải lại tay vào đơn` });
    const oc = costs.get('o_' + str(o.id));
    orders.push({
      legacy_id: str(o.id), code, status, created_at: str(o.createdAt) || null, closed_at: date10(o.closedAt) || null, customer_legacy_id: str(o.customerId) || null,
      plan: ((o.plan as Raw[]) ?? []).map((p) => ({ ...planRow(p as Partial<PlanRow>), id: str(p.id) || uid('d'), ...(p.due ? { due: date10(p.due) } : {}), ...(p.reached ? { reached: true } : {}) })),
      pay_due: date10(o.payDue), handover: o.handover ? { ...(o.handover as Handover), date: date10((o.handover as Raw).date), warrantyUntil: date10((o.handover as Raw).warrantyUntil) } : null,
      draft, versions, payments,
      changes: ((o.changes as Raw[]) ?? []).filter((c) => num(c.amount) > 0 && str(c.title).trim()).map((c) => ({
        legacy_id: str(c.id), sign: num(c.sign) < 0 ? -1 : 1, title: str(c.title).trim(), amount: Math.round(num(c.amount)), reason: 'other', note: str(c.note),
        status: (['pending', 'confirmed', 'cancelled'].includes(str(c.status)) ? str(c.status) : 'pending') as 'pending', confirmed_at: date10(c.confirmedAt) || null, sign_rec: sign(c.sign_rec ?? c.signRec),
      })),
      notes: ((o.notes as Raw[]) ?? []).filter((n) => str(n.text).trim()).map((n) => ({ text: str(n.text), at: str(n.at) })),
      log: ((o.log as Raw[]) ?? []).map((l) => ({ at: str(l.at), text: str(l.text) + (l.by ? ` (${str(l.by)})` : '') })),
      costs: oc ? { rows: (oc.rows as Record<string, number>) ?? {}, chg: (oc.chg as Record<string, number>) ?? {}, ship: Math.round(num(oc.ship)) } : null,
    });
  }
  const orderIds = new Set(orders.map((o) => o.legacy_id));
  const cash = (cols.cash ?? []).filter((e) => !e.demo && num(e.amount) > 0 && (e.type === 'in' || e.type === 'out') && str(e.cat).trim()).map((e) => ({
    legacy_id: str(e.id), type: e.type as 'in' | 'out', date: date10(e.date), amount: Math.round(num(e.amount)), cat: str(e.cat).trim(), note: str(e.note),
    method: (e.method === 'transfer' ? 'transfer' : 'cash') as 'cash' | 'transfer', order_legacy_id: e.oid && orderIds.has(str(e.oid)) ? str(e.oid) : null,
  }));
  return { customers, catalog, orders, cash, skipped };
}

/** Số tiền của đơn theo đúng quy tắc tính tiền (để đối chiếu với máy chủ sau khi nhập). */
export function expectedTotals(o: ImportOrder): { total: number; paid: number; due: number } {
  const order: Order = {
    id: o.legacy_id, code: o.code, status: o.status, draft: o.draft, plan: o.plan, payDue: o.pay_due, handover: o.handover, closedAt: o.closed_at,
    versions: o.versions.map((v) => { const t = totalsOf(v.quote); return { no: v.no, quote: v.quote, ...t, closedAt: v.closed_at, sign: v.sign }; }),
    payments: o.payments.map((p) => ({ id: p.legacy_id, no: p.no, amount: p.amount, date: p.date, method: p.method, note: p.note, deposit: p.deposit })),
    changes: o.changes.map((c) => ({ id: c.legacy_id, sign: c.sign, title: c.title, amount: c.amount, reason: c.reason, note: c.note, status: c.status, confirmedAt: c.confirmed_at, signRec: c.sign_rec })),
  };
  const m = orderMoney(order);
  return { total: m.total, paid: m.paid, due: m.due };
}
function totalsOf(q: Quote) {
  const sub = q.rows.reduce((s, r) => s + Math.round(r.qty * r.price), 0);
  const disc = q.discount.type === 'percent' ? Math.round((sub * Math.min(Math.max(q.discount.value, 0), 100)) / 100) : Math.min(Math.max(Math.round(q.discount.value), 0), sub);
  return { sub, disc, total: sub - disc };
}
