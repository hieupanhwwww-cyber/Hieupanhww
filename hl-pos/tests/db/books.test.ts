import { describe, it, expect, beforeEach } from 'vitest';
import { sql, createUser, asUser, resetDb, type Q } from './helpers';
import { row, quote, saveDraft, closeOrder } from './orders-helpers';

const saveCat = (q: Q, name: string, price: number, cost: number | null, id: string | null = null) =>
  q(`select save_catalog_item($1, $2, 'MDF', 'bộ', $3, $4) as id`, [id, name, price, cost]).then((r) => r[0].id as string);
const cash = (q: Q, a: { id?: string | null; type?: string; date: string; amount: number; cat?: string; order?: string | null; confirm?: boolean }) =>
  q(`select save_cash_entry($1, $2, $3, $4, $5, '', 'cash', $6, $7) as id`, [a.id ?? null, a.type ?? 'out', a.date, a.amount, a.cat ?? 'Vật tư, ván', a.order ?? null, a.confirm ?? false]).then((r) => r[0].id as string);

describe('sổ sách: danh mục, giá nhập, sổ thu chi, chốt sổ', () => {
  let owner: string, staff: string;
  beforeEach(async () => {
    await resetDb();
    owner = await createUser('owner', 'Hiếu');
    staff = await createUser('staff', 'Lan');
  });

  it('danh mục: ai cũng xem; chỉ chủ sửa và xem giá nhập; tên không trùng (không phân biệt hoa thường)', async () => {
    const k = await asUser(owner, (q) => saveCat(q, 'Tủ áo cánh lùa', 3_500_000, 2_200_000));
    expect(await asUser(staff, (q) => q('select name, unit, price from catalog'))).toEqual([{ name: 'Tủ áo cánh lùa', unit: 'bộ', price: '3500000' }]);
    expect(await asUser(staff, (q) => q('select * from catalog_costs'))).toEqual([]);
    expect((await asUser(owner, (q) => q('select cost from catalog_costs where catalog_id=$1', [k])))[0].cost).toBe('2200000');
    await expect(asUser(staff, (q) => saveCat(q, 'Kệ', 1, 1))).rejects.toThrow(/Chỉ chủ/);
    await expect(asUser(owner, (q) => saveCat(q, 'TỦ ÁO CÁNH LÙA', 1, null))).rejects.toThrow();
    await asUser(owner, (q) => saveCat(q, 'Tủ áo cánh lùa 2m', 3_800_000, null, k));
    expect((await sql('select name, price from catalog'))[0]).toEqual({ name: 'Tủ áo cánh lùa 2m', price: '3800000' });
    expect((await sql('select cost from catalog_costs'))[0].cost).toBe('2200000');
    await expect(asUser(staff, (q) => q('select delete_catalog_item($1)', [k]))).rejects.toThrow(/Chỉ chủ/);
    await asUser(owner, (q) => q('select delete_catalog_item($1)', [k]));
    expect(await sql('select * from catalog')).toEqual([]);
  });

  it('khi chốt: giá nhập danh mục được chụp vào đơn; đổi danh mục sau đó không đổi lãi đơn cũ; giá nhập nhập riêng cho đơn được giữ', async () => {
    const k = await asUser(owner, (q) => saveCat(q, 'Tủ áo', 3_000_000, 2_000_000));
    await asUser(owner, (q) => saveCat(q, 'Giường', 5_000_000, 3_500_000));
    const a = await asUser(staff, (q) => saveDraft(q, null, quote({ rows: [row('tủ áo', 1, 3_000_000), row('Giường', 1, 5_000_000), row('Lạ', 1, 100)] })));
    await asUser(owner, (q) => q(`select save_order_costs($1, '{"r-Giường": 3000000}'::jsonb, '{}'::jsonb, 200000)`, [a.order_id]));
    await asUser(staff, (q) => closeOrder(q, a.order_id));
    await asUser(owner, (q) => saveCat(q, 'Tủ áo', 3_000_000, 9_999_999, k));
    const [c] = await asUser(owner, (q) => q('select rows, ship from order_costs where order_id=$1', [a.order_id]));
    expect(c).toEqual({ rows: { 'r-tủ áo': 2_000_000, 'r-Giường': 3_000_000 }, ship: '200000' });
    expect(await asUser(staff, (q) => q('select * from order_costs'))).toEqual([]);
    await expect(asUser(staff, (q) => q(`select save_order_costs($1, '{}'::jsonb, '{}'::jsonb, 0)`, [a.order_id]))).rejects.toThrow(/Chỉ chủ/);
  });

  it('phiếu kho ghi lại giá vốn lúc xuất/nhập; đổi giá vốn sau đó không đổi', async () => {
    const p = (await asUser(owner, (q) => q(`select save_product(null, 'MDF17', 'Ván MDF', 'material', 'tấm', 450000, 0, 300000) as id`)))[0].id;
    await asUser(owner, (q) => q(`select record_stock($1, 'in', 10, 'Nhập')`, [p]));
    const a = await asUser(staff, (q) => saveDraft(q, null, quote()));
    await asUser(staff, (q) => closeOrder(q, a.order_id));
    await asUser(staff, (q) => q(`select add_order_material($1, $2, 3)`, [a.order_id, p]));
    await asUser(owner, (q) => q(`select save_product($1, 'MDF17', 'Ván MDF', 'material', 'tấm', 450000, 0, 350000)`, [p]));
    const rows = await sql(`select m.type, c.unit_cost from stock_movements m join stock_movement_costs c on c.movement_id = m.id order by m.type`);
    expect(rows).toEqual([{ type: 'in', unit_cost: '300000' }, { type: 'out', unit_cost: '300000' }]);
    expect(await asUser(staff, (q) => q('select * from stock_movement_costs'))).toEqual([]);
  });

  it('sổ thu chi: chỉ chủ; dữ liệu sai bị từ chối; gắn được vào đơn', async () => {
    const a = await asUser(staff, (q) => saveDraft(q, null, quote()));
    await expect(asUser(staff, (q) => cash(q, { date: '2026-11-05', amount: 100 }))).rejects.toThrow(/Chỉ chủ/);
    const e = await asUser(owner, (q) => cash(q, { date: '2026-11-05', amount: 1_500_000, order: a.order_id }));
    expect((await sql('select type, amount, cat, order_id from cash_entries where id=$1', [e]))[0]).toEqual({ type: 'out', amount: '1500000', cat: 'Vật tư, ván', order_id: a.order_id });
    await expect(asUser(owner, (q) => cash(q, { date: '2026-11-05', amount: 0 }))).rejects.toThrow(/lớn hơn 0/);
    await expect(asUser(owner, (q) => cash(q, { type: 'x', date: '2026-11-05', amount: 1 }))).rejects.toThrow(/Loại/);
    await expect(asUser(owner, (q) => cash(q, { date: '2026-11-05', amount: 1, cat: ' ' }))).rejects.toThrow(/nhóm/);
    expect(await asUser(staff, (q) => q('select * from cash_entries'))).toEqual([]);
  });

  it('chốt sổ tháng: sửa/xóa khoản trong tháng đã chốt phải xác nhận; mở lại sổ thì thôi', async () => {
    const e = await asUser(owner, (q) => cash(q, { date: '2026-10-20', amount: 1_000_000 }));
    await expect(asUser(staff, (q) => q(`select close_book('2026-10', 5000000, 1000000)`))).rejects.toThrow(/Chỉ chủ/);
    await asUser(owner, (q) => q(`select close_book('2026-10', 5000000, 1000000)`));
    expect((await sql('select month, in_total, out_total, closed_by from books'))[0]).toEqual({ month: '2026-10', in_total: '5000000', out_total: '1000000', closed_by: owner });
    await expect(asUser(owner, (q) => cash(q, { date: '2026-10-25', amount: 1 }))).rejects.toThrow(/đã chốt sổ/);
    await expect(asUser(owner, (q) => cash(q, { id: e, date: '2026-11-02', amount: 1_000_000 }))).rejects.toThrow(/đã chốt sổ/);
    await expect(asUser(owner, (q) => q(`select delete_cash_entry($1, false)`, [e]))).rejects.toThrow(/đã chốt sổ/);
    await asUser(owner, (q) => cash(q, { id: e, date: '2026-10-20', amount: 1_200_000, confirm: true }));
    expect((await sql('select amount from cash_entries where id=$1', [e]))[0].amount).toBe('1200000');
    await asUser(owner, (q) => q(`select reopen_book('2026-10')`));
    await asUser(owner, (q) => q(`select delete_cash_entry($1, false)`, [e]));
    expect(await sql('select * from cash_entries')).toEqual([]);
    await expect(asUser(owner, (q) => q(`select close_book('2026-13', 0, 0)`))).rejects.toThrow(/Tháng/);
  });

  it('ledger_data: sổ quỹ gồm khoản thu chi, phiếu thu khách, bán lẻ theo ngày giờ Việt Nam; chỉ chủ', async () => {
    const p = (await asUser(owner, (q) => q(`select save_product(null, 'A', 'A', 'goods', 'cái', 100000, 0, 60000) as id`)))[0].id;
    await asUser(owner, (q) => q(`select record_stock($1, 'in', 10, 'Nhập')`, [p]));
    const s = await asUser(staff, (q) => q(`select create_sale($1::jsonb, 0, 'cash') as r`, [JSON.stringify([{ product_id: p, quantity: 2 }])]));
    await sql(`update sales set created_at = '2026-11-10T17:30:00Z' where id = $1`, [s[0].r.id]); // 00:30 ngày 11/11 giờ VN
    const a = await asUser(staff, (q) => saveDraft(q, null, quote()));
    await asUser(staff, (q) => closeOrder(q, a.order_id, 2_000_000, '2026-11-12'));
    await asUser(owner, (q) => cash(q, { type: 'in', date: '2026-11-03', amount: 50_000, cat: 'Bán phế liệu' }));
    await sql(`update store_settings set cash_start_date = '2026-11-01', cash_start_amount = 10000000`);
    await expect(asUser(staff, (q) => q('select ledger_data()'))).rejects.toThrow(/Chỉ chủ/);
    const [{ d }] = await asUser(owner, (q) => q('select ledger_data() as d'));
    expect(d.retail).toEqual([{ date: '2026-11-11', amount: 200000 }]);
    expect(d.payments).toEqual([expect.objectContaining({ date: '2026-11-12', amount: 2_000_000, order_id: a.order_id, method: 'transfer' })]);
    expect(d.cash).toEqual([expect.objectContaining({ type: 'in', date: '2026-11-03', amount: 50_000, cat: 'Bán phế liệu' })]);
    expect(d.start).toEqual({ date: '2026-11-01', amount: 10_000_000 });
    await sql(`update store_settings set cash_start_date = null, cash_start_amount = 0`);
  });

  it('orders_for_books: đơn đã chốt kèm bản, phát sinh đã xác nhận, chi gắn đơn, vật tư xuất kho theo giá vốn; chỉ chủ', async () => {
    const p = (await asUser(owner, (q) => q(`select save_product(null, 'MDF', 'MDF', 'material', 'tấm', 0, 0, 300000) as id`)))[0].id;
    await asUser(owner, (q) => q(`select record_stock($1, 'in', 10, 'Nhập')`, [p]));
    const a = await asUser(staff, (q) => saveDraft(q, null, quote({ rows: [row('Tủ', 1, 40_000_000)], discount: { type: 'amount', value: 0 } })));
    await asUser(staff, (q) => closeOrder(q, a.order_id, 0, '2026-10-30'));
    await asUser(staff, (q) => saveDraft(q, null, quote()));
    await asUser(staff, (q) => q(`select add_order_material($1, $2, 4)`, [a.order_id, p]));
    await asUser(owner, (q) => cash(q, { date: '2026-11-02', amount: 3_000_000, cat: 'Nhân công, thợ', order: a.order_id }));
    const c1 = (await asUser(staff, (q) => q(`select add_change($1, 1, 'Kệ', 2000000, 'added', '') as id`, [a.order_id])))[0].id;
    await asUser(staff, (q) => q(`select confirm_change($1, '2026-11-15', null)`, [c1]));
    await asUser(staff, (q) => q(`select add_change($1, 1, 'Chờ', 9000000, 'added', '')`, [a.order_id]));
    await expect(asUser(staff, (q) => q('select orders_for_books()'))).rejects.toThrow(/Chỉ chủ/);
    const [{ d }] = await asUser(owner, (q) => q('select orders_for_books() as d'));
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ id: a.order_id, code: a.code, status: 'closed', spend: 3_000_000, stock_cost: 1_200_000,
      versions: [{ no: 1, total: 40_000_000, closedAt: '2026-10-30' }], changes: [expect.objectContaining({ sign: 1, amount: 2_000_000, confirmedAt: '2026-11-15' })] });
    expect(d[0].rows).toEqual([expect.objectContaining({ id: 'r-Tủ', name: 'Tủ', qty: 1 })]);
  });
});
