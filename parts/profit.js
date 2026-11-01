/* =========================================================
   LÃI: giá nhập + vận chuyển → lãi của từng đơn
   Lưu riêng ở nhóm "costs" (không nằm trong đơn), nên không bao giờ
   in ra báo giá, và khi làm việc nhóm chỉ Chủ / Kế toán đọc được.
   ========================================================= */
const canCost = () => can('cost') && feat('profit');
const costDoc = oid => Store.get('costs', 'o_' + oid) || { id: 'o_' + oid, rows: {}, chg: {}, ship: 0 };
const catCost = kid => Number(Store.get('costs', 'k_' + kid)?.cost) || 0;
const catByName = name => { const n = String(name || '').trim().toLowerCase(); return n ? Store.list('catalog').find(c => c.name.trim().toLowerCase() === n) : null; };
function saveCostDoc(oid, patch, delay = 600) {
  const cur = costDoc(oid);
  Store.put('costs', { ...cur, ...patch, rows: { ...(cur.rows || {}), ...(patch.rows || {}) }, chg: { ...(cur.chg || {}), ...(patch.chg || {}) }, kc: { ...(cur.kc || {}), ...(patch.kc || {}) }, id: 'o_' + oid }, delay);
}
function setCatCost(kid, cost, delay = 600) { Store.put('costs', { id: 'k_' + kid, cost: Math.max(0, Math.round(Number(cost) || 0)), at: new Date().toISOString() }, delay); }
/* giá nhập của 1 dòng: đã nhập cho đơn > giá nhập trong danh mục (theo tên) */
function rowCost(c, r) {
  const v = c.rows && c.rows[r.id];
  if (v != null && v !== '') return Number(v) || 0;
  const k = catByName(r.name); return k ? catCost(k.id) : 0;
}
function profitOf(o, q = null) {
  q = q || (S.view === 'edit' && o.draft ? o.draft : headQuote(o));
  const c = costDoc(o.id), t = quoteTotals(q);
  let goods = 0, missing = 0;
  for (const r of q.rows || []) {
    if (!String(r.name || '').trim() && !rowAmount(r)) continue;
    const u = rowCost(c, r);
    if (!(u > 0)) { if (rowAmount(r) > 0) missing++; continue; }
    goods += Math.round((Number(r.qty) || 0) * u);
  }
  let rev = t.total, chgCost = 0;
  for (const g of (o.changes || []).filter(x => x.status === 'confirmed')) { rev += changeSigned(g); chgCost += Number(c.chg?.[g.id]) || 0; }
  const ship = Number(c.ship) || 0, cost = goods + chgCost + ship, profit = rev - cost;
  return { rev, goods, chgCost, ship, cost, profit, pct: rev > 0 ? profit / rev * 100 : 0, missing, any: cost > 0 };
}
const pctTxt = v => (Math.round(v * 10) / 10).toLocaleString('vi-VN') + '%';
function profitInner(o) {
  const p = profitOf(o);
  return `<div class="pgrid">
      <div><span>Doanh thu</span><b>${money(p.rev)}</b></div>
      <div><span>Giá nhập</span><b>${money(p.goods + p.chgCost)}</b></div>
      <div><span>Vận chuyển</span><b>${money(p.ship)}</b></div>
      <div class="pres ${p.profit < 0 ? 'neg' : ''}"><span>Lãi</span><b>${money(p.profit)}</b><small>${p.rev ? pctTxt(p.pct) + ' doanh thu' : ''}</small></div>
    </div>
    ${p.missing ? `<p class="pwarn">${ic('info')} ${p.missing} hạng mục chưa có giá nhập, lãi đang tính cao hơn thực tế.</p>` : ''}
    <p class="muted" style="font-size:13px;margin-top:8px">Chỉ bạn thấy. Không in ra báo giá.</p>`;
}
function profitSum(o) { const p = profitOf(o); return p.any ? `<span class="${p.profit < 0 ? 'negt' : 'okt'}">${money(p.profit)} đ</span> · ${p.rev ? pctTxt(p.pct) : ''}${p.missing ? ` · <span class="warnt">thiếu ${p.missing} giá nhập</span>` : ''}` : '<span class="warnt">Chưa nhập giá nhập</span>'; }
function profitCardHtml(o) { return canCost() ? sect('profit', 'Lãi dự kiến', `<span data-psum>${profitSum(o)}</span>`, `<div data-pbody>${profitInner(o)}</div>`, { id: 'profit-card', cls: 'profit', act: `<button class="btn sm" data-act="profit-edit">${ic('edit')}Giá nhập</button>` }) : ''; }
function refreshProfit(o) {
  const el = document.getElementById('profit-card'); if (!el || !o) return;
  const b = el.querySelector('[data-pbody]'), sm = el.querySelector('[data-psum]');
  if (b) b.innerHTML = profitInner(o); if (sm) sm.innerHTML = profitSum(o);
}

function profitSheet(o) {
  const q = S.view === 'edit' && o.draft ? o.draft : headQuote(o);
  const c = costDoc(o.id);
  const rows = (q.rows || []).filter(r => String(r.name || '').trim() || rowAmount(r));
  const chgs = (o.changes || []).filter(x => x.status === 'confirmed');
  const work = { rows: Object.fromEntries(rows.map(r => [r.id, rowCost(c, r)])), chg: Object.fromEntries(chgs.map(g => [g.id, Number(c.chg?.[g.id]) || 0])), ship: Number(c.ship) || 0 };
  const sumHtml = () => {
    const t = quoteTotals(q);
    let goods = 0; for (const r of rows) goods += Math.round((Number(r.qty) || 0) * (work.rows[r.id] || 0));
    let rev = t.total, cc = 0; for (const g of chgs) { rev += changeSigned(g); cc += work.chg[g.id] || 0; }
    const cost = goods + cc + work.ship, pr = rev - cost;
    return `<div class="psum"><div><span>Doanh thu</span><b>${money(rev)}</b></div><div><span>Tổng chi phí</span><b>${money(cost)}</b></div><div class="pres ${pr < 0 ? 'neg' : ''}"><span>Lãi</span><b>${money(pr)}</b><small>${rev ? pctTxt(pr / rev * 100) : ''}</small></div></div>`;
  };
  const lineProfit = r => { const u = work.rows[r.id] || 0; if (!u) return '<span class="muted">chưa có giá nhập</span>'; const v = Math.round((Number(r.qty) || 0) * ((Number(r.price) || 0) - u)); return `<span class="${v < 0 ? 'negt' : ''}">lãi ${money(v)}</span>`; };
  const el = openSheet({
    title: 'Giá nhập & vận chuyển', cls: 'wide',
    html: `<p class="muted">${esc(q.customer?.name || o.code)} · ${esc(o.code)}. Chỉ dùng để tính lãi, <b>không in ra báo giá</b> và không gửi cho khách.</p>
      <div id="cost-sum">${sumHtml()}</div>
      <div class="cost-list">
        <div class="cost-row cost-head"><div>Hạng mục</div><div class="r">Giá bán</div><div class="r">Giá nhập / đơn vị</div><div class="r">Lãi dòng</div></div>
        ${rows.map(r => `<div class="cost-row" data-crow="${r.id}">
          <div><b>${esc(r.name || 'Dòng không tên')}</b><span class="sub">${fmtQty(r.qty)} ${esc(r.unit)}${catByName(r.name) ? '' : ' · không có trong danh mục'}</span></div>
          <div class="r num">${money(r.price)}</div>
          <div><input class="in num" data-money data-cost="${r.id}" inputmode="numeric" autocomplete="off" value="${work.rows[r.id] ? money(work.rows[r.id]) : ''}" placeholder="0" aria-label="Giá nhập ${esc(r.name)}"></div>
          <div class="r num" data-lp>${lineProfit(r)}</div></div>`).join('') || '<div class="empty">Báo giá chưa có hạng mục.</div>'}
      </div>
      ${chgs.length ? `<div class="field"><span class="lbl">Chi phí cho phát sinh đã xác nhận</span>${chgs.map(g => `<div class="cost-row two"><div><b>${esc(g.title)}</b><span class="sub">${g.sign < 0 ? '−' : '+'}${money(g.amount)} đ</span></div><div><input class="in num" data-money data-chgcost="${g.id}" inputmode="numeric" autocomplete="off" value="${work.chg[g.id] ? money(work.chg[g.id]) : ''}" placeholder="0" aria-label="Chi phí phát sinh ${esc(g.title)}"></div></div>`).join('')}</div>` : ''}
      <div class="fgrid"><div class="field cost-ship"><label for="cost-ship">Chi phí vận chuyển cả đơn</label>${moneyInput('cost-ship', work.ship, 'placeholder="0"')}</div></div>
      <label class="check"><input type="checkbox" id="cost-tocat" checked> Lưu giá nhập vào danh mục mẫu (hạng mục trùng tên) để lần sau tự điền</label>`,
    foot: `<button class="btn" data-sa="close">Hủy</button><button class="btn primary" data-sa="save">${ic('check')}Lưu</button>`,
    onMount: el => {
      el.addEventListener('input', e => {
        const t = e.target;
        if (t.dataset.cost) { work.rows[t.dataset.cost] = parseMoney(t.value); const r = rows.find(x => x.id === t.dataset.cost); const lp = t.closest('[data-crow]').querySelector('[data-lp]'); if (r && lp) lp.innerHTML = lineProfit(r); }
        else if (t.dataset.chgcost) work.chg[t.dataset.chgcost] = parseMoney(t.value);
        else if (t.id === 'cost-ship') work.ship = parseMoney(t.value);
        else return;
        el.querySelector('#cost-sum').innerHTML = sumHtml();
      });
      setTimeout(() => softFocus(el.querySelector('[data-cost]') || el.querySelector('#cost-ship')), 60);
    },
    onClick: (a, b, el2) => {
      if (a !== 'save') return;
      saveCostDoc(o.id, { rows: work.rows, chg: work.chg, ship: work.ship }, 0);
      if (el2.querySelector('#cost-tocat').checked) {
        let n = 0;
        for (const r of rows) { const k = catByName(r.name), v = work.rows[r.id]; if (k && v > 0 && v !== catCost(k.id)) { setCatCost(k.id, v, 0); n++; } }
        if (n) toast(`Đã lưu giá nhập cho ${n} hạng mục trong danh mục`);
      }
      closeSheet(el2); render(); toast('Đã lưu giá nhập và vận chuyển');
    },
  });
  return el;
}

/* khi dòng báo giá đổi mã (sửa bản mới, sao chép): mang giá nhập theo */
function carryRowCosts(fromOid, toOid, idMap) {
  const c = Store.get('costs', 'o_' + fromOid); if (!c || !c.rows) return;
  const rows = {}, kc = {}; for (const [a, b] of Object.entries(idMap)) { if (c.rows[a] != null) rows[b] = c.rows[a]; if (c.kc && c.kc[a] != null) kc[b] = c.kc[a]; }
  if (Object.keys(rows).length) saveCostDoc(toOid, { rows, kc }, 0);
}

/* thống kê lãi theo ngày chốt */
function profitStats(closed) {
  let rev = 0, cost = 0, missing = 0;
  const list = closed.map(o => { const p = profitOf(o, headQuote(o)); rev += p.rev; cost += p.cost; if (p.missing) missing++; return { o, p }; });
  return { rev, cost, profit: rev - cost, pct: rev ? (rev - cost) / rev * 100 : 0, missing, list };
}
