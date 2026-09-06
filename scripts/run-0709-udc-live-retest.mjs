#!/usr/bin/env node
/**
 * PD-SAAS-FORK: UDC C4/C5 专项复测（reconcile 修复后）→ 六案全量。
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(label, extraEnv) {
  console.log(`\n========== ${label} ==========\n`);
  const result = spawnSync('node', ['scripts/run-0709-udc-live.mjs'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  return result.status ?? 1;
}

const base = {
  PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8081',
  PLAYWRIGHT_SERVER_URL: process.env.PLAYWRIGHT_SERVER_URL || 'http://127.0.0.1:7990',
};

const c4c5 = run('C4/C5 retest', {
  ...base,
  O709_UDC_LIVE: '1',
  O709_FRESH: '1',
  O709_UDC_CASES: 'UDC-C4-dc7a63d3,UDC-C5-d7890d1d',
});

const full = run('Full 6-case retest', {
  ...base,
  O709_UDC_LIVE: '1',
  O709_FRESH: '1',
});

process.exit(c4c5 || full);
