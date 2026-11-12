// Dùng chung cho các script kiểm thử trên BẢN THẬT (không nằm trong `npm test`).
// Tạo tài khoản thử tạm kiemthu-*@hlpos.test và LUÔN xóa khi xong.
// Cần: SB_SECRET (khóa bí mật Supabase) hoặc mã Management API do proxy chèn sẵn.
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright'); // Playwright cài sẵn toàn máy
import crypto from 'node:crypto';

export const APP = process.env.APP_URL ?? 'https://profound-taiyaki-e22af3.netlify.app';
export const REF = process.env.SB_REF ?? 'jqcgaalecfjfibqyglkz';
export const SB = `https://${REF}.supabase.co`;
const MGMT = `https://api.supabase.com/v1/projects/${REF}`;
const mgmtHeaders = { Authorization: `Bearer ${process.env.SB_ACCESS_TOKEN ?? 'proxy-injected'}`, 'content-type': 'application/json' };

let secret = process.env.SB_SECRET;
async function key() {
  if (!secret) {
    const ks = await (await fetch(`${MGMT}/api-keys?reveal=true`, { headers: mgmtHeaders })).json();
    secret = (ks.find((k) => k.type === 'secret') ?? ks.find((k) => k.name === 'service_role'))?.api_key;
    if (!secret) throw new Error('Không lấy được khóa bí mật Supabase');
  }
  return secret;
}
const admin = async (path, opt = {}) => {
  const k = await key();
  const r = await fetch(`${SB}/auth/v1/admin/${path}`, { ...opt, headers: { apikey: k, Authorization: `Bearer ${k}`, 'content-type': 'application/json' } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

/** Chạy SQL trên bản thật (Management API). */
export async function sql(query) {
  const r = await fetch(`${MGMT}/database/query`, { method: 'POST', headers: mgmtHeaders, body: JSON.stringify({ query }) });
  const body = await r.json();
  if (r.status >= 300) throw new Error(`SQL lỗi ${r.status}: ${JSON.stringify(body).slice(0, 300)}`);
  return body;
}

const tag = crypto.randomBytes(4).toString('hex');
const createdIds = [];
export async function tempUser(role, name) {
  const u = { email: `kiemthu-${role}-${tag}-${createdIds.length}@hlpos.test`, password: crypto.randomBytes(12).toString('base64url') };
  const r = await admin('users', { method: 'POST', body: JSON.stringify({ ...u, email_confirm: true, app_metadata: { hl_staff: true }, user_metadata: { full_name: name ?? `Kiểm thử ${role} (xóa)` } }) });
  if (r.status >= 300) throw new Error(`Tạo tài khoản thử lỗi ${r.status}`);
  createdIds.push(r.body.id);
  if (role === 'owner') await sql(`update public.profiles set role = 'owner' where id = '${r.body.id}'`);
  return { ...u, id: r.body.id };
}
export async function cleanupUsers() {
  const list = await admin('users?per_page=500');
  for (const x of list.body.users ?? []) if (x.email?.includes(`-${tag}-`) && !createdIds.includes(x.id)) createdIds.push(x.id);
  let ok = true;
  for (const id of createdIds) { const d = await admin(`users/${id}`, { method: 'DELETE' }); if (d.status !== 200) ok = false; }
  console.log(ok ? `(đã xóa ${createdIds.length} tài khoản thử)` : '!!! CÒN SÓT TÀI KHOẢN THỬ, cần xóa tay');
}

let browser;
export async function open(user, { device = 'iPhone 13', ...ctxOpt } = {}) {
  browser ??= await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {});
  const ctx = await browser.newContext({ ...(device ? devices[device] : { viewport: { width: 1280, height: 900 } }), ignoreHTTPSErrors: true, acceptDownloads: true, ...ctxOpt });
  const page = await ctx.newPage();
  await page.goto(`${APP}/login`);
  await page.fill('#email', user.email);
  await page.fill('#pw', user.password);
  await page.click('button:has-text("Đăng nhập")');
  await page.waitForURL('**/ban-hang', { timeout: 30000 });
  await page.waitForSelector('text=Giỏ hàng', { timeout: 30000 });
  return page;
}

let failed = 0;
export function check(name, ok, detail = '') {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}
/** Bọc toàn bộ kịch bản: luôn dọn tài khoản thử, exit code ≠ 0 nếu có FAIL. */
export async function run(fn) {
  try { await fn(); } catch (e) { failed++; console.log('FAIL  (dừng giữa chừng) ' + String(e.message).split('\n').slice(0, 12).join('\n      ')); }
  finally { await cleanupUsers().catch((e) => console.log('!!! lỗi khi dọn: ' + e.message)); await browser?.close(); process.exit(failed ? 1 : 0); }
}

export const PUBLISHABLE = process.env.SB_PUBLISHABLE ?? 'sb_publishable_bQgmnnUkyJIvt1ttus1cSw_-kO1FABU'; // khóa công khai
/** Gọi thẳng API dữ liệu bằng phiên của một tài khoản (để thử "lách giao diện"). */
export async function restAs(user, path) {
  const t = await (await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUBLISHABLE, 'content-type': 'application/json' }, body: JSON.stringify({ email: user.email, password: user.password }) })).json();
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${t.access_token}` } });
  return { status: r.status, body: await r.json().catch(() => null) };
}
export const vnd = (n) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} đ`;
/** Số trang và khổ giấy (mm) của một file PDF do Chromium in ra. */
export function pdfInfo(buf) {
  const s = buf.toString('latin1');
  const pages = (s.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  const m = s.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/);
  const mm = (pt) => Math.round((Number(pt) / 72) * 25.4);
  return { pages, w: m ? mm(m[3]) : 0, h: m ? mm(m[4]) : 0 };
}

/** Gọi hàm RPC bằng phiên của một tài khoản (để dựng dữ liệu nhanh cho kịch bản). */
export async function rpcAs(user, fn, args) {
  user._token ??= (await (await fetch(`${SB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUBLISHABLE, 'content-type': 'application/json' }, body: JSON.stringify({ email: user.email, password: user.password }) })).json()).access_token;
  const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${user._token}`, 'content-type': 'application/json' }, body: JSON.stringify(args) });
  const body = await r.json().catch(() => null);
  if (r.status >= 300) throw new Error(`${fn}: ${JSON.stringify(body)}`);
  return body;
}
/** Ký vào ô ký tên (canvas) trong hộp thoại đang mở. */
export async function signOn(page) {
  const c = page.locator('canvas[aria-label="Ô ký tên"]');
  await c.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const b = await c.boundingBox();
  await page.mouse.move(b.x + 20, b.y + b.height * 0.6); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(b.x + 20 + i * 18, b.y + b.height * (0.6 - 0.3 * Math.sin(i / 2)));
  await page.mouse.up();
}
/** Xóa một đơn thử và mọi thứ gắn với nó (kể cả ảnh trong Storage). */
export async function purgeOrdersByPhone(phone) {
  const files = await sql(`select name from storage.objects where bucket_id = 'don-hang' and split_part(name, '/', 1) in (select id::text from orders where customer_phone = '${phone}')`);
  if (files.length) {
    const k = await key();
    await fetch(`${SB}/storage/v1/object/don-hang`, { method: 'DELETE', headers: { apikey: k, Authorization: `Bearer ${k}`, 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: files.map((f) => f.name) }) });
  }
  await sql(`delete from order_changes where order_id in (select id from orders where customer_phone = '${phone}');
    delete from order_payments where order_id in (select id from orders where customer_phone = '${phone}');
    update stock_movements set order_id = null where order_id in (select id from orders where customer_phone = '${phone}');
    delete from orders where customer_phone = '${phone}';
    delete from customers where phone = '${phone}';`);
  const left = await sql(`select count(*)::int as n from orders where customer_phone = '${phone}'`);
  console.log(left[0].n === 0 ? '(đã xóa đơn thử)' : '!!! CÒN SÓT ĐƠN THỬ');
}
