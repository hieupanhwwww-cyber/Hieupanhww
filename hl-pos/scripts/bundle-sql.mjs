// Gộp mọi migration thành supabase/cai-dat-mot-lan.sql (chạy: npm run bundle-sql). Test bundle.test.ts ép file này luôn khớp.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('../supabase/migrations/', import.meta.url);
const out = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => `-- ===== ${f} =====\n${readFileSync(new URL(f, dir), 'utf8')}`).join('\n');
writeFileSync(new URL('../supabase/cai-dat-mot-lan.sql', import.meta.url), out);
console.log('đã gộp', out.length, 'ký tự');
