import { describe, it, expect, beforeEach } from 'vitest';
import { sql, createUser, asUser, resetDb } from './helpers';

describe('bộ test DB', () => {
  beforeEach(resetDb);

  it('kết nối được Postgres', async () => {
    const rows = await sql('select 1 as n');
    expect(rows[0].n).toBe(1);
  });

  it('asUser đặt auth.uid() đúng người dùng', async () => {
    const id = await createUser('staff');
    const rows = await asUser(id, (q) => q('select auth.uid() as uid'));
    expect(rows[0].uid).toBe(id);
  });
});
