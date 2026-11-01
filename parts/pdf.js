/* =========================================================
   BÁO GIÁ A4: vẽ trang lên canvas (chuẩn tiếng Việt) → JPEG → PDF
   ========================================================= */
const PG = { W: 210, H: 297, ML: 14, MR: 14, MT: 14, BOTTOM: 274, FOOT: 287 };
const PXW = 1654, PX = PXW / 210, PXH = Math.round(297 * PX);
const PFONT = '"Be Vietnam Pro","Helvetica Neue",Arial,sans-serif';
const PC = { ok: '#2E7D4F', ink: '#2A2119', muted: '#6F6255', brown: '#7A4E2D', soft: '#F3EADF', line: '#E2D7C9', line2: '#C9B9A6' };
const pfont = (w, pt) => `${w} ${(pt * 0.3528 * PX).toFixed(2)}px ${PFONT}`;
const lhmm = pt => pt * 0.3528 * 1.42;
const asc = pt => pt * 0.3528 * 1.02;
let _mctx = null;
const mctx = () => (_mctx ||= document.createElement('canvas').getContext('2d'));
function textW(s, w, pt) { const c = mctx(); c.font = pfont(w, pt); return c.measureText(String(s)).width / PX; }
function wrapMM(text, w, pt, maxMM) {
  const c = mctx(); c.font = pfont(w, pt);
  const maxPx = maxMM * PX, out = [];
  for (const para of String(text ?? '').split(/\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (c.measureText(test).width <= maxPx) { line = test; continue; }
      if (line) out.push(line);
      if (c.measureText(word).width <= maxPx) { line = word; continue; }
      let part = '';
      for (const ch of word) { if (c.measureText(part + ch).width > maxPx && part) { out.push(part); part = ch; } else part += ch; }
      line = part;
    }
    out.push(line);
  }
  while (out.length > 1 && out[out.length - 1] === '') out.pop();
  return out;
}
let fontsReady = null;
function ensureFonts() {
  if (!fontsReady) {
    fontsReady = Promise.race([
      Promise.all(['400', '500', '600', '700'].map(w => document.fonts ? document.fonts.load(`${w} 20px "Be Vietnam Pro"`, 'Báo giá Ậ') : null)),
      sleep(3000),
    ]).catch(() => null);
  }
  return fontsReady;
}
function loadImg(src) {
  return new Promise(res => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}

function layoutQuote(d) {
  const { q, st, code, label, logo, sign, signImg, qr, pay, plan: planIn } = d;
  const t = quoteTotals(q);
  const R = PG.W - PG.MR, CW = PG.W - PG.ML - PG.MR;
  const pages = []; let ops, y;
  const text = (x, yb, s, w, pt, color, align = 'left') => ops.push({ t: 'text', x, y: yb, s: String(s ?? ''), w, pt, color, align });
  const rect = (x, yy, w, h, color) => ops.push({ t: 'rect', x, y: yy, w, h, color });
  const line = (x1, y1, x2, y2, color, wd) => ops.push({ t: 'line', x1, y1, x2, y2, color, wd });
  const custName = q.customer?.name || '';
  const newPage = first => {
    ops = []; pages.push(ops); y = PG.MT;
    if (!first) {
      text(PG.ML, y + 4, st.shopName, 700, 9.5, PC.brown);
      text(R, y + 4, `Báo giá ${code}${label ? ' · ' + label : ''}${custName ? ' · ' + custName : ''}`, 400, 8.5, PC.muted, 'right');
      line(PG.ML, y + 7, R, y + 7, PC.line2, 0.3);
      y += 12;
    }
  };
  newPage(true);

  /* --- đầu trang --- */
  const top = y; let lx = PG.ML, logoBottom = top;
  if (logo) {
    const r = logo.width / logo.height; let h = 20, w = h * r;
    if (w > 44) { w = 44; h = w / r; }
    ops.push({ t: 'img', img: logo, x: PG.ML, y: top, w, h });
    lx += w + 5; logoBottom = top + h;
  }
  const rightW = 62, leftMax = R - rightW - lx - 4;
  let ly = top + asc(15);
  for (const l of wrapMM(st.shopName, 700, 15, leftMax)) { text(lx, ly, l, 700, 15, PC.brown); ly += lhmm(15); }
  ly += 0.6;
  const info = [st.tagline, st.address, st.phone ? 'ĐT: ' + st.phone : '', st.email].filter(Boolean);
  for (const s of info) for (const l of wrapMM(s, 400, 8.5, leftMax)) { text(lx, ly, l, 400, 8.5, PC.muted); ly += lhmm(8.5); }
  text(R, top + asc(21), 'BÁO GIÁ', 700, 21, PC.ink, 'right');
  let ry = top + asc(21) + 6.5;
  text(R, ry, 'Số: ' + code, 600, 9.5, PC.ink, 'right'); ry += lhmm(9.5);
  text(R, ry, 'Ngày lập: ' + fmtDate(q.date), 400, 9.5, PC.muted, 'right'); ry += lhmm(9.5);
  if (label) { text(R, ry, label, 400, 9.5, PC.muted, 'right'); ry += lhmm(9.5); }
  y = Math.max(ly, ry, logoBottom + 2) + 1.5;
  line(PG.ML, y, R, y, PC.brown, 0.6); y += 6.5;

  /* --- thông tin khách --- */
  const colW = CW / 2 - 4;
  const col = (x, items) => {
    let yy = y;
    for (const [lab, val, bold] of items) {
      if (!val) continue;
      text(x, yy + asc(8), lab.toUpperCase(), 600, 7.5, PC.muted); yy += lhmm(8);
      for (const l of wrapMM(val, bold ? 600 : 400, 10.5, colW)) { text(x, yy + asc(10.5), l, bold ? 700 : 400, 10.5, PC.ink); yy += lhmm(10.5); }
      yy += 1.8;
    }
    return yy;
  };
  const yL = col(PG.ML, [['Khách hàng', custName || '—', true], ['Điện thoại', q.customer?.phone]]);
  const yR = col(PG.ML + CW / 2 + 4, [['Công trình', q.project, true], ['Địa chỉ', q.customer?.address]]);
  y = Math.max(yL, yR) + 2;

  /* --- bảng hạng mục --- */
  const cols = [
    { k: 'no', w: 9, h: 'STT', a: 'center' },
    { k: 'item', w: 0, h: 'Hạng mục / Quy cách', a: 'left' },
    { k: 'unit', w: 13, h: 'ĐVT', a: 'center' },
    { k: 'qty', w: 18, h: 'K.lượng', a: 'right' },
    { k: 'price', w: 27, h: 'Đơn giá', a: 'right' },
    { k: 'amt', w: 30, h: 'Thành tiền', a: 'right' },
  ];
  cols[1].w = CW - cols.reduce((s, c) => s + c.w, 0);
  let cx = PG.ML; for (const c of cols) { c.x = cx; cx += c.w; }
  const cellX = (c) => c.a === 'right' ? c.x + c.w - 1.8 : c.a === 'center' ? c.x + c.w / 2 : c.x + 1.8;
  const head = () => {
    rect(PG.ML, y, CW, 8.5, PC.soft);
    for (const c of cols) text(cellX(c), y + 5.6, c.h.toUpperCase(), 600, 7.5, PC.brown, c.a);
    y += 8.5;
  };
  head();
  const rows = (q.rows || []).filter(r => (r.name || '').trim() || rowAmount(r));
  if (!rows.length) { text(PG.ML + 2, y + 7, 'Chưa có hạng mục.', 400, 10, PC.muted); y += 11; }
  rows.forEach((r, i) => {
    const iw = cols[1].w - 3.6;
    const nl = wrapMM(r.name || '', 600, 10, iw);
    const ml = r.material ? wrapMM(r.material, 400, 9, iw) : [];
    const dt = r.dims ? dimText(r.unit, r.dims) : '';
    const dl = dt ? wrapMM('KT: ' + dt, 400, 8.5, iw) : [];
    const h = 2.4 + nl.length * lhmm(10) + ml.length * lhmm(9) + dl.length * lhmm(8.5) + 2;
    if (y + h > PG.BOTTOM) { newPage(false); head(); }
    const b0 = y + 2.4 + asc(10);
    text(cellX(cols[0]), b0, i + 1, 400, 9.5, PC.muted, 'center');
    let yy = y + 2.4;
    for (const l of nl) { text(cellX(cols[1]), yy + asc(10), l, 600, 10, PC.ink); yy += lhmm(10); }
    for (const l of ml) { text(cellX(cols[1]), yy + asc(9), l, 400, 9, PC.muted); yy += lhmm(9); }
    for (const l of dl) { text(cellX(cols[1]), yy + asc(8.5), l, 400, 8.5, PC.muted); yy += lhmm(8.5); }
    text(cellX(cols[2]), b0, r.unit, 400, 9.5, PC.ink, 'center');
    text(cellX(cols[3]), b0, fmtQty(r.qty), 400, 9.5, PC.ink, 'right');
    text(cellX(cols[4]), b0, money(r.price), 400, 9.5, PC.ink, 'right');
    text(cellX(cols[5]), b0, money(rowAmount(r)), 600, 9.5, PC.ink, 'right');
    y += h;
    line(PG.ML, y, R, y, PC.line, 0.25);
  });

  /* --- tổng tiền --- */
  const tl = [['Tạm tính', money(t.sub) + ' đ', 400, 10]];
  if (t.disc) tl.push([q.discount?.type === 'percent' ? `Giảm giá (${QF.format(q.discount.value)}%)` : 'Giảm giá', '−' + money(t.disc) + ' đ', 400, 10]);
  /* đã đặt cọc / đã thanh toán: trừ ra để khách thấy số còn phải trả */
  const after = [];
  if (pay && (pay.paid > 0 || pay.chg)) {
    if (pay.chg) after.push([pay.chg > 0 ? 'Phát sinh đã xác nhận' : 'Giảm trừ phát sinh', (pay.chg > 0 ? '+' : '−') + money(Math.abs(pay.chg)) + ' đ', 400, 10, PC.ink]);
    const ps = pay.pays;
    if (ps.length <= 4) for (const x of ps) after.push([(/cọc/i.test(x.note || '') || (ps.length === 1 && x === ps[0]) ? 'Đã đặt cọc' : 'Đã thanh toán') + ' ngày ' + fmtDate(x.date), '−' + money(x.amount) + ' đ', 400, 10, PC.ok]);
    else after.push([`Đã thanh toán (${ps.length} lần)`, '−' + money(pay.paid) + ' đ', 400, 10, PC.ok]);
  }
  const showDue = after.length > 0 && pay.paid > 0;
  const wordsL = wrapMM('Bằng chữ: ' + moneyWords(t.total), 400, 9.5, CW);
  const dueWordsL = showDue ? wrapMM('Còn phải thanh toán bằng chữ: ' + moneyWords(pay.due), 400, 9.5, CW) : [];
  const totH = 4 + tl.length * 7 + 11 + after.length * 7 + (after.length ? 13.5 : 0) + (wordsL.length + dueWordsL.length) * lhmm(9.5) + 3;
  if (y + totH > PG.BOTTOM) newPage(false);
  y += 4;
  const tx = PG.ML + CW - 86;
  for (const [a, b, w, pt] of tl) { text(tx, y + 4.6, a, w, pt, PC.muted); text(R - 1.8, y + 4.6, b, 500, pt, PC.ink, 'right'); y += 7; }
  rect(tx - 2, y + 0.8, R - tx + 2, 10, PC.soft);
  text(tx, y + 7.6, 'TỔNG CỘNG', 700, 11, PC.brown);
  text(R - 1.8, y + 7.8, money(t.total) + ' đ', 700, 14, PC.brown, 'right');
  y += 13.5;
  if (after.length) {
    for (const [a, b, w, pt, col] of after) { text(tx, y + 4.6, a, w, pt, PC.muted); text(R - 1.8, y + 4.6, b, 600, pt, col, 'right'); y += 7; }
    rect(tx - 2, y + 0.8, R - tx + 2, 10, PC.soft);
    text(tx, y + 7.6, pay.over ? 'KHÁCH TRẢ THỪA' : 'CÒN PHẢI THANH TOÁN', 700, 10.5, PC.brown);
    text(R - 1.8, y + 7.8, money(pay.over || pay.due) + ' đ', 700, 14, PC.brown, 'right');
    y += 13.5;
  }
  for (const l of wordsL) { text(PG.ML, y + asc(9.5), l, 500, 9.5, PC.ink); y += lhmm(9.5); }
  for (const l of dueWordsL) { text(PG.ML, y + asc(9.5), l, 500, 9.5, PC.ink); y += lhmm(9.5); }
  y += 3;

  /* --- ghi chú, điều khoản, chuyển khoản --- */
  const para = (title, body) => {
    if (!String(body || '').trim()) return;
    const lines = wrapMM(body, 400, 9.5, CW);
    if (y + 6 + lhmm(9.5) * Math.min(2, lines.length) > PG.BOTTOM) newPage(false);
    y += 2;
    text(PG.ML, y + asc(8), title.toUpperCase(), 700, 8, PC.brown); y += lhmm(8) + 0.6;
    for (const l of lines) { if (y + lhmm(9.5) > PG.BOTTOM) newPage(false); text(PG.ML, y + asc(9.5), l, 400, 9.5, PC.ink); y += lhmm(9.5); }
    y += 1.5;
  };
  /* --- lịch thanh toán + mã QR đợt 1 --- */
  const plan = pay && pay.plan ? pay.plan : planIn || planAmounts(quotePlan(q), t.total);
  if (plan.length) {
    const qrW = qr ? 34 : 0, tw = CW - (qr ? qrW + 6 : 0);
    const planH = 6 + 7 + plan.length * 6.4 + 2;
    const blockH = Math.max(planH, qr ? qrW + 20 : 0);
    if (y + blockH > PG.BOTTOM) newPage(false);
    y += 2;
    text(PG.ML, y + asc(8), 'LỊCH THANH TOÁN', 700, 8, PC.brown); y += lhmm(8) + 1;
    const top0 = y;
    const pc = [{ w: 14, h: 'Đợt', a: 'left' }, { w: tw - 14 - 18 - 30, h: 'Nội dung', a: 'left' }, { w: 18, h: 'Tỷ lệ', a: 'right' }, { w: 30, h: 'Số tiền', a: 'right' }];
    let px = PG.ML; for (const c of pc) { c.x = px; px += c.w; }
    const cx2 = c => c.a === 'right' ? c.x + c.w - 1.8 : c.x + 1.8;
    rect(PG.ML, y, tw, 7, PC.soft);
    pc.forEach(c => text(cx2(c), y + 4.8, c.h.toUpperCase(), 600, 7.5, PC.brown, c.a));
    y += 7;
    for (const r of plan) {
      text(cx2(pc[0]), y + 4.4, 'Đợt ' + r.n, 600, 9, PC.ink);
      const lab = wrapMM(r.label || '', 400, 9, pc[1].w - 3.6)[0] || '';
      text(cx2(pc[1]), y + 4.4, lab, 400, 9, PC.ink);
      const done = r.paid > 0 && r.left <= 0, part = r.paid > 0 && r.left > 0;
      const pct = done ? 'Đã thu' : part ? 'Còn ' + money(r.left) : r.last ? 'Còn lại' : r.fixed ? '–' : QF.format(Number(r.pct) || 0) + '%';
      text(cx2(pc[2]), y + 4.4, pct, done ? 600 : 400, part ? 8 : 9, done ? PC.ok : PC.muted, 'right');
      text(cx2(pc[3]), y + 4.4, money(r.amount) + ' đ', 600, 9, done ? PC.muted : PC.ink, 'right');
      y += 6.4; line(PG.ML, y, PG.ML + tw, y, PC.line, 0.25);
    }
    if (qr) {
      const qx = R - qrW;
      ops.push({ t: 'qr', m: qr.matrix, x: qx, y: top0, w: qrW });
      let qy = top0 + qrW + 3.4;
      text(qx + qrW / 2, qy, 'Quét để chuyển khoản đợt ' + (qr.n || 1), 600, 7.5, PC.ink, 'center'); qy += 3.4;
      text(qx + qrW / 2, qy, money(qr.amount) + ' đ', 600, 7.5, PC.ink, 'center'); qy += 3.2;
      text(qx + qrW / 2, qy, 'ND: ' + qr.memo, 400, 7, PC.muted, 'center');
      y = Math.max(y, qy + 1);
    }
    y += 2;
  } else if (qr) {
    /* không chia đợt: một khối mã QR cho số còn phải thanh toán */
    const qrW = 30;
    if (y + qrW + 12 > PG.BOTTOM) newPage(false);
    y += 2;
    text(PG.ML, y + asc(8), 'CHUYỂN KHOẢN NHANH', 700, 8, PC.brown); y += lhmm(8) + 1;
    const top0 = y, qx = R - qrW, tw = CW - qrW - 8;
    ops.push({ t: 'qr', m: qr.matrix, x: qx, y: top0, w: qrW });
    let ty = top0 + 1;
    for (const l of wrapMM('Mở app ngân hàng, chọn quét mã QR. Số tiền và nội dung chuyển khoản đã được điền sẵn.', 400, 9.5, tw)) { text(PG.ML, ty + asc(9.5), l, 400, 9.5, PC.ink); ty += lhmm(9.5); }
    ty += 1.5;
    text(PG.ML, ty + asc(9), 'Số tiền: ' + money(qr.amount) + ' đ', 700, 9, PC.ink); ty += lhmm(9) + 0.6;
    text(PG.ML, ty + asc(9), 'Nội dung: ' + qr.memo, 400, 9, PC.muted); ty += lhmm(9);
    y = Math.max(ty, top0 + qrW) + 3;
  }
  para('Ghi chú', q.note);
  para('Điều khoản thanh toán', q.terms);
  const bankLabel = st.bankName || bankName(st.bankBin);
  const bank = [bankLabel && 'Ngân hàng: ' + bankLabel, st.bankAccount && 'Số tài khoản: ' + st.bankAccount, st.bankHolder && 'Chủ tài khoản: ' + st.bankHolder].filter(Boolean).join('\n');
  para('Thông tin chuyển khoản', bank);

  /* --- chữ ký --- */
  if (y + 44 > PG.BOTTOM) newPage(false);
  y += 7;
  signBlock({ text, ops, y, CW, st, sign, signImg, leftTitle: 'KHÁCH HÀNG' });
  return pages;
}

function signBlock({ text, ops, y, CW, st, sign, signImg, leftTitle, rightTitle }) {
  const c1 = PG.ML + CW * 0.25, c2 = PG.ML + CW * 0.75;
  text(c1, y + 4, leftTitle, 700, 9.5, PC.ink, 'center');
  text(c2, y + 4, rightTitle || 'ĐẠI DIỆN ' + String(st.shopName || 'CỬA HÀNG').toUpperCase(), 700, 9.5, PC.ink, 'center');
  text(c1, y + 8.6, '(Ký, ghi rõ họ tên)', 400, 8, PC.muted, 'center');
  text(c2, y + 8.6, '(Ký, ghi rõ họ tên)', 400, 8, PC.muted, 'center');
  if (sign && signImg) {
    const r = signImg.width / signImg.height; let h = 16, w = h * r; if (w > 60) { w = 60; h = w / r; }
    ops.push({ t: 'img', img: signImg, x: c1 - w / 2, y: y + 11, w, h });
    text(c1, y + 31, sign.name || '', 600, 9.5, PC.ink, 'center');
    text(c1, y + 35, `Ký trên iPad lúc ${fmtDateTime(new Date(sign.at))}`, 400, 7, PC.muted, 'center');
    text(c1, y + 38.4, `Mã xác thực: ${sign.hash}`, 400, 7, PC.muted, 'center');
  }
}
async function rasterize(pages, size, footer) {
  await ensureFonts();
  const W = Math.round(size.w * PX), H = Math.round(size.h * PX), out = [];
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  if (!c) throw new Error('canvas');
  for (let i = 0; i < pages.length; i++) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H);
    for (const op of pages[i]) drawOp(c, op);
    if (footer) {
      const fy = size.h - 10;
      drawOp(c, { t: 'line', x1: PG.ML, y1: fy - 4.6, x2: size.w - PG.MR, y2: fy - 4.6, color: PC.line, wd: 0.25 });
      drawOp(c, { t: 'text', x: PG.ML, y: fy, s: footer, w: 400, pt: 7.5, color: PC.muted, align: 'left' });
      if (pages.length > 1) drawOp(c, { t: 'text', x: size.w - PG.MR, y: fy, s: `Trang ${i + 1}/${pages.length}`, w: 400, pt: 7.5, color: PC.muted, align: 'right' });
    }
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.92));
    if (!blob || blob.size < 2000) throw new Error('blank');
    out.push({ blob, bytes: new Uint8Array(await blob.arrayBuffer()), w: W, h: H });
  }
  cv.width = cv.height = 1;
  return out;
}
/* Bộ dựng trang đơn giản cho phiếu thu, đề nghị thanh toán, biên bản */
function makeDoc(size, repeatHeader) {
  const pages = []; let ops, y;
  const d = {
    size, pages, CW: size.w - PG.ML - PG.MR, R: size.w - PG.MR, BOTTOM: size.h - 16,
    get y() { return y; }, set y(v) { y = v; },
    get ops() { return ops; },
    text: (x, yb, s, w, pt, color = PC.ink, align = 'left') => ops.push({ t: 'text', x, y: yb, s: String(s ?? ''), w, pt, color, align }),
    rect: (x, yy, w, h, color) => ops.push({ t: 'rect', x, y: yy, w, h, color }),
    line: (x1, y1, x2, y2, color = PC.line, wd = 0.25) => ops.push({ t: 'line', x1, y1, x2, y2, color, wd }),
    newPage() { ops = []; pages.push(ops); y = PG.MT; if (pages.length > 1 && repeatHeader) repeatHeader(d); },
    ensure(h) { if (y + h > d.BOTTOM) d.newPage(); },
    para(str, w, pt, color = PC.ink, maxW = d.CW, x = PG.ML) {
      for (const l of wrapMM(str, w, pt, maxW)) { d.ensure(lhmm(pt)); d.text(x, y + asc(pt), l, w, pt, color); y += lhmm(pt); }
    },
    kv(label, value, opt = {}) {
      const lw = opt.lw || 42, pt = opt.pt || 10;
      const lines = wrapMM(value || '—', opt.bold ? 600 : 400, pt, d.CW - lw);
      d.ensure(lines.length * lhmm(pt) + 1);
      d.text(PG.ML, y + asc(pt), label, 400, pt, PC.muted);
      lines.forEach((l, i) => d.text(PG.ML + lw, y + asc(pt) + i * lhmm(pt), l, opt.bold ? 700 : 400, pt, opt.color || PC.ink));
      y += lines.length * lhmm(pt) + 1.2;
    },
  };
  d.newPage();
  return d;
}
function docHeader(d, st, logo, title, rightLines) {
  const top = d.y; let lx = PG.ML, logoBottom = top;
  if (logo) {
    const r = logo.width / logo.height; let h = 16, w = h * r; if (w > 36) { w = 36; h = w / r; }
    d.ops.push({ t: 'img', img: logo, x: PG.ML, y: top, w, h }); lx += w + 4; logoBottom = top + h;
  }
  const rightW = 70, leftMax = d.R - rightW - lx - 4;
  let ly = top + asc(13);
  for (const l of wrapMM(st.shopName, 700, 13, leftMax)) { d.text(lx, ly, l, 700, 13, PC.brown); ly += lhmm(13); }
  for (const s of [st.address, st.phone ? 'ĐT: ' + st.phone : ''].filter(Boolean)) for (const l of wrapMM(s, 400, 8, leftMax)) { d.text(lx, ly, l, 400, 8, PC.muted); ly += lhmm(8); }
  d.text(d.R, top + asc(17), title, 700, 17, PC.ink, 'right');
  let ry = top + asc(17) + 5.6;
  for (const [s, w] of rightLines) { d.text(d.R, ry, s, w || 400, 9, w ? PC.ink : PC.muted, 'right'); ry += lhmm(9); }
  d.y = Math.max(ly, ry, logoBottom + 2) + 1;
  d.line(PG.ML, d.y, d.R, d.y, PC.brown, 0.5); d.y += 5;
}
function docSign(d, st, leftTitle, rightTitle, sign, signImg) {
  const need = sign && signImg ? 44 : 30;
  d.ensure(need); d.y += 4;
  signBlock({ text: d.text, ops: d.ops, y: d.y, CW: d.CW, st, sign, signImg, leftTitle, rightTitle });
  d.y += need - 4;
}
function drawOp(c, op) {
  if (op.t === 'text') {
    c.font = pfont(op.w, op.pt); c.fillStyle = op.color; c.textAlign = op.align; c.textBaseline = 'alphabetic';
    c.fillText(op.s, op.x * PX, op.y * PX);
  } else if (op.t === 'rect') {
    c.fillStyle = op.color; c.fillRect(op.x * PX, op.y * PX, op.w * PX, op.h * PX);
  } else if (op.t === 'line') {
    c.strokeStyle = op.color; c.lineWidth = Math.max(1, op.wd * PX); c.beginPath();
    c.moveTo(op.x1 * PX, op.y1 * PX); c.lineTo(op.x2 * PX, op.y2 * PX); c.stroke();
  } else if (op.t === 'img') {
    c.drawImage(op.img, op.x * PX, op.y * PX, op.w * PX, op.h * PX);
  } else if (op.t === 'qr') {
    const m = op.m, n = m.size + 8, px0 = Math.round(op.x * PX), py0 = Math.round(op.y * PX), tot = Math.round(op.w * PX);
    const s = Math.floor(tot / n), off = Math.floor((tot - s * n) / 2);
    c.fillStyle = '#FFFFFF'; c.fillRect(px0, py0, tot, tot); c.fillStyle = '#000000';
    for (let yy = 0; yy < m.size; yy++) for (let xx = 0; xx < m.size; xx++) if (m.get(xx, yy)) c.fillRect(px0 + off + (xx + 4) * s, py0 + off + (yy + 4) * s, s, s);
  }
}
async function renderQuotePages(o, src) {
  const st = settings();
  let q, label = '', sign = null;
  if (src === 'draft') { q = o.draft; if (o.versions.length) label = `Bản ${o.versions.length + 1}`; }
  else { const v = o.versions.find(v => String(v.no) === String(src)) || lastVersion(o); q = v.quote; sign = v.sign || null; if (o.versions.length > 1) label = `Bản ${v.no}`; }
  const [logo, signImg] = await Promise.all([loadImg(st.logo), loadImg(sign?.img)]);
  /* bản đang dùng (bản chốt mới nhất hoặc bản đang sửa): trừ tiền khách đã trả */
  const cur = src === 'draft' || !o.versions.length || String(src) === String(lastVersion(o).no) || !o.versions.some(v => String(v.no) === String(src));
  const total = quoteTotals(q).total;
  /* bản đang dùng của đơn đã chốt: theo lịch của đơn (có thể đã sửa hoặc bỏ chia đợt sau khi chốt) */
  const live = cur && src !== 'draft' && isClosed(o);
  /* mọi con số tiền lấy từ orderMoney, giống hệt trên màn hình */
  const m = orderMoney(o, { quote: live ? null : q, pays: cur });
  /* không chia đợt: không in bảng đợt, chỉ in ô chuyển khoản nhanh */
  const plan = m.rows.some(r => r.one) ? [] : m.rows;
  const pays = cur ? [...(o.payments || [])].sort((a, b) => String(a.date).localeCompare(String(b.date))) : [];
  const pay = cur && (pays.length || m.chg) ? { pays, paid: m.paid, chg: m.chg, due: m.due, over: m.over, plan } : null;
  /* không chia đợt: đơn đã chốt thì in mã QR cho toàn bộ số còn phải thu */
  const nx = plan.length ? plan.find(r => r.left > 0) : live ? { one: true, n: 0, left: m.due } : null;
  const qr = nx && feat('qrPdf') ? orderQR(o, nx.left, nx.n) : null;
  if (qr) { qr.n = nx.n; qr.one = !!nx.one; }
  const pages = layoutQuote({ q, st, code: o.code, label, logo, sign, signImg, qr, pay, plan });
  const out = await rasterize(pages, { w: PG.W, h: PG.H }, [st.shopName, st.phone].filter(Boolean).join(' · '));
  return { pages: out, q, label, size: { w: PG.W, h: PG.H }, title: `Báo giá ${o.code}${label ? ' - ' + label : ''} - ${q.customer?.name || ''}` };
}
const A5L = { w: 210, h: 148.5 };
async function renderReceipt(o, p) {
  const st = settings(), logo = await loadImg(st.logo), h = headQuote(o);
  const d = makeDoc(A5L);
  docHeader(d, st, logo, 'PHIẾU THU', [['Số: ' + receiptNo(o, p), 600], ['Ngày: ' + fmtDate(p.date)]]);
  const sorted = [...o.payments].sort((a, b) => a.date.localeCompare(b.date) || (a.no || 0) - (b.no || 0));
  const upto = sorted.slice(0, sorted.indexOf(p) + 1).reduce((s, x) => s + x.amount, 0);
  const total = orderTotal(o);
  d.kv('Người nộp tiền', h.customer.name, { bold: true });
  if (h.customer.phone) d.kv('Điện thoại', h.customer.phone);
  d.kv('Công trình', [h.project, h.customer.address].filter(Boolean).join(' – ') || '—');
  d.kv('Lý do nộp', p.note || 'Thanh toán đơn ' + o.code);
  d.kv('Hình thức', PAY_METHOD[p.method] || 'Chuyển khoản');
  d.kv('Số tiền', moneyD(p.amount), { bold: true, pt: 12, color: PC.brown });
  d.kv('Bằng chữ', moneyWords(p.amount));
  d.line(PG.ML, d.y, d.R, d.y, PC.line, 0.25); d.y += 3;
  d.text(PG.ML, d.y + 3, `Đơn ${o.code} · Tổng giá trị: ${moneyD(total)} · Đã thu (tính cả phiếu này): ${moneyD(upto)} · Còn lại: ${moneyD(Math.max(0, total - upto))}`, 400, 8.5, PC.muted);
  d.y += 2;
  docSign(d, st, 'NGƯỜI NỘP TIỀN', 'NGƯỜI THU TIỀN');
  const out = await rasterize(d.pages, A5L, '');
  return { pages: out, size: A5L, title: `Phiếu thu ${receiptNo(o, p)}`, filename: `Phieu-thu-${receiptNo(o, p)}.pdf` };
}
async function renderPayRequest(o, r) {
  const st = settings(), logo = await loadImg(st.logo), h = headQuote(o);
  const qr = orderQR(o, r.left, r.one ? 0 : r.n);
  const d = makeDoc(A5L);
  docHeader(d, st, logo, 'ĐỀ NGHỊ THANH TOÁN', [['Đơn: ' + o.code, 600], ['Ngày: ' + fmtDate(today())]]);
  const qrW = qr ? 52 : 0, top = d.y, maxW = d.CW - (qr ? qrW + 8 : 0);
  const kv = (label, value, bold, pt = 10, color) => {
    const lines = wrapMM(value || '—', bold ? 700 : 400, pt, maxW - 34);
    d.text(PG.ML, d.y + asc(pt), label, 400, pt, PC.muted);
    lines.forEach((l, i) => d.text(PG.ML + 34, d.y + asc(pt) + i * lhmm(pt), l, bold ? 700 : 400, pt, color || PC.ink));
    d.y += lines.length * lhmm(pt) + 1.4;
  };
  kv('Kính gửi', h.customer.name, true);
  kv('Công trình', [h.project, h.customer.address].filter(Boolean).join(' – '));
  kv('Nội dung', payNote(r));
  kv('Số tiền', moneyD(r.left), true, 13, PC.brown);
  kv('Bằng chữ', moneyWords(r.left));
  if (qr) {
    kv('Ngân hàng', qr.bank); kv('Số tài khoản', qr.account, true); if (qr.holder) kv('Chủ tài khoản', qr.holder);
    kv('Nội dung CK', qr.memo, true);
    d.ops.push({ t: 'qr', m: qr.matrix, x: d.R - qrW, y: top, w: qrW });
    d.text(d.R - qrW / 2, top + qrW + 4, 'Quét bằng app ngân hàng', 600, 8, PC.ink, 'center');
  } else {
    const bankLabel = st.bankName || bankName(st.bankBin);
    if (bankLabel || st.bankAccount) { kv('Ngân hàng', bankLabel); kv('Số tài khoản', st.bankAccount, true); if (st.bankHolder) kv('Chủ tài khoản', st.bankHolder); }
  }
  d.y = Math.max(d.y, qr ? top + qrW + 8 : 0) + 2;
  d.text(PG.ML, d.y + 3, `Tổng giá trị đơn: ${moneyD(orderTotal(o))} · Đã thu: ${moneyD(orderPaid(o))} · Còn phải thu: ${moneyD(orderDue(o))}`, 400, 8.5, PC.muted);
  const out = await rasterize(d.pages, A5L, [st.shopName, st.phone].filter(Boolean).join(' · '));
  return { pages: out, size: A5L, title: `Đề nghị thanh toán ${o.code} ${dotName(r)}`, filename: `De-nghi-thanh-toan-${o.code}-${r.one ? 'con-lai' : 'dot-' + r.n}.pdf` };
}
async function renderHandover(o) {
  const st = settings(), hv = o.handover, v = lastVersion(o), q = v.quote;
  const [logo, signImg] = await Promise.all([loadImg(st.logo), loadImg(hv.sign?.img)]);
  const A4 = { w: PG.W, h: PG.H };
  const d = makeDoc(A4, dd => { dd.text(PG.ML, dd.y + 4, `${st.shopName} · Biên bản nghiệm thu ${o.code}`, 400, 8.5, PC.muted); dd.y += 9; });
  docHeader(d, st, logo, 'BIÊN BẢN NGHIỆM THU', [['BÀN GIAO CÔNG TRÌNH', 600], ['Đơn: ' + o.code, 600], ['Ngày: ' + fmtDate(hv.date)]]);
  d.kv('Khách hàng', q.customer.name, { bold: true });
  if (q.customer.phone) d.kv('Điện thoại', q.customer.phone);
  d.kv('Công trình', q.project || '—');
  if (q.customer.address) d.kv('Địa chỉ', q.customer.address);
  d.y += 3;
  d.text(PG.ML, d.y + asc(9), 'HẠNG MỤC ĐÃ NGHIỆM THU, BÀN GIAO', 700, 9, PC.brown); d.y += lhmm(9) + 1;
  const cols = [{ w: 10, a: 'center', h: 'STT' }, { w: 0, a: 'left', h: 'Hạng mục' }, { w: 26, a: 'right', h: 'Khối lượng' }, { w: 32, a: 'right', h: 'Thành tiền' }];
  cols[1].w = d.CW - 10 - 26 - 32; let cx = PG.ML; for (const c of cols) { c.x = cx; cx += c.w; }
  const cxp = c => c.a === 'right' ? c.x + c.w - 1.8 : c.a === 'center' ? c.x + c.w / 2 : c.x + 1.8;
  const head = () => { d.rect(PG.ML, d.y, d.CW, 7, PC.soft); cols.forEach(c => d.text(cxp(c), d.y + 4.8, c.h.toUpperCase(), 600, 7.5, PC.brown, c.a)); d.y += 7; };
  head();
  const items = q.rows.map(r => ({ name: r.name, sub: r.material, qty: `${fmtQty(r.qty)} ${r.unit}`, amt: money(rowAmount(r)) }));
  o.changes.filter(c => c.status === 'confirmed').forEach(c => items.push({ name: 'Phát sinh: ' + c.title, sub: c.note || '', qty: '', amt: (c.sign < 0 ? '−' : '+') + money(c.amount) }));
  items.forEach((it, i) => {
    const nl = wrapMM(it.name, 600, 9.5, cols[1].w - 3.6), sl = it.sub ? wrapMM(it.sub, 400, 8.5, cols[1].w - 3.6) : [];
    const hh = 2 + nl.length * lhmm(9.5) + sl.length * lhmm(8.5) + 1.6;
    if (d.y + hh > d.BOTTOM) { d.newPage(); head(); }
    const b0 = d.y + 2 + asc(9.5);
    d.text(cxp(cols[0]), b0, i + 1, 400, 9, PC.muted, 'center');
    let yy = d.y + 2;
    nl.forEach(l => { d.text(cxp(cols[1]), yy + asc(9.5), l, 600, 9.5); yy += lhmm(9.5); });
    sl.forEach(l => { d.text(cxp(cols[1]), yy + asc(8.5), l, 400, 8.5, PC.muted); yy += lhmm(8.5); });
    d.text(cxp(cols[2]), b0, it.qty, 400, 9, PC.ink, 'right');
    d.text(cxp(cols[3]), b0, it.amt, 600, 9, PC.ink, 'right');
    d.y += hh; d.line(PG.ML, d.y, d.R, d.y);
  });
  d.y += 3;
  const total = orderTotal(o), paid = orderPaid(o);
  const lines = [['Giá trị theo báo giá đã chốt', moneyD(v.total)]];
  const chg = confirmedChanges(o); if (chg) lines.push(['Phát sinh đã xác nhận', signed(chg) + ' đ']);
  lines.push(['Tổng giá trị công trình', moneyD(total)], ['Đã thanh toán', moneyD(paid)], ['Còn phải thanh toán', moneyD(Math.max(0, total - paid))]);
  d.ensure(lines.length * 6 + 4);
  const tx = d.R - 92;
  lines.forEach(([a, b], i) => { const bold = i === lines.length - 1; d.text(tx, d.y + 4, a, bold ? 700 : 400, 9.5, bold ? PC.brown : PC.muted); d.text(d.R - 1.8, d.y + 4, b, bold ? 700 : 500, 9.5, bold ? PC.brown : PC.ink, 'right'); d.y += 6; });
  d.y += 3;
  d.ensure(14);
  d.text(PG.ML, d.y + asc(8), 'KẾT LUẬN VÀ BẢO HÀNH', 700, 8, PC.brown); d.y += lhmm(8) + 0.6;
  d.para(`Hai bên thống nhất nghiệm thu và bàn giao các hạng mục nêu trên vào ngày ${fmtDate(hv.date)}. Thời hạn bảo hành ${hv.warrantyMonths} tháng, từ ngày ${fmtDate(hv.date)} đến ngày ${fmtDate(hv.warrantyUntil)}.`, 400, 9.5);
  if (hv.note) { d.y += 1; d.para('Ghi chú / việc còn tồn: ' + hv.note, 400, 9.5); }
  docSign(d, st, 'ĐẠI DIỆN KHÁCH HÀNG', null, hv.sign, signImg);
  const out = await rasterize(d.pages, A4, [st.shopName, st.phone].filter(Boolean).join(' · '));
  return { pages: out, size: A4, title: `Biên bản nghiệm thu ${o.code}`, filename: `Bien-ban-nghiem-thu-${o.code}.pdf` };
}
/* Ghép các trang thành một ảnh PNG dài (gửi Zalo) */
async function makePng(pages, size = { w: 210, h: 297 }) {
  const imgs = await Promise.all(pages.map(p => new Promise((res, rej) => { const u = URL.createObjectURL(p.blob); const i = new Image(); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = () => { URL.revokeObjectURL(u); rej(new Error('img')); }; i.src = u; })));
  const gap = imgs.length > 1 ? 24 : 0;
  let w = Math.min(1240, imgs[0].naturalWidth);
  /* trang cuối: bỏ khoảng trắng giữa nội dung và chân trang */
  const lastImg = imgs[imgs.length - 1];
  const fullH = img => Math.round(img.naturalHeight * w / img.naturalWidth);
  const footPx = Math.round(fullH(lastImg) * 17 / size.h);
  let lastKeep = null;
  {
    const h = fullH(lastImg), cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    if (c) {
      c.drawImage(lastImg, 0, 0, w, h);
      const scanH = h - footPx, data = c.getImageData(0, 0, w, scanH).data;
      let yEnd = 0;
      for (let y = scanH - 1; y >= 0 && !yEnd; y--) for (let x = 0; x < w; x += 2) { const k = (y * w + x) * 4; if (data[k] < 228 || data[k + 1] < 228 || data[k + 2] < 228) { yEnd = y; break; } }
      const top = Math.min(scanH, yEnd + Math.round(w * 0.05));
      if (top + footPx < h * 0.85) lastKeep = { top, foot: footPx, h };
      cv.width = cv.height = 1;
    }
  }
  const hOf = (img, i) => (i === imgs.length - 1 && lastKeep) ? lastKeep.top + lastKeep.foot : fullH(img);
  let total = imgs.reduce((s, img, i) => s + hOf(img, i), 0) + gap * (imgs.length - 1);
  const MAX = 15e6;
  if (w * total > MAX) {
    const k = Math.sqrt(MAX / (w * total)); w = Math.floor(w * k);
    if (lastKeep) { lastKeep = { top: Math.floor(lastKeep.top * k), foot: Math.floor(lastKeep.foot * k), h: fullH(lastImg) }; }
    total = imgs.reduce((s, img, i) => s + hOf(img, i), 0) + gap * (imgs.length - 1);
  }
  const cv = document.createElement('canvas'); cv.width = w; cv.height = total;
  const c = cv.getContext('2d');
  if (!c) throw new Error('canvas');
  c.fillStyle = '#E7E1D9'; c.fillRect(0, 0, w, total);
  c.imageSmoothingQuality = 'high';
  let y = 0;
  imgs.forEach((img, i) => {
    const h = fullH(img);
    if (i === imgs.length - 1 && lastKeep) {
      const sx = img.naturalWidth / w;
      c.drawImage(img, 0, 0, img.naturalWidth, lastKeep.top * sx, 0, y, w, lastKeep.top);
      c.drawImage(img, 0, (h - lastKeep.foot) * sx, img.naturalWidth, lastKeep.foot * sx, 0, y + lastKeep.top, w, lastKeep.foot);
      y += lastKeep.top + lastKeep.foot;
    } else { c.drawImage(img, 0, y, w, h); y += h + gap; }
  });
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  cv.width = cv.height = 1;
  if (!blob) throw new Error('png');
  return blob;
}
function pdfText(s) {
  let h = 'FEFF';
  for (const ch of String(s)) { const cp = ch.codePointAt(0); if (cp > 0xffff) { h += '003F'; continue; } h += cp.toString(16).toUpperCase().padStart(4, '0'); }
  return '<' + h + '>';
}
function makePdf(pages, title, size = { w: 210, h: 297 }) {
  const enc = new TextEncoder(), chunks = [], offs = [];
  let off = 0;
  const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); off += b.length; };
  const obj = (n, fn) => { offs[n] = off; push(`${n} 0 obj\n`); fn(); push('\nendobj\n'); };
  const W = +(size.w * 72 / 25.4).toFixed(2), H = +(size.h * 72 / 25.4).toFixed(2), n = pages.length;
  push('%PDF-1.4\n%âãÏÓ\n');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + 3 * i} 0 R`).join(' ')}] /Count ${n} >>`));
  const d = new Date();
  const ds = `D:${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
  obj(3, () => push(`<< /Title ${pdfText(title)} /Producer (So Noi That) /CreationDate (${ds}) >>`));
  pages.forEach((p, i) => {
    obj(4 + 3 * i, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im${i} ${6 + 3 * i} 0 R >> >> /Contents ${5 + 3 * i} 0 R >>`));
    const cs = `q ${W} 0 0 ${H} 0 0 cm /Im${i} Do Q`;
    obj(5 + 3 * i, () => push(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    obj(6 + 3 * i, () => { push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`); push(p.bytes); push('\nendstream'); });
  });
  const last = 3 + 3 * n, xref = off;
  push(`xref\n0 ${last + 1}\n0000000000 65535 f \n`);
  for (let k = 1; k <= last; k++) push(String(offs[k]).padStart(10, '0') + ' 00000 n \n');
  push(`trailer\n<< /Size ${last + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks, { type: 'application/pdf' });
}
