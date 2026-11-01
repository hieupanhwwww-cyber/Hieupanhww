/* =========================================================
   SỰ KIỆN & KHỞI ĐỘNG
   ========================================================= */
function openOrder(id) {
  const o = Store.get('orders', id); if (!o) return;
  S.tab = 'orders'; S.orderId = id; S.ver = null;
  S.view = !isClosed(o) && can('quote') ? 'edit' : 'detail';
  render();
}
function newQuoteAction() {
  if (!can('quote')) { toast('Vai trò của bạn không lập báo giá.', 'bad'); return; }
  const o = createOrderFrom(newQuote());
  Store.put('orders', o, 0);
  S.tab = 'orders'; S.orderId = o.id; S.view = 'edit'; render();
  setTimeout(() => softFocus($('#qf-name')), 80);
}
function rowById(o, id) { return o?.draft?.rows.find(r => r.id === id); }

const ACTIONS = {
  tab: b => {
    const was = S.tab; S.tab = b.dataset.tab;
    if (b.dataset.f) { S.filter = b.dataset.f; if (!isWide()) S.orderId = null; }
    if (b.dataset.ct) { S.catTab = b.dataset.ct; S.catQ = ''; }
    if (b.dataset.fin) S.fin = b.dataset.fin;
    if (S.view === 'edit' && (S.tab !== 'orders' || b.dataset.f)) { Store.flushAll(); S.view = 'detail'; }
    render();
    const pn = document.querySelector('.main [data-pane]'); if (pn && was !== S.tab) pn.scrollTop = 0;
  },
  palette: () => openPalette(),
  fin: b => { S.fin = b.dataset.v; render(); },
  'pl-r': b => { S.plR = b.dataset.v; render(); },
  'pl-month': b => plMonthSheet(b.dataset.m),
  'pl-close': b => closeBook(b.dataset.m),
  'pl-start': () => cashStartSheet(),
  'pl-csv': () => plCsv(),
  'cash-add': b => cashSheet(b.dataset.type || 'out', null, b.dataset.oid || ''),
  'cash-edit': b => { const e = Store.get('cash', b.dataset.id); e && cashSheet(e.type, e); },
  'cash-f': b => { S.cashF = b.dataset.v; render(); },
  'cash-csv': () => cashCsv(),
  theme: b => { try { if (b.dataset.v === 'auto') localStorage.removeItem('snt-theme'); else localStorage.setItem('snt-theme', b.dataset.v); } catch (e) { toast('Trình duyệt này không lưu được lựa chọn giao diện.', 'bad'); } applyTheme(); render(); },
  'todo-pay': b => { const o = Store.get('orders', b.dataset.id); if (!o) return; S.orderId = o.id; const r = planStatus(o).find(x => String(x.n) === b.dataset.n); r && paySheet(o, r); },
  'todo-qr': b => { const o = Store.get('orders', b.dataset.id); if (!o) return; const r = planStatus(o).find(x => String(x.n) === b.dataset.n); r && qrSheet(o, r); },
  'rev-by': b => { S.revBy = b.dataset.v; render(); },
  'rev-csv': () => revenueCsv(),
  'rev-cust': b => { S.tab = 'orders'; S.filter = 'all'; S.q = b.dataset.name || ''; if (!isWide()) S.orderId = null; render(); },
  'retry-save': () => { Store.flushAll(); updateSaveStatus(); },
  'reload-data': () => boot(),
  'new-quote': newQuoteAction,
  'open-order': b => openOrder(b.dataset.id),
  'back-list': () => { S.orderId = null; S.view = 'list'; render(); },
  filter: b => { S.filter = b.dataset.f; S.tab = 'orders'; if (!isWide()) { S.orderId = null; S.view = 'list'; } render(); },
  'goto-stats': b => { S.tab = 'stats'; S.period = 'month'; render(); drillSheet(b.dataset.drill); },
  'seed-demo': () => seedDemo(),
  'clear-demo': () => clearDemo(),
  'ed-back': () => {
    const o = curOrder();
    Store.flushAll();
    if (o && isClosed(o)) S.view = 'detail'; else { S.view = 'list'; if (!isWide()) S.orderId = null; else S.orderId = null; }
    render();
  },
  'edit-quote': () => { S.view = 'edit'; render(); },
  'add-row': () => {
    const o = curOrder(); if (!o?.draft) return;
    const r = newRow(); o.draft.rows.push(r); refreshRows(o); touchOrder(o);
    setTimeout(() => { const el = document.getElementById('n-' + r.id); if (el) { softFocus(el); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 30);
  },
  'add-from-cat': () => { const o = curOrder(); o?.draft && catalogPicker(o); },
  'pick-customer': () => { const o = curOrder(); o?.draft && customerPicker(o); },
  dims: b => { const o = curOrder(), r = rowById(o, b.dataset.row); r && dimsSheet(o, r); },
  'row-menu': b => {
    const o = curOrder(), r = rowById(o, b.dataset.row); if (!r) return;
    const rows = o.draft.rows, i = rows.indexOf(r);
    const items = [
      { label: 'Nhập kích thước', icon: 'ruler', run: () => dimsSheet(o, r) },
      { label: 'Sao chép dòng', icon: 'copy', run: () => { const nid = uid('r'); rows.splice(i + 1, 0, { ...clone(r), id: nid }); carryRowCosts(o.id, o.id, { [r.id]: nid }); refreshRows(o); touchOrder(o, 0); toast('Đã sao chép dòng'); } },
      { label: 'Lưu vào danh mục mẫu', icon: 'book', run: () => {
        if (!r.name.trim()) { toast('Dòng chưa có tên hạng mục.', 'bad'); return; }
        const ex = Store.list('catalog').find(c => c.name.trim().toLowerCase() === r.name.trim().toLowerCase());
        if (ex) { Store.put('catalog', { ...ex, material: r.material, unit: r.unit, price: r.price }, 0); toast('Đã cập nhật “' + r.name + '” trong danh mục'); }
        else { Store.put('catalog', { id: uid('k'), name: r.name.trim(), material: r.material, unit: r.unit, price: r.price }, 0); toast('Đã lưu “' + r.name + '” vào danh mục'); }
      } },
    ];
    if (i > 0) items.push({ label: 'Chuyển lên', icon: 'up', run: () => { rows.splice(i, 1); rows.splice(i - 1, 0, r); refreshRows(o); touchOrder(o, 0); } });
    if (i < rows.length - 1) items.push({ label: 'Chuyển xuống', icon: 'down', run: () => { rows.splice(i, 1); rows.splice(i + 1, 0, r); refreshRows(o); touchOrder(o, 0); } });
    items.push({ label: 'Xóa dòng', icon: 'trash', danger: true, run: async () => {
      const ok = await confirmBox({ title: 'Xóa dòng này?', text: `Xóa “${esc(r.name || 'dòng ' + (i + 1))}” (${moneyD(rowAmount(r))}) khỏi báo giá.`, ok: 'Xóa dòng', danger: true });
      if (!ok) return; o.draft.rows = o.draft.rows.filter(x => x.id !== r.id); refreshRows(o); touchOrder(o, 0); toast('Đã xóa dòng');
    } });
    menuSheet(r.name || 'Dòng ' + (i + 1), items);
  },
  'disc-type': b => {
    const o = curOrder(); if (!o?.draft) return;
    const t = b.dataset.t; o.draft.discount = { type: t, value: 0 };
    const box = $('#totals'); if (box) box.innerHTML = totalsInner(o.draft);
    touchOrder(o, 0);
  },
  'ed-menu': () => {
    const o = curOrder(); if (!o?.draft) return;
    const items = [{ label: 'Sao chép thành báo giá mới', icon: 'copy', run: () => { Store.flushAll(); copyQuoteToNew(o.draft, o.code); } }];
    if (staleRows(o).length) items.unshift({ label: 'Cập nhật theo giá mới trong danh mục', icon: 'stats', run: () => repriceSheet(o) });
    if (o.versions.length) items.push({ label: `Hủy bản ${o.versions.length + 1} (nháp)`, icon: 'x', danger: true, run: async () => {
      const ok = await confirmBox({ title: 'Hủy bản nháp?', text: `Các thay đổi của bản ${o.versions.length + 1} sẽ bị bỏ. Bản ${o.versions.length} đã chốt giữ nguyên.`, ok: 'Hủy bản nháp', danger: true });
      if (!ok) return; o.draft = null; addLog(o, 'Hủy bản nháp sửa báo giá'); touchOrder(o, 0); S.view = 'detail'; render();
    } });
    else if (can('delOrder')) items.push({ label: 'Xóa báo giá', icon: 'trash', danger: true, run: () => deleteOrder(o) });
    menuSheet('Báo giá ' + o.code, items);
  },
  'order-menu': () => {
    const o = curOrder(); if (!o) return;
    const items = [];
    if (can('quote')) items.push({ label: 'Sao chép thành báo giá mới', icon: 'copy', run: () => copyQuoteToNew(lastVersion(o).quote, o.code) });
    if (can('delOrder')) items.push({ label: 'Xóa đơn', icon: 'trash', danger: true, run: () => deleteOrder(o) });
    if (!items.length) { toast('Không có thao tác nào khác cho vai trò của bạn.'); return; }
    menuSheet('Đơn ' + o.code, items);
  },
  preview: b => { const o = curOrder(); if (!o) return; Store.flushAll(); previewQuote(o, b.dataset.src); },
  pdf: b => { const o = curOrder(); if (!o) return; Store.flushAll(); exportPdf(o, b.dataset.src); },
  png: b => { const o = curOrder(); if (!o) return; Store.flushAll(); exportPdf(o, b.dataset.src, null, 'png'); },
  'close-quote': () => { const o = curOrder(); o?.draft && closeQuoteSheet(o); },
  revise: () => {
    const o = curOrder(); const r = Orders.revise(o); if (!r) return;
    addLog(o, `Bắt đầu sửa báo giá (bản ${r.no})`); touchOrder(o, 0);
    S.view = 'edit'; render(); toast(`Đã tạo bản ${r.no} để sửa. Bản cũ giữ nguyên.`);
  },
  'copy-quote': b => { const o = curOrder(); if (!o) return; const v = o.versions.find(x => String(x.no) === b.dataset.src) || lastVersion(o); copyQuoteToNew(v.quote, o.code); },
  'show-ver': b => { S.ver = +b.dataset.v; render(); },
  'set-status': b => {
    const o = curOrder(); if (!Orders.setStatus(o, b.dataset.s)) return;
    render(); toast('Trạng thái: ' + STATUS[o.status].label);
  },
  'add-pay': () => { const o = curOrder(); o && paySheet(o); },
  'lib-open': () => librarySheet(),
  'bulk-price': () => bulkPriceSheet(),
  'stale-list': () => staleListSheet(),
  'reprice': () => { const o = curOrder(); if (o) { Store.flushAll(); repriceSheet(o); } },
  'cat-group': b => { S.catGroup = b.dataset.g || ''; render(); },
  'profit-edit': () => { const o = curOrder(); if (o && canCost()) { Store.flushAll(); profitSheet(o); } },
  'del-pay': async b => {
    const o = curOrder(), p = o?.payments.find(x => x.id === b.dataset.id); if (!p) return;
    if (!(await okToEditDate(p.date))) return;
    const ok = await confirmBox({ title: 'Xóa khoản thanh toán?', text: `Xóa khoản <b>${moneyD(p.amount)}</b> ngày ${fmtDate(p.date)}. Chỉ xóa khi ghi nhầm.`, ok: 'Xóa', danger: true });
    if (!ok) return; o.payments = o.payments.filter(x => x.id !== p.id); addLog(o, `Xóa khoản thu ${moneyD(p.amount)} ngày ${fmtDate(p.date)}`); touchOrder(o, 0); render();
  },
  'add-change': () => { const o = curOrder(); o && changeSheet(o); },
  'confirm-change': b => { const o = curOrder(), c = o?.changes.find(x => x.id === b.dataset.id); c && confirmChangeSheet(o, c); },
  'cancel-change': async b => {
    const o = curOrder(), c = o?.changes.find(x => x.id === b.dataset.id); if (!c) return;
    const ok = await confirmBox({ title: 'Hủy phát sinh?', text: `“${esc(c.title)}” sẽ chuyển sang Đã hủy và không tính vào tổng.`, ok: 'Hủy phát sinh', danger: true });
    if (!ok) return; c.status = 'cancelled'; c.cancelledAt = today(); addLog(o, `Hủy phát sinh “${c.title}”`); touchOrder(o, 0); render();
  },
  'add-att': () => { const i = $('#att-input'); i && i.click(); },
  'open-att': b => { const o = curOrder(), a = o?.attachments.find(x => x.id === b.dataset.id); a && openAttachment(o, a); },
  'focus-note': () => { openSect('notes'); const n = $('#note-in'); if (n) { n.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => n.focus(), 250); } },
  'add-note': () => {
    const o = curOrder(), n = $('#note-in'); if (!o || !n) return;
    const t = n.value.trim(); if (!t) { toast('Hãy nhập nội dung ghi chú.', 'bad'); n.focus(); return; }
    o.notes.push({ id: uid('n'), text: t, at: new Date().toISOString() }); touchOrder(o, 0); render(); toast('Đã thêm ghi chú');
  },
  'del-note': async b => {
    const o = curOrder(); if (!o) return;
    const ok = await confirmBox({ title: 'Xóa ghi chú?', text: 'Ghi chú này sẽ bị xóa.', ok: 'Xóa', danger: true });
    if (!ok) return; o.notes = o.notes.filter(x => x.id !== b.dataset.id); touchOrder(o, 0); render();
  },
  period: b => { S.period = b.dataset.p; render(); },
  drill: b => drillSheet(b.dataset.d),
  bar: b => drillSheet('month', { m: b.dataset.m }),
  'cat-tab': b => { S.catTab = b.dataset.t; S.catQ = ''; render(); },
  'cat-add': () => {
    const c = { id: uid('k'), name: '', material: '', unit: 'm²', price: 0, group: S.catGroup || 'Khác', new: Date.now() };
    Store.put('catalog', c, 0); S.catQ = ''; render(); setTimeout(() => { const el = document.getElementById('cn-' + c.id); el && el.focus(); }, 50);
  },
  'cat-del': async b => {
    const c = Store.get('catalog', b.dataset.id); if (!c) return;
    const ok = await confirmBox({ title: 'Xóa hạng mục mẫu?', text: `Xóa “${esc(c.name || 'hạng mục chưa đặt tên')}” khỏi danh mục. Các báo giá đã lập không bị ảnh hưởng.`, ok: 'Xóa', danger: true });
    if (!ok) return; Store.del('catalog', c.id); render();
  },
  'cus-add': () => {
    const c = { id: uid('c'), name: '', phone: '', address: '', createdAt: new Date().toISOString(), new: Date.now() };
    Store.put('customers', c, 0); S.catQ = ''; render(); setTimeout(() => { const el = document.getElementById('kn-' + c.id); el && el.focus(); }, 50);
  },
  'cus-del': async b => {
    const c = Store.get('customers', b.dataset.id); if (!c) return;
    const ok = await confirmBox({ title: 'Xóa khách hàng?', text: `Xóa “${esc(c.name || 'khách chưa đặt tên')}” khỏi danh sách. Các đơn của khách vẫn giữ nguyên.`, ok: 'Xóa', danger: true });
    if (!ok) return; Store.del('customers', c.id); render();
  },
  'logo-del': async () => { const ok = await confirmBox({ title: 'Bỏ logo?', text: 'Logo sẽ không còn in trên báo giá, phiếu thu. Muốn dùng lại phải tải ảnh logo lên lần nữa.', ok: 'Bỏ logo', danger: true }); if (!ok) return; saveSettings({ logo: '' }); render(); },
  'skip-main': () => { const m = $('#main'); m && m.focus(); },
  backup: () => backupJson(),
  'plan-add': b => {
    const ctx = planCtx(b); if (!ctx) return;
    const p = ctx.plan.slice(); p.splice(Math.max(0, p.length - 1), 0, { id: uid('d'), label: '', pct: 0, trigger: 'date' });
    ctx.plan = p; rerenderPlan(ctx);
    setTimeout(() => softFocus(ctx.box.querySelector(`#pl-${p[Math.max(0, p.length - 2)].id}`)), 30);
  },
  'plan-del': async b => {
    const ctx = planCtx(b); if (!ctx) return;
    const r = ctx.plan.find(x => x.id === b.dataset.id); if (!r || ctx.plan.length <= 1) return;
    const ok = await confirmBox({ title: 'Xóa đợt thanh toán?', text: `Xóa “${esc(r.label || 'đợt chưa đặt tên')}” khỏi lịch. Đợt cuối sẽ tự nhận phần tiền còn lại.`, ok: 'Xóa đợt', danger: true });
    if (!ok) return; ctx.plan = ctx.plan.filter(x => x.id !== r.id); rerenderPlan(ctx);
  },
  'plan-preset': async b => {
    const ctx = planCtx(b); if (!ctx) return;
    const k = b.dataset.p, src = k === 'tpl' ? planTemplate() : PLAN_PRESETS[k]?.rows; if (!src) return;
    const sig = p => JSON.stringify((p || []).map(r => [r.label || '', r.fixed ? 'f' + (r.amt || 0) : Number(r.pct) || 0, r.trigger]));
    const known = [planTemplate(), ...Object.values(PLAN_PRESETS).map(x => x.rows)].map(sig);
    if (ctx.plan && ctx.plan.length && !known.includes(sig(ctx.plan))) {
      const ok = await confirmBox({ title: 'Thay lịch đang có?', text: `Lịch bạn đã sửa sẽ được thay bằng mẫu “${k === 'tpl' ? 'Mẫu của tôi' : PLAN_PRESETS[k].label}”.`, ok: 'Thay' });
      if (!ok) return;
    }
    ctx.plan = newPlan(src); rerenderPlan(ctx);
  },
  'plan-unit': b => {
    const ctx = planCtx(b); if (!ctx) return;
    const r = ctx.plan.find(x => x.id === b.dataset.id); if (!r) return;
    const amt = ctx.total > 0 ? planAmounts(ctx.plan, ctx.total).find(x => x.id === r.id)?.amount || 0 : 0;
    if (r.fixed) { r.fixed = false; delete r.amt; if (ctx.total > 0) r.pct = Math.min(100, Math.round(amt / ctx.total * 1000) / 10); }
    else { r.fixed = true; r.amt = amt; }
    rerenderPlan(ctx);
    setTimeout(() => softFocus(ctx.box.querySelector(`#${r.fixed ? 'pa' : 'pp'}-${r.id}`)), 30);
  },
  'plan-edit': () => { const o = curOrder(); o && planEditSheet(o); },
  'plan-qr': b => { const o = curOrder(), r = planStatus(o).find(x => String(x.n) === b.dataset.n); r && qrSheet(o, r); },
  'plan-pay': b => { const o = curOrder(), r = planStatus(o).find(x => String(x.n) === b.dataset.n); r && paySheet(o, r); },
  receipt: b => {
    const o = curOrder(), p = o?.payments.find(x => x.id === b.dataset.id); if (!p) return;
    menuSheet('Phiếu thu ' + receiptNo(o, p), [
      { label: 'Xuất ảnh PNG (gửi Zalo)', icon: 'image', run: () => exportDoc(() => renderReceipt(o, p), 'png') },
      { label: 'Xuất PDF', icon: 'dl', run: () => exportDoc(() => renderReceipt(o, p)) },
    ]);
  },
  handover: () => {
    const o = curOrder(); if (!o) return;
    if (!o.handover) { handoverSheet(o); return; }
    menuSheet('Nghiệm thu, bàn giao', [
      { label: 'Xuất biên bản PDF', icon: 'dl', run: () => exportDoc(() => renderHandover(o)) },
      { label: 'Xuất biên bản ảnh PNG', icon: 'image', run: () => exportDoc(() => renderHandover(o), 'png') },
      { label: 'Làm lại biên bản', icon: 'edit', run: () => handoverSheet(o) },
    ]);
  },
  'handover-pdf': () => { const o = curOrder(); o?.handover && exportDoc(() => renderHandover(o)); },
  'handover-png': () => { const o = curOrder(); o?.handover && exportDoc(() => renderHandover(o), 'png'); },
  'sign-version': b => { const o = curOrder(), v = o?.versions.find(x => String(x.no) === b.dataset.v); v && signVersionSheet(o, v); },
  'qr-test': () => {
    const st = settings();
    const payload = vietQRPayload({ bin: st.bankBin, account: String(st.bankAccount).replace(/\s/g, ''), amount: 10000, memo: qrMemo(`${st.memoPrefix || ''} THU QR`) });
    openSheet({
      title: 'Thử mã QR 10.000 đ',
      html: `<div class="qrbox"><div id="qr-canvas"></div><p>Quét bằng app ngân hàng của bạn. Nếu app hiện đúng tên chủ tài khoản <b>${esc(st.bankHolder || '')}</b> và số tiền 10.000 đ là mã đã đúng.</p></div>`,
      foot: `<button class="btn primary" data-sa="close">Xong</button>`,
      onMount: el => { const cv = QR.toCanvas(QR.encode(payload), 720); cv.className = 'qrimg'; el.querySelector('#qr-canvas').appendChild(cv); },
    });
  },
};
Object.assign(ACTIONS, TEAM_ACTIONS);

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const fn = ACTIONS[b.dataset.act];
  if (fn) { e.preventDefault(); fn(b, e); }
});
document.addEventListener('click', e => {
  const inp = e.target.closest('.datefield input');
  if (inp && typeof inp.showPicker === 'function') { try { inp.showPicker(); } catch (er) { /* trình duyệt tự mở */ } }
});

/* định dạng ô tiền khi gõ, giữ vị trí con trỏ */
function formatMoneyInput(el) {
  const pos = el.selectionStart ?? el.value.length;
  const digitsRight = el.value.slice(pos).replace(/\D/g, '').length;
  const v = parseMoney(el.value);
  const nv = el.value.replace(/\D/g, '') ? money(v) : '';
  if (nv === el.value) return;
  el.value = nv;
  let p = nv.length, cnt = 0;
  while (p > 0 && cnt < digitsRight) { p--; if (/\d/.test(nv[p])) cnt++; }
  if (digitsRight === 0) p = nv.length;
  try { el.setSelectionRange(p, p); } catch (er) { /* bỏ qua */ }
}
document.addEventListener('input', e => {
  const el = e.target;
  if (el.matches('[data-money]') || (el.id === 'disc-val' && curOrder()?.draft?.discount?.type !== 'percent')) formatMoneyInput(el);
  if (el.matches('.datefield input')) { const t = el.parentElement.querySelector('[data-dftext]'); if (t) t.textContent = el.value ? fmtDate(el.value) : 'Chọn ngày'; }
  if (el.dataset.pf) { planInput(el); return; }
  if (el.closest('.editor')) { onEditorInput(e); return; }
  if (el.id === 'order-search') { S.q = el.value; const c = $('#cards'); if (c) c.innerHTML = renderCards(); return; }
  if (el.id === 'cat-search') { S.catQ = el.value; clearTimeout(window._catT); window._catT = setTimeout(() => { const pos = el.selectionStart; render(); const n = $('#cat-search'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (er) { /* */ } } }, 350); return; }
  if (el.dataset.kc) { setCatCost(el.dataset.kc, parseMoney(el.value)); return; }
  if (el.dataset.cf) { const row = el.closest('[data-cat]'), c = Store.get('catalog', row.dataset.cat); if (!c) return; const v = el.dataset.cf === 'price' ? parseMoney(el.value) : el.value; Store.put('catalog', { ...c, [el.dataset.cf]: v, ...(el.dataset.cf === 'price' && c.price ? { priceAt: new Date().toISOString() } : {}) }); return; }
  if (el.dataset.kf) { const row = el.closest('[data-cus]'), c = Store.get('customers', row.dataset.cus); if (!c) return; Store.put('customers', { ...c, [el.dataset.kf]: el.value }); return; }
  if (el.dataset.sf) {
    saveSettings({ [el.dataset.sf]: el.value });
    if (['bankBin', 'bankAccount', 'memoPrefix', 'codePrefix'].includes(el.dataset.sf)) { const q = $('#qrtest'); if (q) q.innerHTML = qrTestHtml(); }
    return;
  }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (teamChange(el)) return;
  if (el.dataset && el.dataset.feat) { saveSettings({ features: { ...(settings().features || {}), [el.dataset.feat]: el.checked } }); render(); toast((el.checked ? 'Đã bật: ' : 'Đã tắt: ') + (FEATS.find(f => f[0] === el.dataset.feat) || [])[1]); return; }
  if (el.hasAttribute('data-plan-on')) { planToggle(el); return; }
  if (el.hasAttribute('data-plan-auto')) { saveSettings({ planAuto: el.checked }); render(); toast(el.checked ? 'Báo giá mới sẽ tự chia đợt theo mẫu' : 'Báo giá mới sẽ không chia đợt'); return; }
  if (el.dataset.due === 'all') {
    const o = curOrder(); if (!o) return;
    o.payDue = el.value || ''; addLog(o, o.payDue ? `Hẹn ngày thu tiền còn lại: ${fmtDate(o.payDue)}` : 'Bỏ hạn thu tiền còn lại'); touchOrder(o, 0); render(); return;
  }
  if (el.dataset.due) {
    const o = curOrder(), r = o?.plan?.find(x => x.id === el.dataset.due); if (!r) return;
    r.due = el.value || ''; const n = o.plan.indexOf(r) + 1;
    addLog(o, r.due ? `Đặt hạn thu đợt ${n}: ${fmtDate(r.due)}` : `Bỏ hạn thu đợt ${n}`); touchOrder(o, 0); render(); return;
  }
  if (el.dataset.pf) return;
  if (el.closest('.editor') && (el.tagName === 'SELECT' || el.type === 'date')) { onEditorInput(e); return; }
  if (el.dataset.cf && el.tagName === 'SELECT') { const row = el.closest('[data-cat]'), c = Store.get('catalog', row.dataset.cat); c && Store.put('catalog', { ...c, unit: el.value }, 0); return; }
  if (el.id === 'st-from' || el.id === 'st-to') { if (el.value) { S[el.id === 'st-from' ? 'from' : 'to'] = el.value; render(); } return; }
  if (el.id === 'att-input') { const o = curOrder(); if (o && el.files.length) addAttachments(o, el.files); el.value = ''; return; }
  if (el.id === 'logo-in') { if (el.files[0]) setLogo(el.files[0]); el.value = ''; return; }
  if (el.id === 'restore-in') { if (el.files[0]) restoreJson(el.files[0]); el.value = ''; return; }
});
document.addEventListener('focusout', e => {
  const el = e.target;
  if (el.dataset && el.dataset.rf === 'qty') { const v = parseQty(el.value); el.value = v ? fmtQty(v) : ''; }
  if (el.id === 'disc-val' && curOrder()?.draft?.discount?.type === 'percent') { const v = parseQty(el.value); el.value = v ? QF.format(Math.min(v, 100)) : ''; }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Tab' && sheets.length) { trapTab(e); return; }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  const mod = e.metaKey || e.ctrlKey;
  if (Store.mode !== 'loading' && !(Team.cfg && Team.state !== 'ready')) {
    if (mod && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openPalette(); return; }
    if (!typing && !sheets.length && e.key === '/') { e.preventDefault(); openPalette(); return; }
    if (mod && (e.key === 'n' || e.key === 'N') && can('quote') && !sheets.length) { e.preventDefault(); newQuoteAction(); return; }
    const tabs = ['today', 'orders', 'stats', 'catalog', 'settings'];
    if (mod && /^[1-5]$/.test(e.key) && !(Team.on() && Team.role === 'worker')) { e.preventDefault(); const t = tabs[+e.key - 1]; if (t === 'catalog' && !can('catalog')) return; S.tab = t; if (S.view === 'edit') { Store.flushAll(); S.view = 'detail'; } render(); return; }
  }
  if (e.key === 'Escape' && sheets.length) closeSheet();
  if (e.key === 'Enter' && e.target.id === 'note-in') { e.preventDefault(); ACTIONS['add-note'](); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { Store.flushAll(); return; }
  if (Store.mode === 'team' && !document.hidden && Store.failed.size && navigator.onLine !== false) { Store.flushAll(); return; }
  if (Store.mode === 'cloud' && !Store.busy() && !Store.failed.size && !sheets.length && S.view !== 'edit' && Date.now() - Store.loadedAt > 15000) {
    Store.loadAll().then(render).catch(() => { /* giữ dữ liệu đang có */ });
  }
});
window.addEventListener('pagehide', () => Store.flushAll());
/* còn thay đổi chưa gửi được lên máy chủ: hỏi trước khi đóng trang (trình duyệt máy tính) */
window.addEventListener('beforeunload', e => { if (Store.mode === 'loading') return; Store.flushAll(); if (Store.failed.size) { e.preventDefault(); e.returnValue = ''; } });
/* nhớ màn đang xem trên máy này: iPad tự tắt app chạy ngầm rồi mở lại vẫn về đúng đơn đang làm */
let viewSig = '';
function saveView() {
  if (Store.mode === 'loading' || S.loadError) return;
  const v = { tab: S.tab, orderId: S.orderId, view: S.view, filter: S.filter, fin: S.fin || '', catTab: S.catTab };
  const sig = JSON.stringify(v); if (sig === viewSig) return; viewSig = sig;
  try { localStorage.setItem('snt-view', JSON.stringify({ ...v, at: Date.now() })); } catch (e) { /* bỏ qua */ }
}
function restoreView() {
  let v = null; try { v = JSON.parse(localStorage.getItem('snt-view') || 'null'); } catch (e) { v = null; }
  if (!v || Date.now() - (v.at || 0) > 12 * 3600e3) return;
  if (['today', 'orders', 'stats', 'catalog', 'settings'].includes(v.tab)) S.tab = v.tab;
  if (v.fin) S.fin = v.fin; if (v.filter) S.filter = v.filter; if (v.catTab) S.catTab = v.catTab;
  const o = v.orderId && Store.get('orders', v.orderId);
  if (o) { S.orderId = o.id; S.view = v.view === 'edit' && o.draft && can('quote') ? 'edit' : v.view === 'detail' || v.view === 'edit' ? 'detail' : 'list'; }
}
wideMQ.addEventListener('change', () => render());

/* ảnh đính kèm lưu trên máy: điền src sau khi vẽ */
function hydrate() {
  const o = curOrder(); if (!o) return;
  for (const img of $$('img[data-att]')) {
    const a = o.attachments.find(x => x.id === img.dataset.att); if (!a) continue;
    attSrc(a).then(u => { if (u) img.src = u; });
  }
}

async function boot() {
  S.loadError = ''; Store.mode = 'loading';
  if (ownSite && Team.readCfg()) { Team.start(); return; }
  render();
  let db = null;
  if (window.claude && typeof window.claude.use === 'function') {
    try { db = await Promise.race([window.claude.use('db'), sleep(11000).then(() => null)]); } catch (e) { db = null; }
    window.claude.use('assets').then(a => { caps.assets = a; if (S.orderId && Store.mode === 'cloud') render(); }).catch(() => { caps.assets = null; });
    window.claude.use('downloads').then(d => { caps.downloads = d; }).catch(() => { caps.downloads = null; });
  }
  if (db) { caps.db = db; Store.backend = cloudBackend(db); await Outbox.open(); }
  else {
    Store.backend = await localBackend();
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* bỏ qua */ }
  }
  try {
    await withTimeout(Store.loadAll(), 25000);
    Store.mode = db ? 'cloud' : 'local';
    if (Store.mode === 'cloud') { const n = await Store.restoreOutbox(); if (n) setTimeout(() => toast(`Đã khôi phục ${n} thay đổi chưa gửi lên máy chủ`), 300); }
  } catch (e) {
    Store.mode = db ? 'cloud' : 'local';
    S.loadError = e && e.code === 'revoked' ? 'Bạn không còn quyền mở dữ liệu của app này.' : 'Không kết nối được tới nơi lưu dữ liệu. Kiểm tra mạng rồi bấm Thử lại.';
  }
  if (!S.loadError) restoreView();
  toastBox();
  render();
  ensureFonts();
}
setInterval(() => { if (Store.failed.size && navigator.onLine !== false) Store.flushAll(); }, 15000);
window.addEventListener('online', () => { if (Store.failed.size) Store.flushAll(); updateSaveStatus(); });
window.addEventListener('offline', () => updateSaveStatus());
if (ownSite && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === '127.0.0.1' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* chạy bình thường không cần ngoại tuyến */ }); });
}
boot();
