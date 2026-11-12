// GĐ 2 trên bản thật: bản sửa, phát sinh, chữ ký, nghiệm thu, ghi chú, ảnh. Đơn và tài khoản thử bị xóa khi xong.
import { writeFileSync } from 'node:fs';
import { run, check, tempUser, open, sql, vnd, pdfInfo, rpcAs, signOn, purgeOrdersByPhone, APP } from './lib.mjs';
const OUT = process.argv[2] ?? '.';
const PHONE = '0901' + String(Date.now()).slice(-6);
const clickMid = async (loc) => { await loc.evaluate((el) => el.scrollIntoView({ block: 'center' })); await loc.click({ timeout: 15000 }); };
const fill = async (loc, v) => { await loc.evaluate((el) => el.scrollIntoView({ block: 'center' })); await loc.fill(String(v)); };
const plan = [{ id: 'd1', label: 'Đặt cọc khi ký hợp đồng', pct: 50, trigger: 'sign' }, { id: 'd2', label: 'Khi bắt đầu lắp đặt', pct: 40, trigger: 'progress' }, { id: 'd3', label: 'Sau nghiệm thu, bàn giao', pct: 0, trigger: 'accept' }];

run(async () => {
  try {
    const staff = await tempUser('staff', 'NV Kiểm thử');
    const q = { date: '2026-11-12', customer: { name: 'Anh Kiểm Thử', phone: PHONE, address: 'Hà Lâm' }, project: 'Phòng ngủ', note: '', terms: '', validUntil: '',
      rows: [{ id: 'r1', name: 'Tủ áo', material: 'MDF', unit: 'bộ', qty: 1, price: 40_000_000, dims: null }], discount: { type: 'amount', value: 0 }, plan };
    const d = await rpcAs(staff, 'save_quote_draft', { p_order_id: null, p_quote: q, p_rev: null });
    await rpcAs(staff, 'close_order', { p_order_id: d.order_id, p_date: '2026-11-12', p_deposit: 20_000_000, p_method: 'transfer', p_sign: null });
    const id = d.order_id;
    const p = await open(staff);
    await p.goto(`${APP}/don-noi-that/${id}`); await p.waitForSelector('[data-money]');

    // 1. Bản sửa 2 có chữ ký khách
    await clickMid(p.locator('button:has-text("Sửa báo giá (tạo bản 2)")'));
    await p.waitForURL(/\/sua$/); await p.waitForSelector('[data-row="1"]');
    await clickMid(p.locator('button:has-text("+ Thêm hạng mục")'));
    const r2 = p.locator('[data-row="2"]');
    await fill(r2.locator('[aria-label="Tên hạng mục 2"]'), 'Kệ sách'); await r2.locator('[aria-label="Đơn vị 2"]').selectOption('bộ');
    await fill(r2.locator('[aria-label="Số lượng 2"]'), '1'); await fill(r2.locator('input[inputmode="numeric"]'), '5000000');
    await p.waitForSelector('[data-save-state="saved"]', { timeout: 20000 });
    await clickMid(p.locator('button:has-text("Xong")')); await p.waitForSelector('text=Đang soạn');
    check('1a. trang đơn báo đang soạn bản 2, tiền đơn chưa đổi', (await p.locator('[data-due]').innerText()) === vnd(20_000_000));
    await clickMid(p.locator('button:has-text("Chốt bản 2")'));
    await signOn(p);
    await clickMid(p.locator('form button:has-text("Chốt bản 2")'));
    await p.waitForSelector('text=Bản 2 · chốt', { timeout: 20000 });
    const [v2] = await sql(`select total, sign->>'hash' as h, sign->>'img' like 'data:image/png%' as img from order_quotes where order_id = '${id}' and version_no = 2`);
    check('1b. chốt bản 2: 45.000.000 đ, có chữ ký và mã xác nhận', Number(v2.total) === 45_000_000 && /^[0-9A-F]{16}$/.test(v2.h) && v2.img, JSON.stringify({ ...v2 }));
    check('1c. còn nợ theo bản 2 = 25.000.000 đ', (await p.locator('[data-due]').innerText()) === vnd(25_000_000));

    // 2. Phát sinh: chờ → xác nhận có ký
    await clickMid(p.locator('button:has-text("+ Thêm phát sinh")'));
    await fill(p.locator('#ch-title'), 'Thêm đèn LED tủ'); await fill(p.locator('#ch-amt'), '2400000');
    await clickMid(p.locator('form button:has-text("Lưu phát sinh")'));
    await p.waitForSelector('[data-change="pending"]');
    check('2a. phát sinh chờ xác nhận chưa tính vào còn nợ', (await p.locator('[data-due]').innerText()) === vnd(25_000_000));
    await clickMid(p.locator('[data-change="pending"] button:has-text("Xác nhận")'));
    await signOn(p);
    await clickMid(p.locator('form button:has-text("Xác nhận phát sinh")'));
    await p.waitForSelector('[data-change="confirmed"]');
    check('2b. xác nhận phát sinh: còn nợ 27.400.000 đ, đợt 3 tăng thêm', (await p.locator('[data-due]').innerText()) === vnd(27_400_000) && (await p.locator('[data-plan-row="3"]').innerText()).includes(vnd(4_500_000 + 2_400_000)));

    // 3. Nghiệm thu có ký → Hoàn thành, đợt 3 đến hạn
    await clickMid(p.locator('button', { hasText: /^Nghiệm thu$/ }));
    check('3a. bảo hành mặc định 36 tháng', (await p.locator('#hv-m').inputValue()) === '36');
    await signOn(p);
    await clickMid(p.locator('form button:has-text("Lưu nghiệm thu")'));
    await p.waitForSelector('[data-handover]');
    const st3 = await p.locator('[data-plan-row="3"] [data-state]').getAttribute('data-state');
    const [o] = await sql(`select status, handover->>'warrantyUntil' as w, handover->'sign'->>'hash' as h from orders where id = '${id}'`);
    check('3b. đơn Hoàn thành, có hạn bảo hành và chữ ký; đợt 3 Đến hạn', o.status === 'done' && /^\d{4}-\d{2}-\d{2}$/.test(o.w) && !!o.h && st3 === 'due', JSON.stringify({ ...o, st3 }));

    // 4. Giấy tờ in
    const dk = await open(staff, { device: null });
    await dk.goto(`${APP}/in/nghiem-thu/${id}`); await dk.waitForSelector('text=BIÊN BẢN NGHIỆM THU');
    const pdf = await dk.pdf({ preferCSSPageSize: true, printBackground: true }); writeFileSync(`${OUT}/bien-ban-nghiem-thu.pdf`, pdf);
    const t4 = await dk.locator('body').innerText(), i4 = pdfInfo(pdf);
    check('4a. biên bản nghiệm thu A4 1 trang: có phát sinh, chữ ký, bảo hành', i4.pages === 1 && i4.w === 210 && t4.includes('Thêm đèn LED tủ') && t4.includes('36 tháng') && (await dk.locator('img[alt="Chữ ký"]').count()) === 1, JSON.stringify(i4));
    await dk.goto(`${APP}/in/bao-gia/${id}?ban=1`); await dk.waitForSelector('text=BÁO GIÁ');
    check('4b. in lại bản 1: đóng dấu "ĐÃ ĐƯỢC THAY BẰNG BẢN 2", tổng 40.000.000 đ', (await dk.locator('body').innerText()).includes('ĐÃ ĐƯỢC THAY BẰNG BẢN 2') && (await dk.locator('body').innerText()).includes(vnd(40_000_000)));
    await dk.goto(`${APP}/in/bao-gia/${id}`); await dk.waitForSelector('text=BÁO GIÁ (BẢN 2)');
    const pdfq = await dk.pdf({ preferCSSPageSize: true, printBackground: true }); writeFileSync(`${OUT}/bao-gia-ban-2.pdf`, pdfq);
    check('4c. báo giá bản 2 có chữ ký khách', (await dk.locator('img[alt="Chữ ký"]').count()) === 1);

    // 5. Ghi chú
    await fill(p.locator('[aria-label="Ghi chú mới"]'), 'Khách hẹn bảo dưỡng bản lề sau 6 tháng');
    await clickMid(p.locator('form:has([aria-label="Ghi chú mới"]) button:has-text("Lưu")'));
    await p.waitForSelector('text=Khách hẹn bảo dưỡng bản lề sau 6 tháng');
    check('5. thêm ghi chú', true);

    // 6. Ảnh: ảnh lớn được thu nhỏ ≤ 2000 px rồi tải lên; xóa thì mất cả file
    const big = await p.screenshot({ fullPage: true }); // ảnh PNG cao hơn 2000 px
    await p.locator('input[type="file"][accept="image/*"]').last().setInputFiles({ name: 'cong-trinh.png', mimeType: 'image/png', buffer: big });
    await p.waitForSelector('[data-photo] img', { timeout: 30000 });
    await p.waitForFunction(() => document.querySelector('[data-photo] img')?.naturalWidth > 0, null, { timeout: 15000 });
    const dim = await p.locator('[data-photo] img').evaluate((im) => [im.naturalWidth, im.naturalHeight]);
    const [obj] = await sql(`select count(*)::int as n, max((metadata->>'size')::int) as size from storage.objects where bucket_id = 'don-hang' and name like '${id}/%'`);
    check('6a. ảnh tải lên được thu nhỏ (cạnh dài ≤ 2000 px), lưu đúng thư mục đơn', Math.max(...dim) <= 2000 && obj.n === 1 && obj.size < big.length, JSON.stringify({ dim, obj, goc: big.length }));
    p.once('dialog', (dlg) => dlg.accept());
    await clickMid(p.locator('[data-photo] button:has-text("Xóa")'));
    await p.waitForSelector('[data-photo]', { state: 'detached', timeout: 15000 });
    const [obj2] = await sql(`select count(*)::int as n from storage.objects where bucket_id = 'don-hang' and name like '${id}/%'`);
    check('6b. xóa ảnh: mất cả trong đơn lẫn trong kho ảnh', obj2.n === 0);
    await p.screenshot({ path: `${OUT}/don-gd2.png`, fullPage: true });
  } finally {
    await purgeOrdersByPhone(PHONE).catch((e) => console.log('!!! dọn đơn thử lỗi: ' + e.message));
  }
});
