import { describe, it, expect, beforeEach } from 'vitest';
import { sql, createUser, asUser, resetDb, type Q } from './helpers';

async function product(owner: string, code: string, sale: number, cost: number, stockIn: number) {
  const id = await asUser(owner, (q) => q(`select save_product(null, $1, $2, 'goods', 'cái', $3, 0, $4) as id`, [code, `Hàng ${code}`, sale, cost]))
    .then((r) => r[0].id as string);
  if (stockIn) await asUser(owner, (q) => q(`select record_stock($1, 'in', $2, 'Nhập')`, [id, stockIn]));
  return id;
}
const sell = (q: Q, items: { product_id: string; quantity: number }[], discount = 0, method = 'cash') =>
  q('select create_sale($1::jsonb, $2, $3) as r', [JSON.stringify(items), discount, method]).then((r) => r[0].r);
const stock = async (id: string) => Number((await sql('select stock from product_stock where product_id = $1', [id]))[0].stock);

describe('bán hàng', () => {
  let owner: string, staff: string, a: string, b: string;
  beforeEach(async () => {
    await resetDb();
    owner = await createUser('owner');
    staff = await createUser('staff');
    a = await product(owner, 'A', 100_000, 60_000, 10);
    b = await product(owner, 'B', 50_000, 20_000, 5);
  });

  it('tính tiền có giảm giá, trừ kho, ghi phiếu xuất gắn hóa đơn', async () => {
    const r = await asUser(staff, (q) => sell(q, [{ product_id: a, quantity: 2 }, { product_id: b, quantity: 1 }], 20_000, 'transfer'));
    expect(r.code).toBe('HD000001');
    expect(Number(r.total)).toBe(230_000);
    const [s] = await sql('select subtotal, discount, total, payment_method, created_by from sales where id = $1', [r.id]);
    expect(s).toEqual({ subtotal: '250000', discount: '20000', total: '230000', payment_method: 'transfer', created_by: staff });
    expect(await stock(a)).toBe(8);
    expect(await stock(b)).toBe(4);
    const moves = await sql(`select count(*)::int as n from stock_movements where sale_id = $1 and type = 'out'`, [r.id]);
    expect(moves[0].n).toBe(2);
  });

  it('giá bán lấy từ hệ thống, giá vốn chụp tại lúc bán', async () => {
    const r = await asUser(staff, (q) => sell(q, [{ product_id: a, quantity: 1 }]));
    await asUser(owner, (q) => q(`select save_product($1, 'A', 'Hàng A', 'goods', 'cái', 120000, 0, 70000)`, [a]));
    const [line] = await sql(`select i.unit_price, i.line_total, c.unit_cost from sale_items i join sale_item_costs c on c.sale_item_id = i.id where i.sale_id = $1`, [r.id]);
    expect(line).toEqual({ unit_price: '100000', line_total: '100000', unit_cost: '60000' });
  });

  it('món trùng trong giỏ được cộng dồn', async () => {
    const r = await asUser(staff, (q) => sell(q, [{ product_id: a, quantity: 1 }, { product_id: a, quantity: 2 }]));
    const items = await sql('select quantity from sale_items where sale_id = $1', [r.id]);
    expect(items).toEqual([{ quantity: '3' }]);
    expect(await stock(a)).toBe(7);
  });

  it('nhân viên đọc được dòng hóa đơn nhưng không đọc được giá vốn', async () => {
    const r = await asUser(staff, (q) => sell(q, [{ product_id: a, quantity: 1 }]));
    expect((await asUser(staff, (q) => q('select * from sale_items where sale_id = $1', [r.id]))).length).toBe(1);
    expect(await asUser(staff, (q) => q('select * from sale_item_costs'))).toEqual([]);
    expect((await asUser(owner, (q) => q('select * from sale_item_costs'))).length).toBe(1);
  });

  it('giảm giá lớn hơn tổng tiền hoặc âm bị từ chối, không lưu gì', async () => {
    await expect(asUser(staff, (q) => sell(q, [{ product_id: a, quantity: 1 }], 100_001))).rejects.toThrow(/Giảm giá/);
    await expect(asUser(staff, (q) => sell(q, [{ product_id: a, quantity: 1 }], -1))).rejects.toThrow(/Giảm giá/);
    expect((await sql('select count(*)::int as n from sales'))[0].n).toBe(0);
    expect(await stock(a)).toBe(10);
  });

  it('bán quá tồn bị từ chối, kho và hóa đơn không đổi', async () => {
    await expect(asUser(staff, (q) => sell(q, [{ product_id: a, quantity: 1 }, { product_id: b, quantity: 6 }]))).rejects.toThrow(/Không đủ tồn kho: Hàng B/);
    expect(await stock(a)).toBe(10);
    expect((await sql('select count(*)::int as n from sales'))[0].n).toBe(0);
  });

  it('giỏ rỗng, số lượng 0, hình thức thanh toán sai, món ngừng bán bị từ chối', async () => {
    await expect(asUser(staff, (q) => sell(q, []))).rejects.toThrow(/Giỏ hàng trống/);
    await expect(asUser(staff, (q) => sell(q, [{ product_id: a, quantity: 0 }]))).rejects.toThrow(/Số lượng/);
    await expect(asUser(staff, (q) => sell(q, [{ product_id: a, quantity: 1 }], 0, 'card'))).rejects.toThrow(/thanh toán/);
    await asUser(owner, (q) => q('select set_product_active($1, false)', [a]));
    await expect(asUser(staff, (q) => sell(q, [{ product_id: a, quantity: 1 }]))).rejects.toThrow(/ngừng bán/);
  });

  it('hai người bán cùng món cuối cùng một lúc: chỉ một hóa đơn thành công', async () => {
    const c = await product(owner, 'C', 10_000, 5_000, 1);
    const results = await Promise.allSettled([
      asUser(staff, (q) => sell(q, [{ product_id: c, quantity: 1 }])),
      asUser(owner, (q) => sell(q, [{ product_id: c, quantity: 1 }])),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1);
    expect(await stock(c)).toBe(0);
  });

  it('mã hóa đơn tăng dần', async () => {
    const r1 = await asUser(staff, (q) => sell(q, [{ product_id: a, quantity: 1 }]));
    const r2 = await asUser(staff, (q) => sell(q, [{ product_id: a, quantity: 1 }]));
    expect([r1.code, r2.code]).toEqual(['HD000001', 'HD000002']);
  });

  it('không ai sửa/xóa hóa đơn hay tự chèn hóa đơn qua API', async () => {
    const r = await asUser(staff, (q) => sell(q, [{ product_id: a, quantity: 1 }]));
    await expect(asUser(owner, (q) => q('update sales set total = 1 where id = $1', [r.id]))).rejects.toThrow();
    await expect(asUser(owner, (q) => q('delete from sales'))).rejects.toThrow();
    await expect(asUser(staff, (q) => q(`insert into sales (subtotal, discount, total, payment_method) values (1,0,1,'cash')`))).rejects.toThrow();
  });
});
