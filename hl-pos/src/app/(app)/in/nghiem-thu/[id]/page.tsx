'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { errorText } from '@/lib/supabase/client';
import { getOrder, type OrderFull } from '@/lib/ordersApi';
import { loadSettings, type Settings } from '@/lib/settings';
import { orderMoney, lastVersion, rowAmount, dimText, fmtDate, fmtQty } from '@/lib/orderMoney';
import { formatVnd } from '@/lib/money';
import { PrintSheet } from '@/components/PrintSheet';
import { DocHeader, SignBox } from '@/components/orders/DocHeader';

export default function HandoverPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [full, setFull] = useState<OrderFull | null>(null);
  const [st, setSt] = useState<Settings | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { Promise.all([getOrder(id), loadSettings()]).then(([f, s]) => { setFull(f); setSt(s); }, (e) => setError(errorText(e))); }, [id]);
  if (!full || !st) return <p className={error ? 'text-danger' : 'text-muted'}>{error || 'Đang tải…'}</p>;
  const { order, head } = full, h = order.handover, v = lastVersion(order);
  if (!h || !v) return <p className="text-danger">Đơn chưa nghiệm thu.</p>;
  const q = v.quote, m = orderMoney(order);
  const changes = order.changes.filter((c) => c.status === 'confirmed');
  const cell = 'border border-gray-400 px-1 py-1';
  return (
    <PrintSheet size="A4" fileName={`NghiemThu_${head.code}`} title={`Biên bản nghiệm thu ${head.code}`} actions={<Link className="btn-ghost" href={`/don-noi-that/${id}`}>← Về đơn</Link>}>
      <div className="space-y-3 text-[13px] leading-relaxed">
        <DocHeader st={st} />
        <div className="text-center">
          <div className="text-xl font-bold">BIÊN BẢN NGHIỆM THU VÀ BÀN GIAO</div>
          <div>Đơn {head.code} · Ngày bàn giao {fmtDate(h.date)}</div>
        </div>
        <div>
          <div><b>Khách hàng:</b> {q.customer.name}{q.customer.phone ? ` · ĐT: ${q.customer.phone}` : ''}</div>
          {q.customer.address && <div><b>Địa chỉ:</b> {q.customer.address}</div>}
          {q.project && <div><b>Công trình:</b> {q.project}</div>}
        </div>
        <div>Hai bên cùng kiểm tra và xác nhận các hạng mục dưới đây đã thi công, lắp đặt xong và bàn giao cho khách:</div>
        <table className="w-full border-collapse text-[12px]">
          <thead><tr style={{ background: '#f1e7db' }}><th className={`${cell} text-center`}>STT</th><th className={`${cell} text-left`}>Hạng mục</th><th className={`${cell} text-center`}>ĐV</th><th className={`${cell} text-right`}>SL</th><th className={`${cell} text-center`}>Đạt</th></tr></thead>
          <tbody>
            {q.rows.filter((r) => r.name.trim() || rowAmount(r)).map((r, i) => (
              <tr key={r.id} style={{ breakInside: 'avoid' }}><td className={`${cell} text-center`}>{i + 1}</td>
                <td className={cell}>{r.name}{r.material ? <div className="text-[11px]">{r.material}</div> : null}{r.dims ? <div className="text-[11px] text-gray-600">{dimText(r.unit, r.dims)}</div> : null}</td>
                <td className={`${cell} text-center`}>{r.unit}</td><td className={`${cell} text-right`}>{fmtQty(r.qty)}</td><td className={`${cell} text-center`}>☐</td></tr>
            ))}
            {changes.map((c, i) => (
              <tr key={c.id}><td className={`${cell} text-center`}>PS{i + 1}</td><td className={cell} colSpan={3}>Phát sinh {c.sign < 0 ? 'giảm' : 'tăng'}: {c.title} ({c.sign < 0 ? '−' : '+'}{formatVnd(c.amount)}, xác nhận {fmtDate(c.confirmedAt)})</td><td className={`${cell} text-center`}>☐</td></tr>
            ))}
          </tbody>
        </table>
        <table className="ml-auto w-3/5 border-collapse text-[12px]">
          <tbody>
            <tr><td className={cell}>Giá trị đơn (gồm phát sinh)</td><td className={`${cell} text-right`}>{formatVnd(m.total)}</td></tr>
            <tr><td className={cell}>Đã thanh toán</td><td className={`${cell} text-right`}>{formatVnd(m.paid)}</td></tr>
            <tr><td className={`${cell} font-semibold`}>Còn phải thanh toán</td><td className={`${cell} text-right font-semibold`}>{formatVnd(m.due)}</td></tr>
          </tbody>
        </table>
        {h.warrantyMonths > 0 && <div><b>Bảo hành:</b> {h.warrantyMonths} tháng, từ {fmtDate(h.date)} đến hết ngày {fmtDate(h.warrantyUntil)}.</div>}
        {h.note && <div><b>Ghi chú:</b> <span className="whitespace-pre-line">{h.note}</span></div>}
        <div className="flex gap-6 pt-4" style={{ breakInside: 'avoid' }}>
          <SignBox title="Khách hàng" name={h.sign?.name ?? q.customer.name} img={h.sign?.img} note={h.sign ? `Ký lúc ${new Date(h.sign.at).toLocaleString('vi-VN')} · mã ${h.sign.hash}` : undefined} />
          <SignBox title={st.name} />
        </div>
      </div>
    </PrintSheet>
  );
}
