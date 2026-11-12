'use client';
/* Đọc/ghi đơn nội thất qua Supabase; đổi dữ liệu DB thành kiểu Order mà orderMoney hiểu. */
import { supabase } from './supabase/client';
import type { Order, Quote, Version, Payment, PlanRow, Handover, OrderStatus, SignRecord, Change } from './orderMoney';

export type OrderHead = {
  id: string; code: string; status: OrderStatus; customer_name: string; customer_phone: string; project: string;
  quote_date: string | null; total: number; closed_at: string | null; follow_at: string | null; rev: number; created_at: string; has_draft: boolean;
};
export type LogEntry = { id: number; at: string; by: string | null; text: string };
export type Material = { id: string; product_id: string; quantity: number; created_at: string };
export type OrderFull = { head: OrderHead; order: Order; log: LogEntry[]; materials: Material[]; payMeta: Record<string, { created_by: string | null; created_at: string }> };

const HEAD_COLS = 'id, code, status, customer_name, customer_phone, project, quote_date, total, closed_at, follow_at, rev, created_at, plan, pay_due, handover';
const n = Number;
const rpc = async <T,>(fn: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase().rpc(fn, args);
  if (error) throw error;
  return data as T;
};
type HeadRow = Omit<OrderHead, 'has_draft' | 'total'> & { total: number | string; plan: PlanRow[]; pay_due: string | null; handover: Handover | null };
const toPayment = (p: Record<string, unknown>): Payment => ({ id: p.id as string, no: n(p.no), amount: n(p.amount), date: p.date as string, method: p.method as Payment['method'], note: (p.note as string) ?? '', deposit: !!p.deposit });
const toChange = (c: Record<string, unknown>): Change => ({ id: c.id as string, sign: n(c.sign) < 0 ? -1 : 1, title: c.title as string, amount: n(c.amount), reason: (c.reason as string) ?? '', note: (c.note as string) ?? '',
  status: c.status as Change['status'], confirmedAt: (c.confirmed_at as string) ?? null, signRec: (c.sign_rec as SignRecord) ?? null });

/** Danh sách đơn, mỗi đơn kèm đủ dữ liệu để orderMoney tính đợt kế tiếp / cần thu. */
export async function listOrders(): Promise<{ head: OrderHead; order: Order }[]> {
  const sb = supabase();
  const [o, p, d, c] = await Promise.all([
    sb.from('orders').select(HEAD_COLS).order('created_at', { ascending: false }),
    sb.from('order_payments').select('id, order_id, no, amount, date, method, note, deposit'),
    sb.from('order_quotes').select('order_id, quote').is('version_no', null),
    sb.from('order_changes').select('id, order_id, sign, title, amount, reason, note, status, confirmed_at').then((r) => (r.error ? { data: [], error: null } : r)),
  ]);
  const err = o.error ?? p.error ?? d.error;
  if (err) throw err;
  const pays = new Map<string, Payment[]>(), drafts = new Map<string, Quote>(), chgs = new Map<string, Change[]>();
  for (const r of p.data ?? []) pays.set(r.order_id, [...(pays.get(r.order_id) ?? []), toPayment(r)]);
  for (const r of d.data ?? []) drafts.set(r.order_id, r.quote as Quote);
  for (const r of (c.data ?? []) as Record<string, unknown>[]) chgs.set(r.order_id as string, [...(chgs.get(r.order_id as string) ?? []), toChange(r)]);
  return ((o.data ?? []) as unknown as HeadRow[]).map((r) => {
    const total = n(r.total), closed = r.status !== 'quote', draft = drafts.get(r.id) ?? null;
    const head: OrderHead = { ...r, total, has_draft: !!draft };
    // bản chốt mới nhất: danh sách chỉ cần tổng (orders.total), không cần nội dung
    const versions: Version[] = closed ? [{ no: 1, quote: null as unknown as Quote, sub: total, disc: 0, total, closedAt: r.closed_at ?? '', sign: null }] : [];
    return { head, order: { id: r.id, code: r.code, status: r.status, draft: closed ? null : draft, versions, plan: r.plan ?? [], payDue: r.pay_due ?? '',
      payments: pays.get(r.id) ?? [], changes: chgs.get(r.id) ?? [], handover: r.handover, closedAt: r.closed_at } };
  });
}

export async function getOrder(id: string): Promise<OrderFull> {
  const sb = supabase();
  const [o, q, p, l, m, c] = await Promise.all([
    sb.from('orders').select(HEAD_COLS).eq('id', id).maybeSingle(),
    sb.from('order_quotes').select('version_no, quote, sub, disc, total, closed_at, sign').eq('order_id', id).order('version_no', { nullsFirst: false }),
    sb.from('order_payments').select('id, no, amount, date, method, note, deposit, created_by, created_at').eq('order_id', id).order('no'),
    sb.from('order_log').select('id, at, by, text').eq('order_id', id).order('id', { ascending: false }).limit(200),
    sb.from('stock_movements').select('id, product_id, quantity, created_at').eq('order_id', id).order('created_at'),
    sb.from('order_changes').select('id, sign, title, amount, reason, note, status, confirmed_at, sign_rec').eq('order_id', id).order('created_at').then((r) => (r.error ? { data: [], error: null } : r)),
  ]);
  const err = o.error ?? q.error ?? p.error ?? l.error ?? m.error;
  if (err) throw err;
  if (!o.data) throw new Error('Không tìm thấy đơn.');
  const r = o.data as unknown as HeadRow;
  const quotes = q.data ?? [];
  const draft = (quotes.find((x) => x.version_no == null)?.quote as Quote) ?? null;
  const versions: Version[] = quotes.filter((x) => x.version_no != null).map((x) => ({ no: x.version_no, quote: x.quote as Quote, sub: n(x.sub), disc: n(x.disc), total: n(x.total), closedAt: x.closed_at, sign: (x.sign as SignRecord) ?? null }));
  return {
    head: { ...r, total: n(r.total), has_draft: !!draft },
    order: { id: r.id, code: r.code, status: r.status, draft, versions, plan: r.plan ?? [], payDue: r.pay_due ?? '', payments: (p.data ?? []).map(toPayment),
      changes: ((c.data ?? []) as Record<string, unknown>[]).map(toChange), handover: r.handover, closedAt: r.closed_at },
    log: (l.data ?? []) as LogEntry[],
    materials: (m.data ?? []).map((x) => ({ ...x, quantity: n(x.quantity) })) as Material[],
    payMeta: Object.fromEntries((p.data ?? []).map((x) => [x.id, { created_by: x.created_by, created_at: x.created_at }])),
  };
}

export const saveDraft = (orderId: string | null, quote: Quote, rev: number | null) =>
  rpc<{ order_id: string; code: string; rev: number }>('save_quote_draft', { p_order_id: orderId, p_quote: quote, p_rev: rev });
export const closeOrder = (orderId: string, a: { date: string; deposit: number; method: 'transfer' | 'cash'; sign: SignRecord | null }) =>
  rpc<{ version_no: number; total: number }>('close_order', { p_order_id: orderId, p_date: a.date, p_deposit: a.deposit, p_method: a.method, p_sign: a.sign });
export const addPayment = (orderId: string, a: { amount: number; date: string; method: 'transfer' | 'cash'; note: string; deposit?: boolean }) =>
  rpc<{ id: string; no: number }>('add_payment', { p_order_id: orderId, p_amount: a.amount, p_date: a.date, p_method: a.method, p_note: a.note, p_deposit: !!a.deposit });
export const deletePayment = (id: string) => rpc<void>('delete_payment', { p_id: id });
export const setStatus = (orderId: string, status: OrderStatus) => rpc<void>('set_order_status', { p_order_id: orderId, p_status: status });
export const setPlanRow = (orderId: string, planId: string, due: string | null, reached: boolean) =>
  rpc<void>('set_plan_row', { p_order_id: orderId, p_plan_id: planId, p_due: due || null, p_reached: reached });
export const setFollowAt = (orderId: string, date: string | null) => rpc<void>('set_follow_at', { p_order_id: orderId, p_date: date });
export const deleteOrder = (orderId: string) => rpc<void>('delete_order', { p_order_id: orderId });
export const addMaterial = (orderId: string, productId: string, quantity: number) =>
  rpc<string>('add_order_material', { p_order_id: orderId, p_product_id: productId, p_quantity: quantity });
