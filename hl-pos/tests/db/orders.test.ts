import { describe, it, expect, beforeEach } from 'vitest';
import { sql, createUser, asUser, resetDb, type Q } from './helpers';

const M = 1_000_000;
const createOrder = (q: Q, total: number, payments: { label: string; amount: number }[]) =>
  q(`select create_order('Chị Hoa', '0912345678', 'Thư Lâm, Hà Nội', $1, $2::jsonb) as id`, [total, JSON.stringify(payments)])
    .then((r) => r[0].id as string);
const balance = async (id: string) => (await sql('select paid_total, remaining from order_balances where order_id = $1', [id]))[0];
const payments = (id: string) => sql('select id, label, amount, paid from order_payments where order_id = $1 order by sort', [id]);

describe('đơn nội thất', () => {
  let staff: string, owner: string;
  const plan = [{ label: 'Cọc', amount: 15 * M }, { label: 'Đợt 2', amount: 20 * M }, { label: 'Nghiệm thu', amount: 15 * M }];
  beforeEach(async () => {
    await resetDb();
    owner = await createUser('owner');
    staff = await createUser('staff');
  });

  it('tạo đơn 50 triệu chia 3 đợt: còn nợ 50 triệu, trạng thái chốt thiết kế, mã DH000001', async () => {
    const id = await asUser(staff, (q) => createOrder(q, 50 * M, plan));
    const [o] = await sql('select code, status from interior_orders where id = $1', [id]);
    expect(o).toEqual({ code: 'DH000001', status: 'design_confirmed' });
    expect((await payments(id)).map((p) => p.label)).toEqual(['Cọc', 'Đợt 2', 'Nghiệm thu']);
    expect(await balance(id)).toEqual({ paid_total: '0', remaining: '50000000' });
  });

  it('ghi đã thu tiền cọc thì còn nợ giảm; bỏ đánh dấu thì nợ trở lại', async () => {
    const id = await asUser(staff, (q) => createOrder(q, 50 * M, plan));
    const [coc] = await payments(id);
    await asUser(staff, (q) => q(`select set_payment_paid($1, true, '2026-11-12')`, [coc.id]));
    expect(await balance(id)).toEqual({ paid_total: '15000000', remaining: '35000000' });
    expect((await sql('select paid_at::text as d from order_payments where id=$1', [coc.id]))[0].d).toBe('2026-11-12');
    await asUser(staff, (q) => q(`select set_payment_paid($1, false, null)`, [coc.id]));
    expect(await balance(id)).toEqual({ paid_total: '0', remaining: '50000000' });
  });

  it('tổng các đợt khác giá trị đơn thì không tạo được', async () => {
    await expect(asUser(staff, (q) => createOrder(q, 49 * M, plan))).rejects.toThrow(/Tổng các đợt/);
    expect((await sql('select count(*)::int as n from interior_orders'))[0].n).toBe(0);
  });

  it('không cho thu vượt giá trị đơn sau khi sửa giảm giá trị', async () => {
    const id = await asUser(staff, (q) => createOrder(q, 50 * M, plan));
    const [coc, dot2] = await payments(id);
    await asUser(staff, (q) => q(`select set_payment_paid($1, true, current_date)`, [coc.id]));
    await asUser(staff, (q) => q(`select update_order($1, 'Chị Hoa', '0912345678', 'Thư Lâm', $2, null)`, [id, 30 * M]));
    await expect(asUser(staff, (q) => q(`select set_payment_paid($1, true, current_date)`, [dot2.id]))).rejects.toThrow(/vượt/);
  });

  it('đổi tiến độ đúng các bước; giá trị lạ bị từ chối', async () => {
    const id = await asUser(staff, (q) => createOrder(q, 50 * M, plan));
    await asUser(staff, (q) => q(`select set_order_status($1, 'production')`, [id]));
    expect((await sql('select status from interior_orders where id=$1', [id]))[0].status).toBe('production');
    await expect(asUser(staff, (q) => q(`select set_order_status($1, 'xyz')`, [id]))).rejects.toThrow();
  });

  it('thêm vật tư đã dùng: trừ kho, phiếu gắn với đơn; quá tồn bị từ chối', async () => {
    const id = await asUser(staff, (q) => createOrder(q, 50 * M, plan));
    const mdf = await asUser(owner, (q) => q(`select save_product(null, 'MDF17', 'Ván MDF 17mm', 'material', 'tấm', 450000, 5, 300000) as id`)).then((r) => r[0].id);
    await asUser(owner, (q) => q(`select record_stock($1, 'in', 20, 'Nhập')`, [mdf]));
    await asUser(staff, (q) => q(`select add_order_material($1, $2, 5)`, [id, mdf]));
    expect(Number((await sql('select stock from product_stock where product_id=$1', [mdf]))[0].stock)).toBe(15);
    const [m] = await sql('select order_id, reason from stock_movements where type = $1', ['out']);
    expect(m).toEqual({ order_id: id, reason: 'Vật tư đơn DH000001' });
    await expect(asUser(staff, (q) => q(`select add_order_material($1, $2, 16)`, [id, mdf]))).rejects.toThrow(/Không đủ tồn kho/);
  });

  it('thêm/xóa đợt thanh toán; không xóa được đợt đã thu', async () => {
    const id = await asUser(staff, (q) => createOrder(q, 50 * M, plan));
    const [coc, dot2] = await payments(id);
    await asUser(staff, (q) => q(`select set_payment_paid($1, true, current_date)`, [coc.id]));
    await expect(asUser(staff, (q) => q(`select delete_payment($1)`, [coc.id]))).rejects.toThrow(/đã thu/);
    await asUser(staff, (q) => q(`select delete_payment($1)`, [dot2.id]));
    await asUser(staff, (q) => q(`select save_payment(null, $1, 'Phát sinh', $2)`, [id, 20 * M]));
    expect((await payments(id)).map((p) => p.label)).toEqual(['Cọc', 'Nghiệm thu', 'Phát sinh']);
  });

  it('không ghi trực tiếp bảng đơn qua API', async () => {
    const id = await asUser(staff, (q) => createOrder(q, 50 * M, plan));
    await expect(asUser(owner, (q) => q('update order_payments set paid = true where order_id = $1', [id]))).rejects.toThrow();
    await expect(asUser(owner, (q) => q('delete from interior_orders'))).rejects.toThrow();
  });
});
