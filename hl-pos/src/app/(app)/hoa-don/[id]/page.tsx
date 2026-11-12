'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { toBlob } from 'html-to-image';
import { supabase, errorText } from '@/lib/supabase/client';
import { InvoiceA5, type InvoiceData } from '@/components/InvoiceA5';

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const isNew = useSearchParams().get('moi') === '1';
  const ref = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<InvoiceData | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const sb = supabase();
    Promise.all([
      sb.from('store_settings').select('name, address, phone, note').single(),
      sb.from('sales').select('code, created_at, subtotal, discount, total, payment_method, created_by').eq('id', id).single(),
      sb.from('sale_items').select('id, product_name, unit, quantity, unit_price, line_total').eq('sale_id', id),
    ]).then(async ([st, sa, it]) => {
      const err = st.error ?? sa.error ?? it.error;
      if (err || !st.data || !sa.data) { setMsg(err ? errorText(err) : 'Không tìm thấy hóa đơn.'); return; }
      const sale = sa.data;
      const { data: seller } = await sb.from('profiles').select('full_name').eq('id', sale.created_by).maybeSingle();
      const n = Number;
      setData({
        store: st.data as InvoiceData['store'],
        sale: {
          code: sale.code, created_at: sale.created_at, payment_method: sale.payment_method,
          subtotal: n(sale.subtotal), discount: n(sale.discount), total: n(sale.total), seller: seller?.full_name ?? '',
        },
        items: (it.data ?? []).map((r) => ({ ...r, quantity: n(r.quantity), unit_price: n(r.unit_price), line_total: n(r.line_total) })),
      });
    });
  }, [id]);

  async function shareImage() {
    if (!ref.current || !data) return;
    setMsg('Đang tạo ảnh…');
    try {
      const blob = await toBlob(ref.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      if (!blob) throw new Error('Không tạo được ảnh');
      const file = new File([blob], `${data.sale.code}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Hóa đơn ${data.sale.code}` });
        setMsg('');
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
        setMsg('Đã lưu ảnh. Mở Zalo và gửi ảnh vừa tải cho khách.');
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMsg(errorText(e));
      else setMsg('');
    }
  }

  if (!data) return <p className="text-muted">{msg || 'Đang tải hóa đơn…'}</p>;

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        {isNew && <span className="chip bg-green-50 text-ok text-sm">Đã thanh toán {data.sale.code}</span>}
        <div className="flex-1" />
        <button className="btn-primary" onClick={() => window.print()}>In hóa đơn</button>
        <button className="btn-ghost" onClick={shareImage}>Gửi ảnh Zalo</button>
        <Link className="btn-ghost" href="/ban-hang">Bán đơn mới</Link>
      </div>
      {msg && <p className="no-print text-sm text-muted">{msg}</p>}
      <style>{`@page { size: A5; margin: 8mm; }`}</style>
      <div className="overflow-x-auto rounded-xl border border-line print:overflow-visible print:border-0">
        <InvoiceA5 ref={ref} {...data} />
      </div>
    </div>
  );
}
