import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sql, createUser, asUser, resetDb } from './helpers';
import { readBackup, toImportPayload, expectedTotals } from '../../src/lib/importSnt';
import { quote, saveDraft } from './orders-helpers';

const payload = toImportPayload(readBackup(JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../fixtures/snt-backup.json'), 'utf8')))!.cols);
const imp = (uid: string) => asUser(uid, (q) => q('select import_snt($1::jsonb) as r', [JSON.stringify(payload)])).then((r) => r[0].r);

describe('nhập dữ liệu từ Sổ Nội Thất', () => {
  let owner: string, staff: string;
  beforeEach(async () => {
    await resetDb();
    owner = await createUser('owner', 'Hiếu');
    staff = await createUser('staff', 'Lan');
  });

  it('chỉ chủ được nhập', async () => {
    await expect(imp(staff)).rejects.toThrow(/Chỉ chủ/);
  });

  it('nhập đủ khách, danh mục, đơn, bản chốt, phiếu thu, phát sinh, ghi chú, chi phí, sổ thu chi; giữ mã đơn và số phiếu', async () => {
    const r = await imp(owner);
    expect(r.created).toEqual({ customers: 2, catalog: 2, orders: 2, payments: 2, changes: 2, cash: 2 });
    const os = await sql('select code, status, closed_at::text, total, customer_name, project from orders order by code');
    expect(os).toEqual([
      { code: 'BG2609-01', status: 'building', closed_at: '2026-09-20', total: '25500000', customer_name: 'Chị Lan', project: 'Phòng ngủ master' },
      { code: 'BG2611-01', status: 'quote', closed_at: null, total: '4050000', customer_name: 'Anh Tuấn', project: 'Phòng ngủ con' },
    ]);
    const [o1] = await sql(`select id, plan->1->>'due' as due2 from orders where code = 'BG2609-01'`);
    expect(o1.due2).toBe('2026-11-01');
    expect(await sql('select version_no, total, sign->>\'hash\' as h from order_quotes where order_id=$1 order by version_no', [o1.id]))
      .toEqual([{ version_no: 1, total: '24000000', h: '0123456789ABCDEF' }, { version_no: 2, total: '25500000', h: null }]);
    expect(await sql('select no, amount, method, deposit, created_by from order_payments where order_id=$1 order by no', [o1.id]))
      .toEqual([{ no: 1, amount: '12000000', method: 'transfer', deposit: true, created_by: null }, { no: 2, amount: '5000000', method: 'cash', deposit: false, created_by: null }]);
    expect(await sql('select status from order_changes where order_id=$1 order by created_at', [o1.id])).toEqual([{ status: 'confirmed' }, { status: 'pending' }]);
    expect((await sql('select count(*)::int as n from order_notes where order_id=$1', [o1.id]))[0].n).toBe(1);
    const [c] = await sql('select rows, chg, ship from order_costs where order_id=$1', [o1.id]);
    const [g1] = await sql(`select id from order_changes where legacy_id = 'g1'`);
    expect(c).toEqual({ rows: { r1: 2100000 }, chg: { [g1.id]: 1500000 }, ship: '600000' });
    expect((await sql(`select order_id from cash_entries where legacy_id = 't1'`))[0].order_id).toBe(o1.id);
    expect((await sql(`select cost from catalog_costs cc join catalog k on k.id = cc.catalog_id where k.name = 'Tủ áo cánh lùa'`))[0].cost).toBe('2200000');
    const log = await sql('select text from order_log where order_id=$1 order by id', [o1.id]);
    expect(log.map((l) => l.text)).toEqual(['Tạo báo giá', 'Chốt đơn ngày 20/09/2026: 24.000.000 đ (Hiếu)', 'Nhập từ Sổ Nội Thất']);
  });

  it('số tiền sau khi nhập khớp quy tắc tính tiền (order_totals = orderMoney trên dữ liệu file)', async () => {
    await imp(owner);
    for (const o of payload.orders) {
      const [t] = await sql('select t.total, t.paid, t.due from order_totals t join orders o on o.id = t.order_id where o.code = $1', [o.code]);
      expect({ total: Number(t.total), paid: Number(t.paid), due: Number(t.due) }).toEqual(expectedTotals(o));
    }
  });

  it('nhập lại cùng file không tạo trùng', async () => {
    await imp(owner);
    const r = await imp(owner);
    expect(r.created).toEqual({ customers: 0, catalog: 0, orders: 0, payments: 0, changes: 0, cash: 0 });
    expect(r.existed.orders).toBe(2);
    for (const t of ['orders', 'customers', 'catalog', 'order_payments', 'order_changes', 'cash_entries']) {
      expect((await sql(`select count(*)::int as n from ${t}`))[0].n).toBe(t === 'orders' ? 2 : t === 'order_payments' ? 2 : t === 'order_changes' ? 2 : 2);
    }
  });

  it('khách trùng SĐT và danh mục trùng tên với dữ liệu đã có: dùng lại, không tạo mới; mã đơn trùng thì đổi mã và báo', async () => {
    await sql(`update store_settings set code_prefix = 'BG'`);
    await asUser(staff, (q) => saveDraft(q, null, quote({ customer: { name: 'Lan', phone: '0912111222', address: '' } })));
    await sql(`update orders set code = 'BG2611-01'`);
    await asUser(owner, (q) => q(`select save_catalog_item(null, 'tủ áo cánh lùa', '', 'm²', 1, null)`));
    const r = await imp(owner);
    expect(r.created.customers).toBe(1);
    expect(r.created.catalog).toBe(1);
    expect(r.renamed).toEqual([{ from: 'BG2611-01', to: 'BG2611-01-S' }]);
    expect((await sql(`select count(*)::int as n from customers`))[0].n).toBe(2);
  });

  it('bản chốt có tổng trong file khác số tính lại thì vẫn nhập và báo lệch', async () => {
    const bad = structuredClone(payload);
    bad.orders[0].versions[1].file_total = 25_000_000;
    const r = await asUser(owner, (q) => q('select import_snt($1::jsonb) as r', [JSON.stringify(bad)])).then((x) => x[0].r);
    expect(r.mismatch).toEqual([{ code: 'BG2609-01', version: 2, file: 25_000_000, app: 25_500_000 }]);
  });
});
