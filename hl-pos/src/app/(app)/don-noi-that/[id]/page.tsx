'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase, errorText } from '@/lib/supabase/client';
import { useProfile } from '@/lib/useProfile';
import { getOrder, closeOrder, addPayment, deletePayment, setStatus, setPlanRow, setFollowAt, deleteOrder, reviseOrder, discardRevision, type OrderFull } from '@/lib/ordersApi';
import { ChangesSection, HandoverSection, NotesSection, PhotosSection, SignBlock, signOf } from '@/components/orders/AfterClose';
import { loadSettings, type Settings } from '@/lib/settings';
import { loadProducts, type Product } from '@/lib/products';
import {
  STATUS, PLAN_STATE, PAY_METHOD, TRIGGERS, orderMoney, quoteTotals, planOver, planWarnText, dotLabel, payNote, receiptNo, fmtDate, fmtQty, vnToday, addDays,
  type OrderStatus, type MoneyRow, type SignRecord,
} from '@/lib/orderMoney';
import { formatVnd } from '@/lib/money';
import { Modal } from '@/components/Modal';
import { MoneyInput } from '@/components/MoneyInput';
import { VietQr } from '@/components/orders/VietQr';
import { AddMaterial } from '@/components/orders/AddMaterial';
import { ProfitSection } from '@/components/orders/ProfitSection';

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useProfile();
  const isOwner = me.role === 'owner';
  const [full, setFull] = useState<OrderFull | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<null | 'close' | 'pay' | 'material' | { due: MoneyRow }>(null);
  const [payPreset, setPayPreset] = useState<{ amount: number; note: string } | null>(null);
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    Promise.all([getOrder(id), loadSettings(), loadProducts(false), supabase().from('profiles').select('id, full_name')])
      .then(([f, st, ps, pr]) => {
        setFull(f); setSettings(st); setProducts(ps);
        setNames(Object.fromEntries((pr.data ?? []).map((x) => [x.id, x.full_name])));
      }, (e) => setError(errorText(e)));
  }, [id, version]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await fn(); reload(); } catch (e) { setError(errorText(e)); }
    setBusy(false);
  }

  if (!full || !settings) return <p className={error ? 'text-danger' : 'text-muted'}>{error || 'Đang tải đơn…'}</p>;
  const { head, order } = full;
  const m = orderMoney(order);
  const closed = head.status !== 'quote';
  const draftTotal = order.draft ? quoteTotals(order.draft).total : 0;
  const startPay = (amount: number, note: string) => { setPayPreset({ amount, note }); setModal('pay'); };

  return (
    <div className="space-y-4">
      <Link href="/don-noi-that" className="text-sm text-muted">← Danh sách đơn</Link>

      <section className="card space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">{head.customer_name}</h1>
            <div className="text-sm text-muted">{head.code}{head.project ? ` · ${head.project}` : ''}</div>
          </div>
          <span className={`chip ${STATUS[head.status].cls}`}>{STATUS[head.status].label}</span>
        </div>
        {head.customer_phone && <div>📞 <a className="text-brand" href={`tel:${head.customer_phone.replace(/[^\d+]/g, '')}`}>{head.customer_phone}</a></div>}
        {order.draft?.customer.address || order.versions.at(-1)?.quote.customer.address ? <div>📍 {(order.draft ?? order.versions.at(-1)!.quote).customer.address}</div> : null}
      </section>

      {/* ---------- báo giá ---------- */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Báo giá</h2>
          <div className="flex flex-wrap gap-2">
            {order.draft && <Link className="btn-ghost py-1.5 text-sm" href={`/don-noi-that/${id}/sua`}>{closed ? 'Tiếp tục sửa bản mới' : 'Sửa báo giá'}</Link>}
            {closed && !order.draft && <button className="btn-ghost py-1.5 text-sm" disabled={busy} onClick={() => act(async () => { await reviseOrder(id); router.push(`/don-noi-that/${id}/sua`); })}>Sửa báo giá (tạo bản {order.versions.length + 1})</button>}
            {order.draft && <Link className="btn-ghost py-1.5 text-sm" href={`/in/bao-gia/${id}?ban=nhap`}>Xem / In {closed ? 'bản đang sửa' : ''}</Link>}
            {closed && <Link className="btn-ghost py-1.5 text-sm" href={`/in/bao-gia/${id}`}>Xem / In bản chốt</Link>}
          </div>
        </div>
        {!closed && order.draft && (
          <>
            <div className="flex justify-between"><span>Tổng báo giá</span><b data-quote-total>{formatVnd(draftTotal)}</b></div>
            {head.follow_at && <div className="text-sm text-muted">Hẹn gọi lại: {fmtDate(head.follow_at)}</div>}
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => setModal('close')} disabled={busy}>Chốt đơn</button>
              <button className="btn-ghost text-sm" disabled={busy} onClick={() => act(() => setFollowAt(id, addDays(vnToday(), settings.follow_days || 3)))}>Đã gọi, hẹn lại sau {settings.follow_days || 3} ngày</button>
              {isOwner && <button className="btn-danger text-sm" disabled={busy} onClick={() => { if (confirm(`Xóa báo giá ${head.code}?`)) act(async () => { await deleteOrder(id); router.replace('/don-noi-that'); }); }}>Xóa báo giá</button>}
            </div>
          </>
        )}
        {closed && order.draft && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
            <div>Đang soạn <b>bản {order.versions.length + 1}</b>: {formatVnd(draftTotal)} (bản hiện hành {formatVnd(order.versions.at(-1)?.total ?? 0)}). Chưa chốt thì tiền của đơn chưa đổi.</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-primary py-1.5 text-sm" disabled={busy} onClick={() => setModal('close')}>Chốt bản {order.versions.length + 1}</button>
              <button className="btn-ghost py-1.5 text-sm" disabled={busy} onClick={() => { if (confirm('Bỏ bản sửa đang soạn?')) act(() => discardRevision(id)); }}>Bỏ bản sửa</button>
            </div>
          </div>
        )}
        {closed && (
          <ul className="divide-y divide-line text-sm">
            {[...order.versions].reverse().map((v) => (
              <li key={v.no} className="flex items-center justify-between py-1.5">
                <span>Bản {v.no} · chốt {fmtDate(v.closedAt)}{v.no === order.versions.length ? ' (hiện hành)' : ''}</span>
                <span className="flex items-center gap-3"><b>{formatVnd(v.total)}</b><Link className="text-brand underline" href={`/in/bao-gia/${id}?ban=${v.no}`}>In</Link></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- tiền ---------- */}
      {closed && (
        <section className="card space-y-3" data-money>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><div className="text-xs text-muted">Giá trị đơn</div><div className="font-bold">{formatVnd(m.total)}</div></div>
            <div><div className="text-xs text-muted">Đã thu</div><div className="font-bold text-ok">{formatVnd(m.paid)}</div></div>
            <div><div className="text-xs text-muted">{m.over > 0 ? 'Trả thừa' : 'Còn nợ'}</div><div className={`font-bold ${m.due > 0 ? 'text-danger' : 'text-ok'}`} data-due>{formatVnd(m.over > 0 ? m.over : m.due)}</div></div>
          </div>
          <ul className="space-y-2">
            {m.rows.map((r) => (
              <li key={r.id} className="rounded-xl border border-line p-3" data-plan-row={r.n}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{dotLabel(r)}{r.label && !r.one ? `: ${r.label}` : ''}</div>
                    <div className="text-xs text-muted">{TRIGGERS[r.trigger]}{r.due ? ` · hạn ${fmtDate(r.due)}` : ''}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatVnd(r.amount)}</div>
                    <span className={`chip ${PLAN_STATE[r.state].cls}`} data-state={r.state}>{PLAN_STATE[r.state].label}</span>
                  </div>
                </div>
                {r.paid > 0 && r.left > 0 && <div className="mt-1 text-sm text-muted">Đã thu {formatVnd(r.paid)}, còn {formatVnd(r.left)}</div>}
                {r.left > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button className="btn-primary py-1.5 text-sm" onClick={() => startPay(r.left, payNote(r))}>Thu {formatVnd(r.left)}</button>
                    <button className="btn-ghost py-1.5 text-sm" onClick={() => setModal({ due: r })}>Hẹn ngày / mốc</button>
                  </div>
                )}
                {r.left > 0 && (r.state === 'due' || r.state === 'overdue') && <div className="mt-2"><VietQr settings={settings} code={head.code} n={r.one ? 0 : r.n} amount={r.left} size={140} /></div>}
              </li>
            ))}
          </ul>
          {!settings.bank_bin && <p className="text-xs text-muted">Nhập tài khoản ngân hàng ở Cài đặt để hiện mã VietQR cho khách quét.</p>}
          <button className="btn-ghost w-full" onClick={() => startPay(m.next?.left ?? 0, '')}>+ Ghi thu tiền khác</button>

          {order.payments.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold">Phiếu thu</h3>
              <ul className="divide-y divide-line text-sm">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2" data-receipt={p.no}>
                    <div>
                      <div className="font-medium">{receiptNo(head.code, p.no)} · {formatVnd(p.amount)}</div>
                      <div className="text-xs text-muted">{fmtDate(p.date)} · {PAY_METHOD[p.method]}{p.note ? ` · ${p.note}` : ''}{full.payMeta[p.id]?.created_by ? ` · ${names[full.payMeta[p.id].created_by!] ?? ''}` : ''}</div>
                    </div>
                    <div className="flex gap-2">
                      <Link className="btn-ghost px-3 py-1 text-sm" href={`/in/phieu-thu/${id}?so=${p.no}`}>In phiếu</Link>
                      {isOwner && <button className="btn-danger px-3 py-1 text-sm" disabled={busy} onClick={() => { if (confirm(`Xóa phiếu thu ${receiptNo(head.code, p.no)} (${formatVnd(p.amount)})?`)) act(() => deletePayment(p.id)); }}>Xóa</button>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ---------- tiến độ ---------- */}
      {closed && (
        <section className="card space-y-2">
          <h2 className="font-semibold">Tiến độ</h2>
          <div className="grid grid-cols-3 gap-2">
            {(['closed', 'building', 'done'] as OrderStatus[]).map((s) => (
              <button key={s} disabled={busy} onClick={() => act(() => setStatus(id, s))}
                className={`btn py-2 text-sm ${head.status === s ? 'bg-brand text-white' : 'border border-line bg-surface text-muted'}`}>{STATUS[s].label}</button>
            ))}
          </div>
        </section>
      )}

      {/* ---------- vật tư ---------- */}
      {closed && (
        <section className="card space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Vật tư đã dùng</h2>
            <button className="btn-ghost py-1 text-sm" onClick={() => setModal('material')}>+ Thêm vật tư</button>
          </div>
          {!full.materials.length ? <p className="text-sm text-muted">Chưa ghi vật tư.</p> : (
            <ul className="divide-y divide-line text-sm">
              {full.materials.map((x) => { const p = productById.get(x.product_id); return (
                <li key={x.id} className="flex justify-between py-1.5"><span>{p?.name ?? '—'} <span className="text-muted">· {fmtDate(x.created_at.slice(0, 10))}</span></span><span>{fmtQty(x.quantity)} {p?.unit}</span></li>
              ); })}
            </ul>
          )}
        </section>
      )}

      {isOwner && closed && <ProfitSection full={full} />}
      {closed && <ChangesSection full={full} names={names} isOwner={isOwner} myId={me.id} act={act} />}
      {closed && <HandoverSection full={full} names={names} isOwner={isOwner} myId={me.id} act={act} settings={settings} />}
      <NotesSection full={full} names={names} isOwner={isOwner} myId={me.id} act={act} />
      <PhotosSection full={full} names={names} isOwner={isOwner} myId={me.id} act={act} />

      {/* ---------- nhật ký ---------- */}
      <section className="card">
        <h2 className="mb-1 font-semibold">Nhật ký</h2>
        <ul className="space-y-1 text-sm">
          {full.log.map((l) => (
            <li key={l.id}><span className="text-muted">{new Date(l.at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}{l.by && names[l.by] ? ` · ${names[l.by]}` : ''}:</span> {l.text}</li>
          ))}
        </ul>
      </section>

      {error && <p className="text-danger">{error}</p>}

      {modal === 'close' && order.draft && <CloseForm total={draftTotal} plan={order.draft.plan} revision={closed ? order.versions.length + 1 : 0} customer={order.draft.customer.name} code={head.code} onClose={() => setModal(null)}
        onSave={(a) => act(async () => { await closeOrder(id, a); setModal(null); })} />}
      {modal === 'pay' && <PayForm preset={payPreset} code={head.code} settings={settings} due={m.due} onClose={() => setModal(null)}
        onSave={(a) => act(async () => { const r = await addPayment(id, a); setModal(null); router.push(`/in/phieu-thu/${id}?so=${r.no}&moi=1`); })} />}
      {modal === 'material' && <AddMaterial orderId={id} products={products.filter((p) => p.active)} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />}
      {modal && typeof modal === 'object' && <DueForm row={modal.due} onClose={() => setModal(null)}
        onSave={(due, reached) => act(async () => { await setPlanRow(id, modal.due.id, due, reached); setModal(null); })} />}
    </div>
  );
}

function CloseForm({ total, plan, revision, customer, code, onClose, onSave }: { total: number; plan: OrderFull['order']['plan']; revision: number; customer: string; code: string; onClose: () => void; onSave: (a: { date: string; deposit: number; method: 'transfer' | 'cash'; sign: SignRecord | null }) => void }) {
  const firstPct = !revision && plan.length > 1 ? (plan[0].fixed ? plan[0].amt ?? 0 : Math.round((total * plan[0].pct) / 100)) : 0;
  const [date, setDate] = useState(vnToday());
  const [deposit, setDeposit] = useState(firstPct);
  const [method, setMethod] = useState<'transfer' | 'cash'>('transfer');
  const [s, setS] = useState({ img: null as string | null, name: customer });
  const [busy, setBusy] = useState(false);
  const over = planOver(plan, total);
  return (
    <Modal title={revision ? `Chốt bản ${revision}` : 'Chốt đơn'} onClose={onClose}>
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (busy) return; setBusy(true); onSave({ date, deposit: revision ? 0 : deposit, method, sign: await signOf(s, { code, no: revision || 1, total, date }) }); }}>
        <p className="text-sm">Sau khi chốt, báo giá <b>{formatVnd(total)}</b> được khóa lại{revision ? ' và thay bản trước. Tiền đã thu giữ nguyên.' : '. Muốn đổi thì tạo bản sửa.'}</p>
        {over && <p className="text-sm text-danger">{planWarnText(plan, total)} Sửa lịch thanh toán trước khi chốt.</p>}
        <div><label className="label" htmlFor="c-date">Ngày chốt</label><input id="c-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        {!revision && <div><label className="label" htmlFor="c-dep">Tiền cọc nhận ngay (để 0 nếu chưa nhận)</label><MoneyInput id="c-dep" value={deposit} onChange={setDeposit} /></div>}
        {!revision && deposit > 0 && <MethodPick method={method} onChange={setMethod} />}
        <SignBlock defaultName={customer} onChange={setS} />
        <button className="btn-primary w-full" disabled={over || busy}>{revision ? `Chốt bản ${revision}` : 'Chốt đơn'}</button>
      </form>
    </Modal>
  );
}

function MethodPick({ method, onChange }: { method: 'transfer' | 'cash'; onChange: (m: 'transfer' | 'cash') => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(['transfer', 'cash'] as const).map((k) => <button type="button" key={k} className={method === k ? 'btn-primary' : 'btn-ghost'} onClick={() => onChange(k)}>{PAY_METHOD[k]}</button>)}
    </div>
  );
}

function PayForm({ preset, code, settings, due, onClose, onSave }: { preset: { amount: number; note: string } | null; code: string; settings: Settings; due: number; onClose: () => void; onSave: (a: { amount: number; date: string; method: 'transfer' | 'cash'; note: string }) => void }) {
  const [amount, setAmount] = useState(preset?.amount ?? 0);
  const [date, setDate] = useState(vnToday());
  const [method, setMethod] = useState<'transfer' | 'cash'>('transfer');
  const [note, setNote] = useState(preset?.note ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Thu tiền" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (amount > 0 && !busy) { setBusy(true); onSave({ amount, date, method, note }); } }}>
        <div><label className="label" htmlFor="p-amt">Số tiền</label><MoneyInput id="p-amt" value={amount} onChange={setAmount} /></div>
        {amount > due && <p className="text-sm text-amber-800">Số này lớn hơn còn nợ ({formatVnd(due)}). Phần dư sẽ hiện là &quot;trả thừa&quot;.</p>}
        <div><label className="label" htmlFor="p-date">Ngày thu</label><input id="p-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <MethodPick method={method} onChange={setMethod} />
        {method === 'transfer' && amount > 0 && <VietQr settings={settings} code={code} n={0} amount={amount} size={120} />}
        <div><label className="label" htmlFor="p-note">Ghi chú</label><input id="p-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <button className="btn-primary w-full" disabled={!(amount > 0) || busy}>Ghi phiếu thu</button>
      </form>
    </Modal>
  );
}

function DueForm({ row, onClose, onSave }: { row: MoneyRow; onClose: () => void; onSave: (due: string | null, reached: boolean) => void }) {
  const [due, setDue] = useState(row.due ?? '');
  const [reached, setReached] = useState(!!row.reached);
  return (
    <Modal title={`${dotLabel(row)}: hẹn ngày / mốc`} onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSave(due || null, reached); }}>
        <div><label className="label" htmlFor="d-due">Hạn trả (để trống nếu chưa hẹn)</label><input id="d-due" type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} /></div>
        {!row.one && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reached} onChange={(e) => setReached(e.target.checked)} /> Đã tới mốc &quot;{TRIGGERS[row.trigger]}&quot; (tính là đến hạn)</label>}
        <button className="btn-primary w-full">Lưu</button>
      </form>
    </Modal>
  );
}
