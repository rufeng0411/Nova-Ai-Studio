#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Bootstrap local dev PostgreSQL on D:\pgsql (port 5432, trust localhost).
 * Creates pilotdeck / pilotdeck_dev + pilotdeck_saas(+_test) for dev:saas / Nova Launcher.
 */
import { spawnSync } from './lib/childProcessShim.mjs';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ensureNativePostgres, findPgCtl, findPgDataDir } from './lib/nativePostgres.mjs';
import { pingPgUrl, resolveDevPgUrl } from './lib/devInfra.mjs';
import { withHiddenConsole } from './lib/winSpawn.mjs';

const DEV_PASSWORD = 'pilotdeck_dev';
const DEV_USER = 'pilotdeck';
const DEV_DB = 'pilotdeck_saas';
const DEV_TEST_DB = 'pilotdeck_saas_test';

function psqlBin() {
  const pgCtl = findPgCtl();
  if (!pgCtl) return null;
  return join(pgCtl, '..', process.platform === 'win32' ? 'psql.exe' : 'psql');
}

function runPsql(args, env = process.env) {
  const bin = psqlBin();
  if (!bin || !existsSync(bin)) {
    throw new Error('[setup-dev-postgres] psql not found — install D:\\pgsql or set PILOTDECK_PG_HOME');
  }
  const result = spawnSync(bin, args, withHiddenConsole({
    encoding: 'utf8',
    shell: false,
    env,
  }));
  if (result.status !== 0) {
    const detail = `${result.stderr || ''}\n${result.stdout || ''}`.trim();
    throw new Error(detail || `[setup-dev-postgres] psql failed (${result.status})`);
  }
  return result.stdout ?? '';
}

async function main() {
  const pgCtl = findPgCtl();
  const dataDir = findPgDataDir();
  if (!pgCtl || !dataDir) {
    throw new Error('[setup-dev-postgres] Native PostgreSQL not found (expected D:\\pgsql on Windows)');
  }

  console.log('[setup-dev-postgres] Ensuring PostgreSQL is running…');
  const running = await ensureNativePostgres();
  if (!running) {
    throw new Error('[setup-dev-postgres] Could not start native PostgreSQL on port 5432');
  }

  const port = '5432';
  const base = ['-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'];

  console.log('[setup-dev-postgres] Creating role and databases…');
  runPsql([...base, '-c', `
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DEV_USER}') THEN
    CREATE USER ${DEV_USER} WITH PASSWORD '${DEV_PASSWORD}';
  ELSE
    ALTER USER ${DEV_USER} WITH PASSWORD '${DEV_PASSWORD}';
  END IF;
END $$;
`]);

  for (const db of [DEV_DB, DEV_TEST_DB]) {
    const exists = runPsql([...base, '-tAc', `SELECT 1 FROM pg_database WHERE datname='${db}'`]).trim();
    if (exists !== '1') {
      runPsql([...base, '-c', `CREATE DATABASE ${db} OWNER ${DEV_USER};`]);
    } else {
      runPsql([...base, '-c', `ALTER DATABASE ${db} OWNER TO ${DEV_USER};`]);
    }
    runPsql([...base, '-c', `GRANT ALL PRIVILEGES ON DATABASE ${db} TO ${DEV_USER};`]);
  }

  mkdirSync(join(dataDir, '..', 'log'), { recursive: true });

  const pilotdeckUrl = `postgresql://${DEV_USER}:${DEV_PASSWORD}@127.0.0.1:${port}/${DEV_DB}`;
  const trustUrl = `postgresql://postgres@127.0.0.1:${port}/${DEV_DB}`;
  const resolved = await resolveDevPgUrl();
  const ok = (await pingPgUrl(trustUrl)) || (await pingPgUrl(pilotdeckUrl));

  console.log('');
  console.log('[setup-dev-postgres] OK');
  console.log(`  dev URL (trust):     ${trustUrl}`);
  console.log(`  dev URL (password):  ${pilotdeckUrl}`);
  console.log(`  launcher resolves:   ${resolved ?? '(none)'}`);
  if (!ok) {
    process.exitCode = 1;
    console.error('[setup-dev-postgres] WARNING: auth ping failed after setup');
  }
}

main().catch((error) => {
  console.error('[setup-dev-postgres] FAIL:', error instanceof Error ? error.message : error);
  process.exit(1);
});
