import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readBackup, toImportPayload, expectedTotals } from './importSnt';

const raw = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../../tests/fixtures/snt-backup.json'), 'utf8'));

describe('đọc file sao lưu Sổ Nội Thất', () => {
  it('nhận định dạng mới và định dạng cũ (trước 20/10/2026); file lạ trả null', () => {
    expect(readBackup(raw)?.cols.orders).toHaveLength(3);
    const old = { app: 'so-noi-that', exportedAt: '2026-10-01', orders: raw.data.orders, customers: raw.data.customers, catalog: raw.data.catalog };
    expect(readBackup(old)?.cols.orders).toHaveLength(3);
    expect(readBackup({ hello: 1 })).toBeNull();
    expect(readBackup(null)).toBeNull();
  });

  it('bỏ dữ liệu mẫu (demo), liệt kê thứ không chuyển được', () => {
    const p = toImportPayload(readBackup(raw)!.cols);
    expect(p.orders.map((o) => o.code)).toEqual(['BG2609-01', 'BG2611-01']);
    expect(p.customers.map((c) => c.name)).toEqual(['Chị Lan', 'Anh Tuấn']);
    expect(p.skipped).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'demo' }),
      expect.objectContaining({ kind: 'payReq', why: expect.stringMatching(/Sale Minh.*3\.000\.000 đ ngày 01\/11\/2026/) }),
      expect.objectContaining({ kind: 'attachment', why: expect.stringMatching(/anh-hien-trang\.jpg/) }),
    ]));
  });

  it('chuẩn hóa đơn: số phiếu thu thiếu được đánh số, đặt cọc nhận ra từ ghi chú, phát sinh giữ trạng thái, chi phí và chữ ký đi kèm', () => {
    const o = toImportPayload(readBackup(raw)!.cols).orders[0];
    expect(o.payments.map((x) => [x.no, x.deposit])).toEqual([[1, true], [2, false]]);
    expect(o.changes.map((c) => [c.status, c.sign, c.reason])).toEqual([['confirmed', 1, 'other'], ['pending', -1, 'other']]);
    expect(o.versions.map((v) => v.no)).toEqual([1, 2]);
    expect(o.versions[0].sign?.hash).toBe('0123456789ABCDEF');
    expect(o.versions[1].quote.validUntil).toBe('');
    expect(o.costs).toEqual({ rows: { r1: 2100000 }, chg: { g1: 1500000 }, ship: 600000 });
    expect(o.customer_legacy_id).toBe('c1');
    expect(o.notes).toEqual([{ text: 'Khách muốn xong trước ngày 30', at: '2026-09-21T00:00:00Z' }]);
  });

  it('danh mục kèm giá nhập; sổ thu chi kèm đơn liên quan', () => {
    const p = toImportPayload(readBackup(raw)!.cols);
    expect(p.catalog).toEqual([
      { legacy_id: 'k1', name: 'Tủ áo cánh lùa', material: 'MDF chống ẩm', unit: 'm²', price: 3500000, cost: 2200000 },
      { legacy_id: 'k2', name: 'Giường ngủ 1m8', material: '', unit: 'bộ', price: 8000000, cost: null },
    ]);
    expect(p.cash.map((c) => [c.legacy_id, c.order_legacy_id])).toEqual([['t1', 'o1'], ['t2', null]]);
  });

  it('số tiền kỳ vọng của từng đơn tính bằng orderMoney (để đối chiếu sau khi nhập)', () => {
    const [o1, o2] = toImportPayload(readBackup(raw)!.cols).orders;
    expect(expectedTotals(o1)).toEqual({ total: 25_500_000 + 2_400_000, paid: 17_000_000, due: 10_900_000 });
    expect(expectedTotals(o2)).toEqual({ total: 4_050_000, paid: 0, due: 0 });
  });
});
