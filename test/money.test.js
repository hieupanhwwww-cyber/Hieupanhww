// Kiểm thử nhanh (không cần trình duyệt) cho mô-đun "tiền của một đơn": orderMoney
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console, Intl, Date, Math, JSON, Promise, setTimeout, clearTimeout, crypto: require('crypto').webcrypto, TextEncoder,
  window: {}, navigator: {}, location: { hash: '', search: '', pathname: '/' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], documentElement: { dataset: {} } }, indexedDB: undefined };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'parts', 'core.js'), 'utf8') + `
;var __S = {}; Store.get = (c, id) => (c === "app" && id === "settings" ? __S : null);`, ctx);
const run = js => vm.runInContext(js, ctx);
let pass = 0, fail = 0;
const t = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ` :: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)); };
run(`
function mk({ total = 40000000, plan = DEFAULT_PLAN, pays = [], changes = [], status = 'closed', handover = null, payDue = '' } = {}) {
  const q = newQuote(); q.rows = [newRow({ name: 'Tủ', unit: 'bộ', qty: 1, price: total })]; q.plan = newPlan(plan);
  return { id: 'o1', status, draft: status === 'quote' ? q : null, versions: status === 'quote' ? [] : [{ no: 1, quote: q, total, closedAt: today() }],
    plan: status === 'quote' ? undefined : mergePlan([], q.plan), payments: pays.map((a, i) => ({ id: 'p' + i, amount: a, date: today() })),
    changes: changes.map((c, i) => ({ id: 'c' + i, title: 'PS', amount: Math.abs(c), sign: c < 0 ? -1 : 1, status: 'confirmed', confirmedAt: today() })), handover, payDue };
}`);
const amt = js => run(`orderMoney(${js}).rows.map(r => r.amount)`);
t('3 đợt 50/40/còn lại trên 40tr', amt('mk()'), [20000000, 16000000, 4000000]);
t('phát sinh +2tr cộng vào đợt cuối', amt('mk({ changes: [2000000] })'), [20000000, 16000000, 6000000]);
t('phát sinh −6tr trừ lùi từ đợt cuối sang đợt 2', amt('mk({ changes: [-6000000] })'), [20000000, 14000000, 0]);
t('tổng = báo giá + phát sinh', run('orderMoney(mk({ changes: [-6000000] })).total'), 34000000);
t('đã trả 25tr: đợt 1 đủ, đợt 2 còn 11tr', run('orderMoney(mk({ pays: [25000000] })).rows.map(r => [r.paid, r.left, r.state])'), [[20000000, 0, 'paid'], [5000000, 11000000, 'later'], [0, 4000000, 'later']]);
t('đợt kế tiếp là đợt 2', run('orderMoney(mk({ pays: [25000000] })).next.n'), 2);
t('trả thừa', run('(m => [m.due, m.over])(orderMoney(mk({ pays: [41000000] })))'), [0, 1000000]);
t('đợt 1 đến hạn ngay khi chốt', run('orderMoney(mk()).rows[0].state'), 'due');
t('đợt cố định 10tr + 40% + còn lại', amt('mk({ plan: [{ label: "Cọc", fixed: true, amt: 10000000, trigger: "sign" }, { label: "Lắp", pct: 40, trigger: "progress" }, { label: "Giao", trigger: "accept" }] })'), [10000000, 16000000, 14000000]);
t('không chia đợt: một khoản, chưa đến hạn khi chưa bàn giao', run('(m => m.rows.map(r => [r.one, r.amount, r.left, r.state]))(orderMoney(Object.assign(mk({ pays: [10000000] }), { plan: [] })))'), [[true, 40000000, 30000000, 'later']]);
t('không chia đợt: đã bàn giao thì đến hạn', run('orderMoney(Object.assign(mk({ status: "done" }), { plan: [] })).rows[0].state'), 'due');
t('không chia đợt: hẹn ngày đã qua thì quá hạn', run('orderMoney(Object.assign(mk({ payDue: addDays(today(), -1) }), { plan: [] })).rows[0].state'), 'overdue');
t('tắt tính năng lịch: đơn có lịch vẫn coi như thu một lần', run('__S.features = { plan: false }; const r = orderMoney(mk()).rows; __S.features = {}; r.length + (r[0].one ? "-one" : "")'), '1-one');
t('báo giá chưa chốt: không có gì phải thu', run('(m => [m.due, planStatus(mk({ status: "quote" })).length])(orderMoney(mk({ status: "quote" })))'), [0, 0]);
t('in bản cũ: không trừ tiền đã trả', run('orderMoney(mk({ pays: [25000000], changes: [2000000] }), { pays: false }).rows.map(r => r.left)'), [20000000, 16000000, 4000000]);
t('màn sửa lịch: lịch mới, vẫn trừ tiền đã trả', run('orderMoney(mk({ pays: [5000000] }), { plan: newPlan(PLAN_PRESETS["2"].rows) }).rows.map(r => r.left)'), [15000000, 20000000]);
t('dueNowAmount/overdueAmount', run('(o => [dueNowAmount(o), overdueAmount(o)])(mk({ pays: [5000000] }))'), [15000000, 0]);
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
