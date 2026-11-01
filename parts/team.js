/* =========================================================
   LÀM VIỆC NHÓM – máy chủ chung Firebase (Firestore + Auth)
   Mỗi lần lưu: đọc bản đang có trên máy chủ → gộp 3 chiều với bản của mình
   → ghi trong một giao dịch. Phiếu thu, phát sinh, ghi chú của người khác
   không bao giờ bị ghi đè mất.
   ========================================================= */
const FB_VER = '10.14.1';
const ROLES = { owner: 'Chủ', manager: 'Kế toán / Quản lý', sale: 'Sale / Thiết kế', worker: 'Thợ' };
const ROLE_HINT = {
  manager: 'Xem mọi đơn, ghi phiếu thu, xác nhận tiền sale báo, phân công. Không sửa báo giá.',
  sale: 'Chỉ thấy khách và đơn mình phụ trách. Lập, chốt báo giá. Tiền thu được chỉ “báo đã thu”, chờ xác nhận.',
  worker: 'Chỉ thấy phiếu công việc được giao: tên khách, địa chỉ, hạng mục, kích thước. Không thấy giá.',
};
const PERM = {
  quote: ['owner', 'sale'],
  pay: ['owner', 'manager'],
  delPay: ['owner'],
  delOrder: ['owner'],
  catalog: ['owner', 'manager'],
  settings: ['owner'],
  members: ['owner'],
  assign: ['owner', 'manager'],
  backup: ['owner'],
  cost: ['owner', 'manager'],
  cash: ['owner', 'manager'],
};
const tlog = (...a) => { if (Team.cfg && Team.cfg.emulator) console.info('[snt]', ...a); };
function hardReload(why) { tlog('reload', why); location.reload(); }
const can = a => !Team.on() || (PERM[a] || []).includes(Team.role);

/* ---------- gộp 3 chiều (thuần, không phụ thuộc máy chủ) ---------- */
const META_KEYS = new Set(['rev', 'updatedAt', 'updatedBy', 'updatedByName']);
const ARR_KEYS = {
  payments: x => x.id, payReqs: x => x.id, changes: x => x.id, attachments: x => x.id, notes: x => x.id,
  log: x => x.id || ((x.at || '') + '|' + (x.text || '')),
  versions: x => x.closedTs || ('v' + x.no),
};
/* so sánh không phụ thuộc thứ tự khóa (máy chủ trả về khóa theo thứ tự khác) */
function stable(v) {
  if (Array.isArray(v)) return v.map(x => (x === undefined ? null : stable(x)));
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v).sort()) if (v[k] !== undefined) o[k] = stable(v[k]); return o; }
  return v;
}
const J = v => JSON.stringify(v === undefined ? null : stable(v));
function mergeArr(base, mine, theirs, keyOf) {
  base = Array.isArray(base) ? base : []; mine = Array.isArray(mine) ? mine : []; theirs = Array.isArray(theirs) ? theirs : [];
  const B = new Map(base.map(x => [keyOf(x), x])), M = new Map(mine.map(x => [keyOf(x), x]));
  const out = [], seen = new Set(); let clash = false;
  for (const t of theirs) {
    const k = keyOf(t); seen.add(k);
    const b = B.get(k);
    if (!M.has(k)) {
      /* mình đã xóa mục này: chỉ bỏ khi người kia không sửa gì sau đó */
      if (b && J(b) === J(t)) continue;
      out.push(t); continue;
    }
    const m = M.get(k);
    if (J(m) === J(t) || (b && J(m) === J(b))) out.push(t);
    else if (b && J(t) === J(b)) out.push(m);
    else { out.push(t); clash = true; }
  }
  for (const m of mine) {
    const k = keyOf(m); if (seen.has(k)) continue;
    const b = B.get(k);
    if (b && J(b) === J(m)) continue; /* người kia đã xóa, mình không sửa → xóa theo */
    out.push(m);
  }
  return { arr: out, clash };
}
function mergeDoc(base, mine, theirs, lock = []) {
  base = base || {}; mine = mine || {}; theirs = theirs || {};
  const out = {}, conflicts = [];
  const keys = new Set([...Object.keys(mine), ...Object.keys(theirs)]);
  for (const k of keys) {
    const m = mine[k], t = theirs[k], b = base[k];
    if (META_KEYS.has(k)) { const v = t !== undefined ? t : m; if (v !== undefined) out[k] = v; continue; }
    if (lock.includes(k)) { if (t !== undefined) out[k] = t; continue; }
    if (ARR_KEYS[k] && (Array.isArray(m) || Array.isArray(t))) {
      const r = mergeArr(b, m, t, ARR_KEYS[k]); out[k] = r.arr; if (r.clash) conflicts.push(k); continue;
    }
    const jm = J(m), jt = J(t), jb = J(b);
    let v;
    if (jm === jt || jm === jb) v = t;
    else if (jt === jb) v = m;
    else { v = t; conflicts.push(k); }
    if (v !== undefined) out[k] = v;
  }
  return { doc: JSON.parse(JSON.stringify(out)), conflicts };
}
/* Sau khi gộp: mục mới bị trùng số phiếu / số bản thì lấy số kế tiếp */
function fixNumbers(doc, theirs) {
  const notes = [];
  for (const k of ['payments', 'versions']) {
    const arr = doc[k]; if (!Array.isArray(arr) || !arr.length) continue;
    const onServer = new Set(((theirs && theirs[k]) || []).map(ARR_KEYS[k]));
    let max = arr.reduce((mx, x) => Math.max(mx, Number(x.no) || 0), 0);
    const used = new Set(arr.filter(x => onServer.has(ARR_KEYS[k](x))).map(x => x.no));
    for (const x of arr) {
      if (onServer.has(ARR_KEYS[k](x))) continue;
      if (x.no && used.has(x.no)) { const old = x.no; x.no = ++max; notes.push(k === 'payments' ? `Số phiếu thu ${pad2(old)} trùng với máy khác, đổi thành ${pad2(x.no)}` : `Bản ${old} trùng với máy khác, đổi thành bản ${x.no}`); }
      used.add(x.no);
    }
    if (k === 'versions') arr.sort((a, b) => a.no - b.no);
  }
  for (const n of notes) (doc.log ||= []).push({ id: uid('l'), at: new Date().toISOString(), text: n });
  return doc;
}
function replaceInPlace(target, src) {
  for (const k of Object.keys(target)) if (!(k in src)) delete target[k];
  return Object.assign(target, src);
}

/* ---------- tải bộ kết nối Firebase (chỉ ở bản cài lên iPad) ---------- */
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s); });
}
async function loadFirebase() {
  if (window.firebase && window.firebase.firestore && window.firebase.auth) return;
  const b = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
  await loadScript(b + 'firebase-app-compat.js');
  await Promise.all([loadScript(b + 'firebase-auth-compat.js'), loadScript(b + 'firebase-firestore-compat.js')]);
}
const b64u = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
function parseFbConfig(text) {
  const out = {};
  for (const k of ['apiKey', 'authDomain', 'projectId', 'appId', 'storageBucket', 'messagingSenderId']) {
    const m = String(text || '').match(new RegExp(`["']?${k}["']?\\s*:\\s*["']([^"']+)["']`));
    if (m) out[k] = m[1].trim();
  }
  return out.apiKey && out.projectId && out.appId ? out : null;
}
/* Mã mời dài: chứa luôn thông tin máy chủ, dán vào app nào cũng vào được */
function packInvite(cfg, wid, code) { return 'SNT1.' + b64u(JSON.stringify({ c: { apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, appId: cfg.appId }, w: wid, k: code })); }
function unpackInvite(s) {
  const m = String(s || '').match(/SNT1\.([A-Za-z0-9_-]+)/); if (!m) return null;
  try { const d = JSON.parse(unb64u(m[1])); return d && d.c && d.c.apiKey && d.k ? d : null; } catch (e) { return null; }
}
const randCode = (n = 8) => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const r = crypto.getRandomValues(new Uint8Array(n)); return [...r].map(x => A[x % A.length]).join(''); };
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* bỏ qua */ } };

const Team = {
  cfg: null, wid: 'main', state: 'off', msg: '', app: null, auth: null, db: null, user: null, member: null, role: 'owner',
  members: new Map(), invites: new Map(), jobs: new Map(), conflicts: new Map(), jobSig: new Map(), unsubs: [], localCount: 0, busy: false,
  on() { return Store.mode === 'team'; },
  uid() { return this.user ? this.user.uid : ''; },
  myName() { return (this.member && this.member.name) || (this.user && this.user.email) || ''; },
  readCfg() {
    try { const v = JSON.parse(lsGet('snt-team') || 'null'); if (v && v.config && v.config.apiKey) { this.cfg = v.config; this.wid = v.wid || 'main'; return true; } } catch (e) { /* bỏ qua */ }
    this.cfg = null; return false;
  },
  saveCfg(config, wid = 'main') { lsSet('snt-team', JSON.stringify({ config, wid })); },
  w() { return this.db.collection('w').doc(this.wid); },
  col(c) { return this.w().collection(c); },
  async start() {
    this.state = 'boot'; this.msg = ''; render();
    try { await withTimeout(loadFirebase(), 25000); }
    catch (e) { this.state = 'error'; this.msg = 'Không tải được bộ kết nối máy chủ chung. Kiểm tra mạng rồi bấm Thử lại.'; render(); return; }
    if (!this.app) {
      this.app = firebase.initializeApp(this.cfg);
      this.auth = firebase.auth(); this.db = firebase.firestore();
      if (this.cfg.emulator) { this.auth.useEmulator('http://127.0.0.1:9099'); this.db.useEmulator('127.0.0.1', 8080); }
      try { await this.db.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* trình duyệt không hỗ trợ: vẫn chạy khi có mạng */ }
      this.auth.onAuthStateChanged(u => this.onUser(u));
    }
  },
  unsubAll() { for (const u of this.unsubs.splice(0)) { try { u(); } catch (e) { /* bỏ qua */ } } },
  onUser(u) {
    tlog('user', u && u.email);
    this.unsubAll(); this.user = u; this.member = null;
    if (!u) { this.state = 'signin'; render(); return; }
    this.state = 'boot'; render();
    let gotServer = false;
    const timer = setTimeout(() => { if (!gotServer && this.state === 'boot') { this.state = 'error'; this.msg = 'Chưa kết nối được máy chủ chung. Kiểm tra mạng rồi bấm Thử lại.'; render(); } }, 15000);
    this.unsubs.push(() => clearTimeout(timer));
    this.unsubs.push(this.col('members').doc(u.uid).onSnapshot({ includeMetadataChanges: true }, s => {
      const m = s.exists ? s.data() : null;
      if (!m && s.metadata.fromCache) return; /* chờ máy chủ trả lời */
      if (s.metadata.hasPendingWrites) return; /* chờ máy chủ xác nhận việc tạo xưởng / vào xưởng */
      gotServer = true; clearTimeout(timer);
      tlog('member', JSON.stringify(m), this.state, s.metadata.fromCache, s.metadata.hasPendingWrites);
      if (this.state === 'ready') { if (!m || !m.active || m.role !== this.role) hardReload('member ' + J(m) + ' role ' + this.role); else this.member = m; return; }
      this.member = m; this.afterMember();
    }, () => { gotServer = true; clearTimeout(timer); this.member = null; this.afterMember(); }));
  },
  async afterMember() {
    const m = this.member;
    if (!m) {
      this.state = 'join'; render();
      try { const lb = await localBackend(); const all = await lb.loadAll(); this.localCount = (all.orders || []).filter(o => !o.demo).length; } catch (e) { this.localCount = 0; }
      const inv = lsGet('snt-invite');
      if (inv && !this.busy) { lsSet('snt-invite', null); S.joinCode = inv; }
      render(); return;
    }
    if (!m.active) { this.state = 'locked'; render(); return; }
    if (this.busy) return;
    this.busy = true;
    try {
      this.role = m.role;
      Store.backend = teamBackend(this); await Outbox.open();
      Store.mode = 'loading';
      await withTimeout(Store.loadAll(), 30000);
      Store.mode = 'team'; this.state = 'ready';
      const n = await Store.restoreOutbox(); if (n) setTimeout(() => toast(`Đã khôi phục ${n} thay đổi chưa gửi lên máy chủ`), 300);
      if (m.role === 'worker') { S.tab = 'jobs'; }
      else { restoreView(); if (S.tab === 'jobs') S.tab = 'orders'; }
      toastBox(); render(); ensureFonts();
      if (lsGet('snt-migrate') === this.uid()) { lsSet('snt-migrate', null); this.migrateLocal(); }
    } catch (e) {
      this.state = 'error'; this.msg = 'Không tải được dữ liệu từ máy chủ chung. Kiểm tra mạng rồi bấm Thử lại.'; render();
    } finally { this.busy = false; }
  },
  async signIn(email, pass) { await this.auth.signInWithEmailAndPassword(email, pass); },
  async signUp(email, pass) { await this.auth.createUserWithEmailAndPassword(email, pass); },
  async reset(email) { await this.auth.sendPasswordResetEmail(email); },
  async signOut() {
    if (Store.busy() || Store.failed.size) {
      const ok = await confirmBox({ title: 'Còn thay đổi chưa gửi', text: `Còn ${Store.busy() + Store.failed.size} thay đổi chưa lên máy chủ. Đăng xuất bây giờ sẽ <b>mất</b> các thay đổi đó.`, ok: 'Vẫn đăng xuất', danger: true });
      if (!ok) return;
    }
    this.unsubAll();
    try { await this.auth.signOut(); } catch (e) { /* bỏ qua */ }
    /* xóa dữ liệu của người vừa đăng xuất khỏi máy (iPad dùng chung) */
    try { await this.db.terminate(); await this.db.clearPersistence(); } catch (e) { /* bỏ qua */ }
    try { const all = await Outbox.all(); for (const e of all) await idbReq(Outbox.st('readwrite').delete(e.key)); } catch (e) { /* bỏ qua */ }
    hardReload('signout');
  },
  disconnect() { lsSet('snt-team', null); lsSet('snt-invite', null); hardReload('disconnect'); },
  async createWorkshop(name, migrate) {
    const u = this.user, now = new Date().toISOString();
    const b = this.db.batch();
    b.set(this.w(), { createdBy: u.uid, createdAt: now, name: settings().shopName || 'Xưởng' });
    b.set(this.col('members').doc(u.uid), { role: 'owner', name, email: u.email || '', active: true, joinedAt: now });
    if (migrate) lsSet('snt-migrate', u.uid);
    await withTimeout(b.commit(), 20000);
  },
  async join(code, name) {
    const u = this.user, now = new Date().toISOString();
    const ref = this.col('invites').doc(code);
    const s = await withTimeout(ref.get(), 15000);
    if (!s.exists) throw { msg: 'Mã mời không đúng. Kiểm tra lại từng chữ.' };
    const d = s.data();
    if (d.used) throw { msg: 'Mã mời này đã được dùng. Xin chủ xưởng mã mới.' };
    if (d.exp && d.exp.toMillis && d.exp.toMillis() < Date.now()) throw { msg: 'Mã mời đã hết hạn. Xin chủ xưởng mã mới.' };
    const b = this.db.batch();
    b.set(this.col('members').doc(u.uid), { role: d.role, name, email: u.email || '', active: true, joinedAt: now, invite: code });
    b.update(ref, { used: true, usedBy: u.uid, usedAt: now });
    await withTimeout(b.commit(), 20000);
  },
  async createInvite(role) {
    const code = randCode(8);
    await withTimeout(this.col('invites').doc(code).set({ role, createdBy: this.uid(), createdAt: new Date().toISOString(), exp: firebase.firestore.Timestamp.fromMillis(Date.now() + 7 * 864e5), used: false }), 15000);
    return code;
  },
  async setMember(uid2, patch) { await withTimeout(this.col('members').doc(uid2).update(patch), 15000); },
  async migrateLocal() {
    try {
      const lb = await localBackend(); const all = await lb.loadAll();
      let n = 0;
      for (const c of COLS) for (const d of all[c] || []) {
        if (!d || !d.id || d.demo || Store.get(c, d.id)) continue;
        if (c === 'orders' || c === 'customers') d.owner = d.owner || this.uid();
        Store.put(c, c === 'orders' ? normalizeOrder(d) : d, 0); if (c === 'orders') n++;
      }
      if (n) toast(`Đang đưa ${n} đơn trên máy này lên máy chủ chung…`);
      render();
    } catch (e) { toast('Không đọc được dữ liệu cũ trên máy này.', 'bad'); }
  },
  async saveConflict(c, id, keys, mine, theirs) {
    const o = c === 'orders' ? (Store.get('orders', id) || mine) : mine;
    const doc = { id: uid('x'), c, oid: id, code: o.code || '', keys, mine: Object.fromEntries(keys.map(k => [k, mine[k] === undefined ? null : mine[k]])), by: this.uid(), byName: this.myName(), other: theirs.updatedByName || '', at: new Date().toISOString() };
    try { await withTimeout(this.col('conflicts').doc(doc.id).set(JSON.parse(JSON.stringify(doc))), 15000); } catch (e) { /* vẫn báo trên máy */ }
    this.conflicts.set(doc.id, doc);
    toast(`${doc.other || 'Người khác'} vừa sửa cùng chỗ (${keys.map(conflictLabel).join(', ')}). Bản của bạn được giữ riêng trong đơn.`, 'bad');
    scheduleRender();
  },
  /* phiếu công việc cho thợ: không có giá */
  async writeJob(o) {
    if (!o || this.role === 'worker') return;
    const workers = Array.isArray(o.workers) ? o.workers : [];
    if (!isClosed(o) && !workers.length) return;
    const q = headQuote(o);
    const job = {
      oid: o.id, code: o.code || '', status: o.status, owner: o.owner || this.uid(), assignees: workers,
      customer: { name: q.customer?.name || '', phone: q.customer?.phone || '', address: q.customer?.address || '' },
      project: q.project || '', closedAt: o.closedAt || '', handover: o.handover ? o.handover.date : '',
      items: (q.rows || []).filter(r => r.name).map(r => ({ name: r.name, material: r.material || '', unit: r.unit, qty: Number(r.qty) || 0, dims: r.dims ? dimText(r.unit, r.dims) : '' })),
      changes: (o.changes || []).filter(c => c.status === 'confirmed').map(c => ({ title: c.title, note: c.note || '' })),
      updatedAt: new Date().toISOString(),
    };
    const sig = J({ ...job, updatedAt: '' });
    if (this.jobSig.get(o.id) === sig) return;
    try { await withTimeout(this.col('jobs').doc(o.id).set(job), 15000); this.jobSig.set(o.id, sig); } catch (e) { /* phiếu công việc sẽ cập nhật ở lần lưu sau */ }
  },
};
const conflictLabel = k => ({ draft: 'báo giá nháp', plan: 'lịch thanh toán', status: 'trạng thái', handover: 'nghiệm thu', payments: 'thanh toán', changes: 'phát sinh', notes: 'ghi chú', versions: 'bản đã chốt', owner: 'người phụ trách', workers: 'thợ được giao' }[k] || k);

let renderTimer = 0;
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    const a = document.activeElement;
    if (sheets.length || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) { scheduleRender(); return; }
    render();
  }, 300);
}

/* ---------- nơi lưu: máy chủ chung ---------- */
function teamBackend(T) {
  const local = { lb: null };
  const getLocal = async () => (local.lb ||= await localBackend());
  const fbErr = e => {
    const c = (e && e.code) || '';
    if (/permission-denied/.test(c)) return { code: 'permission' };
    if (/unavailable|deadline|aborted|failed-precondition|network/.test(c) || (e && e.code === 'unavailable')) return { code: 'unavailable' };
    if (/resource-exhausted/.test(c)) return { code: 'resource_exhausted' };
    if (/invalid-argument/.test(c)) return { code: 'invalid_argument' };
    return e && e.code ? e : { code: 'unavailable' };
  };
  const QUERY = {
    owner: { orders: 1, customers: 1, catalog: 1, app: 1, costs: 1, cash: 1 },
    manager: { orders: 1, customers: 1, catalog: 1, app: 1, costs: 1, cash: 1 },
    sale: { orders: 'own', customers: 'own', catalog: 1, app: 1 },
    worker: {},
  };
  return {
    async loadAll() {
      const plan = QUERY[T.role] || {};
      const out = Object.fromEntries(COLS.map(c => [c, []]));
      const waits = [];
      const listen = (q, onFirst, onChange) => new Promise(res => {
        let first = true;
        T.unsubs.push(q.onSnapshot(snap => {
          if (first) { first = false; onFirst(snap); res(); return; }
          for (const ch of snap.docChanges()) onChange(ch);
        }, () => { if (first) { first = false; res(); } }));
      });
      for (const c of COLS) {
        if (!plan[c]) continue;
        let q = T.col(c);
        if (plan[c] === 'own') q = q.where('owner', '==', T.uid());
        waits.push(listen(q,
          snap => { out[c] = snap.docs.map(d => ({ ...d.data(), id: d.id })); },
          ch => Store.applyRemote(c, ch.doc.id, ch.type === 'removed' ? null : { ...ch.doc.data(), id: ch.doc.id })));
      }
      /* danh sách người trong xưởng */
      waits.push(listen(T.col('members'),
        snap => { T.members = new Map(snap.docs.map(d => [d.id, { ...d.data(), uid: d.id }])); },
        ch => { if (ch.type === 'removed') T.members.delete(ch.doc.id); else T.members.set(ch.doc.id, { ...ch.doc.data(), uid: ch.doc.id }); scheduleRender(); }));
      if (T.role === 'owner') {
        waits.push(listen(T.col('invites').where('used', '==', false),
          snap => { T.invites = new Map(snap.docs.map(d => [d.id, d.data()])); },
          ch => { if (ch.type === 'removed') T.invites.delete(ch.doc.id); else T.invites.set(ch.doc.id, ch.doc.data()); scheduleRender(); }));
      }
      if (T.role !== 'worker') {
        let cq = T.col('conflicts');
        if (T.role === 'sale') cq = cq.where('by', '==', T.uid());
        waits.push(listen(cq,
          snap => { T.conflicts = new Map(snap.docs.map(d => [d.id, d.data()])); },
          ch => { if (ch.type === 'removed') T.conflicts.delete(ch.doc.id); else T.conflicts.set(ch.doc.id, ch.doc.data()); scheduleRender(); }));
      } else {
        waits.push(listen(T.col('jobs').where('assignees', 'array-contains', T.uid()),
          snap => { T.jobs = new Map(snap.docs.map(d => [d.id, d.data()])); },
          ch => { if (ch.type === 'removed') T.jobs.delete(ch.doc.id); else T.jobs.set(ch.doc.id, ch.doc.data()); scheduleRender(); }));
      }
      await Promise.all(waits);
      return out;
    },
    async set(c, id, doc, base) {
      const ref = T.col(c).doc(id);
      const lock = T.role === 'sale' ? ['payments'] : [];
      let out = null, conflicts = [], theirsDoc = null;
      try {
        await withTimeout(T.db.runTransaction(async tx => {
          const snap = await tx.get(ref);
          const theirs = snap.exists ? snap.data() : null;
          theirsDoc = theirs; conflicts = [];
          let merged;
          if (!theirs) merged = JSON.parse(JSON.stringify(doc));
          else { const r = mergeDoc(base || {}, doc, theirs, lock); merged = r.doc; conflicts = r.conflicts; }
          if (c === 'orders') {
            fixNumbers(merged, theirs);
            if (!merged.owner) merged.owner = (theirs && theirs.owner) || T.uid();
            if (merged.codeTemp) {
              const stem = String(merged.code || '').replace(/T[A-Z0-9]*$/, '');
              const cref = T.col('counters').doc(stem.replace(/-$/, '') || 'BG');
              const cs = await tx.get(cref);
              let n;
              if (cs.exists) n = (cs.data().n || 0) + 1;
              else n = Store.list('orders').reduce((mx, o) => (o.code && o.code.startsWith(stem) && !o.codeTemp ? Math.max(mx, parseInt(o.code.slice(stem.length), 10) || 0) : mx), 0) + 1;
              tx.set(cref, { n });
              merged.code = stem + pad2(n); delete merged.codeTemp;
            }
          }
          if (c === 'customers' && !merged.owner) merged.owner = (theirs && theirs.owner) || T.uid();
          merged.rev = ((theirs && theirs.rev) || 0) + 1;
          merged.updatedBy = T.uid(); merged.updatedByName = T.myName();
          if (!merged.updatedAt) merged.updatedAt = new Date().toISOString();
          delete merged.id;
          tx.set(ref, merged);
          out = { ...merged, id };
        }), 20000);
      } catch (e) { throw fbErr(e); }
      if (conflicts.length) T.saveConflict(c, id, conflicts, doc, theirsDoc || {});
      if (c === 'orders') T.writeJob(out);
      return { doc: out };
    },
    async del(c, id) {
      try { await withTimeout(T.col(c).doc(id).delete(), 15000); } catch (e) { throw fbErr(e); }
      if (c === 'orders') { try { await T.col('jobs').doc(id).delete(); } catch (e) { /* bỏ qua */ } }
    },
    async putFile(blob, type, o) {
      const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(blob); });
      const CH = 700000, parts = Math.max(1, Math.ceil(data.length / CH)), ref = uid('f');
      const b = T.db.batch();
      for (let i = 0; i < parts; i++) b.set(T.col('files').doc(`${ref}_${i}`), { ref, i, n: parts, type, oid: o ? o.id : '', owner: (o && o.owner) || T.uid(), data: data.slice(i * CH, (i + 1) * CH) });
      try { await withTimeout(b.commit(), 60000); } catch (e) { throw fbErr(e); }
      return { ref, parts };
    },
    async putBlob(k, b) { (await getLocal()).putBlob(k, b); },
    async getBlob(ref, att) {
      if (!att || att.store !== 'fs') return (await getLocal()).getBlob(ref);
      const docs = await Promise.all(Array.from({ length: att.parts || 1 }, (_, i) => T.col('files').doc(`${ref}_${i}`).get()));
      if (docs.some(d => !d.exists)) return null;
      const s = docs.map(d => d.data().data).join(''), type = docs[0].data().type || 'image/jpeg';
      const bin = atob(s), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return new Blob([u8], { type });
    },
    async delBlob(ref, att) {
      if (!att || att.store !== 'fs') return (await getLocal()).delBlob(ref);
      for (let i = 0; i < (att.parts || 1); i++) { try { await T.col('files').doc(`${ref}_${i}`).delete(); } catch (e) { /* bỏ qua */ } }
    },
  };
}

/* ---------- màn hình đăng nhập / vào xưởng ---------- */
function renderTeamGate() {
  const st = Team.state;
  const wrap = inner => `<div class="gate"><div class="gate-card card">${inner}</div></div>`;
  const off = `<button class="linkbtn" data-act="tm-off">Không dùng máy chủ chung, quay lại dùng riêng trên máy này</button>`;
  if (st === 'boot') return `<div class="loading"><div><b>Đang kết nối máy chủ chung…</b><p class="muted">${esc(Team.cfg?.projectId || '')}</p></div></div>`;
  if (st === 'error') return wrap(`<h2>Chưa vào được</h2><p class="muted">${esc(Team.msg)}</p><div class="addbar"><button class="btn primary" data-act="tm-retry">Thử lại</button>${Team.user ? `<button class="btn" data-act="tm-signout">Đăng xuất</button>` : ''}</div>${off}`);
  if (st === 'locked') return wrap(`<h2>Tài khoản đã bị khóa</h2><p class="muted">Chủ xưởng đã tạm khóa tài khoản ${esc(Team.user?.email || '')}. Liên hệ chủ xưởng nếu cần mở lại.</p><div class="addbar"><button class="btn" data-act="tm-signout">Đăng xuất</button></div>`);
  if (st === 'signin') {
    const inv = lsGet('snt-invite');
    return wrap(`<h2>Đăng nhập Sổ Nội Thất</h2>
      ${inv ? `<div class="notice ok">${ic('info')}<div>Bạn có mã mời <b>${esc(inv)}</b>. Nếu chưa có tài khoản, nhập email, đặt mật khẩu rồi bấm <b>Tạo tài khoản</b>. App sẽ tự đưa bạn vào xưởng.</div></div>` : `<p class="muted">Máy chủ chung: ${esc(Team.cfg?.projectId || '')}</p>`}
      <div class="field"><label for="tm-email">Email</label><input class="in" id="tm-email" type="email" autocomplete="username" inputmode="email" spellcheck="false" autocapitalize="off" value="${esc(S.tmEmail || '')}"></div>
      <div class="field"><label for="tm-pass">Mật khẩu (ít nhất 6 ký tự)</label><input class="in" id="tm-pass" type="password" autocomplete="current-password"></div>
      <p class="err" id="tm-err" ${S.tmErr ? '' : 'hidden'}>${esc(S.tmErr || '')}</p>
      <div class="addbar"><button class="btn primary" data-act="tm-signin">Đăng nhập</button><button class="btn" data-act="tm-signup">Tạo tài khoản</button><button class="linkbtn" data-act="tm-reset">Quên mật khẩu</button></div>
      ${off}`);
  }
  if (st === 'join') {
    return wrap(`<h2>Vào xưởng</h2><p class="muted">Tài khoản ${esc(Team.user?.email || '')} chưa thuộc xưởng nào.</p>
      <div class="field"><label for="tm-name">Tên của bạn (hiện cho cả xưởng)</label><input class="in" id="tm-name" autocomplete="name" value="${esc(S.tmName || '')}" placeholder="VD: Lan sale"></div>
      <div class="field"><label for="tm-code">Mã mời chủ xưởng gửi</label><input class="in" id="tm-code" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(S.joinCode || '')}" placeholder="VD: K7MQ2XRA"></div>
      <p class="err" id="tm-err" ${S.tmErr ? '' : 'hidden'}>${esc(S.tmErr || '')}</p>
      <div class="addbar"><button class="btn primary" data-act="tm-join">Vào xưởng</button><button class="btn" data-act="tm-signout">Đăng xuất</button></div>
      <hr class="sep">
      <h3>Bạn là chủ xưởng, mở lần đầu?</h3>
      <p class="muted">Tạo xưởng trên máy chủ này. Bạn sẽ là <b>Chủ</b>, sau đó mời nhân viên bằng mã.</p>
      ${Team.localCount ? `<label class="check"><input type="checkbox" id="tm-migrate" checked> Đưa ${Team.localCount} đơn đang có trên máy này lên máy chủ chung</label>` : ''}
      <div class="addbar"><button class="btn" data-act="tm-create">Tạo xưởng mới</button></div>
      ${off}`);
  }
  return '';
}

/* ---------- thợ: phiếu công việc ---------- */
function renderJobs() {
  const jobs = [...Team.jobs.values()].sort((a, b) => String(b.closedAt || b.updatedAt).localeCompare(String(a.closedAt || a.updatedAt)));
  return `<div class="pane-in"><div class="list-head"><h1>Việc của tôi</h1><span data-savestat class="savestat"></span></div>
    ${jobs.length ? jobs.map(j => `<section class="card job">
      <div class="card-h"><h3>${esc(j.customer.name || j.code)}</h3><span class="pill ${(STATUS[j.status] || STATUS.closed).cls}">${(STATUS[j.status] || STATUS.closed).label}</span></div>
      <p class="d-sub">${esc(j.project || '')}${j.project ? ' · ' : ''}${esc(j.code)}</p>
      ${j.customer.address ? `<p>${ic('pin')} ${esc(j.customer.address)}</p>` : ''}
      ${j.customer.phone ? `<p><a class="btn sm" href="tel:${esc(digits(j.customer.phone))}">${ic('phone')}Gọi ${esc(j.customer.phone)}</a></p>` : ''}
      <div class="scrollx"><table class="lockq"><thead><tr><th>Hạng mục</th><th>Kích thước</th><th class="r">KL</th></tr></thead><tbody>
        ${j.items.map(r => `<tr><td><b>${esc(r.name)}</b><span class="sub">${esc(r.material)}</span></td><td>${esc(r.dims || '')}</td><td class="r">${fmtQty(r.qty)} ${esc(r.unit)}</td></tr>`).join('')}
      </tbody></table></div>
      ${j.changes && j.changes.length ? `<p class="muted" style="margin-top:8px"><b>Phát sinh:</b> ${j.changes.map(c => esc(c.title) + (c.note ? ' (' + esc(c.note) + ')' : '')).join('; ')}</p>` : ''}
    </section>`).join('') : `<div class="empty" style="margin-top:12vh"><h3>Chưa có việc nào được giao</h3><p>Khi chủ xưởng giao việc, phiếu công việc sẽ hiện ở đây.</p></div>`}
  </div>`;
}

/* ---------- thẻ trong Cài đặt ---------- */
function teamCardHtml() {
  if (!ownSite) return `<section class="card"><h3>Làm việc nhóm</h3><p class="muted">Nhiều người dùng chung chỉ có ở bản cài lên iPad (web app). Bản trong Claude dùng riêng cho bạn.</p></section>`;
  if (!Team.on()) return sect('st-team', 'Làm việc nhóm', 'Chưa bật', `<div class="stack">
    <p>Cho nhân viên dùng chung sổ: mỗi người một tài khoản, chỉ thấy phần việc của mình, không ai ghi đè mất dữ liệu của người khác.</p>
    <div class="addbar" style="margin-top:0"><button class="btn primary" data-act="tm-connect">Tôi là chủ – kết nối máy chủ chung</button><button class="btn" data-act="tm-paste-invite">Tôi là nhân viên – dán mã mời</button></div>
    <p class="muted" style="font-size:13px">Cần một dự án Firebase (miễn phí) do chủ xưởng tạo. Dữ liệu đang có trên máy này được giữ nguyên.</p></div>`);
  const me = Team.member || {};
  const head = `<section class="card stack"><h3>Tài khoản</h3>
    <p><b>${esc(me.name || '')}</b> · ${esc(Team.user?.email || '')} · vai trò <b>${ROLES[Team.role] || ''}</b></p>
    <p class="muted" style="font-size:14px">Máy chủ chung: ${esc(Team.cfg?.projectId || '')}</p>
    <div class="addbar" style="margin-top:0"><button class="btn" data-act="tm-signout">Đăng xuất</button></div></section>`;
  if (!can('members')) return head;
  const mem = [...Team.members.values()].sort((a, b) => (a.role === 'owner' ? -1 : 0) - (b.role === 'owner' ? -1 : 0) || String(a.name).localeCompare(String(b.name)));
  const invs = [...Team.invites.entries()].filter(([, v]) => !v.used && !(v.exp && v.exp.toMillis && v.exp.toMillis() < Date.now()));
  return head + `<section class="card stack"><div class="card-h"><h3>Nhân viên</h3><button class="btn sm primary" data-act="tm-invite">${ic('plus')}Mời người mới</button></div>
    <div class="rowlist">${mem.map(m => `<div class="ritem ${m.active ? '' : 'cancel'}"><div class="rmain"><b>${esc(m.name || '(chưa đặt tên)')}</b><div class="rsub">${esc(m.email || '')}${m.active ? '' : ' · đã khóa'}</div></div>
      ${m.uid === Team.uid() ? `<span class="pill s-closed">${ROLES.owner}</span>` : `<select class="in" style="width:auto" data-mrole="${m.uid}" aria-label="Vai trò của ${esc(m.name)}">${['manager', 'sale', 'worker'].map(r => `<option value="${r}" ${m.role === r ? 'selected' : ''}>${ROLES[r]}</option>`).join('')}</select>
      <button class="btn sm ${m.active ? 'danger' : ''}" data-act="tm-toggle" data-uid="${m.uid}">${m.active ? 'Khóa' : 'Mở khóa'}</button>`}</div>`).join('')}</div>
    ${invs.length ? `<h4 style="margin:6px 0 0">Mã mời chưa dùng</h4><div class="rowlist">${invs.map(([k, v]) => `<div class="ritem"><div class="rmain"><b class="num">${esc(k)}</b><div class="rsub">${ROLES[v.role]} · hết hạn ${v.exp && v.exp.toMillis ? fmtDate(dstr(new Date(v.exp.toMillis()))) : ''}</div></div><button class="btn sm" data-act="tm-share-invite" data-code="${esc(k)}">Gửi lại</button><button class="iconbtn" data-act="tm-del-invite" data-code="${esc(k)}" aria-label="Hủy mã ${esc(k)}">${ic('trash')}</button></div>`).join('')}</div>` : ''}
    <p class="muted" style="font-size:14px">Người nghỉ việc: bấm <b>Khóa</b>. Dữ liệu họ đã làm vẫn giữ nguyên; đơn của họ chuyển cho người khác ở mục “Phân công” trong từng đơn.</p></section>`;
}

/* ---------- thẻ trong chi tiết đơn ---------- */
function teamDetailCards(o) {
  if (!Team.on()) return '';
  let html = '';
  const cf = [...Team.conflicts.values()].filter(x => x.oid === o.id);
  if (cf.length) html += `<section class="card"><div class="card-h"><h3>Sửa cùng lúc</h3></div><div class="rowlist">${cf.map(x => `<div class="ritem"><div class="rmain"><b>${esc(x.byName || '')}${x.other ? ' và ' + esc(x.other) : ''} cùng sửa: ${esc(x.keys.map(conflictLabel).join(', '))}</b><div class="rsub">${fmtDateTime(new Date(x.at))} · đơn đang giữ bản lưu sau; bản của ${esc(x.byName || 'người kia')} được cất riêng</div></div>
    ${can('quote') || can('assign') ? `<button class="btn sm" data-act="cf-use" data-id="${esc(x.id)}">Dùng bản này</button>` : ''}<button class="iconbtn" data-act="cf-drop" data-id="${esc(x.id)}" aria-label="Bỏ">${ic('x')}</button></div>`).join('')}</div></section>`;
  const reqs = (o.payReqs || []).filter(r => r.status === 'pending');
  if (reqs.length) html += `<section class="card"><div class="card-h"><h3>Tiền sale báo đã thu (chờ xác nhận)</h3></div><div class="rowlist">${reqs.map(r => `<div class="ritem"><div class="rmain"><b>${moneyD(r.amount)}</b><div class="rsub">${fmtDate(r.date)} · ${PAY_METHOD[r.method] || ''} · ${esc(r.byName || '')}${r.note ? ' · ' + esc(r.note) : ''}</div></div>
    ${can('pay') ? `<button class="btn sm primary" data-act="req-ok" data-id="${r.id}">Xác nhận</button><button class="iconbtn" data-act="req-no" data-id="${r.id}" aria-label="Từ chối">${ic('x')}</button>` : '<span class="pill s-quote">Chờ xác nhận</span>'}</div>`).join('')}</div></section>`;
  if (can('assign')) {
    const ms = [...Team.members.values()].filter(m => m.active);
    const owners = ms.filter(m => m.role !== 'worker'), workers = ms.filter(m => m.role === 'worker'), cur = Team.members.get(o.owner);
    const wset = new Set(o.workers || []);
    html += `<section class="card"><div class="card-h"><h3>Phân công</h3></div><div class="fgrid">
      <div class="field"><label for="as-owner">Người phụ trách</label><select class="in" id="as-owner">${!owners.some(m => m.uid === o.owner) ? `<option value="" selected disabled>${esc(cur ? cur.name + (cur.active ? '' : ' (đã khóa)') : 'Chưa có')} – chọn người nhận</option>` : ''}${owners.map(m => `<option value="${m.uid}" ${m.uid === o.owner ? 'selected' : ''}>${esc(m.name)} (${ROLES[m.role]})</option>`).join('')}</select></div>
      <div class="field"><span class="lbl">Thợ được giao (thấy phiếu công việc, không thấy giá)</span>${workers.length ? workers.map(m => `<label class="check"><input type="checkbox" data-worker="${m.uid}" ${wset.has(m.uid) ? 'checked' : ''}> ${esc(m.name)}</label>`).join('') : '<p class="muted">Chưa có thợ. Mời thợ ở Cài đặt → Nhân viên.</p>'}</div></div></section>`;
  } else if (o.owner && Team.members.get(o.owner)) {
    html += `<p class="muted" style="margin:0 0 12px">Phụ trách: ${esc(Team.members.get(o.owner).name)}</p>`;
  }
  return html;
}

/* ---------- thao tác ---------- */
const errText = e => {
  const c = (e && e.code) || '';
  if (e && e.msg) return e.msg;
  if (/invalid-email/.test(c)) return 'Email không đúng dạng.';
  if (/user-not-found|wrong-password|invalid-credential|invalid-login/.test(c)) return 'Sai email hoặc mật khẩu.';
  if (/email-already-in-use/.test(c)) return 'Email này đã có tài khoản. Bấm Đăng nhập.';
  if (/weak-password/.test(c)) return 'Mật khẩu cần ít nhất 6 ký tự.';
  if (/too-many-requests/.test(c)) return 'Thử sai nhiều lần. Đợi vài phút rồi thử lại.';
  if (/permission-denied|permission/.test(c)) return 'Không có quyền làm việc này.';
  if (/network|unavailable/.test(c)) return 'Mất mạng. Kiểm tra mạng rồi thử lại.';
  return 'Chưa làm được. Thử lại sau.';
};
function gateErr(msg) { S.tmErr = msg; const el = $('#tm-err'); if (el) { el.hidden = !msg; el.textContent = msg; } }
async function inviteShare(code) {
  const text = `Mời bạn vào Sổ Nội Thất (${ROLES[Team.invites.get(code)?.role] || ''}).\n1. Mở link bằng Safari, bấm Chia sẻ → Thêm vào MH chính: ${location.origin + location.pathname}\n2. Mở app → Cài đặt → “Tôi là nhân viên – dán mã mời”, dán mã dưới đây.\n\n${packInvite(Team.cfg, Team.wid, code)}\n\nMã ngắn: ${code} (hết hạn sau 7 ngày, dùng 1 lần)`;
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('Đã chép lời mời. Dán vào Zalo để gửi.'); }
  catch (e) { openSheet({ title: 'Lời mời', html: `<textarea class="in" rows="8" readonly aria-label="Nội dung sao chép" spellcheck="false">${esc(text)}</textarea><p class="muted">Chọn hết rồi chép, dán vào Zalo.</p>` }); }
}
const TEAM_ACTIONS = {
  'tm-retry': () => { if (Team.user) Team.onUser(Team.user); else Team.start(); },
  'tm-off': async () => { const ok = await confirmBox({ title: 'Dùng riêng trên máy này?', text: 'App sẽ ngắt khỏi máy chủ chung và mở dữ liệu riêng trên máy này. Dữ liệu trên máy chủ chung vẫn còn nguyên.', ok: 'Ngắt kết nối' }); if (ok) Team.disconnect(); },
  'tm-signin': async () => {
    const e = $('#tm-email').value.trim(), p = $('#tm-pass').value; S.tmEmail = e;
    if (!e || !p) { gateErr('Nhập email và mật khẩu.'); return; }
    gateErr(''); try { await Team.signIn(e, p); } catch (er) { gateErr(errText(er)); }
  },
  'tm-signup': async () => {
    const e = $('#tm-email').value.trim(), p = $('#tm-pass').value; S.tmEmail = e;
    if (!e || p.length < 6) { gateErr('Nhập email và mật khẩu ít nhất 6 ký tự.'); return; }
    gateErr(''); try { await Team.signUp(e, p); } catch (er) { gateErr(errText(er)); }
  },
  'tm-reset': async () => {
    const e = $('#tm-email').value.trim(); if (!e) { gateErr('Nhập email trước, rồi bấm Quên mật khẩu.'); return; }
    try { await Team.reset(e); gateErr(''); toast('Đã gửi email đặt lại mật khẩu. Mở hộp thư để làm tiếp.'); } catch (er) { gateErr(errText(er)); }
  },
  'tm-signout': () => Team.signOut(),
  'tm-join': async () => {
    const name = $('#tm-name').value.trim(); let code = $('#tm-code').value.trim(); S.tmName = name;
    const big = unpackInvite(code); if (big) code = big.k;
    code = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!name) { gateErr('Nhập tên của bạn.'); return; }
    if (code.length < 6) { gateErr('Nhập mã mời chủ xưởng gửi.'); return; }
    gateErr(''); try { await Team.join(code, name); toast('Đã vào xưởng'); } catch (er) { gateErr(errText(er)); }
  },
  'tm-create': async () => {
    const name = $('#tm-name').value.trim(); S.tmName = name;
    if (!name) { gateErr('Nhập tên của bạn.'); return; }
    const ok = await confirmBox({ title: 'Tạo xưởng mới?', text: `Bạn sẽ là <b>Chủ</b> của máy chủ <b>${esc(Team.cfg.projectId)}</b>. Chỉ làm bước này nếu bạn là chủ xưởng.`, ok: 'Tạo xưởng' });
    if (!ok) return;
    gateErr(''); try { await Team.createWorkshop(name, !!$('#tm-migrate')?.checked); toast('Đã tạo xưởng'); }
    catch (er) { gateErr(/permission/.test((er && er.code) || '') ? 'Máy chủ này đã có xưởng. Hãy xin chủ xưởng mã mời.' : errText(er)); }
  },
  'tm-connect': () => {
    const el = openSheet({
      title: 'Kết nối máy chủ chung',
      html: `<p>Dán đoạn <b>firebaseConfig</b> lấy từ Firebase (Cài đặt dự án → Ứng dụng web). Đoạn này không phải mật khẩu; quyền truy cập được khóa bằng luật bảo mật trên máy chủ.</p>
        <textarea class="in" id="tm-cfg" rows="8" aria-label="Mã cấu hình Firebase" spellcheck="false" autocapitalize="off" placeholder="const firebaseConfig = { apiKey: &quot;…&quot;, … };"></textarea><p class="err" id="tm-cfg-err" hidden></p>`,
      foot: `<button class="btn" data-sa="close">Hủy</button><button class="btn primary" data-sa="ok">Kết nối</button>`,
      onClick: (a, b, el2) => {
        if (a !== 'ok') return;
        const cfg = parseFbConfig(el2.querySelector('#tm-cfg').value);
        if (!cfg) { const er = el2.querySelector('#tm-cfg-err'); er.hidden = false; er.textContent = 'Không đọc được. Cần có apiKey, projectId và appId.'; return; }
        Team.saveCfg(cfg); closeSheet(el2); hardReload('cfg');
      },
    });
    setTimeout(() => softFocus(el.querySelector('#tm-cfg')), 60);
  },
  'tm-paste-invite': () => {
    openSheet({
      title: 'Dán mã mời',
      html: `<p>Dán cả đoạn chủ xưởng gửi qua Zalo (có chữ <b>SNT1.</b>).</p><textarea class="in" id="tm-inv" rows="5" aria-label="Mã mời" spellcheck="false" autocapitalize="off"></textarea><p class="err" id="tm-inv-err" hidden></p>`,
      foot: `<button class="btn" data-sa="close">Hủy</button><button class="btn primary" data-sa="ok">Tiếp tục</button>`,
      onClick: (a, b, el2) => {
        if (a !== 'ok') return;
        const d = unpackInvite(el2.querySelector('#tm-inv').value);
        if (!d) { const er = el2.querySelector('#tm-inv-err'); er.hidden = false; er.textContent = 'Mã không đúng. Hãy dán cả đoạn bắt đầu bằng SNT1.'; return; }
        Team.saveCfg(d.c, d.w || 'main'); lsSet('snt-invite', d.k); closeSheet(el2); hardReload('invite');
      },
    });
  },
  'tm-invite': () => {
    const el = openSheet({
      title: 'Mời người mới',
      html: `<div class="menu-list">${['manager', 'sale', 'worker'].map(r => `<button data-sa="r" data-r="${r}"><span><b>${ROLES[r]}</b><br><small class="muted">${ROLE_HINT[r]}</small></span></button>`).join('')}</div>`,
      onClick: async (a, b, el2) => {
        if (a !== 'r') return;
        closeSheet(el2);
        try { const code = await Team.createInvite(b.dataset.r); Team.invites.set(code, { role: b.dataset.r, used: false }); render(); await inviteShare(code); }
        catch (er) { toast(errText(er), 'bad'); }
      },
    });
    return el;
  },
  'tm-share-invite': b => inviteShare(b.dataset.code),
  'tm-del-invite': async b => { const ok = await confirmBox({ title: 'Hủy mã mời?', text: `Mã ${esc(b.dataset.code)} sẽ không dùng được nữa. Người chưa vào xưởng cần một mã mới.`, ok: 'Hủy mã', danger: true }); if (!ok) return; try { await Team.col('invites').doc(b.dataset.code).delete(); Team.invites.delete(b.dataset.code); render(); } catch (er) { toast(errText(er), 'bad'); } },
  'tm-toggle': async b => {
    const m = Team.members.get(b.dataset.uid); if (!m) return;
    if (m.active) { const ok = await confirmBox({ title: `Khóa ${esc(m.name)}?`, text: 'Người này sẽ không mở được dữ liệu của xưởng nữa. Dữ liệu họ đã làm vẫn giữ nguyên.', ok: 'Khóa', danger: true }); if (!ok) return; }
    try { await Team.setMember(m.uid, { active: !m.active }); toast(m.active ? 'Đã khóa ' + m.name : 'Đã mở khóa ' + m.name); } catch (er) { toast(errText(er), 'bad'); }
  },
  'req-ok': b => {
    const o = curOrder(), r = o && (o.payReqs || []).find(x => x.id === b.dataset.id); if (!r) return;
    const p = { id: uid('p'), no: nextPayNo(o), amount: r.amount, date: r.date, method: r.method, note: r.note || '', createdAt: new Date().toISOString(), fromReq: r.id };
    o.payments.push(p); r.status = 'ok'; r.doneBy = Team.myName();
    addLog(o, `Xác nhận khoản ${r.byName || 'sale'} báo đã thu: ${moneyD(r.amount)} ngày ${fmtDate(r.date)}`); touchOrder(o, 0); render(); toast('Đã ghi phiếu thu ' + receiptNo(o, p));
  },
  'req-no': async b => {
    const o = curOrder(), r = o && (o.payReqs || []).find(x => x.id === b.dataset.id); if (!r) return;
    const ok = await confirmBox({ title: 'Từ chối khoản báo thu?', text: `Khoản ${moneyD(r.amount)} do ${esc(r.byName || 'sale')} báo sẽ không được ghi vào đã thu.`, ok: 'Từ chối', danger: true });
    if (!ok) return; r.status = 'rejected'; addLog(o, `Từ chối khoản báo thu ${moneyD(r.amount)} của ${r.byName || 'sale'}`); touchOrder(o, 0); render();
  },
  'cf-use': async b => {
    const x = Team.conflicts.get(b.dataset.id), o = x && Store.get(x.c || 'orders', x.oid); if (!o) return;
    const ok = await confirmBox({ title: 'Dùng bản đã cất riêng?', text: `Phần ${esc(x.keys.map(conflictLabel).join(', '))} của đơn sẽ thay bằng bản của ${esc(x.byName || '')} lúc ${fmtDateTime(new Date(x.at))}.`, ok: 'Dùng bản này' });
    if (!ok) return;
    for (const k of x.keys) { if (x.mine[k] === null) delete o[k]; else o[k] = clone(x.mine[k]); }
    if (x.c === 'orders' || !x.c) { normalizeOrder(o); addLog(o, 'Khôi phục bản sửa cùng lúc của ' + (x.byName || '')); touchOrder(o, 0); } else Store.put(x.c, o, 0);
    TEAM_ACTIONS['cf-drop'](b, true);
  },
  'cf-drop': async (b, silent) => {
    const id = b.dataset.id; Team.conflicts.delete(id); render();
    try { await Team.col('conflicts').doc(id).delete(); } catch (e) { /* bỏ qua */ }
    if (silent !== true) toast('Đã bỏ bản cất riêng');
  },
};
function teamChange(el) {
  if (el.dataset && el.dataset.mrole) {
    const m = Team.members.get(el.dataset.mrole);
    Team.setMember(el.dataset.mrole, { role: el.value }).then(() => toast(`${m ? m.name : ''}: ${ROLES[el.value]}`)).catch(er => { toast(errText(er), 'bad'); render(); });
    return true;
  }
  if (el.id === 'as-owner') { const o = curOrder(); if (!o || !el.value) return true; const m = Team.members.get(el.value); o.owner = el.value; addLog(o, 'Chuyển phụ trách cho ' + (m ? m.name : '')); touchOrder(o, 0); return true; }
  if (el.dataset && el.dataset.worker) {
    const o = curOrder(); if (!o) return true;
    const set = new Set(o.workers || []); if (el.checked) set.add(el.dataset.worker); else set.delete(el.dataset.worker);
    o.workers = [...set]; const m = Team.members.get(el.dataset.worker);
    addLog(o, (el.checked ? 'Giao việc cho ' : 'Bỏ giao việc ') + (m ? m.name : '')); touchOrder(o, 0); return true;
  }
  return false;
}
/* mở link mời trực tiếp bằng Safari: #moi=SNT1.… */
(function readInviteHash() {
  const m = location.hash.match(/moi=(SNT1\.[A-Za-z0-9_-]+)/); if (!m) return;
  const d = unpackInvite(m[1]);
  if (d) { Team.saveCfg(d.c, d.w || 'main'); lsSet('snt-invite', d.k); }
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* bỏ qua */ }
})();
