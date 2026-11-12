import { describe, it, expect } from 'vitest';
import { formatVnd, parseVnd, formatQty } from './money';

describe('tiền', () => {
  it('định dạng kiểu Việt Nam', () => {
    expect(formatVnd(1250000)).toBe('1.250.000 đ');
    expect(formatVnd(0)).toBe('0 đ');
    expect(formatVnd(-50000)).toBe('-50.000 đ');
  });
  it('đọc số người dùng gõ', () => {
    expect(parseVnd('1.250.000')).toBe(1250000);
    expect(parseVnd(' 20 000 đ')).toBe(20000);
    expect(parseVnd('')).toBe(0);
    expect(parseVnd('abc')).toBeNaN();
    expect(parseVnd('1,5')).toBeNaN();
  });
  it('số lượng bỏ số 0 thừa, dùng dấu phẩy thập phân', () => {
    expect(formatQty('7.000')).toBe('7');
    expect(formatQty(2.5)).toBe('2,5');
  });
});
