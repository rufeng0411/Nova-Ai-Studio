#!/usr/bin/env node
/** PD-SAAS-FORK: Goal Loop R10 — 0708-1 golden set static fixture gate */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(
  'npx',
  ['vitest', 'run', 'tests/goal-loop/0708-batch.test.ts'],
  { cwd: root, stdio: 'inherit', shell: true },
);

if ((result.status ?? 1) !== 0) {
  console.error('[goal-loop:0708-batch] failed');
  process.exit(1);
}
console.log('[goal-loop:0708-batch] passed');
