import { describe, it, expect } from 'vitest';
import { matches } from './products';

describe('tìm hàng', () => {
  it('tìm theo tên không cần dấu, theo mã không phân biệt hoa thường', () => {
    const p = { code: 'TU01', name: 'Tủ áo 3 cánh gỗ đỏ' };
    expect(matches(p, 'tu ao')).toBe(true);
    expect(matches(p, 'go do')).toBe(true);
    expect(matches(p, 'tu01')).toBe(true);
    expect(matches(p, 'giường')).toBe(false);
    expect(matches(p, '')).toBe(true);
  });
});
