/* =========================================================
   GIAO DIỆN
   ========================================================= */
const ICONS = {
  orders: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  stats: '<path d="M3 20.5h18"/><path d="M6.5 17v-5M12 17V6M17.5 17v-8"/>',
  book: '<path d="M5 5a2 2 0 0 1 2-2h12v15H7a2 2 0 0 0-2 2z"/><path d="M5 20a2 2 0 0 0 2 1h12v-3"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.6M12 18.6v2.6M4.2 7.5l2.2 1.3M17.6 15.2l2.2 1.3M4.2 16.5l2.2-1.3M17.6 8.8l2.2-1.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  more: '<circle cx="5.5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
  ruler: '<path d="M3.5 16.5 16.5 3.5l4 4-13 13z"/><path d="m7.5 12.5 2 2M10.5 9.5l2 2M13.5 6.5l2 2"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  note: '<path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  money: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/>',
  pm: '<path d="M12 4v8M8 8h8M8 18h8"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  dl: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m20.5 16-5-5-9 8.5"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M14 14h2v2h-2zM18 14h2M14 18v2h2M18 18h2v2"/>',
  sign: '<path d="M3 17c3-1 4-9 7-9 2 0-1 9 2 9 2 0 3-4 5-4 1 0 1 2 2 2h2"/><path d="M3 21h18"/>',
  user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c1-3.8 4-5.8 7.5-5.8s6.5 2 7.5 5.8"/>',
  pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  phone: '<path d="M6.5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/>',
  team: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c.8-3.2 3.2-5 6-5s5.2 1.8 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.6c2.4.2 4 1.8 4.5 4.4"/>',
};
const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

const S = { tab: 'today', orderId: null, view: 'list', q: '', filter: 'all', period: 'month', from: '', to: '', catTab: 'items', catQ: '', loadError: '', open: {}, revBy: 'group' };
const wideMQ = matchMedia('(min-width: 1000px)');
const isWide = () => wideMQ.matches;
const curOrder = () => (S.orderId ? Store.get('orders', S.orderId) : null);

/* ---------- thông báo nhỏ ---------- */
/* vùng thông báo có sẵn từ đầu để trình đọc màn hình đọc được cả thông báo đầu tiên */
function toastBox() {
  let box = $('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('aria-live', 'polite'); box.setAttribute('role', 'status'); document.body.appendChild(box); }
  return box;
}
function toast(msg, kind = '') {
  const box = toastBox();
  box.classList.toggle('wide', isWide());
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg; if (kind === 'bad') t.setAttribute('role', 'alert');
  box.appendChild(t);
  while (box.children.length > 2) box.firstElementChild.remove();
  setTimeout(() => t.remove(), kind === 'bad' ? 5200 : 2600);
}

/* ---------- trạng thái lưu ---------- */
function saveStatusHtml() {
  if (Store.offline()) return { cls: 'offline', html: `Chưa có mạng · đang giữ ${Store.failed.size} thay đổi trên máy · <button data-act="retry-save">Gửi lại</button>` };
  if (Store.failed.size) return { cls: 'error', html: `Chưa lưu được · <button data-act="retry-save">Thử lại</button>` };
  if (Store.busy()) return { cls: 'saving', html: 'Đang lưu…' };
  const where = Store.mode === 'local' ? 'trên máy này ' : '';
  if (Store.lastSaved) return { cls: '', html: `Đã lưu ${where}lúc ${fmtTime(Store.lastSaved)}` };
  return { cls: '', html: Store.mode === 'local' ? 'Đã lưu trên máy này' : 'Đã đồng bộ' };
}
let lastErrToast = '';
function updateSaveStatus() {
  const s = saveStatusHtml();
  for (const el of $$('[data-savestat]')) { el.className = 'savestat ' + s.cls; el.innerHTML = s.html; el.title = Store.lastError || ''; }
  if (Store.failed.size && Store.lastError && Store.lastError !== lastErrToast) { lastErrToast = Store.lastError; toast(Store.lastError, 'bad'); }
  if (!Store.failed.size) lastErrToast = '';
}

/* ---------- hộp thoại ---------- */
const sheets = [];
function openSheet({ title, html, foot = '', cls = '', onMount, onClick }) {
  const el = document.createElement('div');
  el.className = 'sheet-wrap';
  el.innerHTML = `<div class="sheet-bg" data-sa="close"></div><div class="sheet ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1"><header class="sheet-h"><h3>${esc(title)}</h3><button class="iconbtn" data-sa="close" aria-label="Đóng">${ic('x')}</button></header><div class="sheet-b">${html}</div>${foot ? `<footer class="sheet-f">${foot}</footer>` : ''}</div>`;
  document.body.appendChild(el);
  const entry = { el, ret: document.activeElement };
  sheets.push(entry); syncInert();
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-sa]');
    if (!b || !el.contains(b)) return;
    if (b.dataset.sa === 'close') { closeSheet(el); return; }
    onClick && onClick(b.dataset.sa, b, el, e);
  });
  onMount && onMount(el);
  requestAnimationFrame(() => { el.classList.add('in'); if (!el.contains(document.activeElement)) el.querySelector('.sheet').focus({ preventScroll: true }); });
  return el;
}
function closeSheet(el) {
  const i = el ? sheets.findIndex(s => s.el === el) : sheets.length - 1;
  if (i < 0) return;
  const [s] = sheets.splice(i, 1);
  s.el.remove(); syncInert();
  /* trả con trỏ về nút đã mở hộp thoại (bàn phím iPad, máy tính) */
  if (i === sheets.length && s.ret && s.ret !== document.body && document.contains(s.ret)) { try { s.ret.focus({ preventScroll: true }); } catch (e) { /* bỏ qua */ } }
}
/* khi có hộp thoại: phần phía sau không bấm/tab tới được */
function syncInert() {
  const app = $('#app'); if (app) app.inert = sheets.length > 0;
  sheets.forEach((s, i) => { s.el.inert = i < sheets.length - 1; });
}
/* Tab chỉ đi vòng trong hộp thoại trên cùng */
function trapTab(e) {
  const top = sheets[sheets.length - 1]; if (!top || e.key !== 'Tab') return;
  const f = [...top.el.querySelectorAll('button:not([disabled]),[href],input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null || x === document.activeElement);
  if (!f.length) { e.preventDefault(); return; }
  const a = document.activeElement, first = f[0], last = f[f.length - 1];
  if (e.shiftKey && (a === first || !top.el.contains(a))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (a === last || !top.el.contains(a))) { e.preventDefault(); first.focus(); }
}
function confirmBox({ title, text, ok = 'Đồng ý', danger = false }) {
  return new Promise(res => {
    let done = false;
    const el = openSheet({
      title, html: `<p>${text}</p>`,
      foot: `<button class="btn" data-sa="no">Hủy</button><button class="btn ${danger ? 'danger solid' : 'primary'}" data-sa="yes">${esc(ok)}</button>`,
      onClick: (a) => { done = true; closeSheet(el); res(a === 'yes'); },
    });
    const obs = new MutationObserver(() => { if (!document.body.contains(el)) { obs.disconnect(); if (!done) res(false); } });
    obs.observe(document.body, { childList: true });
  });
}
function menuSheet(title, items) {
  const el = openSheet({
    title,
    html: `<div class="menu-list">${items.map((it, i) => `<button data-sa="m${i}" class="${it.danger ? 'danger' : ''}">${ic(it.icon || 'check')}<span>${esc(it.label)}</span></button>`).join('')}</div>`,
    onClick: (a) => { const it = items[+a.slice(1)]; closeSheet(el); it && it.run(); },
  });
}
const dateField = (id, value) => `<label class="datefield" for="${id}"><span data-dftext>${value ? fmtDate(value) : 'Chọn ngày'}</span>${ic('cal')}<input type="date" id="${id}" value="${esc(value || '')}"></label>`;
const moneyInput = (id, value, extra = '') => `<input class="in num" id="${id}" data-money inputmode="numeric" autocomplete="off" value="${value ? money(value) : ''}" ${extra}>`;

/* ---------- điều hướng ---------- */
const paneScroll = {};
function render() {
  RC = {};
  try { renderInner(); } finally { RC = null; }
}
/* vẽ lại màn hình không làm mất vị trí con trỏ bàn phím */
function focusKey(a) {
  if (!a || a === document.body || sheets.length || !$('#app')?.contains(a)) return null;
  if (!/^(BUTTON|SUMMARY|A)$/.test(a.tagName) && !(a.tagName === 'INPUT' && a.type === 'checkbox')) return null;
  if (a.id) return '#' + CSS.escape(a.id);
  if (a.tagName === 'SUMMARY' && a.parentElement?.dataset.sect) return `details[data-sect="${CSS.escape(a.parentElement.dataset.sect)}"] > summary`;
  const at = [...a.attributes].filter(x => x.name.startsWith('data-') && x.value.length < 80);
  return at.length ? a.tagName.toLowerCase() + at.map(x => `[${x.name}="${CSS.escape(x.value)}"]`).join('') : null;
}
function renderInner() {
  const fk = focusKey(document.activeElement);
  for (const p of $$('[data-pane]')) paneScroll[p.dataset.pane] = p.scrollTop;
  const app = $('#app');
  const gate = !!Team.cfg && Team.state !== 'ready' && Team.state !== 'off';
  const noRail = gate || Store.mode === 'loading' || (!isWide() && S.tab === 'orders' && S.view === 'edit' && !!curOrder()?.draft && can('quote'));
  app.className = 'app ' + (isWide() ? 'wide' : 'narrow') + (noRail ? ' norail' : '');
  let main;
  if (gate) main = renderTeamGate();
  else if (Store.mode === 'loading') main = `<div class="loading"><div><b>Đang mở sổ…</b><p class="muted">Đang tải dữ liệu đơn hàng…</p></div></div>`;
  else if (S.loadError) main = `<div class="loading"><div class="stack"><b>Không mở được dữ liệu</b><p class="muted">${esc(S.loadError)}</p><button class="btn primary" data-act="reload-data">Thử lại</button></div></div>`;
  else main = renderMain();
  app.innerHTML = (noRail ? '' : `<button class="skip" data-act="skip-main">Bỏ qua thanh bên, tới nội dung</button>` + renderRail()) + `<main class="main" id="main" tabindex="-1">${main}</main>`;
  for (const p of $$('[data-pane]')) if (paneScroll[p.dataset.pane] != null) p.scrollTop = paneScroll[p.dataset.pane];
  if (fk && document.activeElement === document.body) { const el = $(fk); if (el) { try { el.focus({ preventScroll: true }); } catch (e) { /* bỏ qua */ } } }
  saveView();
  updateSaveStatus();
  hydrate();
}
function renderMain() {
  if (Team.on() && Team.role === 'worker') return S.tab === 'settings' ? `<section class="pane full" data-pane="settings">${renderSettings()}</section>` : `<section class="pane full" data-pane="jobs">${renderJobs()}</section>`;
  if (S.tab === 'jobs' || (S.tab === 'catalog' && !can('catalog'))) S.tab = 'orders';
  if ((S.tab === 'today' && !feat('today')) || (S.tab === 'stats' && ((S.fin === 'cash' && !canCash()) || (S.fin === 'pl' && !canPL())))) { if (S.tab === 'today') S.tab = 'orders'; else S.fin = 'rev'; }
  if (S.tab === 'orders') {
    const o = curOrder();
    if (o && S.view === 'edit' && o.draft && can('quote')) return renderEditor(o);
    if (isWide()) return `<div class="split"><section class="pane list-pane" data-pane="list">${renderList()}</section><section class="pane" data-pane="detail-${o ? o.id : 'none'}">${o ? renderDetail(o) : renderNoSelection()}</section></div>`;
    return o ? `<section class="pane" data-pane="detail-${o.id}">${renderDetail(o)}</section>` : `<section class="pane" data-pane="list">${renderList()}</section>`;
  }
  if (S.tab === 'today') return `<section class="pane full" data-pane="today">${renderToday()}</section>`;
  if (S.tab === 'stats') return `<section class="pane full" data-pane="stats">${S.fin === 'cash' && canCash() ? renderCash() : S.fin === 'pl' && canPL() ? renderPL() : renderStats()}</section>`;
  if (S.tab === 'catalog') return `<section class="pane full" data-pane="catalog">${renderCatalog()}</section>`;
  return `<section class="pane full" data-pane="settings">${renderSettings()}</section>`;
}
function renderNoSelection() {
  const n = Store.list('orders').length;
  return `<div class="pane-in"><div class="empty" style="margin-top:14vh"><span class="appicon big">${ic('orders')}</span><h3>${n ? 'Chọn một đơn ở cột bên trái' : 'Chưa có đơn nào'}</h3><p>${n ? 'Hoặc nhấn ⌘K để tìm nhanh theo tên khách, số điện thoại, mã đơn.' : 'Bấm “Tạo báo giá” để bắt đầu.'}</p></div></div>`;
}

/* ---------- 1. Danh sách đơn ---------- */
function monthRange(d = new Date()) { const y = d.getFullYear(), m = d.getMonth(); return [dstr(new Date(y, m, 1)), dstr(new Date(y, m + 1, 0))]; }
function filteredOrders() {
  const q = fold(S.q.trim());
  return Store.list('orders')
    .filter(o => S.filter === 'all' || (S.filter === 'collect' ? dueNowAmount(o) > 0 : o.status === S.filter))
    .filter(o => {
      if (!q) return true;
      const h = headQuote(o);
      return fold([o.code, h.customer?.name, h.customer?.phone, h.project, h.customer?.address].join(' ')).includes(q) || digits(h.customer?.phone).includes(digits(S.q)) && digits(S.q).length >= 3;
    })
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}
function nextLine(o) {
  const nx = nextInstallment(o);
  if (!nx) return '';
  return `<div class="oc-next st-${nx.state}"><span class="pill ${PLAN_STATE[nx.state].cls}">${PLAN_STATE[nx.state].label}</span><span>${dotLabel(nx)}: ${money(nx.left)}${nx.due ? ' · hạn ' + fmtDate(nx.due) : ''}</span></div>`;
}
function localBanner() {
  if (!Store.backend.persistent) return `<div class="notice bad banner">${ic('info')}<div><b>Trình duyệt đang chặn lưu dữ liệu</b> (có thể do chế độ riêng tư). Dữ liệu sẽ mất khi đóng app.</div></div>`;
  if (ownSite && isStandalone()) return `<div class="notice banner">${ic('info')}<div>Dữ liệu lưu <b>trên iPad này</b>, không tự đồng bộ sang máy khác. Hãy sao lưu mỗi tuần vào Tệp hoặc iCloud Drive.</div></div>`;
  if (ownSite) return `<div class="notice warn banner">${ic('info')}<div><b>Cài app lên màn hình chính:</b> bấm nút Chia sẻ của Safari → <b>Thêm vào MH chính</b>, rồi mở app từ biểu tượng đó. Dữ liệu trong Safari và trong app ở màn hình chính là hai nơi riêng, nên hãy nhập dữ liệu sau khi đã cài.</div></div>`;
  return `<div class="notice warn banner">${ic('info')}<div><b>Dữ liệu chỉ nằm trên trình duyệt này</b>. Trình duyệt có thể tự xóa nếu lâu không mở. Hãy sao lưu thường xuyên.</div></div>`;
}
function renderCards() {
  const list = filteredOrders();
  if (!list.length) {
    if (!Store.list('orders').length) return `<div class="empty"><h3>Chưa có đơn nào</h3><p>Bấm “Tạo báo giá” khi gặp khách. Muốn xem thử trước?</p><p style="margin-top:12px"><button class="btn" data-act="seed-demo">Tạo vài đơn mẫu</button></p></div>`;
    return `<div class="empty"><h3>Không có đơn phù hợp</h3><p>Thử từ khóa khác hoặc chọn “Tất cả”.</p></div>`;
  }
  return list.map(orderCard).join('');
}
/* ---------- 2. Soạn báo giá ---------- */
function rowHtml(r, i) {
  return `<div class="qrow" data-row="${r.id}">
    <div class="c-no">${i + 1}</div>
    <div class="c-name"><label class="fl" for="n-${r.id}">Hạng mục</label><input class="in" id="n-${r.id}" data-rf="name" list="cat-names" value="${esc(r.name)}" placeholder="Tên hạng mục" autocomplete="off"></div>
    <div class="c-mat"><label class="fl" for="m-${r.id}">Vật liệu / quy cách</label><input class="in" id="m-${r.id}" data-rf="material" value="${esc(r.material)}" placeholder="VD: MDF chống ẩm phủ Melamine" autocomplete="off"><div class="dimtxt" data-dim ${r.dims ? '' : 'hidden'}>${r.dims ? 'KT: ' + esc(dimText(r.unit, r.dims)) : ''}</div></div>
    <div class="c-unit"><label class="fl" for="u-${r.id}">Đơn vị</label><select class="in" id="u-${r.id}" data-rf="unit">${UNITS.map(u => `<option value="${u}" ${u === r.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
    <div class="c-qty"><label class="fl" for="q-${r.id}">Khối lượng</label><div class="qtywrap"><input class="in num" id="q-${r.id}" data-rf="qty" inputmode="decimal" autocomplete="off" value="${r.qty ? fmtQty(r.qty) : ''}" placeholder="0"><button class="iconbtn" data-act="dims" data-row="${r.id}" aria-label="Nhập kích thước">${ic('ruler')}</button></div></div>
    <div class="c-price"><label class="fl" for="p-${r.id}">Đơn giá</label><input class="in num" id="p-${r.id}" data-rf="price" data-money inputmode="numeric" autocomplete="off" value="${r.price ? money(r.price) : ''}" placeholder="0"></div>
    <div class="c-amt"><span class="fl">Thành tiền</span><div class="amt" data-amt>${money(rowAmount(r))}</div></div>
    <div class="c-more"><button class="iconbtn line" data-act="row-menu" data-row="${r.id}" aria-label="Thao tác dòng">${ic('more')}</button></div>
  </div>`;
}
function totalsInner(q) {
  const t = quoteTotals(q), d = q.discount || { type: 'amount', value: 0 };
  return `<h3>Tổng tiền</h3>
    <div class="tline"><span>Tạm tính</span><b id="t-sub">${moneyD(t.sub)}</b></div>
    <div class="tline"><span>Giảm giá</span><div class="disc">
      <input class="in num" id="disc-val" data-qf="discount" aria-label="Giảm giá" inputmode="${d.type === 'percent' ? 'decimal' : 'numeric'}" autocomplete="off" value="${d.value ? (d.type === 'percent' ? QF.format(d.value) : money(d.value)) : ''}" placeholder="0">
      <div class="seg"><button data-act="disc-type" data-t="amount" aria-pressed="${d.type !== 'percent'}">đ</button><button data-act="disc-type" data-t="percent" aria-pressed="${d.type === 'percent'}">%</button></div>
    </div></div>
    <div class="tline" id="t-disc-line" ${t.disc ? '' : 'hidden'}><span class="muted">Số tiền giảm</span><span id="t-disc">−${moneyD(t.disc)}</span></div>
    <div class="tline tgrand"><span>Tổng cộng</span><b id="t-total">${moneyD(t.total)}</b></div>
    <p class="words" id="t-words">${esc(moneyWords(t.total))}</p>`;
}
function renderEditor(o) {
  const q = o.draft, isRev = o.versions.length > 0, nv = o.versions.length + 1;
  const cat = Store.list('catalog');
  const closeLabel = isRev ? `Chốt bản ${nv}` : 'Chốt đơn';
  return `<div class="editor">
    <header class="ed-top">
      <button class="iconbtn" data-act="ed-back" aria-label="Quay lại">${ic('back')}</button>
      <div class="ed-title"><b>${isRev ? `Sửa báo giá · bản ${nv}` : 'Báo giá'} ${esc(o.code)}</b><span data-savestat class="savestat"></span></div>
      <div class="ed-actions">
        <button class="btn" data-act="preview" data-src="draft">${ic('eye')}<span>Xem trước</span></button>
        <button class="btn" data-act="pdf" data-src="draft">${ic('dl')}<span>Xuất PDF</span></button>
        <button class="btn" data-act="png" data-src="draft">${ic('image')}<span>Xuất ảnh</span></button>
        <button class="btn primary" data-act="close-quote">${ic('check')}<span>${closeLabel}</span></button>
        <button class="iconbtn line" data-act="ed-menu" aria-label="Thêm thao tác">${ic('more')}</button>
      </div>
    </header>
    <div class="pane ed-scroll" data-pane="editor-${o.id}"><div class="pane-in">
      ${staleNotice(o)}
      ${isRev ? `<div class="notice warn" style="margin-bottom:14px">${ic('info')}<div>Đây là <b>bản ${nv} (nháp)</b>. Bản ${nv - 1} đã chốt vẫn giữ nguyên và có hiệu lực cho đến khi bạn bấm “${closeLabel}”.</div></div>` : ''}
      <section class="card">
        <h3>Thông tin khách hàng</h3>
        <div class="fgrid">
          <div class="field"><label for="qf-name">Khách hàng</label><div class="withbtn"><input class="in" id="qf-name" data-qf="customer.name" value="${esc(q.customer.name)}" placeholder="Tên khách" autocomplete="off"><button class="btn sm" data-act="pick-customer">${ic('user')}Khách cũ</button></div></div>
          <div class="field"><label for="qf-phone">Số điện thoại</label><input class="in" id="qf-phone" type="tel" inputmode="tel" data-qf="customer.phone" value="${esc(q.customer.phone)}" placeholder="09xx xxx xxx" autocomplete="off"></div>
          <div class="field"><label for="qf-project">Tên công trình</label><input class="in" id="qf-project" data-qf="project" value="${esc(q.project)}" placeholder="VD: Phòng ngủ master – CC ABC" autocomplete="off"></div>
          <div class="field"><label for="qf-address">Địa chỉ</label><input class="in" id="qf-address" data-qf="customer.address" value="${esc(q.customer.address)}" placeholder="Địa chỉ công trình" autocomplete="off"></div>
          <div class="field"><label for="qf-date">Ngày lập</label>${dateField('qf-date', q.date)}</div>
        </div>
      </section>
      <section class="card">
        <div class="card-h"><h3>Hạng mục</h3><span class="muted" id="row-count">${q.rows.length} dòng</span></div>
        <div class="qtable">
          <div class="qhead"><div>#</div><div>Hạng mục</div><div>Vật liệu / quy cách</div><div>ĐV</div><div class="r">Khối lượng</div><div class="r">Đơn giá</div><div class="r">Thành tiền</div><div></div></div>
          <div id="qrows">${q.rows.map(rowHtml).join('')}</div>
          <div class="empty" id="qrows-empty" ${q.rows.length ? 'hidden' : ''}>Chưa có hạng mục. Thêm từ danh mục mẫu hoặc nhập dòng mới.</div>
        </div>
        <div class="addbar"><button class="btn" data-act="add-from-cat">${ic('book')}Thêm từ danh mục</button><button class="btn" data-act="add-row">${ic('plus')}Dòng mới</button></div>
        <datalist id="cat-names">${cat.map(c => `<option value="${esc(c.name)}"></option>`).join('')}</datalist>
      </section>
      <div class="ed-bottom">
        <div class="stack">
          ${feat('plan') ? sect('qplan', 'Lịch thanh toán', `<span id="qplan-sum">${esc(planSummary(q.plan))}</span>`, `<div id="plan-card" data-plan-scope="quote" data-nohead="1">${planEditor(q.plan, quoteTotals(q).total, 'quote', true)}</div>`) : ''}
          ${sect('qnotes', 'Ghi chú & điều khoản', esc(String(q.note || q.terms || 'Chưa có').slice(0, 60)), `<div class="stack">
            <div class="field"><label for="qf-note">Ghi chú</label><textarea class="in" id="qf-note" data-qf="note" rows="3" placeholder="VD: Báo giá có hiệu lực 15 ngày.">${esc(q.note)}</textarea></div>
            <div class="field"><label for="qf-terms">Điều khoản thanh toán</label><textarea class="in" id="qf-terms" data-qf="terms" rows="3" placeholder="VD: Đặt cọc khi chốt, thanh toán phần còn lại khi bàn giao.">${esc(q.terms)}</textarea></div></div>`)}
          ${profitCardHtml(o)}
        </div>
        <section class="card totals" id="totals">${totalsInner(q)}</section>
      </div>
    </div></div>
    <div class="ed-bar">
      <button class="btn" data-act="preview" data-src="draft">${ic('eye')}<span>Xem trước</span></button>
      <button class="btn" data-act="pdf" data-src="draft">${ic('dl')}<span>PDF</span></button>
      <button class="btn" data-act="png" data-src="draft">${ic('image')}<span>Ảnh</span></button>
      <button class="btn primary" data-act="close-quote">${ic('check')}<span>${closeLabel}</span></button>
      <button class="iconbtn line" data-act="ed-menu" aria-label="Thêm thao tác">${ic('more')}</button>
    </div>
  </div>`;
}
function touchOrder(o, delay) { o.updatedAt = new Date().toISOString(); Store.put('orders', o, delay); }
function refreshTotals(o) {
  const t = quoteTotals(o.draft);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('t-sub', moneyD(t.sub)); set('t-disc', '−' + moneyD(t.disc)); set('t-total', moneyD(t.total)); set('t-words', moneyWords(t.total));
  const dl = document.getElementById('t-disc-line'); if (dl) dl.hidden = !t.disc;
  const pb = document.getElementById('plan-card'); if (pb) refreshPlanBox(pb, o.draft.plan, t.total);
  refreshProfit(o);
}
/* ---------- lịch thanh toán: trình soạn dùng chung (báo giá / mẫu / đơn đã chốt) ---------- */
function planSummary(plan) {
  if (!plan || !plan.length) return 'Không chia đợt';
  return plan.length + ' đợt · ' + plan.map((r, i) => (i === plan.length - 1 ? 'còn lại' : r.fixed ? shortMoney(r.amt || 0) : QF.format(Number(r.pct) || 0) + '%')).join(' / ');
}
function planPresetBar(scope) {
  const b = (k, l) => `<button class="btn sm" data-act="plan-preset" data-p="${k}">${l}</button>`;
  return `<div class="plan-presets"><span class="muted">Chọn nhanh</span>${scope === 'tpl' ? '' : b('tpl', 'Mẫu của tôi')}${Object.entries(PLAN_PRESETS).map(([k, p]) => b(k, p.label)).join('')}</div>`;
}
function planEditor(plan, total, scope = 'quote', nohead = false) {
  const on = !!(plan && plan.length), noamt = total == null;
  const head = nohead ? '' : `<div class="card-h"><h3>Lịch thanh toán</h3></div>`;
  const sw = scope === 'tpl'
    ? `<label class="feat plan-sw"><span><b>Báo giá mới tự chia đợt theo mẫu này</b><small>Tắt thì báo giá mới không chia đợt; vẫn bật được riêng trong từng báo giá.</small></span><input type="checkbox" class="switch" data-plan-auto ${settings().planAuto !== false ? 'checked' : ''} aria-label="Báo giá mới tự chia đợt"></label>`
    : `<label class="feat plan-sw"><span><b>Chia thành nhiều đợt</b><small>${on ? 'Mỗi đợt tính theo % hoặc số tiền cố định. Đợt cuối tự lấy phần còn lại.' : 'Đang tắt: khách trả một lần hoặc trả dần tùy ý, app chỉ theo dõi còn phải thu bao nhiêu.'}</small></span><input type="checkbox" class="switch" data-plan-on ${on ? 'checked' : ''} aria-label="Chia thành nhiều đợt"></label>`;
  if (!on) return head + sw + (scope === 'tpl' ? planPresetBar(scope) : '');
  const ord = scope === 'order' ? curOrder() : null;
  const rows = noamt ? plan.map((r, i) => ({ ...r, n: i + 1, last: i === plan.length - 1 })) : ord ? orderMoney(ord, { plan }).rows : planAmounts(plan, total);
  const over = planOver(plan, total);
  return head + sw + planPresetBar(scope) + `<div class="plan-rows">${rows.map(r => `
    <div class="prow ${noamt ? 'noamt' : ''}" data-prow="${r.id}">
      <span class="pno">Đợt ${r.n}</span>
      <input class="in pl" id="pl-${r.id}" data-pf="label" value="${esc(r.label)}" placeholder="Nội dung đợt" aria-label="Nội dung đợt ${r.n}" autocomplete="off">
      <select class="in pt" id="pt-${r.id}" data-pf="trigger" aria-label="Mốc thu đợt ${r.n}">${Object.entries(TRIGGERS).map(([k, l]) => `<option value="${k}" ${k === r.trigger ? 'selected' : ''}>${l}</option>`).join('')}</select>
      ${r.last ? `<span class="ppct rest">Còn lại</span>` : `<div class="ppct">${r.fixed
        ? `<input class="in num" id="pa-${r.id}" data-pf="amt" data-money inputmode="numeric" value="${r.amt ? money(r.amt) : ''}" placeholder="0" aria-label="Số tiền đợt ${r.n}" autocomplete="off">`
        : `<input class="in num" id="pp-${r.id}" data-pf="pct" inputmode="decimal" value="${r.pct ? QF.format(r.pct) : ''}" placeholder="0" aria-label="Tỷ lệ đợt ${r.n}" autocomplete="off">`}<button class="unit" data-act="plan-unit" data-id="${r.id}" title="Đổi giữa % và số tiền" aria-label="Đợt ${r.n} đang tính theo ${r.fixed ? 'số tiền' : 'phần trăm'}, bấm để đổi">${r.fixed ? 'đ' : '%'}</button></div>`}
      ${noamt ? '' : `<b class="pamt" data-pamt>${money(r.amount)}</b>`}
      <button class="iconbtn" data-act="plan-del" data-id="${r.id}" aria-label="Xóa đợt ${r.n}" ${plan.length <= 1 ? 'disabled' : ''}>${ic('trash')}</button>
    </div>`).join('')}</div>
    <p class="err" data-planwarn ${over ? '' : 'hidden'}>${over ? esc(planWarnText(plan, total)) : ''}</p>
    <div class="addbar"><button class="btn sm" data-act="plan-add">${ic('plus')}Thêm đợt</button><span class="muted plan-hint">Bấm % / đ để đổi cách tính. Đợt cuối tự lấy phần còn lại${scope === 'tpl' ? '' : ', gồm cả phát sinh'}.</span></div>`;
}
function refreshPlanBox(box, plan, total) {
  if (!box || !plan) return;
  const over = planOver(plan, total);
  const w = box.querySelector('[data-planwarn]'); if (w) { w.hidden = !over; w.textContent = over ? planWarnText(plan, total) : ''; }
  const sm = document.getElementById(box.dataset.planScope === 'tpl' ? 'tpl-sum' : 'qplan-sum'); if (sm) sm.textContent = planSummary(plan);
  if (total == null) return;
  const ord = box.dataset.planScope === 'order' ? curOrder() : null;
  for (const r of (ord ? orderMoney(ord, { plan }).rows : planAmounts(plan, total))) { const el = box.querySelector(`[data-prow="${r.id}"] [data-pamt]`); if (el) el.textContent = money(r.amount); }
}
function planCtx(el) {
  const box = el.closest('[data-plan-scope]'); if (!box) return null;
  const scope = box.dataset.planScope;
  if (scope === 'quote') {
    const o = curOrder(); if (!o?.draft) return null;
    if (!Array.isArray(o.draft.plan)) o.draft.plan = [];
    return { box, scope, get plan() { return o.draft.plan; }, set plan(v) { o.draft.plan = v; }, total: quoteTotals(o.draft).total, save: d => touchOrder(o, d) };
  }
  if (scope === 'tpl') return { box, scope, get plan() { return S.tplWork; }, set plan(v) { S.tplWork = v; }, total: null, save: () => saveSettings({ planTemplate: clone(S.tplWork) }) };
  const o = curOrder();
  return { box, scope, get plan() { return S.planWork; }, set plan(v) { S.planWork = v; }, total: o ? lastVersion(o).total : 0, order: o, save: () => {} };
}
function planInput(el) {
  const ctx = planCtx(el); if (!ctx) return;
  const row = ctx.plan.find(r => r.id === el.closest('[data-prow]')?.dataset.prow); if (!row) return;
  const f = el.dataset.pf;
  if (f === 'pct') row.pct = Math.min(parseQty(el.value), 100);
  else if (f === 'amt') row.amt = parseMoney(el.value);
  else row[f] = el.value;
  refreshPlanBox(ctx.box, ctx.plan, ctx.total);
  ctx.save();
}
/* bật/tắt chia đợt: tắt thì cất lịch lại, bật lại sẽ lấy về */
function planToggle(el) {
  const ctx = planCtx(el); if (!ctx) return;
  const q = ctx.scope === 'quote' ? curOrder()?.draft : null;
  if (el.checked) { const bak = q ? q.planBak : S.planBak; ctx.plan = bak && bak.length ? planCopy(bak) : newPlan(); }
  else { if (q) q.planBak = planCopy(ctx.plan); else S.planBak = planCopy(ctx.plan); ctx.plan = []; }
  rerenderPlan(ctx);
}
function rerenderPlan(ctx) { ctx.box.innerHTML = planEditor(ctx.plan, ctx.total, ctx.scope, ctx.box.dataset.nohead === '1'); const sm = document.getElementById(ctx.scope === 'tpl' ? 'tpl-sum' : 'qplan-sum'); if (sm) sm.textContent = planSummary(ctx.plan); ctx.save(0); }
function refreshRows(o) {
  const box = $('#qrows'); if (!box) return;
  box.innerHTML = o.draft.rows.map(rowHtml).join('');
  $('#qrows-empty').hidden = !!o.draft.rows.length;
  $('#row-count').textContent = o.draft.rows.length + ' dòng';
  refreshTotals(o);
}
function setPath(obj, path, v) { const ks = path.split('.'); let t = obj; while (ks.length > 1) { const k = ks.shift(); t = t[k] ||= {}; } t[ks[0]] = v; }

function onEditorInput(e) {
  const o = curOrder(); if (!o || !o.draft) return;
  const el = e.target, q = o.draft;
  if (el.dataset.pf) return;
  if (el.id === 'qf-date') { if (el.value) { q.date = el.value; touchOrder(o); } return; }
  if (el.dataset.qf) {
    if (el.dataset.qf === 'discount') {
      q.discount ||= { type: 'amount', value: 0 };
      q.discount.value = q.discount.type === 'percent' ? Math.min(parseQty(el.value), 100) : parseMoney(el.value);
      refreshTotals(o);
    } else setPath(q, el.dataset.qf, el.value);
    touchOrder(o); return;
  }
  const rowEl = el.closest('[data-row]'); if (!rowEl || !el.dataset.rf) return;
  const r = q.rows.find(x => x.id === rowEl.dataset.row); if (!r) return;
  const f = el.dataset.rf;
  if (f === 'name') {
    r.name = el.value;
    const hit = Store.list('catalog').find(c => c.name.trim().toLowerCase() === el.value.trim().toLowerCase());
    if (hit && !r.price && !r.material) {
      r.material = hit.material || ''; r.unit = hit.unit || r.unit; r.price = hit.price || 0; r.kid = hit.id; r.kp = hit.price || 0;
      rowEl.querySelector('[data-rf=material]').value = r.material;
      rowEl.querySelector('[data-rf=unit]').value = r.unit;
      rowEl.querySelector('[data-rf=price]').value = r.price ? money(r.price) : '';
    }
  } else if (f === 'material') r.material = el.value;
  else if (f === 'unit') { r.unit = el.value; if (r.dims) { r.qty = dimsQty(r.unit, r.dims); rowEl.querySelector('[data-rf=qty]').value = r.qty ? fmtQty(r.qty) : ''; const d = rowEl.querySelector('[data-dim]'); d.textContent = 'KT: ' + dimText(r.unit, r.dims); } }
  else if (f === 'qty') { r.qty = parseQty(el.value); if (r.dims) { r.dims = null; const d = rowEl.querySelector('[data-dim]'); d.hidden = true; d.textContent = ''; } }
  else if (f === 'price') r.price = parseMoney(el.value);
  rowEl.querySelector('[data-amt]').textContent = money(rowAmount(r));
  refreshTotals(o);
  touchOrder(o);
}

function dimsSheet(o, r) {
  const d = r.dims || { a: '', b: '', n: 1, u: 'mm' };
  const showB = r.unit !== 'md';
  const el = openSheet({
    title: 'Nhập kích thước',
    html: `<p class="muted">${esc(r.name || 'Dòng ' + (o.draft.rows.indexOf(r) + 1))} · đơn vị tính <b>${r.unit}</b></p>
      <div class="field"><span class="lbl">Đơn vị đo</span><div class="seg" id="dim-u">${['mm', 'cm', 'm'].map(u => `<button data-sa="u" data-u="${u}" aria-pressed="${d.u === u}">${u}</button>`).join('')}</div></div>
      <div class="fgrid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
        <div class="field"><label for="dim-a">Dài</label><input class="in num" id="dim-a" inputmode="decimal" value="${d.a ? QF.format(d.a) : ''}" autocomplete="off"></div>
        <div class="field" ${showB ? '' : 'hidden'}><label for="dim-b">${r.unit === 'm²' ? 'Cao / Rộng' : 'Rộng / Cao'}</label><input class="in num" id="dim-b" inputmode="decimal" value="${d.b ? QF.format(d.b) : ''}" autocomplete="off"></div>
        <div class="field"><label for="dim-n">Số lượng</label><input class="in num" id="dim-n" inputmode="decimal" value="${QF.format(d.n || 1)}" autocomplete="off"></div>
      </div>
      <div class="calcline" id="dim-calc"></div>
      <p class="muted" style="font-size:14px">${r.unit === 'm²' ? 'Công thức: Dài × Cao × Số lượng (đổi ra m²).' : r.unit === 'md' ? 'Công thức: Dài × Số lượng (đổi ra mét dài).' : 'Đơn vị ' + r.unit + ': khối lượng = số lượng. Kích thước chỉ để ghi chú trên báo giá.'}</p>`,
    foot: `<button class="btn" data-sa="close">Hủy</button><button class="btn primary" data-sa="apply">Áp dụng</button>`,
    onMount: el => {
      const calc = () => {
        const nd = cur(); const qv = dimsQty(r.unit, nd);
        el.querySelector('#dim-calc').innerHTML = `${esc(dimText(r.unit, nd) || '—')} = <b>${fmtQty(qv)} ${r.unit}</b>`;
      };
      const cur = () => ({ u: el.querySelector('#dim-u [aria-pressed=true]').dataset.u, a: parseQty(el.querySelector('#dim-a').value), b: parseQty(el.querySelector('#dim-b').value), n: parseQty(el.querySelector('#dim-n').value) || 1 });
      el._cur = cur; el._calc = calc;
      el.addEventListener('input', calc); calc();
      setTimeout(() => softFocus(el.querySelector('#dim-a')), 60);
    },
    onClick: (a, b, el) => {
      if (a === 'u') { $$('#dim-u button', el).forEach(x => x.setAttribute('aria-pressed', x === b)); el._calc(); return; }
      if (a === 'apply') {
        const nd = el._cur();
        if (!nd.a || (r.unit === 'm²' && !nd.b)) { toast('Hãy nhập đủ kích thước.', 'bad'); return; }
        r.dims = nd; r.qty = dimsQty(r.unit, nd);
        closeSheet(el); refreshRows(o); touchOrder(o, 0);
      }
    },
  });
}
function catalogPicker(o) {
  let added = 0;
  const listHtml = filter => {
    const f = fold(filter);
    const items = Store.list('catalog').filter(c => c.name && (!f || fold(c.name + ' ' + c.material + ' ' + catGroup(c)).includes(f)));
    if (!items.length) return `<div class="empty">${Store.list('catalog').length ? 'Không tìm thấy hạng mục.' : 'Danh mục mẫu đang trống. Vào “Danh mục” → “Bộ hạng mục chuẩn” để nạp sẵn.'}</div>`;
    return GROUPS.map(g => { const its = items.filter(c => catGroup(c) === g).sort((a, b) => a.name.localeCompare(b.name, 'vi')); return its.length ? `<div class="grp-h">${esc(g)}</div>` + its.map(c => `<button class="pick" data-sa="add" data-id="${c.id}"><div class="pm"><b>${esc(c.name)}</b><span>${esc(c.material || '')}</span></div><div class="pp">${c.price ? money(c.price) + ' đ' : '<span class="muted">Chưa có giá</span>'}/${esc(c.unit)}</div><span class="added" hidden>${ic('check')}</span></button>`).join('') : ''; }).join('');
  };
  const el = openSheet({
    title: 'Thêm từ danh mục mẫu', cls: 'wide',
    html: `<div class="search" style="margin:0">${ic('search')}<input class="in" id="cat-q" type="search" placeholder="Tìm hạng mục" aria-label="Tìm hạng mục" autocomplete="off"></div><div class="pick-list" id="cat-list">${listHtml('')}</div>`,
    foot: `<span class="muted" id="cat-added" style="margin-right:auto;align-self:center">Chạm để thêm. Có thể chọn nhiều.</span><button class="btn primary" data-sa="close">Xong</button>`,
    onMount: el => el.querySelector('#cat-q').addEventListener('input', e => { el.querySelector('#cat-list').innerHTML = listHtml(e.target.value); }),
    onClick: (a, b, el) => {
      if (a !== 'add') return;
      const c = Store.get('catalog', b.dataset.id); if (!c) return;
      const nr = newRow({ name: c.name, material: c.material || '', unit: c.unit || 'm²', price: c.price || 0, qty: ['gói', 'bộ', 'cái', 'cánh', 'điểm', 'công'].includes(c.unit) ? 1 : 0, kid: c.id, kp: c.price || 0 });
      o.draft.rows.push(nr);
      if (catCost(c.id)) saveCostDoc(o.id, { rows: { [nr.id]: catCost(c.id) }, kc: { [nr.id]: catCost(c.id) } });
      added++; b.querySelector('.added').hidden = false;
      el.querySelector('#cat-added').textContent = `Đã thêm ${added} hạng mục`;
      refreshRows(o); touchOrder(o);
    },
  });
}
function customerPicker(o) {
  const listHtml = f => {
    const ff = fold(f);
    const cs = Store.list('customers').filter(c => !ff || fold(c.name + ' ' + c.phone + ' ' + c.address).includes(ff)).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    if (!cs.length) return `<div class="empty">${Store.list('customers').length ? 'Không tìm thấy khách.' : 'Chưa có khách nào được lưu. Khách sẽ tự lưu khi chốt đơn.'}</div>`;
    return cs.map(c => `<button class="pick" data-sa="pick" data-id="${c.id}"><div class="pm"><b>${esc(c.name)}</b><span>${esc([c.phone, c.address].filter(Boolean).join(' · '))}</span></div></button>`).join('');
  };
  openSheet({
    title: 'Chọn khách hàng',
    html: `<div class="search" style="margin:0">${ic('search')}<input class="in" id="cus-q" type="search" placeholder="Tên hoặc số điện thoại" aria-label="Tìm khách cũ" autocomplete="off"></div><div class="pick-list" id="cus-list">${listHtml('')}</div>`,
    onMount: el => el.querySelector('#cus-q').addEventListener('input', e => { el.querySelector('#cus-list').innerHTML = listHtml(e.target.value); }),
    onClick: (a, b, el) => {
      const c = Store.get('customers', b.dataset.id); if (!c) return;
      o.draft.customer = { name: c.name, phone: c.phone || '', address: c.address || '' };
      o.customerId = c.id; closeSheet(el); touchOrder(o, 0); render();
    },
  });
}
function validateQuote(q) {
  const errs = [];
  if (!q.customer.name.trim()) errs.push('Chưa nhập tên khách hàng.');
  const rows = q.rows.filter(r => r.name.trim() || rowAmount(r));
  if (!rows.length) errs.push('Báo giá chưa có hạng mục nào.');
  if (rows.some(r => !r.name.trim())) errs.push('Có dòng có tiền nhưng chưa có tên hạng mục.');
  if (rows.some(r => r.name.trim() && !rowAmount(r))) errs.push('Có hạng mục chưa có khối lượng hoặc đơn giá (thành tiền bằng 0).');
  if (quoteTotals(q).total <= 0) errs.push('Tổng tiền phải lớn hơn 0.');
  return errs;
}
function closeQuoteSheet(o) {
  const q = o.draft, errs = validateQuote(q), t = quoteTotals(q), isRev = o.versions.length > 0, prev = lastVersion(o);
  const plan = orderMoney(o, { quote: q, pays: false }).rows, first = plan[0];
  if (errs.length) {
    openSheet({ title: 'Chưa chốt được', html: `<p>Hãy sửa các điểm sau rồi chốt lại:</p><ul class="err">${errs.map(e => `<li>${esc(e)}</li>`).join('')}</ul>`, foot: `<button class="btn primary" data-sa="close">Đã hiểu</button>` });
    return;
  }
  const el = openSheet({
    title: isRev ? `Chốt bản ${o.versions.length + 1}` : 'Chốt đơn', cls: 'wide',
    html: `<div><div class="muted">${esc(q.customer.name)}${q.project ? ' · ' + esc(q.project) : ''}</div><div class="big-money">${moneyD(t.total)}</div>
      ${isRev ? `<div class="calcline" style="margin-top:8px">Bản ${prev.no}: ${moneyD(prev.total)} → bản ${o.versions.length + 1}: <b>${moneyD(t.total)}</b><br><span class="muted">Chênh lệch ${signed(t.total - prev.total)} đ, tính vào giá trị đơn từ ngày chốt bản mới.</span></div>` : ''}</div>
      ${plan.length ? `<div class="plan-mini">${plan.map(r => `<div><span>Đợt ${r.n} · ${esc(r.label)}</span><b>${money(r.amount)}</b></div>`).join('')}</div>` : `<p class="muted">Không chia đợt: khách trả một lần hoặc trả dần tùy ý. Có thể chia đợt sau trong trang đơn.</p>`}
      <div class="fgrid">
        <div class="field"><label for="cl-date">Ngày chốt</label>${dateField('cl-date', today())}</div>
        ${isRev ? '' : `<div class="field"><label for="cl-dep">Khách đặt cọc (nếu có)</label>${moneyInput('cl-dep', 0, 'placeholder="0"')}</div>`}
      </div>
      ${isRev ? '' : `<div class="addbar" style="margin-top:-4px">${first ? `<button class="btn sm" data-sa="dep-first">Cọc bằng đợt 1 (${money(first.amount)})</button>` : ''}${first && bankReady() ? `<button class="btn sm" data-sa="qr-first">${ic('qr')}Hiện mã QR đợt 1</button>` : ''}<div class="seg" id="cl-method">${methodSeg('transfer')}</div></div>`}
      <div class="field"><span class="lbl">Khách ký xác nhận báo giá (nên có)</span>${sigPadHtml('cl-sig')}</div>
      <div class="field"><label for="cl-signer">Người ký</label><input class="in" id="cl-signer" value="${esc(q.customer.name)}" autocomplete="off"></div>
      <div class="notice">${ic('lock')}<div>Sau khi chốt, nội dung báo giá được <b>khóa</b>. Muốn sửa sẽ tạo phiên bản mới, bản cũ vẫn được giữ.</div></div>`,
    foot: `<button class="btn" data-sa="close">Hủy</button><button class="btn primary" data-sa="ok">${ic('check')}${isRev ? 'Chốt bản mới' : 'Chốt đơn'}</button>`,
    onMount: el => { el._sig = mountSigPad(el.querySelector('#cl-sig')); },
    onClick: (a, b, el) => {
      if (a === 'dep-first') { const i = el.querySelector('#cl-dep'); i.value = money(first.amount); return; }
      if (a === 'qr-first') { qrSheet(o, { n: 1, label: first.label, left: first.amount }); return; }
      if (a === 'm') { segPick(b); return; }
      if (a !== 'ok') return;
      const date = el.querySelector('#cl-date').value || today();
      const dep = isRev ? 0 : parseMoney(el.querySelector('#cl-dep').value);
      const method = isRev ? 'transfer' : el.querySelector('#cl-method [aria-pressed=true]').dataset.v;
      const sig = el._sig.isEmpty() ? null : el._sig.toDataURL();
      const signer = el.querySelector('#cl-signer').value.trim() || q.customer.name;
      closeSheet(el); doClose(o, date, dep, method, sig, signer);
    },
  });
}
function upsertCustomer(c) {
  const name = (c.name || '').trim(); if (!name) return null;
  const ph = digits(c.phone);
  let hit = Store.list('customers').find(x => ph ? digits(x.phone) === ph : (!digits(x.phone) && x.name.trim().toLowerCase() === name.toLowerCase()));
  if (hit) {
    const up = { ...hit, name, phone: c.phone || hit.phone, address: c.address || hit.address };
    Store.put('customers', up, 0); return hit.id;
  }
  const n = { id: uid('c'), name, phone: c.phone || '', address: c.address || '', createdAt: new Date().toISOString() };
  Store.put('customers', n, 0); return n.id;
}
async function doClose(o, date, dep, method = 'transfer', sig = null, signer = '') {
  const r = await Orders.close(o, { date, deposit: dep, method, sig, signer }); if (!r) return;
  S.view = 'detail'; S.ver = null; render();
  toast(r.first ? 'Đã chốt đơn ' + o.code : `Đã chốt bản ${r.version.no}`);
}
function methodSeg(v) { return Object.entries(PAY_METHOD).map(([k, l]) => `<button type="button" data-sa="m" data-v="${k}" aria-pressed="${k === v}">${l}</button>`).join(''); }
function segPick(b) { $$('button', b.parentElement).forEach(x => x.setAttribute('aria-pressed', x === b)); }
function createOrderFrom(q, demo = false) {
  const o = { id: uid('o'), code: nextCode(), ...(Store.mode === 'team' ? { codeTemp: true, owner: Team.uid() } : {}), status: 'quote', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), draft: q, versions: [], payments: [], changes: [], attachments: [], notes: [], log: [], demo };
  addLog(o, 'Tạo báo giá');
  return o;
}
function copyQuoteToNew(src, fromCode) {
  if (!can('quote')) { toast('Vai trò của bạn không lập báo giá.', 'bad'); return; }
  const q = clone(src), from = curOrder(), idMap = {};
  q.date = today();
  q.rows = q.rows.map(r => { const id = uid('r'); idMap[r.id] = id; return { ...r, id }; });
  q.plan = Array.isArray(q.plan) ? planCopy(q.plan, false) : newPlan(); delete q.planBak;
  const o = createOrderFrom(q);
  if (from) carryRowCosts(from.id, o.id, idMap);
  o.log = [{ id: uid('l'), at: new Date().toISOString(), text: 'Sao chép từ báo giá ' + fromCode }];
  Store.put('orders', o, 0);
  S.tab = 'orders'; S.orderId = o.id; S.view = 'edit'; render();
  toast('Đã tạo báo giá mới ' + o.code + ' từ ' + fromCode);
}
async function deleteOrder(o) {
  const ok = await confirmBox({ title: 'Xóa đơn ' + o.code + '?', text: `Toàn bộ báo giá, thanh toán, phát sinh, ảnh và ghi chú của đơn <b>${esc(headQuote(o).customer?.name || o.code)}</b> sẽ bị xóa và không khôi phục được.`, ok: 'Xóa đơn', danger: true });
  if (!ok) return;
  for (const a of o.attachments || []) removeAttBlob(a);
  Store.del('orders', o.id);
  S.orderId = null; S.view = 'list'; render(); toast('Đã xóa đơn ' + o.code);
}

/* ---------- xem trước & PDF ---------- */
async function previewQuote(o, src) {
  const el = openSheet({ title: 'Xem trước báo giá', cls: 'wide', html: `<div class="preview-pages" id="pv"><p class="muted">Đang dựng trang A4…</p></div>`, foot: `<button class="btn" data-sa="close">Đóng</button><button class="btn" data-sa="png" disabled>${ic('image')}Xuất ảnh PNG</button><button class="btn primary" data-sa="pdf" disabled>${ic('dl')}Xuất PDF</button>` });
  try {
    const res = await renderQuotePages(o, src);
    if (!document.body.contains(el)) return;
    const urls = res.pages.map(p => URL.createObjectURL(p.blob));
    el.querySelector('#pv').innerHTML = urls.map((u, i) => `<img src="${u}" alt="Trang ${i + 1}" width="${res.pages[i].w}" height="${res.pages[i].h}">`).join('');
    const btn = el.querySelector('[data-sa=pdf]'); btn.disabled = false;
    btn.onclick = e => { e.stopPropagation(); exportPdf(o, src, res); };
    const pb = el.querySelector('[data-sa=png]'); pb.disabled = false;
    pb.onclick = e => { e.stopPropagation(); exportPdf(o, src, res, 'png'); };
  } catch (e) { el.querySelector('#pv').innerHTML = `<p class="err">Không dựng được trang xem trước. Hãy thử lại.</p>`; }
}
function waitCode(o) {
  if (!o || !o.codeTemp) return false;
  Store.flushAll(); toast('Đơn đang chờ máy chủ cấp số chính thức. Cần có mạng, đợi vài giây rồi thử lại.', 'bad'); return true;
}
async function exportPdf(o, src, pre, fmt = 'pdf') {
  if (waitCode(o)) return;
  const png = fmt === 'png';
  try {
    toast(png ? 'Đang tạo ảnh…' : 'Đang tạo PDF…');
    const res = pre || await renderQuotePages(o, src);
    const blob = png ? await makePng(res.pages, res.size) : makePdf(res.pages, res.title);
    const name = `Bao-gia-${o.code}${res.label ? '-' + fileSafe(res.label) : ''}-${fileSafe(res.q.customer?.name || '')}`.replace(/-+$/, '') + (png ? '.png' : '.pdf');
    await saveFile(name, blob);
  } catch (e) { toast(png ? 'Không tạo được ảnh. Hãy thử lại.' : 'Không tạo được PDF. Hãy thử lại.', 'bad'); }
}

/* ---------- 3. Chi tiết đơn ---------- */
function renderDetail(o) {
  if (!isClosed(o)) {
    const q = o.draft;
    return `<div class="pane-in">
      <div class="d-head">${!isWide() ? `<button class="iconbtn line" data-act="back-list" aria-label="Danh sách">${ic('back')}</button>` : ''}
        <div class="d-title"><span class="pill s-quote">Đang báo giá</span><h2>${esc(q.customer.name || 'Khách chưa đặt tên')}</h2><p class="d-sub">${esc(q.project || '')} · ${esc(o.code)} · lập ${fmtDate(q.date)}</p></div><div class="d-contact">${contactBtns(q.customer.phone)}</div></div>
      <div class="bignums"><div class="bignum"><span>Giá trị báo giá</span><b>${money(quoteTotals(q).total)}</b><small>chưa chốt</small></div></div>
      ${can('quote') ? `<button class="btn primary big" data-act="edit-quote">${ic('edit')}Mở báo giá</button>` : `<div class="addbar"><button class="btn" data-act="preview" data-src="draft">${ic('eye')}Xem báo giá</button></div>`}
      ${teamDetailCards(o)}
    </div>`;
  }
  const v = lastVersion(o), total = orderTotal(o), paid = orderPaid(o), due = orderDue(o), over = orderOver(o), h = v.quote;
  const chg = confirmedChanges(o), nx = nextInstallment(o), shownV = o.versions.find(x => x.no === (S.ver || v.no)) || v;
  const seg = ['closed', 'building', 'done'].map(k => `<button data-act="set-status" data-s="${k}" aria-pressed="${o.status === k}">${STATUS[k].label}</button>`).join('');
  const pays = [...o.payments].sort((a, b) => a.date.localeCompare(b.date));
  const changes = [...o.changes].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  return `<div class="pane-in">
    <div class="d-head">
      ${!isWide() ? `<button class="iconbtn line" data-act="back-list" aria-label="Danh sách">${ic('back')}</button>` : ''}
      <div class="d-title"><span class="pill ${STATUS[o.status].cls}">${STATUS[o.status].label}</span> ${o.demo ? '<span class="tag">Mẫu</span>' : ''}
        <h2>${esc(h.customer.name)}</h2><p class="d-sub">${esc(h.project || '')}${h.project ? ' · ' : ''}${esc(o.code)} · chốt ${fmtDate(o.closedAt)}${h.customer.phone ? ' · ' + esc(h.customer.phone) : ''}</p></div>
      <div class="d-contact">${contactBtns(h.customer.phone)}<button class="iconbtn line" data-act="order-menu" aria-label="Thêm thao tác">${ic('more')}</button></div>
    </div>
    <div class="seg" role="group" aria-label="Trạng thái đơn" style="margin-bottom:14px">${seg}</div>
    <div class="bignums">
      <div class="bignum"><span>Tổng giá trị</span><b>${money(total)}</b><small>${chg ? `Báo giá ${money(v.total)} ${chg > 0 ? '+' : '−'} phát sinh ${money(Math.abs(chg))}` : 'theo báo giá đã chốt'}</small></div>
      <div class="bignum paid"><span>Đã thu</span><b>${money(paid)}</b><small>${o.payments.length} lần thanh toán</small></div>
      <div class="bignum ${due ? 'due' : ''}"><span>Còn phải thu</span><b>${money(due)}</b><small>${due ? (nx ? `${dotLabel(nx)}: ${money(nx.left)} · ${PLAN_STATE[nx.state].label.toLowerCase()}` : 'tính đến ' + fmtDate(today())) : 'Đã thu đủ'}</small></div>
    </div>
    ${over ? `<div class="notice" style="margin-bottom:14px;background:var(--info-soft)">${ic('info')}<div>Khách đã trả <b>thừa ${moneyD(over)}</b> so với tổng giá trị đơn. Cần hoàn lại hoặc trừ vào phát sinh sau.</div></div>` : ''}
    ${teamDetailCards(o)}
    ${o.draft || o.status === 'done' ? '' : staleNotice(o)}
    <div class="d-actions">
      <button class="btn primary" data-act="add-pay">${ic('money')}<span>${can('pay') ? 'Thu tiền' : 'Báo đã thu'}</span></button>
      <button class="btn" data-act="add-change">${ic('pm')}<span>Phát sinh</span></button>
      <button class="btn" data-act="handover">${ic('sign')}<span>${o.handover ? 'Biên bản' : 'Nghiệm thu'}</span></button>
      <button class="btn" data-act="add-att" ${Store.mode === 'cloud' && !caps.assets ? 'disabled' : ''}>${ic('camera')}<span>Ảnh</span></button>
      <button class="btn" data-act="focus-note">${ic('note')}<span>Ghi chú</span></button>
    </div>
    ${planCardHtml(o)}
    <input type="file" id="att-input" accept="image/*,application/pdf" multiple hidden>

    ${sect('quote', `Báo giá đã chốt · bản ${v.no}`, `${money(v.total)} đ · ${v.sign ? 'khách đã ký' : '<span class="warnt">khách chưa ký</span>'}${o.versions.length > 1 ? ` · ${o.versions.length} bản` : ''}`, `
      ${o.versions.length > 1 ? `<div class="verlist">${o.versions.map(x => `<button class="chip" data-act="show-ver" data-v="${x.no}" aria-pressed="${x.no === (S.ver || v.no)}">Bản ${x.no} · ${money(x.total)}</button>`).join('')}</div>` : ''}
      ${lockedQuoteHtml(shownV)}
      ${shownV.sign ? signedHtml(shownV.sign, `Khách đã ký xác nhận bản ${shownV.no}`) : `<div class="notice warn" style="margin-top:12px">${ic('sign')}<div>Khách chưa ký xác nhận bản ${shownV.no}. <button class="btn sm" data-act="sign-version" data-v="${shownV.no}">Khách ký ngay</button></div></div>`}
      ${o.draft ? `<div class="notice warn" style="margin-top:12px">${ic('edit')}<div>Đang sửa <b>bản ${o.versions.length + 1}</b> (chưa chốt). ${can('quote') ? `<button class="btn sm" data-act="edit-quote">Tiếp tục sửa</button>` : ''}</div></div>` : ''}
      <div class="addbar">
        <button class="btn sm" data-act="preview" data-src="${S.ver || v.no}">${ic('eye')}Xem</button>
        <button class="btn sm" data-act="png" data-src="${S.ver || v.no}">${ic('image')}Xuất ảnh</button>
        ${o.draft || !can('quote') ? '' : `<button class="btn sm" data-act="revise">${ic('edit')}Sửa (tạo bản mới)</button>`}
        <button class="btn sm" data-act="copy-quote" data-src="${S.ver || v.no}">${ic('copy')}Sao chép thành báo giá mới</button>
      </div>`, { open: !shownV.sign || !!o.draft || S.ver != null, act: `<button class="btn sm" data-act="pdf" data-src="${S.ver || v.no}">${ic('dl')}PDF</button>` })}

    ${sect('pays', 'Thanh toán', pays.length ? `${pays.length} lần · ${money(paid)} đ` : 'Chưa có', pays.length ? `<div class="rowlist">${pays.map(p => `<div class="ritem"><div class="rmain"><b>${fmtDate(p.date)}</b><div class="rsub">${PAY_METHOD[p.method] || ''} · ${receiptNo(o, p)}${p.note ? ' · ' + esc(p.note) : ''}</div></div><div class="ramt plus">${moneyD(p.amount)}</div><button class="iconbtn line" data-act="receipt" data-id="${p.id}" aria-label="Phiếu thu ${receiptNo(o, p)}" title="Phiếu thu">${ic('file')}</button>${can('delPay') ? `<button class="iconbtn" data-act="del-pay" data-id="${p.id}" aria-label="Xóa thanh toán">${ic('trash')}</button>` : ''}</div>`).join('')}</div><div class="sumline"><span>Tổng đã thu</span><span class="num">${moneyD(paid)}</span></div>` : `<p class="muted">Chưa có thanh toán nào.</p>`, { open: true, act: `<button class="btn sm" data-act="add-pay">${ic('plus')}${can('pay') ? 'Thêm' : 'Báo đã thu'}</button>` })}

    ${sect('changes', 'Phát sinh', changes.length ? `${changes.filter(c => c.status === 'pending').length ? `<span class="warnt">${changes.filter(c => c.status === 'pending').length} chờ xác nhận</span> · ` : ''}${signed(chg)} đ` : 'Chưa có', changes.length ? `<div class="rowlist">${changes.map(c => {
        const proof = c.custSign ? ' · khách đã ký' : c.proofId ? ' · có ảnh xác nhận' : ' · chưa có xác nhận của khách';
        const stt = c.status === 'confirmed' ? `Đã xác nhận ${fmtDate(c.confirmedAt)}${proof}` : c.status === 'cancelled' ? 'Đã hủy' : 'Chờ xác nhận – chưa tính vào tổng';
        return `<div class="ritem ${c.status === 'cancelled' ? 'cancel' : ''}"><div class="rmain"><b>${esc(c.title)}</b><div class="rsub">${stt}${c.note ? ' · ' + esc(c.note) : ''}</div></div><div class="ramt ${c.sign < 0 ? 'minus' : 'plus'}">${c.sign < 0 ? '−' : '+'}${money(c.amount)}</div>
        ${c.status === 'pending' ? `<button class="btn sm primary" data-act="confirm-change" data-id="${c.id}">Xác nhận</button><button class="iconbtn" data-act="cancel-change" data-id="${c.id}" aria-label="Hủy phát sinh">${ic('x')}</button>` : ''}</div>`;
      }).join('')}</div><div class="sumline"><span>Phát sinh đã xác nhận</span><span class="num">${signed(chg)} đ</span></div>` : `<p class="muted">Phát sinh chỉ cộng/trừ vào tổng sau khi bấm “Xác nhận”.</p>`, { open: changes.some(c => c.status === 'pending'), act: `<button class="btn sm" data-act="add-change">${ic('plus')}Thêm</button>` })}

    ${o.handover ? handoverCardHtml(o) : ''}
    ${profitCardHtml(o)}
    ${orderCashHtml(o)}

    ${sect('atts', 'Ảnh hiện trường & bản vẽ', o.attachments.length ? o.attachments.length + ' tệp' : 'Chưa có', o.attachments.length ? `<div class="thumbs">${o.attachments.map(a => `<button class="thumb" data-act="open-att" data-id="${a.id}" aria-label="${esc(a.name)}">${a.kind === 'image' ? `<img data-att="${a.id}" alt="" loading="lazy" decoding="async">` : `<div class="fileph">${ic('file')}<span>${esc(a.name)}</span></div>`}</button>`).join('')}</div>` : `<p class="muted">Chụp hiện trường hoặc chọn file PDF bản vẽ.</p>`, { open: o.attachments.length > 0 && o.attachments.length <= 8, act: `<button class="btn sm" data-act="add-att" ${Store.mode === 'cloud' && !caps.assets ? 'disabled' : ''}>${ic('plus')}Thêm</button>` })}

    ${sect('notes', 'Ghi chú', o.notes.length ? `${o.notes.length} · ${esc(String(o.notes[o.notes.length - 1].text).slice(0, 50))}` : 'Chưa có', `${o.notes.length ? `<div class="rowlist">${o.notes.map(n => `<div class="ritem"><div class="rmain">${esc(n.text)}<div class="rsub">${fmtDateTime(new Date(n.at))}</div></div><button class="iconbtn" data-act="del-note" data-id="${n.id}" aria-label="Xóa ghi chú">${ic('trash')}</button></div>`).join('')}</div>` : ''}
      <div class="note-add"><input class="in" id="note-in" placeholder="Ghi chú ngắn, VD: khách muốn đổi màu cánh tủ" aria-label="Thêm ghi chú" autocomplete="off"><button class="btn" data-act="add-note">Thêm</button></div>`, { open: o.notes.length > 0 })}

    ${sect('hist', 'Lịch sử', `${(o.log || []).length} mục${o.log && o.log.length ? ' · ' + esc(String(o.log[o.log.length - 1].text).slice(0, 48)) : ''}`, `<ul class="hist">${[...(o.log || [])].reverse().map(l => `<li><span class="num">${fmtDateTime(new Date(l.at))}</span> · ${esc(l.text)}${l.by ? ` <span class="muted">(${esc(l.by)})</span>` : ''}</li>`).join('')}</ul>`)}
  </div>`;
}
function signedHtml(sg, title) {
  return `<div class="signed"><img src="${esc(sg.img)}" alt="Chữ ký của ${esc(sg.name)}"><div><b>${esc(title)}</b><div class="rsub">${esc(sg.name)} · ${fmtDateTime(new Date(sg.at))} · mã ${esc(sg.hash)}</div></div></div>`;
}
function planCardHtml(o) {
  const rows = planStatus(o), one = rows.length === 1 && rows[0].one;
  const btn = feat('plan') ? `<button class="btn sm" data-act="plan-edit">${ic('edit')}${one ? 'Chia đợt' : 'Sửa lịch'}</button>` : '';
  const head = `<div class="card-h"><h3>${one ? 'Thanh toán' : 'Lịch thanh toán'}</h3>${btn}</div>`;
  if (!rows.length) return '';
  return `<section class="card">${head}<div class="rowlist">${rows.map(r => `
    <div class="ritem pd">
      <div class="rmain"><b>${r.one ? 'Không chia đợt · thu một lần' : `Đợt ${r.n} · ${esc(r.label)}`}</b>
        <div class="rsub">${r.one ? 'Đến hạn khi nghiệm thu, bàn giao hoặc theo ngày hẹn' : `${r.last ? 'Phần còn lại' : r.fixed ? 'Số tiền cố định' : QF.format(Number(r.pct) || 0) + '%'} · ${TRIGGERS[r.trigger] || ''}`}${r.paid && r.left ? ` · đã thu ${money(r.paid)}` : ''}</div>
        <div class="pd-meta"><span class="pill ${PLAN_STATE[r.state].cls}">${PLAN_STATE[r.state].label}</span>
          ${r.state !== 'paid' ? `<label class="duechip" for="due-${r.id}">${ic('cal')}<span>${r.due ? 'Hạn ' + fmtDate(r.due) : 'Đặt hạn trả'}</span><input type="date" id="due-${r.id}" data-due="${r.id}" value="${esc(r.due || '')}"></label>` : ''}
        </div></div>
      <div class="ramt">${money(r.amount)}${r.left && r.paid ? `<div class="rsub">còn ${money(r.left)}</div>` : ''}</div>
      ${r.left > 0 ? `<div class="pd-btns">${bankReady() ? `<button class="iconbtn line" data-act="plan-qr" data-n="${r.n}" aria-label="Mã QR ${dotName(r)}">${ic('qr')}</button>` : ''}<button class="btn sm primary" data-act="plan-pay" data-n="${r.n}">Thu</button></div>` : ''}
    </div>`).join('')}</div>
    ${bankReady() || !rows.some(r => r.left > 0) ? '' : `<p class="muted" style="font-size:14px;margin-top:8px">Nhập ngân hàng và số tài khoản trong <button class="linkbtn" data-act="tab" data-tab="settings">Cài đặt</button> để tạo mã VietQR.</p>`}
  </section>`;
}
function handoverCardHtml(o) {
  const h = o.handover;
  return `<section class="card"><div class="card-h"><h3>Nghiệm thu, bàn giao</h3><div class="addbar" style="margin:0"><button class="btn sm" data-act="handover-png">${ic('image')}Ảnh</button><button class="btn sm" data-act="handover-pdf">${ic('dl')}Biên bản PDF</button></div></div>
    <p>Ngày ${fmtDate(h.date)} · bảo hành ${h.warrantyMonths} tháng, đến <b>${fmtDate(h.warrantyUntil)}</b></p>
    ${h.note ? `<p class="muted" style="margin-top:4px">${esc(h.note)}</p>` : ''}
    ${h.sign ? signedHtml(h.sign, 'Khách đã ký biên bản nghiệm thu') : `<p class="muted" style="margin-top:6px">Khách chưa ký biên bản.</p>`}
  </section>`;
}
function lockedQuoteHtml(v) {
  const q = v.quote;
  return `<div class="scrollx"><table class="lockq"><thead><tr><th>Hạng mục</th><th class="r">KL</th><th class="r">Đơn giá</th><th class="r">Thành tiền</th></tr></thead><tbody>
    ${q.rows.map(r => `<tr><td><b>${esc(r.name)}</b><span class="sub">${esc(r.material || '')}${r.dims ? (r.material ? ' · ' : '') + 'KT: ' + esc(dimText(r.unit, r.dims)) : ''}</span></td><td class="r">${fmtQty(r.qty)} ${esc(r.unit)}</td><td class="r">${money(r.price)}</td><td class="r"><b>${money(rowAmount(r))}</b></td></tr>`).join('')}
    ${v.disc ? `<tr><td colspan="3" class="r">Tạm tính</td><td class="r">${money(v.sub)}</td></tr><tr><td colspan="3" class="r">Giảm giá</td><td class="r">−${money(v.disc)}</td></tr>` : ''}
    <tr><td colspan="3" class="r"><b>Tổng báo giá</b></td><td class="r"><b>${moneyD(v.total)}</b></td></tr>
  </tbody></table></div>`;
}
function paySheet(o, preset = null) {
  const due = orderDue(o);
  const dueRows = planStatus(o).filter(r => r.left > 0).slice(0, 3);
  openSheet({
    title: can('pay') ? 'Ghi nhận thanh toán' : 'Báo đã thu tiền (chờ xác nhận)',
    html: `<p class="muted">${esc(headQuote(o).customer.name)} · còn phải thu <b>${moneyD(due)}</b></p>
      <div class="field"><label for="pay-amt">Số tiền</label>${moneyInput('pay-amt', preset ? preset.left : 0, 'placeholder="0" style="font-size:22px;font-weight:700"')}</div>
      <div class="addbar" style="margin-top:-4px">${dueRows.map(r => `<button class="btn sm" data-sa="row" data-n="${r.n}">${r.one ? `Thu đủ phần còn lại (${money(r.left)})` : `Đợt ${r.n}: ${money(r.left)}`}</button>`).join('')}${due && !dueRows.length ? `<button class="btn sm" data-sa="full">Thu đủ phần còn lại (${money(due)})</button>` : ''}</div>
      <p class="err" id="pay-warn" hidden></p>
      <div class="field"><span class="lbl">Hình thức</span><div class="seg" id="pay-method">${methodSeg('transfer')}</div></div>
      <div class="fgrid">
        <div class="field"><label for="pay-date">Ngày thanh toán</label>${dateField('pay-date', today())}</div>
        <div class="field"><label for="pay-note">Nội dung</label><input class="in" id="pay-note" value="${preset ? esc(payNote(preset)) : ''}" placeholder="VD: Thanh toán đợt 2" autocomplete="off"></div>
      </div>`,
    foot: `<button class="btn" data-sa="close">Hủy</button><button class="btn primary" data-sa="save">${ic('check')}Lưu thanh toán</button>`,
    onMount: el => {
      const amt = el.querySelector('#pay-amt'), warn = el.querySelector('#pay-warn');
      const chk = () => { const v = parseMoney(amt.value); warn.hidden = !(v > due); warn.textContent = v > due ? `Số tiền lớn hơn phần còn phải thu ${moneyD(due)}. Phần dư ${moneyD(v - due)} sẽ hiện là “khách trả thừa”.` : ''; };
      amt.addEventListener('input', chk); chk();
      setTimeout(() => softFocus(amt), 60);
    },
    onClick: async (a, b, el) => {
      const amt = el.querySelector('#pay-amt');
      if (a === 'm') { segPick(b); return; }
      if (a === 'full') { amt.value = money(due); amt.dispatchEvent(new Event('input', { bubbles: true })); return; }
      if (a === 'row') { const r = dueRows.find(x => String(x.n) === b.dataset.n); amt.value = money(r.left); el.querySelector('#pay-note').value = payNote(r); amt.dispatchEvent(new Event('input', { bubbles: true })); return; }
      if (a !== 'save') return;
      const v = parseMoney(amt.value);
      if (v <= 0) { toast('Hãy nhập số tiền lớn hơn 0.', 'bad'); amt.focus(); return; }
      const date = el.querySelector('#pay-date').value || today();
      if (!(await okToEditDate(date))) return;
      const note = el.querySelector('#pay-note').value.trim();
      const method = el.querySelector('#pay-method [aria-pressed=true]').dataset.v;
      const res = Orders.pay(o, { amount: v, date, method, note });
      closeSheet(el); render();
      if (res.kind === 'request') { toast('Đã báo. Chờ kế toán hoặc chủ xác nhận.'); return; }
      const p = res.payment;
      const done = openSheet({
        title: 'Đã ghi nhận thanh toán',
        html: `<div class="big-money" style="color:var(--ok)">${moneyD(v)}</div><p>${esc(headQuote(o).customer.name)} · ${PAY_METHOD[method]} · ngày ${fmtDate(date)}</p><p class="muted">Số phiếu: ${receiptNo(o, p)} · còn phải thu ${moneyD(orderDue(o))}</p>`,
        foot: `<button class="btn" data-sa="close">Xong</button><button class="btn" data-sa="rcpng">${ic('image')}Ảnh phiếu thu</button><button class="btn primary" data-sa="rc">${ic('file')}PDF phiếu thu</button>`,
        onClick: (x, bb, elx) => { if (x === 'rc' || x === 'rcpng') { closeSheet(elx); exportDoc(() => renderReceipt(o, p), x === 'rcpng' ? 'png' : 'pdf'); } },
      });
    },
  });
}
function changeSheet(o) {
  openSheet({
    title: 'Thêm phát sinh',
    html: `<div class="field"><span class="lbl">Loại</span><div class="seg" id="chg-sign"><button data-sa="sign" data-v="1" aria-pressed="true">＋ Tăng</button><button data-sa="sign" data-v="-1" aria-pressed="false">− Giảm</button></div></div>
      <div class="field"><label for="chg-title">Nội dung</label><input class="in" id="chg-title" placeholder="VD: Thêm kệ sách treo tường" autocomplete="off"></div>
      <div class="field"><label for="chg-amt">Số tiền</label>${moneyInput('chg-amt', 0, 'placeholder="0"')}</div>
      <div class="field"><label for="chg-note">Lý do / ghi chú</label><input class="in" id="chg-note" placeholder="VD: Khách yêu cầu thêm khi lắp đặt" autocomplete="off"></div>
      <div class="notice">${ic('info')}<div>Phát sinh được lưu ở trạng thái <b>chờ xác nhận</b>. Tổng giá trị đơn chỉ thay đổi khi bạn bấm “Xác nhận”.</div></div>`,
    foot: `<button class="btn" data-sa="close">Hủy</button><button class="btn primary" data-sa="save">Lưu phát sinh</button>`,
    onMount: el => setTimeout(() => softFocus(el.querySelector('#chg-title')), 60),
    onClick: (a, b, el) => {
      if (a === 'sign') { $$('#chg-sign button', el).forEach(x => x.setAttribute('aria-pressed', x === b)); return; }
      if (a !== 'save') return;
      const title = el.querySelector('#chg-title').value.trim(), amount = parseMoney(el.querySelector('#chg-amt').value);
      if (!title) { toast('Hãy nhập nội dung phát sinh.', 'bad'); return; }
      if (amount <= 0) { toast('Hãy nhập số tiền lớn hơn 0.', 'bad'); return; }
      const sign = +el.querySelector('#chg-sign [aria-pressed=true]').dataset.v;
      o.changes.push({ id: uid('g'), sign, title, amount, note: el.querySelector('#chg-note').value.trim(), status: 'pending', createdAt: new Date().toISOString() });
      addLog(o, `Thêm phát sinh ${sign < 0 ? 'giảm' : 'tăng'} “${title}” ${moneyD(amount)} (chờ xác nhận)`);
      touchOrder(o, 0); closeSheet(el); render(); toast('Đã lưu phát sinh, chờ xác nhận');
    },
  });
}
function confirmChangeSheet(o, c) {
  openSheet({
    title: 'Xác nhận phát sinh', cls: 'wide',
    html: `<p><b>${esc(c.title)}</b>${c.note ? ` <span class="muted">· ${esc(c.note)}</span>` : ''}</p><div class="big-money" style="color:${c.sign < 0 ? 'var(--bad)' : 'var(--ok)'}">${c.sign < 0 ? '−' : '+'}${moneyD(c.amount)}</div>
      <div class="calcline">Tổng đơn: ${moneyD(orderTotal(o))} → <b>${moneyD(orderTotal(o) + changeSigned(c))}</b></div>
      <div class="field"><label for="cf-date">Ngày xác nhận</label>${dateField('cf-date', today())}</div>
      <div class="field"><span class="lbl">Bằng chứng khách đồng ý (nên có một trong hai)</span>${sigPadHtml('cf-sig')}</div>
      <div class="field"><label for="cf-signer">Người ký</label><input class="in" id="cf-signer" value="${esc(headQuote(o).customer.name)}" autocomplete="off"></div>
      <div class="field"><span class="lbl">Hoặc ảnh chụp tin nhắn Zalo khách đồng ý</span><label class="btn" for="cf-proof">${ic('camera')}<span id="cf-proof-name">Chọn ảnh</span></label><input type="file" id="cf-proof" accept="image/*" hidden></div>
      <p class="err" id="cf-warn" hidden>Chưa có chữ ký hay ảnh xác nhận. Nếu sau này khách không đồng ý, bạn sẽ khó chứng minh.</p>`,
    foot: `<button class="btn" data-sa="close">Để sau</button><button class="btn primary" data-sa="ok">${ic('check')}Xác nhận</button>`,
    onMount: el => {
      el._sig = mountSigPad(el.querySelector('#cf-sig'));
      el.querySelector('#cf-proof').addEventListener('change', e => { const f = e.target.files[0]; el._proof = f || null; el.querySelector('#cf-proof-name').textContent = f ? f.name : 'Chọn ảnh'; });
    },
    onClick: async (a, b, el) => {
      if (a !== 'ok') return;
      const hasSig = !el._sig.isEmpty(), proof = el._proof;
      const warn = el.querySelector('#cf-warn');
      if (!hasSig && !proof && warn.hidden) { warn.hidden = false; b.innerHTML = `${ic('check')}Vẫn xác nhận`; return; }
      b.disabled = true;
      const date = el.querySelector('#cf-date').value || today();
      if (proof) {
        try { const att = await storeFile(proof, { changeId: c.id, name: 'Xác nhận phát sinh – ' + c.title }, o); o.attachments.push(att); c.proofId = att.id; }
        catch (e) { toast(storeFileError(e, proof.name), 'bad'); b.disabled = false; return; }
      }
      if (hasSig) c.custSign = await makeSignRecord(el._sig.toDataURL(), el.querySelector('#cf-signer').value.trim() || headQuote(o).customer.name, { code: o.code, change: { id: c.id, title: c.title, sign: c.sign, amount: c.amount } });
      c.status = 'confirmed'; c.confirmedAt = date;
      addLog(o, `Xác nhận phát sinh “${c.title}” ${c.sign < 0 ? '−' : '+'}${moneyD(c.amount)}${hasSig ? ' – khách đã ký' : proof ? ' – có ảnh xác nhận' : ' – chưa có xác nhận của khách'}`);
      touchOrder(o, 0); closeSheet(el); render(); toast('Đã cập nhật tổng giá trị đơn');
    },
  });
}
async function addAttachments(o, files) {
  const list = [...files].slice(0, 12);
  let ok = 0;
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    toast(`Đang tải ${i + 1}/${list.length}…`);
    try { o.attachments.push(await storeFile(f, {}, o)); ok++; }
    catch (e) { toast(storeFileError(e, f.name), 'bad'); if (e && e.code === 'not_granted') return; }
  }
  if (ok) { addLog(o, `Thêm ${ok} ảnh/bản vẽ`); touchOrder(o, 0); render(); toast(`Đã thêm ${ok} tệp`); }
}
/* ---------- chữ ký trên iPad ---------- */
function sigPadHtml(id) {
  return `<div class="sigbox"><canvas class="sigpad" id="${id}" aria-label="Khung ký tên"></canvas><span class="sig-hint">Ký vào đây bằng ngón tay hoặc bút</span><button class="btn sm sig-clear" type="button" data-sigclear>Ký lại</button></div>`;
}
function mountSigPad(canvas) {
  const box = canvas.parentElement, hint = box.querySelector('.sig-hint'), ctx = canvas.getContext('2d');
  let drawing = false, last = null, empty = true, bb = null;
  const size = () => {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1F2A55'; ctx.fillStyle = '#1F2A55';
  };
  const clear = () => { size(); empty = true; bb = null; hint.hidden = false; };
  const pt = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: e.pointerType === 'pen' ? 1.2 + (e.pressure || 0.5) * 2.4 : 2.6 }; };
  const grow = p => { bb = bb ? { x0: Math.min(bb.x0, p.x), y0: Math.min(bb.y0, p.y), x1: Math.max(bb.x1, p.x), y1: Math.max(bb.y1, p.y) } : { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; };
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault(); canvas.setPointerCapture?.(e.pointerId);
    drawing = true; last = pt(e); grow(last);
    ctx.beginPath(); ctx.arc(last.x, last.y, last.w / 2, 0, Math.PI * 2); ctx.fill();
    if (empty) { empty = false; hint.hidden = true; }
  });
  canvas.addEventListener('pointermove', e => {
    if (!drawing) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) {
      const p = pt(ev); ctx.lineWidth = (last.w + p.w) / 2;
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last = p; grow(p);
    }
  });
  const end = () => { drawing = false; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end); canvas.addEventListener('pointerleave', end);
  box.querySelector('[data-sigclear]').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); clear(); });
  requestAnimationFrame(clear);
  return {
    isEmpty: () => empty || !bb || (bb.x1 - bb.x0 < 6 && bb.y1 - bb.y0 < 6),
    toDataURL() {
      const dpr = canvas.width / canvas.getBoundingClientRect().width || 1, pad = 8;
      const x0 = Math.max(0, (bb.x0 - pad) * dpr), y0 = Math.max(0, (bb.y0 - pad) * dpr);
      const w = Math.min(canvas.width - x0, (bb.x1 - bb.x0 + pad * 2) * dpr), h = Math.min(canvas.height - y0, (bb.y1 - bb.y0 + pad * 2) * dpr);
      const sc = Math.min(1, 520 / w, 180 / h);
      const out = document.createElement('canvas'); out.width = Math.max(1, Math.round(w * sc)); out.height = Math.max(1, Math.round(h * sc));
      out.getContext('2d').drawImage(canvas, x0, y0, w, h, 0, 0, out.width, out.height);
      return out.toDataURL('image/png');
    },
  };
}
function signVersionSheet(o, v) {
  openSheet({
    title: `Khách ký xác nhận bản ${v.no}`, cls: 'wide',
    html: `<p>${esc(v.quote.customer.name)} · tổng báo giá <b>${moneyD(v.total)}</b> · chốt ngày ${fmtDate(v.closedAt)}</p>
      <div class="field"><span class="lbl">Chữ ký</span>${sigPadHtml('sv-sig')}</div>
      <div class="field"><label for="sv-signer">Người ký</label><input class="in" id="sv-signer" value="${esc(v.quote.customer.name)}" autocomplete="off"></div>
      <p class="muted" style="font-size:14px">Nội dung báo giá không thay đổi. Chữ ký được lưu kèm thời điểm ký và mã xác thực, in lên PDF báo giá.</p>`,
    foot: `<button class="btn" data-sa="close">Hủy</button><button class="btn primary" data-sa="ok">${ic('check')}Lưu chữ ký</button>`,
    onMount: el => { el._sig = mountSigPad(el.querySelector('#sv-sig')); },
    onClick: async (a, b, el) => {
      if (a !== 'ok') return;
      if (el._sig.isEmpty()) { toast('Khách chưa ký vào khung.', 'bad'); return; }
      b.disabled = true;
      v.sign = await makeSignRecord(el._sig.toDataURL(), el.querySelector('#sv-signer').value.trim() || v.quote.customer.name, { code: o.code, no: v.no, quote: v.quote, total: v.total });
      addLog(o, `Khách ${v.sign.name} ký xác nhận bản ${v.no} (mã ${v.sign.hash})`);
      touchOrder(o, 0); closeSheet(el); render(); toast('Đã lưu chữ ký của khách');
    },
  });
}
function handoverSheet(o) {
  const st = settings(), months = Math.max(0, parseInt(st.warrantyMonths, 10) || 0), h = o.handover;
  const html = `<p>${esc(headQuote(o).customer.name)} · tổng giá trị <b>${moneyD(orderTotal(o))}</b> · còn phải thu <b>${moneyD(orderDue(o))}</b></p>
      <div class="fgrid">
        <div class="field"><label for="hv-date">Ngày nghiệm thu, bàn giao</label>${dateField('hv-date', h?.date || today())}</div>
        <div class="field"><label for="hv-months">Bảo hành (tháng)</label><input class="in num" id="hv-months" inputmode="numeric" value="${h?.warrantyMonths ?? months}" autocomplete="off"></div>
      </div>
      <p class="muted" id="hv-until"></p>
      <div class="field"><label for="hv-note">Ghi chú / việc còn tồn (nếu có)</label><textarea class="in" id="hv-note" rows="2" placeholder="VD: Thay tay nắm cánh tủ số 2 trước ngày 30">${esc(h?.note || '')}</textarea></div>
      <div class="field"><span class="lbl">Khách ký biên bản</span>${sigPadHtml('hv-sig')}</div>
      <div class="field"><label for="hv-signer">Người ký</label><input class="in" id="hv-signer" value="${esc(h?.sign?.name || headQuote(o).customer.name)}" autocomplete="off"></div>
      <label class="checkline"><input type="checkbox" id="hv-done" ${o.status !== 'done' ? 'checked' : ''}> Chuyển trạng thái đơn sang “Hoàn thành”</label>`;
  openSheet({
    title: h ? 'Làm lại biên bản nghiệm thu' : 'Nghiệm thu, bàn giao', cls: 'wide', html,
    foot: `<button class="btn" data-sa="close">Hủy</button><button class="btn primary" data-sa="ok">${ic('check')}Lưu và tạo biên bản</button>`,
    onMount: el => {
      el._sig = mountSigPad(el.querySelector('#hv-sig'));
      const upd = () => { const d = el.querySelector('#hv-date').value || today(), m = parseInt(el.querySelector('#hv-months').value, 10) || 0; el.querySelector('#hv-until').textContent = m ? `Bảo hành đến ngày ${fmtDate(addMonths(d, m))}.` : 'Không ghi thời hạn bảo hành.'; };
      el.addEventListener('input', upd); el.addEventListener('change', upd); upd();
    },
    onClick: async (a, b, el) => {
      if (a !== 'ok') return;
      b.disabled = true;
      const date = el.querySelector('#hv-date').value || today(), m = parseInt(el.querySelector('#hv-months').value, 10) || 0;
      const sig = el._sig.isEmpty() ? (h?.sign || null) : await makeSignRecord(el._sig.toDataURL(), el.querySelector('#hv-signer').value.trim() || headQuote(o).customer.name, { code: o.code, handover: date, total: orderTotal(o) });
      o.handover = { date, warrantyMonths: m, warrantyUntil: m ? addMonths(date, m) : date, note: el.querySelector('#hv-note').value.trim(), sign: sig, at: new Date().toISOString() };
      if (el.querySelector('#hv-done').checked && o.status !== 'done') o.status = 'done';
      addLog(o, `Nghiệm thu, bàn giao ngày ${fmtDate(date)}${sig ? ' – khách đã ký' : ''}`);
      touchOrder(o, 0); closeSheet(el); render(); toast('Đã lưu nghiệm thu');
      exportDoc(() => renderHandover(o));
    },
  });
}
function planEditSheet(o) {
  S.planWork = o.plan && o.plan.length ? planCopy(o.plan) : newPlan(); S.planBak = null;
  openSheet({
    title: 'Lịch thanh toán của đơn ' + o.code, cls: 'wide',
    html: `<p class="muted">Tỷ lệ % tính trên báo giá đã chốt <b>${moneyD(lastVersion(o).total)}</b>. Phát sinh đã xác nhận (${signed(confirmedChanges(o))} đ) cộng vào đợt cuối. Số tiền khách đã trả tự trừ dần từ đợt 1. Đổi lịch nên báo trước cho khách.</p><div data-plan-scope="order" id="plan-edit-box">${planEditor(S.planWork, lastVersion(o).total, 'order')}</div>`,
    foot: `<button class="btn" data-sa="close">Hủy</button><button class="btn primary" data-sa="ok">${ic('check')}Lưu lịch</button>`,
    onClick: (a, b, el) => {
      if (a !== 'ok') return;
      if (planOver(S.planWork, lastVersion(o).total)) { toast('Các đợt trước đã chiếm hết giá trị đơn. Hãy giảm bớt.', 'bad'); return; }
      const had = usePlan(o);
      o.plan = mergePlan(o.plan, planCopy(S.planWork));
      if (!o.plan.length) addLog(o, had ? 'Bỏ chia đợt: khách thanh toán một lần' : 'Giữ thanh toán một lần, không chia đợt');
      else addLog(o, 'Cập nhật lịch thanh toán: ' + orderMoney(o).rows.map(r => `đợt ${r.n} ${money(r.amount)}`).join(', '));
      touchOrder(o, 0); closeSheet(el); render(); toast(o.plan.length ? 'Đã lưu lịch thanh toán' : 'Đã chuyển sang thu một lần');
    },
  });
}
function qrSheet(o, r) {
  const q = orderQR(o, r.left, r.one ? 0 : r.n);
  if (!q) {
    openSheet({ title: 'Chưa tạo được mã QR', html: `<p>Hãy chọn ngân hàng và nhập số tài khoản trong Cài đặt trước.</p>`, foot: `<button class="btn" data-sa="close">Đóng</button><button class="btn primary" data-sa="go">Mở Cài đặt</button>`, onClick: (a, b, el) => { if (a === 'go') { closeSheet(el); while (sheets.length) closeSheet(); S.tab = 'settings'; render(); } } });
    return;
  }
  openSheet({
    title: `Mã QR thanh toán ${dotName(r)}`,
    html: `<div class="qrbox"><div id="qr-canvas"></div>
      <div class="big-money">${moneyD(r.left)}</div>
      <p>${esc(r.label || '')}</p>
      <div class="qrinfo"><span>Ngân hàng</span><b>${esc(q.bank)}</b><span>Số tài khoản</span><b>${esc(q.account)}</b>${q.holder ? `<span>Chủ tài khoản</span><b>${esc(q.holder)}</b>` : ''}<span>Nội dung</span><b>${esc(q.memo)}</b></div>
      <p class="muted" style="font-size:14px">Khách mở app ngân hàng, chọn quét mã QR. Số tiền và nội dung được điền sẵn. Sau khi nhận tiền, bấm “Thu” để ghi nhận.</p></div>`,
    foot: `<button class="btn" data-sa="close">Đóng</button><button class="btn" data-sa="png">${ic('image')}Ảnh đề nghị thanh toán</button><button class="btn" data-sa="pdf">${ic('dl')}PDF</button>`,
    onMount: el => { const cv = QR.toCanvas(q.matrix, 720); cv.className = 'qrimg'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Mã VietQR'); el.querySelector('#qr-canvas').appendChild(cv); },
    onClick: a => { if (a === 'pdf' || a === 'png') exportDoc(() => renderPayRequest(o, r), a); },
  });
}
async function exportDoc(build, fmt = 'pdf') {
  if (waitCode(curOrder())) return;
  const png = fmt === 'png';
  try {
    toast(png ? 'Đang tạo ảnh…' : 'Đang tạo PDF…');
    const res = await build();
    if (png) await saveFile(res.filename.replace(/\.pdf$/, '.png'), await makePng(res.pages, res.size));
    else await saveFile(res.filename, makePdf(res.pages, res.title, res.size));
  } catch (e) { toast(png ? 'Không tạo được ảnh. Hãy thử lại.' : 'Không tạo được PDF. Hãy thử lại.', 'bad'); }
}
async function openAttachment(o, a) {
  const src = await attSrc(a);
  const el = openSheet({
    title: a.name, cls: 'wide lightbox',
    html: a.kind === 'image' ? (src ? `<img src="${esc(src)}" alt="${esc(a.name)}">` : `<p class="muted">Không tải được ảnh.</p>`) : `<div class="fileph" style="padding:20px;text-align:center">${ic('file')}<p>${esc(a.name)}</p></div>`,
    foot: `<button class="btn danger" data-sa="del">${ic('trash')}Xóa</button>${src ? `<a class="btn" href="${esc(src)}" target="_blank" rel="noopener">Mở file gốc</a>` : ''}<button class="btn primary" data-sa="close">Đóng</button>`,
    onClick: async (act, b, el) => {
      if (act !== 'del') return;
      const ok = await confirmBox({ title: 'Xóa tệp này?', text: 'Ảnh/bản vẽ sẽ bị xóa khỏi đơn và không khôi phục được.', ok: 'Xóa', danger: true });
      if (!ok) return;
      o.attachments = o.attachments.filter(x => x.id !== a.id); removeAttBlob(a);
      addLog(o, 'Xóa tệp ' + a.name); touchOrder(o, 0); closeSheet(el); render();
    },
  });
}

/* ---------- 5. Thống kê ---------- */
function periodRange() {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth();
  if (S.period === 'month') return monthRange(d);
  if (S.period === 'quarter') { const qs = Math.floor(m / 3) * 3; return [dstr(new Date(y, qs, 1)), dstr(new Date(y, qs + 3, 0))]; }
  if (S.period === 'year') return [`${y}-01-01`, `${y}-12-31`];
  const f = S.from || monthRange(d)[0], t = S.to || today();
  return f <= t ? [f, t] : [t, f];
}
function computeStats(from, to) {
  const inR = s => s && s >= from && s <= to;
  const ev = [], pays = [], closed = [], debt = [];
  for (const o of Store.list('orders')) {
    for (const e of valueEvents(o)) if (inR(e.date)) ev.push({ ...e, o });
    for (const p of o.payments || []) if (inR(p.date)) pays.push({ ...p, o });
    if (isClosed(o) && inR(o.closedAt)) closed.push(o);
    const due = orderDue(o); if (due > 0) debt.push({ o, due });
  }
  ev.sort((a, b) => a.date.localeCompare(b.date)); pays.sort((a, b) => a.date.localeCompare(b.date));
  closed.sort((a, b) => a.closedAt.localeCompare(b.closedAt)); debt.sort((a, b) => b.due - a.due);
  return { ev, pays, closed, debt, value: ev.reduce((s, e) => s + e.amount, 0), paid: pays.reduce((s, p) => s + p.amount, 0), due: debt.reduce((s, d) => s + d.due, 0) };
}
function monthsFor(from, to) {
  let [y, m] = from.split('-').map(Number); const [ty, tm] = to.split('-').map(Number);
  const out = [];
  while (y < ty || (y === ty && m <= tm)) { out.push(`${y}-${pad2(m)}`); m++; if (m > 12) { m = 1; y++; } }
  while (out.length < 6) { let [yy, mm] = out[0].split('-').map(Number); mm--; if (mm < 1) { mm = 12; yy--; } out.unshift(`${yy}-${pad2(mm)}`); }
  return out.slice(-24);
}
function niceMax(v) { if (v <= 0) return 1e6; const p = Math.pow(10, Math.floor(Math.log10(v))); for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= v) return k * p; return 10 * p; }
function drillSheet(kind, opts = {}) {
  const [from, to] = periodRange(), st = computeStats(from, to);
  const name = o => esc(headQuote(o).customer.name);
  let title, rows, total;
  if (kind === 'value') { title = 'Giá trị đơn đã chốt'; total = st.value; rows = st.ev.map(e => [e.o, `${fmtDate(e.date)} · ${esc(e.label)}`, signed(e.amount)]); }
  else if (kind === 'paid' || kind === 'month') {
    let pays = st.pays; title = 'Tiền đã thu';
    if (kind === 'month') {
      pays = []; for (const o of Store.list('orders')) for (const p of o.payments) if (p.date.startsWith(opts.m)) pays.push({ ...p, o });
      pays.sort((a, b) => a.date.localeCompare(b.date)); const [yy, mm] = opts.m.split('-'); title = `Tiền đã thu tháng ${+mm}/${yy}`;
    }
    total = pays.reduce((s, p) => s + p.amount, 0);
    rows = pays.map(p => [p.o, `${fmtDate(p.date)}${p.note ? ' · ' + esc(p.note) : ''}`, money(p.amount)]);
  }
  else if (kind === 'debt') { title = 'Còn phải thu (tính đến ' + fmtDateTime(new Date()) + ')'; total = st.due; rows = st.debt.map(d => [d.o, `Tổng ${money(orderTotal(d.o))} · đã thu ${money(orderPaid(d.o))}`, money(d.due)]); }
  else if (kind === 'profit') { const ps = profitStats(st.closed); title = 'Lãi ước tính theo đơn'; total = ps.profit; rows = ps.list.sort((a, b) => b.p.profit - a.p.profit).map(({ o, p }) => [o, `Doanh thu ${money(p.rev)} · giá nhập ${money(p.goods + p.chgCost)} · vận chuyển ${money(p.ship)}${p.missing ? ` · <b style="color:var(--warn)">${p.missing} dòng thiếu giá nhập</b>` : ''}`, `${money(p.profit)}<br><small class="muted">${p.rev ? pctTxt(p.pct) : ''}</small>`]); }
  else { title = 'Đơn đã chốt trong kỳ'; total = null; rows = st.closed.map(o => [o, `Chốt ${fmtDate(o.closedAt)} · ${STATUS[o.status].label}`, money(orderTotal(o))]); }
  const el = openSheet({
    title, cls: 'wide',
    html: rows.length ? `<div class="pick-list">${rows.map(([o, sub, amt]) => `<button class="pick" data-sa="go" data-id="${o.id}"><div class="pm"><b>${name(o)} <span class="muted" style="font-weight:400">· ${esc(o.code)}</span></b><span>${sub}</span></div><div class="pp">${amt}</div></button>`).join('')}</div>${total != null ? `<div class="sumline"><span>Cộng</span><span class="num">${moneyD(total)}</span></div>` : ''}` : `<div class="empty">Không có dữ liệu trong kỳ này.</div>`,
    onClick: (a, b, el) => { if (a === 'go') { closeSheet(el); S.tab = 'orders'; S.orderId = b.dataset.id; S.view = 'detail'; S.ver = null; render(); } },
  });
}

/* ---------- 4. Danh mục & cài đặt ---------- */
function renderCatalog() {
  const tabs = `<div class="seg" role="group" aria-label="Loại danh mục"><button data-act="cat-tab" data-t="items" aria-pressed="${S.catTab === 'items'}">Hạng mục mẫu</button><button data-act="cat-tab" data-t="customers" aria-pressed="${S.catTab === 'customers'}">Khách hàng</button></div>`;
  const f = fold(S.catQ);
  if (S.catTab === 'items') {
    const all = Store.list('catalog'), G = S.catGroup || '';
    const items = all.filter(c => (!G || catGroup(c) === G) && (!f || fold(c.name + ' ' + c.material).includes(f))).sort((a, b) => (b.new || 0) - (a.new || 0) || GROUPS.indexOf(catGroup(a)) - GROUPS.indexOf(catGroup(b)) || a.name.localeCompare(b.name, 'vi'));
    const gs = GROUPS.filter(g => all.some(c => catGroup(c) === g));
    const noPrice = all.filter(c => c.name && !c.price).length, stale = staleOrders().length;
    let lastG = null;
    const head = c => { const g = catGroup(c); if (c.new || g === lastG) return ''; lastG = g; return `<div class="grp-h">${esc(g)} <small>${all.filter(x => catGroup(x) === g).length}</small></div>`; };
    return `<div class="pane-in"><div class="list-head"><h1>Danh mục</h1>${tabs}</div>
      ${stale ? `<button class="notice warn banner nbtn" data-act="stale-list">${ic('info')}<div><b>${stale} báo giá / đơn đang dùng giá cũ</b> so với danh mục. Chạm để xem và chọn cập nhật.</div></button>` : ''}
      ${noPrice ? `<div class="notice banner">${ic('info')}<div><b>${noPrice} hạng mục chưa có giá.</b> Nhập ở cột Giá bán${canCost() ? ' (và Giá nhập)' : ''}. Hạng mục chưa có giá vẫn chọn được vào báo giá, bạn nhập giá ngay trong báo giá.</div></div>` : ''}
      <section class="card"><div class="card-h"><div class="search" style="margin:0;flex:1;min-width:220px">${ic('search')}<input class="in" id="cat-search" type="search" placeholder="Tìm hạng mục" aria-label="Tìm hạng mục" value="${esc(S.catQ)}" autocomplete="off"></div>
        <div class="addbar" style="margin:0"><button class="btn" data-act="lib-open">${ic('book')}Bộ hạng mục chuẩn</button>${all.length ? `<button class="btn" data-act="bulk-price">${ic('stats')}Đổi giá hàng loạt</button>` : ''}<button class="btn primary" data-act="cat-add">${ic('plus')}Thêm hạng mục</button></div></div>
      ${gs.length > 1 ? `<div class="chips" role="group" aria-label="Nhóm hạng mục"><button class="chip" data-act="cat-group" data-g="" aria-pressed="${!G}">Tất cả<small>${all.length}</small></button>${gs.map(g => `<button class="chip" data-act="cat-group" data-g="${esc(g)}" aria-pressed="${G === g}">${esc(g)}<small>${all.filter(c => catGroup(c) === g).length}</small></button>`).join('')}</div>` : ''}
      <p class="muted" style="font-size:14px;margin-bottom:10px">Sửa trực tiếp trên bảng, tự lưu. Đổi giá ở đây <b>không làm thay đổi</b> các báo giá đã lập.${canCost() ? ' Giá nhập chỉ dùng để tính lãi, không in ra báo giá.' : ''}</p>
      <div class="cat-row cat-head ${canCost() ? 'wcost' : ''}"><div>Tên hạng mục</div><div>Vật liệu / quy cách</div><div>ĐV</div><div style="text-align:right">Giá bán</div>${canCost() ? '<div style="text-align:right">Giá nhập</div>' : ''}<div></div></div>
      ${items.map(c => `${head(c)}<div class="cat-row ${canCost() ? 'wcost' : ''}" data-cat="${c.id}">
        <div class="cn"><input class="in" id="cn-${c.id}" data-cf="name" value="${esc(c.name)}" placeholder="Tên hạng mục" aria-label="Tên hạng mục" autocomplete="off"></div>
        <div class="cm"><input class="in" id="cm-${c.id}" data-cf="material" value="${esc(c.material || '')}" placeholder="Vật liệu / quy cách" aria-label="Vật liệu" autocomplete="off"></div>
        <div class="cu"><select class="in" id="cu-${c.id}" data-cf="unit" aria-label="Đơn vị">${UNITS.map(u => `<option ${u === c.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
        <div class="cp"><input class="in num" id="cp-${c.id}" data-cf="price" data-money inputmode="numeric" value="${c.price ? money(c.price) : ''}" placeholder="Chưa có giá" aria-label="Giá bán" autocomplete="off"></div>
        ${canCost() ? `<div class="cc"><input class="in num" id="cc-${c.id}" data-kc="${c.id}" data-money inputmode="numeric" value="${catCost(c.id) ? money(catCost(c.id)) : ''}" placeholder="Giá nhập" aria-label="Giá nhập" autocomplete="off">${c.price && catCost(c.id) ? `<span class="cmargin">lãi ${pctTxt((c.price - catCost(c.id)) / c.price * 100)}</span>` : ''}</div>` : ''}
        <div class="cx"><button class="iconbtn" data-act="cat-del" data-id="${c.id}" aria-label="Xóa">${ic('trash')}</button></div></div>`).join('') || `<div class="empty"><h3>Chưa có hạng mục mẫu</h3><p>Nạp sẵn ${LIBRARY.length} hạng mục thường gặp của nghề nội thất, rồi nhập giá sau.</p><p style="margin-top:12px"><button class="btn primary" data-act="lib-open">${ic('book')}Bộ hạng mục chuẩn</button></p></div>`}
      </section></div>`;
  }
  const orders = Store.list('orders');
  const cs = Store.list('customers').filter(c => !f || fold(c.name + ' ' + c.phone + ' ' + c.address).includes(f)).sort((a, b) => (b.new || 0) - (a.new || 0) || a.name.localeCompare(b.name, 'vi'));
  return `<div class="pane-in"><div class="list-head"><h1>Danh mục</h1>${tabs}</div>
    <section class="card"><div class="card-h"><div class="search" style="margin:0;flex:1;min-width:220px">${ic('search')}<input class="in" id="cat-search" type="search" placeholder="Tìm khách" aria-label="Tìm khách" value="${esc(S.catQ)}" autocomplete="off"></div><button class="btn primary" data-act="cus-add">${ic('plus')}Thêm khách</button></div>
    <p class="muted" style="font-size:14px;margin-bottom:10px">Khách được tự lưu khi chốt đơn. Chọn lại nhanh bằng nút “Khách cũ” khi lập báo giá.</p>
    ${cs.map(c => `<div class="cus-row" data-cus="${c.id}">
      <div class="cn"><input class="in" id="kn-${c.id}" data-kf="name" value="${esc(c.name)}" placeholder="Tên khách" aria-label="Tên khách" autocomplete="off"></div>
      <div class="cph"><input class="in" id="kp-${c.id}" data-kf="phone" type="tel" value="${esc(c.phone || '')}" placeholder="Số điện thoại" aria-label="Số điện thoại" autocomplete="off"></div>
      <div class="ca"><input class="in" id="ka-${c.id}" data-kf="address" value="${esc(c.address || '')}" placeholder="Địa chỉ" aria-label="Địa chỉ" autocomplete="off"></div>
      <div class="cnt">${orders.filter(o => o.customerId === c.id).length} đơn</div>
      <div class="cx"><button class="iconbtn" data-act="cus-del" data-id="${c.id}" aria-label="Xóa">${ic('trash')}</button></div></div>`).join('') || `<div class="empty">Chưa có khách hàng.</div>`}
    </section></div>`;
}
function qrTestHtml(s = settings()) {
  return bankReady(s) ? `<span class="pill s-done">Đã sẵn sàng</span> <span>Nội dung chuyển khoản mẫu: <b>${esc(qrMemo(`${s.memoPrefix || ''} ${(s.codePrefix || 'BG')}261001 D1`))}</b></span> <button class="btn sm" data-act="qr-test">${ic('qr')}Thử mã QR 10.000 đ</button>` : `<span class="pill s-quote">Chưa đủ</span> <span>Chọn ngân hàng và nhập số tài khoản để app tạo mã VietQR cho từng đợt thanh toán.</span>`;
}
function renderSettings() {
  S.tplWork = clone(planTemplate()).map(r => ({ ...r, id: r.id || uid('d') }));
  const s = settings(), hasDemo = COLS.some(c => Store.list(c).some(d => d.demo));
  const FX = { phone: 'inputmode="tel"', email: 'type="email" inputmode="email" spellcheck="false" autocapitalize="off"', bankAccount: 'inputmode="numeric" spellcheck="false"', bankHolder: 'spellcheck="false" autocapitalize="characters"', memoPrefix: 'spellcheck="false" autocapitalize="characters"', codePrefix: 'spellcheck="false" autocapitalize="characters"' };
  const f = (k, label, ph = '', type = 'text') => `<div class="field"><label for="st-${k}">${label}</label><input class="in" id="st-${k}" data-sf="${k}" ${FX[k] && FX[k].includes('type=') ? '' : `type="${type}"`} ${FX[k] || ''} value="${esc(s[k] || '')}" placeholder="${esc(ph)}" autocomplete="off"></div>`;
  if (Team.on() && !can('settings')) return `<div class="pane-in"><div class="list-head"><h1>Tài khoản</h1><span data-savestat class="savestat"></span></div>${teamCardHtml()}</div>`;
  const bankTxt = bankReady(s) ? `Sẵn sàng · ${esc(s.bankName || bankName(s.bankBin))} · ${esc(String(s.bankAccount).slice(-4).padStart(String(s.bankAccount).length > 4 ? 6 : 4, '•'))}` : '<span class="warnt">Chưa nhập tài khoản</span>';
  const lastB = meta().lastBackupAt;
  return `<div class="pane-in"><div class="list-head"><h1>Cài đặt</h1><span data-savestat class="savestat"></span></div>
    ${Team.on() ? teamCardHtml() : ''}
    ${appPrefsHtml()}
    ${sect('st-shop', 'Cửa hàng', esc([s.shopName, s.phone].filter(Boolean).join(' · ') || 'Chưa nhập'), `
      <div class="field" style="margin-bottom:14px"><span class="lbl">Logo</span><div class="logo-box"><div class="logo-prev">${s.logo ? `<img src="${esc(s.logo)}" alt="Logo">` : 'Chưa có logo'}</div>
        <label class="btn" for="logo-in">${ic('camera')}Chọn logo</label><input type="file" id="logo-in" accept="image/png,image/jpeg,image/webp" hidden>${s.logo ? `<button class="btn danger" data-act="logo-del">Bỏ logo</button>` : ''}</div>
        <p class="muted" style="font-size:13px">Nên dùng file PNG nền trong suốt. App tự thu nhỏ logo để PDF gọn nhẹ.</p></div>
      <div class="fgrid">${f('shopName', 'Tên cửa hàng')}${f('tagline', 'Dòng giới thiệu ngắn')}${f('phone', 'Điện thoại')}${f('address', 'Địa chỉ')}${f('email', 'Email / website', 'Không bắt buộc')}${f('codePrefix', 'Tiền tố mã báo giá', 'BG')}</div>`, { open: !s.shopName })}
    ${sect('st-bank', 'Chuyển khoản & VietQR', bankTxt, `<div class="stack">
      <div class="fgrid">
        <div class="field"><label for="st-bankBin">Ngân hàng</label><select class="in" id="st-bankBin" data-sf="bankBin"><option value="">Chọn ngân hàng</option>${BANKS.map(([b, n]) => `<option value="${b}" ${b === s.bankBin ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
        ${f('bankAccount', 'Số tài khoản', 'Chỉ gồm chữ số')}${f('bankHolder', 'Chủ tài khoản', 'VD: NGUYEN VAN A')}
        ${f('bankName', 'Tên ngân hàng in trên giấy tờ', 'Để trống sẽ dùng tên ở trên')}${f('memoPrefix', 'Chữ đầu nội dung chuyển khoản', 'HL')}
      </div>
      <div class="qrtest" id="qrtest">${qrTestHtml(s)}</div>
      <p class="muted" style="font-size:13px">Mã QR tạo ngay trong app theo chuẩn VietQR. Hãy chuyển thử 10.000 đ để kiểm tra đúng tài khoản trước khi dùng với khách.</p></div>`, { open: !bankReady(s) })}
    ${feat('plan') ? sect('st-plan', 'Lịch thanh toán mẫu', `<span id="tpl-sum">${s.planAuto === false ? 'Báo giá mới không chia đợt' : esc(planSummary(S.tplWork))}</span>`, `<div data-plan-scope="tpl" id="tpl-card" data-nohead="1">${planEditor(S.tplWork, null, 'tpl', true)}</div>`) : ''}
    ${sect('st-def', 'Mặc định cho báo giá mới', `Bảo hành ${esc(s.warrantyMonths || 36)} tháng`, `<div class="stack">
      <div class="fgrid">${f('warrantyMonths', 'Bảo hành mặc định (tháng)', '36', 'number')}</div>
      <div class="field"><label for="st-defaultNote">Ghi chú mặc định</label><textarea class="in" id="st-defaultNote" data-sf="defaultNote" placeholder="VD: Báo giá có hiệu lực 15 ngày.">${esc(s.defaultNote)}</textarea></div>
      <div class="field"><label for="st-defaultTerms">Điều khoản thanh toán mặc định</label><textarea class="in" id="st-defaultTerms" data-sf="defaultTerms" placeholder="VD: Đặt cọc khi chốt, thanh toán phần còn lại khi bàn giao.">${esc(s.defaultTerms)}</textarea></div></div>`)}
    ${sect('st-data', 'Dữ liệu & sao lưu', `${Store.mode === 'team' ? 'Máy chủ chung' : Store.mode === 'cloud' ? 'Tài khoản Claude' : 'Trên máy này'} · ${lastB ? 'sao lưu ' + fmtDate(dstr(new Date(lastB))) : '<span class="warnt">chưa sao lưu</span>'}`, `<div class="stack">
      <div class="notice ${Store.mode === 'local' ? 'warn' : 'ok'}">${ic('info')}<div>${Store.mode === 'team' ? 'Dữ liệu lưu trên <b>máy chủ chung</b> của xưởng. Mỗi người chỉ thấy phần được phép. Vẫn nên sao lưu mỗi tháng.' : Store.mode === 'cloud' ? 'Dữ liệu lưu trên <b>tài khoản Claude</b> của bạn: mở app trên iPad hay điện thoại đều thấy cùng dữ liệu.' : 'Dữ liệu chỉ lưu <b>trên máy này</b>. Hãy sao lưu mỗi tuần. Muốn chuyển dữ liệu từ bản trong Claude: mở bản đó → Cài đặt → Sao lưu, rồi ở đây bấm “Khôi phục”.'}</div></div>
      <div class="addbar" style="margin-top:0"><button class="btn" data-act="backup">${ic('dl')}Sao lưu (.json)</button><label class="btn" for="restore-in">${ic('save')}Khôi phục từ bản sao lưu</label><input type="file" id="restore-in" accept="application/json,.json" hidden>
      ${hasDemo ? `<button class="btn danger" data-act="clear-demo">${ic('trash')}Xóa dữ liệu mẫu</button>` : Team.on() ? '' : `<button class="btn" data-act="seed-demo">Tạo dữ liệu mẫu</button>`}</div>
      <p class="muted" style="font-size:13px">Bản sao lưu gồm đơn hàng, khách, danh mục, giá nhập và cài đặt; không gồm ảnh đính kèm.</p></div>`, { open: hasDemo })}
    ${Team.on() || !ownSite ? '' : teamCardHtml()}
    ${!ownSite || isStandalone() ? '' : sect('st-ipad', 'Cài lên màn hình chính iPad', 'Mở toàn màn hình, dùng khi mất mạng', `<p>${ownSite ? 'Bấm nút <b>Chia sẻ</b> của Safari (ô vuông có mũi tên) → chọn <b>Thêm vào MH chính</b>. Lần sau chạm biểu tượng Sổ Nội Thất để mở toàn màn hình, dùng được cả khi mất mạng.' : 'Trên iPad, mở Sổ Nội Thất trong app Claude để dữ liệu luôn đồng bộ.'}</p>`)}
    <p class="foot-note">Phím tắt khi dùng bàn phím: <b>⌘K</b> tìm nhanh · <b>⌘N</b> tạo báo giá · <b>⌘1–5</b> chuyển mục · <b>Esc</b> đóng hộp thoại.${ownSite ? '' : ' Làm việc nhóm nhiều người chỉ có ở bản cài lên iPad.'}</p>
  </div>`;
}
async function backupJson() {
  const data = { format: 'so-noi-that', version: 2, exportedAt: new Date().toISOString(), data: {} };
  for (const c of COLS) data.data[c] = Store.list(c);
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const ok = await saveFile(`So-noi-that-sao-luu-${today()}.json`, blob);
  if (ok) { saveMeta({ lastBackupAt: new Date().toISOString() }); render(); }
}
function readBackup(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.format === 'so-noi-that' && raw.data && Array.isArray(raw.data.orders)) return { at: raw.exportedAt, cols: raw.data };
  /* bản sao lưu cũ (trước 20/10/2026): các danh sách nằm ở cấp ngoài cùng */
  if (Array.isArray(raw.orders) && (raw.app === 'so-noi-that' || Array.isArray(raw.app)) && Array.isArray(raw.catalog || []) && Array.isArray(raw.customers || [])) {
    return { at: raw.exportedAt, cols: { orders: raw.orders, customers: raw.customers || [], catalog: raw.catalog || [], app: Array.isArray(raw.app) ? raw.app : [] } };
  }
  return null;
}
async function restoreJson(file) {
  let raw;
  try { raw = JSON.parse(await file.text()); } catch (e) { toast('File không đúng định dạng sao lưu.', 'bad'); return; }
  const b = readBackup(raw);
  if (!b) { toast('File không phải bản sao lưu của Sổ Nội Thất.', 'bad'); return; }
  const when = b.at ? fmtDateTime(new Date(b.at)) : 'không rõ thời gian';
  const ok = await confirmBox({ title: 'Khôi phục dữ liệu?', text: `Toàn bộ dữ liệu hiện tại sẽ được <b>thay bằng</b> bản sao lưu lúc ${esc(when)} (${b.cols.orders.length} đơn, ${(b.cols.customers || []).length} khách). Ảnh đính kèm không nằm trong bản sao lưu.`, ok: 'Khôi phục', danger: true });
  if (!ok) return;
  for (const c of COLS) for (const d of Store.list(c)) Store.del(c, d.id);
  for (const c of COLS) for (const d of (b.cols[c] || [])) if (d && d.id) Store.put(c, c === 'orders' ? normalizeOrder(d) : d, 0);
  S.orderId = null; S.view = 'list'; render(); toast(`Đã khôi phục ${b.cols.orders.length} đơn`);
}
async function setLogo(file) {
  const img = await loadImg(URL.createObjectURL(file));
  if (!img) { toast('Không đọc được ảnh logo.', 'bad'); return; }
  const s = Math.min(1, 600 / img.width, 300 / img.height);
  const cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  let url = cv.toDataURL('image/png');
  if (url.length > 180000) url = cv.toDataURL('image/jpeg', 0.9);
  saveSettings({ logo: url }); render(); toast('Đã cập nhật logo');
}

/* ---------- dữ liệu mẫu ---------- */
function demoData() {
  const T = today(), D = n => addDays(T, -n), iso = n => new Date(Date.now() - n * 864e5).toISOString();
  const cat = [
    ['Tủ áo cánh mở', 'MDF chống ẩm phủ Melamine, bản lề giảm chấn', 'm²', 3200000],
    ['Tủ áo cánh lùa', 'MDF chống ẩm phủ Melamine, ray lùa giảm chấn', 'm²', 3600000],
    ['Giường ngủ 1m8', 'MDF chống ẩm phủ Melamine, có ngăn kéo', 'bộ', 8500000],
    ['Giường ngủ 1m2', 'MDF chống ẩm phủ Melamine', 'bộ', 6200000],
    ['Táp đầu giường', 'MDF chống ẩm, 2 ngăn kéo', 'cái', 1600000],
    ['Bàn trang điểm', 'MDF chống ẩm, kèm gương', 'bộ', 4200000],
    ['Bàn học kèm giá sách', 'MDF chống ẩm phủ Melamine', 'bộ', 3900000],
    ['Vách ốp đầu giường', 'Nan gỗ MDF phủ Melamine', 'm²', 1450000],
    ['Kệ tivi', 'MDF chống ẩm phủ Melamine', 'md', 2300000],
    ['Tủ bếp dưới', 'MDF chống ẩm phủ Acrylic', 'md', 4800000],
    ['Tủ bếp trên', 'MDF chống ẩm phủ Acrylic', 'md', 4200000],
    ['Đèn LED hắt tủ', 'LED dây 12V kèm nguồn', 'md', 180000],
    ['Công lắp đặt & vận chuyển', 'Nội thành Hà Nội', 'gói', 1500000],
  ].map(([name, material, unit, price]) => ({ id: uid('k'), name, material, unit, price, demo: true }));
  const C = n => cat.find(c => c.name === n);
  const R = (n, qty, dims) => { const c = C(n); return newRow({ name: c.name, material: c.material, unit: c.unit, price: c.price, qty: dims ? dimsQty(c.unit, dims) : qty, dims: dims || null }); };
  const Q = (date, name, phone, address, project, rows, disc = 0) => ({ date, customer: { name, phone, address }, project, rows, discount: { type: 'amount', value: disc }, note: 'Báo giá có hiệu lực 15 ngày (dữ liệu mẫu).', terms: 'Đặt cọc khi chốt đơn, thanh toán theo tiến độ thi công (dữ liệu mẫu).', plan: newPlan(DEFAULT_PLAN) });
  const V = (no, q, date) => { const t = quoteTotals(q); return { no, quote: q, sub: t.sub, disc: t.disc, total: t.total, closedAt: date, closedTs: iso(0) }; };
  let pc = 0;
  const P = (amount, date, note, method = 'transfer') => ({ id: uid('p'), amount, date, note, method, createdAt: new Date(Date.parse(date) + (pc++) * 1000).toISOString() });
  const custs = [], orders = [];
  const mk = (q, extra) => {
    const c = { id: uid('c'), name: q.customer.name, phone: q.customer.phone, address: q.customer.address, createdAt: iso(60), demo: true };
    custs.push(c);
    const o = { id: uid('o'), code: '', status: 'quote', createdAt: iso(90), updatedAt: iso(0), draft: null, versions: [], payments: [], changes: [], attachments: [], notes: [], log: [], demo: true, customerId: c.id, ...extra };
    orders.push(o); return o;
  };
  // 1. Đang thi công, 2 lần thu, có phát sinh
  const q1 = Q(D(42), 'Chị Lan (mẫu)', '0900 000 001', 'Hai Bà Trưng, Hà Nội', 'Phòng ngủ master – CC Times City', [R('Tủ áo cánh lùa', 0, { a: 2400, b: 2600, n: 1, u: 'mm' }), R('Giường ngủ 1m8', 1), R('Táp đầu giường', 2), R('Vách ốp đầu giường', 0, { a: 3200, b: 1200, n: 1, u: 'mm' }), R('Đèn LED hắt tủ', 6), R('Công lắp đặt & vận chuyển', 1)], 312000);
  const o1 = mk(q1, { status: 'building', closedAt: D(40), versions: [V(1, q1, D(40))], payments: [P(21000000, D(40), 'Đặt cọc khi chốt đơn'), P(10000000, D(12), 'Đợt 2 – chuyển khoản')],
    changes: [{ id: uid('g'), sign: 1, title: 'Thêm kệ sách treo tường', amount: 2400000, note: '', status: 'confirmed', createdAt: iso(14), confirmedAt: D(10) }, { id: uid('g'), sign: -1, title: 'Bỏ đèn LED hắt tủ', amount: 1080000, note: 'Khách tự lắp', status: 'pending', createdAt: iso(3) }],
    notes: [{ id: uid('n'), text: 'Khách muốn lắp xong trước ngày 30.', at: iso(20) }] });
  o1.log = [{ at: iso(42), text: 'Tạo báo giá' }, { at: iso(40), text: 'Chốt đơn' }, { at: iso(30), text: 'Chuyển sang Đang thi công' }];
  // 2. Đã chốt, có 2 phiên bản
  const q2a = Q(D(11), 'Anh Tuấn (mẫu)', '0900 000 002', 'Nam Từ Liêm, Hà Nội', 'Phòng ngủ con – Vinhomes Smart City', [R('Tủ áo cánh mở', 0, { a: 1600, b: 2400, n: 1, u: 'mm' }), R('Giường ngủ 1m2', 1), R('Bàn học kèm giá sách', 1), R('Công lắp đặt & vận chuyển', 1)]);
  const q2b = clone(q2a); q2b.rows[0] = R('Tủ áo cánh lùa', 0, { a: 1600, b: 2400, n: 1, u: 'mm' }); q2b.date = D(6);
  const o2 = mk(q2a, { status: 'closed', closedAt: D(9), versions: [V(1, q2a, D(9)), V(2, q2b, D(6))], payments: [P(10000000, D(9), 'Đặt cọc khi chốt đơn')], log: [{ at: iso(11), text: 'Tạo báo giá' }, { at: iso(9), text: 'Chốt đơn' }, { at: iso(6), text: 'Chốt bản 2: đổi tủ cánh mở sang cánh lùa' }] });
  // 3. Hoàn thành, khách trả thừa
  const q3 = Q(D(78), 'Anh Hoàng (mẫu)', '0900 000 003', 'Từ Sơn, Bắc Ninh', 'Nhà phố – bếp và phòng khách', [R('Tủ bếp dưới', 3.2), R('Tủ bếp trên', 2.6), R('Kệ tivi', 2.4), R('Công lắp đặt & vận chuyển', 1)], 300000);
  const o3 = mk(q3, { status: 'done', closedAt: D(75), versions: [V(1, q3, D(75))], payments: [P(16500000, D(75), 'Đặt cọc khi chốt đơn'), P(10000000, D(50), 'Đợt 2'), P(6500000, D(30), 'Quyết toán', 'cash')],
    changes: [{ id: uid('g'), sign: -1, title: 'Bớt 0,4 md tủ bếp trên (đo thực tế)', amount: 1680000, note: '', status: 'confirmed', createdAt: iso(29), confirmedAt: D(28) }],
    log: [{ at: iso(78), text: 'Tạo báo giá' }, { at: iso(75), text: 'Chốt đơn' }, { at: iso(28), text: 'Chuyển sang Hoàn thành' }] });
  // 4–5. Đang báo giá
  const q4 = Q(D(1), 'Chị Mai (mẫu)', '0900 000 004', 'Long Biên, Hà Nội', 'Phòng ngủ – nhà riêng', [R('Tủ áo cánh mở', 0, { a: 1800, b: 2400, n: 1, u: 'mm' }), R('Bàn trang điểm', 1), R('Giường ngủ 1m8', 1)]);
  const o4 = mk(q4, {}); o4.draft = q4; o4.log = [{ at: iso(1), text: 'Tạo báo giá' }];
  const q5 = Q(T, 'Anh Đức (mẫu)', '0900 000 005', 'Lê Chân, Hải Phòng', 'Căn hộ – bếp', [R('Tủ bếp dưới', 3), R('Tủ bếp trên', 2.4), R('Kệ tivi', 2)]);
  const o5 = mk(q5, {}); o5.draft = q5; o5.log = [{ at: iso(0), text: 'Tạo báo giá' }];
  // mã đơn theo tháng chốt/lập
  const pre = settings().codePrefix || 'BG', seq = {};
  [...orders].sort((a, b) => (a.closedAt || headQuote(a).date).localeCompare(b.closedAt || headQuote(b).date)).forEach(o => {
    const d = (o.closedAt || headQuote(o).date).split('-'); const stem = `${pre}${d[0].slice(2)}${d[1]}-`; seq[stem] = (seq[stem] || 0) + 1; o.code = stem + 'M' + seq[stem];
  });
  orders.forEach(o => { normalizeOrder(o); if (isClosed(o)) o.plan = mergePlan([], lastVersion(o).quote.plan); });
  o1.plan[1].due = D(5);
  o2.plan[0].due = addDays(T, 3);
  o3.handover = { date: D(28), warrantyMonths: 36, warrantyUntil: addMonths(D(28), 36), note: '', sign: null, at: iso(28) };
  /* giá nhập minh họa cho dữ liệu mẫu (khoảng 65% giá bán), vận chuyển 600.000 đ mỗi đơn đã chốt */
  const costs = cat.map(c => ({ id: 'k_' + c.id, cost: Math.round(c.price * 0.65 / 1000) * 1000, demo: true }));
  for (const o of orders) if (o.status !== 'quote') costs.push({ id: 'o_' + o.id, rows: {}, chg: {}, ship: 600000, demo: true });
  /* sổ thu chi mẫu */
  const L = orders.find(o => o.status === 'building'), Ho = orders.find(o => o.status === 'done');
  const T0 = (n, type, cat, amount, note, oid = '', method = 'transfer') => ({ id: uid('t'), type, cat, amount, note, oid, method, date: D(n), createdAt: iso(n), demo: true });
  const cash = [
    T0(38, 'out', 'Vật tư, ván', 16500000, 'Ván MDF chống ẩm, phụ kiện tủ (mẫu)', L?.id || ''), T0(20, 'out', 'Nhân công, thợ', 6000000, 'Công thợ lắp đặt (mẫu)', L?.id || '', 'cash'),
    T0(19, 'out', 'Vận chuyển', 700000, 'Xe chở đồ (mẫu)', L?.id || '', 'cash'), T0(70, 'out', 'Vật tư, ván', 15800000, 'Vật tư đơn nhà phố (mẫu)', Ho?.id || ''),
    T0(6, 'out', 'Quảng cáo', 2000000, 'Quảng cáo Facebook (mẫu)'), T0(3, 'out', 'Điện, nước, xăng', 850000, 'Điện xưởng (mẫu)', '', 'cash'), T0(15, 'in', 'Bán phế liệu', 400000, 'Ván vụn (mẫu)', '', 'cash'),
  ];
  return { catalog: cat, customers: custs, orders, costs, cash };
}
function seedDemo() {
  const d = demoData();
  for (const c of ['catalog', 'customers', 'orders', 'costs', 'cash']) for (const x of d[c]) Store.put(c, x, 0);
  render(); toast('Đã tạo 5 đơn mẫu để thử');
}
async function clearDemo() {
  const ok = await confirmBox({ title: 'Xóa dữ liệu mẫu?', text: 'Các đơn, khách và hạng mục có nhãn “Mẫu” sẽ bị xóa. Dữ liệu bạn tự nhập vẫn giữ nguyên.', ok: 'Xóa dữ liệu mẫu', danger: true });
  if (!ok) return;
  for (const c of COLS) for (const d of Store.list(c)) if (d.demo) { if (c === 'orders') for (const a of d.attachments || []) removeAttBlob(a); Store.del(c, d.id); }
  if (S.orderId && !Store.get('orders', S.orderId)) S.orderId = null;
  render(); toast('Đã xóa dữ liệu mẫu');
}

function staleNotice(o) {
  if (!can('quote')) return '';
  const n = staleRows(o).length; if (!n) return '';
  return `<div class="notice warn" style="margin-bottom:14px">${ic('info')}<div><b>${n} dòng đang theo giá cũ</b>: giá trong danh mục đã đổi sau khi lập báo giá này. <button class="btn sm" data-act="reprice">Xem và cập nhật giá mới</button></div></div>`;
}

/* ---------- Cài đặt → Tùy chỉnh app ---------- */
const FEATS = [
  ['today', 'Màn Hôm nay', 'Gom việc cần làm: khoản quá hạn, đến hạn, báo giá cần gọi lại. Tắt thì mở app thẳng vào Đơn hàng.', () => true],
  ['cash', 'Sổ thu chi', 'Ghi khoản chi (vật tư, thợ, vận chuyển, quảng cáo…), thu khác; xem thu − chi và lãi thực tế từng đơn.', () => can('cash')],
  ['profit', 'Tính lãi từ giá nhập', 'Nhập giá nhập và vận chuyển để biết lãi dự kiến khi báo giá. Không in ra báo giá.', () => can('cost')],
  ['plan', 'Lịch thanh toán chia đợt', 'Chia tiền theo đợt (cọc, tiến độ, bàn giao), nhắc khi đến hạn. Tắt thì mọi đơn thu một lần, chỉ theo dõi còn phải thu.', () => true],
  ['qrPdf', 'Mã QR trên báo giá', 'In mã VietQR số tiền cần thu lên PDF và ảnh báo giá.', () => true],
];
function appPrefsHtml() {
  let theme = 'auto'; try { theme = localStorage.getItem('snt-theme') || 'auto'; } catch (e) { theme = 'auto'; }
  const fs = FEATS.filter(f => f[3]()), on = fs.filter(f => feat(f[0])).length;
  const tb = (v, l) => `<button data-act="theme" data-v="${v}" aria-pressed="${theme === v}">${l}</button>`;
  return sect('st-app', 'Tùy chỉnh app', `${{ auto: 'Giao diện tự động', light: 'Giao diện sáng', dark: 'Giao diện tối' }[theme] || 'Giao diện tự động'} · bật ${on}/${fs.length} tính năng`, `<div class="stack">
    <div class="field"><span class="lbl">Giao diện (trên máy này)</span><div class="seg" role="group" aria-label="Giao diện">${tb('auto', 'Tự động')}${tb('light', 'Sáng')}${tb('dark', 'Tối')}</div></div>
    <div class="feat-list"><span class="lbl">Tính năng (tắt bớt cho app gọn hơn)</span>
      ${fs.map(([k, t, d]) => `<label class="feat"><span><b>${t}</b><small>${d}</small></span><input type="checkbox" class="switch" data-feat="${k}" ${feat(k) ? 'checked' : ''} aria-label="${esc(t)}"></label>`).join('')}
    </div>
    <div class="fgrid"><div class="field"><label for="st-followDays">Nhắc gọi lại báo giá chưa chốt sau (ngày, 0 = không nhắc)</label><input class="in" id="st-followDays" data-sf="followDays" type="number" min="0" max="60" inputmode="numeric" value="${esc(settings().followDays ?? 3)}"></div></div>
  </div>`);
}
