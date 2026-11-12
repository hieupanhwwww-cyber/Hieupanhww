'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { errorText } from '@/lib/supabase/client';
import { listOrders, type OrderHead } from '@/lib/ordersApi';
import { STATUS, orderMoney, dueNowAmount, overdueAmount, dotLabel, fmtDate, type Order, type OrderStatus } from '@/lib/orderMoney';
import { matches } from '@/lib/products';
import { formatVnd } from '@/lib/money';

type Filter = 'all' | OrderStatus | 'due';
type Item = { head: OrderHead; order: Order };

export default function OrdersPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  useEffect(() => { listOrders().then(setItems, (e) => setError(errorText(e))); }, []);

  const shown = useMemo(() => (items ?? []).filter(({ head, order }) =>
    (filter === 'all' || (filter === 'due' ? dueNowAmount(order) > 0 : head.status === filter)) &&
    matches({ code: `${head.code} ${head.customer_phone}`, name: `${head.customer_name} ${head.project}` }, query),
  ), [items, filter, query]);
  const dueCount = (items ?? []).filter((i) => dueNowAmount(i.order) > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Đơn nội thất</h1>
        <Link className="btn-primary" href="/don-noi-that/moi/sua">+ Báo giá mới</Link>
      </div>
      <input className="input" placeholder="Tìm tên khách, SĐT, mã đơn, công trình…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {([['all', 'Tất cả'], ...(Object.keys(STATUS) as OrderStatus[]).map((s) => [s, STATUS[s].label]), ['due', `Cần thu (${dueCount})`]] as [Filter, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`chip border px-3 py-1 text-sm ${filter === k ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-muted'}`}>{label}</button>
        ))}
      </div>
      {error && <p className="text-danger">{error}</p>}
      {!items && !error && <p className="text-muted">Đang tải…</p>}
      <ul className="space-y-2">
        {shown.map(({ head, order }) => <OrderCard key={head.id} head={head} order={order} />)}
        {items && !shown.length && <li className="text-muted">{items.length ? 'Không có đơn phù hợp.' : 'Chưa có đơn nào. Bấm "Báo giá mới" để bắt đầu.'}</li>}
      </ul>
    </div>
  );
}

function OrderCard({ head, order }: Item) {
  const m = orderMoney(order);
  const over = overdueAmount(order), dueNow = dueNowAmount(order);
  return (
    <li>
      <Link href={`/don-noi-that/${head.id}`} className="card flex items-start gap-3 hover:border-brand" data-order={head.code}>
        <div className="min-w-0 flex-1">
          <div className="font-medium">{head.customer_name} <span className="text-sm font-normal text-muted">· {head.code}</span></div>
          <div className="truncate text-sm text-muted">{[head.project, head.customer_phone].filter(Boolean).join(' · ') || '—'}</div>
          <div className="mt-1 text-sm">{formatVnd(m.total)}</div>
        </div>
        <div className="text-right text-sm">
          <span className={`chip ${STATUS[head.status].cls}`}>{STATUS[head.status].label}</span>
          {head.status === 'quote' ? (
            <div className="mt-1 text-muted">Báo giá {fmtDate(head.quote_date)}</div>
          ) : over > 0 ? (
            <div className="mt-1 font-medium text-danger">Quá hạn {formatVnd(over)}</div>
          ) : dueNow > 0 ? (
            <div className="mt-1 font-medium text-amber-800">Cần thu {formatVnd(dueNow)}</div>
          ) : m.next ? (
            <div className="mt-1 text-muted">{dotLabel(m.next)}: {formatVnd(m.next.left)}</div>
          ) : (
            <div className="mt-1 text-ok">{m.over > 0 ? `Trả thừa ${formatVnd(m.over)}` : 'Đã thu đủ'}</div>
          )}
          {head.has_draft && head.status !== 'quote' && <div className="mt-1 text-xs text-amber-800">Đang sửa báo giá</div>}
        </div>
      </Link>
    </li>
  );
}
