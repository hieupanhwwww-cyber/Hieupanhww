/* =========================================================
   CỘNG SỔ THEO THÁNG
   Sổ quỹ: tồn đầu tháng + thu − chi = tồn cuối tháng
   Lãi tháng = thu (không tính tiền góp vốn, đi vay) − chi; tỷ suất lãi = lãi / thu
   Bảng phụ: lãi theo đơn chốt = doanh thu − chi phí đơn − chi chung + thu khác
   Chốt sổ: lưu số liệu lúc chốt; sửa khoản trong tháng đã chốt phải xác nhận
   ========================================================= */
const canPL = () => canCash() || canCost();
const CAPITAL_CAT = 'Góp vốn, vay';
const ym = d => String(d || '').slice(0, 7);
const ymLabel = m => { const [y, mm] = String(m).split('-'); return `Tháng ${+mm}/${y}`; };
const ymShort = m => { const [y, mm] = String(m).split('-'); return `T${+mm}/${String(y).slice(2)}`; };
function monthsBack(n) {
  const d = new Date(), out = [];
  for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(`${x.getFullYear()}-${pad2(x.getMonth() + 1)}`); }
  return out;
}
function plMonthsRange() {
  const R = S.plR || 'last12', y = new Date().getFullYear(), cur = today().slice(0, 7);
  if (R === 'year') return Array.from({ length: 12 }, (_, i) => `${y}-${pad2(i + 1)}`).filter(m => m <= cur);
  if (R === 'prev') return Array.from({ length: 12 }, (_, i) => `${y - 1}-${pad2(i + 1)}`);
  return monthsBack(12);
}
const cashStart = () => meta().cashStart || null;
const books = () => meta().books || {};
const bookOf = date => books()[ym(date)] || null;

/* ---------- sổ quỹ theo tháng ---------- */
function ledger(months) {
  const all = cashList(null, null), st = cashStart(), sd = (st && st.date) || '';
  const valid = e => !sd || e.date >= sd;
  const sm = ym(sd), amt = Number(st && st.amount) || 0;
  /* tháng bắt đầu sổ: tháng đặt số dư, hoặc tháng có khoản đầu tiên */
  const firstData = all.filter(valid).reduce((mn, e) => (!mn || ym(e.date) < mn ? ym(e.date) : mn), '');
  const startM = sm || firstData;
  let bal = sm && sm < months[0] ? amt : 0;
  for (const e of all) if (valid(e) && ym(e.date) < months[0]) bal += e.type === 'in' ? e.amount : -e.amount;
  return months.map(m => {
    if (sm && m === sm) bal += amt;
    const before = !startM || m < startM;
    const es = all.filter(e => ym(e.date) === m && valid(e)), s = cashSum(es);
    const capital = es.filter(e => e.type === 'in' && e.cat === CAPITAL_CAT).reduce((t, e) => t + e.amount, 0);
    const income = s.in - capital, open = before ? null : bal, close = before ? null : bal + s.in - s.out; if (!before) bal = close;
    const profit = income - s.out, bk = books()[m] || null;
    return { m, before, open, in: s.in, inCust: s.inCust, inOther: s.inOther - capital, capital, income, out: s.out, profit, pct: income ? profit / income * 100 : null, close, cats: s.cats, es, n: es.length, book: bk, changed: !!bk && (bk.in !== s.in || bk.out !== s.out) };
  });
}
const balanceNow = () => { const r = ledger([today().slice(0, 7)])[0]; return r.close; };

/* ---------- lãi theo đơn chốt ---------- */
function orderCostInfo(o) {
  const spent = canCash() ? orderSpend(o.id) : 0;
  if (spent > 0) return { cost: spent, kind: 'real' };
  if (canCost()) { const p = profitOf(o, headQuote(o)); if (p.cost > 0) return { cost: p.cost, kind: 'est' }; }
  return { cost: 0, kind: 'none' };
}
function accrual(months) {
  const M = Object.fromEntries(months.map(m => [m, { m, rev: 0, ocost: 0, gen: 0, oin: 0, est: 0, none: 0, orders: [], gens: [] }]));
  for (const o of Store.list('orders')) {
    /* doanh thu theo cùng quy tắc với màn Doanh thu (valueEvents): giá trị bản chốt đầu vào tháng chốt,
       phần sửa giá (chốt bản sau) và phát sinh vào tháng xảy ra. Chi phí của đơn tính ở tháng chốt đơn. */
    if (!isClosed(o) || !o.closedAt) continue;
    const per = {};
    for (const e of valueEvents(o)) { const k = ym(e.date); if (M[k]) per[k] = (per[k] || 0) + e.amount; }
    const cm = ym(o.closedAt);
    for (const [k, v] of Object.entries(per)) {
      const r = M[k]; r.rev += v;
      if (k === cm) { const ci = orderCostInfo(o); r.ocost += ci.cost; if (ci.kind === 'est') r.est++; if (ci.kind === 'none') r.none++; r.orders.push({ o, ci, v }); }
      else r.orders.push({ o, ci: null, v, adj: true });
    }
    if (!per[cm] && M[cm]) { const ci = orderCostInfo(o); M[cm].ocost += ci.cost; if (ci.kind === 'est') M[cm].est++; if (ci.kind === 'none') M[cm].none++; M[cm].orders.push({ o, ci, v: 0 }); }
  }
  if (canCash()) for (const e of Store.list('cash')) {
    const r = M[ym(e.date)]; if (!r) continue;
    if (e.type === 'in') { if (e.cat !== CAPITAL_CAT) r.oin += e.amount; continue; }
    const o = e.oid && Store.get('orders', e.oid);
    if (!o || !isClosed(o)) { r.gen += e.amount; r.gens.push(e); }
  }
  return months.map(m => { const r = M[m]; r.profit = r.rev + r.oin - r.ocost - r.gen; r.pct = r.rev ? r.profit / r.rev * 100 : null; return r; });
}

/* ---------- giao diện ---------- */
const sgn = v => (v < 0 ? '−' : '') + money(Math.abs(v));
function ledgerChart(rows) {
  const W = 720, H = 240, L = 56, Rr = 12, T = 18, B = 34, cw = W - L - Rr, ch = H - T - B;
  const max = niceMax(Math.max(1, ...rows.map(r => Math.max(r.income, r.out))));
  const bw = cw / rows.length, barW = Math.min(18, bw * 0.3);
  let g = '';
  for (let i = 0; i <= 4; i++) { const yv = T + ch - ch * i / 4; g += `<line class="grid" x1="${L}" x2="${W - Rr}" y1="${yv}" y2="${yv}"/><text x="${L - 8}" y="${yv + 4}" text-anchor="end">${i ? shortMoney(max * i / 4) : '0'}</text>`; }
  rows.forEach((r, i) => {
    const x0 = L + bw * i + bw / 2, bar = (v, x, cls) => { const h = Math.max(0, v) / max * ch; return `<rect class="bar ${cls}" x="${x}" y="${T + ch - h}" width="${barW}" height="${Math.max(h, v ? 2 : 0)}" rx="3"/>`; };
    g += bar(r.income, x0 - barW - 1, 'cash') + bar(r.out, x0 + 1, 'spend');
    if (r.income || r.out) g += `<text class="val ${r.profit < 0 ? 'neg' : 'pos'}" x="${x0}" y="${T + ch - Math.max(r.income, r.out) / max * ch - 6}" text-anchor="middle">${r.profit < 0 ? '−' : ''}${shortMoney(Math.abs(r.profit))}</text>`;
    if (rows.length <= 12 || i % 2 === 0) g += `<text x="${x0}" y="${H - 12}" text-anchor="middle">${ymShort(r.m)}</text>`;
    g += `<rect class="bar-hit" data-act="pl-month" data-m="${r.m}" x="${L + bw * i}" y="${T}" width="${bw}" height="${ch + 20}"><title>${ymLabel(r.m)}: thu ${moneyD(r.income)}, chi ${moneyD(r.out)}, lãi ${sgn(r.profit)} đ</title></rect>`;
  });
  return `<div class="legend"><span><i class="lg cash"></i>Thu</span><span><i class="lg spend"></i>Chi</span><span>Số trên cột = lãi (thu − chi)</span></div><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Thu, chi và lãi theo tháng">${g}</svg>`;
}
function bookCell(r) {
  const cur = today().slice(0, 7);
  if (r.before) return '';
  if (r.book) return r.changed ? `<span class="pill s-bad" title="Số liệu đã khác lúc chốt">Đổi sau chốt</span>` : `<span class="pill s-done">Đã chốt</span>`;
  if (r.m >= cur) return `<span class="pill s-later">Đang mở</span>`;
  return can('backup') ? `<button class="btn sm" data-act="pl-close" data-m="${r.m}">Chốt sổ</button>` : '<span class="muted">Chưa chốt</span>';
}
function renderPL() {
  const months = plMonthsRange(), R = S.plR || 'last12';
  const rb = (k, l) => `<button data-act="pl-r" data-v="${k}" aria-pressed="${R === k}">${l}</button>`;
  const rangeTxt = `${ymLabel(months[0])} – ${ymLabel(months[months.length - 1])}`;
  const L = canCash() ? ledger(months) : null, A = accrual(months);
  let body = '';
  if (L) {
    const tIn = L.reduce((s, r) => s + r.income, 0), tOut = L.reduce((s, r) => s + r.out, 0), tP = tIn - tOut;
    const cur = L[L.length - 1], best = [...L].filter(r => r.income || r.out).sort((a, b) => b.profit - a.profit)[0], st = cashStart();
    body += `<div class="kpis">
      <div class="kpi hero"><span>Tồn quỹ cuối ${ymLabel(cur.m).toLowerCase()}</span><b class="${cur.close < 0 ? 'bad' : ''}">${sgn(cur.close ?? 0)} đ</b><small>${st ? `Tính từ số dư ${money(st.amount)} đ ngày ${fmtDate(st.date)}` : 'Chưa đặt số dư quỹ ban đầu'} · <button class="linkbtn" data-act="pl-start">${st ? 'Sửa' : 'Đặt số dư ban đầu'}</button></small></div>
      <div class="kpi"><span>Lãi ${R === 'last12' ? '12 tháng' : 'cả kỳ'}</span><b class="${tP < 0 ? 'bad' : 'ok'}">${sgn(tP)}</b><small>${tIn ? 'Tỷ suất ' + pctTxt(tP / tIn * 100) : 'Chưa có thu'}</small></div>
      <div class="kpi"><span>Tổng thu</span><b class="ok">${money(tIn)}</b><small>không tính góp vốn, vay</small></div>
      <div class="kpi"><span>Tổng chi</span><b class="bad">${money(tOut)}</b><small>${best ? 'Lãi cao nhất: ' + ymShort(best.m) : ''}</small></div>
    </div>
    <section class="card"><div class="card-h"><h3>Thu, chi, lãi từng tháng</h3><span class="muted" style="font-size:13px">Chạm cột để xem sổ tháng</span></div>${ledgerChart(L)}</section>
    <section class="card"><div class="card-h"><h3>Cộng sổ</h3><span class="muted" style="font-size:13px">${rangeTxt}</span></div>
      <div class="scrollx"><table class="lockq ledger"><thead><tr><th>Tháng</th><th class="r">Tồn đầu</th><th class="r">Thu</th><th class="r">Chi</th><th class="r">Lãi</th><th class="r">Tỷ suất</th><th class="r">Tồn cuối</th><th></th></tr></thead><tbody>
      ${[...L].filter(r => !r.before).reverse().map(r => `<tr data-act="pl-month" data-m="${r.m}"><td><button class="linkbtn rowlink" data-act="pl-month" data-m="${r.m}">${ymShort(r.m)}</button>${r.n ? `<span class="sub">${r.n} khoản</span>` : ''}</td><td class="r">${sgn(r.open)}</td><td class="r okt">${money(r.income)}${r.capital ? `<span class="sub">+ vốn ${shortMoney(r.capital)}</span>` : ''}</td><td class="r negt">${money(r.out)}</td><td class="r"><b class="${r.profit < 0 ? 'negt' : ''}">${sgn(r.profit)}</b></td><td class="r">${r.pct == null ? '–' : pctTxt(r.pct)}</td><td class="r"><b>${sgn(r.close)}</b></td><td class="r">${bookCell(r)}</td></tr>`).join('')}
      ${L.every(r => r.before) ? `<tr><td colspan="8" class="muted">Chưa có khoản thu chi nào trong khoảng này.</td></tr>` : ''}
      <tr class="tot"><td><b>Cộng</b></td><td class="r">${sgn((L.find(r => !r.before) || { open: 0 }).open)}</td><td class="r okt"><b>${money(tIn)}</b></td><td class="r negt"><b>${money(tOut)}</b></td><td class="r"><b class="${tP < 0 ? 'negt' : ''}">${sgn(tP)}</b></td><td class="r"><b>${tIn ? pctTxt(tP / tIn * 100) : '–'}</b></td><td class="r"><b>${sgn(cur.close ?? 0)}</b></td><td></td></tr>
      </tbody></table></div></section>`;
  }
  const aT = A.reduce((s, r) => ({ rev: s.rev + r.rev, cost: s.cost + r.ocost + r.gen - r.oin, p: s.p + r.profit, est: s.est + r.est, none: s.none + r.none }), { rev: 0, cost: 0, p: 0, est: 0, none: 0 });
  const accHtml = `${aT.none ? `<div class="notice warn" style="margin-bottom:10px">${ic('info')}<div>${aT.none} đơn chốt chưa có chi phí (chưa ghi khoản chi, chưa nhập giá nhập), lãi của các tháng đó đang cao hơn thực tế.</div></div>` : ''}
    <div class="scrollx"><table class="lockq ledger"><thead><tr><th>Tháng</th><th class="r">Giá trị đơn chốt</th><th class="r">Chi phí đơn</th><th class="r">Chi chung</th><th class="r">Thu khác</th><th class="r">Lãi</th><th class="r">Tỷ suất</th></tr></thead><tbody>
    ${[...A].reverse().map(r => `<tr data-act="pl-month" data-m="${r.m}"><td><button class="linkbtn rowlink" data-act="pl-month" data-m="${r.m}">${ymShort(r.m)}</button><span class="sub">${r.orders.filter(x => !x.adj).length} đơn chốt</span></td><td class="r">${money(r.rev)}</td><td class="r">${r.est ? '≈ ' : ''}${money(r.ocost)}${r.none ? `<span class="sub warnt">${r.none} đơn chưa có chi phí</span>` : ''}</td><td class="r">${money(r.gen)}</td><td class="r">${money(r.oin)}</td><td class="r"><b class="${r.profit < 0 ? 'negt' : ''}">${sgn(r.profit)}</b></td><td class="r">${r.pct == null ? '–' : pctTxt(r.pct)}</td></tr>`).join('')}
    <tr class="tot"><td><b>Cộng</b></td><td class="r"><b>${money(aT.rev)}</b></td><td colspan="3" class="r">chi phí ${money(aT.cost)}</td><td class="r"><b class="${aT.p < 0 ? 'negt' : ''}">${sgn(aT.p)}</b></td><td class="r"><b>${aT.rev ? pctTxt(aT.p / aT.rev * 100) : '–'}</b></td></tr>
    </tbody></table></div>
    <p class="muted" style="font-size:13px;margin-top:8px">Giá trị đơn (gồm phát sinh đã xác nhận) tính vào tháng chốt đơn. Chi phí đơn = khoản chi đã ghi cho đơn; chưa ghi thì lấy giá nhập + vận chuyển (đánh dấu ≈). Chi chung = khoản chi không gắn đơn.</p>`;
  body += L ? sect('pl-acc', 'Lãi theo đơn chốt', `${sgn(aT.p)} đ · ${aT.rev ? pctTxt(aT.p / aT.rev * 100) : '–'}`, accHtml) : `<section class="card"><div class="card-h"><h3>Lãi theo đơn chốt</h3></div>${accHtml}</section>`;
  return `<div class="pane-in">
    <div class="list-head"><h1>${L ? 'Cộng sổ' : 'Lãi theo tháng'}</h1><div class="hd-act"><div class="seg" role="group" aria-label="Khoảng">${rb('last12', '12 tháng gần đây')}${rb('year', 'Năm nay')}${rb('prev', 'Năm trước')}</div><button class="btn sm" data-act="pl-csv">${ic('dl')}Xuất Excel</button></div></div>
    ${finBar('pl')}
    ${body}
    <p class="foot-note">${L ? '<b>Cộng sổ</b>: tồn đầu tháng + thu − chi = tồn cuối tháng. <b>Lãi tháng</b> = thu (tiền khách trả và thu khác, không tính góp vốn, đi vay) − chi. <b>Tỷ suất</b> = lãi ÷ thu. ' : ''}Chạm một tháng để xem chi tiết${L && can('backup') ? ' và chốt sổ' : ''}.</p>
  </div>`;
}
function plMonthSheet(m) {
  let L = canCash() ? ledger([m])[0] : null;
  if (L && L.before) L = null;
  const A = accrual([m])[0];
  const line = (l, v, cls = '') => `<div class="lline ${cls}"><span>${l}</span><b>${v}</b></div>`;
  let html = '';
  if (L) {
    html += `<div class="ledger-box">${line('Tồn đầu tháng', sgn(L.open) + ' đ')}
      ${line('+ Tiền khách trả', money(L.inCust) + ' đ', 'okt')}${L.inOther ? line('+ Thu khác', money(L.inOther) + ' đ', 'okt') : ''}${L.capital ? line('+ Góp vốn, vay (không tính lãi)', money(L.capital) + ' đ', 'okt') : ''}
      ${L.cats.map(c => line('− ' + esc(c.g), money(c.v) + ' đ', 'negt')).join('')}
      ${line('= Tồn cuối tháng', sgn(L.close) + ' đ', 'sum')}
      ${line('Lãi tháng (thu − chi)', sgn(L.profit) + ' đ' + (L.pct == null ? '' : ' · ' + pctTxt(L.pct)), 'sum ' + (L.profit < 0 ? 'negt' : 'okt'))}</div>
      ${L.book ? `<p class="${L.changed ? 'warnt' : 'muted'}" style="font-size:13px">Đã chốt sổ lúc ${fmtDateTime(new Date(L.book.at))}${L.book.by ? ' bởi ' + esc(L.book.by) : ''}: thu ${money(L.book.in)}, chi ${money(L.book.out)}.${L.changed ? ' Số liệu đã thay đổi sau khi chốt.' : ''}</p>` : ''}`;
  }
  html += `<h4 class="sh4">Lãi theo đơn chốt trong tháng</h4>${A.orders.length ? `<div class="pick-list">${A.orders.map(({ o, ci, v, adj }) => { const p = v - (ci ? ci.cost : 0); return `<button class="pick" data-sa="go" data-id="${o.id}"><div class="pm"><b>${esc(headQuote(o).customer?.name || o.code)} <span class="muted" style="font-weight:400">· ${esc(o.code)}</span></b><span>${adj ? `Sửa giá, phát sinh trong tháng ${signed(v)} · chi phí tính ở tháng chốt đơn` : `Giá trị ${money(v)} · chi phí ${ci.kind === 'est' ? '≈ ' + money(ci.cost) + ' (giá nhập)' : ci.kind === 'real' ? money(ci.cost) + ' (đã chi)' : '<span class="warnt">chưa có</span>'}`}</span></div><div class="pp ${p < 0 ? 'negt' : ''}">${sgn(p)}</div></button>`; }).join('')}</div>` : '<p class="muted">Không có đơn chốt trong tháng.</p>'}
    ${A.gen ? `<div class="sumline"><span>Chi chung trong tháng</span><span class="num">−${money(A.gen)} đ</span></div>` : ''}
    ${A.oin ? `<div class="sumline"><span>Thu khác</span><span class="num">+${money(A.oin)} đ</span></div>` : ''}
    <div class="sumline"><span><b>Lãi theo đơn chốt</b></span><span class="num"><b class="${A.profit < 0 ? 'negt' : ''}">${sgn(A.profit)} đ${A.pct == null ? '' : ' · ' + pctTxt(A.pct)}</b></span></div>
    ${L && L.es.length ? `<h4 class="sh4">Các khoản trong sổ (${L.es.length})</h4><div class="crows">${L.es.slice(0, 100).map(cashRow).join('')}</div>` : ''}`;
  const cur = today().slice(0, 7), canBook = L && can('backup') && m < cur;
  const el = openSheet({
    title: 'Sổ ' + ymLabel(m).toLowerCase(), cls: 'wide', html,
    foot: `${canBook ? (L.book ? `<button class="btn" data-sa="reopen">Mở lại sổ</button>` : `<button class="btn primary" data-sa="close-book">${ic('lock')}Chốt sổ ${ymShort(m)}</button>`) : ''}<button class="btn" data-sa="close">Đóng</button>`,
    onClick: async (a, b, el2) => {
      if (a === 'go') { closeSheet(el2); openOrder(b.dataset.id); return; }
      if (a === 'close-book') { closeSheet(el2); closeBook(m); return; }
      if (a === 'reopen') {
        const ok = await confirmBox({ title: `Mở lại sổ ${ymShort(m)}?`, text: 'Số liệu lúc chốt sẽ bị bỏ. Sau khi sửa xong, bạn chốt lại.', ok: 'Mở lại sổ' });
        if (!ok) return; const bs = { ...books() }; delete bs[m]; saveMeta({ books: bs }); closeSheet(el2); render(); toast('Đã mở lại sổ ' + ymShort(m));
      }
    },
  });
  return el;
}
function closeBook(m) {
  const r = ledger([m])[0]; if (!r) return;
  saveMeta({ books: { ...books(), [m]: { at: new Date().toISOString(), by: Team.on() ? Team.myName() : '', in: r.in, out: r.out, close: r.close, profit: r.profit } } });
  render(); toast(`Đã chốt sổ ${ymShort(m)}: lãi ${sgn(r.profit)} đ, tồn cuối ${sgn(r.close)} đ`);
}
/* sửa khoản trong tháng đã chốt sổ: hỏi trước */
async function okToEditDate(...dates) {
  const m = dates.map(ym).find(x => books()[x]); if (!m) return true;
  return confirmBox({ title: `${ymLabel(m)} đã chốt sổ`, text: 'Thêm, sửa hoặc xóa khoản trong tháng đã chốt sẽ làm số liệu khác lúc chốt. App sẽ đánh dấu tháng đó “Đổi sau chốt” để bạn kiểm tra và chốt lại.', ok: 'Vẫn làm' });
}
function cashStartSheet() {
  const st = cashStart() || { date: plMonthsRange()[0] + '-01', amount: 0 };
  const el = openSheet({
    title: 'Số dư quỹ ban đầu',
    html: `<p class="muted">Tiền đang có (tiền mặt + tài khoản) tại một ngày. Sổ sẽ cộng dồn thu, chi từ ngày đó. Các khoản trước ngày này không tính vào tồn quỹ.</p>
      <div class="fgrid"><div class="field"><label for="cs0-date">Ngày</label>${dateField('cs0-date', st.date)}</div><div class="field"><label for="cs0-amt">Số dư</label>${moneyInput('cs0-amt', st.amount, 'placeholder="0"')}</div></div>`,
    foot: `${cashStart() ? `<button class="btn danger" data-sa="clear" style="margin-right:auto">Bỏ số dư</button>` : ''}<button class="btn" data-sa="close">Hủy</button><button class="btn primary" data-sa="ok">Lưu</button>`,
    onClick: (a, b, el2) => {
      if (a === 'clear') { saveMeta({ cashStart: null }); closeSheet(el2); render(); return; }
      if (a !== 'ok') return;
      saveMeta({ cashStart: { date: el2.querySelector('#cs0-date').value || today(), amount: parseMoney(el2.querySelector('#cs0-amt').value) } });
      closeSheet(el2); render(); toast('Đã lưu số dư quỹ ban đầu');
    },
  });
  return el;
}
async function plCsv() {
  const months = plMonthsRange(), L = canCash() ? ledger(months) : null, A = accrual(months);
  const rows = [];
  if (L) {
    rows.push(['CỘNG SỔ THEO THÁNG']); rows.push(['Tháng', 'Tồn đầu (đ)', 'Tiền khách trả (đ)', 'Thu khác (đ)', 'Góp vốn, vay (đ)', 'Tổng chi (đ)', 'Lãi = thu − chi (đ)', 'Tỷ suất lãi (%)', 'Tồn cuối (đ)', 'Chốt sổ']);
    for (const r of L.filter(x => !x.before)) rows.push([ymLabel(r.m), r.open, r.inCust, r.inOther, r.capital, r.out, r.profit, r.pct == null ? '' : Math.round(r.pct * 10) / 10, r.close, r.book ? (r.changed ? 'Đổi sau chốt' : 'Đã chốt ' + fmtDate(dstr(new Date(r.book.at)))) : '']);
    const tIn = L.reduce((s, r) => s + r.income, 0), tOut = L.reduce((s, r) => s + r.out, 0);
    rows.push(['CỘNG', (L.find(x => !x.before) || { open: 0 }).open, L.reduce((s, r) => s + r.inCust, 0), L.reduce((s, r) => s + r.inOther, 0), L.reduce((s, r) => s + r.capital, 0), tOut, tIn - tOut, tIn ? Math.round((tIn - tOut) / tIn * 1000) / 10 : '', L[L.length - 1].close ?? 0, '']);
    rows.push([]);
    rows.push(['CHI THEO NHÓM']); const cats = new Map(); for (const r of L) for (const c of r.cats) cats.set(c.g, (cats.get(c.g) || 0) + c.v);
    for (const [g, v] of [...cats].sort((a, b) => b[1] - a[1])) rows.push([g, v]);
    rows.push([]);
  }
  rows.push(['LÃI THEO ĐƠN CHỐT']); rows.push(['Tháng', 'Giá trị đơn chốt (đ)', 'Chi phí đơn (đ)', 'Chi chung (đ)', 'Thu khác (đ)', 'Lãi (đ)', 'Tỷ suất (%)', 'Ghi chú']);
  for (const r of A) rows.push([ymLabel(r.m), r.rev, r.ocost, r.gen, r.oin, r.profit, r.pct == null ? '' : Math.round(r.pct * 10) / 10, [r.est ? `${r.est} đơn dùng giá nhập ước tính` : '', r.none ? `${r.none} đơn chưa có chi phí` : ''].filter(Boolean).join('; ')]);
  const csv = '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
  await saveFile(`Cong-so-${months[0]}-den-${months[months.length - 1]}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}
