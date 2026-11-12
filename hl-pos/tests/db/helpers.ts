import { inject, afterAll } from 'vitest';
import { Pool, type PoolClient } from 'pg';

const pool = new Pool({ connectionString: inject('dbUrl'), max: 6 });
afterAll(() => pool.end());

export type Row = Record<string, any>;
export type Q = (text: string, params?: unknown[]) => Promise<Row[]>;

/** Chạy SQL với quyền quản trị (bỏ qua RLS). */
export async function sql(text: string, params?: unknown[]): Promise<Row[]> {
  return (await pool.query(text, params)).rows;
}

/** Tạo tài khoản đăng nhập + đặt vai trò. Trả về id. */
export async function createUser(role: 'owner' | 'staff', name = 'Người thử'): Promise<string> {
  const [u] = await sql(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [`${crypto.randomUUID()}@test.local`, { full_name: name }],
  );
  if (await tableExists('profiles')) {
    await sql(`update public.profiles set role = $2 where id = $1`, [u.id, role]);
  }
  return u.id;
}

async function tableExists(name: string): Promise<boolean> {
  const r = await sql(`select to_regclass('public.' || $1) is not null as ok`, [name]);
  return r[0].ok;
}

async function runAs<T>(role: string, claims: object, fn: (q: Q) => Promise<T>): Promise<T> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    await client.query(`set local role ${role}`);
    const q: Q = async (text, params) => (await client.query(text, params)).rows;
    const result = await fn(q);
    await client.query('commit');
    return result;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Chạy fn trong một giao dịch như người dùng đã đăng nhập (role authenticated). */
export function asUser<T>(userId: string, fn: (q: Q) => Promise<T>): Promise<T> {
  return runAs('authenticated', { sub: userId, role: 'authenticated' }, fn);
}

/** Chạy như khách chưa đăng nhập. */
export function asAnon<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  return runAs('anon', { role: 'anon' }, fn);
}

/** Xóa sạch dữ liệu giữa các test. */
export async function resetDb(): Promise<void> {
  const tables = await sql(
    `select string_agg(format('%I.%I', schemaname, tablename), ', ') as t
       from pg_tables where schemaname = 'public' and tablename <> 'store_settings'`,
  );
  if (tables[0].t) await sql(`truncate ${tables[0].t} restart identity cascade`);
  await sql('truncate auth.users cascade');
  const seqs = await sql(`select string_agg(format('alter sequence %I.%I restart', schemaname, sequencename), '; ') as s
                            from pg_sequences where schemaname = 'public'`);
  if (seqs[0].s) await sql(seqs[0].s);
}
