import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sql, resetDb } from './helpers';

describe('dữ liệu mẫu', () => {
  beforeEach(resetDb);

  it('nạp được, có hàng có sẵn và vật tư, có tồn kho, mã bắt đầu bằng MAU-', async () => {
    await sql(readFileSync(path.resolve(__dirname, '../../supabase/seed.sql'), 'utf8'));
    const rows = await sql(`select p.code, p.kind, s.stock from products p join product_stock s on s.product_id = p.id`);
    expect(rows.length).toBeGreaterThanOrEqual(6);
    expect(rows.every((r) => r.code.startsWith('MAU-'))).toBe(true);
    expect(new Set(rows.map((r) => r.kind))).toEqual(new Set(['goods', 'material']));
    expect(rows.every((r) => Number(r.stock) > 0)).toBe(true);
    expect((await sql('select count(*)::int as n from product_costs'))[0].n).toBe(rows.length);
  });

  it('file xóa dữ liệu mẫu xóa hết hàng, phiếu, hóa đơn và đánh số lại từ HD000001', async () => {
    await sql(readFileSync(path.resolve(__dirname, '../../supabase/seed.sql'), 'utf8'));
    await sql(`insert into sales (code, subtotal, discount, total, payment_method) values ('HD' || nextval('sale_code_seq'), 1, 0, 1, 'cash')`);
    await sql(readFileSync(path.resolve(__dirname, '../../supabase/xoa-du-lieu-mau.sql'), 'utf8'));
    expect((await sql('select (select count(*) from products)::int as p, (select count(*) from sales)::int as s'))[0]).toEqual({ p: 0, s: 0 });
    expect((await sql(`select nextval('sale_code_seq')::int as n`))[0].n).toBe(1);
  });
});

describe('tạo tài khoản chủ đầu tiên', () => {
  beforeEach(resetDb);
  it('biến tài khoản tạo trên Supabase thành chủ', async () => {
    const [u] = await sql(`insert into auth.users (email) values ('hieu@example.com') returning id`);
    const script = readFileSync(path.resolve(__dirname, '../../supabase/tao-tai-khoan-chu.sql'), 'utf8')
      .replace('EMAIL_CUA_BAN@gmail.com', 'hieu@example.com');
    await sql(script);
    expect(await sql('select role, full_name from profiles where id = $1', [u.id])).toEqual([{ role: 'owner', full_name: 'Hiếu' }]);
  });
});
