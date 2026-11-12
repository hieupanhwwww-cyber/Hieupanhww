import { describe, it, expect, beforeEach } from 'vitest';
import { sql, createUser, asUser, asAnon, resetDb } from './helpers';

import { row, quote, saveDraft, closeOrder, pay } from './orders-helpers';
import { orderMoney, type Order, type Quote } from '../../src/lib/orderMoney';
const totals = async (id: string) => (await sql('select base, changes, total, paid, due, over from order_totals where order_id = $1', [id]))[0];

describe('đơn nội thất kiểu mới', () => {
  let owner: string, staff: string, prefix: string;
  beforeEach(async () => {
    await resetDb();
    owner = await createUser('owner', 'Hiếu');
    staff = await createUser('staff', 'Lan');
    prefix = (await sql(`select 'BG' || to_char(vn_today(), 'YYMM') || '-' as p`))[0].p;
  });

  it('tạo nháp cấp mã BG<yy><mm>-01, đơn thứ hai -02', async () => {
    const a = await asUser(staff, (q) => saveDraft(q, null, quote()));
    const b = await asUser(staff, (q) => saveDraft(q, null, quote()));
    expect([a.code, b.code]).toEqual([prefix + '01', prefix + '02']);
    expect(a.rev).toBe(1);
    const [o] = await sql('select status, customer_name, customer_phone, project, total from orders where id = $1', [a.order_id]);
    expect(o).toEqual({ status: 'quote', customer_name: 'Chị Hoa', customer_phone: '0912 345 678', project: 'Phòng ngủ master', total: '4500000' });
  });

  it('tiền tố mã đơn lấy theo Cài đặt', async () => {
    await sql(`update store_settings set code_prefix = 'HL'`);
    const a = await asUser(staff, (q) => saveDraft(q, null, quote()));
    expect(a.code).toMatch(/^HL\d{4}-01$/);
    await sql(`update store_settings set code_prefix = 'BG'`);
  });

  it('lưu nháp tự tạo khách theo SĐT; lưu lại hoặc đơn khác cùng SĐT không tạo trùng', async () => {
    const a = await asUser(staff, (q) => saveDraft(q, null, quote()));
    await asUser(staff, (q) => saveDraft(q, a.order_id, quote({ customer: { name: 'Chị Hoa (Thư Lâm)', phone: '0912345678', address: 'Số 5' } }), 1));
    await asUser(staff, (q) => saveDraft(q, null, quote({ customer: { name: 'Hoa', phone: '0912.345.678', address: '' } })));
    const cs = await sql('select name, address from customers');
    expect(cs).toHaveLength(1);
    expect(cs[0].name).toBe('Hoa');
    expect(cs[0].address).toBe('Số 5');
  });

  it('lưu với rev cũ bị từ chối, yêu cầu tải lại', async () => {
    const a = await asUser(staff, (q) => saveDraft(q, null, quote()));
    const b = await asUser(owner, (q) => saveDraft(q, a.order_id, quote({ project: 'Sửa bởi chủ' }), 1));
    expect(b.rev).toBe(2);
    await expect(asUser(staff, (q) => saveDraft(q, a.order_id, quote({ project: 'Sửa bởi NV' }), 1))).rejects.toThrow(/người khác sửa/);
    expect((await sql('select project from orders where id=$1', [a.order_id]))[0].project).toBe('Sửa bởi chủ');
  });

  it('quote_totals: giảm %, giảm tiền bị kẹp về tạm tính, % ngoài 0–100 bị kẹp', async () => {
    const t = async (qt: object) => (await sql('select sub, disc, total from quote_totals($1::jsonb)', [JSON.stringify(qt)]))[0];
    expect(await t(quote())).toEqual({ sub: '5000000', disc: '500000', total: '4500000' });
    expect(await t(quote({ discount: { type: 'amount', value: 6_000_000 } }))).toEqual({ sub: '5000000', disc: '5000000', total: '0' });
    expect(await t(quote({ discount: { type: 'percent', value: 150 } }))).toEqual({ sub: '5000000', disc: '5000000', total: '0' });
    expect(await t(quote({ rows: [row('Lẻ', 0.333, 1000)], discount: { type: 'amount', value: 0 } }))).toEqual({ sub: '333', disc: '0', total: '333' });
  });

  it('dữ liệu báo giá sai bị từ chối', async () => {
    await expect(asUser(staff, (q) => saveDraft(q, null, quote({ customer: { name: ' ', phone: '', address: '' } })))).rejects.toThrow(/tên khách/i);
    await expect(asUser(staff, (q) => saveDraft(q, null, quote({ rows: [row('X', 1, 1, { unit: 'kg' })] })))).rejects.toThrow(/Đơn vị/);
    await expect(asUser(staff, (q) => saveDraft(q, null, quote({ rows: [row('X', -1, 1)] })))).rejects.toThrow(/Số lượng|đơn giá/i);
    await expect(asUser(staff, (q) => saveDraft(q, null, quote({ plan: [{ id: 'a', label: 'x', pct: 10, trigger: 'khi-nao-do' }] })))).rejects.toThrow(/Mốc/);
  });

  it('chốt: khóa bản 1, tổng do máy chủ tính, cọc thành phiếu thu số 1, lịch chép sang đơn', async () => {
    const fake = { ...quote(), total: 1, sub: 1 };
    const a = await asUser(staff, (q) => saveDraft(q, null, fake));
    const r = await asUser(staff, (q) => closeOrder(q, a.order_id, 2_250_000));
    expect(r).toEqual({ version_no: 1, total: 4500000 });
    const [o] = await sql('select status, closed_at::text, total, jsonb_array_length(plan) as n from orders where id=$1', [a.order_id]);
    expect(o).toEqual({ status: 'closed', closed_at: '2026-11-12', total: '4500000', n: 3 });
    const [v] = await sql('select version_no, sub, disc, total, closed_at::text from order_quotes where order_id=$1', [a.order_id]);
    expect(v).toEqual({ version_no: 1, sub: '5000000', disc: '500000', total: '4500000', closed_at: '2026-11-12' });
    const ps = await sql('select no, amount, method, deposit, note, created_by from order_payments where order_id=$1', [a.order_id]);
    expect(ps).toEqual([{ no: 1, amount: '2250000', method: 'transfer', deposit: true, note: 'Đặt cọc khi chốt đơn', created_by: staff }]);
  });

  it('chốt bỏ dòng trống; báo giá không có hạng mục hoặc lịch làm đợt cuối ≤ 0 bị từ chối', async () => {
    const a = await asUser(staff, (q) => saveDraft(q, null, quote({ rows: [row('', 0, 0), row('Tủ', 1, 1_000_000)], discount: { type: 'amount', value: 0 } })));
    await asUser(staff, (q) => closeOrder(q, a.order_id));
    expect((await sql(`select jsonb_array_length(quote->'rows') as n from order_quotes where order_id=$1`, [a.order_id]))[0].n).toBe(1);
    const b = await asUser(staff, (q) => saveDraft(q, null, quote({ rows: [row('', 0, 0)] })));
    await expect(asUser(staff, (q) => closeOrder(q, b.order_id))).rejects.toThrow(/chưa có hạng mục/);
    const over = [{ id: 'a', label: 'Cọc', pct: 60, trigger: 'sign' }, { id: 'b', label: 'Giữa', pct: 40, trigger: 'date' }, { id: 'c', label: 'Cuối', pct: 0, trigger: 'accept' }];
    const c = await asUser(staff, (q) => saveDraft(q, null, quote({ plan: over })));
    await expect(asUser(staff, (q) => closeOrder(q, c.order_id))).rejects.toThrow(/chiếm hết giá trị/);
    expect((await sql('select status from orders where id=$1', [c.order_id]))[0].status).toBe('quote');
  });

  it('sau khi chốt: không lưu nháp đè, không sửa trực tiếp các bảng', async () => {
    const a = await asUser(staff, (q) => saveDraft(q, null, quote()));
    await asUser(staff, (q) => closeOrder(q, a.order_id));
    const rev = (await sql('select rev from orders where id=$1', [a.order_id]))[0].rev;
    await expect(asUser(staff, (q) => saveDraft(q, a.order_id, quote({ project: 'đè' }), rev))).rejects.toThrow(/đã chốt/i);
    for (const stmt of [`update order_quotes set total = 1`, `update orders set total = 1`, `delete from order_payments`, `insert into order_payments (order_id, no, amount, date, method) values ('${a.order_id}', 9, 1, current_date, 'cash')`, `update customers set name = 'x'`]) {
      await expect(asUser(owner, (q) => q(stmt))).rejects.toThrow();
    }
  });

  it('thu tiền đánh số 1,2,3; chủ xóa phiếu 2 thì phiếu mới là 4; nhân viên không xóa được', async () => {
    const a = await asUser(staff, (q) => saveDraft(q, null, quote()));
    await expect(asUser(staff, (q) => pay(q, a.order_id, 100_000))).rejects.toThrow(/chưa chốt/);
    await asUser(staff, (q) => closeOrder(q, a.order_id));
    const nos = [];
    for (const amt of [1_000_000, 500_000, 200_000]) nos.push((await asUser(staff, (q) => pay(q, a.order_id, amt))).no);
    expect(nos).toEqual([1, 2, 3]);
    const [p2] = await sql('select id from order_payments where order_id=$1 and no=2', [a.order_id]);
    await expect(asUser(staff, (q) => q('select delete_payment($1)', [p2.id]))).rejects.toThrow(/Chỉ chủ/);
    await asUser(owner, (q) => q('select delete_payment($1)', [p2.id]));
    expect((await asUser(staff, (q) => pay(q, a.order_id, 50_000))).no).toBe(4);
    await expect(asUser(staff, (q) => pay(q, a.order_id, 0))).rejects.toThrow(/lớn hơn 0/);
  });

  it('hai người thu tiền cùng lúc: hai số phiếu khác nhau; hai người tạo đơn cùng lúc: hai mã khác nhau', async () => {
    const a = await asUser(staff, (q) => saveDraft(q, null, quote()));
    await asUser(staff, (q) => closeOrder(q, a.order_id));
    const ps = await Promise.all([asUser(staff, (q) => pay(q, a.order_id, 1000)), asUser(owner, (q) => pay(q, a.order_id, 2000))]);
    expect(new Set(ps.map((p) => p.no))).toEqual(new Set([1, 2]));
    const os = await Promise.all([asUser(staff, (q) => saveDraft(q, null, quote())), asUser(owner, (q) => saveDraft(q, null, quote()))]);
    expect(new Set(os.map((o) => o.code)).size).toBe(2);
  });

  it('order_totals: đơn nháp chưa có gì phải thu; đã chốt còn nợ; trả thừa', async () => {
    const a = await asUser(staff, (q) => saveDraft(q, null, quote()));
    expect(await totals(a.order_id)).toEqual({ base: '4500000', changes: '0', total: '4500000', paid: '0', due: '0', over: '0' });
    await asUser(staff, (q) => closeOrder(q, a.order_id, 2_000_000));
    expect(await totals(a.order_id)).toMatchObject({ paid: '2000000', due: '2500000', over: '0' });
    await asUser(staff, (q) => pay(q, a.order_id, 3_000_000));
    expect(await totals(a.order_id)).toMatchObject({ paid: '5000000', due: '0', over: '500000' });
  });

  it('đổi trạng thái: chỉ đơn đã chốt, không quay về Đang báo giá', async () => {
    const a = await asUser(staff, (q) => saveDraft(q, null, quote()));
    await expect(asUser(staff, (q) => q(`select set_order_status($1, 'building')`, [a.order_id]))).rejects.toThrow(/chưa chốt/);
    await asUser(staff, (q) => closeOrder(q, a.order_id));
    await asUser(staff, (q) => q(`select set_order_status($1, 'building')`, [a.order_id]));
    expect((await sql('select status from orders where id=$1', [a.order_id]))[0].status).toBe('building');
    await expect(asUser(staff, (q) => q(`select set_order_status($1, 'quote')`, [a.order_id]))).rejects.toThrow();
    await expect(asUser(staff, (q) => q(`select set_order_status($1, 'xyz')`, [a.order_id]))).rejects.toThrow();
  });

  it('đặt hạn và đánh dấu đã tới mốc cho một đợt; hẹn ngày gọi lại', async () => {
    const a = await asUser(staff, (q) => saveDraft(q, null, quote()));
    await asUser(staff, (q) => q(`select set_follow_at($1, '2026-11-20')`, [a.order_id]));
    expect((await sql('select follow_at::text from orders where id=$1', [a.order_id]))[0].follow_at).toBe('2026-11-20');
    await asUser(staff, (q) => closeOrder(q, a.order_id));
    await asUser(staff, (q) => q(`select set_plan_row($1, 'd2', '2026-12-01', true)`, [a.order_id]));
    const [o] = await sql(`select plan->1 as d2, plan->0 as d1 from orders where id=$1`, [a.order_id]);
    expect(o.d2).toMatchObject({ id: 'd2', due: '2026-12-01', reached: true, pct: 40 });
    expect(o.d1.due ?? '').toBe('');
  });

  it('đơn không chia đợt: đặt ngày hẹn trả cho khoản duy nhất', async () => {
    const a = await asUser(staff, (q) => saveDraft(q, null, quote({ plan: [] })));
    await asUser(staff, (q) => closeOrder(q, a.order_id));
    await asUser(staff, (q) => q(`select set_plan_row($1, 'all', '2026-12-15', false)`, [a.order_id]));
    expect((await sql('select pay_due::text from orders where id=$1', [a.order_id]))[0].pay_due).toBe('2026-12-15');
  });

  it('số của máy chủ (order_totals) khớp orderMoney trên trình duyệt', async () => {
    const cases: { qt: object; deposit: number; pays: number[] }[] = [
      { qt: quote(), deposit: 2_250_000, pays: [1_000_000] },
      { qt: quote({ rows: [row('A', 2.88, 1_850_000), row('B', 3, 333_333)], discount: { type: 'amount', value: 123_456 } }), deposit: 0, pays: [] },
      { qt: quote({ rows: [row('C', 1, 10_000_000)], discount: { type: 'percent', value: 7.5 }, plan: [] }), deposit: 5_000_000, pays: [6_000_000] },
    ];
    for (const c of cases) {
      const a = await asUser(staff, (q) => saveDraft(q, null, c.qt));
      await asUser(staff, (q) => closeOrder(q, a.order_id, c.deposit));
      for (const p of c.pays) await asUser(staff, (q) => pay(q, a.order_id, p));
      const [o] = await sql('select status, plan from orders where id=$1', [a.order_id]);
      const vs = await sql('select version_no, quote, sub, disc, total, closed_at::text from order_quotes where order_id=$1 order by version_no', [a.order_id]);
      const ps = await sql('select id, no, amount, date::text, method, note, deposit from order_payments where order_id=$1 order by no', [a.order_id]);
      const order: Order = { id: a.order_id, code: a.code, status: o.status, draft: null, plan: o.plan, payDue: '', closedAt: '2026-11-12', handover: null, changes: [],
        versions: vs.map((v) => ({ no: v.version_no, quote: v.quote as Quote, sub: Number(v.sub), disc: Number(v.disc), total: Number(v.total), closedAt: v.closed_at, sign: null })),
        payments: ps.map((p) => ({ ...p, amount: Number(p.amount) })) as Order['payments'] };
      const m = orderMoney(order, { today: '2026-11-12' });
      const t = await totals(a.order_id);
      expect({ total: Number(t.total), paid: Number(t.paid), due: Number(t.due), over: Number(t.over) }).toEqual({ total: m.total, paid: m.paid, due: m.due, over: m.over });
      expect(m.rows.reduce((s2, r) => s2 + r.amount, 0)).toBe(Math.max(0, m.total));
    }
  });

  it('xóa đơn: chỉ chủ, chỉ đơn đang báo giá chưa có phiếu thu', async () => {
    const a = await asUser(staff, (q) => saveDraft(q, null, quote()));
    await expect(asUser(staff, (q) => q('select delete_order($1)', [a.order_id]))).rejects.toThrow(/Chỉ chủ/);
    await asUser(owner, (q) => q('select delete_order($1)', [a.order_id]));
    expect(await sql('select 1 from orders')).toEqual([]);
    const b = await asUser(staff, (q) => saveDraft(q, null, quote()));
    await asUser(staff, (q) => closeOrder(q, b.order_id));
    await expect(asUser(owner, (q) => q('select delete_order($1)', [b.order_id]))).rejects.toThrow(/đang báo giá/);
  });

  it('người lạ và khách vãng lai không đọc, không ghi được gì', async () => {
    const a = await asUser(staff, (q) => saveDraft(q, null, quote()));
    await asUser(staff, (q) => closeOrder(q, a.order_id, 1000));
    const [stranger] = await sql(`insert into auth.users (email) values ('la@x.vn') returning id`);
    for (const t of ['orders', 'order_quotes', 'order_payments', 'customers', 'order_log', 'order_totals']) {
      expect(await asUser(stranger.id, (q) => q(`select * from ${t}`))).toEqual([]);
      await expect(asAnon((q) => q(`select * from ${t}`))).rejects.toThrow();
    }
    await expect(asUser(stranger.id, (q) => saveDraft(q, null, quote()))).rejects.toThrow(/không có quyền/);
    await expect(asUser(stranger.id, (q) => pay(q, a.order_id, 1000))).rejects.toThrow(/không có quyền/);
  });

  it('vật tư đã dùng: trừ kho, phiếu gắn đơn; chỉ cho đơn đã chốt', async () => {
    const mdf = (await asUser(owner, (q) => q(`select save_product(null, 'MDF17', 'Ván MDF 17mm', 'material', 'tấm', 450000, 5, 300000) as id`)))[0].id;
    await asUser(owner, (q) => q(`select record_stock($1, 'in', 20, 'Nhập')`, [mdf]));
    const a = await asUser(staff, (q) => saveDraft(q, null, quote()));
    await expect(asUser(staff, (q) => q(`select add_order_material($1, $2, 5)`, [a.order_id, mdf]))).rejects.toThrow(/chưa chốt/);
    await asUser(staff, (q) => closeOrder(q, a.order_id));
    await asUser(staff, (q) => q(`select add_order_material($1, $2, 5)`, [a.order_id, mdf]));
    expect(Number((await sql('select stock from product_stock where product_id=$1', [mdf]))[0].stock)).toBe(15);
    const [m] = await sql(`select order_id, reason from stock_movements where type = 'out'`);
    expect(m).toEqual({ order_id: a.order_id, reason: `Vật tư đơn ${a.code}` });
  });

  it('nhật ký ghi tạo báo giá, chốt đơn, thu tiền kèm người làm', async () => {
    const a = await asUser(staff, (q) => saveDraft(q, null, quote()));
    await asUser(owner, (q) => closeOrder(q, a.order_id, 1_000_000));
    await asUser(staff, (q) => pay(q, a.order_id, 500_000));
    const log = await sql('select text, by from order_log where order_id=$1 order by at, id', [a.order_id]);
    expect(log.map((l) => l.by)).toEqual([staff, owner, owner, staff]);
    expect(log[1].text).toMatch(/Chốt đơn ngày 12\/11\/2026: 4\.500\.000 đ/);
    expect(log[2].text).toMatch(/đặt cọc 1\.000\.000 đ/i);
    expect(log[3].text).toMatch(/Thu 500\.000 đ/);
  });

  it('xóa tài khoản nhân viên đã bán hàng/thu tiền: chứng từ còn nguyên, tên người làm để trống', async () => {
    const p = (await asUser(owner, (q) => q(`select save_product(null, 'A', 'A', 'goods', 'cái', 1000, 0, 500) as id`)))[0].id;
    await asUser(owner, (q) => q(`select record_stock($1, 'in', 5, 'Nhập')`, [p]));
    await asUser(staff, (q) => q(`select create_sale($1::jsonb, 0, 'cash')`, [JSON.stringify([{ product_id: p, quantity: 1 }])]));
    const a = await asUser(staff, (q) => saveDraft(q, null, quote()));
    await asUser(staff, (q) => closeOrder(q, a.order_id, 1000));
    await sql('delete from auth.users where id = $1', [staff]);
    expect((await sql('select created_by from sales'))[0].created_by).toBeNull();
    expect((await sql('select created_by from order_payments'))[0].created_by).toBeNull();
    expect((await sql('select count(*)::int as n from orders'))[0].n).toBe(1);
  });
});
