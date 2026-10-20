// Kiểm thử đầu-cuối: app thật + Firebase SDK thật + máy chủ giả lập (chạy trong GitHub Actions)
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.APP_URL || 'http://127.0.0.1:5050/';
const OUT = process.env.OUT_DIR || 'e2e-out';
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, m, extra = '') => { if (c) { pass++; console.log('PASS', m, extra); } else { fail++; console.log('FAIL', m, extra); } };
const CFG = { config: { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-snt', appId: '1:1:web:1', emulator: true }, wid: 'main' };

async function newUser(browser, name, ipad = true) {
  const ctx = await browser.newContext({ viewport: ipad ? { width: 1180, height: 820 } : { width: 390, height: 844 }, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', serviceWorkers: 'block' });
  await ctx.addInitScript(cfg => { if (!localStorage.getItem('snt-team-off')) localStorage.setItem('snt-team', cfg); }, JSON.stringify(CFG));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/insufficient permissions|Failed to load resource|ERR_INTERNET_DISCONNECTED|net::|WebChannelConnection|Could not reach Cloud Firestore|offline/i.test(m.text())) errs.push(m.text()); });
  await page.goto(BASE);
  return { ctx, page, errs, name };
}
const waitFor = (page, fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, { timeout, polling: 200 });
async function signUp(u, email) {
  await u.page.waitForSelector('#tm-email', { timeout: 40000 });
  await u.page.fill('#tm-email', email); await u.page.fill('#tm-pass', 'matkhau123');
  await u.page.click('[data-act=tm-signup]');
  await u.page.waitForSelector('#tm-name', { timeout: 30000 });
}
const ready = u => waitFor(u.page, () => typeof Store !== 'undefined' && Store.mode === 'team' && Team.state === 'ready', undefined, 45000);
/* gửi hết hàng chờ (thử lại vài lần sau khi có mạng) */
const drain = u => u.page.evaluate(async () => { const t = Date.now(); while (Date.now() - t < 45000) { Store.flushAll(); if (await Store.idle(5000)) return true; await new Promise(r => setTimeout(r, 1500)); } return false; });
const idle = u => u.page.evaluate(() => Store.idle(25000));
const shot = (u, n) => u.page.screenshot({ path: `${OUT}/${n}.png` });

(async () => {
  const browser = await chromium.launch();
  try {
    /* 1. Chủ tạo xưởng */
    const own = await newUser(browser, 'chu');
    await shot(own, '01-dang-nhap');
    await signUp(own, 'hieu@hungloan.vn');
    await shot(own, '02-vao-xuong');
    await own.page.fill('#tm-name', 'Hiếu');
    await own.page.click('[data-act=tm-create]');
    await own.page.click('.sheet [data-sa=yes]');
    await ready(own);
    ok(await own.page.evaluate(() => Team.role === 'owner'), 'chủ tạo xưởng và vào được');
    const codes = await own.page.evaluate(async () => ({ sale: await Team.createInvite('sale'), sale2: await Team.createInvite('sale'), worker: await Team.createInvite('worker'), manager: await Team.createInvite('manager') }));
    ok(/^[A-Z0-9]{8}$/.test(codes.sale), 'chủ tạo mã mời', codes.sale);

    /* 2. Sale vào bằng mã mời dài (dán từ Zalo) */
    const sale = await newUser(browser, 'sale', false);
    const big = await own.page.evaluate(c => packInvite(Team.cfg, Team.wid, c), codes.sale);
    await signUp(sale, 'lan@hungloan.vn');
    await sale.page.fill('#tm-name', 'Lan sale'); await sale.page.fill('#tm-code', big);
    await sale.page.click('[data-act=tm-join]');
    await ready(sale);
    ok(await sale.page.evaluate(() => Team.role === 'sale'), 'sale vào xưởng bằng mã mời dài');

    /* 3. Sale lập và chốt báo giá có đặt cọc */
    const made = await sale.page.evaluate(async () => {
      const q = newQuote(); q.customer = { name: 'Chị Mai', phone: '0912000111', address: 'Hà Đông, Hà Nội' }; q.project = 'Phòng ngủ master';
      q.rows = [newRow({ name: 'Tủ áo cánh lùa', material: 'MDF chống ẩm', unit: 'm²', qty: 3, price: 3000000, dims: { a: 2000, b: 1500, n: 1, u: 'mm' } })];
      const o = createOrderFrom(q); Store.put('orders', o, 0); await Store.idle(20000);
      const codeAfterCreate = o.code, tempAfterCreate = !!o.codeTemp;
      S.orderId = o.id; await doClose(o, today(), 5000000, 'transfer', null, 'Chị Mai'); await Store.idle(20000);
      return { id: o.id, code: o.code, codeAfterCreate, tempAfterCreate, pays: o.payments.length, reqs: (o.payReqs || []).length, owner: o.owner === Team.uid() };
    });
    ok(!made.tempAfterCreate && /^BG\d{4}-01$/.test(made.codeAfterCreate), 'máy chủ cấp số báo giá chính thức', made.codeAfterCreate);
    ok(made.pays === 0 && made.reqs === 1, 'tiền cọc sale báo nằm ở "chờ xác nhận", chưa tính đã thu');
    await sale.page.evaluate(id => { S.tab = 'orders'; S.orderId = id; S.view = 'detail'; render(); }, made.id);
    await shot(sale, '03-sale-chi-tiet');

    /* 4. Chủ thấy đơn của sale ngay, xác nhận tiền cọc */
    await waitFor(own.page, id => !!Store.get('orders', id), made.id);
    ok(true, 'chủ thấy đơn sale vừa tạo (không cần tải lại)');
    await own.page.evaluate(id => { S.tab = 'orders'; S.orderId = id; S.view = 'detail'; render(); }, made.id);
    await own.page.click('[data-act=req-ok]');
    await idle(own);
    await waitFor(sale.page, id => Store.get('orders', id).payments.length === 1, made.id);
    ok(true, 'chủ xác nhận cọc → sale thấy phiếu thu');
    await shot(own, '04-chu-chi-tiet');

    /* 5. Sale mất mạng thêm ghi chú, cùng lúc chủ ghi phiếu thu 20 triệu → không mất gì */
    await sale.ctx.setOffline(true);
    await sale.page.evaluate(id => { const o = Store.get('orders', id); o.notes.push({ id: uid('n'), text: 'Khách muốn đổi màu cánh', at: new Date().toISOString() }); touchOrder(o, 0); }, made.id);
    await own.page.evaluate(async id => { const o = Store.get('orders', id); o.payments.push({ id: uid('p'), no: nextPayNo(o), amount: 20000000, date: today(), method: 'transfer', note: 'Đợt 2', createdAt: new Date().toISOString() }); touchOrder(o, 0); await Store.idle(20000); }, made.id);
    await sale.page.waitForTimeout(3000);
    const offlineStat = await sale.page.evaluate(() => Store.busy() + Store.failed.size);
    ok(offlineStat > 0, 'khi mất mạng: thay đổi được giữ trên máy');
    await sale.ctx.setOffline(false);
    ok(await drain(sale), 'có mạng lại: tự gửi hết thay đổi đang giữ');
    await waitFor(own.page, id => Store.get('orders', id).notes.length === 1, made.id);
    const s5 = await sale.page.evaluate(id => { const o = Store.get('orders', id); return { pays: o.payments.length, paid: orderPaid(o), notes: o.notes.length }; }, made.id);
    ok(s5.pays === 2 && s5.paid === 25000000 && s5.notes === 1, 'có mạng lại: còn đủ 2 phiếu thu (25 triệu) và ghi chú', JSON.stringify(s5));

    /* 6. Cùng sửa một chỗ: không âm thầm ghi đè, bản kia được cất riêng */
    await sale.ctx.setOffline(true);
    await sale.page.evaluate(id => { const o = Store.get('orders', id); o.status = 'building'; touchOrder(o, 0); }, made.id);
    await own.page.evaluate(async id => { const o = Store.get('orders', id); o.status = 'done'; touchOrder(o, 0); await Store.idle(20000); }, made.id);
    await sale.page.waitForTimeout(1500);
    await sale.ctx.setOffline(false);
    await drain(sale);
    await waitFor(sale.page, () => Team.conflicts.size > 0);
    const s6 = await sale.page.evaluate(id => ({ st: Store.get('orders', id).status, cf: [...Team.conflicts.values()][0] }), made.id);
    ok(s6.st === 'done' && s6.cf.keys.includes('status') && s6.cf.mine.status === 'building', 'sửa trùng: giữ bản lưu trước, bản sau cất riêng để chọn lại');
    await waitFor(own.page, () => Team.conflicts.size > 0);
    ok(true, 'chủ cũng thấy bản cất riêng');

    /* 7. Sale không thấy đơn của người khác */
    const ownOrder = await own.page.evaluate(async () => { const q = newQuote(); q.customer = { name: 'Anh Tuấn', phone: '0988', address: '' }; q.rows = [newRow({ name: 'Giường', unit: 'bộ', qty: 1, price: 8500000 })]; const o = createOrderFrom(q); Store.put('orders', o, 0); await Store.idle(20000); return { id: o.id, code: o.code }; });
    ok(/-02$/.test(ownOrder.code), 'số báo giá tiếp theo không trùng', ownOrder.code);
    await sale.page.waitForTimeout(2500);
    ok(await sale.page.evaluate(id => !Store.get('orders', id) && Store.list('orders').length === 1, ownOrder.id), 'sale không thấy đơn của chủ');

    /* 8. Thợ chỉ thấy phiếu công việc, không thấy giá */
    const worker = await newUser(browser, 'tho', false);
    await signUp(worker, 'tho@hungloan.vn');
    await worker.page.fill('#tm-name', 'Anh Hùng thợ'); await worker.page.fill('#tm-code', codes.worker);
    await worker.page.click('[data-act=tm-join]');
    await ready(worker);
    const kUid = await worker.page.evaluate(() => Team.uid());
    await waitFor(own.page, u => Team.members.has(u), kUid);
    await own.page.evaluate(async ([id, k]) => { const o = Store.get('orders', id); o.workers = [k]; touchOrder(o, 0); await Store.idle(20000); }, [made.id, kUid]);
    await waitFor(worker.page, () => Team.jobs.size === 1);
    const w8 = await worker.page.evaluate(() => ({ job: JSON.stringify([...Team.jobs.values()][0]), orders: Store.list('orders').length, cat: Store.list('catalog').length, text: document.body.innerText }));
    ok(w8.orders === 0 && w8.cat === 0, 'thợ không tải được đơn có giá hay danh mục giá');
    ok(!/price|3000000|9\.000\.000|amount/.test(w8.job) && /Tủ áo cánh lùa/.test(w8.job) && /2000 × 1500 mm|2\.000 × 1\.500 mm/.test(w8.job), 'phiếu công việc có hạng mục, kích thước, không có giá');
    ok(!/9\.000\.000|3\.000\.000/.test(w8.text) && /Việc của tôi/.test(w8.text), 'màn hình thợ không hiện số tiền');
    await shot(worker, '08-tho');

    /* 9. Ảnh hiện trường lên máy chủ chung, người khác mở được */
    const att = await sale.page.evaluate(async id => {
      const o = Store.get('orders', id);
      const cv = document.createElement('canvas'); cv.width = 400; cv.height = 300; const g = cv.getContext('2d'); g.fillStyle = '#7A4E2D'; g.fillRect(0, 0, 400, 300);
      const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
      const a = await storeFile(new File([blob], 'hien-truong.jpg', { type: 'image/jpeg' }), {}, o);
      o.attachments.push(a); touchOrder(o, 0); await Store.idle(20000); return { id: a.id, store: a.store, size: blob.size };
    }, made.id);
    ok(att.store === 'fs', 'ảnh lưu lên máy chủ chung');
    await waitFor(own.page, ([id, aid]) => Store.get('orders', id).attachments.some(a => a.id === aid), [made.id, att.id]);
    const sz = await own.page.evaluate(async ([id, aid]) => { const a = Store.get('orders', id).attachments.find(x => x.id === aid); const b = await Store.backend.getBlob(a.ref, a); return b ? b.size : 0; }, [made.id, att.id]);
    ok(sz === att.size, 'chủ mở được ảnh sale chụp', `${sz}/${att.size}`);

    /* 10. Chủ khóa sale → sale bị đẩy ra ngay */
    const sUid = await sale.page.evaluate(() => Team.uid());
    await own.page.evaluate(u => Team.setMember(u, { active: false }), sUid);
    await sale.page.waitForSelector('text=Tài khoản đã bị khóa', { timeout: 30000 });
    ok(true, 'sale bị khóa: không mở được dữ liệu nữa');
    await shot(sale, '10-bi-khoa');

    /* 11. Kế toán: thấy mọi đơn, không sửa báo giá */
    const man = await newUser(browser, 'ketoan');
    await signUp(man, 'ketoan@hungloan.vn');
    await man.page.fill('#tm-name', 'Hà kế toán'); await man.page.fill('#tm-code', codes.manager);
    await man.page.click('[data-act=tm-join]'); await ready(man);
    await waitFor(man.page, () => Store.list('orders').length === 2);
    const m11 = await man.page.evaluate(id => { S.tab = 'orders'; S.orderId = id; S.view = 'detail'; render(); return { quote: can('quote'), pay: can('pay'), html: document.body.innerHTML }; }, made.id);
    ok(!m11.quote && m11.pay && !/data-act="revise"/.test(m11.html) && !/data-act="new-quote"/.test(m11.html), 'kế toán: thấy mọi đơn, ghi thu được, không có nút sửa/lập báo giá');
    await shot(man, '11-ke-toan');

    /* 12. Chủ: màn Cài đặt có quản lý nhân viên */
    await own.page.evaluate(() => { S.tab = 'settings'; render(); });
    const hasMem = await own.page.locator('text=Nhân viên').first().isVisible();
    ok(hasMem, 'chủ thấy mục Nhân viên trong Cài đặt');
    await shot(own, '12-chu-cai-dat');

    /* 13. Đăng xuất xóa dữ liệu trên máy dùng chung */
    await man.page.evaluate(() => Team.signOut());
    await man.page.waitForSelector('#tm-email', { timeout: 30000 });
    ok(await man.page.evaluate(() => Store.list('orders').length === 0), 'đăng xuất: không còn dữ liệu trên máy');

    for (const u of [own, sale, worker, man]) ok(!u.errs.length, `không có lỗi JS (${u.name})`, u.errs.slice(0, 3).join(' | '));
  } catch (e) {
    fail++; console.log('FAIL exception', e && e.stack ? e.stack.split('\n').slice(0, 4).join(' / ') : e);
  } finally {
    await browser.close();
  }
  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})();
