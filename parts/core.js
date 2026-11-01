'use strict';
/* =========================================================
   TIỆN ÍCH
   ========================================================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad2 = n => String(n).padStart(2, '0');
const dstr = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const today = () => dstr(new Date());
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return dstr(new Date(y, m - 1, d + n)); };
const fmtDate = s => { if (!s) return ''; const [y, m, d] = String(s).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
const fmtTime = dt => `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
const fmtDateTime = dt => `${fmtTime(dt)} ${fmtDate(dstr(dt))}`;
const NF = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const QF = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 });
const money = n => NF.format(Math.round(Number(n) || 0));
const moneyD = n => money(n) + ' đ';
const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + money(Math.abs(n));
const fmtQty = n => QF.format(Number(n) || 0);
const parseMoney = s => { const v = parseInt(String(s ?? '').replace(/[^\d]/g, ''), 10); return Number.isFinite(v) ? v : 0; };
const parseQty = s => {
  let t = String(s ?? '').trim().replace(/\s/g, '');
  if (!t) return 0;
  t = t.replace(/,/g, '.');
  const parts = t.split('.');
  if (parts.length > 2) t = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
  const v = parseFloat(t);
  return Number.isFinite(v) && v > 0 ? Math.round(v * 1000) / 1000 : 0;
};
const round3 = v => Math.round(v * 1000) / 1000;
const clone = o => JSON.parse(JSON.stringify(o));
const digits = s => String(s || '').replace(/\D/g, '');
const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/g, 'd').replace(/\u0110/g, 'D').toLowerCase();
const fileSafe = s => fold(s).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const softFocus = el => { const a = document.activeElement; if (el && !(a && a !== el && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) el.focus(); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shortMoney = n => {
  const a = Math.abs(n);
  const f = (v, u) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(v) + u;
  if (a >= 1e9) return f(n / 1e9, ' tỷ');
  if (a >= 1e6) return f(n / 1e6, ' tr');
  if (a >= 1e3) return f(n / 1e3, 'k');
  return String(Math.round(n));
};

/* Đọc số tiền bằng chữ tiếng Việt */
const DIG = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
function read3(n, full) {
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), u = n % 10, out = [];
  if (h > 0 || full) out.push(DIG[h] + ' trăm');
  if (t > 1) {
    out.push(DIG[t] + ' mươi');
    if (u === 1) out.push('mốt'); else if (u === 4) out.push('tư'); else if (u === 5) out.push('lăm'); else if (u > 0) out.push(DIG[u]);
  } else if (t === 1) {
    out.push('mười');
    if (u === 5) out.push('lăm'); else if (u > 0) out.push(DIG[u]);
  } else if (u > 0) {
    if (h > 0 || full) out.push('linh');
    out.push(DIG[u]);
  }
  return out.join(' ');
}
function readBelowBillion(n, full) {
  const g = [Math.floor(n / 1e6), Math.floor(n / 1e3) % 1000, n % 1000], names = ['triệu', 'nghìn', ''];
  const parts = []; let started = full;
  for (let i = 0; i < 3; i++) {
    if (g[i] === 0) continue;
    parts.push(read3(g[i], started) + (names[i] ? ' ' + names[i] : ''));
    started = true;
  }
  return parts.join(' ');
}
function readNum(n) {
  if (n === 0) return 'không';
  if (n >= 1e9) { const hi = Math.floor(n / 1e9), lo = n % 1e9; return readNum(hi) + ' tỷ' + (lo ? ' ' + readBelowBillion(lo, true) : ''); }
  return readBelowBillion(n, false);
}
function moneyWords(n) {
  n = Math.round(Math.abs(Number(n) || 0));
  const s = readNum(n) + ' đồng';
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}

/* =========================================================
   NGHIỆP VỤ
   ========================================================= */
const UNITS = ['m²', 'md', 'bộ', 'cái', 'gói', 'cánh', 'điểm', 'công'];
const UNIT_NAMES = { 'm²': 'm² (mét vuông)', 'md': 'md (mét dài)', 'bộ': 'bộ', 'cái': 'cái', 'gói': 'gói', 'cánh': 'cánh', 'điểm': 'điểm', 'công': 'công' };
const STATUS = {
  quote: { label: 'Đang báo giá', cls: 's-quote' },
  closed: { label: 'Đã chốt', cls: 's-closed' },
  building: { label: 'Đang thi công', cls: 's-building' },
  done: { label: 'Hoàn thành', cls: 's-done' },
};
const DEFAULT_SETTINGS = {
  id: 'settings',
  shopName: 'Nội Thất Hùng Loan',
  tagline: 'Thiết kế – thi công nội thất trọn gói',
  address: 'Làng nghề Hà Lâm 1 – Thư Lâm – Hà Nội',
  phone: '0916.771.586 – 0961.761.868',
  email: '',
  bankName: '', bankBin: '', bankAccount: '', bankHolder: '', memoPrefix: 'HL',
  logo: '',
  defaultNote: '', defaultTerms: '',
  codePrefix: 'BG',
  warrantyMonths: 36,
  planTemplate: null, planAuto: true,
  features: { today: true, cash: true, profit: true, qrPdf: true, plan: true },
  followDays: 3,
};
const TRIGGERS = { sign: 'Khi chốt đơn', progress: 'Khi bắt đầu thi công', accept: 'Khi nghiệm thu, bàn giao', date: 'Theo ngày hẹn' };
const DEFAULT_PLAN = [
  { label: 'Đặt cọc khi ký hợp đồng', pct: 50, trigger: 'sign' },
  { label: 'Khi bắt đầu lắp đặt', pct: 40, trigger: 'progress' },
  { label: 'Sau nghiệm thu, bàn giao', pct: 0, trigger: 'accept' },
];
const PLAN_STATE = {
  paid: { label: 'Đã thu', cls: 's-done' },
  overdue: { label: 'Quá hạn', cls: 's-bad' },
  due: { label: 'Đến hạn', cls: 's-quote' },
  later: { label: 'Chưa đến hạn', cls: 's-later' },
};
const PAY_METHOD = { transfer: 'Chuyển khoản', cash: 'Tiền mặt' };

const rowAmount = r => Math.round((Number(r.qty) || 0) * (Number(r.price) || 0));
function quoteTotals(q) {
  const sub = (q?.rows || []).reduce((s, r) => s + rowAmount(r), 0);
  const d = q?.discount || {};
  let disc = 0;
  if (d.type === 'percent') disc = Math.round(sub * Math.min(Math.max(Number(d.value) || 0, 0), 100) / 100);
  else disc = Math.min(Math.max(Math.round(Number(d.value) || 0), 0), sub);
  return { sub, disc, total: sub - disc };
}
const isClosed = o => o.status !== 'quote';
const lastVersion = o => (o.versions && o.versions.length ? o.versions[o.versions.length - 1] : null);
const headQuote = o => (isClosed(o) ? lastVersion(o)?.quote : o.draft) || newQuote();
const changeSigned = c => (c.sign < 0 ? -c.amount : c.amount);
const confirmedChanges = o => (o.changes || []).filter(c => c.status === 'confirmed').reduce((s, c) => s + changeSigned(c), 0);
function orderTotal(o) {
  if (!isClosed(o)) return quoteTotals(o.draft).total;
  const v = lastVersion(o);
  return (v ? v.total : 0) + confirmedChanges(o);
}
/* ---------- lịch thanh toán theo đợt ---------- */
const planTemplate = () => { const t = settings().planTemplate; return Array.isArray(t) && t.length ? t : DEFAULT_PLAN; };
/* mỗi đợt tính theo % (mặc định) hoặc số tiền cố định (fixed + amt); đợt cuối luôn lấy phần còn lại */
const planRow = r => ({ id: r.id || uid('d'), label: r.label || '', pct: Number(r.pct) || 0, trigger: TRIGGERS[r.trigger] ? r.trigger : 'date', ...(r.fixed ? { fixed: true, amt: Math.max(0, Math.round(Number(r.amt) || 0)) } : {}) });
const newPlan = (tpl = planTemplate()) => tpl.map(r => planRow({ ...r, id: '' }));
const planCopy = (plan, keepId = true) => (plan || []).map(r => planRow({ ...r, id: keepId ? r.id : '' }));
const PLAN_PRESETS = {
  '2': { label: '2 đợt', rows: [{ label: 'Đặt cọc khi ký hợp đồng', pct: 50, trigger: 'sign' }, { label: 'Sau nghiệm thu, bàn giao', pct: 0, trigger: 'accept' }] },
  '3': { label: '3 đợt', rows: DEFAULT_PLAN },
  '4': { label: '4 đợt', rows: [{ label: 'Đặt cọc khi ký hợp đồng', pct: 30, trigger: 'sign' }, { label: 'Khi bắt đầu sản xuất, thi công', pct: 30, trigger: 'progress' }, { label: 'Khi lắp đặt xong', pct: 30, trigger: 'date' }, { label: 'Sau nghiệm thu, bàn giao', pct: 0, trigger: 'accept' }] },
};
const planPctSum = plan => (plan || []).slice(0, -1).reduce((s, r) => s + (r.fixed ? 0 : Number(r.pct) || 0), 0);
function planAmounts(plan, total) {
  const rows = plan || []; let used = 0;
  return rows.map((r, i) => {
    const last = i === rows.length - 1;
    let amount;
    if (last) amount = total - used;
    else { amount = r.fixed ? Math.round(Number(r.amt) || 0) : Math.round(total * (Number(r.pct) || 0) / 100); used += amount; }
    return { ...r, n: i + 1, last, amount: Math.max(0, amount), raw: amount };
  });
}
/* các đợt trước đã chiếm hết giá trị đơn → đợt cuối bằng 0 */
function planOver(plan, total) {
  if (!plan || plan.length < 2) return false;
  if (!(total > 0)) return planPctSum(plan) >= 100;
  return planAmounts(plan, total)[plan.length - 1].raw <= 0;
}
function planWarnText(plan, total) {
  if (!(total > 0)) return `Các đợt trước đã chiếm ${QF.format(planPctSum(plan))}%. Đợt cuối sẽ bằng 0, hãy giảm bớt.`;
  const used = planAmounts(plan, total).slice(0, -1).reduce((s, r) => s + r.raw, 0);
  return `Các đợt trước đã chiếm ${money(used)} đ, bằng hoặc hơn giá trị ${money(total)} đ. Đợt cuối sẽ bằng 0, hãy giảm bớt.`;
}
/* Không chia đợt (tắt cho đơn này, hoặc tắt cả tính năng): coi như một khoản thu một lần, đến hạn khi nghiệm thu hoặc theo ngày hẹn */
const usePlan = o => feat('plan') && Array.isArray(o.plan) && o.plan.length > 0;
const effPlan = o => (usePlan(o) ? o.plan : [{ id: 'all', label: 'Thanh toán phần còn lại', pct: 0, trigger: 'accept', due: o.payDue || '', one: true }]);
const quotePlan = q => (feat('plan') && Array.isArray(q?.plan) ? q.plan : []);
const dotLabel = r => (r.one ? 'Thanh toán' : 'Đợt ' + r.n);
const dotName = r => (r.one ? 'tiền còn lại' : 'đợt ' + r.n);
const payNote = r => (r.one ? 'Thanh toán phần còn lại' : `Thanh toán đợt ${r.n}: ${r.label || ''}`);
function triggerReached(o, r) {
  if (r.reached) return true;
  if (r.trigger === 'sign') return isClosed(o);
  if (r.trigger === 'progress') return o.status === 'building' || o.status === 'done' || !!o.handover;
  if (r.trigger === 'accept') return o.status === 'done' || !!o.handover;
  return false;
}
/* =========================================================
   TIỀN CỦA MỘT ĐƠN — mọi con số về tiền của đơn đều lấy từ đây
   (thẻ đơn, trang đơn, Hôm nay, lọc Cần thu, phiếu thu, PDF báo giá).
   orderMoney(đơn, tùy chọn) → { base, chg, total, paid, due, over, rows, next }
     base  : giá trị báo giá làm gốc chia đợt (bản chốt mới nhất, hoặc báo giá đang soạn)
     chg   : phát sinh đã xác nhận (cộng/trừ dần từ đợt cuối)
     rows  : các đợt { n, label, amount, paid, left, state, last, one?, fixed? }
   Tùy chọn (dùng khi xem trước / in bản khác):
     quote : tính theo báo giá này thay cho bản chốt (bản đang sửa, bản cũ)
     plan  : dùng lịch này thay cho lịch của đơn (màn sửa lịch)
     pays  : false = không trừ tiền đã trả (in bản cũ đã bị thay)
   ========================================================= */
function orderMoney(o, { quote = null, plan = null, pays = true } = {}) {
  const closed = isClosed(o), v = lastVersion(o);
  const base = quote ? quoteTotals(quote).total : closed ? (v ? v.total : 0) : quoteTotals(o.draft).total;
  const chg = closed && pays ? confirmedChanges(o) : 0;
  const P = plan || (quote ? quotePlan(quote) : closed ? effPlan(o) : quotePlan(o.draft));
  const rows = planAmounts(P, base);
  /* phát sinh: cộng vào đợt cuối; nếu giảm tiền thì trừ lùi dần từ đợt cuối */
  let adj = chg;
  for (let i = rows.length - 1; i >= 0 && adj !== 0; i--) {
    const nv = rows[i].amount + adj;
    if (nv >= 0 || i === 0) { rows[i].amount = Math.max(0, nv); adj = 0; }
    else { adj = nv; rows[i].amount = 0; }
  }
  /* tiền khách đã trả lấp dần từ đợt 1 */
  const paid = pays ? orderPaid(o) : 0, T = today();
  let pool = paid;
  for (const r of rows) {
    r.paid = Math.min(pool, r.amount); pool -= r.paid; r.left = r.amount - r.paid;
    r.state = r.left <= 0 ? 'paid' : r.due && r.due < T ? 'overdue' : closed && (triggerReached(o, r) || (r.due && r.due <= T)) ? 'due' : 'later';
  }
  const total = base + chg;
  /* báo giá chưa chốt: chưa có gì phải thu (giống orderDue) */
  return { base, chg, total, paid, due: closed ? Math.max(0, total - paid) : 0, over: Math.max(0, paid - total), rows, next: closed ? rows.find(r => r.left > 0) || null : null };
}
/* các hàm gọn cho đơn đã chốt (đơn đang báo giá chưa có gì phải thu) */
const planStatus = o => (isClosed(o) ? orderMoney(o).rows : []);
const nextInstallment = o => (isClosed(o) ? orderMoney(o).next : null);
const overdueAmount = o => planStatus(o).filter(r => r.state === 'overdue').reduce((s, r) => s + r.left, 0);
const dueNowAmount = o => planStatus(o).filter(r => r.state === 'overdue' || r.state === 'due').reduce((s, r) => s + r.left, 0);
function mergePlan(oldPlan, newPlanRows) {
  return (newPlanRows || []).map(r => { const old = (oldPlan || []).find(x => x.id === r.id); return { ...planRow(r), due: old?.due || r.due || '', reached: old?.reached || false }; });
}
function normalizeOrder(o) {
  for (const k of ['payments', 'changes', 'attachments', 'notes', 'log', 'versions']) if (!Array.isArray(o[k])) o[k] = [];
  if (o.payReqs && !Array.isArray(o.payReqs)) o.payReqs = [];
  let n = o.payments.reduce((m, p) => Math.max(m, p.no || 0), 0);
  [...o.payments].sort((a, b) => String(a.createdAt || a.date).localeCompare(String(b.createdAt || b.date))).forEach(p => { if (!p.no) p.no = ++n; if (!p.method) p.method = 'transfer'; });
  return o;
}
const receiptNo = (o, p) => `PT-${o.code}-${pad2(p.no || 0)}`;
async function sha256Hex(str) {
  try {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    let h = 2166136261; for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
}
async function makeSignRecord(img, name, content) {
  const at = new Date().toISOString();
  const hash = (await sha256Hex(JSON.stringify(content) + '|' + at + '|' + name)).slice(0, 16).toUpperCase();
  return { img, name, at, hash };
}
function addMonths(s, m) { const [y, mo, d] = s.split('-').map(Number); const dt = new Date(y, mo - 1 + m, d); if (dt.getDate() !== d) dt.setDate(0); return dstr(dt); }

const orderPaid = o => (o.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
const orderDue = o => (isClosed(o) ? Math.max(0, orderTotal(o) - orderPaid(o)) : 0);
const orderOver = o => (isClosed(o) ? Math.max(0, orderPaid(o) - orderTotal(o)) : 0);
/* Các sự kiện làm thay đổi giá trị đơn đã chốt, tính theo ngày */
function valueEvents(o) {
  if (!isClosed(o)) return [];
  const ev = [];
  (o.versions || []).forEach((v, i, arr) => {
    if (i === 0) ev.push({ date: v.closedAt, amount: v.total, kind: 'close', label: 'Chốt đơn' + (arr.length > 1 ? ' (bản 1)' : '') });
    else ev.push({ date: v.closedAt, amount: v.total - arr[i - 1].total, kind: 'revise', label: `Chốt bản ${v.no} (điều chỉnh báo giá)` });
  });
  (o.changes || []).filter(c => c.status === 'confirmed').forEach(c => ev.push({ date: c.confirmedAt, amount: changeSigned(c), kind: 'change', label: 'Phát sinh: ' + c.title }));
  return ev;
}
function newQuote() {
  const st = settings();
  return { date: today(), customer: { name: '', phone: '', address: '' }, project: '', rows: [], discount: { type: 'amount', value: 0 }, note: st.defaultNote || '', terms: st.defaultTerms || '', plan: feat('plan') && st.planAuto !== false ? newPlan() : [] };
}
const newRow = (p = {}) => ({ id: uid('r'), name: '', material: '', unit: 'm²', qty: 0, price: 0, dims: null, ...p });
function nextCode() {
  const st = settings();
  const pre = (st.codePrefix || 'BG').replace(/[^A-Za-z0-9-]/g, '').slice(0, 6) || 'BG';
  const d = new Date();
  const stem = `${pre}${String(d.getFullYear()).slice(2)}${pad2(d.getMonth() + 1)}-`;
  /* làm việc nhóm: máy chủ cấp số chính thức khi lưu, tránh 2 máy cùng ra một số */
  if (Store.mode === 'team') return stem + 'T' + Math.random().toString(36).slice(2, 5).toUpperCase();
  let max = 0;
  for (const o of Store.list('orders')) if (o.code && !o.codeTemp && o.code.startsWith(stem)) max = Math.max(max, parseInt(o.code.slice(stem.length), 10) || 0);
  return stem + pad2(max + 1);
}
const DIM_UNIT = { mm: 0.001, cm: 0.01, m: 1 };
function dimsQty(unit, d) {
  const k = DIM_UNIT[d.u] || 0.001, n = Number(d.n) || 0;
  if (unit === 'm²') return round3((Number(d.a) || 0) * k * (Number(d.b) || 0) * k * n);
  if (unit === 'md') return round3((Number(d.a) || 0) * k * n);
  return round3(n);
}
function dimText(unit, d) {
  if (!d) return '';
  const a = QF.format(Number(d.a) || 0), b = QF.format(Number(d.b) || 0), n = Number(d.n) || 1;
  let s;
  if (unit === 'm²') s = `${a} × ${b} ${d.u}`;
  else if (unit === 'md') s = `dài ${a} ${d.u}`;
  else s = (Number(d.a) || Number(d.b)) ? `${a} × ${b} ${d.u}` : '';
  if (n !== 1) s += (s ? ' × ' : '') + `${QF.format(n)}`;
  return s;
}
function addLog(o, text) { (o.log ||= []).push({ id: uid('l'), at: new Date().toISOString(), text, ...(Store.mode === 'team' && Team.myName() ? { by: Team.myName() } : {}) }); }

/* =========================================================
   LƯU TRỮ: claude.ai db (đồng bộ tài khoản) hoặc IndexedDB (máy này)
   ========================================================= */
const COLS = ['orders', 'customers', 'catalog', 'app', 'costs', 'cash'];
const caps = { db: null, assets: null, downloads: null };

function cloudBackend(db) {
  return {
    async loadAll() {
      const out = {};
      for (const c of COLS) {
        const snap = await db.collection(c).get();
        out[c] = snap.docs.filter(d => d.exists).map(d => clone(d.data()));
      }
      return out;
    },
    set: (c, id, doc) => withTimeout(db.collection(c).doc(id).set(doc), 15000),
    del: (c, id) => withTimeout(db.collection(c).doc(id).delete(), 15000),
  };
}
const withTimeout = (p, ms) => Promise.race([p, sleep(ms).then(() => { throw { code: 'unavailable', message: 'timeout' }; })]);
function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('so-noi-that', 2);
    r.onupgradeneeded = () => { for (const n of ['docs', 'blobs', 'outbox']) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const idbReq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function localBackend() {
  let idb = null;
  try { idb = await idbOpen(); } catch (e) { idb = null; }
  const mem = new Map(), memBlobs = new Map();
  const tx = (store, mode) => idb.transaction(store, mode).objectStore(store);
  return {
    persistent: !!idb,
    async loadAll() {
      const out = Object.fromEntries(COLS.map(c => [c, []]));
      if (!idb) return out;
      const keys = await idbReq(tx('docs', 'readonly').getAllKeys());
      const vals = await idbReq(tx('docs', 'readonly').getAll());
      keys.forEach((k, i) => { const c = String(k).split('/')[0]; if (out[c]) out[c].push(vals[i]); });
      return out;
    },
    async set(c, id, doc) { if (!idb) { mem.set(c + '/' + id, doc); return; } await idbReq(tx('docs', 'readwrite').put(doc, c + '/' + id)); },
    async del(c, id) { if (!idb) { mem.delete(c + '/' + id); return; } await idbReq(tx('docs', 'readwrite').delete(c + '/' + id)); },
    async putBlob(k, b) { if (!idb) { memBlobs.set(k, b); return; } await idbReq(tx('blobs', 'readwrite').put(b, k)); },
    async getBlob(k) { if (!idb) return memBlobs.get(k); return idbReq(tx('blobs', 'readonly').get(k)); },
    async delBlob(k) { if (!idb) { memBlobs.delete(k); return; } await idbReq(tx('blobs', 'readwrite').delete(k)); },
  };
}

/* Hàng chờ trên máy: giữ thay đổi chưa gửi được lên máy chủ (mất sóng, tải lại trang) */
const Outbox = {
  db: null, ok: false,
  async open() { try { this.db = await idbOpen(); this.ok = true; } catch (e) { this.db = null; } },
  st(mode) { return this.db.transaction('outbox', mode).objectStore('outbox'); },
  async put(key, entry) { if (!this.db) return; try { await idbReq(this.st('readwrite').put(entry, key)); } catch (e) { /* bỏ qua */ } },
  async done(key, ts) { if (!this.db) return; try { const cur = await idbReq(this.st('readonly').get(key)); if (cur && cur.ts === ts) await idbReq(this.st('readwrite').delete(key)); } catch (e) { /* bỏ qua */ } },
  async all() {
    if (!this.db) return [];
    try { const keys = await idbReq(this.st('readonly').getAllKeys()); const vals = await idbReq(this.st('readonly').getAll()); return keys.map((k, i) => ({ key: k, ...vals[i] })); } catch (e) { return []; }
  },
};

const Store = {
  mode: 'loading', backend: null, loadedAt: 0,
  data: Object.fromEntries(COLS.map(c => [c, new Map()])),
  pending: new Map(), timers: new Map(), inflight: new Set(), again: new Set(), failed: new Map(), base: new Map(),
  lastSaved: null, lastError: '', lastErrorCode: '', seq: 0,
  list(c) { return [...this.data[c].values()]; },
  get(c, id) { return this.data[c].get(id); },
  async loadAll() {
    const all = await this.backend.loadAll();
    for (const c of COLS) { this.data[c] = new Map((all[c] || []).filter(d => d && d.id).map(d => [d.id, c === 'orders' ? normalizeOrder(d) : d])); }
    this.base = new Map();
    for (const c of COLS) for (const d of this.data[c].values()) this.base.set(c + '/' + d.id, clone(d));
    this.loadedAt = Date.now();
  },
  async restoreOutbox() {
    const items = (await Outbox.all()).filter(e => e && e.c && e.id && Date.now() - e.ts < 30 * 864e5);
    for (const e of items) {
      if (e.op === 'del') this.data[e.c]?.delete(e.id);
      else if (e.doc) {
        const cur = this.data[e.c]?.get(e.id), key = e.c + '/' + e.id;
        /* bản trên máy chủ có thể đã đổi trong lúc mất mạng: gộp lại */
        let doc = e.doc;
        if (this.mode === 'team' && cur && e.base) { const r = mergeDoc(e.base, e.doc, cur); doc = r.doc; }
        if (this.mode === 'team' && e.base) this.base.set(key, clone(e.base));
        if (cur) replaceInPlace(cur, e.c === 'orders' ? normalizeOrder(doc) : doc); else this.data[e.c]?.set(e.id, e.c === 'orders' ? normalizeOrder(doc) : doc);
      }
      this.queue(e.c, e.id, e.op, 0);
    }
    return items.length;
  },
  put(c, doc, delay = 450) {
    /* máy chủ chung: gom các lần gõ phím lại, đỡ tốn lượt ghi */
    if (this.mode === 'team' && delay > 0) delay = Math.max(delay, 1500);
    this.data[c].set(doc.id, doc);
    this.queue(c, doc.id, 'set', delay);
  },
  del(c, id) {
    this.data[c].delete(id);
    this.queue(c, id, 'del', 0);
  },
  queue(c, id, op, delay) {
    const key = c + '/' + id;
    this.pending.set(key, { c, id, op, ts: Date.now() * 1000 + (this.seq++ % 1000) });
    this.failed.delete(key);
    clearTimeout(this.timers.get(key));
    this.timers.set(key, setTimeout(() => this.flushKey(key), delay));
    updateSaveStatus();
  },
  async flushKey(key) {
    clearTimeout(this.timers.get(key)); this.timers.delete(key);
    if (this.inflight.has(key)) { this.again.add(key); return; }
    const p = this.pending.get(key);
    if (!p) return;
    this.pending.delete(key);
    this.inflight.add(key);
    updateSaveStatus();
    let tries = 0;
    const doc = p.op === 'del' ? null : this.data[p.c].get(p.id);
    const snapshot = doc ? clone(doc) : null;
    const base = this.base.get(key) || null;
    const remote = this.mode === 'cloud' || this.mode === 'team';
    if (remote) await Outbox.put(key, { c: p.c, id: p.id, op: p.op, doc: snapshot, base, ts: p.ts });
    for (;;) {
      try {
        if (p.op === 'del') { await this.backend.del(p.c, p.id); this.base.delete(key); }
        else if (snapshot) {
          const res = await this.backend.set(p.c, p.id, snapshot, base);
          if (res && res.doc) this.afterWrite(p.c, p.id, snapshot, res.doc); else this.base.set(key, snapshot);
        }
        this.lastSaved = new Date(); this.lastError = ''; this.lastErrorCode = '';
        if (remote) Outbox.done(key, p.ts);
        break;
      } catch (e) {
        const code = e && e.code;
        if ((code === 'unavailable' || code === 'store_unavailable') && tries++ < 1 && navigator.onLine !== false) { await sleep(600 + Math.random() * 600); continue; }
        if (code === 'permission') { this.lastErrorCode = code; this.lastError = saveErrorText(e); Outbox.done(key, p.ts); this.dropLocal(p.c, p.id); break; }
        this.lastErrorCode = code || 'unavailable';
        this.lastError = saveErrorText(e);
        if (!this.pending.has(key)) this.failed.set(key, p);
        break;
      }
    }
    this.inflight.delete(key);
    if (this.again.has(key)) { this.again.delete(key); if (this.pending.has(key)) this.flushKey(key); }
    updateSaveStatus();
  },
  flushAll() {
    for (const [k, p] of this.failed) { if (!this.pending.has(k)) this.pending.set(k, p); }
    this.failed.clear();
    for (const k of [...this.pending.keys()]) this.flushKey(k);
  },
  busy() { return this.pending.size + this.inflight.size; },
  /* sau khi máy chủ gộp xong: cập nhật bản trên máy, giữ phần đang gõ dở */
  afterWrite(c, id, sent, merged) {
    const key = c + '/' + id, cur = this.data[c].get(id);
    const m = clone(merged); delete m.id; m.id = id;
    this.base.set(key, clone(m));
    if (!cur) return;
    const same = J(cur) === J(sent);
    const next = same ? m : mergeDoc(sent, cur, m).doc;
    const changed = J(next) !== J(cur);
    replaceInPlace(cur, c === 'orders' ? normalizeOrder(next) : next);
    if (changed) scheduleRender();
  },
  /* máy chủ báo có thay đổi do người khác làm */
  applyRemote(c, id, doc) {
    const key = c + '/' + id, cur = this.data[c].get(id);
    const busy = this.pending.has(key) || this.inflight.has(key) || this.failed.has(key);
    if (!doc) { if (!busy) { this.data[c].delete(id); this.base.delete(key); } scheduleRender(); return; }
    doc = clone(doc);
    if (cur && busy) {
      const r = mergeDoc(this.base.get(key) || {}, cur, doc);
      replaceInPlace(cur, c === 'orders' ? normalizeOrder(r.doc) : r.doc);
    } else if (cur) {
      if (J(cur) === J(c === 'orders' ? normalizeOrder(clone(doc)) : doc)) { this.base.set(key, clone(doc)); return; }
      replaceInPlace(cur, c === 'orders' ? normalizeOrder(doc) : doc);
    } else this.data[c].set(id, c === 'orders' ? normalizeOrder(doc) : doc);
    this.base.set(key, clone(doc));
    scheduleRender();
  },
  /* bị máy chủ từ chối vì không có quyền: bỏ bản trên máy, lấy lại bản trên máy chủ */
  dropLocal(c, id) {
    const key = c + '/' + id, b = this.base.get(key), cur = this.data[c].get(id);
    if (b && cur) replaceInPlace(cur, c === 'orders' ? normalizeOrder(clone(b)) : clone(b));
    else if (!b) this.data[c].delete(id);
    this.failed.delete(key); scheduleRender();
  },
  offline() { return this.failed.size > 0 && (navigator.onLine === false || this.lastErrorCode === 'unavailable' || this.lastErrorCode === 'store_unavailable'); },
  async idle(ms = 8000) { const t = Date.now(); this.flushAll(); while (this.busy() && Date.now() - t < ms) await sleep(60); return !this.busy() && !this.failed.size; },
};
function saveErrorText(e) {
  const c = e && e.code;
  if (c === 'quota_exceeded') return 'Bộ nhớ của app đã đầy. Hãy xóa bớt ảnh hoặc đơn cũ rồi thử lại.';
  if (c === 'invalid_argument') return 'Dữ liệu quá lớn hoặc không hợp lệ nên chưa lưu được. Hãy bớt nội dung rồi thử lại.';
  if (c === 'revoked' || c === 'not_granted') return 'Mất quyền truy cập dữ liệu. Hãy tải lại trang.';
  if (c === 'resource_exhausted') return 'Lưu quá nhanh, hệ thống đang chờ. Bấm Thử lại sau vài giây.';
  if (c === 'permission') return 'Bạn không có quyền sửa mục này. Đã trả lại bản trên máy chủ.';
  return 'Mất mạng. Thay đổi đang được giữ trên máy này và sẽ tự gửi khi có mạng.';
}
const settings = () => ({ ...DEFAULT_SETTINGS, ...(Store.get('app', 'settings') || {}) });
/* tính năng bật/tắt trong Cài đặt → Tùy chỉnh app */
const feat = k => (settings().features || {})[k] !== false;
function saveSettings(patch) { Store.put('app', { ...settings(), ...patch, id: 'settings' }, 600); }
const meta = () => Store.get('app', 'meta') || { id: 'meta' };
function saveMeta(patch) { Store.put('app', { ...meta(), ...patch, id: 'meta' }, 0); }

/* Tệp đính kèm */
const blobUrls = new Map();
async function attSrc(att) {
  if (att.store === 'asset') return Store.mode === 'cloud' ? '/_blob/' + att.ref : '';
  if (blobUrls.has(att.ref)) return blobUrls.get(att.ref);
  if (!Store.backend.getBlob) return '';
  let b = null; try { b = await Store.backend.getBlob(att.ref, att); } catch (e) { b = null; }
  if (!b) return '';
  const u = URL.createObjectURL(b); blobUrls.set(att.ref, u); return u;
}
async function removeAttBlob(att) {
  try {
    if (att.store === 'asset' && caps.assets) await caps.assets.delete(att.ref);
    else if ((att.store === 'idb' || att.store === 'fs') && Store.backend.delBlob) await Store.backend.delBlob(att.ref, att);
  } catch (e) { /* tệp có thể đã bị xóa trước đó */ }
}
async function storeFile(file, extra = {}, o = null) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  const isImg = /^image\//.test(file.type);
  if (!isPdf && !isImg) throw { code: 'bad_type' };
  const blob = isImg ? await downscaleImage(file) : file;
  if (!blob) throw { code: 'bad_image' };
  const type = isPdf ? 'application/pdf' : (blob.type || 'image/jpeg');
  const base = { id: uid('a'), name: file.name || 'anh.jpg', kind: isPdf ? 'pdf' : 'image', at: new Date().toISOString(), ...extra };
  if (Store.mode === 'cloud') {
    if (!caps.assets) throw { code: 'not_granted' };
    const r = await caps.assets.upload(blob, { type });
    return { ...base, store: 'asset', ref: r.id };
  }
  if (Store.mode === 'team') {
    if (blob.size > 3e6) throw { code: 'too_large_team' };
    if (navigator.onLine === false) throw { code: 'offline_team' };
    const r = await Store.backend.putFile(blob, type, o);
    return { ...base, store: 'fs', ref: r.ref, parts: r.parts };
  }
  const key = uid('b'); await Store.backend.putBlob(key, blob);
  return { ...base, store: 'idb', ref: key };
}
function storeFileError(e, name) {
  const c = e && e.code;
  if (c === 'bad_type') return `“${name}” không phải ảnh hoặc PDF.`;
  if (c === 'bad_image') return `Không đọc được ảnh “${name}”.`;
  if (c === 'not_granted') return 'Bạn không có quyền thêm ảnh vào app này.';
  if (c === 'too_large') return `“${name}” quá lớn (tối đa 20 MB).`;
  if (c === 'too_large_team') return `“${name}” quá lớn để lưu lên máy chủ chung (tối đa 3 MB). Hãy chụp màn hình bản vẽ hoặc giảm dung lượng PDF.`;
  if (c === 'offline_team') return 'Cần có mạng để tải ảnh lên máy chủ chung.';
  if (c === 'permission') return 'Bạn không có quyền thêm tệp vào đơn này.';
  if (c === 'quota_or_state') return 'Bộ nhớ ảnh của app đã đầy. Hãy xóa bớt ảnh cũ.';
  return `Không tải được “${name}”. Kiểm tra mạng rồi thử lại.`;
}
function downscaleImage(file, maxSide = 2000, q = 0.85) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      if (s >= 1 && file.size < 1.5e6 && /jpe?g|png|webp/.test(file.type)) { URL.revokeObjectURL(url); resolve(file); return; }
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.naturalWidth * s); cv.height = Math.round(img.naturalHeight * s);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      cv.toBlob(b => resolve(b || file), 'image/jpeg', q);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/* Lưu file ra máy */
const inFrame = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
const ownSite = !inFrame && !(window.claude && typeof window.claude.use === 'function');
const isStandalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } };
async function saveFile(filename, blob) {
  let dl = caps.downloads;
  if (!dl && window.claude && typeof window.claude.use === 'function') { try { dl = caps.downloads = await window.claude.use('downloads'); } catch (e) { dl = null; } }
  if (dl) {
    try { await dl.save({ filename, data: blob }); toast('Đã lưu ' + filename); return true; }
    catch (e) {
      if (e && e.code === 'declined') { toast('Đã hủy lưu file'); return false; }
      if (e && e.code === 'rate_limited') { toast('Đang có một hộp thoại lưu file khác. Hãy thử lại sau giây lát.', 'bad'); return false; }
      toast('Không lưu được file ở chế độ xem này. Hãy mở app trong claude.ai rồi thử lại.', 'bad'); return false;
    }
  }
  if (!inFrame) {
    const type = blob.type || ({ pdf: 'application/pdf', png: 'image/png', json: 'application/json', csv: 'text/csv' })[filename.split('.').pop()] || 'application/octet-stream';
    const file = new File([blob], filename, { type });
    if (navigator.canShare && navigator.share) {
      let can = false; try { can = navigator.canShare({ files: [file] }); } catch (e) { can = false; }
      if (can) {
        const doShare = async () => {
          try { await navigator.share({ files: [file] }); return 'ok'; }
          catch (e) { return e && e.name === 'AbortError' ? 'abort' : (e && e.name === 'NotAllowedError' ? 'gesture' : 'fail'); }
        };
        let r = await doShare();
        if (r === 'gesture') {
          /* iOS chỉ cho mở bảng chia sẻ ngay sau khi chạm: hỏi chạm thêm một lần */
          r = await new Promise(res => {
            let done = false;
            const el = openSheet({
              title: 'File đã sẵn sàng', html: `<p><b>${esc(filename)}</b></p><p class="muted">Chạm “Chia sẻ” rồi chọn Zalo, hoặc “Lưu vào Tệp” / “Lưu hình ảnh”.</p>`,
              foot: `<button class="btn" data-sa="close">Hủy</button><button class="btn primary" data-sa="share">Chia sẻ</button>`,
              onClick: async (a2, b2, el2) => { if (a2 !== 'share') return; done = true; closeSheet(el2); res(await doShare()); },
            });
            const obs = new MutationObserver(() => { if (!document.body.contains(el)) { obs.disconnect(); if (!done) res('abort'); } });
            obs.observe(document.body, { childList: true });
          });
        }
        if (r === 'ok') { toast('Đã mở bảng chia sẻ'); return true; }
        if (r === 'abort') { toast('Đã hủy'); return false; }
      }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    toast('Đã tải ' + filename); return true;
  }
  toast('Trình xem này không cho tải file. Hãy mở app trong claude.ai rồi thử lại.', 'bad');
  return false;
}
