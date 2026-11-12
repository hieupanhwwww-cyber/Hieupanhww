import { describe, it, expect, beforeEach } from 'vitest';
import { sql, createUser, asUser, resetDb } from './helpers';

describe('báo cáo (chỉ chủ)', () => {
  let owner: string, staff: string, a: string, b: string;

  async function sellAt(items: { product_id: string; quantity: number }[], discount: number, at: string) {
    const r = await asUser(staff, (q) => q(`select create_sale($1::jsonb, $2, 'cash') as r`, [JSON.stringify(items), discount]));
    await sql('update sales set created_at = $2 where id = $1', [r[0].r.id, at]);
  }

  beforeEach(async () => {
    await resetDb();
    owner = await createUser('owner');
    staff = await createUser('staff');
    const mk = async (code: string, sale: number, cost: number, stock: number, low: number) => {
      const id = (await asUser(owner, (q) => q(`select save_product(null, $1, $2, 'goods', 'cái', $3, $5, $4) as id`, [code, `Hàng ${code}`, sale, cost, low])))[0].id;
      await asUser(owner, (q) => q(`select record_stock($1, 'in', $2, 'Nhập')`, [id, stock]));
      return id as string;
    };
    a = await mk('A', 100_000, 60_000, 20, 2);
    b = await mk('B', 50_000, 20_000, 3, 2);
    // 10/11 giờ VN: 2A, giảm 10k  → doanh thu 190k, vốn 120k, lãi 70k
    await sellAt([{ product_id: a, quantity: 2 }], 10_000, '2026-11-10T03:00:00Z');
    // 23:30 ngày 10/11 giờ VN (16:30 UTC) → vẫn tính ngày 10: 1B → 50k, vốn 20k
    await sellAt([{ product_id: b, quantity: 1 }], 0, '2026-11-10T16:30:00Z');
    // 00:30 ngày 11/11 giờ VN → ngày 11: 1A + 1B → 150k, vốn 80k
    await sellAt([{ product_id: a, quantity: 1 }, { product_id: b, quantity: 1 }], 0, '2026-11-10T17:30:00Z');
  });

  it('doanh thu, giá vốn, lợi nhuận theo ngày giờ Việt Nam', async () => {
    const rows = await asUser(owner, (q) => q(`select period::text, invoices, revenue, cost, profit from report_revenue('2026-11-01', '2026-11-30', 'day') order by period`));
    expect(rows).toEqual([
      { period: '2026-11-10', invoices: 2, revenue: '240000', cost: '140000', profit: '100000' },
      { period: '2026-11-11', invoices: 1, revenue: '150000', cost: '80000', profit: '70000' },
    ]);
  });

  it('gộp theo tháng', async () => {
    const rows = await asUser(owner, (q) => q(`select period::text, invoices, revenue, profit from report_revenue('2026-11-01', '2026-11-30', 'month')`));
    expect(rows).toEqual([{ period: '2026-11-01', invoices: 3, revenue: '390000', profit: '170000' }]);
  });

  it('tiền thu từ đơn nội thất tính theo ngày thu', async () => {
    const id = (await asUser(staff, (q) => q(`select create_order('Anh Nam', '', '', 30000000, '[{"label":"Cọc","amount":10000000},{"label":"Cuối","amount":20000000}]') as id`)))[0].id;
    const [p] = await sql('select id from order_payments where order_id = $1 order by sort limit 1', [id]);
    await asUser(staff, (q) => q(`select set_payment_paid($1, true, '2026-11-11')`, [p.id]));
    const rows = await asUser(owner, (q) => q(`select period::text, order_collected from report_revenue('2026-11-01', '2026-11-30', 'day') order by period`));
    expect(rows).toEqual([{ period: '2026-11-10', order_collected: '0' }, { period: '2026-11-11', order_collected: '10000000' }]);
  });

  it('mặt hàng bán chạy theo số lượng', async () => {
    const rows = await asUser(owner, (q) => q(`select name, quantity, revenue from report_top_products('2026-11-01', '2026-11-30', 10)`));
    expect(rows).toEqual([
      { name: 'Hàng A', quantity: '3', revenue: '300000' },
      { name: 'Hàng B', quantity: '2', revenue: '100000' },
    ]);
  });

  it('hàng sắp hết', async () => {
    const rows = await asUser(owner, (q) => q(`select code, stock from report_low_stock()`));
    expect(rows).toEqual([{ code: 'B', stock: '1' }]);
  });

  it('khách còn nợ chỉ gồm đơn chưa thu đủ', async () => {
    const mk = (name: string) => asUser(staff, (q) => q(`select create_order($1, '', '', 10000000, '[{"label":"Một lần","amount":10000000}]') as id`, [name])).then((r) => r[0].id);
    await mk('Còn nợ');
    const paid = await mk('Đã trả');
    const [p] = await sql('select id from order_payments where order_id = $1', [paid]);
    await asUser(staff, (q) => q(`select set_payment_paid($1, true, current_date)`, [p.id]));
    const rows = await asUser(owner, (q) => q(`select customer_name, remaining from report_order_debts()`));
    expect(rows).toEqual([{ customer_name: 'Còn nợ', remaining: '10000000' }]);
  });

  it('nhân viên gọi báo cáo hoặc xuất dữ liệu đều bị chặn', async () => {
    for (const call of [
      `report_revenue('2026-11-01', '2026-11-30', 'day')`, `report_top_products('2026-11-01', '2026-11-30', 10)`,
      `report_low_stock()`, `report_order_debts()`, `export_all()`,
    ]) {
      await expect(asUser(staff, (q) => q(`select * from ${call}`))).rejects.toThrow(/Chỉ chủ/);
    }
  });

  it('xuất toàn bộ dữ liệu có đủ các bảng và giá vốn', async () => {
    const [r] = await asUser(owner, (q) => q('select export_all() as d'));
    expect(Object.keys(r.d).sort()).toEqual(['don_noi_that', 'dot_thanh_toan', 'hang_hoa', 'hoa_don', 'nguoi_dung', 'phieu_kho', 'dong_hoa_don'].sort());
    expect(r.d.hang_hoa.find((p: { ma: string }) => p.ma === 'A').gia_von).toBe(60000);
    expect(r.d.hoa_don).toHaveLength(3);
  });
});
