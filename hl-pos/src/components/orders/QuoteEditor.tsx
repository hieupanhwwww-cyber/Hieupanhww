'use client';
import { UNITS, newRow, rowAmount, quoteTotals, dimsQty, type Quote, type QuoteRow, type Unit, type Dims } from '@/lib/orderMoney';
import { formatVnd } from '@/lib/money';
import { matches } from '@/lib/products';
import { MoneyInput } from '@/components/MoneyInput';
import { QtyInput } from './QtyInput';
import { PlanEditor } from './PlanEditor';
import type { Settings } from '@/lib/settings';

export type CustomerLite = { name: string; phone: string; address: string };
export type CatalogLite = { name: string; material: string; unit: Unit; price: number };

/** Soạn báo giá: khách, các dòng hạng mục, giảm giá, lịch thanh toán, ghi chú. Không tự lưu – trang cha lo. */
export function QuoteEditor({ quote, onChange, settings, customers, catalog }: { quote: Quote; onChange: (q: Quote) => void; settings: Settings | null; customers: CustomerLite[]; catalog: CatalogLite[] }) {
  const t = quoteTotals(quote);
  const set = (patch: Partial<Quote>) => onChange({ ...quote, ...patch });
  const setCust = (patch: Partial<Quote['customer']>) => set({ customer: { ...quote.customer, ...patch } });
  const setRow = (id: string, patch: Partial<QuoteRow>) => set({ rows: quote.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const setDims = (r: QuoteRow, patch: Partial<Dims>) => { const d = { ...(r.dims ?? { a: 0, b: 0, n: 1, u: 'mm' as const }), ...patch }; setRow(r.id, { dims: d, qty: dimsQty(r.unit, d) }); };
  const c = quote.customer;
  const custHits = (c.name.trim().length >= 2 || c.phone.replace(/\D/g, '').length >= 3)
    ? customers.filter((x) => (c.phone && x.phone.replace(/\D/g, '').includes(c.phone.replace(/\D/g, ''))) || (c.name.trim().length >= 2 && matches({ code: '', name: x.name }, c.name)))
        .filter((x) => !(x.name === c.name && x.phone === c.phone)).slice(0, 4)
    : [];

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h2 className="font-semibold">Khách hàng</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="q-name">Tên khách</label><input id="q-name" className="input" value={c.name} onChange={(e) => setCust({ name: e.target.value })} /></div>
          <div><label className="label" htmlFor="q-phone">Điện thoại</label><input id="q-phone" className="input" inputMode="tel" value={c.phone} onChange={(e) => setCust({ phone: e.target.value })} /></div>
        </div>
        {custHits.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {custHits.map((x) => (
              <button type="button" key={x.phone + x.name} className="chip border border-line bg-surface px-3 py-1 text-sm" onClick={() => setCust({ name: x.name, phone: x.phone, address: x.address || c.address })}>
                Khách cũ: {x.name}{x.phone ? ` · ${x.phone}` : ''}
              </button>
            ))}
          </div>
        )}
        <div><label className="label" htmlFor="q-addr">Địa chỉ</label><input id="q-addr" className="input" value={c.address} onChange={(e) => setCust({ address: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2"><label className="label" htmlFor="q-project">Công trình</label><input id="q-project" className="input" placeholder="VD: Phòng ngủ master" value={quote.project} onChange={(e) => set({ project: e.target.value })} /></div>
          <div><label className="label" htmlFor="q-date">Ngày báo giá</label><input id="q-date" type="date" className="input" value={quote.date} onChange={(e) => set({ date: e.target.value })} /></div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Hạng mục</h2>
        {quote.rows.map((r, i) => {
          const hits = r.name.trim().length >= 2 ? catalog.filter((k) => matches({ code: k.material, name: k.name }, r.name) && k.name !== r.name).slice(0, 4) : [];
          const byDims = !!r.dims;
          return (
            <div key={r.id} className="card space-y-2 p-3" data-row={i + 1}>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">{i + 1}.</span>
                <input className="input flex-1 py-1.5 font-medium" aria-label={`Tên hạng mục ${i + 1}`} placeholder="Tên hạng mục (VD: Tủ áo cánh lùa)" value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} />
                <button type="button" className="btn-ghost px-2 py-1" aria-label={`Xóa dòng ${i + 1}`} onClick={() => set({ rows: quote.rows.filter((x) => x.id !== r.id) })}>✕</button>
              </div>
              {hits.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {hits.map((k) => <button type="button" key={k.name} className="chip border border-line bg-surface px-3 py-1 text-sm" onClick={() => setRow(r.id, { name: k.name, material: k.material, unit: k.unit, price: k.price, ...(r.dims ? { qty: dimsQty(k.unit, r.dims) } : {}) })}>{k.name} · {formatVnd(k.price)}/{k.unit}</button>)}
                </div>
              )}
              <input className="input py-1.5 text-sm" aria-label={`Vật liệu ${i + 1}`} placeholder="Vật liệu, màu (VD: MDF chống ẩm phủ melamine)" value={r.material} onChange={(e) => setRow(r.id, { material: e.target.value })} />
              {byDims && (
                <div className="flex flex-wrap items-center gap-1 text-sm">
                  <QtyInput className="w-20" label={`Dài ${i + 1}`} value={r.dims!.a} onChange={(v) => setDims(r, { a: v })} />
                  {r.unit !== 'md' && <><span>×</span><QtyInput className="w-20" label={`Rộng ${i + 1}`} value={r.dims!.b} onChange={(v) => setDims(r, { b: v })} /></>}
                  <select className="input w-auto px-2 py-1.5" aria-label={`Đơn vị kích thước ${i + 1}`} value={r.dims!.u} onChange={(e) => setDims(r, { u: e.target.value as Dims['u'] })}><option>mm</option><option>cm</option><option>m</option></select>
                  <span>× SL</span><QtyInput className="w-14" label={`Số cái ${i + 1}`} value={r.dims!.n} onChange={(v) => setDims(r, { n: v })} />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <QtyInput className="w-20" label={`Số lượng ${i + 1}`} value={r.qty} disabled={byDims} onChange={(v) => setRow(r.id, { qty: v })} />
                <select className="input w-auto px-2 py-1.5" aria-label={`Đơn vị ${i + 1}`} value={r.unit} onChange={(e) => { const unit = e.target.value as Unit; setRow(r.id, { unit, ...(r.dims ? { qty: dimsQty(unit, r.dims) } : {}) }); }}>
                  {UNITS.map((u) => <option key={u}>{u}</option>)}
                </select>
                <span className="text-muted">×</span>
                <MoneyInput className="w-36" value={r.price} onChange={(v) => setRow(r.id, { price: v })} />
                <span className="ml-auto font-semibold" data-amount>{formatVnd(rowAmount(r))}</span>
              </div>
              <button type="button" className="text-sm text-brand underline" onClick={() => (byDims ? setRow(r.id, { dims: null }) : setDims(r, {}))}>{byDims ? 'Nhập số lượng trực tiếp' : 'Tính số lượng từ kích thước'}</button>
            </div>
          );
        })}
        <button type="button" className="btn-ghost w-full" onClick={() => set({ rows: [...quote.rows, newRow()] })}>+ Thêm hạng mục</button>
      </section>

      <section className="card space-y-2">
        <div className="flex justify-between"><span>Tạm tính</span><span>{formatVnd(t.sub)}</span></div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Giảm giá</span>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-xl border border-line text-sm">
              {(['amount', 'percent'] as const).map((k) => (
                <button type="button" key={k} className={`px-3 py-1.5 ${quote.discount.type === k ? 'bg-brand text-white' : 'bg-surface'}`} onClick={() => set({ discount: { type: k, value: 0 } })}>{k === 'amount' ? 'đ' : '%'}</button>
              ))}
            </div>
            {quote.discount.type === 'amount'
              ? <MoneyInput className="w-36" value={quote.discount.value} onChange={(v) => set({ discount: { type: 'amount', value: v } })} />
              : <QtyInput className="w-20" label="Phần trăm giảm" value={quote.discount.value} onChange={(v) => set({ discount: { type: 'percent', value: Math.min(100, v) } })} />}
          </div>
        </div>
        {t.disc > 0 && <div className="flex justify-between text-sm text-muted"><span>Số tiền giảm</span><span>−{formatVnd(t.disc)}</span></div>}
        <div className="flex justify-between border-t border-line pt-2 text-lg font-bold"><span>Tổng cộng</span><span className="text-brand" data-total>{formatVnd(t.total)}</span></div>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Lịch thanh toán</h2>
        <PlanEditor plan={quote.plan} total={t.total} onChange={(plan) => set({ plan })} settings={settings} />
      </section>

      <section className="card space-y-3">
        <div><label className="label" htmlFor="q-note">Ghi chú</label><textarea id="q-note" className="input" rows={2} value={quote.note} onChange={(e) => set({ note: e.target.value })} /></div>
        <div><label className="label" htmlFor="q-terms">Điều khoản</label><textarea id="q-terms" className="input" rows={3} value={quote.terms} onChange={(e) => set({ terms: e.target.value })} /></div>
        <div><label className="label" htmlFor="q-valid">Báo giá có hiệu lực đến</label><input id="q-valid" type="date" className="input w-auto" value={quote.validUntil} onChange={(e) => set({ validUntil: e.target.value })} /></div>
      </section>
    </div>
  );
}
