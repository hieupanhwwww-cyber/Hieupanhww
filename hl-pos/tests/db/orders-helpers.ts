import type { Q } from './helpers';

export const row = (name: string, qty: number, price: number, extra: object = {}) =>
  ({ id: `r-${name}`, name, material: 'MDF chống ẩm', unit: 'm²', qty, price, dims: null, ...extra });
export const plan3 = () => [
  { id: 'd1', label: 'Đặt cọc khi ký hợp đồng', pct: 50, trigger: 'sign' },
  { id: 'd2', label: 'Khi bắt đầu lắp đặt', pct: 40, trigger: 'progress' },
  { id: 'd3', label: 'Sau nghiệm thu, bàn giao', pct: 0, trigger: 'accept' },
];
export const quote = (over: object = {}) => ({
  date: '2026-11-12', customer: { name: 'Chị Hoa', phone: '0912 345 678', address: 'Thư Lâm, Hà Nội' }, project: 'Phòng ngủ master',
  rows: [row('Tủ áo', 2, 1_000_000), row('Giường', 1.5, 2_000_000)], discount: { type: 'percent', value: 10 },
  note: '', terms: '', validUntil: '', plan: plan3(), ...over,
});
export const saveDraft = (q: Q, orderId: string | null, qt: object, rev: number | null = null) =>
  q('select save_quote_draft($1, $2::jsonb, $3) as r', [orderId, JSON.stringify(qt), rev]).then((r) => r[0].r as { order_id: string; code: string; rev: number });
export const closeOrder = (q: Q, id: string, deposit = 0, date = '2026-11-12') =>
  q(`select close_order($1, $2, $3, 'transfer', null) as r`, [id, date, deposit]).then((r) => r[0].r as { version_no: number; total: string });
export const pay = (q: Q, id: string, amount: number, date = '2026-11-13') =>
  q(`select add_payment($1, $2, $3, 'cash', '', false) as r`, [id, amount, date]).then((r) => r[0].r as { id: string; no: number });
