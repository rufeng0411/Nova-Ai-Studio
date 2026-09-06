#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Run SaaS control DB tests against SQLite (default) and PostgreSQL (when reachable).
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PG_TEST_URL, ensurePgTestDatabase, isPgReachable, preparePgTestDatabase } from './lib/saasPgTestEnv.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function runNodeTest(args, env = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });
    child.on('error', rejectRun);
    child.on('exit', (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`node ${args.join(' ')} exited with ${code ?? 'null'}`));
    });
  });
}

const unitTests = [
  'ui/server/saas/billing/billing.test.js',
  'ui/server/saas/usage/usage.test.js',
  'ui/server/saas/analytics/analytics.test.js',
  'ui/server/saas/conversation/catalogStore.test.mjs',
];

async function main() {
  console.log('[test:saas:pg] SQLite backend unit tests…');
  for (const file of unitTests) {
    await runNodeTest(['--test', file], { PILOTDECK_SAAS_MODE: '1' });
  }

  const pgUrl = process.env.SAAS_DATABASE_URL || DEFAULT_PG_TEST_URL;
  const reachable = await isPgReachable(pgUrl);
  if (!reachable) {
    console.warn(`[test:saas:pg] WARN: PostgreSQL not reachable at ${pgUrl} — skipping PG backend tests`);
    console.log('[test:saas:pg] OK (sqlite only)');
    return;
  }

  await preparePgTestDatabase(pgUrl);

  console.log('[test:saas:pg] PostgreSQL backend unit tests…');
  for (const file of unitTests) {
    await runNodeTest(['--test', file], {
      PILOTDECK_SAAS_MODE: '1',
      SAAS_DATABASE_URL: pgUrl,
    });
  }

  console.log('[test:saas:pg] Migration integration test…');
  await runNodeTest(['--test', 'scripts/migrate-control-sqlite-to-pg.test.mjs'], {
    PILOTDECK_SAAS_MODE: '1',
    SAAS_DATABASE_URL: pgUrl,
    SAAS_PG_TEST_URL: pgUrl,
  });

  console.log('[test:saas:pg] OK (sqlite + postgres)');
}

main().catch((error) => {
  console.error('[test:saas:pg] FAIL:', error instanceof Error ? error.message : error);
  process.exit(1);
});
