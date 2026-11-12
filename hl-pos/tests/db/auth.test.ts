import { describe, it, expect, beforeEach } from 'vitest';
import { sql, createUser, asUser, asAnon } from './helpers';
import { resetDb } from './helpers';

describe('tài khoản và vai trò', () => {
  beforeEach(resetDb);

  it('tài khoản do chủ tạo thì có hồ sơ vai trò nhân viên', async () => {
    const [u] = await sql(`insert into auth.users (email, raw_user_meta_data, raw_app_meta_data) values ('a@x.vn', '{"full_name":"Lan"}', '{"hl_staff":true}') returning id`);
    const [p] = await sql('select role, full_name from profiles where id = $1', [u.id]);
    expect(p).toEqual({ role: 'staff', full_name: 'Lan' });
  });

  it('nhân viên không tự nâng mình lên chủ', async () => {
    const staff = await createUser('staff');
    await asUser(staff, (q) => q(`update profiles set role = 'owner' where id = $1`, [staff]));
    const [p] = await sql('select role from profiles where id = $1', [staff]);
    expect(p.role).toBe('staff');
  });

  it('chủ đổi được vai trò nhân viên', async () => {
    const owner = await createUser('owner');
    const staff = await createUser('staff');
    await asUser(owner, (q) => q(`update profiles set role = 'owner' where id = $1`, [staff]));
    const [p] = await sql('select role from profiles where id = $1', [staff]);
    expect(p.role).toBe('owner');
  });

  it('is_owner() đúng theo vai trò', async () => {
    const owner = await createUser('owner');
    const staff = await createUser('staff');
    expect((await asUser(owner, (q) => q('select is_owner() as v')))[0].v).toBe(true);
    expect((await asUser(staff, (q) => q('select is_owner() as v')))[0].v).toBe(false);
  });

  it('khách chưa đăng nhập không đọc được hồ sơ và thông tin cửa hàng', async () => {
    await createUser('owner');
    await expect(asAnon((q) => q('select * from profiles'))).rejects.toThrow();
    await expect(asAnon((q) => q('select * from store_settings'))).rejects.toThrow();
  });

  it('thông tin cửa hàng: ai cũng đọc được, chỉ chủ sửa được', async () => {
    const owner = await createUser('owner');
    const staff = await createUser('staff');
    const [s] = await asUser(staff, (q) => q('select name, address, phone from store_settings'));
    expect(s).toEqual({
      name: 'Nội Thất Hùng Loan',
      address: 'Làng nghề Hà Lâm 1 – Thư Lâm – Hà Nội',
      phone: '0916.771.586 – 0961.761.868',
    });
    await asUser(staff, (q) => q(`update store_settings set name = 'X'`));
    expect((await sql('select name from store_settings'))[0].name).toBe('Nội Thất Hùng Loan');
    await asUser(owner, (q) => q(`update store_settings set note = 'Cảm ơn quý khách'`));
    expect((await sql('select note from store_settings'))[0].note).toBe('Cảm ơn quý khách');
    await sql(`update store_settings set note = null`);
  });

  it('không ai thêm hồ sơ trực tiếp qua API', async () => {
    const owner = await createUser('owner');
    await expect(asUser(owner, (q) => q(`insert into profiles (id, role) values (gen_random_uuid(), 'owner')`))).rejects.toThrow();
  });

  it('tài khoản người lạ tự đăng ký (không do chủ tạo) không có quyền gì', async () => {
    const [u] = await sql(`insert into auth.users (email) values ('la@x.vn') returning id`);
    expect(await sql('select * from profiles where id = $1', [u.id])).toEqual([]);
    const owner = await createUser('owner');
    await asUser(owner, (q) => q(`select save_product(null, 'A', 'A', 'goods', 'cái', 1, 0, 1)`));
    for (const t of ['profiles', 'store_settings', 'products', 'stock_movements', 'sales', 'sale_items', 'interior_orders', 'order_payments', 'product_stock', 'order_balances']) {
      expect(await asUser(u.id, (q) => q(`select * from ${t}`))).toEqual([]);
    }
    const [p] = await sql('select id from products');
    await expect(asUser(u.id, (q) => q(`select record_stock($1, 'in', 5, 'x')`, [p.id]))).rejects.toThrow(/Chưa đăng nhập|không có quyền/);
    await expect(asUser(u.id, (q) => q(`select create_sale($1::jsonb, 0, 'cash')`, [JSON.stringify([{ product_id: p.id, quantity: 1 }])]))).rejects.toThrow();
    await expect(asUser(u.id, (q) => q(`select create_order('X', '', '', 1, '[{"label":"a","amount":1}]')`))).rejects.toThrow();
  });

  it('cờ do chủ tạo được ghi sau khi tạo tài khoản thì vẫn có hồ sơ nhân viên', async () => {
    const [u] = await sql(`insert into auth.users (email, raw_user_meta_data) values ('b@x.vn', '{"full_name":"Minh"}') returning id`);
    await sql(`update auth.users set raw_app_meta_data = raw_app_meta_data || '{"hl_staff":true}' where id = $1`, [u.id]);
    await sql(`update auth.users set email = 'b2@x.vn' where id = $1`, [u.id]);
    expect(await sql('select role, full_name from profiles where id = $1', [u.id])).toEqual([{ role: 'staff', full_name: 'Minh' }]);
  });
});
