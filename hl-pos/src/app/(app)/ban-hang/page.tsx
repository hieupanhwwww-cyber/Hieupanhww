'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, errorText } from '@/lib/supabase/client';
import { loadProducts, matches, type Product } from '@/lib/products';
import { addToCart, setQuantity, cartTotals, type CartLine } from '@/lib/cart';
import { formatVnd, formatQty } from '@/lib/money';
import { useOnline } from '@/lib/useOnline';
import { MoneyInput } from '@/components/MoneyInput';

export default function SellPage() {
  const router = useRouter();
  const online = useOnline();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState<'cash' | 'transfer'>('cash');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadProducts(false).then((list) => setProducts(list.filter((p) => p.active)), (e) => setError(errorText(e)));
  }, []);

  const shown = useMemo(() => products.filter((p) => matches(p, query)).slice(0, 60), [products, query]);
  const totals = cartTotals(cart, discount);

  async function checkout() {
    if (totals.error || busy || !online) return;
    setBusy(true);
    setError('');
    const { data, error } = await supabase().rpc('create_sale', {
      p_items: cart.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
      p_discount: discount,
      p_payment_method: method,
    });
    if (error) {
      setError(errorText(error));
      setBusy(false);
      return;
    }
    router.push(`/hoa-don/${data.id}?moi=1`);
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
      <section className="min-w-0 space-y-3">
        <h1 className="text-xl font-bold">Bán hàng</h1>
        <input className="input" placeholder="Tìm theo tên hoặc mã…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {shown.map((p) => {
            const inCart = cart.find((l) => l.productId === p.id)?.quantity ?? 0;
            const out = p.stock <= inCart;
            return (
              <button key={p.id} disabled={out} onClick={() => setCart((c) => addToCart(c, p))}
                className={`card relative p-3 text-left transition active:scale-[0.98] disabled:opacity-40 ${inCart ? 'border-brand ring-1 ring-brand' : ''}`}>
                <div className="line-clamp-2 font-medium leading-snug">{p.name}</div>
                <div className="mt-1 text-sm text-brand">{formatVnd(p.sale_price)}</div>
                <div className="text-xs text-muted">{p.code} · tồn {formatQty(p.stock)}</div>
                {inCart > 0 && <span className="chip absolute right-2 top-2 bg-brand text-white">{formatQty(inCart)}</span>}
              </button>
            );
          })}
          {!shown.length && <p className="col-span-full text-muted">Không tìm thấy hàng.</p>}
        </div>
      </section>

      <section className="card h-fit min-w-0 space-y-3 lg:sticky lg:top-4">
        <h2 className="font-semibold">Giỏ hàng</h2>
        {!cart.length && <p className="text-sm text-muted">Chạm vào món để thêm.</p>}
        <ul className="divide-y divide-line">
          {cart.map((l) => (
            <li key={l.productId} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{l.name}</div>
                <div className="text-xs text-muted">{formatVnd(l.unitPrice)} × {formatQty(l.quantity)} = {formatVnd(l.unitPrice * l.quantity)}</div>
              </div>
              <button className="btn-ghost h-9 w-9 p-0" aria-label="Bớt" onClick={() => setCart((c) => setQuantity(c, l.productId, l.quantity - 1))}>−</button>
              <input className="input w-14 px-1 py-1.5 text-center" inputMode="decimal" value={l.quantity}
                onChange={(e) => { const q = Number(e.target.value.replace(',', '.')); if (!Number.isNaN(q)) setCart((c) => setQuantity(c, l.productId, q)); }} />
              <button className="btn-ghost h-9 w-9 p-0" aria-label="Thêm" onClick={() => setCart((c) => setQuantity(c, l.productId, l.quantity + 1))}>+</button>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm text-muted" htmlFor="discount">Giảm giá</label>
          <MoneyInput id="discount" className="w-40" value={discount} onChange={setDiscount} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className={method === 'cash' ? 'btn-primary' : 'btn-ghost'} onClick={() => setMethod('cash')}>Tiền mặt</button>
          <button className={method === 'transfer' ? 'btn-primary' : 'btn-ghost'} onClick={() => setMethod('transfer')}>Chuyển khoản</button>
        </div>
        <div className="space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between"><span>Tiền hàng</span><span>{formatVnd(totals.subtotal)}</span></div>
          {discount > 0 && <div className="flex justify-between"><span>Giảm giá</span><span>−{formatVnd(discount)}</span></div>}
          <div className="flex justify-between text-lg font-bold"><span>Khách trả</span><span className="text-brand">{formatVnd(totals.total)}</span></div>
        </div>
        {cart.length > 0 && totals.error && <p className="text-sm text-danger">{totals.error}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn-primary w-full py-3 text-lg" disabled={!!totals.error || busy || !online} onClick={checkout}>
          {!online ? 'Mất mạng' : busy ? 'Đang lưu…' : `Thanh toán ${cart.length ? formatVnd(totals.total) : ''}`}
        </button>
      </section>
    </div>
  );
}
