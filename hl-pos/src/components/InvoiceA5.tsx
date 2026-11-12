import { forwardRef } from 'react';
import { formatVnd, formatQty } from '@/lib/money';

export type InvoiceData = {
  store: { name: string; address: string; phone: string; note: string | null };
  sale: { code: string; created_at: string; subtotal: number; discount: number; total: number; payment_method: 'cash' | 'transfer'; seller: string };
  items: { id: string; product_name: string; unit: string; quantity: number; unit_price: number; line_total: number }[];
};

/** Hóa đơn bán lẻ khổ A5 (148 × 210 mm). */
export const InvoiceA5 = forwardRef<HTMLDivElement, InvoiceData>(function InvoiceA5({ store, sale, items }, ref) {
  return (
    <div ref={ref} className="mx-auto bg-white p-6 text-[13px] leading-relaxed text-black" style={{ width: '148mm', minHeight: '200mm' }}>
      <div className="text-center">
        <div className="text-lg font-bold uppercase" style={{ color: '#6f4a2f' }}>{store.name}</div>
        <div>{store.address}</div>
        <div>ĐT: {store.phone}</div>
      </div>
      <div className="my-4 text-center">
        <div className="text-base font-bold">HÓA ĐƠN BÁN HÀNG</div>
        <div>Số: {sale.code} · {new Date(sale.created_at).toLocaleString('vi-VN')}</div>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-black text-left">
            <th className="py-1">Tên hàng</th>
            <th className="py-1 text-right">SL</th>
            <th className="py-1 text-right">Đơn giá</th>
            <th className="py-1 text-right">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-b border-dashed border-gray-400 align-top">
              <td className="py-1 pr-2">{i.product_name}</td>
              <td className="py-1 text-right whitespace-nowrap">{formatQty(i.quantity)} {i.unit}</td>
              <td className="py-1 text-right whitespace-nowrap">{formatVnd(i.unit_price)}</td>
              <td className="py-1 text-right whitespace-nowrap">{formatVnd(i.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 ml-auto w-2/3 space-y-0.5">
        <div className="flex justify-between"><span>Tiền hàng</span><span>{formatVnd(sale.subtotal)}</span></div>
        {sale.discount > 0 && <div className="flex justify-between"><span>Giảm giá</span><span>−{formatVnd(sale.discount)}</span></div>}
        <div className="flex justify-between border-t border-black pt-1 text-base font-bold"><span>Tổng thanh toán</span><span>{formatVnd(sale.total)}</span></div>
        <div className="flex justify-between"><span>Hình thức</span><span>{sale.payment_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</span></div>
      </div>
      <div className="mt-6 flex justify-between text-center">
        <div className="w-1/2">Người bán<br /><span className="mt-10 inline-block">{sale.seller}</span></div>
        <div className="w-1/2">Khách hàng<br /><span className="mt-10 inline-block">&nbsp;</span></div>
      </div>
      {store.note && <div className="mt-6 text-center italic">{store.note}</div>}
    </div>
  );
});
