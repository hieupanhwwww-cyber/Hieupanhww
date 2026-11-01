/* =========================================================
   SỔ THU CHI
   - Khoản chi (vật tư, thợ, vận chuyển, quảng cáo…) và thu khác ghi ở nhóm "cash".
   - Tiền khách trả đã ghi trong đơn được tự gộp vào phần Thu, không phải ghi lại.
   - Khoản chi gắn với đơn → ra lãi thực tế của đơn.
   ========================================================= */
const CASH_OUT = ['Vật tư, ván', 'Phụ kiện, thiết bị', 'Nhân công, thợ', 'Thuê ngoài, gia công', 'Vận chuyển', 'Quảng cáo', 'Lương', 'Thuê xưởng, mặt bằng', 'Điện, nước, xăng', 'Dụng cụ, máy móc', 'Tiếp khách', 'Chi khác'];
const CASH_IN = ['Thu khác', 'Bán phế liệu', 'Góp vốn, vay'];
const CUST_CAT = 'Tiền khách trả';
const CASH_IC = { 'Vật tư, ván': 'book', 'Phụ kiện, thiết bị': 'ruler', 'Nhân công, thợ': 'user', 'Thuê ngoài, gia công': 'user', 'Vận chuyển': 'orders', 'Quảng cáo': 'stats', 'Lương': 'user', 'Thuê xưởng, mặt bằng': 'lock', 'Điện, nước, xăng': 'info', 'Dụng cụ, máy móc': 'ruler', 'Tiếp khách': 'note', [CUST_CAT]: 'money' };
const canCash = () => can('cash') && feat('cash');

/* mọi khoản thu chi trong kỳ (gồm tiền khách trả trong đơn) */
function cashList(from, to) {
  const inR = d => (!from || d >= from) && (!to || d <= to);
  const out = [];
  for (const e of Store.list('cash')) if (e && e.date && inR(e.date)) out.push({ ...e, src: 'cash' });
  for (const o of Store.list('orders')) for (const p of o.payments || []) if (inR(p.date)) {
    out.push({ id: 'p_' + p.id, src: 'pay', type: 'in', date: p.date, amount: Number(p.amount) || 0, cat: CUST_CAT, note: (headQuote(o).customer?.name || '') + (p.note ? ' · ' + p.note : ''), oid: o.id, method: p.method, createdAt: p.createdAt });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}
function cashSum(list) {
  let i = 0, ic = 0, o = 0; const cats = new Map();
  for (const e of list) {
    if (e.type === 'out') { o += e.amount; cats.set(e.cat, (cats.get(e.cat) || 0) + e.amount); }
    else { i += e.amount; if (e.src === 'pay') ic += e.amount; }
  }
  return { in: i, inCust: ic, inOther: i - ic, out: o, net: i - o, cats: [...cats].map(([g, v]) => ({ g, v })).sort((a, b) => b.v - a.v) };
}
const orderSpendList = oid => Store.list('cash').filter(e => e.oid === oid && e.type === 'out').sort((a, b) => b.date.localeCompare(a.date));
const orderSpend = oid => orderSpendList(oid).reduce((s, e) => s + (Number(e.amount) || 0), 0);

/* ---------- ghi / sửa một khoản ---------- */
function cashSheet(type = 'out', entry = null, oid = '') {
  if (!canCash()) { toast('Vai trò của bạn không ghi thu chi.', 'bad'); return; }
  const e = entry ? clone(entry) : { id: uid('t'), type, date: today(), amount: 0, cat: type === 'out' ? CASH_OUT[0] : CASH_IN[0], note: '', oid: oid || '', method: 'cash', createdAt: new Date().toISOString() };
  const orders = Store.list('orders').sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const catHtml = t => (t === 'out' ? CASH_OUT : CASH_IN).map(c => `<button type="button" class="chip" data-sa="cat" data-v="${esc(c)}" aria-pressed="${c === e.cat}">${esc(c)}</button>`).join('');
  const el = openSheet({
    title: entry ? 'Sửa khoản thu chi' : (type === 'out' ? 'Ghi khoản chi' : 'Ghi khoản thu'),
    html: `<div class="seg" id="cs-type"><button data-sa="ty" data-v="out" aria-pressed="${e.type === 'out'}">Khoản chi</button><button data-sa="ty" data-v="in" aria-pressed="${e.type === 'in'}">Khoản thu khác</button></div>
      <div class="field"><label for="cs-amt">Số tiền</label>${moneyInput('cs-amt', e.amount, 'placeholder="0" style="font-size:22px;font-weight:700"')}</div>
      <div class="field"><span class="lbl">Nhóm</span><div class="chips wrap" id="cs-cats">${catHtml(e.type)}</div></div>
      <div class="fgrid">
        <div class="field"><label for="cs-date">Ngày</label>${dateField('cs-date', e.date)}</div>
        <div class="field"><span class="lbl">Hình thức</span><div class="seg" id="cs-method">${methodSeg(e.method || 'cash')}</div></div>
      </div>
      <div class="field"><label for="cs-oid">Cho đơn (để tính lãi thực tế của đơn)</label><select class="in" id="cs-oid"><option value="">Không gắn đơn (chi chung)</option>${orders.map(o => `<option value="${o.id}" ${o.id === e.oid ? 'selected' : ''}>${esc(headQuote(o).customer?.name || 'Khách chưa đặt tên')} · ${esc(o.code)} · ${STATUS[o.status].label}</option>`).join('')}${e.oid && !Store.get('orders', e.oid) ? `<option value="${esc(e.oid)}" selected>(đơn đã xóa)</option>` : ''}</select></div>
      <div class="field"><label for="cs-note">Nội dung</label><input class="in" id="cs-note" value="${esc(e.note || '')}" placeholder="VD: 10 tấm MDF An Cường 17 ly, tiền xe chở đồ" autocomplete="off"></div>
      <p class="muted" style="font-size:13px">Tiền khách trả đã ghi trong đơn được tự đưa vào phần Thu, không cần ghi lại ở đây.</p>`,
    foot: `${entry ? `<button class="btn danger" data-sa="del" style="margin-right:auto">${ic('trash')}Xóa</button>` : ''}<button class="btn" data-sa="close">Hủy</button><button class="btn primary" data-sa="save">${ic('check')}Lưu</button>`,
    onMount: el => setTimeout(() => softFocus(el.querySelector('#cs-amt')), 60),
    onClick: async (a, b, el2) => {
      if (a === 'ty') { segPick(b); e.type = b.dataset.v; e.cat = (e.type === 'out' ? CASH_OUT : CASH_IN)[0]; el2.querySelector('#cs-cats').innerHTML = catHtml(e.type); return; }
      if (a === 'cat') { e.cat = b.dataset.v; $$('#cs-cats .chip', el2).forEach(x => x.setAttribute('aria-pressed', x === b)); return; }
      if (a === 'm') { segPick(b); return; }
      if (a === 'del') {
        if (!(await okToEditDate(e.date))) return;
        const ok = await confirmBox({ title: 'Xóa khoản này?', text: `${e.type === 'out' ? 'Khoản chi' : 'Khoản thu'} ${moneyD(e.amount)} ngày ${fmtDate(e.date)} sẽ bị xóa.`, ok: 'Xóa', danger: true });
        if (!ok) return; Store.del('cash', e.id); closeSheet(el2); render(); toast('Đã xóa'); return;
      }
      if (a !== 'save') return;
      const amt = parseMoney(el2.querySelector('#cs-amt').value);
      if (amt <= 0) { toast('Hãy nhập số tiền lớn hơn 0.', 'bad'); el2.querySelector('#cs-amt').focus(); return; }
      const newDate = el2.querySelector('#cs-date').value || today();
      if (!(await okToEditDate(newDate, entry ? entry.date : newDate))) return;
      const rec = { ...e, amount: amt, date: newDate, method: el2.querySelector('#cs-method [aria-pressed=true]').dataset.v, oid: el2.querySelector('#cs-oid').value, note: el2.querySelector('#cs-note').value.trim(), updatedAt: new Date().toISOString(), ...(Team.on() ? { by: Team.uid(), byName: Team.myName() } : {}) };
      delete rec.src;
      Store.put('cash', rec, 0); closeSheet(el2); render();
      toast(`Đã ghi ${rec.type === 'out' ? 'khoản chi' : 'khoản thu'} ${moneyD(amt)}`);
    },
  });
  return el;
}

/* ---------- màn Thu chi ---------- */
function finBar(cur) {
  if (!canCash() && !canCost()) return '';
  return `<div class="finbar"><div class="seg" role="group" aria-label="Xem"><button data-act="fin" data-v="rev" aria-pressed="${cur === 'rev'}">Doanh thu</button>${canCash() ? `<button data-act="fin" data-v="cash" aria-pressed="${cur === 'cash'}">Thu chi</button>` : ''}<button data-act="fin" data-v="pl" aria-pressed="${cur === 'pl'}">${canCash() ? 'Cộng sổ' : 'Lãi theo tháng'}</button></div>
    ${cur === 'cash' ? `<div class="addbar" style="margin:0"><button class="btn" data-act="cash-add" data-type="in">${ic('plus')}Khoản thu</button><button class="btn primary" data-act="cash-add" data-type="out">${ic('plus')}Khoản chi</button></div>` : ''}</div>`;
}
function cashRow(e) {
  const o = e.oid ? Store.get('orders', e.oid) : null;
  const act = e.src === 'pay' ? `data-act="open-order" data-id="${e.oid}"` : `data-act="cash-edit" data-id="${e.id}"`;
  return `<button class="crow t-${e.type}" ${act}><span class="todo-ic">${ic(CASH_IC[e.cat] || (e.type === 'in' ? 'money' : 'pm'))}</span>
    <span class="crow-m"><b>${esc(e.cat)}${e.note ? ` <span class="muted" style="font-weight:400">· ${esc(e.note)}</span>` : ''}</b><small>${fmtDate(e.date)} · ${PAY_METHOD[e.method] || ''}${o && e.src !== 'pay' ? ` · ${esc(headQuote(o).customer?.name || o.code)} (${esc(o.code)})` : e.oid && !o ? ' · đơn đã xóa' : ''}</small></span>
    <span class="crow-a">${e.type === 'out' ? '−' : '+'}${money(e.amount)}</span></button>`;
}
function renderCash() {
  const [from, to] = periodRange(), list = cashList(from, to), sum = cashSum(list);
  const [pf, pt] = prevRange(from, to), prev = cashSum(cashList(pf, pt));
  const pb = (k, l) => `<button data-act="period" data-p="${k}" aria-pressed="${S.period === k}">${l}</button>`;
  const F = S.cashF || 'all', shown = list.filter(e => F === 'all' || e.type === F);
  const top = sum.cats[0];
  return `<div class="pane-in">
    <div class="list-head"><h1>Thu chi</h1><div class="hd-act"><div class="seg" role="group" aria-label="Kỳ">${pb('month', 'Tháng')}${pb('quarter', 'Quý')}${pb('year', 'Năm')}${pb('custom', 'Tùy chọn')}</div><button class="btn sm" data-act="cash-csv">${ic('dl')}Xuất Excel</button></div></div>
    ${finBar('cash')}
    ${S.period === 'custom' ? `<div class="fgrid" style="max-width:560px;margin-bottom:10px"><div class="field"><label for="st-from">Từ ngày</label>${dateField('st-from', from)}</div><div class="field"><label for="st-to">Đến ngày</label>${dateField('st-to', to)}</div></div>` : ''}
    <div class="kpis three">
      <div class="kpi hero"><span>Thu − Chi · ${fmtDate(from)} – ${fmtDate(to)}</span><b class="${sum.net < 0 ? 'bad' : ''}">${sum.net < 0 ? '−' : ''}${money(Math.abs(sum.net))} đ</b><small>${prev.in || prev.out ? `Kỳ trước: ${prev.net < 0 ? '−' : ''}${money(Math.abs(prev.net))} đ` : 'Tiền thực vào trừ tiền thực ra trong kỳ'}</small></div>
      <div class="kpi"><span>Tổng thu</span><b class="ok">${money(sum.in)}</b><small>Khách trả ${shortMoney(sum.inCust)}${sum.inOther ? ' · khác ' + shortMoney(sum.inOther) : ''}</small></div>
      <div class="kpi"><span>Tổng chi</span><b class="bad">${money(sum.out)}</b><small>${list.filter(e => e.type === 'out').length} khoản</small></div>
      <div class="kpi"><span>Chi nhiều nhất</span><b style="font-size:17px!important">${top ? esc(top.g) : '—'}</b><small>${top ? money(top.v) + ' đ · ' + pctTxt(top.v / sum.out * 100) : 'Chưa có khoản chi'}</small></div>
    </div>
    ${sum.cats.length ? `<section class="card"><div class="card-h"><h3>Chi theo nhóm</h3><span class="muted">${money(sum.out)} đ</span></div>${hbars(sum.cats.map(c => ({ label: esc(c.g), v: c.v })), sum.out)}</section>` : ''}
    <section class="card"><div class="card-h"><h3>Sổ thu chi</h3><div class="seg" role="group" aria-label="Lọc"><button data-act="cash-f" data-v="all" aria-pressed="${F === 'all'}">Tất cả</button><button data-act="cash-f" data-v="in" aria-pressed="${F === 'in'}">Thu</button><button data-act="cash-f" data-v="out" aria-pressed="${F === 'out'}">Chi</button></div></div>
      ${shown.length ? `<div class="crows">${shown.slice(0, 300).map(cashRow).join('')}</div>${shown.length > 300 ? `<p class="muted">Đang hiện 300 khoản mới nhất. Thu hẹp kỳ hoặc xuất Excel để xem đủ.</p>` : ''}` : `<div class="empty"><h3>Chưa có khoản nào trong kỳ</h3><p>Bấm “Khoản chi” để ghi tiền mua vật tư, trả thợ, vận chuyển…</p></div>`}
    </section>
    <p class="foot-note"><b>Thu</b> gồm tiền khách trả (tự lấy từ các đơn) và các khoản thu khác bạn ghi. <b>Chi</b> là các khoản bạn ghi. Khoản chi gắn với đơn sẽ hiện trong đơn đó để tính lãi thực tế.</p>
  </div>`;
}
async function cashCsv() {
  const [from, to] = periodRange(), list = [...cashList(from, to)].reverse(), sum = cashSum(list);
  const rows = [['Ngày', 'Thu / Chi', 'Nhóm', 'Nội dung', 'Mã đơn', 'Khách hàng', 'Hình thức', 'Thu (đ)', 'Chi (đ)']];
  for (const e of list) { const o = e.oid ? Store.get('orders', e.oid) : null; rows.push([fmtDate(e.date), e.type === 'out' ? 'Chi' : 'Thu', e.cat, e.note || '', o ? o.code : '', o ? headQuote(o).customer?.name || '' : '', PAY_METHOD[e.method] || '', e.type === 'in' ? e.amount : '', e.type === 'out' ? e.amount : '']); }
  rows.push([]); rows.push(['', 'TỔNG', '', `Kỳ ${fmtDate(from)} – ${fmtDate(to)}`, '', '', '', sum.in, sum.out]); rows.push(['', 'THU − CHI', '', '', '', '', '', sum.net, '']);
  const csv = '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  await saveFile(`Thu-chi-${from}-den-${to}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}

/* ---------- trong chi tiết đơn ---------- */
function orderCashHtml(o) {
  if (!canCash()) return '';
  const sp = orderSpendList(o.id), spent = sp.reduce((s, e) => s + e.amount, 0), total = orderTotal(o), paid = orderPaid(o);
  const real = total - spent;
  return sect('ocash', 'Chi phí thực tế', sp.length ? `đã chi ${money(spent)} đ · lãi thực <span class="${real < 0 ? 'negt' : 'okt'}">${money(real)} đ</span>` : 'Chưa ghi khoản chi nào', `
    ${sp.length ? `<div class="crows">${sp.map(e => cashRow({ ...e, src: 'cash' })).join('')}</div>` : `<p class="muted">Ghi tiền mua vật tư, trả thợ, vận chuyển… cho đơn này để biết lãi thật.</p>`}
    <div class="pgrid" style="margin-top:10px">
      <div><span>Giá trị đơn</span><b>${money(total)}</b></div>
      <div><span>Đã chi thực tế</span><b>${money(spent)}</b></div>
      <div class="pres ${real < 0 ? 'neg' : ''}"><span>Lãi thực tế</span><b>${money(real)}</b><small>${total ? pctTxt(real / total * 100) + ' giá trị đơn' : ''}</small></div>
      <div><span>Tiền đang giữ</span><b>${money(paid - spent)}</b><small>đã thu − đã chi</small></div>
    </div>`, { act: `<button class="btn sm" data-act="cash-add" data-type="out" data-oid="${o.id}">${ic('plus')}Chi</button>` });
}
