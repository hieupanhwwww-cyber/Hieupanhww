// Bán thử bán lẻ + kho trên bản thật (cần hàng mẫu MAU-* từ supabase/seed.sql, kho chưa bán gì).
// Dùng: tests/e2e/run.sh ban-thu.mjs <thư mục lưu ảnh/PDF>
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync } from 'node:fs';
import { run, check, tempUser, open, sql, restAs, vnd, pdfInfo, APP } from './lib.mjs';
const ExcelJS = createRequire(new URL('../../package.json', import.meta.url))('exceljs');
const OUT = process.argv[2] ?? '.';
const N = { TAB: '[Mẫu] Tab đầu giường 2 ngăn', BTP: '[Mẫu] Bàn trang điểm có gương', KE: '[Mẫu] Kệ treo tường 1200mm', GHE: '[Mẫu] Ghế đôn bọc nỉ', MDF: '[Mẫu] Ván MDF chống ẩm 17mm', BL: '[Mẫu] Bản lề giảm chấn', RAY: '[Mẫu] Ray bi 450mm' };
const stock = async () => Object.fromEntries((await sql(`select p.code, s.stock::float8 as stock from products p join product_stock s on s.product_id = p.id`)).map((r) => [r.code, r.stock]));
// Cuộn nút ra giữa màn hình trước khi bấm (như người dùng), tránh nút Netlify ở góc dưới phải
const clickMid = async (loc) => { await loc.evaluate((el) => el.scrollIntoView({ block: 'center' })); await loc.click({ timeout: 10000 }); };
const tap = (page, name) => clickMid(page.locator('button', { hasText: name }).first());
const pay = async (page) => { await clickMid(page.locator('button:has-text("Thanh toán")')); await page.waitForURL('**/hoa-don/**', { timeout: 30000 }); await page.waitForSelector('text=HÓA ĐƠN BÁN HÀNG', { timeout: 30000 }); };

run(async () => {
  const before = await stock();
  check('kho mẫu còn nguyên trước khi thử', before['MAU-TAB01'] === 10 && before['MAU-GHE01'] === 10, JSON.stringify(before));
  const owner = await tempUser('owner');
  const staff = await tempUser('staff', 'NV Kiểm thử');

  // 1. Nhân viên bán lẻ đúng 4 chạm
  const p = await open(staff);
  await p.waitForSelector(`text=${N.TAB}`);
  await tap(p, N.TAB); await tap(p, N.KE);
  const wide = await p.evaluate(() => ({ doc: document.documentElement.scrollWidth, vw: window.screen.width }));
  check('1a. giỏ có món tên dài: trang không tràn ngang trên điện thoại', wide.doc <= wide.vw, JSON.stringify(wide));
  if (wide.doc > wide.vw) throw new Error('trang tràn ngang, dừng để sửa');
  await clickMid(p.locator('button:has-text("Chuyển khoản")')); await pay(p);
  const inv1 = await p.locator('body').innerText();
  check('1. bán 4 chạm → hóa đơn HD000001, tổng 1.650.000 đ, chuyển khoản', /HD000001/.test(inv1) && inv1.includes(vnd(1650000)) && inv1.includes('Chuyển khoản'));
  await p.screenshot({ path: `${OUT}/hoa-don-dien-thoai.png`, fullPage: true });

  // 2. Giảm giá
  await p.goto(`${APP}/ban-hang`); await p.waitForSelector(`text=${N.GHE}`);
  await tap(p, N.GHE); await tap(p, N.GHE); await p.fill('#discount', '50000');
  const cartTxt = await p.locator('section', { hasText: 'Giỏ hàng' }).innerText();
  check('2a. giỏ hiện Khách trả 650.000 đ', cartTxt.includes(vnd(650000)));
  await p.screenshot({ path: `${OUT}/ban-hang.png`, fullPage: true });
  await pay(p);
  check('2b. hóa đơn 2 có giảm giá 50.000, tổng 650.000 đ', (await p.locator('body').innerText()).includes(vnd(650000)));

  // 3. Kho tự trừ
  const s2 = await stock();
  check('3. kho tự trừ: TAB 9, KE 9, GHE 8', s2['MAU-TAB01'] === 9 && s2['MAU-KE01'] === 9 && s2['MAU-GHE01'] === 8, JSON.stringify(s2));

  // 4. Bán quá tồn bị chặn ngay trên giao diện
  await p.goto(`${APP}/ban-hang`); await p.waitForSelector(`text=${N.BTP}`);
  await tap(p, N.BTP);
  await p.locator('section', { hasText: 'Giỏ hàng' }).locator('input[inputmode="decimal"]').fill('11');
  check('4. SL 11 > tồn 10: nút Thanh toán khóa + báo không đủ tồn', (await p.locator('button:has-text("Thanh toán")').isDisabled()) && (await p.locator('text=Không đủ tồn kho').count()) > 0);

  // 5. Hóa đơn 7 dòng in A5
  await p.goto(`${APP}/ban-hang`); await p.waitForSelector(`text=${N.RAY}`);
  for (const n of Object.values(N)) await tap(p, n);
  await pay(p);
  const invUrl = p.url();
  await p.emulateMedia({ media: 'print' });
  const pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
  await p.emulateMedia({ media: 'screen' });
  writeFileSync(`${OUT}/hoa-don-A5.pdf`, pdf);
  const info = pdfInfo(pdf), t5 = await p.locator('body').innerText();
  check('5. hóa đơn 7 dòng in ra 1 trang A5 (148×210), có tên cửa hàng và SĐT', info.pages === 1 && info.w === 148 && info.h === 210 && /Nội Thất Hùng Loan/i.test(t5) && t5.includes('0916.771.586'), JSON.stringify(info));

  // 6. Ảnh gửi Zalo (máy tính: tải file PNG)
  const d = await open(staff, { device: null });
  await d.goto(invUrl); await d.waitForSelector('text=HÓA ĐƠN BÁN HÀNG');
  const [dl] = await Promise.all([d.waitForEvent('download', { timeout: 30000 }), d.click('button:has-text("Gửi ảnh Zalo")')]);
  const png = `${OUT}/hoa-don-zalo.png`; await dl.saveAs(png);
  check('6. nút Gửi ảnh Zalo tạo file HD…png > 10 KB', /^HD\d+\.png$/.test(dl.suggestedFilename()) && readFileSync(png).length > 10000, dl.suggestedFilename());

  // 7. Nhân viên không thấy giá vốn
  await d.goto(`${APP}/hang-hoa`); await d.waitForSelector(`text=${N.TAB}`);
  const staffCosts = await restAs(staff, 'product_costs?select=*');
  const staffSaleCosts = await restAs(staff, 'sale_item_costs?select=*');
  check('7. nhân viên: trang Hàng hóa không có chữ "vốn"; gọi thẳng API giá vốn trả rỗng', !(await d.locator('main').innerText()).includes('vốn') && Array.isArray(staffCosts.body) && staffCosts.body.length === 0 && staffSaleCosts.body.length === 0);
  const staffReport = await restAs(staff, 'rpc/report_low_stock');
  check('7b. nhân viên gọi thẳng báo cáo bị từ chối', staffReport.status >= 400, `HTTP ${staffReport.status}`);

  // 9. Báo cáo của chủ (3 hóa đơn: 1.650.000 + 650.000 + 4.500.000; giá vốn 1.000.000 + 400.000 + 3.265.000)
  const o = await open(owner, { device: null });
  await o.goto(`${APP}/bao-cao`); await o.waitForSelector('text=Doanh thu bán lẻ');
  await o.waitForFunction((t) => document.body.innerText.includes(t), vnd(6800000), { timeout: 20000 }).catch(() => {});
  const rep = await o.locator('main').innerText();
  check('9. báo cáo: doanh thu 6.800.000 đ, lợi nhuận 2.135.000 đ, 3 hóa đơn', rep.includes(vnd(6800000)) && rep.includes(vnd(2135000)) && rep.includes('3 hóa đơn'));
  await o.screenshot({ path: `${OUT}/bao-cao.png`, fullPage: true });
  await o.goto(`${APP}/hang-hoa`); await o.waitForSelector(`text=${N.TAB}`);
  check('9b. chủ thấy giá vốn ở Hàng hóa', (await o.locator('main').innerText()).includes('vốn 750.000 đ'));

  // 10. Xuất Excel
  await o.goto(`${APP}/bao-cao`); await o.waitForSelector('text=Xuất Excel sao lưu');
  const [x] = await Promise.all([o.waitForEvent('download', { timeout: 60000 }), o.click('button:has-text("Xuất Excel sao lưu")')]);
  const xp = `${OUT}/sao-luu.xlsx`; await x.saveAs(xp);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(xp);
  const hd = wb.getWorksheet('Hóa đơn');
  check('10. file sao lưu Excel đúng tên, có sheet Hóa đơn với 3 hóa đơn', /^HL-POS-sao-luu-\d{4}-\d{2}-\d{2}\.xlsx$/.test(x.suggestedFilename()) && hd && hd.rowCount === 4, `${x.suggestedFilename()} · ${wb.worksheets.length} sheet · ${hd?.rowCount} dòng`);

  // 11. Mất mạng
  await p.goto(`${APP}/ban-hang`); await p.waitForSelector(`text=${N.TAB}`); await tap(p, N.TAB);
  await p.context().setOffline(true); await p.waitForTimeout(500);
  const off = (await p.locator('text=Mất mạng').count()) > 0 && (await p.locator('section', { hasText: 'Giỏ hàng' }).locator('button').last().isDisabled());
  await p.context().setOffline(false); await p.waitForTimeout(500);
  check('11. mất mạng: hiện thanh đỏ, khóa Thanh toán; có mạng lại thì mở', off && (await p.locator('[role="alert"]').count()) === 0 && !(await p.locator('button:has-text("Thanh toán")').isDisabled()));

  const end = await stock();
  check('kho cuối cùng khớp 3 hóa đơn', end['MAU-TAB01'] === 8 && end['MAU-KE01'] === 8 && end['MAU-GHE01'] === 7 && end['MAU-BTP01'] === 9 && end['MAU-MDF17'] === 29 && end['MAU-BL01'] === 99 && end['MAU-RAY45'] === 39, JSON.stringify(end));
});
