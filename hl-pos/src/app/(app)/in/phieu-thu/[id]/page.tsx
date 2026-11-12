'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase, errorText } from '@/lib/supabase/client';
import { getOrder, type OrderFull } from '@/lib/ordersApi';
import { loadSettings, type Settings } from '@/lib/settings';
import { headQuote, orderMoney, receiptNo, moneyWords, fmtDate, PAY_METHOD } from '@/lib/orderMoney';
import { formatVnd } from '@/lib/money';
import { PrintSheet } from '@/components/PrintSheet';
import { DocHeader, SignBox } from '@/components/orders/DocHeader';

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const no = Number(sp.get('so'));
  const [full, setFull] = useState<OrderFull | null>(null);
  const [st, setSt] = useState<Settings | null>(null);
  const [collector, setCollector] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([getOrder(id), loadSettings()]).then(async ([f, s]) => {
      setFull(f); setSt(s);
      const p = f.order.payments.find((x) => x.no === no);
      const by = p && f.payMeta[p.id]?.created_by;
      if (by) { const { data } = await supabase().from('profiles').select('full_name').eq('id', by).maybeSingle(); setCollector(data?.full_name ?? ''); }
    }, (e) => setError(errorText(e)));
  }, [id, no]);
  if (!full || !st) return <p className={error ? 'text-danger' : 'text-muted'}>{error || 'Đang tải…'}</p>;
  const { order, head } = full;
  const p = order.payments.find((x) => x.no === no);
  if (!p) return <p className="text-danger">Không tìm thấy phiếu thu số {no}.</p>;
  const q = headQuote(order);
  const m = orderMoney(order);
  const paidUpTo = order.payments.filter((x) => x.no <= p.no).reduce((s, x) => s + x.amount, 0);
  const no2 = receiptNo(head.code, p.no);

  return (
    <PrintSheet size="A5" fileName={no2} title={`Phiếu thu ${no2}`}
      actions={<>{sp.get('moi') && <span className="chip bg-green-50 text-sm text-ok">Đã ghi phiếu thu</span>}<Link className="btn-ghost" href={`/don-noi-that/${id}`}>← Về đơn</Link></>}>
      <div className="space-y-3 text-[13px] leading-relaxed">
        <DocHeader st={st} />
        <div className="text-center">
          <div className="text-xl font-bold">PHIẾU THU</div>
          <div>Số: {no2} · Ngày {fmtDate(p.date)}</div>
        </div>
        <div className="space-y-1">
          <div><b>Người nộp:</b> {q?.customer.name ?? head.customer_name}{q?.customer.phone ? ` · ĐT: ${q.customer.phone}` : ''}</div>
          {q?.customer.address && <div><b>Địa chỉ:</b> {q.customer.address}</div>}
          <div><b>Lý do:</b> {p.deposit ? 'Đặt cọc' : 'Thanh toán'} đơn {head.code}{head.project ? ` (${head.project})` : ''}{p.note && p.note !== 'Đặt cọc khi chốt đơn' ? ` – ${p.note}` : ''}</div>
          <div className="text-base"><b>Số tiền:</b> <b>{formatVnd(p.amount)}</b></div>
          <div className="italic">Bằng chữ: {moneyWords(p.amount)}</div>
          <div><b>Hình thức:</b> {PAY_METHOD[p.method]}</div>
        </div>
        <table className="w-full border-collapse text-[12px]">
          <tbody>
            <tr><td className="border border-gray-400 px-2 py-1">Giá trị đơn</td><td className="border border-gray-400 px-2 py-1 text-right">{formatVnd(m.total)}</td></tr>
            <tr><td className="border border-gray-400 px-2 py-1">Đã thu (tính cả phiếu này)</td><td className="border border-gray-400 px-2 py-1 text-right">{formatVnd(paidUpTo)}</td></tr>
            <tr><td className="border border-gray-400 px-2 py-1 font-semibold">Còn lại</td><td className="border border-gray-400 px-2 py-1 text-right font-semibold">{formatVnd(Math.max(0, m.total - paidUpTo))}</td></tr>
          </tbody>
        </table>
        <div className="flex gap-6 pt-2">
          <SignBox title="Người nộp tiền" name={q?.customer.name} />
          <SignBox title="Người thu tiền" name={collector} />
        </div>
      </div>
    </PrintSheet>
  );
}
