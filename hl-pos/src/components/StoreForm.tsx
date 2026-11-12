'use client';
import { useEffect, useState } from 'react';
import { errorText } from '@/lib/supabase/client';
import { loadSettings, saveSettings, type Settings } from '@/lib/settings';
import { BANKS, bankReady } from '@/lib/vietqr';
import { DEFAULT_PLAN, newPlan, type PlanRow } from '@/lib/orderMoney';
import { PlanEditor } from '@/components/orders/PlanEditor';
import { VietQr } from '@/components/orders/VietQr';

/** Thu nhỏ ảnh logo về cạnh dài ≤ 256 px, trả về data URL PNG (lưu thẳng trong cài đặt). */
async function shrinkLogo(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const k = Math.min(1, 256 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

/** Thông tin cửa hàng in trên giấy tờ + cài đặt đơn nội thất. Nhân viên chỉ xem. */
export function StoreForm({ canEdit }: { canEdit: boolean }) {
  const [st, setSt] = useState<Settings | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadSettings().then(setSt, (e) => setMsg(errorText(e))); }, []);
  if (!st) return <section className="card text-muted">{msg || 'Đang tải…'}</section>;

  const set = (patch: Partial<Settings>) => setSt({ ...st, ...patch });
  const field = (key: keyof Settings, label: string, opt: { area?: boolean; type?: string; hint?: string } = {}) => (
    <div>
      <label className="label" htmlFor={`st-${key}`}>{label}</label>
      {opt.area
        ? <textarea id={`st-${key}`} className="input" rows={3} disabled={!canEdit} value={(st[key] as string) ?? ''} onChange={(e) => set({ [key]: e.target.value } as Partial<Settings>)} />
        : <input id={`st-${key}`} className="input" type={opt.type ?? 'text'} disabled={!canEdit} value={(st[key] as string | number) ?? ''}
            onChange={(e) => set({ [key]: opt.type === 'number' ? Number(e.target.value) : e.target.value } as Partial<Settings>)} />}
      {opt.hint && <p className="mt-1 text-xs text-muted">{opt.hint}</p>}
    </div>
  );
  const plan: PlanRow[] = st.plan_template?.length ? newPlan(st.plan_template) : newPlan(DEFAULT_PLAN);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { logo, ...rest } = st!;
      await saveSettings({ ...rest, logo: logo || null, bank_account: rest.bank_account.replace(/\s/g, ''), memo_prefix: rest.memo_prefix.trim() });
      setMsg('Đã lưu.');
    } catch (err) { setMsg(errorText(err)); }
    setBusy(false);
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <section className="card space-y-3">
        <h2 className="font-semibold">Thông tin in trên hóa đơn, báo giá, phiếu thu</h2>
        {field('name', 'Tên cửa hàng')}
        {field('tagline', 'Khẩu hiệu')}
        {field('address', 'Địa chỉ')}
        {field('phone', 'Điện thoại')}
        {field('email', 'Email')}
        {field('note', 'Lời nhắn cuối hóa đơn bán lẻ')}
        <div>
          <div className="label">Logo</div>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {st.logo ? <img src={st.logo} alt="Logo" className="h-16 w-16 rounded border border-line object-contain" /> : <span className="text-sm text-muted">Chưa có logo</span>}
            {canEdit && <label className="btn-ghost cursor-pointer py-1.5 text-sm">Chọn ảnh<input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) set({ logo: await shrinkLogo(f) }); }} /></label>}
            {canEdit && st.logo && <button type="button" className="text-sm text-danger underline" onClick={() => set({ logo: null })}>Bỏ logo</button>}
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Tài khoản nhận chuyển khoản (mã VietQR)</h2>
        <div>
          <label className="label" htmlFor="st-bank">Ngân hàng</label>
          <select id="st-bank" className="input" disabled={!canEdit} value={st.bank_bin}
            onChange={(e) => set({ bank_bin: e.target.value, bank_name: BANKS.find((b) => b[0] === e.target.value)?.[1] ?? '' })}>
            <option value="">— Chọn ngân hàng —</option>
            {BANKS.map(([bin, name]) => <option key={bin} value={bin}>{name}</option>)}
          </select>
        </div>
        {field('bank_account', 'Số tài khoản')}
        {field('bank_holder', 'Chủ tài khoản', { hint: 'Viết như trên thẻ, VD: NGUYEN VAN HIEU' })}
        {field('memo_prefix', 'Chữ đầu nội dung chuyển khoản', { hint: 'Nội dung sẽ là: <chữ này> <mã đơn> D<đợt>, VD: HL BG261101 D1' })}
        {bankReady(st) ? <div><div className="label">Xem thử mã (10.000 đ, đơn BG0000-01, đợt 1) – quét bằng app ngân hàng để kiểm tra tên chủ tài khoản:</div>
          <VietQr settings={st} code="BG0000-01" n={1} amount={10000} size={140} /></div>
          : <p className="text-sm text-muted">Chọn ngân hàng và nhập số tài khoản để hiện mã VietQR trên đơn, báo giá.</p>}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Đơn nội thất</h2>
        {field('code_prefix', 'Tiền tố mã đơn', { hint: 'Mã đơn: <tiền tố><năm><tháng>-<số>, VD: BG2611-01' })}
        {field('default_note', 'Ghi chú mặc định trên báo giá', { area: true })}
        {field('default_terms', 'Điều khoản mặc định trên báo giá', { area: true })}
        <div className="grid grid-cols-2 gap-3">
          {field('warranty_months', 'Bảo hành (tháng)', { type: 'number' })}
          {field('follow_days', 'Nhắc gọi lại báo giá sau (ngày)', { type: 'number' })}
        </div>
        <div>
          <div className="label">Lịch thanh toán mặc định cho báo giá mới (xem thử trên đơn 100 triệu)</div>
          {canEdit ? <PlanEditor plan={plan} total={100_000_000} settings={null} onChange={(p) => set({ plan_template: p.map(({ label, pct, trigger, fixed, amt }) => ({ label, pct, trigger, fixed, amt })) })} />
            : <ul className="text-sm">{plan.map((r, i) => <li key={r.id}>Đợt {i + 1}: {r.label}</li>)}</ul>}
        </div>
      </section>
      {canEdit && <button className="btn-primary w-full" disabled={busy}>Lưu cài đặt</button>}
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </form>
  );
}
