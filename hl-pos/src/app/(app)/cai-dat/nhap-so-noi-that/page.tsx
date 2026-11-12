'use client';
import { useState } from 'react';
import Link from 'next/link';
import { supabase, errorText } from '@/lib/supabase/client';
import { useProfile } from '@/lib/useProfile';
import { readBackup, toImportPayload, expectedTotals, type ImportPayload } from '@/lib/importSnt';
import { STATUS, fmtDate } from '@/lib/orderMoney';
import { formatVnd } from '@/lib/money';

type Result = { created: Record<string, number>; existed: Record<string, number>; renamed: { from: string; to: string }[]; mismatch: { code: string; version: number; file: number; app: number }[] };
type Check = { code: string; customer: string; exp: { total: number; paid: number; due: number }; app: { total: number; paid: number; due: number } | null };

export default function ImportPage() {
  const { role } = useProfile();
  const [payload, setPayload] = useState<ImportPayload | null>(null);
  const [fileAt, setFileAt] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (role !== 'owner') return <p className="text-muted">Chỉ chủ cửa hàng được nhập dữ liệu.</p>;

  async function pick(f: File | undefined) {
    setPayload(null); setResult(null); setChecks([]); setError('');
    if (!f) return;
    try {
      const b = readBackup(JSON.parse(await f.text()));
      if (!b) { setError('File này không phải file sao lưu của Sổ Nội Thất.'); return; }
      setFileAt(b.at); setPayload(toImportPayload(b.cols));
    } catch { setError('Không đọc được file. Hãy chọn đúng file .json lấy từ Sổ Nội Thất (Cài đặt → Sao lưu).'); }
  }

  async function run() {
    if (!payload) return;
    setBusy(true); setError('');
    let r: Result | null = null;
    try {
      const { data, error } = await supabase().rpc('import_snt', { p: payload });
      if (error) throw error;
      r = data as Result;
      const res = r;
      // đối chiếu từng đơn: số máy chủ so với số tính lại từ file
      const codeOf = new Map(res.renamed.map((x) => [x.from, x.to]));
      const codes = payload.orders.map((o) => codeOf.get(o.code) ?? o.code);
      const sb = supabase();
      const { data: os, error: e1 } = await sb.from('orders').select('id, code').in('code', codes);
      if (e1) throw e1;
      const { data: ts, error: e2 } = await sb.from('order_totals').select('order_id, total, paid, due').in('order_id', (os ?? []).map((x) => x.id));
      if (e2) throw e2;
      const byId = new Map((ts ?? []).map((t) => [t.order_id, { total: Number(t.total), paid: Number(t.paid), due: Number(t.due) }]));
      const app = new Map((os ?? []).map((x) => [x.code, byId.get(x.id) ?? null]));
      setChecks(payload.orders.map((o) => { const c = codeOf.get(o.code) ?? o.code; return { code: c, customer: (o.versions.at(-1)?.quote ?? o.draft)?.customer.name ?? '', exp: expectedTotals(o), app: app.get(c) ?? null }; }));
      setResult(res);
    } catch (e) { setError(errorText(e)); if (r) setResult(r); }
    setBusy(false);
  }

  const bad = checks.filter((c) => !c.app || c.app.total !== c.exp.total || c.app.paid !== c.exp.paid || c.app.due !== c.exp.due);
  const checkFailed = !!result && payload !== null && payload.orders.length > 0 && checks.length === 0;
  const n = payload ? { pays: payload.orders.reduce((s, o) => s + o.payments.length, 0), chg: payload.orders.reduce((s, o) => s + o.changes.length, 0) } : null;

  return (
    <div className="space-y-4">
      <Link href="/cai-dat" className="text-sm text-muted">← Cài đặt</Link>
      <h1 className="text-xl font-bold">Nhập dữ liệu từ Sổ Nội Thất</h1>
      <section className="card space-y-2 text-sm">
        <p><b>Bước 1.</b> Trong Sổ Nội Thất: Cài đặt → <b>Sao lưu</b> → được file <code>So-noi-that-sao-luu-….json</code>.</p>
        <p><b>Bước 2.</b> Chọn file đó ở đây, xem trước, rồi bấm Nhập. Nhập lại cùng file nhiều lần cũng không bị trùng.</p>
        <input type="file" accept=".json,application/json" aria-label="Chọn file sao lưu" onChange={(e) => pick(e.target.files?.[0])} />
      </section>
      {error && <p className="text-danger">{error}</p>}

      {payload && !result && (
        <section className="card space-y-2" data-preview>
          <h2 className="font-semibold">Xem trước{fileAt ? ` (sao lưu lúc ${new Date(fileAt).toLocaleString('vi-VN')})` : ''}</h2>
          <ul className="text-sm">
            <li>{payload.customers.length} khách hàng · {payload.catalog.length} mục danh mục</li>
            <li>{payload.orders.length} đơn ({payload.orders.filter((o) => o.status === 'quote').length} đang báo giá) · {n!.pays} phiếu thu · {n!.chg} phát sinh</li>
            <li>{payload.cash.length} khoản thu chi</li>
          </ul>
          {payload.skipped.length > 0 && (
            <div className="rounded-xl bg-amber-50 p-2 text-sm text-amber-900">
              <div className="font-medium">Không chuyển tự động ({payload.skipped.length}):</div>
              <ul className="list-disc pl-5">{payload.skipped.map((s, i) => <li key={i}>{s.why}</li>)}</ul>
            </div>
          )}
          <button className="btn-primary w-full" disabled={busy} onClick={run}>{busy ? 'Đang nhập…' : 'Nhập vào HL Bán Hàng'}</button>
        </section>
      )}

      {result && (
        <section className="card space-y-3" data-result>
          <h2 className="font-semibold">Đã nhập xong</h2>
          <p className="text-sm">Mới: {result.created.orders} đơn, {result.created.payments} phiếu thu, {result.created.changes} phát sinh, {result.created.customers} khách, {result.created.catalog} mục danh mục, {result.created.cash} khoản thu chi.
            {result.existed.orders ? ` Đã có từ trước (bỏ qua): ${result.existed.orders} đơn.` : ''}</p>
          {result.renamed.length > 0 && <p className="text-sm text-amber-800">Đổi mã vì trùng đơn đang có: {result.renamed.map((r) => `${r.from} → ${r.to}`).join(', ')}</p>}
          {result.mismatch.length > 0 && <p className="text-sm text-amber-800">Tổng bản chốt trong file khác số tính lại: {result.mismatch.map((m) => `${m.code} bản ${m.version}: file ${formatVnd(m.file)}, tính lại ${formatVnd(m.app)}`).join('; ')}</p>}
          <div className={`rounded-xl p-2 text-sm ${bad.length || checkFailed ? 'bg-red-50 text-danger' : 'bg-green-50 text-ok'}`} data-check={bad.length || checkFailed ? 'bad' : 'ok'}>
            {checkFailed ? 'Chưa đối chiếu được số tiền (lỗi đọc dữ liệu). Mở Danh sách đơn để kiểm tra, hoặc tải lại trang rồi nhập lại file (không bị trùng).'
              : bad.length ? `${bad.length} đơn có số khác nhau, xem dòng tô đỏ bên dưới.` : `Đối chiếu ${checks.length} đơn: giá trị, đã thu, còn nợ khớp hết với Sổ Nội Thất.`}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead><tr className="border-b border-line text-left text-muted"><th className="py-1">Đơn</th><th className="text-right">Giá trị</th><th className="text-right">Đã thu</th><th className="text-right">Còn nợ</th></tr></thead>
              <tbody>{checks.map((c) => { const ok = c.app && c.app.total === c.exp.total && c.app.paid === c.exp.paid && c.app.due === c.exp.due; return (
                <tr key={c.code} className={`border-b border-line/60 ${ok ? '' : 'bg-red-50 text-danger'}`}>
                  <td className="py-1">{c.code} · {c.customer}</td>
                  <td className="text-right">{formatVnd(c.app?.total ?? 0)}{ok ? '' : ` (file ${formatVnd(c.exp.total)})`}</td>
                  <td className="text-right">{formatVnd(c.app?.paid ?? 0)}</td><td className="text-right">{formatVnd(c.app?.due ?? 0)}</td>
                </tr>); })}</tbody>
            </table>
          </div>
          <Link className="btn-primary w-full" href="/don-noi-that">Xem danh sách đơn</Link>
        </section>
      )}
      {payload && <p className="text-xs text-muted">Trạng thái đơn giữ nguyên ({Object.values(STATUS).map((s) => s.label).join(' / ')}); ngày tháng, mã đơn, số phiếu thu, chữ ký, nhật ký giữ nguyên. Ngày sao lưu: {fmtDate(fileAt.slice(0, 10))}.</p>}
    </div>
  );
}
