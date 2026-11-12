'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { errorText } from '@/lib/supabase/client';
import { useProfile } from '@/lib/useProfile';
import { loadLedger, loadBooksOrders, loadCatalogCosts, closeBook, reopenBook } from '@/lib/booksApi';
import { saveSettings } from '@/lib/settings';
import { ledger, accrual, monthsBack, ymShort, ymLabel, type LedgerData, type BooksOrder, type CatalogCosts } from '@/lib/books';
import { vnToday, fmtDate } from '@/lib/orderMoney';
import { formatVnd } from '@/lib/money';
import { Modal } from '@/components/Modal';
import { MoneyInput } from '@/components/MoneyInput';
import { BooksTabs } from '@/components/BooksTabs';

type Range = 'last12' | 'year' | 'prev';
const sgn = (v: number | null) => (v == null ? '' : `${v < 0 ? '−' : ''}${formatVnd(Math.abs(v))}`);
const pct = (v: number | null) => (v == null ? '–' : `${(Math.round(v * 10) / 10).toLocaleString('vi-VN')}%`);

export default function BooksPage() {
  const { role } = useProfile();
  if (role !== 'owner') return <p className="text-muted">Chỉ chủ cửa hàng xem được sổ sách.</p>;
  return <Books />;
}

function months(r: Range, today: string): string[] {
  const y = Number(today.slice(0, 4)), cur = today.slice(0, 7);
  if (r === 'year') return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`).filter((m) => m <= cur);
  if (r === 'prev') return Array.from({ length: 12 }, (_, i) => `${y - 1}-${String(i + 1).padStart(2, '0')}`);
  return monthsBack(12, today);
}

function Books() {
  const [data, setData] = useState<LedgerData | null>(null);
  const [orders, setOrders] = useState<BooksOrder[]>([]);
  const [cat, setCat] = useState<CatalogCosts>(new Map());
  const [range, setRange] = useState<Range>('last12');
  const [error, setError] = useState('');
  const [startOpen, setStartOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  useEffect(() => {
    Promise.all([loadLedger(), loadBooksOrders(), loadCatalogCosts()]).then(([d, o, c]) => { setData(d); setOrders(o); setCat(c); }, (e) => setError(errorText(e)));
  }, [version]);
  if (!data) return <div className="space-y-4"><BooksTabs /><p className={error ? 'text-danger' : 'text-muted'}>{error || 'Đang tải…'}</p></div>;

  const today = vnToday(), cur = today.slice(0, 7), M = months(range, today);
  const L = ledger(M, data), A = accrual(M, orders, data.cash, cat);
  const tIn = L.reduce((s, r) => s + r.income, 0), tOut = L.reduce((s, r) => s + r.out, 0), tP = tIn - tOut;
  const last = L[L.length - 1];
  const aT = A.reduce((s, r) => ({ rev: s.rev + r.rev, p: s.p + r.profit, none: s.none + r.none }), { rev: 0, p: 0, none: 0 });
  const act = async (fn: () => Promise<unknown>) => { setError(''); try { await fn(); reload(); } catch (e) { setError(errorText(e)); } };

  return (
    <div className="space-y-4">
      <BooksTabs />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Cộng sổ</h1>
        <div className="flex overflow-hidden rounded-xl border border-line text-sm">
          {([['last12', '12 tháng gần đây'], ['year', 'Năm nay'], ['prev', 'Năm trước']] as const).map(([k, l]) => (
            <button key={k} className={`px-3 py-1.5 ${range === k ? 'bg-brand text-white' : 'bg-surface'}`} onClick={() => setRange(k)}>{l}</button>
          ))}
        </div>
      </div>
      {error && <p className="text-danger">{error}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card col-span-2 md:col-span-1">
          <div className="text-sm text-muted">Tồn quỹ cuối {ymLabel(last.m).toLowerCase()}</div>
          <div className={`text-lg font-bold ${(last.close ?? 0) < 0 ? 'text-danger' : ''}`} data-close>{sgn(last.close ?? 0)}</div>
          <div className="text-xs text-muted">{data.start ? `Từ số dư ${formatVnd(data.start.amount)} ngày ${fmtDate(data.start.date)}` : 'Chưa đặt số dư quỹ ban đầu'} · <button className="text-brand underline" onClick={() => setStartOpen(true)}>{data.start ? 'Sửa' : 'Đặt số dư'}</button></div>
        </div>
        <div className="card"><div className="text-sm text-muted">Lãi (thu − chi)</div><div className={`text-lg font-bold ${tP < 0 ? 'text-danger' : 'text-ok'}`} data-profit>{sgn(tP)}</div><div className="text-xs text-muted">{tIn ? `Tỷ suất ${pct((tP / tIn) * 100)}` : 'Chưa có thu'}</div></div>
        <div className="card"><div className="text-sm text-muted">Tổng thu</div><div className="text-lg font-bold text-ok">{formatVnd(tIn)}</div><div className="text-xs text-muted">không tính góp vốn, vay</div></div>
        <div className="card"><div className="text-sm text-muted">Tổng chi</div><div className="text-lg font-bold text-danger">{formatVnd(tOut)}</div></div>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="mb-2 font-semibold">Sổ quỹ từng tháng</h2>
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="border-b border-line text-left text-muted"><th className="py-2">Tháng</th><th className="text-right">Tồn đầu</th><th className="text-right">Thu khách</th><th className="text-right">Bán lẻ</th><th className="text-right">Thu khác</th><th className="text-right">Chi</th><th className="text-right">Lãi</th><th className="text-right">Tồn cuối</th><th /></tr></thead>
          <tbody>
            {[...L].filter((r) => !r.before).reverse().map((r) => (
              <tr key={r.m} className="border-b border-line/60" data-month={r.m}>
                <td className="py-2"><Link className="text-brand underline" href={`/so-thu-chi?thang=${r.m}`}>{ymShort(r.m)}</Link><div className="text-xs text-muted">{r.n} khoản</div></td>
                <td className="text-right">{sgn(r.open)}</td><td className="text-right">{formatVnd(r.inCust)}</td><td className="text-right">{formatVnd(r.inRetail)}</td>
                <td className="text-right">{formatVnd(r.inOther)}{r.capital ? <div className="text-xs text-muted">+ vốn {formatVnd(r.capital)}</div> : null}</td>
                <td className="text-right">{formatVnd(r.out)}</td><td className={`text-right font-semibold ${r.profit < 0 ? 'text-danger' : ''}`}>{sgn(r.profit)}</td><td className="text-right">{sgn(r.close)}</td>
                <td className="pl-2 text-right">{r.book ? (r.changed ? <button className="chip bg-red-50 text-danger" title="Số liệu khác lúc chốt – bấm để chốt lại" onClick={() => act(() => closeBook(r.m, r.in, r.out))}>Đổi sau chốt</button>
                  : <button className="chip bg-green-50 text-ok" title="Bấm để mở lại sổ" onClick={() => { if (confirm(`Mở lại sổ ${ymLabel(r.m)}?`)) act(() => reopenBook(r.m)); }}>Đã chốt</button>)
                  : r.m >= cur ? <span className="chip bg-brand-soft text-muted">Đang mở</span>
                  : <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { if (confirm(`Chốt sổ ${ymLabel(r.m)}: thu ${formatVnd(r.in)}, chi ${formatVnd(r.out)}?`)) act(() => closeBook(r.m, r.in, r.out)); }}>Chốt sổ</button>}</td>
              </tr>
            ))}
            {L.every((r) => r.before) && <tr><td colSpan={9} className="py-3 text-muted">Chưa có khoản thu chi nào trong khoảng này.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-1 font-semibold">Lãi theo đơn chốt</h2>
        {aT.none > 0 && <p className="mb-2 rounded-xl bg-amber-50 p-2 text-sm text-amber-800">{aT.none} đơn chốt chưa có chi phí (chưa ghi khoản chi cho đơn, chưa xuất vật tư, chưa nhập giá nhập) nên lãi các tháng đó đang cao hơn thực tế.</p>}
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="border-b border-line text-left text-muted"><th className="py-2">Tháng</th><th className="text-right">Giá trị đơn chốt</th><th className="text-right">Chi phí đơn</th><th className="text-right">Chi chung</th><th className="text-right">Thu khác</th><th className="text-right">Lãi</th><th className="text-right">Tỷ suất</th></tr></thead>
          <tbody>
            {[...A].reverse().filter((r) => r.rev || r.gen || r.oin || r.ocost).map((r) => (
              <tr key={r.m} className="border-b border-line/60 align-top" data-acc={r.m}>
                <td className="py-2">{ymShort(r.m)}<div className="text-xs text-muted">{r.orders.filter((x) => !x.adj).map((x) => <Link key={x.id} className="mr-1 underline" href={`/don-noi-that/${x.id}`}>{x.code}</Link>)}</div></td>
                <td className="text-right">{formatVnd(r.rev)}</td><td className="text-right">{r.est ? '≈ ' : ''}{formatVnd(r.ocost)}{r.none ? <div className="text-xs text-amber-800">{r.none} đơn chưa có chi phí</div> : null}</td>
                <td className="text-right">{formatVnd(r.gen)}</td><td className="text-right">{formatVnd(r.oin)}</td>
                <td className={`text-right font-semibold ${r.profit < 0 ? 'text-danger' : ''}`}>{sgn(r.profit)}</td><td className="text-right">{pct(r.pct)}</td>
              </tr>
            ))}
            <tr className="font-semibold"><td className="py-2">Cộng</td><td className="text-right">{formatVnd(aT.rev)}</td><td colSpan={3} /><td className="text-right">{sgn(aT.p)}</td><td className="text-right">{aT.rev ? pct((aT.p / aT.rev) * 100) : '–'}</td></tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">Giá trị đơn tính vào tháng chốt (bản sửa, phát sinh tính vào tháng xảy ra). Chi phí đơn = khoản chi gắn đơn + vật tư xuất kho cho đơn theo giá vốn; chưa có thì ước tính từ giá nhập (đánh dấu ≈). Chi chung = khoản chi không gắn đơn.</p>
      </section>
      {startOpen && <StartForm start={data.start} onClose={() => setStartOpen(false)} onSave={(d, a) => act(async () => { await saveSettings({ cash_start_date: d, cash_start_amount: a }); setStartOpen(false); })} />}
    </div>
  );
}

function StartForm({ start, onClose, onSave }: { start: LedgerData['start']; onClose: () => void; onSave: (d: string | null, a: number) => void }) {
  const [date, setDate] = useState(start?.date ?? `${vnToday().slice(0, 7)}-01`);
  const [amount, setAmount] = useState(start?.amount ?? 0);
  return (
    <Modal title="Số dư quỹ ban đầu" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSave(date, amount); }}>
        <p className="text-sm text-muted">Tiền mặt + tiền trong tài khoản của cửa hàng tại ngày bắt đầu ghi sổ. Các khoản trước ngày này không tính vào sổ quỹ.</p>
        <div><label className="label" htmlFor="cs-date">Ngày bắt đầu</label><input id="cs-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label className="label" htmlFor="cs-amt">Số dư</label><MoneyInput id="cs-amt" value={amount} onChange={setAmount} /></div>
        <button className="btn-primary w-full">Lưu</button>
        {start && <button type="button" className="btn-ghost w-full" onClick={() => onSave(null, 0)}>Bỏ số dư ban đầu</button>}
      </form>
    </Modal>
  );
}
