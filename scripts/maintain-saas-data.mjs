#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Daily/weekly SaaS data maintenance (no OSS phase).
 *
 * Usage:
 *   node scripts/maintain-saas-data.mjs [--skip-backup] [--apply-backfill]
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const skipBackup = process.argv.includes('--skip-backup');
const applyBackfill = process.argv.includes('--apply-backfill');

function run(label, args, useTsx = false) {
  console.log(`\n[maintain-saas-data] → ${label}`);
  const cmd = useTsx ? (process.platform === 'win32' ? 'npx.cmd' : 'npx') : process.execPath;
  const cmdArgs = useTsx ? ['tsx', ...args] : args;
  const result = spawnSync(cmd, cmdArgs, {
    cwd: REPO_ROOT,
    env: { ...process.env, PILOTDECK_SAAS_MODE: '1' },
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit ${result.status})`);
  }
}

async function main() {
  run('verify integrity', ['scripts/verify-saas-data-integrity.mjs']);

  run('catalog verify', ['scripts/backfill-conversation-catalog.mjs', '--verify-only'], true);

  if (applyBackfill) {
    run('catalog backfill', ['scripts/backfill-conversation-catalog.mjs'], true);
    run('turn meta backfill', ['scripts/backfill-turn-artifact-dirs.mjs', '--apply']);
  } else {
    run('turn meta dry-run', ['scripts/backfill-turn-artifact-dirs.mjs']);
  }

  run('four-line audit', ['scripts/audit-four-line-alignment.mjs', '--tenant', 'default', '--limit', '200']);

  if (!skipBackup) {
    run('joint backup', ['scripts/backup-saas-joint.mjs']);
  }

  console.log('\n[maintain-saas-data] done');
}

main().catch((error) => {
  console.error('[maintain-saas-data] FAIL:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
