'use client';
/* Các khối trên trang đơn đã chốt: phát sinh, nghiệm thu, ghi chú, ảnh. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { errorText } from '@/lib/supabase/client';
import {
  addChange, confirmChange, cancelChange, setHandover, addNote, deleteNote, uploadPhoto, deletePhoto, photoUrls, STAGES, type OrderFull,
} from '@/lib/ordersApi';
import { makeSignRecord } from '@/lib/sign';
import { fmtDate, vnToday, addMonths, type Change, type SignRecord } from '@/lib/orderMoney';
import { formatVnd } from '@/lib/money';
import type { Settings } from '@/lib/settings';
import { Modal } from '@/components/Modal';
import { MoneyInput } from '@/components/MoneyInput';
import { SignPad } from './SignPad';

export const REASONS: Record<string, string> = { customer: 'Khách đổi ý', site: 'Hiện trạng khác', added: 'Thêm hạng mục', other: 'Khác' };
type Common = { full: OrderFull; names: Record<string, string>; isOwner: boolean; myId: string; act: (fn: () => Promise<unknown>) => Promise<void> };

/** Ô ký + tên người ký, dùng trong các hộp thoại. */
export function SignBlock({ defaultName, onChange }: { defaultName: string; onChange: (v: { img: string | null; name: string }) => void }) {
  const [name, setName] = useState(defaultName);
  const [img, setImg] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <div className="label">Khách ký xác nhận (không bắt buộc)</div>
      <SignPad onChange={(v) => { setImg(v); onChange({ img: v, name }); }} />
      <input className="input" aria-label="Tên người ký" placeholder="Tên người ký" value={name} onChange={(e) => { setName(e.target.value); onChange({ img, name: e.target.value }); }} />
    </div>
  );
}
export const signOf = async (s: { img: string | null; name: string }, content: unknown): Promise<SignRecord | null> =>
  s.img ? makeSignRecord(s.img, s.name.trim(), content) : null;

/* ---------- phát sinh ---------- */
export function ChangesSection({ full, names, isOwner, act }: Common) {
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState<Change | null>(null);
  const id = full.head.id;
  const st = { pending: 'Chờ xác nhận – chưa tính vào tổng', confirmed: 'Đã xác nhận', cancelled: 'Đã hủy' } as const;
  return (
    <section className="card space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Phát sinh</h2>
        <button className="btn-ghost py-1 text-sm" onClick={() => setAdding(true)}>+ Thêm phát sinh</button>
      </div>
      {!full.order.changes.length && <p className="text-sm text-muted">Chưa có phát sinh.</p>}
      <ul className="divide-y divide-line text-sm">
        {full.order.changes.map((c) => (
          <li key={c.id} className={`py-2 ${c.status === 'cancelled' ? 'opacity-50' : ''}`} data-change={c.status}>
            <div className="flex justify-between gap-2">
              <span className="font-medium">{c.title}</span>
              <b className={c.sign < 0 ? 'text-ok' : ''}>{c.sign < 0 ? '−' : '+'}{formatVnd(c.amount)}</b>
            </div>
            <div className="text-xs text-muted">
              {REASONS[c.reason] ?? c.reason} · {c.status === 'confirmed' ? `${st.confirmed} ${fmtDate(c.confirmedAt)}` : st[c.status]}
              {c.signRec ? ` · khách ${c.signRec.name} đã ký (mã ${c.signRec.hash})` : ''}{full.changeMeta[c.id]?.created_by ? ` · ${names[full.changeMeta[c.id].created_by!] ?? ''}` : ''}
              {c.note ? ` · ${c.note}` : ''}
            </div>
            {(c.status === 'pending' || (c.status === 'confirmed' && isOwner)) && (
              <div className="mt-1 flex gap-2">
                {c.status === 'pending' && <button className="btn-primary px-3 py-1 text-sm" onClick={() => setConfirming(c)}>Xác nhận</button>}
                <button className="btn-ghost px-3 py-1 text-sm" onClick={() => { if (confirm(`Hủy phát sinh "${c.title}"?`)) act(() => cancelChange(c.id)); }}>Hủy</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {adding && <ChangeForm onClose={() => setAdding(false)} onSave={(a) => act(async () => { await addChange(id, a); setAdding(false); })} />}
      {confirming && <ConfirmChange change={confirming} customer={full.head.customer_name} onClose={() => setConfirming(null)}
        onSave={(date, sign) => act(async () => { await confirmChange(confirming.id, date, sign); setConfirming(null); })} code={full.head.code} />}
    </section>
  );
}

function ChangeForm({ onClose, onSave }: { onClose: () => void; onSave: (a: { sign: 1 | -1; title: string; amount: number; reason: string; note: string }) => void }) {
  const [sign, setSign] = useState<1 | -1>(1);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('added');
  const [note, setNote] = useState('');
  return (
    <Modal title="Thêm phát sinh" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (title.trim() && amount > 0) onSave({ sign, title, amount, reason, note }); }}>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={sign === 1 ? 'btn-primary' : 'btn-ghost'} onClick={() => setSign(1)}>Tăng tiền</button>
          <button type="button" className={sign === -1 ? 'btn-primary' : 'btn-ghost'} onClick={() => setSign(-1)}>Giảm tiền</button>
        </div>
        <div><label className="label" htmlFor="ch-title">Nội dung</label><input id="ch-title" className="input" required placeholder="VD: Thêm kệ sách treo tường" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><label className="label" htmlFor="ch-amt">Số tiền</label><MoneyInput id="ch-amt" value={amount} onChange={setAmount} /></div>
        <div><label className="label" htmlFor="ch-reason">Lý do</label>
          <select id="ch-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)}>{Object.entries(REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className="label" htmlFor="ch-note">Ghi chú (VD: khách đã đồng ý qua Zalo lúc…)</label><input id="ch-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <p className="text-xs text-muted">Phát sinh chỉ tính vào tổng sau khi bấm Xác nhận.</p>
        <button className="btn-primary w-full" disabled={!title.trim() || !(amount > 0)}>Lưu phát sinh</button>
      </form>
    </Modal>
  );
}

function ConfirmChange({ change, customer, code, onClose, onSave }: { change: Change; customer: string; code: string; onClose: () => void; onSave: (date: string, sign: SignRecord | null) => void }) {
  const [date, setDate] = useState(vnToday());
  const [s, setS] = useState({ img: null as string | null, name: customer });
  return (
    <Modal title="Xác nhận phát sinh" onClose={onClose}>
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); onSave(date, await signOf(s, { code, change: change.id, title: change.title, amount: change.sign * change.amount, date })); }}>
        <p className="text-sm">{change.title}: <b>{change.sign < 0 ? '−' : '+'}{formatVnd(change.amount)}</b></p>
        <div><label className="label" htmlFor="cc-date">Ngày xác nhận</label><input id="cc-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <SignBlock defaultName={customer} onChange={setS} />
        <button className="btn-primary w-full">Xác nhận phát sinh</button>
      </form>
    </Modal>
  );
}

/* ---------- nghiệm thu ---------- */
export function HandoverSection({ full, settings, act }: Common & { settings: Settings }) {
  const [open, setOpen] = useState(false);
  const h = full.order.handover, id = full.head.id;
  return (
    <section className="card space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Nghiệm thu, bàn giao</h2>
        <div className="flex gap-2">
          {h && <Link className="btn-ghost py-1 text-sm" href={`/in/nghiem-thu/${id}`}>In biên bản</Link>}
          <button className="btn-ghost py-1 text-sm" onClick={() => setOpen(true)}>{h ? 'Sửa' : 'Nghiệm thu'}</button>
        </div>
      </div>
      {h ? (
        <div className="text-sm" data-handover>
          <div>Bàn giao ngày <b>{fmtDate(h.date)}</b>{h.warrantyMonths ? <> · bảo hành {h.warrantyMonths} tháng đến <b>{fmtDate(h.warrantyUntil)}</b></> : ''}</div>
          {h.sign && <div className="text-muted">Khách {h.sign.name} đã ký (mã {h.sign.hash})</div>}
          {h.note && <div className="text-muted">{h.note}</div>}
        </div>
      ) : <p className="text-sm text-muted">Chưa nghiệm thu. Nghiệm thu xong, đợt thanh toán cuối sẽ đến hạn.</p>}
      {open && <HandoverForm settings={settings} full={full} onClose={() => setOpen(false)} onSave={(a) => act(async () => { await setHandover(id, a); setOpen(false); })} />}
    </section>
  );
}

function HandoverForm({ settings, full, onClose, onSave }: { settings: Settings; full: OrderFull; onClose: () => void; onSave: (a: { date: string; months: number; note: string; sign: SignRecord | null }) => void }) {
  const h = full.order.handover;
  const [date, setDate] = useState(h?.date ?? vnToday());
  const [months, setMonths] = useState(h?.warrantyMonths ?? settings.warranty_months);
  const [note, setNote] = useState(h?.note ?? '');
  const [s, setS] = useState({ img: null as string | null, name: full.head.customer_name });
  return (
    <Modal title="Nghiệm thu, bàn giao" onClose={onClose}>
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); onSave({ date, months, note, sign: (await signOf(s, { code: full.head.code, handover: date })) ?? h?.sign ?? null }); }}>
        <div><label className="label" htmlFor="hv-date">Ngày bàn giao</label><input id="hv-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label className="label" htmlFor="hv-m">Bảo hành (tháng)</label><input id="hv-m" type="number" min={0} className="input" value={months} onChange={(e) => setMonths(Math.max(0, Number(e.target.value)))} />
          {months > 0 && <p className="mt-1 text-xs text-muted">Hết bảo hành ngày {fmtDate(addMonths(date, months))}</p>}</div>
        <div><label className="label" htmlFor="hv-note">Ghi chú (tồn tại cần sửa, phụ kiện bàn giao…)</label><textarea id="hv-note" className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <SignBlock defaultName={full.head.customer_name} onChange={setS} />
        <button className="btn-primary w-full">Lưu nghiệm thu</button>
      </form>
    </Modal>
  );
}

/* ---------- ghi chú ---------- */
export function NotesSection({ full, names, isOwner, myId, act }: Common) {
  const [text, setText] = useState('');
  const id = full.head.id;
  return (
    <section className="card space-y-2">
      <h2 className="font-semibold">Ghi chú</h2>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) act(async () => { await addNote(id, text); setText(''); }); }}>
        <input className="input flex-1" aria-label="Ghi chú mới" placeholder="Thêm ghi chú…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn-primary" disabled={!text.trim()}>Lưu</button>
      </form>
      <ul className="divide-y divide-line text-sm">
        {full.notes.map((n) => (
          <li key={n.id} className="flex justify-between gap-2 py-1.5">
            <span><span className="whitespace-pre-line">{n.text}</span> <span className="text-xs text-muted">· {new Date(n.created_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}{n.created_by ? ` · ${names[n.created_by] ?? ''}` : ''}</span></span>
            {(isOwner || n.created_by === myId) && <button className="text-xs text-danger underline" onClick={() => act(() => deleteNote(n.id))}>Xóa</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- ảnh ---------- */
export function PhotosSection({ full, isOwner, myId, act }: Common) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [stage, setStage] = useState('install');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [view, setView] = useState<string | null>(null);
  const id = full.head.id;
  const paths = full.attachments.map((a) => a.path).join('|');
  useEffect(() => { photoUrls(paths ? paths.split('|') : []).then(setUrls, () => setUrls({})); }, [paths]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    let done = 0;
    for (const f of Array.from(files)) {
      setBusy(`Đang tải ảnh ${done + 1}/${files.length}…`);
      try { await uploadPhoto(id, f, stage); done++; } catch (e) { setError(`${f.name}: ${errorText(e)}`); }
    }
    setBusy('');
    await act(async () => {});
  }
  return (
    <section className="card space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Ảnh công trình</h2>
        <div className="flex items-center gap-2">
          <select className="input w-auto py-1.5 text-sm" aria-label="Giai đoạn ảnh" value={stage} onChange={(e) => setStage(e.target.value)}>
            {Object.entries(STAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label className="btn-ghost cursor-pointer py-1.5 text-sm">+ Thêm ảnh<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} /></label>
        </div>
      </div>
      {busy && <p className="text-sm text-muted">{busy}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {!full.attachments.length && !busy && <p className="text-sm text-muted">Chưa có ảnh. Ảnh được lưu kèm ngày giờ và giai đoạn.</p>}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {full.attachments.map((a) => (
          <figure key={a.id} className="space-y-1" data-photo>
            <button type="button" className="block aspect-square w-full overflow-hidden rounded-lg bg-brand-soft" onClick={() => setView(a.path)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {urls[a.path] && <img src={urls[a.path]} alt={a.name} className="h-full w-full object-cover" />}
            </button>
            <figcaption className="text-[11px] leading-tight text-muted">{STAGES[a.stage] ?? a.stage} · {new Date(a.created_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
              {(isOwner || a.created_by === myId) && <> · <button className="text-danger underline" onClick={() => { if (confirm('Xóa ảnh này?')) act(() => deletePhoto(a.id)); }}>Xóa</button></>}</figcaption>
          </figure>
        ))}
      </div>
      {view && urls[view] && (
        <Modal title="Ảnh" onClose={() => setView(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urls[view]} alt="" className="w-full rounded-lg" />
        </Modal>
      )}
    </section>
  );
}
