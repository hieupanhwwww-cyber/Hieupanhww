'use client';
import Link from 'next/link';
import { todayLists, type TodayItem } from '@/lib/today';
import { fmtDate, vnToday } from '@/lib/orderMoney';
import { formatVnd } from '@/lib/money';

/** Hôm nay: đợt quá hạn / đến hạn, báo giá cần gọi lại, khách sắp hết bảo hành. */
export function TodayPanel({ items, followDays }: { items: TodayItem[]; followDays: number }) {
  const t = todayLists(items, { follow_days: followDays }, vnToday());
  const empty = !t.overdue.length && !t.due.length && !t.follow.length && !t.warranty.length;
  const Row = ({ id, left, right, cls = '' }: { id: string; left: string; right: string; cls?: string }) => (
    <li><Link href={`/don-noi-that/${id}`} className="flex justify-between gap-2 py-1.5 text-sm"><span className="truncate">{left}</span><b className={`shrink-0 ${cls}`}>{right}</b></Link></li>
  );
  return (
    <section className="card space-y-3" data-today>
      <h2 className="font-semibold">Hôm nay</h2>
      {empty && <p className="text-sm text-muted">Không có việc gấp. 👍</p>}
      {t.overdue.length > 0 && (
        <div><div className="text-sm font-medium text-danger">Quá hạn thu · {formatVnd(t.total.overdue)}</div>
          <ul className="divide-y divide-line">{t.overdue.map((x) => <Row key={x.head.id} id={x.head.id} left={`${x.head.customer_name} · ${x.head.code}`} right={formatVnd(x.amount)} cls="text-danger" />)}</ul></div>
      )}
      {t.due.length > 0 && (
        <div><div className="text-sm font-medium text-amber-800">Đến hạn thu · {formatVnd(t.total.due)}</div>
          <ul className="divide-y divide-line">{t.due.map((x) => <Row key={x.head.id} id={x.head.id} left={`${x.head.customer_name} · ${x.head.code}`} right={formatVnd(x.amount)} />)}</ul></div>
      )}
      {t.follow.length > 0 && (
        <div><div className="text-sm font-medium">Cần gọi lại báo giá</div>
          <ul className="divide-y divide-line">{t.follow.map((x) => <Row key={x.head.id} id={x.head.id} left={`${x.head.customer_name} · ${x.head.code}`} right={x.since ? `báo giá ${fmtDate(x.since)}` : ''} />)}</ul></div>
      )}
      {t.warranty.length > 0 && (
        <div><div className="text-sm font-medium">Sắp hết bảo hành (30 ngày) – gọi chăm sóc</div>
          <ul className="divide-y divide-line">{t.warranty.map((x) => <Row key={x.head.id} id={x.head.id} left={`${x.head.customer_name} · ${x.head.code}`} right={fmtDate(x.until)} />)}</ul></div>
      )}
    </section>
  );
}
