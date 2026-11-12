import { describe, it, expect } from 'vitest';
import { addToCart, setQuantity, cartTotals, type CartLine } from './cart';

const ghe = { id: 'g', name: 'Ghế', unit: 'cái', sale_price: 100_000, stock: 5 };
const ban = { id: 'b', name: 'Bàn', unit: 'cái', sale_price: 50_000, stock: 1 };

describe('giỏ hàng', () => {
  it('chạm cùng món 2 lần thì số lượng thành 2', () => {
    let c: CartLine[] = [];
    c = addToCart(c, ghe);
    c = addToCart(c, ghe);
    expect(c).toEqual([{ productId: 'g', name: 'Ghế', unit: 'cái', unitPrice: 100_000, quantity: 2, stock: 5 }]);
  });

  it('đặt số lượng 0 thì bỏ món khỏi giỏ', () => {
    const c = setQuantity(addToCart([], ghe), 'g', 0);
    expect(c).toEqual([]);
  });

  it('tính tổng có giảm giá', () => {
    let c = addToCart(addToCart([], ghe), ban);
    c = setQuantity(c, 'g', 2);
    expect(cartTotals(c, 20_000)).toEqual({ subtotal: 250_000, discount: 20_000, total: 230_000 });
  });

  it('giảm giá vượt tổng hoặc âm thì báo lỗi', () => {
    const c = addToCart([], ban);
    expect(cartTotals(c, 60_000).error).toMatch(/Giảm giá/);
    expect(cartTotals(c, -1).error).toMatch(/Giảm giá/);
  });

  it('số lượng vượt tồn thì báo lỗi trước khi gửi', () => {
    const c = setQuantity(addToCart([], ban), 'b', 2);
    expect(cartTotals(c, 0).error).toMatch(/Bàn/);
  });

  it('giỏ trống thì báo lỗi', () => {
    expect(cartTotals([], 0).error).toMatch(/trống/);
  });
});
