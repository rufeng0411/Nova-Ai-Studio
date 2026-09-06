#!/usr/bin/env node
/**
 * PD-SAAS-FORK: workbench beta 1.1 L0–L4 gate orchestrator
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const withLive = process.argv.includes('--with-live');
const withPerf = process.argv.includes('--with-perf');

function run(label, command, args) {
  console.log(`\n[workbench-beta-11:gate] ${label}`);
  const res = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (res.status !== 0) {
    console.error(`[workbench-beta-11:gate] FAIL: ${label}`);
    process.exit(res.status || 1);
  }
}

run('flags', 'node', ['scripts/check-workbench-beta-flags.mjs']);
run('unit', 'npm', [
  '--workspace',
  'ui',
  'exec',
  '--',
  'vitest',
  'run',
  'src/saas/workbench-beta',
  'src/saas/marketing/sanitizeMarketingNext.test.ts',
]);
run('brand', 'npm', ['run', 'brand:check']);

if (withLive) {
  run('ui-clicks', 'npm', ['run', 'test:workbench-beta-11:ui-clicks']);
  run('live-cases', 'npm', ['run', 'test:workbench-beta-11:live-cases']);
}

if (withPerf) {
  console.log('[workbench-beta-11:gate] --with-perf: record KPI in acceptance doc (manual/CDP).');
}

console.log('\n[workbench-beta-11:gate] PASS');
