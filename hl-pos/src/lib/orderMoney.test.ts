// Chuyển từ test/money.test.js của Sổ Nội Thất (giữ nguyên từng ca và con số) + các ca bổ sung.
import { describe, it, expect } from 'vitest';
import {
  orderMoney, quoteTotals, planAmounts, planOver, planWarnText, dimsQty, dimText, moneyWords, receiptNo, parseQty,
  DEFAULT_PLAN, PLAN_PRESETS, newPlan, mergePlan, dueNowAmount, overdueAmount, addDays, addMonths, valueEvents,
  type Order, type PlanRow, type Quote,
} from './orderMoney';

const T = '2026-11-12';
type Mk = { total?: number; plan?: Partial<PlanRow>[]; pays?: number[]; changes?: number[]; status?: Order['status']; handover?: Order['handover']; payDue?: string };
function mk({ total = 40_000_000, plan = DEFAULT_PLAN, pays = [], changes = [], status = 'closed', handover = null, payDue = '' }: Mk = {}): Order {
  const q: Quote = { date: T, customer: { name: 'Khách', phone: '', address: '' }, project: '', rows: [{ id: 'r1', name: 'Tủ', material: '', unit: 'bộ', qty: 1, price: total, dims: null }],
    discount: { type: 'amount', value: 0 }, note: '', terms: '', validUntil: '', plan: newPlan(plan) };
  const quoteStage = status === 'quote';
  return { id: 'o1', code: 'BG2611-01', status, draft: quoteStage ? q : null,
    versions: quoteStage ? [] : [{ no: 1, quote: q, sub: total, disc: 0, total, closedAt: T, sign: null }],
    plan: quoteStage ? [] : mergePlan([], q.plan), payDue, closedAt: quoteStage ? null : T, handover,
    payments: pays.map((a, i) => ({ id: 'p' + i, no: i + 1, amount: a, date: T, method: 'transfer', note: '', deposit: false })),
    changes: changes.map((c, i) => ({ id: 'c' + i, title: 'PS', amount: Math.abs(c), sign: c < 0 ? -1 : 1, status: 'confirmed', confirmedAt: T, reason: '', note: '', signRec: null })) };
}
const M = (o: Order, opt = {}) => orderMoney(o, { today: T, ...opt });
const amt = (o: Order) => M(o).rows.map((r) => r.amount);

describe('orderMoney (các ca của Sổ Nội Thất)', () => {
  it('3 đợt 50/40/còn lại trên 40tr', () => expect(amt(mk())).toEqual([20_000_000, 16_000_000, 4_000_000]));
  it('phát sinh +2tr cộng vào đợt cuối', () => expect(amt(mk({ changes: [2_000_000] }))).toEqual([20_000_000, 16_000_000, 6_000_000]));
  it('phát sinh −6tr trừ lùi từ đợt cuối sang đợt 2', () => expect(amt(mk({ changes: [-6_000_000] }))).toEqual([20_000_000, 14_000_000, 0]));
  it('tổng = báo giá + phát sinh', () => expect(M(mk({ changes: [-6_000_000] })).total).toBe(34_000_000));
  it('đã trả 25tr: đợt 1 đủ, đợt 2 còn 11tr', () =>
    expect(M(mk({ pays: [25_000_000] })).rows.map((r) => [r.paid, r.left, r.state])).toEqual([[20_000_000, 0, 'paid'], [5_000_000, 11_000_000, 'later'], [0, 4_000_000, 'later']]));
  it('đợt kế tiếp là đợt 2', () => expect(M(mk({ pays: [25_000_000] })).next?.n).toBe(2));
  it('trả thừa', () => { const m = M(mk({ pays: [41_000_000] })); expect([m.due, m.over]).toEqual([0, 1_000_000]); });
  it('đợt 1 đến hạn ngay khi chốt', () => expect(M(mk()).rows[0].state).toBe('due'));
  it('đợt cố định 10tr + 40% + còn lại', () =>
    expect(amt(mk({ plan: [{ label: 'Cọc', fixed: true, amt: 10_000_000, trigger: 'sign' }, { label: 'Lắp', pct: 40, trigger: 'progress' }, { label: 'Giao', trigger: 'accept' }] }))).toEqual([10_000_000, 16_000_000, 14_000_000]));
  it('không chia đợt: một khoản, chưa đến hạn khi chưa bàn giao', () =>
    expect(M({ ...mk({ pays: [10_000_000] }), plan: [] }).rows.map((r) => [r.one, r.amount, r.left, r.state])).toEqual([[true, 40_000_000, 30_000_000, 'later']]));
  it('không chia đợt: đã bàn giao thì đến hạn', () => expect(M({ ...mk({ status: 'done' }), plan: [] }).rows[0].state).toBe('due'));
  it('không chia đợt: hẹn ngày đã qua thì quá hạn', () => expect(M({ ...mk({ payDue: addDays(T, -1) }), plan: [] }).rows[0].state).toBe('overdue'));
  it('báo giá chưa chốt: không có gì phải thu', () => { const m = M(mk({ status: 'quote' })); expect([m.due, m.next]).toEqual([0, null]); });
  it('in bản cũ: không trừ tiền đã trả, không cộng phát sinh', () =>
    expect(M(mk({ pays: [25_000_000], changes: [2_000_000] }), { pays: false }).rows.map((r) => r.left)).toEqual([20_000_000, 16_000_000, 4_000_000]));
  it('màn sửa lịch: lịch mới, vẫn trừ tiền đã trả', () =>
    expect(M(mk({ pays: [5_000_000] }), { plan: newPlan(PLAN_PRESETS['2'].rows) }).rows.map((r) => r.left)).toEqual([15_000_000, 20_000_000]));
  it('dueNowAmount / overdueAmount', () => { const o = mk({ pays: [5_000_000] }); expect([dueNowAmount(o, T), overdueAmount(o, T)]).toEqual([15_000_000, 0]); });
});

describe('orderMoney (bổ sung)', () => {
  it('đợt có hạn đã qua thì quá hạn; hạn hôm nay thì đến hạn', () => {
    const o = mk(); o.plan[1].due = addDays(T, -1); o.plan[2].due = T;
    expect(M(o).rows.map((r) => r.state)).toEqual(['due', 'overdue', 'due']);
    expect(overdueAmount(o, T)).toBe(16_000_000);
  });
  it('mốc thi công tới khi đơn Đang thi công; mốc nghiệm thu tới khi đã bàn giao', () => {
    expect(M(mk({ status: 'building' })).rows.map((r) => r.state)).toEqual(['due', 'due', 'later']);
    expect(M(mk({ handover: { date: T, warrantyMonths: 36, warrantyUntil: '2029-11-12', note: '', sign: null } })).rows.map((r) => r.state)).toEqual(['due', 'due', 'due']);
  });
  it('đánh dấu "đã tới mốc" bằng tay làm đợt đến hạn', () => { const o = mk(); o.plan[2].reached = true; expect(M(o).rows[2].state).toBe('due'); });
  it('phát sinh giảm lớn hơn giá trị đơn: các đợt về 0, còn nợ 0, hiện trả thừa', () => {
    const m = M(mk({ changes: [-50_000_000], pays: [5_000_000] }));
    expect(m.rows.map((r) => r.amount)).toEqual([0, 0, 0]);
    expect([m.total, m.due, m.over]).toEqual([-10_000_000, 0, 15_000_000]);
  });
  it('phát sinh chờ xác nhận hoặc đã hủy không tính vào tổng', () => {
    const o = mk({ changes: [2_000_000, 3_000_000] }); o.changes[0].status = 'pending'; o.changes[1].status = 'cancelled';
    expect(M(o).total).toBe(40_000_000);
  });
  it('đơn nhiều bản: lấy tổng bản chốt mới nhất', () => {
    const o = mk(); o.versions.push({ ...o.versions[0], no: 2, total: 45_000_000 });
    expect(M(o).base).toBe(45_000_000);
  });
});

describe('báo giá', () => {
  const q = (rows: [number, number][], discount: Quote['discount']): Quote => ({ date: T, customer: { name: 'K', phone: '', address: '' }, project: '',
    rows: rows.map(([qty, price], i) => ({ id: 'r' + i, name: 'x', material: '', unit: 'm²', qty, price, dims: null })), discount, note: '', terms: '', validUntil: '', plan: [] });
  it('tạm tính, giảm %, tổng', () => expect(quoteTotals(q([[2, 1_000_000], [1.5, 2_000_000]], { type: 'percent', value: 10 }))).toEqual({ sub: 5_000_000, disc: 500_000, total: 4_500_000 }));
  it('giảm tiền bị kẹp về tạm tính; % bị kẹp 0–100', () => {
    expect(quoteTotals(q([[1, 5_000_000]], { type: 'amount', value: 6_000_000 })).total).toBe(0);
    expect(quoteTotals(q([[1, 5_000_000]], { type: 'percent', value: 150 })).total).toBe(0);
    expect(quoteTotals(q([[1, 5_000_000]], { type: 'amount', value: -5 })).disc).toBe(0);
  });
  it('thành tiền dòng làm tròn đồng', () => expect(quoteTotals(q([[0.333, 1000]], { type: 'amount', value: 0 })).sub).toBe(333));
  it('số lượng từ kích thước', () => {
    expect(dimsQty('m²', { a: 2400, b: 600, n: 2, u: 'mm' })).toBe(2.88);
    expect(dimsQty('md', { a: 320, b: 0, n: 1, u: 'cm' })).toBe(3.2);
    expect(dimsQty('cái', { a: 0, b: 0, n: 4, u: 'mm' })).toBe(4);
  });
  it('chữ mô tả kích thước', () => {
    expect(dimText('m²', { a: 2400, b: 600, n: 2, u: 'mm' })).toBe('2.400 × 600 mm × 2');
    expect(dimText('md', { a: 3.2, b: 0, n: 1, u: 'm' })).toBe('dài 3,2 m');
    expect(dimText('cái', null)).toBe('');
  });
  it('đọc số lượng người dùng gõ', () => { expect(parseQty('2,88')).toBe(2.88); expect(parseQty('1.234,5')).toBe(1234.5); expect(parseQty('abc')).toBe(0); });
  it('cảnh báo khi các đợt trước chiếm hết giá trị', () => {
    const over = newPlan([{ label: 'a', pct: 60, trigger: 'sign' }, { label: 'b', pct: 40, trigger: 'date' }, { label: 'c', trigger: 'accept' }]);
    expect(planOver(over, 10_000_000)).toBe(true);
    expect(planWarnText(over, 10_000_000)).toMatch(/Đợt cuối sẽ bằng 0/);
    expect(planOver(newPlan(DEFAULT_PLAN), 10_000_000)).toBe(false);
    expect(planAmounts(newPlan(DEFAULT_PLAN), 10_000_001).map((r) => r.amount)).toEqual([5_000_001, 4_000_000, 1_000_000]);
  });
  it('số tiền bằng chữ', () => {
    expect(moneyWords(4_500_000)).toBe('Bốn triệu năm trăm nghìn đồng.');
    expect(moneyWords(1_005_021)).toBe('Một triệu không trăm linh năm nghìn không trăm hai mươi mốt đồng.');
    expect(moneyWords(2_000_000_000)).toBe('Hai tỷ đồng.');
    expect(moneyWords(15)).toBe('Mười lăm đồng.');
  });
  it('số phiếu thu', () => expect(receiptNo('BG2611-01', 3)).toBe('PT-BG2611-01-03'));
  it('cộng tháng kẹp cuối tháng (bảo hành)', () => { expect(addMonths('2026-08-31', 6)).toBe('2027-02-28'); expect(addMonths('2026-11-12', 36)).toBe('2029-11-12'); });
});

describe('doanh thu theo tháng (valueEvents)', () => {
  it('bản 1 vào ngày chốt, bản sửa tính phần chênh, phát sinh vào ngày xác nhận', () => {
    const o = mk({ changes: [2_000_000] });
    o.versions.push({ ...o.versions[0], no: 2, total: 45_000_000, closedAt: '2026-12-03' });
    o.changes[0].confirmedAt = '2026-12-20';
    expect(valueEvents(o).map((e) => [e.date, e.amount, e.kind])).toEqual([[T, 40_000_000, 'close'], ['2026-12-03', 5_000_000, 'revise'], ['2026-12-20', 2_000_000, 'change']]);
    expect(valueEvents(mk({ status: 'quote' }))).toEqual([]);
  });
});
