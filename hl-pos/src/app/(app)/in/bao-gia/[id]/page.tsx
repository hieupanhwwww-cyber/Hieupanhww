'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { errorText } from '@/lib/supabase/client';
import { getOrder, type OrderFull } from '@/lib/ordersApi';
import { loadSettings, type Settings } from '@/lib/settings';
import { orderMoney, quoteTotals, rowAmount, dimText, moneyWords, fmtDate, fmtQty, dotLabel, TRIGGERS, type Quote } from '@/lib/orderMoney';
import { formatVnd } from '@/lib/money';
import { PrintSheet } from '@/components/PrintSheet';
import { DocHeader, SignBox } from '@/components/orders/DocHeader';
import { VietQr } from '@/components/orders/VietQr';

export default function QuotePrintPage() {
  const { id } = useParams<{ id: string }>();
  const ban = useSearchParams().get('ban');
  const [full, setFull] = useState<OrderFull | null>(null);
  const [st, setSt] = useState<Settings | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { Promise.all([getOrder(id), loadSettings()]).then(([f, s]) => { setFull(f); setSt(s); }, (e) => setError(errorText(e))); }, [id]);
  if (!full || !st) return <p className={error ? 'text-danger' : 'text-muted'}>{error || 'Đang tải…'}</p>;

  const { order, head } = full;
  const isDraft = ban === 'nhap' || (!ban && !order.versions.length);
  const v = isDraft ? null : ban ? order.versions.find((x) => String(x.no) === ban) : order.versions.at(-1);
  const q: Quote | null = isDraft ? order.draft : v?.quote ?? null;
  if (!q) return <p className="text-danger">Không có bản báo giá này.</p>;
  const latest = !!v && v.no === order.versions.length;
  const replaced = !!v && !latest;
  const t = isDraft ? quoteTotals(q) : { sub: v!.sub, disc: v!.disc, total: v!.total };
  // bản hiện hành: trừ tiền đã trả; bản nháp/bản cũ: chỉ chia đợt theo chính báo giá đó
  const money = orderMoney(order, latest ? {} : { quote: q, pays: false });
  const firstDue = latest ? money.next : money.rows[0];
  const title = isDraft ? 'BÁO GIÁ' : order.versions.length > 1 ? `BÁO GIÁ (BẢN ${v!.no})` : 'BÁO GIÁ';

  return (
    <PrintSheet size="A4" fileName={`BaoGia_${head.code}${v ? `_ban${v.no}` : ''}`} title={`Báo giá ${head.code}`}
      actions={<Link className="btn-ghost" href={`/don-noi-that/${id}`}>← Về đơn</Link>}>
      <div className="space-y-4 text-[13px] leading-relaxed">
        <DocHeader st={st} />
        <div className="text-center">
          <div className="text-xl font-bold">{title}</div>
          <div>Số: {head.code} · Ngày {fmtDate(q.date)}{v ? ` · Chốt ngày ${fmtDate(v.closedAt)}` : ''}</div>
          {isDraft && order.versions.length > 0 && <div className="font-semibold text-red-700">BẢN ĐANG SỬA – CHƯA CHỐT</div>}
          {replaced && <div className="font-semibold text-red-700">ĐÃ ĐƯỢC THAY BẰNG BẢN {order.versions.length}</div>}
        </div>
        <div>
          <div><b>Khách hàng:</b> {q.customer.name}{q.customer.phone ? ` · ĐT: ${q.customer.phone}` : ''}</div>
          {q.customer.address && <div><b>Địa chỉ:</b> {q.customer.address}</div>}
          {q.project && <div><b>Công trình:</b> {q.project}</div>}
        </div>
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="text-left" style={{ background: '#f1e7db' }}>
              <th className="border border-gray-400 px-1 py-1 text-center">STT</th><th className="border border-gray-400 px-1">Hạng mục</th>
              <th className="border border-gray-400 px-1 text-center">ĐV</th><th className="border border-gray-400 px-1 text-right">SL</th>
              <th className="border border-gray-400 px-1 text-right">Đơn giá</th><th className="border border-gray-400 px-1 text-right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {q.rows.filter((r) => r.name.trim() || rowAmount(r)).map((r, i) => (
              <tr key={r.id} className="align-top" style={{ breakInside: 'avoid' }}>
                <td className="border border-gray-400 px-1 py-1 text-center">{i + 1}</td>
                <td className="border border-gray-400 px-1 py-1"><div className="font-medium">{r.name}</div>
                  {r.material && <div className="text-[11px]">{r.material}</div>}
                  {r.dims && <div className="text-[11px] text-gray-600">{dimText(r.unit, r.dims)}</div>}</td>
                <td className="border border-gray-400 px-1 py-1 text-center">{r.unit}</td>
                <td className="border border-gray-400 px-1 py-1 text-right">{fmtQty(r.qty)}</td>
                <td className="whitespace-nowrap border border-gray-400 px-1 py-1 text-right">{formatVnd(r.price)}</td>
                <td className="whitespace-nowrap border border-gray-400 px-1 py-1 text-right">{formatVnd(rowAmount(r))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto w-3/5 space-y-0.5">
          {t.disc > 0 && <><div className="flex justify-between"><span>Tạm tính</span><span>{formatVnd(t.sub)}</span></div>
            <div className="flex justify-between"><span>Giảm giá{q.discount.type === 'percent' ? ` (${fmtQty(q.discount.value)}%)` : ''}</span><span>−{formatVnd(t.disc)}</span></div></>}
          <div className="flex justify-between border-t border-black pt-1 text-base font-bold"><span>TỔNG CỘNG</span><span>{formatVnd(t.total)}</span></div>
        </div>
        <div className="italic">Bằng chữ: {moneyWords(t.total)}</div>

        {money.rows.length > 0 && !money.rows[0].one && (
          <div style={{ breakInside: 'avoid' }}>
            <div className="mb-1 font-semibold">Tiến độ thanh toán</div>
            <table className="w-full border-collapse text-[12px]">
              <tbody>
                {money.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="border border-gray-400 px-1 py-1">{dotLabel(r)}: {r.label}</td>
                    <td className="border border-gray-400 px-1 py-1">{TRIGGERS[r.trigger]}{r.due ? ` – hạn ${fmtDate(r.due)}` : ''}</td>
                    <td className="whitespace-nowrap border border-gray-400 px-1 py-1 text-right">{r.fixed || r.last ? '' : `${fmtQty(r.pct)}% · `}{formatVnd(r.amount)}</td>
                    {latest && <td className="whitespace-nowrap border border-gray-400 px-1 py-1 text-right">{r.left <= 0 ? 'Đã thu' : r.paid > 0 ? `Còn ${formatVnd(r.left)}` : ''}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!replaced && firstDue && firstDue.left > 0 && (
          <div style={{ breakInside: 'avoid' }}>
            <div className="mb-1 font-semibold">Quét mã để chuyển khoản {dotLabel(firstDue).toLowerCase()}</div>
            <VietQr settings={st} code={head.code} n={firstDue.one ? 0 : firstDue.n} amount={firstDue.left} size={110} compact />
          </div>
        )}
        {q.note && <div><b>Ghi chú:</b> <span className="whitespace-pre-line">{q.note}</span></div>}
        {q.terms && <div><b>Điều khoản:</b> <div className="whitespace-pre-line">{q.terms}</div></div>}
        {q.validUntil && <div className="italic">Báo giá có hiệu lực đến ngày {fmtDate(q.validUntil)}.</div>}
        <div className="flex gap-6 pt-4" style={{ breakInside: 'avoid' }}>
          <SignBox title="Khách hàng" name={v?.sign?.name ?? q.customer.name} img={v?.sign?.img}
            note={v?.sign ? `Ký lúc ${new Date(v.sign.at).toLocaleString('vi-VN')} · mã ${v.sign.hash}` : undefined} />
          <SignBox title={st.name} />
        </div>
      </div>
    </PrintSheet>
  );
}
