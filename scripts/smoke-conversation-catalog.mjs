#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Smoke — PG catalog rows vs jsonl sampling.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(__dirname, '..');

process.env.PILOTDECK_SAAS_MODE = '1';
process.env.SAAS_CONVERSATION_CATALOG_SHADOW = '1';

function runBackfill(args = []) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/backfill-conversation-catalog.mjs', ...args], {
      cwd: repo,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.on('error', rejectRun);
    child.on('exit', (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`exit ${code}`));
    });
  });
}

async function main() {
  await runBackfill(['--verify-only']);
  console.log('[smoke:conversation-catalog] OK');
}

main().catch((error) => {
  console.error('[smoke:conversation-catalog] FAIL:', error.message);
  process.exit(1);
});
