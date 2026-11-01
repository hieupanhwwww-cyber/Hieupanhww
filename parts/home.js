/* =========================================================
   VỎ APP KIỂU macOS: thanh bên (như Mail), màn Hôm nay,
   màn Doanh thu, tìm nhanh (⌘K), các phần thu gọn được
   ========================================================= */

/* nhớ kết quả tính trong một lần vẽ màn hình (tránh tính lại nhiều lần) */
let RC = null;
const memo = (k, f) => { if (!RC) return f(); if (!(k in RC)) RC[k] = f(); return RC[k]; };
/* giao diện Tự động / Sáng / Tối (lưu riêng trên máy này) */
function applyTheme() {
  let t = null; try { t = localStorage.getItem('snt-theme'); } catch (e) { t = null; }
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  /* màu thanh trạng thái theo đúng giao diện đang dùng */
  let sys = 'light'; try { sys = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { sys = 'light'; }
  const TC = { light: '#F4EFE8', dark: '#17130F' };
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
    const mode = t === 'light' || t === 'dark' ? t : m.media ? (m.media.includes('dark') ? 'dark' : 'light') : sys;
    m.setAttribute('content', TC[mode]);
  }
  return t || 'auto';
}
applyTheme();

/* ---------- phần thu gọn kiểu macOS (tam giác mở/đóng) ---------- */
function sect(key, title, sum, body, { open = false, act = '', cls = '', id = '' } = {}) {
  const isOpen = S.open[key] ?? open;
  return `<details class="card sect ${cls}" data-sect="${key}" ${id ? `id="${id}"` : ''} ${isOpen ? 'open' : ''}>
    <summary><span class="chev" aria-hidden="true">${ic('down')}</span><h3>${title}</h3><span class="sum">${sum || ''}</span>${act ? `<span class="sact">${act}</span>` : ''}</summary>
    <div class="sect-b">${body}</div></details>`;
}
document.addEventListener('toggle', e => { const d = e.target; if (d && d.matches && d.matches('details[data-sect]')) S.open[d.dataset.sect] = d.open; }, true);
function openSect(key) { S.open[key] = true; const d = document.querySelector(`details[data-sect="${key}"]`); if (d) d.open = true; }

/* ---------- bộ lọc đơn ---------- */
const FILTERS = [['all', 'Tất cả', 'orders'], ['collect', 'Cần thu', 'money'], ['quote', 'Đang báo giá', 'edit'], ['closed', 'Đã chốt', 'lock'], ['building', 'Đang thi công', 'ruler'], ['done', 'Hoàn thành', 'check']];
const filterCount = k => Store.list('orders').filter(o => k === 'all' || (k === 'collect' ? dueNowAmount(o) > 0 : o.status === k)).length;

/* ---------- thanh bên ---------- */
function renderRail() {
  const worker = Team.on() && Team.role === 'worker';
  const cur = (tab, extra = true) => S.tab === tab && extra ? 'aria-current="page"' : '';
  const nb = (tab, icon, label, { badge = '', bad = false, attrs = '', curOn = true } = {}) =>
    `<button class="navbtn" data-act="tab" data-tab="${tab}" ${attrs} ${cur(tab, curOn)}>${ic(icon)}<span>${label}</span>${badge !== '' && badge !== 0 ? `<em class="badge ${bad ? 'bad' : ''}">${badge}</em>` : ''}</button>`;
  const setLabel = Team.on() && !can('settings') ? 'Tài khoản' : 'Cài đặt', setIcon = Team.on() && !can('settings') ? 'user' : 'gear';
  const foot = `<div class="rail-foot"><span data-savestat class="savestat"></span></div>`;
  const brand = `<div class="brand"><span class="appicon" aria-hidden="true">${ic('book')}</span><span class="brand-t">Sổ Nội Thất<small>${esc(settings().shopName || 'Nội thất trọn gói')}</small></span></div>`;
  if (worker) return `<nav class="rail" aria-label="Điều hướng">${brand}${nb('jobs', 'orders', 'Việc của tôi')}${nb('settings', 'user', 'Tài khoản')}${foot}</nav>`;
  const todo = todoItems().filter(t => t.pri <= 2).length;
  if (!isWide()) {
    /* iPad dọc, điện thoại: thanh tab dưới đáy */
    return `<nav class="rail" aria-label="Điều hướng">${feat('today') ? nb('today', 'cal', 'Hôm nay', { badge: todo, bad: true }) : ''}${nb('orders', 'orders', 'Đơn hàng')}${nb('stats', 'stats', canCash() ? 'Tài chính' : 'Doanh thu')}${can('catalog') ? nb('catalog', 'book', 'Danh mục') : ''}${nb('settings', setIcon, setLabel)}</nav>`;
  }
  const flt = FILTERS.map(([k, l, i]) => { const n = filterCount(k); return `<button class="navbtn sub" data-act="tab" data-tab="orders" data-f="${k}" ${S.tab === 'orders' && S.filter === k ? 'aria-current="page"' : ''}>${ic(i)}<span>${l}</span>${n ? `<em class="badge ${k === 'collect' ? 'bad' : 'plain'}">${n}</em>` : ''}</button>`; }).join('');
  return `<nav class="rail" aria-label="Điều hướng">${brand}
    <button class="sb-search" data-act="palette">${ic('search')}<span>Tìm nhanh</span><kbd>⌘K</kbd></button>
    ${can('quote') ? `<button class="btn primary sb-new" data-act="new-quote">${ic('plus')}Tạo báo giá</button>` : ''}
    ${feat('today') ? nb('today', 'cal', 'Hôm nay', { badge: todo, bad: true }) : ''}
    <div class="sb-label">Đơn hàng</div>${flt}
    <div class="sb-label">Quản lý</div>
    ${nb('stats', 'stats', 'Doanh thu', { attrs: 'data-fin="rev"', curOn: !S.fin || S.fin === 'rev' || (S.fin === 'cash' && !canCash()) || (S.fin === 'pl' && !canPL()) })}
    ${canCash() ? nb('stats', 'money', 'Thu chi', { attrs: 'data-fin="cash"', curOn: S.fin === 'cash' }) : ''}
    ${canPL() ? nb('stats', 'note', canCash() ? 'Cộng sổ' : 'Lãi theo tháng', { attrs: 'data-fin="pl"', curOn: S.fin === 'pl' }) : ''}
    ${can('catalog') ? nb('catalog', 'book', 'Danh mục', { attrs: 'data-ct="items"', curOn: S.catTab !== 'customers' }) + nb('catalog', 'user', 'Khách hàng', { attrs: 'data-ct="customers"', curOn: S.catTab === 'customers' }) : ''}
    ${nb('settings', setIcon, setLabel)}
    ${foot}</nav>`;
}

/* ---------- việc cần làm (thông minh) ---------- */
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
function todoItems() { return memo('todo', todoItemsRaw); }
function todoItemsRaw() {
  const items = [], T = today(), fd = Number(settings().followDays ?? 3) || 0;
  for (const o of Store.list('orders')) {
    const h = headQuote(o), name = h.customer?.name || 'Khách chưa đặt tên', phone = h.customer?.phone || '';
    if (isClosed(o)) {
      for (const r of planStatus(o)) {
        if (r.left <= 0) continue;
        if (r.state === 'overdue') items.push({ k: 'overdue', pri: 0, o, r, name, phone, title: `${name} · ${dotName(r)} quá hạn ${daysBetween(r.due, T)} ngày`, sub: `Còn ${money(r.left)} đ · hạn ${fmtDate(r.due)}` });
        else if (r.state === 'due') items.push({ k: 'due', pri: 1, o, r, name, phone, title: `${name} · đến lúc thu ${dotName(r)}`, sub: `${money(r.left)} đ · ${r.one ? (r.due ? 'hẹn ' + fmtDate(r.due) : 'đã nghiệm thu, bàn giao') : esc(r.label) + (r.due ? ' · hạn ' + fmtDate(r.due) : '')}` });
        else if (r.due && daysBetween(T, r.due) <= 3) items.push({ k: 'soon', pri: 2, o, r, name, phone, title: `${name} · ${dotName(r)} sắp đến hạn`, sub: `${money(r.left)} đ · hạn ${fmtDate(r.due)}` });
      }
      if (o.status !== 'done' && lastVersion(o) && !lastVersion(o).sign && !o.demo) items.push({ k: 'sign', pri: 3, o, name, title: `${name} · khách chưa ký báo giá`, sub: `Bản ${lastVersion(o).no} · ${money(lastVersion(o).total)} đ` });
    } else if (o.draft) {
      const tot = quoteTotals(o.draft).total, d = daysBetween(String(o.updatedAt || o.createdAt || T).slice(0, 10), T);
      if (fd > 0 && tot > 0 && d >= fd) items.push({ k: 'follow', pri: 2, o, name, phone, title: `Gọi lại ${name}`, sub: `Báo giá ${money(tot)} đ chưa chốt, ${d} ngày chưa cập nhật` });
    }
    if (can('pay')) for (const q of (o.payReqs || []).filter(x => x.status === 'pending')) items.push({ k: 'req', pri: 0, o, name, title: `${q.byName || 'Sale'} báo đã thu ${money(q.amount)} đ`, sub: `${name} · chờ bạn xác nhận` });
  }
  if (Team.on() && Team.conflicts.size) items.push({ k: 'conflict', pri: 2, title: `${Team.conflicts.size} chỗ bị sửa cùng lúc`, sub: 'Mở đơn để chọn giữ bản nào' });
  if (can('quote')) { const n = staleOrders().length; if (n) items.push({ k: 'stale', pri: 3, title: `${n} báo giá / đơn đang dùng giá cũ`, sub: 'Giá trong danh mục đã đổi' }); }
  if (Store.mode === 'local' && Store.backend && Store.backend.persistent === false) items.push({ k: 'storage', pri: 0, title: 'Trình duyệt đang chặn lưu dữ liệu', sub: 'Dữ liệu sẽ mất khi đóng app (chế độ riêng tư?)' });
  const real = Store.list('orders').filter(o => !o.demo).length, last = meta().lastBackupAt;
  const days = last ? Math.floor((Date.now() - new Date(last).getTime()) / 864e5) : null;
  if (real && (Team.on() ? can('backup') && (days === null || days >= 30) : (days === null || days >= 7))) items.push({ k: 'backup', pri: 3, title: days === null ? 'Chưa sao lưu dữ liệu lần nào' : `${days} ngày chưa sao lưu`, sub: Store.mode === 'local' ? 'Dữ liệu đang chỉ nằm trên máy này' : 'Nên giữ một bản dự phòng' });
  if (can('catalog')) { const np = Store.list('catalog').filter(c => c.name && !c.price).length; if (np) items.push({ k: 'noprice', pri: 4, title: `${np} hạng mục chưa có giá`, sub: 'Nhập dần trong Danh mục' }); }
  return items.sort((a, b) => a.pri - b.pri);
}
const TODO_IC = { overdue: 'money', due: 'money', soon: 'cal', req: 'money', follow: 'phone', sign: 'sign', conflict: 'info', stale: 'stats', storage: 'info', backup: 'save', noprice: 'book' };
const TODO_CLS = { overdue: 'bad', req: 'bad', storage: 'bad', due: 'warn', soon: 'warn', follow: 'info' };
function contactBtns(phone) {
  const d = digits(phone); if (d.length < 8) return '';
  return `<a class="iconbtn line" href="tel:${d}" aria-label="Gọi ${esc(phone)}" title="Gọi">${ic('phone')}</a><a class="iconbtn line zalo" href="https://zalo.me/${d}" target="_blank" rel="noopener" aria-label="Nhắn Zalo ${esc(phone)}" title="Nhắn Zalo">Zalo</a>`;
}
function todoRow(t) {
  let acts = '';
  if (t.k === 'overdue' || t.k === 'due' || t.k === 'soon') acts = `${bankReady() ? `<button class="iconbtn line" data-act="todo-qr" data-id="${t.o.id}" data-n="${t.r.n}" aria-label="Mã QR ${dotName(t.r)}">${ic('qr')}</button>` : ''}${contactBtns(t.phone)}<button class="btn sm primary" data-act="todo-pay" data-id="${t.o.id}" data-n="${t.r.n}">Thu</button>`;
  else if (t.k === 'follow') acts = contactBtns(t.phone);
  else if (t.k === 'stale') acts = `<button class="btn sm" data-act="stale-list">Xem</button>`;
  else if (t.k === 'backup') acts = `<button class="btn sm" data-act="backup">Sao lưu</button>`;
  else if (t.k === 'noprice') acts = `<button class="btn sm" data-act="tab" data-tab="catalog" data-ct="items">Nhập giá</button>`;
  const open = t.o ? `data-act="open-order" data-id="${t.o.id}"` : '';
  return `<div class="todo ${TODO_CLS[t.k] || ''}"><button class="todo-m" ${open} ${open ? '' : 'disabled'}><span class="todo-ic">${ic(TODO_IC[t.k] || 'info')}</span><span class="todo-t"><b>${esc(t.title)}</b><small>${t.sub}</small></span></button><div class="todo-a">${acts}</div></div>`;
}
function monthNums() {
  const [a, b] = monthRange(), st = computeStats(a, b);
  let due = 0; for (const o of Store.list('orders')) due += orderDue(o);
  return { st, due, ps: canCost() ? profitStats(st.closed) : null, cash: canCash() ? cashSum(cashList(a, b)) : null, led: canCash() ? ledger([a.slice(0, 7)])[0] : null };
}
function renderToday() {
  const all = Store.list('orders'), todo = todoItems(), d = new Date();
  const wd = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][d.getDay()];
  const head = `<div class="list-head"><div><h1>Hôm nay</h1><p class="d-sub">${wd}, ${fmtDate(today())}</p></div><div class="hd-act">${!isWide() ? `<button class="iconbtn line" data-act="palette" aria-label="Tìm nhanh">${ic('search')}</button>` : ''}${canCash() ? `<button class="btn" data-act="cash-add" data-type="out">${ic('pm')}Ghi chi</button>` : ''}${can('quote') ? `<button class="btn primary" data-act="new-quote">${ic('plus')}Tạo báo giá</button>` : ''}</div></div>`;
  if (!all.length) return `<div class="pane-in">${head}
    <section class="card welcome"><span class="appicon big">${ic('book')}</span><h2>Bắt đầu với Sổ Nội Thất</h2>
      <p class="muted">Lập báo giá ngay tại nhà khách, xuất PDF gửi Zalo, chốt đơn, theo dõi tiền thu từng đợt và doanh thu.</p>
      <div class="addbar" style="justify-content:center">${can('quote') ? `<button class="btn primary" data-act="new-quote">${ic('plus')}Tạo báo giá đầu tiên</button>` : ''}${Team.on() ? '' : `<button class="btn" data-act="seed-demo">Tạo vài đơn mẫu để thử</button>`}${can('catalog') && !Store.list('catalog').length ? `<button class="btn" data-act="lib-open">${ic('book')}Nạp bộ hạng mục chuẩn</button>` : ''}</div></section>
    ${Store.mode === 'local' ? localBanner() : ''}</div>`;
  const m = monthNums(), recent = [...all].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 5);
  const urgent = todo.filter(t => t.pri <= 2), later = todo.filter(t => t.pri > 2);
  return `<div class="pane-in">${head}
    <div class="tiles">
      <button class="tile" data-act="tab" data-tab="stats"><span>Doanh thu tháng này</span><b>${shortMoney(m.st.value)}</b><small>${m.st.closed.length} đơn chốt</small></button>
      <button class="tile" data-act="goto-stats" data-drill="paid"><span>Đã thu tháng này</span><b class="ok">${shortMoney(m.st.paid)}</b><small>${m.st.pays.length} lần thu</small></button>
      <button class="tile" data-act="tab" data-tab="orders" data-f="collect"><span>Còn phải thu</span><b class="${m.due ? 'bad' : ''}">${shortMoney(m.due)}</b><small>${filterCount('collect')} đơn cần thu ngay</small></button>
      ${m.led ? `<button class="tile" data-act="tab" data-tab="stats" data-fin="pl"><span>Lãi tháng này (thu − chi)</span><b class="${m.led.profit < 0 ? 'bad' : 'ok'}">${m.led.profit < 0 ? '−' : ''}${shortMoney(Math.abs(m.led.profit))}</b><small>${m.led.pct == null ? 'chưa có thu' : 'tỷ suất ' + pctTxt(m.led.pct)} · tồn quỹ ${shortMoney(m.led.close)}</small></button>` : m.ps ? `<button class="tile" data-act="goto-stats" data-drill="profit"><span>Lãi ước tính tháng</span><b class="${m.ps.profit < 0 ? 'bad' : 'ok'}">${shortMoney(m.ps.profit)}</b><small>${m.ps.rev ? pctTxt(m.ps.pct) + ' doanh thu' : 'chưa có đơn chốt'}</small></button>` : `<button class="tile" data-act="tab" data-tab="orders" data-f="building"><span>Đang thi công</span><b>${filterCount('building')}</b><small>đơn</small></button>`}
    </div>
    <section class="card"><div class="card-h"><h3>Việc cần làm</h3><span class="muted">${urgent.length ? urgent.length + ' việc gấp' : 'Không có việc gấp'}</span></div>
      ${urgent.length ? `<div class="todos">${urgent.map(todoRow).join('')}</div>` : `<p class="muted">Không có khoản quá hạn hay báo giá cần gọi lại.</p>`}
      ${later.length ? `<div class="todos later">${later.map(todoRow).join('')}</div>` : ''}
    </section>
    <section class="card"><div class="card-h"><h3>Mở gần đây</h3><button class="btn sm" data-act="tab" data-tab="orders" data-f="all">Xem tất cả</button></div>
      <div class="cards" id="cards">${recent.map(orderCard).join('')}</div></section>
    ${all.some(o => o.demo) ? `<div class="notice">${ic('info')}<div>Đang có <b>đơn mẫu</b> để thử. Xóa trong Cài đặt → Dữ liệu khi dùng thật.</div></div>` : ''}
    ${Store.mode === 'local' ? localBanner() : ''}
  </div>`;
}

/* ---------- danh sách đơn gọn kiểu Mail ---------- */
function orderCard(o) {
  const h = headQuote(o), st = STATUS[o.status];
  const total = orderTotal(o), due = orderDue(o), over = orderOver(o);
  const nx = isClosed(o) ? nextInstallment(o) : null;
  const right = isClosed(o) ? (over ? `<span class="info">thừa ${money(over)}</span>` : due ? `<span class="due">còn ${money(due)}</span>` : `<span class="zero">đã thu đủ</span>`) : `<span>${(o.draft?.rows || []).length} hạng mục</span>`;
  const line3 = o.draft && isClosed(o) ? `<span class="oc-note warn">Đang sửa bản ${o.versions.length + 1}</span>` : nx && nx.state !== 'later' ? `<span class="oc-note ${nx.state === 'overdue' ? 'bad' : 'warn'}">${dotLabel(nx)} ${PLAN_STATE[nx.state].label.toLowerCase()}: ${money(nx.left)}${nx.due ? ' · hạn ' + fmtDate(nx.due) : ''}</span>` : '';
  return `<button class="ocard" data-act="open-order" data-id="${o.id}" ${S.orderId === o.id ? 'aria-current="true"' : ''}>
    <span class="oc-dot ${st.cls}" title="${st.label}"></span>
    <span class="oc-body">
      <span class="oc-l1"><b class="oc-name">${esc(h.customer?.name || 'Khách chưa đặt tên')}</b><b class="oc-amt">${money(total)}</b></span>
      <span class="oc-l2"><span class="oc-code">${o.demo ? '<span class="tag">Mẫu</span> ' : ''}${esc(o.code)} · ${esc(h.project || h.customer?.address || st.label)}</span>${right}</span>
      ${line3}
    </span></button>`;
}
function renderList() {
  const title = (FILTERS.find(f => f[0] === S.filter) || FILTERS[0])[1];
  const n = filteredOrders().length;
  const chips = FILTERS.map(([k, l]) => `<button class="chip" data-act="filter" data-f="${k}" aria-pressed="${S.filter === k}">${l}<small>${filterCount(k)}</small></button>`).join('');
  return `<div class="pane-in">
    <div class="list-head"><div><h1>${S.filter === 'all' ? 'Đơn hàng' : title}</h1><p class="d-sub">${n} đơn</p></div><div class="hd-act">${!isWide() ? `<button class="iconbtn line" data-act="palette" aria-label="Tìm nhanh">${ic('search')}</button>` : ''}${can('quote') ? `<button class="btn primary ${isWide() ? 'icon-only' : ''}" data-act="new-quote" aria-label="Tạo báo giá">${ic('plus')}<span>Tạo báo giá</span></button>` : ''}</div></div>
    <div class="search">${ic('search')}<input class="in" id="order-search" type="search" placeholder="Tìm khách, công trình, SĐT, mã" aria-label="Tìm đơn hàng" value="${esc(S.q)}" autocomplete="off"></div>
    ${isWide() ? '' : `<div class="chips" role="group" aria-label="Lọc đơn">${chips}</div>`}
    <div class="cards" id="cards">${renderCards()}</div>
  </div>`;
}

/* =========================================================
   DOANH THU
   ========================================================= */
function prevRange(from, to) { const n = daysBetween(from, to) + 1; return [addDays(from, -n), addDays(from, -1)]; }
function verGroups(v) {
  const m = new Map(); let sub = 0;
  for (const r of v.quote?.rows || []) { const a = rowAmount(r); if (!a) continue; const k = rowCat(r); const g = k ? catGroup(k) : guessGroup(r.name); m.set(g, (m.get(g) || 0) + a); sub += a; }
  const f = sub ? v.total / sub : 0; for (const [g, a] of m) m.set(g, a * f);
  return m;
}
/* chia doanh thu trong kỳ theo nhóm hạng mục, khớp đúng tổng doanh thu */
function revenueBreakdown(from, to) {
  const inR = s => s && s >= from && s <= to;
  const groups = new Map(), cust = new Map(), orders = new Map();
  const add = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
  for (const o of Store.list('orders')) {
    if (!isClosed(o)) continue;
    const name = (headQuote(o).customer?.name || 'Khách chưa đặt tên').trim();
    let ov = 0;
    o.versions.forEach((v, i) => {
      if (!inR(v.closedAt)) return;
      const cur = verGroups(v), prev = i ? verGroups(o.versions[i - 1]) : new Map();
      for (const g of new Set([...cur.keys(), ...prev.keys()])) add(groups, g, (cur.get(g) || 0) - (prev.get(g) || 0));
      ov += v.total - (i ? o.versions[i - 1].total : 0);
    });
    for (const c of (o.changes || []).filter(x => x.status === 'confirmed' && inR(x.confirmedAt))) { add(groups, 'Phát sinh', changeSigned(c)); ov += changeSigned(c); }
    let paid = 0; for (const p of o.payments || []) if (inR(p.date)) paid += p.amount;
    if (ov || paid) {
      const c = cust.get(name) || { name, rev: 0, paid: 0, n: 0, phone: headQuote(o).customer?.phone || '' };
      c.rev += ov; c.paid += paid; if (ov) c.n++; cust.set(name, c);
      orders.set(o.id, { o, rev: ov, paid });
    }
  }
  /* làm tròn, dồn phần lẻ vào nhóm lớn nhất để tổng khớp */
  const gl = [...groups.entries()].map(([g, v]) => ({ g, v: Math.round(v) })).filter(x => x.v);
  const want = [...orders.values()].reduce((s, x) => s + x.rev, 0), got = gl.reduce((s, x) => s + x.v, 0);
  if (gl.length && want !== got) { gl.sort((a, b) => Math.abs(b.v) - Math.abs(a.v)); gl[0].v += want - got; }
  return { groups: gl.sort((a, b) => b.v - a.v), customers: [...cust.values()].sort((a, b) => b.rev - a.rev || b.paid - a.paid), orders: [...orders.values()].sort((a, b) => b.rev - a.rev) };
}
function monthsSeries(from, to) {
  const months = monthsFor(from, to), rev = Object.fromEntries(months.map(m => [m, 0])), cash = { ...rev };
  for (const o of Store.list('orders')) {
    for (const e of valueEvents(o)) { const k = String(e.date).slice(0, 7); if (k in rev) rev[k] += e.amount; }
    for (const p of o.payments || []) { const k = p.date.slice(0, 7); if (k in cash) cash[k] += p.amount; }
  }
  return { months, rev, cash };
}
function revenueChart(from, to) {
  const { months, rev, cash } = monthsSeries(from, to);
  const W = 720, H = 260, L = 56, Rr = 12, T = 18, B = 34, cw = W - L - Rr, ch = H - T - B;
  const max = niceMax(Math.max(...Object.values(rev), ...Object.values(cash)));
  const fromM = from.slice(0, 7), toM = to.slice(0, 7), bw = cw / months.length, barW = Math.min(22, bw * 0.32);
  let g = '';
  for (let i = 0; i <= 4; i++) { const yv = T + ch - ch * i / 4; g += `<line class="grid" x1="${L}" x2="${W - Rr}" y1="${yv}" y2="${yv}"/><text x="${L - 8}" y="${yv + 4}" text-anchor="end">${i ? shortMoney(max * i / 4) : '0'}</text>`; }
  months.forEach((m, i) => {
    const out = m < fromM || m > toM, x0 = L + bw * i + bw / 2;
    const bar = (v, x, cls) => { const h = Math.max(0, v) / max * ch; return `<rect class="bar ${cls} ${out ? 'out' : ''}" x="${x}" y="${T + ch - h}" width="${barW}" height="${Math.max(h, v ? 2 : 0)}" rx="3"/>`; };
    g += bar(rev[m], x0 - barW - 1, 'rev') + bar(cash[m], x0 + 1, 'cash');
    if (rev[m] && !out) g += `<text class="val" x="${x0 - barW / 2}" y="${T + ch - Math.max(0, rev[m]) / max * ch - 5}" text-anchor="middle">${shortMoney(rev[m])}</text>`;
    const [yy, mm] = m.split('-');
    if (months.length <= 12 || i % 2 === 0) g += `<text x="${x0}" y="${H - 12}" text-anchor="middle">T${+mm}/${yy.slice(2)}</text>`;
    g += `<rect class="bar-hit" data-act="bar" data-m="${m}" x="${L + bw * i}" y="${T}" width="${bw}" height="${ch + 20}"><title>Tháng ${+mm}/${yy}: doanh thu ${moneyD(rev[m])}, đã thu ${moneyD(cash[m])}</title></rect>`;
  });
  return `<div class="legend"><span><i class="lg rev"></i>Doanh thu (đơn chốt)</span><span><i class="lg cash"></i>Tiền đã thu</span></div><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Doanh thu và tiền đã thu theo tháng">${g}</svg>`;
}
function hbars(rows, total) {
  const max = Math.max(1, ...rows.map(r => Math.abs(r.v)));
  return `<div class="hbars">${rows.map(r => `<div class="hb ${r.act ? 'clk' : ''}" ${r.act || ''}><div class="hb-t"><span>${r.label}</span><b class="${r.v < 0 ? 'negt' : ''}">${money(r.v)}</b></div><div class="hb-bar"><i style="width:${Math.max(1, Math.abs(r.v) / max * 100).toFixed(1)}%"></i></div><small>${total ? pctTxt(r.v / total * 100) : ''}${r.extra ? ' · ' + r.extra : ''}</small></div>`).join('')}</div>`;
}
function renderStats() {
  const [from, to] = periodRange(), st = computeStats(from, to), now = new Date();
  const [pf, pt] = prevRange(from, to), prev = computeStats(pf, pt);
  const bd = revenueBreakdown(from, to), ps = canCost() ? profitStats(st.closed) : null;
  const delta = prev.value ? (st.value - prev.value) / Math.abs(prev.value) * 100 : null;
  const avg = st.closed.length ? Math.round(st.closed.reduce((s, o) => s + orderTotal(o), 0) / st.closed.length) : 0;
  const pb = (k, l) => `<button data-act="period" data-p="${k}" aria-pressed="${S.period === k}">${l}</button>`;
  const view = S.revBy || 'group';
  let bdHtml;
  if (view === 'group') bdHtml = bd.groups.length ? hbars(bd.groups.map(x => ({ label: esc(x.g), v: x.v })), st.value) : `<p class="muted">Chưa có doanh thu trong kỳ.</p>`;
  else if (view === 'cust') bdHtml = bd.customers.length ? hbars(bd.customers.slice(0, 30).map(c => ({ label: esc(c.name), v: c.rev, extra: `đã thu trong kỳ ${money(c.paid)}${c.n ? ` · ${c.n} đơn` : ''}`, act: `data-act="rev-cust" data-name="${esc(c.name)}"` })), st.value) : `<p class="muted">Chưa có khách nào trong kỳ.</p>`;
  else bdHtml = bd.orders.length ? hbars(bd.orders.slice(0, 50).map(x => ({ label: `${esc(headQuote(x.o).customer?.name || x.o.code)} <span class="muted">· ${esc(x.o.code)}</span>`, v: x.rev, extra: `đã thu ${money(x.paid)}`, act: `data-act="open-order" data-id="${x.o.id}"` })), st.value) : `<p class="muted">Chưa có đơn nào trong kỳ.</p>`;
  return `<div class="pane-in">
    <div class="list-head"><h1>Doanh thu</h1><div class="hd-act"><div class="seg" role="group" aria-label="Kỳ">${pb('month', 'Tháng')}${pb('quarter', 'Quý')}${pb('year', 'Năm')}${pb('custom', 'Tùy chọn')}</div><button class="btn sm" data-act="rev-csv">${ic('dl')}Xuất Excel</button></div></div>
    ${finBar('rev')}
    ${S.period === 'custom' ? `<div class="fgrid" style="max-width:560px;margin-bottom:10px"><div class="field"><label for="st-from">Từ ngày</label>${dateField('st-from', from)}</div><div class="field"><label for="st-to">Đến ngày</label>${dateField('st-to', to)}</div></div>` : ''}
    <div class="kpis">
      <button class="kpi hero" data-act="drill" data-d="value"><span>Tổng doanh thu · ${fmtDate(from)} – ${fmtDate(to)}</span><b>${money(st.value)} đ</b>
        <small>${delta == null ? 'Kỳ trước chưa có doanh thu' : `<span class="${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${pctTxt(Math.abs(delta))}</span> so với kỳ trước (${money(prev.value)})`}</small><span class="go">${st.ev.length} khoản ›</span></button>
      <button class="kpi" data-act="drill" data-d="paid"><span>Tiền đã thu</span><b class="ok">${money(st.paid)}</b><small>${st.pays.length} lần thu trong kỳ</small></button>
      <button class="kpi" data-act="drill" data-d="debt"><span>Còn phải thu</span><b class="${st.due ? 'bad' : ''}">${money(st.due)}</b><small>Đến ${fmtDateTime(now)}</small></button>
      <button class="kpi" data-act="drill" data-d="count"><span>Đơn chốt</span><b>${st.closed.length}</b><small>${avg ? 'TB ' + shortMoney(avg) + '/đơn' : 'trong kỳ'}</small></button>
      ${ps ? `<button class="kpi kpi-profit ${ps.profit < 0 ? 'neg' : ''}" data-act="drill" data-d="profit"><span>Lãi ước tính</span><b>${money(ps.profit)}</b><small>${ps.rev ? pctTxt(ps.pct) + ' doanh thu' : 'Đơn chốt trong kỳ'}${ps.missing ? ` · ${ps.missing} đơn thiếu giá nhập` : ''}</small></button>` : ''}
    </div>
    <section class="card"><div class="card-h"><h3>Theo tháng</h3><span class="muted" style="font-size:13px">Chạm cột để xem tiền thu trong tháng</span></div>${revenueChart(from, to)}</section>
    <section class="card"><div class="card-h"><h3>Doanh thu chia theo</h3><div class="seg" role="group" aria-label="Chia theo"><button data-act="rev-by" data-v="group" aria-pressed="${view === 'group'}">Nhóm hạng mục</button><button data-act="rev-by" data-v="cust" aria-pressed="${view === 'cust'}">Khách hàng</button><button data-act="rev-by" data-v="order" aria-pressed="${view === 'order'}">Đơn</button></div></div>${bdHtml}</section>
    ${sect('debt', 'Đơn còn công nợ', `${st.debt.length} đơn · ${money(st.due)} đ`, st.debt.length ? `<div class="scrollx"><table class="lockq debt"><thead><tr><th>Khách / công trình</th><th class="r">Tổng</th><th class="r">Đã thu</th><th class="r">Quá hạn</th><th class="r">Còn phải thu</th></tr></thead><tbody>
      ${st.debt.map(({ o, due }) => { const h = headQuote(o); return `<tr data-act="open-order" data-id="${o.id}" style="cursor:pointer"><td><button class="linkbtn rowlink" data-act="open-order" data-id="${o.id}">${esc(h.customer.name)}</button><span class="sub">${esc(h.project || o.code)}</span></td><td class="r">${money(orderTotal(o))}</td><td class="r">${money(orderPaid(o))}</td><td class="r">${overdueAmount(o) ? `<span class="pill s-bad">${money(overdueAmount(o))}</span>` : '–'}</td><td class="r"><b style="color:var(--bad)">${money(due)}</b></td></tr>`; }).join('')}
      </tbody></table></div>` : `<p class="muted">Không có đơn nào còn nợ.</p>`, { open: false })}
    <p class="foot-note"><b>Doanh thu</b> = giá trị đơn chốt trong kỳ (theo ngày chốt), cộng phần chênh khi chốt bản điều chỉnh và phát sinh đã xác nhận (theo ngày xác nhận). <b>Tiền đã thu</b> tính theo ngày khách trả. Báo giá chưa chốt không được tính.${ps ? ' Lãi ước tính = doanh thu đơn chốt trong kỳ − giá nhập − vận chuyển, chưa trừ nhân công và chi phí chung.' : ''}</p>
  </div>`;
}
const csvCell = v => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
async function revenueCsv() {
  const [from, to] = periodRange(), st = computeStats(from, to);
  const rows = [['Ngày', 'Loại', 'Mã đơn', 'Khách hàng', 'Số điện thoại', 'Công trình', 'Doanh thu (đ)', 'Tiền thu (đ)', 'Ghi chú']];
  const evs = [...st.ev.map(e => ({ d: e.date, t: e.kind === 'close' ? 'Chốt đơn' : e.kind === 'revise' ? 'Chốt bản điều chỉnh' : 'Phát sinh', o: e.o, rev: e.amount, cash: '', note: e.label })),
    ...st.pays.map(p => ({ d: p.date, t: 'Thu tiền', o: p.o, rev: '', cash: p.amount, note: [PAY_METHOD[p.method], receiptNo(p.o, p), p.note].filter(Boolean).join(' · ') }))].sort((a, b) => a.d.localeCompare(b.d));
  for (const e of evs) { const h = headQuote(e.o); rows.push([fmtDate(e.d), e.t, e.o.code, h.customer?.name || '', h.customer?.phone || '', h.project || '', e.rev, e.cash, e.note]); }
  rows.push([]); rows.push(['', 'TỔNG', '', '', '', '', st.value, st.paid, `Kỳ ${fmtDate(from)} – ${fmtDate(to)}`]);
  const bd = revenueBreakdown(from, to);
  if (bd.groups.length) { rows.push([]); rows.push(['Theo nhóm hạng mục', '', '', '', '', '', 'Doanh thu (đ)']); for (const g of bd.groups) rows.push([g.g, '', '', '', '', '', g.v]); }
  const csv = '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  await saveFile(`Doanh-thu-${from}-den-${to}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}

/* =========================================================
   TÌM NHANH (⌘K) – đơn, khách, hạng mục, thao tác
   ========================================================= */
function paletteActions() {
  const A = [];
  const a = (label, icon, run, kw = '') => A.push({ label, icon, run, kw });
  if (can('quote')) a('Tạo báo giá mới', 'plus', () => newQuoteAction(), 'tao moi bao gia');
  a('Hôm nay – việc cần làm', 'cal', () => { S.tab = 'today'; render(); });
  a('Đơn cần thu tiền', 'money', () => { S.tab = 'orders'; S.filter = 'collect'; S.orderId = isWide() ? S.orderId : null; render(); }, 'cong no no');
  a('Doanh thu tháng này', 'stats', () => { S.tab = 'stats'; S.fin = 'rev'; S.period = 'month'; render(); }, 'thong ke');
  if (canCash()) { a('Ghi khoản chi', 'pm', () => cashSheet('out'), 'chi tien mua vat tu tra tho'); a('Ghi khoản thu khác', 'plus', () => cashSheet('in'), 'thu'); a('Sổ thu chi', 'money', () => { S.tab = 'stats'; S.fin = 'cash'; render(); }, 'thu chi quy'); }
  if (canPL()) a(canCash() ? 'Cộng sổ – lãi theo tháng' : 'Lãi theo tháng', 'note', () => { S.tab = 'stats'; S.fin = 'pl'; render(); }, 'cong so lai thang ty suat chot so ton quy');
  a('Xuất Excel doanh thu kỳ đang xem', 'dl', () => revenueCsv(), 'csv excel');
  if (can('catalog')) { a('Danh mục hạng mục', 'book', () => { S.tab = 'catalog'; S.catTab = 'items'; render(); }); a('Đổi giá hàng loạt', 'stats', () => { S.tab = 'catalog'; S.catTab = 'items'; render(); bulkPriceSheet(); }, 'tang giam gia vat lieu'); a('Bộ hạng mục chuẩn', 'book', () => librarySheet(), 'nap'); }
  if (can('quote') && staleOrders().length) a('Báo giá đang dùng giá cũ', 'stats', () => staleListSheet());
  a('Khách hàng', 'user', () => { S.tab = 'catalog'; S.catTab = 'customers'; render(); });
  if (!Team.on() || can('backup')) a('Sao lưu dữ liệu', 'save', () => backupJson(), 'backup');
  a('Cài đặt', 'gear', () => { S.tab = 'settings'; render(); }, 'vietqr ngan hang logo');
  return A;
}
function paletteResults(q) {
  const f = fold(q.trim()), dq = digits(q), out = [];
  const acts = paletteActions().filter(x => !f || fold(x.label + ' ' + x.kw).includes(f));
  if (!f) {
    for (const t of todoItems().filter(t => t.o && t.pri <= 2).slice(0, 4)) out.push({ sec: 'Việc cần làm', icon: TODO_IC[t.k], label: t.title, sub: t.sub.replace(/<[^>]+>/g, ''), run: () => openOrder(t.o.id) });
    for (const o of [...Store.list('orders')].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 4)) out.push({ sec: 'Mở gần đây', icon: 'orders', label: headQuote(o).customer?.name || o.code, sub: `${o.code} · ${STATUS[o.status].label} · ${money(orderTotal(o))} đ`, run: () => openOrder(o.id) });
    for (const x of acts.slice(0, 6)) out.push({ sec: 'Thao tác', icon: x.icon, label: x.label, run: x.run });
    return out;
  }
  for (const x of acts.slice(0, 4)) out.push({ sec: 'Thao tác', icon: x.icon, label: x.label, run: x.run });
  const orders = Store.list('orders').filter(o => { const h = headQuote(o); return fold([o.code, h.customer?.name, h.project, h.customer?.address].join(' ')).includes(f) || (dq.length >= 3 && digits(h.customer?.phone).includes(dq)); });
  for (const o of orders.slice(0, 8)) { const h = headQuote(o); out.push({ sec: 'Đơn hàng', icon: 'orders', label: h.customer?.name || o.code, sub: `${o.code} · ${h.project || ''} · ${STATUS[o.status].label} · ${money(orderTotal(o))} đ`, run: () => openOrder(o.id) }); }
  const cs = Store.list('customers').filter(c => fold(c.name + ' ' + c.address).includes(f) || (dq.length >= 3 && digits(c.phone).includes(dq)));
  for (const c of cs.slice(0, 4)) out.push({ sec: 'Khách hàng', icon: 'user', label: c.name, sub: [c.phone, c.address].filter(Boolean).join(' · '), run: () => { S.tab = 'orders'; S.filter = 'all'; S.q = c.name; if (!isWide()) S.orderId = null; render(); } });
  if (can('catalog')) for (const k of Store.list('catalog').filter(c => c.name && fold(c.name + ' ' + c.material).includes(f)).slice(0, 5)) out.push({ sec: 'Hạng mục', icon: 'book', label: k.name, sub: `${catGroup(k)} · ${k.price ? money(k.price) + ' đ/' + k.unit : 'chưa có giá'}`, run: () => { S.tab = 'catalog'; S.catTab = 'items'; S.catGroup = ''; S.catQ = k.name; render(); } });
  return out;
}
function openPalette() {
  if (document.querySelector('.sheet.palette')) return;
  let res = [], sel = 0;
  const el = openSheet({
    title: 'Tìm nhanh', cls: 'palette',
    html: `<div class="search" style="margin:0">${ic('search')}<input class="in" id="pal-q" type="search" placeholder="Tìm đơn, khách, SĐT, hạng mục, thao tác…" aria-label="Tìm nhanh" autocomplete="off"></div><div class="pal-list" id="pal-list" role="listbox"></div><p class="pal-hint">↑ ↓ để chọn · Enter để mở · Esc để đóng</p>`,
    onMount: el => {
      const inp = el.querySelector('#pal-q'), list = el.querySelector('#pal-list');
      const draw = () => {
        res = paletteResults(inp.value); sel = Math.min(sel, Math.max(0, res.length - 1));
        let last = '';
        list.innerHTML = res.length ? res.map((r, i) => `${r.sec !== last ? `<div class="pal-sec">${esc((last = r.sec))}</div>` : ''}<button class="pal-it" role="option" data-sa="pick" data-i="${i}" aria-selected="${i === sel}">${ic(r.icon || 'info')}<span><b>${esc(r.label)}</b>${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span></button>`).join('') : `<div class="empty">Không tìm thấy “${esc(inp.value)}”.</div>`;
        const s = list.querySelector('[aria-selected=true]'); if (s) s.scrollIntoView({ block: 'nearest' });
      };
      inp.addEventListener('input', () => { sel = 0; draw(); });
      inp.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(res.length - 1, sel + 1); draw(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
        else if (e.key === 'Enter') { e.preventDefault(); const r = res[sel]; if (r) { closeSheet(el); r.run(); } }
      });
      draw(); inp.focus(); setTimeout(() => { if (document.activeElement !== inp) inp.focus(); }, 30);
    },
    onClick: (a, b, el2) => { if (a !== 'pick') return; const r = res[+b.dataset.i]; if (r) { closeSheet(el2); r.run(); } },
  });
  return el;
}
