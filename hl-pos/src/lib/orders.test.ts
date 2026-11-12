import { describe, it, expect } from 'vitest';
import { STATUS_LABEL, STATUSES, orderRemaining, defaultPayments, scheduleWarning } from './orders';

describe('đơn nội thất (giao diện)', () => {
  it('nhãn tiến độ đúng thứ tự', () => {
    expect(STATUSES.map((s) => STATUS_LABEL[s])).toEqual(['Chốt thiết kế', 'Sản xuất', 'Lắp đặt', 'Hoàn thành']);
  });
  it('còn nợ = tổng − các đợt đã thu', () => {
    expect(orderRemaining(50_000_000, [{ amount: 15_000_000, paid: true }, { amount: 20_000_000, paid: false }])).toBe(35_000_000);
  });
  it('3 đợt mặc định Cọc/Đợt 2/Nghiệm thu, tổng luôn bằng giá trị đơn', () => {
    const p = defaultPayments(50_000_000);
    expect(p.map((x) => x.label)).toEqual(['Cọc', 'Đợt 2', 'Nghiệm thu']);
    expect(p.reduce((s, x) => s + x.amount, 0)).toBe(50_000_000);
    expect(defaultPayments(10_000_001).reduce((s, x) => s + x.amount, 0)).toBe(10_000_001);
  });
  it('cảnh báo khi tổng các đợt lệch giá trị đơn', () => {
    expect(scheduleWarning(50, [{ amount: 20 }, { amount: 30 }])).toBe('');
    expect(scheduleWarning(50, [{ amount: 20 }])).toMatch(/thiếu/);
    expect(scheduleWarning(50, [{ amount: 60 }])).toMatch(/thừa/);
  });
});
