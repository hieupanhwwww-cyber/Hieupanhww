/* =========================================================
   MÃ QR (byte mode, mức sửa lỗi M) + VIETQR (chuẩn NAPAS/EMVCo)
   ========================================================= */
const QR = (() => {
  const ECC_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26];
  const BLK_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16];
  const bit = (x, i) => ((x >>> i) & 1) !== 0;
  function rawModules(v) {
    let r = (16 * v + 128) * v + 64;
    if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  }
  const dataCodewords = v => Math.floor(rawModules(v) / 8) - ECC_M[v] * BLK_M[v];
  function rsMul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z & 0xff; }
  function rsDivisor(deg) {
    const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1;
    for (let i = 0; i < deg; i++) {
      for (let j = 0; j < r.length; j++) { r[j] = rsMul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
      root = rsMul(root, 0x02);
    }
    return r;
  }
  function rsRemainder(data, div) {
    const r = div.map(() => 0);
    for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= rsMul(c, f); }); }
    return r;
  }
  function alignPos(v, size) {
    if (v === 1) return [];
    const n = Math.floor(v / 7) + 2;
    const step = Math.floor((v * 8 + n * 3 + 5) / (n * 4 - 4)) * 2;
    const r = [6];
    for (let p = size - 7; r.length < n; p -= step) r.splice(1, 0, p);
    return r;
  }
  function encode(text) {
    const bytes = [...new TextEncoder().encode(String(text))];
    let ver = 1;
    for (; ver <= 20; ver++) {
      const cap = dataCodewords(ver) * 8;
      const need = 4 + (ver < 10 ? 8 : 16) + bytes.length * 8;
      if (need <= cap) break;
    }
    if (ver > 20) throw new Error('QR quá dài');
    const bits = [];
    const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(4, 4); push(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach(b => push(b, 8));
    const capBits = dataCodewords(ver) * 8;
    push(0, Math.min(4, capBits - bits.length));
    push(0, (8 - bits.length % 8) % 8);
    for (let pad = 0xec; bits.length < capBits; pad ^= 0xec ^ 0x11) push(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
    /* chia khối + mã sửa lỗi */
    const nb = BLK_M[ver], eccLen = ECC_M[ver], raw = Math.floor(rawModules(ver) / 8);
    const nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
    const div = rsDivisor(eccLen), blocks = [];
    for (let i = 0, k = 0; i < nb; i++) {
      const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1)); k += dat.length;
      const ecc = rsRemainder(dat, div);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    const all = [];
    for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= nShort) all.push(b[i]); });
    /* ma trận */
    const size = ver * 4 + 17;
    const mod = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const setF = (x, y, d) => { mod[y][x] = d; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    const finder = (x, y) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy)), xx = x + dx, yy = y + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) setF(xx, yy, d !== 2 && d !== 4);
      }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const ap = alignPos(ver, size), na = ap.length;
    for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    const drawFormat = mask => {
      const d = (0 << 3) | mask; let rem = d;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const b = ((d << 10) | rem) ^ 0x5412;
      for (let i = 0; i <= 5; i++) setF(8, i, bit(b, i));
      setF(8, 7, bit(b, 6)); setF(8, 8, bit(b, 7)); setF(7, 8, bit(b, 8));
      for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(b, i));
      for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(b, i));
      for (let i = 8; i < 15; i++) setF(8, size - 15 + i, bit(b, i));
      setF(8, size - 8, true);
    };
    drawFormat(0);
    if (ver >= 7) {
      let rem = ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const b = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) { const v = bit(b, i), a = size - 11 + i % 3, c = Math.floor(i / 3); setF(a, c, v); setF(c, a, v); }
    }
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && i < all.length * 8) { mod[y][x] = bit(all[i >>> 3], 7 - (i & 7)); i++; }
      }
    }
    const maskFn = [
      (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
      (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0,
    ];
    const applyMask = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && maskFn[m](x, y)) mod[y][x] = !mod[y][x]; };
    const penalty = () => {
      let p = 0;
      const line = get => {
        let run = 1, prev = get(0);
        for (let k = 1; k < size; k++) { const c = get(k); if (c === prev) { run++; if (run === 5) p += 3; else if (run > 5) p += 1; } else { run = 1; prev = c; } }
        for (let k = 0; k + 7 <= size; k++) {
          if (get(k) && !get(k + 1) && get(k + 2) && get(k + 3) && get(k + 4) && !get(k + 5) && get(k + 6)) {
            const before = k >= 4 && !get(k - 1) && !get(k - 2) && !get(k - 3) && !get(k - 4);
            const after = k + 11 <= size && !get(k + 7) && !get(k + 8) && !get(k + 9) && !get(k + 10);
            if (before || after) p += 40;
          }
        }
      };
      for (let y = 0; y < size; y++) line(k => mod[y][k]);
      for (let x = 0; x < size; x++) line(k => mod[k][x]);
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = mod[y][x]; if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3; }
      let dark = 0; for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (mod[y][x]) dark++;
      const total = size * size;
      p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
      return p;
    };
    let best = 0, bestP = Infinity;
    for (let m = 0; m < 8; m++) { applyMask(m); drawFormat(m); const pp = penalty(); if (pp < bestP) { bestP = pp; best = m; } applyMask(m); }
    applyMask(best); drawFormat(best);
    return { size, ver, get: (x, y) => mod[y][x] };
  }
  function toCanvas(q, px, quiet = 4) {
    const n = q.size + quiet * 2, s = Math.max(1, Math.floor(px / n));
    const cv = document.createElement('canvas'); cv.width = cv.height = n * s;
    const c = cv.getContext('2d');
    c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = '#000000';
    for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.get(x, y)) c.fillRect((x + quiet) * s, (y + quiet) * s, s, s);
    return cv;
  }
  return { encode, toCanvas };
})();

/* Ngân hàng theo danh sách mã BIN của Ngân hàng Nhà nước (tên theo thương hiệu hiện dùng) */
const BANKS = [
  ['970436', 'Vietcombank'], ['970415', 'VietinBank'], ['970418', 'BIDV'], ['970405', 'Agribank'],
  ['970407', 'Techcombank'], ['970422', 'MB Bank'], ['970416', 'ACB'], ['970432', 'VPBank'],
  ['970423', 'TPBank'], ['970403', 'Sacombank'], ['970437', 'HDBank'], ['970441', 'VIB'],
  ['970443', 'SHB'], ['970431', 'Eximbank'], ['970426', 'MSB'], ['970448', 'OCB'],
  ['970440', 'SeABank'], ['970449', 'LPBank'], ['970428', 'Nam A Bank'], ['970409', 'Bac A Bank'],
  ['970425', 'ABBANK'], ['970427', 'VietABank'], ['970412', 'PVcomBank'], ['970452', 'KienlongBank'],
  ['970454', 'BVBank (Bản Việt)'], ['970419', 'NCB'], ['970400', 'Saigonbank'], ['970438', 'BaoViet Bank'],
  ['970433', 'VietBank'], ['970430', 'PGBank'], ['970429', 'SCB'], ['970408', 'GPBank'],
  ['970414', 'MBV (OceanBank cũ)'], ['970406', 'Vikki Bank (DongA Bank cũ)'], ['970444', 'CBBank'], ['970446', 'Co-opBank'],
  ['970424', 'Shinhan Bank'], ['970457', 'Woori Bank'], ['970458', 'UOB'], ['970410', 'Standard Chartered'],
  ['970439', 'Public Bank'], ['970442', 'Hong Leong Bank'], ['970434', 'Indovina Bank'], ['970459', 'CIMB'],
];
const bankName = bin => (BANKS.find(b => b[0] === bin) || [])[1] || '';

function tlv(id, v) { v = String(v); return id + String(v.length).padStart(2, '0') + v; }
function crc16(s) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
const qrMemo = s => fold(s).toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 25);
function vietQRPayload({ bin, account, amount, memo }) {
  const acct = tlv('00', bin) + tlv('01', account);
  const mai = tlv('00', 'A000000727') + tlv('01', acct) + tlv('02', 'QRIBFTTA');
  let s = tlv('00', '01') + tlv('01', amount ? '12' : '11') + tlv('38', mai) + tlv('53', '704');
  if (amount) s += tlv('54', String(Math.round(amount)));
  s += tlv('58', 'VN');
  if (memo) s += tlv('62', tlv('08', memo));
  s += '6304';
  return s + crc16(s);
}
function bankReady(st = settings()) {
  return /^\d{6}$/.test(st.bankBin || '') && /^[A-Za-z0-9]{4,19}$/.test(String(st.bankAccount || '').replace(/\s/g, ''));
}
function orderMemo(o, n) {
  const st = settings();
  return qrMemo(`${st.memoPrefix || ''} ${String(o.code).replace(/[^A-Za-z0-9]/g, '')}${n ? ' D' + n : ''}`);
}
function orderQR(o, amount, n) {
  const st = settings();
  if (!bankReady(st) || !(amount > 0)) return null;
  const memo = orderMemo(o, n);
  const payload = vietQRPayload({ bin: st.bankBin, account: String(st.bankAccount).replace(/\s/g, ''), amount, memo });
  return { payload, memo, amount, matrix: QR.encode(payload), bank: st.bankName || bankName(st.bankBin), account: st.bankAccount, holder: st.bankHolder };
}
