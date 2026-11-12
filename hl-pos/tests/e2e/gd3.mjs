// GĐ 3 trên bản thật: danh mục → báo giá gợi ý → lãi đơn; sổ thu chi + cộng sổ; Hôm nay; nhập file sao lưu Sổ Nội Thất. Dọn sạch khi xong.
import { fileURLToPath } from 'node:url';
import { run, check, tempUser, open, sql, vnd, rpcAs, purgeOrdersByPhone, APP } from './lib.mjs';
const PHONE = '0902' + String(Date.now()).slice(-6);
const FIXTURE = fileURLToPath(new URL('../fixtures/snt-backup.json', import.meta.url));
const CAT = 'Tủ áo cánh lùa KT' + String(Date.now()).slice(-4);
const clickMid = async (loc) => { await loc.evaluate((el) => el.scrollIntoView({ block: 'center' })); await loc.click({ timeout: 15000 }); };
const fill = async (loc, v) => { await loc.evaluate((el) => el.scrollIntoView({ block: 'center' })); await loc.fill(String(v)); };

run(async () => {
  try {
    const owner = await tempUser('owner', 'Chủ kiểm thử');
    const staff = await tempUser('staff', 'NV Kiểm thử');
    const o = await open(owner, { device: null });

    // 1. Danh mục (chủ)
    await o.goto(`${APP}/danh-muc`); await clickMid(o.locator('button:has-text("+ Thêm")'));
    await fill(o.locator('#k-name'), CAT); await o.locator('#k-unit').selectOption('m²');
    const money = o.locator('form input[inputmode="numeric"]');
    await fill(money.nth(0), '3500000'); await fill(money.nth(1), '2200000');
    await clickMid(o.locator('form button:has-text("Lưu")'));
    await o.waitForSelector(`[data-catalog="${CAT}"]`);
    check('1. chủ thêm danh mục có giá nhập', (await o.locator(`[data-catalog="${CAT}"]`).innerText()).includes('nhập 2.200.000 đ'));

    // 2. Nhân viên báo giá: gõ tên → gợi ý danh mục tự điền giá; nhân viên không thấy giá nhập
    const p = await open(staff);
    await p.goto(`${APP}/danh-muc`); await p.waitForSelector(`[data-catalog="${CAT}"]`);
    check('2a. nhân viên xem danh mục nhưng không thấy giá nhập', !(await p.locator(`[data-catalog="${CAT}"]`).innerText()).includes('nhập'));
    await p.goto(`${APP}/don-noi-that/moi/sua`); await p.waitForSelector('#q-name');
    await fill(p.locator('#q-name'), 'Chị Sổ Sách'); await fill(p.locator('#q-phone'), PHONE);
    const r1 = p.locator('[data-row="1"]');
    await fill(r1.locator('[aria-label="Tên hạng mục 1"]'), CAT.slice(0, 12));
    await clickMid(r1.locator('button', { hasText: CAT }));
    await fill(r1.locator('[aria-label="Số lượng 1"]'), '4');
    check('2b. chọn gợi ý danh mục: tự điền đơn giá → 4 m² = 14.000.000 đ', (await r1.locator('[data-amount]').innerText()) === vnd(14_000_000));
    await p.waitForSelector('[data-save-state="saved"]', { timeout: 20000 });
    await clickMid(p.locator('button:has-text("Xong")')); await p.waitForURL(/\/don-noi-that\/[0-9a-f-]{36}$/);
    const id = p.url().split('/').pop();
    await rpcAs(staff, 'close_order', { p_order_id: id, p_date: null, p_deposit: 0, p_method: 'transfer', p_sign: null });
    await p.reload(); await p.waitForSelector('[data-money]');
    check('2c. nhân viên không thấy khối Lãi đơn', (await p.locator('[data-profit-section]').count()) === 0);

    // 3. Lãi đơn (chủ): giá nhập chụp từ danh mục lúc chốt
    await o.goto(`${APP}/don-noi-that/${id}`); await o.waitForSelector('[data-profit-section]');
    await o.waitForFunction(() => document.querySelector('[data-profit-est]')?.textContent?.includes('5.200.000'), null, { timeout: 15000 }).catch(() => {});
    check('3. lãi ước tính = 14.000.000 − 4 × 2.200.000 = 5.200.000 đ', (await o.locator('[data-profit-est]').innerText()) === vnd(5_200_000), await o.locator('[data-profit-est]').innerText());

    // 4. Sổ thu chi: khoản chi gắn đơn → lãi thực
    await o.goto(`${APP}/so-thu-chi`); await clickMid(o.locator('button:has-text("+ Khoản chi")'));
    await fill(o.locator('#ce-amt'), '9000000'); await clickMid(o.locator('button', { hasText: /^Nhân công, thợ$/ }));
    await o.locator('#ce-order').selectOption(id); await fill(o.locator('#ce-note'), 'KIEMTHU');
    await clickMid(o.locator('form button:has-text("Lưu")'));
    await o.waitForSelector('[data-cash="Nhân công, thợ"]');
    check('4a. sổ thu chi tháng này có khoản chi 9.000.000 đ', (await o.locator('[data-sum-out]').innerText()).includes('9.000.000'));
    await o.goto(`${APP}/don-noi-that/${id}`); await o.waitForSelector('[data-profit-section]');
    await o.waitForFunction(() => document.querySelector('[data-profit-section]')?.textContent?.includes('lãi thực'), null, { timeout: 15000 }).catch(() => {});
    check('4b. lãi đơn có chi phí thực 9.000.000 đ → lãi thực 5.000.000 đ', (await o.locator('[data-profit-section]').innerText()).includes(`lãi thực ${vnd(5_000_000)}`));

    // 5. Cộng sổ: tháng này có đơn chốt, chi phí thực, lãi theo đơn
    await o.goto(`${APP}/cong-so`); await o.waitForSelector('text=Lãi theo đơn chốt');
    const month = (await sql(`select to_char(vn_today(), 'YYYY-MM') as m`))[0].m;
    const acc = await o.locator(`[data-acc="${month}"]`).innerText().catch(() => '');
    check('5. cộng sổ tháng này: đơn chốt 14.000.000 đ, chi phí đơn 9.000.000 đ', acc.includes(vnd(14_000_000)) && acc.includes(vnd(9_000_000)), acc.replace(/\s+/g, ' ').slice(0, 160));
    await p.goto(`${APP}/cong-so`); const blocked = await p.waitForSelector('text=Chỉ chủ cửa hàng xem được sổ sách', { timeout: 15000 }).then(() => true, () => false);
    check('5b. nhân viên vào cộng sổ bị chặn', blocked, blocked ? '' : (await p.locator('main').innerText()).slice(0, 120));

    // 6. Nhập file sao lưu Sổ Nội Thất (mẫu)
    await o.goto(`${APP}/cai-dat/nhap-so-noi-that`);
    await o.locator('input[type="file"]').setInputFiles(FIXTURE);
    await o.waitForSelector('[data-preview]');
    const pv = await o.locator('[data-preview]').innerText();
    check('6a. xem trước: 2 đơn, 2 phiếu thu, liệt kê ảnh và tiền "báo đã thu" chưa xác nhận', pv.includes('2 đơn') && pv.includes('2 phiếu thu') && pv.includes('anh-hien-trang.jpg') && pv.includes('Sale Minh'));
    await clickMid(o.locator('button:has-text("Nhập vào HL Bán Hàng")'));
    await o.waitForSelector('[data-result]', { timeout: 30000 });
    check('6b. nhập xong, đối chiếu đủ 2 đơn và số tiền khớp', (await o.locator('[data-check]').getAttribute('data-check')) === 'ok' && (await o.locator('[data-check]').innerText()).includes('Đối chiếu 2 đơn'), (await o.locator('[data-result]').innerText()).slice(0, 200));
    await o.goto(`${APP}/cai-dat/nhap-so-noi-that`); await o.locator('input[type="file"]').setInputFiles(FIXTURE);
    await clickMid(o.locator('button:has-text("Nhập vào HL Bán Hàng")')); await o.waitForSelector('[data-result]', { timeout: 30000 });
    const n = (await sql(`select count(*)::int as n from orders where legacy_id in ('o1','o2')`))[0].n;
    check('6c. nhập lại cùng file không tạo trùng', n === 2 && (await o.locator('[data-result]').innerText()).includes('Đã có từ trước (bỏ qua): 2 đơn'));

    // 7. Hôm nay: đơn nhập về có đợt 2 hạn 01/11/2026 đã qua → quá hạn
    await p.goto(`${APP}/don-noi-that`); await p.waitForSelector('[data-today]');
    const today = await p.locator('[data-today]').innerText();
    check('7. Hôm nay: hiện đơn quá hạn thu (Chị Lan) và báo giá cần gọi lại (Anh Tuấn)', today.includes('Quá hạn thu') && today.includes('Chị Lan') && today.includes('Cần gọi lại') && today.includes('Anh Tuấn'));
    await p.screenshot({ path: `${process.argv[2] ?? '.'}/hom-nay.png`, fullPage: true });
    await o.goto(`${APP}/cong-so`); await o.waitForSelector('text=Lãi theo đơn chốt');
    await o.screenshot({ path: `${process.argv[2] ?? '.'}/cong-so.png`, fullPage: true });
  } finally {
    for (const ph of [PHONE, '0912 111 222', '0912 333 444']) await purgeOrdersByPhone(ph).catch((e) => console.log('!!! dọn đơn lỗi: ' + e.message));
    await sql(`delete from cash_entries where legacy_id in ('t1','t2') or note = 'KIEMTHU';
               delete from catalog where legacy_id in ('k1','k2') or name like 'Tủ áo cánh lùa KT%';
               delete from customers where legacy_id in ('c1','c2');`).catch((e) => console.log('!!! dọn sổ lỗi: ' + e.message));
    console.log(JSON.stringify((await sql(`select (select count(*) from orders) as don, (select count(*) from customers) as khach, (select count(*) from catalog) as dm, (select count(*) from cash_entries) as so`))[0]));
  }
});
