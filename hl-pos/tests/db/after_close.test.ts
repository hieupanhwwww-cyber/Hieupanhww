import { describe, it, expect, beforeEach } from 'vitest';
import { sql, createUser, asUser, resetDb, type Q } from './helpers';
import { row, quote, saveDraft, closeOrder, pay } from './orders-helpers';

const totals = async (id: string) => (await sql('select base, changes, total, paid, due from order_totals where order_id = $1', [id]))[0];
const addChange = (q: Q, id: string, sign: number, amount: number, title = 'Thêm kệ sách', reason = 'added') =>
  q(`select add_change($1, $2, $3, $4, $5, '') as id`, [id, sign, title, amount, reason]).then((r) => r[0].id as string);
const sig = { img: 'data:image/png;base64,AAAA', name: 'Chị Hoa', at: '2026-11-20T03:00:00Z', hash: 'ABCDEF0123456789' };

describe('sau khi chốt: bản sửa, phát sinh, nghiệm thu, ghi chú, ảnh', () => {
  let owner: string, staff: string, id: string, rev0: number;
  beforeEach(async () => {
    await resetDb();
    owner = await createUser('owner', 'Hiếu');
    staff = await createUser('staff', 'Lan');
    const a = await asUser(staff, (q) => saveDraft(q, null, quote({ rows: [row('Tủ', 1, 40_000_000)], discount: { type: 'amount', value: 0 } })));
    id = a.order_id;
    await asUser(staff, (q) => closeOrder(q, id, 20_000_000, '2026-11-12'));
    await asUser(staff, (q) => q(`select set_plan_row($1, 'd2', '2026-12-01', false)`, [id]));
    rev0 = (await sql('select rev from orders where id=$1', [id]))[0].rev;
  });

  it('bản sửa: nháp chép từ bản chốt với mã dòng mới, giữ lịch; chốt bản 2 đổi tổng, bản 1 còn nguyên, giữ hạn đợt', async () => {
    const r = await asUser(staff, (q) => q('select revise_order($1) as r', [id]).then((x) => x[0].r));
    expect(r.rev).toBe(rev0 + 1);
    const [d] = await sql('select quote from order_quotes where order_id=$1 and version_no is null', [id]);
    expect(d.quote.rows[0].name).toBe('Tủ');
    expect(d.quote.rows[0].id).not.toBe('r-Tủ');
    expect(r.id_map).toEqual({ 'r-Tủ': d.quote.rows[0].id });
    expect(d.quote.plan.map((p: { id: string }) => p.id)).toEqual(['d1', 'd2', 'd3']);
    await expect(asUser(staff, (q) => q('select revise_order($1)', [id]))).rejects.toThrow(/đang có bản sửa/);
    await asUser(staff, (q) => saveDraft(q, id, { ...d.quote, rows: [...d.quote.rows, row('Kệ', 1, 5_000_000)] }, r.rev));
    expect((await sql('select total from orders where id=$1', [id]))[0].total).toBe('40000000'); // chưa chốt bản 2
    const c = await asUser(owner, (q) => closeOrder(q, id, 0, '2026-11-20'));
    expect(c).toEqual({ version_no: 2, total: 45_000_000 });
    const vs = await sql('select version_no, total from order_quotes where order_id=$1 order by version_no', [id]);
    expect(vs).toEqual([{ version_no: 1, total: '40000000' }, { version_no: 2, total: '45000000' }]);
    const [o] = await sql(`select status, total, plan->1->>'due' as due2 from orders where id=$1`, [id]);
    expect(o).toEqual({ status: 'closed', total: '45000000', due2: '2026-12-01' });
    expect((await sql(`select count(*)::int as n from order_payments where order_id=$1`, [id]))[0].n).toBe(1);
    const log = await sql('select text from order_log where order_id=$1 order by id desc limit 1', [id]);
    expect(log[0].text).toBe('Chốt bản 2 ngày 20/11/2026: 40.000.000 đ → 45.000.000 đ');
  });

  it('không tạo bản sửa cho đơn đang báo giá', async () => {
    const b = await asUser(staff, (q) => saveDraft(q, null, quote()));
    await expect(asUser(staff, (q) => q('select revise_order($1)', [b.order_id]))).rejects.toThrow(/chưa chốt/);
  });

  it('phát sinh: chờ xác nhận chưa tính; xác nhận +2.400.000 thì tổng tăng; hủy thì trả lại', async () => {
    const c = await asUser(staff, (q) => addChange(q, id, 1, 2_400_000));
    expect(await totals(id)).toMatchObject({ changes: '0', total: '40000000' });
    await asUser(staff, (q) => q(`select confirm_change($1, '2026-11-20', $2::jsonb)`, [c, JSON.stringify(sig)]));
    expect(await totals(id)).toMatchObject({ changes: '2400000', total: '42400000', due: '22400000' });
    const [row1] = await sql('select status, confirmed_at::text, sign_rec->>\'hash\' as h, reason from order_changes where id=$1', [c]);
    expect(row1).toEqual({ status: 'confirmed', confirmed_at: '2026-11-20', h: 'ABCDEF0123456789', reason: 'added' });
    await expect(asUser(staff, (q) => q('select cancel_change($1)', [c]))).rejects.toThrow(/Chỉ chủ/);
    await asUser(owner, (q) => q('select cancel_change($1)', [c]));
    expect(await totals(id)).toMatchObject({ changes: '0', total: '40000000' });
  });

  it('phát sinh giảm; dữ liệu sai bị từ chối; đơn chưa chốt không thêm được', async () => {
    const c = await asUser(staff, (q) => addChange(q, id, -1, 1_680_000, 'Bớt 0,4 md tủ bếp trên', 'site'));
    await asUser(staff, (q) => q(`select confirm_change($1, '2026-11-21', null)`, [c]));
    expect(await totals(id)).toMatchObject({ changes: '-1680000', total: '38320000' });
    await expect(asUser(staff, (q) => addChange(q, id, 1, 0))).rejects.toThrow(/lớn hơn 0/);
    await expect(asUser(staff, (q) => addChange(q, id, 1, 1000, ' '))).rejects.toThrow(/nội dung/);
    await expect(asUser(staff, (q) => addChange(q, id, 1, 1000, 'X', 'abc'))).rejects.toThrow(/Lý do/);
    const b = await asUser(staff, (q) => saveDraft(q, null, quote()));
    await expect(asUser(staff, (q) => addChange(q, b.order_id, 1, 1000))).rejects.toThrow(/chưa chốt/);
    await expect(asUser(staff, (q) => q(`select confirm_change($1, '2026-11-21', null)`, [c]))).rejects.toThrow(/đã xác nhận/);
  });

  it('nghiệm thu: tính hạn bảo hành (kẹp cuối tháng), đơn Hoàn thành, có chữ ký', async () => {
    await asUser(staff, (q) => q(`select set_handover($1, '2026-08-31', 6, 'Bàn giao đủ', $2::jsonb)`, [id, JSON.stringify(sig)]));
    const [o] = await sql('select status, handover from orders where id=$1', [id]);
    expect(o.status).toBe('done');
    expect(o.handover).toMatchObject({ date: '2026-08-31', warrantyMonths: 6, warrantyUntil: '2027-02-28', note: 'Bàn giao đủ', sign: { hash: 'ABCDEF0123456789' } });
    await asUser(staff, (q) => q(`select set_handover($1, '2026-11-30', 36, '', null)`, [id]));
    expect((await sql(`select handover->>'warrantyUntil' as w from orders where id=$1`, [id]))[0].w).toBe('2029-11-30');
    const b = await asUser(staff, (q) => saveDraft(q, null, quote()));
    await expect(asUser(staff, (q) => q(`select set_handover($1, '2026-11-30', 36, '', null)`, [b.order_id]))).rejects.toThrow(/chưa chốt/);
  });

  it('ghi chú và ảnh: người viết hoặc chủ mới xóa được; người lạ không đọc được', async () => {
    const n1 = (await asUser(staff, (q) => q(`select add_note($1, 'Khách muốn màu óc chó') as id`, [id])))[0].id;
    const other = await createUser('staff', 'Minh');
    await expect(asUser(other, (q) => q('select delete_note($1)', [n1]))).rejects.toThrow(/người viết/);
    await asUser(owner, (q) => q('select delete_note($1)', [n1]));
    const a1 = (await asUser(staff, (q) => q(`select add_attachment($1, $2, 'tu-ao.jpg', 'install') as id`, [id, `${id}/abc.jpg`])))[0].id;
    await expect(asUser(staff, (q) => q(`select add_attachment($1, 'x/y.jpg', 'a.jpg', 'install')`, [id]))).rejects.toThrow(/Đường dẫn/);
    await expect(asUser(staff, (q) => q(`select add_attachment($1, $2, 'a.jpg', 'xyz')`, [id, `${id}/b.jpg`]))).rejects.toThrow(/Giai đoạn/);
    const [stranger] = await sql(`insert into auth.users (email) values ('la@x.vn') returning id`);
    for (const t of ['order_changes', 'order_notes', 'order_attachments']) expect(await asUser(stranger.id, (q) => q(`select * from ${t}`))).toEqual([]);
    await expect(asUser(other, (q) => q('select delete_attachment($1)', [a1]))).rejects.toThrow(/người viết/);
    const r = await asUser(staff, (q) => q('select delete_attachment($1) as path', [a1]));
    expect(r[0].path).toBe(`${id}/abc.jpg`);
  });

  it('không ghi trực tiếp bảng phát sinh/ghi chú/ảnh qua API', async () => {
    for (const stmt of [`insert into order_changes (order_id, sign, title, amount, reason, status) values ('${id}', 1, 'x', 1, 'other', 'confirmed')`,
      `insert into order_notes (order_id, text) values ('${id}', 'x')`, `insert into order_attachments (order_id, path, name, stage) values ('${id}', 'x', 'x', 'other')`]) {
      await expect(asUser(owner, (q) => q(stmt))).rejects.toThrow();
    }
  });

  it('tiền khách trả vẫn tính đúng sau bản sửa giảm giá trị', async () => {
    const r = await asUser(staff, (q) => q('select revise_order($1) as r', [id]).then((x) => x[0].r));
    const [d] = await sql('select quote from order_quotes where order_id=$1 and version_no is null', [id]);
    await asUser(staff, (q) => saveDraft(q, id, { ...d.quote, rows: [{ ...d.quote.rows[0], price: 15_000_000 }] }, r.rev));
    await asUser(staff, (q) => closeOrder(q, id));
    await asUser(staff, (q) => pay(q, id, 1));
    expect(await totals(id)).toMatchObject({ total: '15000000', paid: '20000001', due: '0' });
  });
});
