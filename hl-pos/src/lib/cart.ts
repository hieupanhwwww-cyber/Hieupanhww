export type CartLine = { productId: string; name: string; unit: string; unitPrice: number; quantity: number; stock: number };
type Sellable = { id: string; name: string; unit: string; sale_price: number; stock: number };

export function addToCart(lines: CartLine[], p: Sellable): CartLine[] {
  if (lines.some((l) => l.productId === p.id)) {
    return lines.map((l) => (l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l));
  }
  return [...lines, { productId: p.id, name: p.name, unit: p.unit, unitPrice: p.sale_price, quantity: 1, stock: p.stock }];
}

export function setQuantity(lines: CartLine[], productId: string, quantity: number): CartLine[] {
  if (!(quantity > 0)) return lines.filter((l) => l.productId !== productId);
  return lines.map((l) => (l.productId === productId ? { ...l, quantity } : l));
}

export type Totals = { subtotal: number; discount: number; total: number; error?: string };

/** Tổng tiền hiển thị trước khi bán. Số tiền thật do máy chủ tính lại. */
export function cartTotals(lines: CartLine[], discount: number): Totals {
  const subtotal = lines.reduce((s, l) => s + Math.round(l.unitPrice * l.quantity), 0);
  const t: Totals = { subtotal, discount, total: subtotal - discount };
  if (!lines.length) return { ...t, error: 'Giỏ hàng trống' };
  const over = lines.find((l) => l.quantity > l.stock);
  if (over) return { ...t, error: `Không đủ tồn kho: ${over.name} (còn ${over.stock})` };
  if (!Number.isFinite(discount) || discount < 0 || discount > subtotal) return { ...t, error: 'Giảm giá phải từ 0 đến tổng tiền hàng' };
  return t;
}
