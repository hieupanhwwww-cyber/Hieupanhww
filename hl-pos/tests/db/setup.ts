import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Client } from 'pg';
import type { TestProject } from 'vitest/node';

const PORT = 54329;
const root = path.resolve(__dirname, '../..');

function pgBin(name: string): string {
  const dir = readdirSync('/usr/lib/postgresql').sort().pop();
  return `/usr/lib/postgresql/${dir}/bin/${name}`;
}

function runAsPostgres(bin: string, args: string[]) {
  const asRoot = process.getuid?.() === 0;
  const cmd = asRoot ? 'runuser' : bin;
  const fullArgs = asRoot ? ['-u', 'postgres', '--', bin, ...args] : args;
  execFileSync(cmd, fullArgs, { stdio: 'pipe' });
}

export default async function setup(project: TestProject) {
  let url = process.env.TEST_DATABASE_URL;
  let dataDir: string | undefined;

  if (!url) {
    dataDir = mkdtempSync(path.join(tmpdir(), 'hlpos-pg-'));
    chmodSync(dataDir, 0o777);
    if (process.getuid?.() === 0) execFileSync('chown', ['postgres', dataDir]);
    runAsPostgres(pgBin('initdb'), ['-D', dataDir, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--no-locale']);
    runAsPostgres(pgBin('pg_ctl'), ['-D', dataDir, '-w', '-l', path.join(dataDir, 'log.txt'),
      '-o', `-p ${PORT} -k ${dataDir} -c listen_addresses=127.0.0.1 -c timezone=UTC`, 'start']);
    const admin = new Client({ host: '127.0.0.1', port: PORT, user: 'postgres', database: 'postgres' });
    await admin.connect();
    await admin.query('create database hlpos_test');
    await admin.end();
    url = `postgres://postgres@127.0.0.1:${PORT}/hlpos_test`;
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query(readFileSync(path.join(root, 'supabase/test/stub.sql'), 'utf8'));
  const migDir = path.join(root, 'supabase/migrations');
  for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
    try {
      await client.query(readFileSync(path.join(migDir, f), 'utf8'));
    } catch (e) {
      throw new Error(`Migration ${f} lỗi: ${(e as Error).message}`);
    }
  }
  await client.end();
  project.provide('dbUrl', url);

  return () => {
    if (dataDir) {
      try { runAsPostgres(pgBin('pg_ctl'), ['-D', dataDir, '-m', 'immediate', 'stop']); } catch {}
      rmSync(dataDir, { recursive: true, force: true });
    }
  };
}

declare module 'vitest' {
  export interface ProvidedContext { dbUrl: string }
}
