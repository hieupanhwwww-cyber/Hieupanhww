import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');

describe('file cài đặt một lần', () => {
  it('đúng bằng 5 migration nối theo thứ tự (không bị lệch khi sửa migration)', () => {
    const dir = path.join(root, 'supabase/migrations');
    const expected = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
      .map((f) => `-- ===== ${f} =====\n${readFileSync(path.join(dir, f), 'utf8')}`).join('\n');
    expect(readFileSync(path.join(root, 'supabase/cai-dat-mot-lan.sql'), 'utf8')).toBe(expected);
  });
});
