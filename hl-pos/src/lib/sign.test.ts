import { describe, it, expect } from 'vitest';
import { makeSignRecord } from './sign';

describe('chữ ký khách', () => {
  it('mã xác nhận 16 ký tự = SHA-256(nội dung | thời điểm | tên), giống Sổ Nội Thất', async () => {
    const r = await makeSignRecord('data:image/png;base64,AA', 'Chị Hoa', { code: 'BG2611-01', no: 1, total: 40_000_000 }, '2026-11-20T03:00:00.000Z');
    expect(r).toEqual({ img: 'data:image/png;base64,AA', name: 'Chị Hoa', at: '2026-11-20T03:00:00.000Z', hash: 'BAF8D8BC911321AF' });
  });
  it('đổi nội dung thì mã khác', async () => {
    const a = await makeSignRecord('x', 'A', { total: 1 }, '2026-01-01T00:00:00.000Z');
    const b = await makeSignRecord('x', 'A', { total: 2 }, '2026-01-01T00:00:00.000Z');
    expect(a.hash).not.toBe(b.hash);
    expect(a.hash).toMatch(/^[0-9A-F]{16}$/);
  });
});
