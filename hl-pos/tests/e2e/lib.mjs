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
  try { await fn(); } catch (e) { failed++; console.log('FAIL  (dừng giữa chừng) ' + String(e.message).split('\n')[0]); }
  finally { await cleanupUsers().catch((e) => console.log('!!! lỗi khi dọn: ' + e.message)); await browser?.close(); process.exit(failed ? 1 : 0); }
}
