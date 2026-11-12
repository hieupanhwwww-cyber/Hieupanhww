'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, errorText } from '@/lib/supabase/client';
import { useProfile } from '@/lib/useProfile';
import { STATUS_LABEL, type OrderStatus } from '@/lib/orders';
import { formatVnd, formatQty } from '@/lib/money';

type Revenue = { period: string; invoices: number; revenue: number; cost: number; profit: number; order_collected: number };
type Top = { product_id: string; name: string; quantity: number; revenue: number };
type Low = { product_id: string; code: string; name: string; unit: string; stock: number; threshold: number };
type Debt = { order_id: string; code: string; customer_name: string; phone: string; status: OrderStatus; total_value: number; remaining: number };

const vnToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const shift = (d: string, days: number) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + days); return x.toISOString().slice(0, 10); };
const monthStart = (d: string) => `${d.slice(0, 7)}-01`;
const fmtDate = (d: string, group: 'day' | 'month') => group === 'month' ? `${d.slice(5, 7)}/${d.slice(0, 4)}` : `${d.slice(8, 10)}/${d.slice(5, 7)}`;

function preset(name: string): [string, string] {
  const t = vnToday();
  if (name === 'today') return [t, t];
  if (name === '7d') return [shift(t, -6), t];
  if (name === 'lastMonth') { const end = shift(monthStart(t), -1); return [monthStart(end), end]; }
  if (name === 'year') return [`${t.slice(0, 4)}-01-01`, t];
  return [monthStart(t), t];
}

const num = <T,>(rows: T[] | null, keys: (keyof T)[]): T[] =>
  (rows ?? []).map((r) => ({ ...r, ...Object.fromEntries(keys.map((k) => [k, Number(r[k])])) }));

export default function ReportsPage() {
  const { role } = useProfile();
  if (role !== 'owner') return <p className="text-muted">Chỉ chủ cửa hàng xem được báo cáo.</p>;
  return <Reports />;
}

function Reports() {
  const [range, setRange] = useState<[string, string]>(preset('month'));
  const [active, setActive] = useState('month');
  const [group, setGroup] = useState<'day' | 'month'>('day');
  const [rev, setRev] = useState<Revenue[]>([]);
  const [top, setTop] = useState<Top[]>([]);
  const [low, setLow] = useState<Low[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const sb = supabase();
    const [from, to] = range;
    Promise.all([
      sb.rpc('report_revenue', { p_from: from, p_to: to, p_group: group }),
      sb.rpc('report_top_products', { p_from: from, p_to: to, p_limit: 10 }),
      sb.rpc('report_low_stock'),
      sb.rpc('report_order_debts'),
    ]).then(([r, t, l, d]) => {
      const err = r.error ?? t.error ?? l.error ?? d.error;
      if (err) { setError(errorText(err)); return; }
      setError('');
      setRev(num<Revenue>(r.data, ['invoices', 'revenue', 'cost', 'profit', 'order_collected']));
      setTop(num<Top>(t.data, ['quantity', 'revenue']));
      setLow(num<Low>(l.data, ['stock', 'threshold']));
      setDebts(num<Debt>(d.data, ['total_value', 'remaining']));
    });
  }, [range, group]);

  const sum = (k: keyof Revenue) => rev.reduce((s, r) => s + (r[k] as number), 0);
  const totalDebt = debts.reduce((s, d) => s + d.remaining, 0);

  async function exportAll() {
    setExporting(true);
    try {
      const { data, error } = await supabase().rpc('export_all');
      if (error) throw error;
      const { buildWorkbook, backupFileName } = await import('@/lib/exportExcel');
      const buf = await buildWorkbook(data);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      a.download = backupFileName();
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(errorText(e));
    }
    setExporting(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Báo cáo</h1>
        <button className="btn-ghost" onClick={exportAll} disabled={exporting}>{exporting ? 'Đang xuất…' : '⬇ Xuất Excel sao lưu'}</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([['today', 'Hôm nay'], ['7d', '7 ngày'], ['month', 'Tháng này'], ['lastMonth', 'Tháng trước'], ['year', 'Năm nay']] as const).map(([k, label]) => (
          <button key={k} onClick={() => { setActive(k); setRange(preset(k)); setGroup(k === 'year' ? 'month' : 'day'); }}
            className={`chip border px-3 py-1 text-sm ${active === k ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-muted'}`}>{label}</button>
        ))}
        <input type="date" className="input w-auto py-1.5" value={range[0]} max={range[1]} onChange={(e) => { setActive(''); setRange([e.target.value, range[1]]); }} />
        <span className="text-muted">→</span>
        <input type="date" className="input w-auto py-1.5" value={range[1]} min={range[0]} onChange={(e) => { setActive(''); setRange([range[0], e.target.value]); }} />
        <select className="input w-auto py-1.5" value={group} onChange={(e) => setGroup(e.target.value as 'day' | 'month')}>
          <option value="day">Theo ngày</option><option value="month">Theo tháng</option>
        </select>
      </div>
      {error && <p className="text-danger">{error}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Doanh thu bán lẻ" value={formatVnd(sum('revenue'))} sub={`${sum('invoices')} hóa đơn`} />
        <Stat label="Lợi nhuận bán lẻ" value={formatVnd(sum('profit'))} sub={`Giá vốn ${formatVnd(sum('cost'))}`} />
        <Stat label="Thu từ đơn nội thất" value={formatVnd(sum('order_collected'))} sub="theo ngày thu tiền" />
        <Stat label="Khách còn nợ" value={formatVnd(totalDebt)} sub={`${debts.length} đơn`} danger={totalDebt > 0} />
      </div>

      <section className="card overflow-x-auto">
        <h2 className="mb-2 font-semibold">Theo {group === 'day' ? 'ngày' : 'tháng'}</h2>
        {!rev.length ? <p className="text-sm text-muted">Chưa có số liệu trong khoảng này.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-muted">
              <th className="py-2">{group === 'day' ? 'Ngày' : 'Tháng'}</th><th className="text-right">HĐ</th><th className="text-right">Doanh thu</th>
              <th className="text-right">Lợi nhuận</th><th className="text-right">Thu đơn NT</th>
            </tr></thead>
            <tbody>
              {rev.map((r) => (
                <tr key={r.period} className="border-b border-line/60">
                  <td className="py-2">{fmtDate(r.period, group)}</td><td className="text-right">{r.invoices}</td>
                  <td className="text-right">{formatVnd(r.revenue)}</td><td className="text-right">{formatVnd(r.profit)}</td>
                  <td className="text-right">{formatVnd(r.order_collected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card">
          <h2 className="mb-2 font-semibold">Bán chạy</h2>
          {!top.length ? <p className="text-sm text-muted">Chưa bán món nào.</p> : (
            <ol className="space-y-1 text-sm">
              {top.map((t, i) => (
                <li key={t.product_id} className="flex justify-between gap-2">
                  <span>{i + 1}. {t.name}</span><span className="text-muted">{formatQty(t.quantity)} · {formatVnd(t.revenue)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="card">
          <h2 className="mb-2 font-semibold">Sắp hết hàng</h2>
          {!low.length ? <p className="text-sm text-muted">Không có món nào sắp hết.</p> : (
            <ul className="space-y-1 text-sm">
              {low.map((l) => (
                <li key={l.product_id} className="flex justify-between gap-2">
                  <span>{l.name} <span className="text-muted">· {l.code}</span></span>
                  <span className="text-danger">còn {formatQty(l.stock)} {l.unit}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <h2 className="mb-2 font-semibold">Khách còn nợ (đơn nội thất)</h2>
        {!debts.length ? <p className="text-sm text-muted">Không có khách nợ.</p> : (
          <ul className="divide-y divide-line text-sm">
            {debts.map((d) => (
              <li key={d.order_id}>
                <Link href={`/don-noi-that/${d.order_id}`} className="flex justify-between gap-2 py-2">
                  <span>{d.customer_name} <span className="text-muted">· {d.code} · {STATUS_LABEL[d.status]}</span></span>
                  <span className="font-medium text-danger">{formatVnd(d.remaining)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub, danger }: { label: string; value: string; sub: string; danger?: boolean }) {
  return (
    <div className="card">
      <div className="text-sm text-muted">{label}</div>
      <div className={`text-lg font-bold ${danger ? 'text-danger' : 'text-text'}`}>{value}</div>
      <div className="text-xs text-muted">{sub}</div>
    </div>
  );
}
