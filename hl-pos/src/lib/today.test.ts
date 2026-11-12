import { describe, it, expect } from 'vitest';
import { todayLists, type TodayItem } from './today';
import { newPlan, mergePlan, DEFAULT_PLAN, type Order } from './orderMoney';

const T = '2026-11-12';
function item(code: string, over: Partial<Order> & { follow_at?: string | null; quote_date?: string | null } = {}): TodayItem {
  const { follow_at = null, quote_date = '2026-11-01', ...o } = over;
  const status = o.status ?? 'closed';
  const plan = mergePlan([], newPlan(DEFAULT_PLAN));
  const order: Order = { id: code, code, status, draft: null, versions: status === 'quote' ? [] : [{ no: 1, quote: null as never, sub: 10_000_000, disc: 0, total: 10_000_000, closedAt: '2026-11-01', sign: null }],
    plan, payDue: '', payments: [], changes: [], handover: null, closedAt: '2026-11-01', ...o };
  return { head: { id: code, code, customer_name: 'K ' + code, follow_at, quote_date, status }, order };
}

describe('Hôm nay', () => {
  it('quá hạn, đến hạn (không lặp đơn quá hạn), cần gọi lại, sắp hết bảo hành', () => {
    const late = item('A'); late.order.plan[1].due = '2026-11-10';
    const paid = item('B', { payments: [{ id: 'p', no: 1, amount: 5_000_000, date: T, method: 'cash', note: '', deposit: false }] });
    const q1 = item('Q1', { status: 'quote', quote_date: '2026-11-08' });          // 4 ngày > 3 → cần gọi
    const q2 = item('Q2', { status: 'quote', quote_date: '2026-11-11' });          // mới báo giá
    const q3 = item('Q3', { status: 'quote', quote_date: '2026-11-01', follow_at: '2026-11-20' }); // đã hẹn ngày khác
    const w = item('W', { status: 'done', handover: { date: '2023-12-01', warrantyMonths: 36, warrantyUntil: '2026-12-01', note: '', sign: null } });
    const wFar = item('W2', { status: 'done', handover: { date: '2024-06-01', warrantyMonths: 36, warrantyUntil: '2027-06-01', note: '', sign: null }, payments: [{ id: 'p2', no: 1, amount: 10_000_000, date: T, method: 'cash', note: '', deposit: false }] });
    const r = todayLists([late, paid, q1, q2, q3, w, wFar], { follow_days: 3 }, T);
    expect(r.overdue.map((x) => [x.head.code, x.amount])).toEqual([['A', 4_000_000]]);
    expect(r.due.map((x) => [x.head.code, x.amount])).toEqual([['A', 5_000_000], ['W', 10_000_000]]);
    expect(r.follow.map((x) => x.head.code)).toEqual(['Q1']);
    expect(r.warranty.map((x) => [x.head.code, x.until])).toEqual([['W', '2026-12-01']]);
    expect(r.total).toEqual({ overdue: 4_000_000, due: 15_000_000 });
  });
});
