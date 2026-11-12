import { describe, it, expect } from 'vitest';
import { cashList, cashSum, ledger, profitOf, orderCostInfo, accrual, monthsBack, type LedgerData, type BooksOrder } from './books';

const data = (over: Partial<LedgerData> = {}): LedgerData => ({ cash: [], payments: [], retail: [], start: null, books: {}, ...over });
const ce = (type: 'in' | 'out', date: string, amount: number, cat = type === 'out' ? 'Vật tư, ván' : 'Thu khác', order_id: string | null = null) =>
  ({ id: `${type}${date}${amount}`, type, date, amount, cat, note: '', method: 'cash' as const, order_id });

describe('sổ quỹ theo tháng', () => {
  const d = data({
    start: { date: '2026-09-15', amount: 10_000_000 },
    cash: [ce('out', '2026-09-20', 2_000_000), ce('in', '2026-10-02', 5_000_000, 'Góp vốn, vay'), ce('out', '2026-10-05', 1_000_000, 'Lương'), ce('in', '2026-10-06', 300_000, 'Bán phế liệu'), ce('out', '2026-09-01', 999)],
    payments: [{ id: 'p1', date: '2026-10-10', amount: 20_000_000, order_id: 'o1', code: 'BG2610-01', customer: 'Hoa', no: 1, method: 'transfer' }],
    retail: [{ date: '2026-10-11', amount: 1_650_000 }],
    books: { '2026-09': { in: 0, out: 2_000_000, closedAt: '' } },
  });
  const rows = ledger(['2026-08', '2026-09', '2026-10'], d);
  it('tháng trước khi bắt đầu sổ để trống', () => expect(rows[0].before).toBe(true));
  it('tồn đầu + thu − chi = tồn cuối; khoản trước ngày đặt số dư bị bỏ qua', () => {
    expect([rows[1].open, rows[1].in, rows[1].out, rows[1].close]).toEqual([10_000_000, 0, 2_000_000, 8_000_000]);
    expect(rows[2].open).toBe(rows[1].close);
  });
  it('thu gồm tiền khách trả, bán lẻ, thu khác; góp vốn không tính vào lãi', () => {
    const r = rows[2];
    expect([r.inCust, r.inRetail, r.inOther, r.capital, r.income, r.out, r.profit]).toEqual([20_000_000, 1_650_000, 300_000, 5_000_000, 21_950_000, 1_000_000, 20_950_000]);
    expect(r.close).toBe(8_000_000 + 26_950_000 - 1_000_000);
  });
  it('chi theo nhóm; sổ đã chốt có số đổi thì báo', () => {
    expect(rows[2].cats).toEqual([{ g: 'Lương', v: 1_000_000 }]);
    expect([rows[1].book != null, rows[1].changed]).toEqual([true, false]);
    const d2 = { ...d, books: { '2026-09': { in: 0, out: 1_500_000, closedAt: '' } } };
    expect(ledger(['2026-09'], d2)[0].changed).toBe(true);
  });
  it('danh sách khoản trong kỳ gộp cả tiền khách trả và bán lẻ, mới nhất trước', () => {
    const l = cashList(d, '2026-10-01', '2026-10-31');
    expect(l.map((x) => x.cat)).toEqual(['Bán lẻ', 'Tiền khách trả', 'Bán phế liệu', 'Lương', 'Góp vốn, vay']);
    expect(cashSum(l).in).toBe(26_950_000);
  });
  it('12 tháng gần đây', () => expect(monthsBack(3, '2026-01-15')).toEqual(['2025-11', '2025-12', '2026-01']));
});

const order = (over: Partial<BooksOrder> = {}): BooksOrder => ({
  id: 'o1', code: 'BG2610-01', status: 'closed', customer: 'Hoa', project: '', closedAt: '2026-10-30',
  versions: [{ no: 1, total: 40_000_000, closedAt: '2026-10-30' }], rows: [{ id: 'r1', name: 'Tủ áo', qty: 2, price: 15_000_000 }, { id: 'r2', name: 'Giường', qty: 1, price: 10_000_000 }],
  changes: [], costs: null, spend: 0, stock_cost: 0, ...over,
});

describe('lãi đơn', () => {
  it('giá nhập nhập riêng cho đơn > giá nhập danh mục theo tên; báo số dòng thiếu', () => {
    const p = profitOf(order({ costs: { rows: { r1: 9_000_000 }, chg: {}, ship: 500_000 } }), new Map());
    expect(p).toMatchObject({ rev: 40_000_000, goods: 18_000_000, ship: 500_000, cost: 18_500_000, profit: 21_500_000, missing: 1 });
    const p2 = profitOf(order({ costs: { rows: { r1: 9_000_000 }, chg: {}, ship: 0 } }), new Map([['giường', 6_000_000]]));
    expect([p2.goods, p2.missing]).toEqual([24_000_000, 0]);
  });
  it('phát sinh đã xác nhận cộng doanh thu, giá vốn phát sinh cộng chi phí', () => {
    const p = profitOf(order({ changes: [{ id: 'c1', sign: 1, amount: 2_000_000, title: 'Kệ', confirmedAt: '2026-11-05' }], costs: { rows: {}, chg: { c1: 1_200_000 }, ship: 0 } }), new Map());
    expect([p.rev, p.chgCost]).toEqual([42_000_000, 1_200_000]);
  });
  it('chi phí đơn: thực (chi gắn đơn + vật tư kho) nếu có, không thì ước tính, không có gì thì báo thiếu', () => {
    expect(orderCostInfo(order({ spend: 3_000_000, stock_cost: 1_200_000 }), new Map())).toEqual({ cost: 4_200_000, kind: 'real' });
    expect(orderCostInfo(order({ costs: { rows: { r1: 9_000_000 }, chg: {}, ship: 0 } }), new Map())).toEqual({ cost: 18_000_000, kind: 'est' });
    expect(orderCostInfo(order(), new Map())).toEqual({ cost: 0, kind: 'none' });
  });
});

describe('cộng sổ theo đơn chốt (accrual)', () => {
  it('giá trị bản 1 vào tháng chốt, bản sửa và phát sinh vào tháng xảy ra; chi phí đơn ở tháng chốt; chi chung là chi không gắn đơn', () => {
    const o = order({ versions: [{ no: 1, total: 40_000_000, closedAt: '2026-10-30' }, { no: 2, total: 45_000_000, closedAt: '2026-11-03' }],
      changes: [{ id: 'c', sign: -1, amount: 1_000_000, title: 'Bớt', confirmedAt: '2026-11-20' }], spend: 10_000_000 });
    const cash = [ce('out', '2026-10-05', 10_000_000, 'Nhân công, thợ', 'o1'), ce('out', '2026-11-02', 2_000_000, 'Quảng cáo'), ce('in', '2026-11-03', 500_000, 'Bán phế liệu'), ce('in', '2026-11-04', 9_000_000, 'Góp vốn, vay')];
    const [oct, nov] = accrual(['2026-10', '2026-11'], [o], cash, new Map());
    expect([oct.rev, oct.ocost, oct.gen, oct.oin, oct.profit]).toEqual([40_000_000, 10_000_000, 0, 0, 30_000_000]);
    expect([nov.rev, nov.ocost, nov.gen, nov.oin, nov.profit]).toEqual([4_000_000, 0, 2_000_000, 500_000, 2_500_000]);
    expect(oct.orders.map((x) => x.code)).toEqual(['BG2610-01']);
  });
  it('đơn chưa có chi phí được đếm để cảnh báo', () => {
    const [oct] = accrual(['2026-10'], [order()], [], new Map());
    expect([oct.none, oct.est]).toEqual([1, 0]);
  });
});
