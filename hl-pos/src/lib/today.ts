/* Màn "Hôm nay": việc cần làm suy ra từ danh sách đơn. Hàm thuần để test được. */
import { orderMoney, addDays, type Order, type OrderStatus } from './orderMoney';

export type TodayHead = { id: string; code: string; customer_name: string; follow_at: string | null; quote_date: string | null; status: OrderStatus };
export type TodayItem = { head: TodayHead; order: Order };

export function todayLists(items: TodayItem[], st: { follow_days: number }, today: string) {
  const overdue: (TodayItem & { amount: number })[] = [], due: (TodayItem & { amount: number })[] = [];
  const follow: (TodayItem & { since: string })[] = [], warranty: (TodayItem & { until: string })[] = [];
  const soon = addDays(today, 30);
  for (const it of items) {
    const { head, order } = it;
    if (head.status === 'quote') {
      const at = head.follow_at ?? (head.quote_date ? addDays(head.quote_date, st.follow_days || 0) : null);
      if (at && at <= today) follow.push({ ...it, since: head.quote_date ?? '' });
      continue;
    }
    const rows = orderMoney(order, { today }).rows;
    const o = rows.filter((r) => r.state === 'overdue').reduce((s, r) => s + r.left, 0);
    const d = rows.filter((r) => r.state === 'due').reduce((s, r) => s + r.left, 0);
    if (o > 0) overdue.push({ ...it, amount: o });
    if (d > 0) due.push({ ...it, amount: d });
    const until = order.handover?.warrantyUntil;
    if (until && until >= today && until <= soon) warranty.push({ ...it, until });
  }
  return {
    overdue, due, follow: follow.sort((a, b) => a.since.localeCompare(b.since)), warranty: warranty.sort((a, b) => a.until.localeCompare(b.until)),
    total: { overdue: overdue.reduce((s, x) => s + x.amount, 0), due: due.reduce((s, x) => s + x.amount, 0) },
  };
}
