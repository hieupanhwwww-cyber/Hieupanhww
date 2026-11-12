// Menu trên điện thoại không được bị nút "Powered by Netlify" che; nút Thanh toán bấm được khi cuộn hết trang.
import { run, check, tempUser, open, APP } from './lib.mjs';

run(async () => {
  const page = await open(await tempUser('owner'));
  await page.goto(`${APP}/ban-hang`);
  await page.waitForSelector('text=Giỏ hàng');
  const badge = page.locator('iframe#nl-badge-frame');
  await badge.waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});
  const bb = (await badge.count()) ? await badge.evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }) : null;
  check('tìm thấy nút Netlify (nếu Netlify bỏ nút thì kiểm tra này thừa)', !!bb);
  const links = await page.locator('nav a').evaluateAll((as) => as.map((a) => { const r = a.getBoundingClientRect(); return { t: a.textContent.trim(), x: r.x, y: r.y, w: r.width, h: r.height }; }));
  check('menu có đủ 5 mục cho chủ', links.length === 5, `${links.length} mục`);
  for (const l of links) {
    const hit = bb && l.x < bb.x + bb.w && l.x + l.w > bb.x && l.y < bb.y + bb.h && l.y + l.h > bb.y;
    check(`mục "${l.t}" không bị che`, !hit);
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  const payOk = await page.locator('button:has-text("Thanh toán")').evaluate((b) => { const r = b.getBoundingClientRect(); return [0.1, 0.5, 0.9].every((f) => { const el = document.elementFromPoint(r.x + r.width * f, r.y + r.height / 2); return el === b || b.contains(el); }); });
  check('cuộn hết trang: nút Thanh toán không bị che', payOk);
  if (process.argv[2]) await page.screenshot({ path: process.argv[2] });
});
