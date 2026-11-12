// GĐ 1 trên bản thật: báo giá → chốt → thu tiền → in → báo cáo. Đơn thử và tài khoản thử bị xóa khi xong.
// Dùng: tests/e2e/run.sh gd1.mjs <thư mục lưu ảnh/PDF>
import { writeFileSync } from 'node:fs';
import { run, check, tempUser, open, sql, vnd, pdfInfo, APP } from './lib.mjs';
const OUT = process.argv[2] ?? '.';
const PHONE = '0900' + String(Date.now()).slice(-6);
const clickMid = async (loc) => { await loc.evaluate((el) => el.scrollIntoView({ block: 'center' })); await loc.click({ timeout: 15000 }); };
const fill = async (loc, v) => { await loc.evaluate((el) => el.scrollIntoView({ block: 'center' })); await loc.fill(String(v)); };
// số tính tay: 2400×600mm×2 = 2,88 m² × 3.500.000 = 10.080.000; 8.000.000; 2 × 1.200.000; giảm 5%
const SUB = 10_080_000 + 8_000_000 + 2_400_000, TOTAL = SUB - Math.round(SUB * 0.05);
const D1 = Math.round(TOTAL * 0.5), D2 = Math.round(TOTAL * 0.4), D3 = TOTAL - D1 - D2;

let bankBefore = null;
run(async () => {
  try {
    [bankBefore] = await sql(`select bank_bin, bank_name, bank_account, bank_holder from store_settings`);
    if (!bankBefore.bank_bin) await sql(`update store_settings set bank_bin = '970436', bank_name = 'Vietcombank', bank_account = '0011000000000', bank_holder = 'KIEM THU'`);
    const staff = await tempUser('staff', 'NV Kiểm thử');
    const owner = await tempUser('owner');
    const p = await open(staff);

    // 1. Lập báo giá
    await p.goto(`${APP}/don-noi-that`); await clickMid(p.locator('a:has-text("Báo giá mới")'));
    await p.waitForSelector('#q-name');
    await fill(p.locator('#q-name'), 'Chị Kiểm Thử'); await fill(p.locator('#q-phone'), PHONE);
    await fill(p.locator('#q-project'), 'Phòng ngủ master');
    const r1 = p.locator('[data-row="1"]');
    await fill(r1.locator('[aria-label="Tên hạng mục 1"]'), 'Tủ áo cánh lùa');
    await clickMid(r1.locator('button:has-text("Tính số lượng từ kích thước")'));
    await fill(r1.locator('[aria-label="Dài 1"]'), '2400'); await fill(r1.locator('[aria-label="Rộng 1"]'), '600'); await fill(r1.locator('[aria-label="Số cái 1"]'), '2');
    await fill(r1.locator('input[inputmode="numeric"]'), '3500000');
    check('1a. dòng tính theo kích thước: 2,88 m² → 10.080.000 đ', (await r1.locator('[data-amount]').innerText()) === vnd(10_080_000), await r1.locator('[data-amount]').innerText());
    const addRow = async (i, name, unit, qty, price) => {
      await clickMid(p.locator('button:has-text("+ Thêm hạng mục")'));
      const r = p.locator(`[data-row="${i}"]`);
      await fill(r.locator(`[aria-label="Tên hạng mục ${i}"]`), name);
      await r.locator(`[aria-label="Đơn vị ${i}"]`).selectOption(unit);
      await fill(r.locator(`[aria-label="Số lượng ${i}"]`), qty); await fill(r.locator('input[inputmode="numeric"]'), price);
    };
    await addRow(2, 'Giường 1m8', 'bộ', '1', '8000000');
    await addRow(3, 'Tab đầu giường', 'cái', '2', '1200000');
    await clickMid(p.locator('button', { hasText: /^%$/ })); await fill(p.locator('[aria-label="Phần trăm giảm"]'), '5');
    check('1b. tổng báo giá đúng (giảm 5%)', (await p.locator('[data-total]').innerText()) === vnd(TOTAL), `${await p.locator('[data-total]').innerText()} / mong đợi ${vnd(TOTAL)}`);
    await p.waitForSelector('[data-save-state="saved"]', { timeout: 20000 });
    check('1c. tự lưu nháp', true);
    await p.screenshot({ path: `${OUT}/bao-gia-soan.png`, fullPage: true });
    await clickMid(p.locator('button:has-text("Xong")'));
    await p.waitForURL(/\/don-noi-that\/[0-9a-f-]{36}$/, { timeout: 20000 });
    const orderId = p.url().split('/').pop();
    const [ord] = await sql(`select code, status, total from orders where id = '${orderId}'`);
    check('1d. đơn đang báo giá, mã BG…, tổng máy chủ khớp', ord.status === 'quote' && /^BG\d{4}-\d{2}$/.test(ord.code) && Number(ord.total) === TOTAL, JSON.stringify(ord));

    // 2. In báo giá (máy tính, A4)
    const d = await open(staff, { device: null });
    await d.goto(`${APP}/in/bao-gia/${orderId}?ban=nhap`); await d.waitForSelector('text=Tiến độ thanh toán');
    await d.emulateMedia({ media: 'print' });
    const pdf = await d.pdf({ preferCSSPageSize: true, printBackground: true });
    writeFileSync(`${OUT}/bao-gia-A4.pdf`, pdf);
    const info = pdfInfo(pdf), txt = await d.locator('body').innerText();
    check('2. báo giá in A4 1 trang, có tổng, 3 đợt, bằng chữ', info.pages === 1 && info.w === 210 && info.h === 297 && txt.includes(vnd(TOTAL)) && txt.includes(vnd(D1)) && txt.includes(vnd(D2)) && txt.includes(vnd(D3)) && /Bằng chữ: .+ đồng\./.test(txt), JSON.stringify(info));

    // 3. Chốt đơn, cọc đợt 1 chuyển khoản
    await p.reload(); await p.waitForSelector('[data-quote-total]');
    await clickMid(p.locator('button:has-text("Chốt đơn")').first());
    const dep = await p.locator('#c-dep').inputValue();
    check('3a. gợi ý tiền cọc = đợt 1', dep.replace(/\./g, '') === String(D1), dep);
    const submit = p.locator('form button:has-text("Chốt đơn")');
    await submit.evaluate((el) => el.scrollIntoView({ block: 'end' }));
    check('3a2. điện thoại: nút Chốt đơn trong hộp thoại không bị nút Netlify che', await submit.evaluate((b) => { const r = b.getBoundingClientRect(); return [0.1, 0.5, 0.9].every((f) => { const el = document.elementFromPoint(r.x + r.width * f, r.y + r.height / 2); return el === b || b.contains(el); }); }));
    await clickMid(submit);
    await p.waitForSelector('[data-money]', { timeout: 20000 });
    const states = async () => p.locator('[data-plan-row] [data-state]').evaluateAll((els) => els.map((e) => e.dataset.state));
    check('3b. đã chốt: đợt 1 Đã thu, đợt 2 và 3 chưa đến hạn', JSON.stringify(await states()) === '["paid","later","later"]', JSON.stringify(await states()));
    check('3c. còn nợ = đợt 2 + đợt 3', (await p.locator('[data-due]').innerText()) === vnd(D2 + D3));

    // 4. Bắt đầu thi công → đợt 2 đến hạn, có mã VietQR đúng số tiền
    await clickMid(p.locator('button:has-text("Đang thi công")'));
    await p.waitForFunction(() => document.querySelector('[data-plan-row="2"] [data-state]')?.dataset.state === 'due', null, { timeout: 15000 });
    const qr = await p.locator('[data-plan-row="2"] img[data-qr]').getAttribute('data-qr').catch(() => null);
    check('4. thi công: đợt 2 Đến hạn, có VietQR đúng số tiền và nội dung', !!qr && qr.includes(`54${String(D2).length.toString().padStart(2, '0')}${D2}`) && qr.includes(ord.code.replace('-', '') + ' D2'), qr?.slice(0, 80));
    await p.screenshot({ path: `${OUT}/don-da-chot.png`, fullPage: true });

    // 5. Thu đợt 2 → phiếu thu số 02
    await clickMid(p.locator('[data-plan-row="2"] button', { hasText: 'Thu ' }));
    await clickMid(p.locator('form button:has-text("Ghi phiếu thu")'));
    await p.waitForURL(/\/in\/phieu-thu\//, { timeout: 20000 }); await p.waitForSelector('text=PHIẾU THU');
    const rc = await p.locator('body').innerText();
    check('5a. phiếu thu PT-<mã>-02, đúng số tiền, còn lại = đợt 3', rc.includes(`PT-${ord.code}-02`) && rc.includes(vnd(D2)) && rc.includes(vnd(D3)));
    await d.goto(p.url().replace('&moi=1', '')); await d.waitForSelector('text=PHIẾU THU');
    const pdf2 = await d.pdf({ preferCSSPageSize: true, printBackground: true });
    writeFileSync(`${OUT}/phieu-thu-A5.pdf`, pdf2);
    const i2 = pdfInfo(pdf2);
    check('5b. phiếu thu in 1 trang A5', i2.pages === 1 && i2.w === 148 && i2.h === 210, JSON.stringify(i2));

    // 6. Danh sách đơn
    await p.goto(`${APP}/don-noi-that`); await p.waitForSelector(`[data-order="${ord.code}"]`);
    check('6. danh sách: thẻ đơn Đang thi công, đợt kế tiếp = đợt 3', (await p.locator(`[data-order="${ord.code}"]`).innerText()).includes(`Đợt 3: ${vnd(D3)}`));

    // 7. Báo cáo của chủ
    const o = await open(owner, { device: null });
    await o.goto(`${APP}/bao-cao`); await o.waitForSelector('text=Thu từ đơn nội thất');
    await o.waitForFunction((t) => document.body.innerText.includes(t), vnd(D3), { timeout: 20000 }).catch(() => {});
    const rep = await o.locator('main').innerText();
    check('7. báo cáo: thu từ đơn = cọc + đợt 2; khách còn nợ = đợt 3', rep.includes(vnd(D1 + D2)) && rep.includes(vnd(D3)) && rep.includes('Chị Kiểm Thử'));
    await o.screenshot({ path: `${OUT}/bao-cao-gd1.png`, fullPage: true });
  } finally {
    await sql(`delete from order_payments where order_id in (select id from orders where customer_phone = '${PHONE}');
               delete from orders where customer_phone = '${PHONE}';
               delete from customers where phone = '${PHONE}';`).catch((e) => console.log('!!! dọn đơn thử lỗi: ' + e.message));
    if (bankBefore && !bankBefore.bank_bin) await sql(`update store_settings set bank_bin = '', bank_name = '', bank_account = '', bank_holder = ''`);
    const left = await sql(`select count(*)::int as n from orders where customer_phone = '${PHONE}'`);
    console.log(left[0].n === 0 ? '(đã xóa đơn thử)' : '!!! CÒN SÓT ĐƠN THỬ');
  }
});
