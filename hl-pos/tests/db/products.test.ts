import { describe, it, expect, beforeEach } from 'vitest';
import { sql, createUser, asUser, resetDb, type Q } from './helpers';

const saveProduct = (q: Q, p: Partial<{ id: string | null; code: string; name: string; kind: string; unit: string; sale: number; threshold: number; cost: number | null }>) =>
  q(`select save_product($1, $2, $3, $4, $5, $6, $7, $8) as id`, [
    p.id ?? null, p.code ?? 'TU01', p.name ?? 'Tủ áo 3 cánh', p.kind ?? 'goods', p.unit ?? 'cái',
    p.sale ?? 5_000_000, p.threshold ?? 2, p.cost === undefined ? 3_000_000 : p.cost,
  ]).then((r) => r[0].id as string);

const stock = async (id: string) => Number((await sql('select stock from product_stock where product_id = $1', [id]))[0].stock);

describe('hàng hóa và kho', () => {
  let owner: string, staff: string;
  beforeEach(async () => {
    await resetDb();
    owner = await createUser('owner');
    staff = await createUser('staff');
  });

  it('chủ tạo hàng có giá vốn; nhân viên thấy hàng nhưng không thấy giá vốn', async () => {
    const id = await asUser(owner, (q) => saveProduct(q, {}));
    const prods = await asUser(staff, (q) => q('select code, sale_price from products'));
    expect(prods).toEqual([{ code: 'TU01', sale_price: '5000000' }]);
    expect(await asUser(staff, (q) => q('select * from product_costs'))).toEqual([]);
    const costs = await asUser(owner, (q) => q('select cost_price from product_costs where product_id = $1', [id]));
    expect(costs[0].cost_price).toBe('3000000');
  });

  it('nhân viên không được thêm/sửa hàng, không ghi trực tiếp bảng', async () => {
    await expect(asUser(staff, (q) => saveProduct(q, {}))).rejects.toThrow(/Chỉ chủ/);
    await expect(asUser(staff, (q) => q(`insert into products (code, name, kind, unit, sale_price) values ('X','X','goods','cái',1)`))).rejects.toThrow();
  });

  it('chủ sửa hàng và giá vốn', async () => {
    const id = await asUser(owner, (q) => saveProduct(q, {}));
    await asUser(owner, (q) => saveProduct(q, { id, name: 'Tủ áo 4 cánh', cost: 3_500_000 }));
    expect((await sql('select name from products where id=$1', [id]))[0].name).toBe('Tủ áo 4 cánh');
    expect((await sql('select cost_price from product_costs where product_id=$1', [id]))[0].cost_price).toBe('3500000');
  });

  it('mã hàng trùng bị từ chối', async () => {
    await asUser(owner, (q) => saveProduct(q, {}));
    await expect(asUser(owner, (q) => saveProduct(q, { name: 'Khác' }))).rejects.toThrow();
  });

  it('giá âm bị từ chối', async () => {
    await expect(asUser(owner, (q) => saveProduct(q, { sale: -1 }))).rejects.toThrow();
  });

  it('tồn kho = tổng phiếu nhập − xuất; hàng mới có tồn 0', async () => {
    const id = await asUser(owner, (q) => saveProduct(q, {}));
    expect(await stock(id)).toBe(0);
    await asUser(staff, (q) => q(`select record_stock($1, 'in', 10, 'Nhập xưởng')`, [id]));
    await asUser(staff, (q) => q(`select record_stock($1, 'out', 3, 'Hỏng')`, [id]));
    expect(await stock(id)).toBe(7);
    const [m] = await sql(`select created_by, reason from stock_movements where type='out'`);
    expect(m).toEqual({ created_by: staff, reason: 'Hỏng' });
  });

  it('xuất quá tồn bị từ chối, tồn giữ nguyên', async () => {
    const id = await asUser(owner, (q) => saveProduct(q, {}));
    await asUser(staff, (q) => q(`select record_stock($1, 'in', 7, 'Nhập')`, [id]));
    await expect(asUser(staff, (q) => q(`select record_stock($1, 'out', 8, 'Xuất')`, [id]))).rejects.toThrow(/Không đủ tồn kho/);
    expect(await stock(id)).toBe(7);
  });

  it('số lượng 0 hoặc âm bị từ chối', async () => {
    const id = await asUser(owner, (q) => saveProduct(q, {}));
    await expect(asUser(staff, (q) => q(`select record_stock($1, 'in', 0, 'x')`, [id]))).rejects.toThrow();
    await expect(asUser(staff, (q) => q(`select record_stock($1, 'in', -2, 'x')`, [id]))).rejects.toThrow();
  });

  it('không ai sửa/xóa phiếu kho qua API', async () => {
    const id = await asUser(owner, (q) => saveProduct(q, {}));
    await asUser(owner, (q) => q(`select record_stock($1, 'in', 5, 'Nhập')`, [id]));
    await expect(asUser(owner, (q) => q(`update stock_movements set quantity = 100`))).rejects.toThrow();
    await expect(asUser(owner, (q) => q(`delete from stock_movements`))).rejects.toThrow();
    await expect(asUser(owner, (q) => q(`insert into stock_movements (product_id, type, quantity) values ($1, 'in', 100)`, [id]))).rejects.toThrow();
  });

  it('cảnh báo sắp hết khi tồn ≤ ngưỡng', async () => {
    const id = await asUser(owner, (q) => saveProduct(q, { threshold: 2 }));
    await asUser(owner, (q) => q(`select record_stock($1, 'in', 3, 'Nhập')`, [id]));
    expect((await sql('select is_low from product_stock where product_id=$1', [id]))[0].is_low).toBe(false);
    await asUser(owner, (q) => q(`select record_stock($1, 'out', 1, 'Xuất')`, [id]));
    expect((await sql('select is_low from product_stock where product_id=$1', [id]))[0].is_low).toBe(true);
  });
});
