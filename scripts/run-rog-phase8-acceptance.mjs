#!/usr/bin/env node
/** PD-SAAS-FORK (ROG Phase 8): acceptance orchestrator. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const live = process.argv.includes('--live');
const gate = process.argv.includes('--gate');

function run(cmd, cmdArgs, label) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(cmd, cmdArgs, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`[fail] ${label}`);
    process.exit(gate ? 1 : result.status ?? 1);
  }
}

run('npm', ['run', 'test:rog-phase8:unit'], 'L1 unit');
run('npm', ['run', 'test:rog-phase8:integration'], 'L2 integration');
run('node', ['scripts/run-rog-phase8-error-task-matrix.mjs', ...(gate ? ['--gate'] : [])], '0707 error matrix');
run('npm', ['run', 'test:rog-phase7:acceptance'], 'Phase 7 regression');

if (live) {
  run('npm', ['run', 'test:rog-phase8:live-p0'], 'L4-P0 live');
}

const logDir = path.join(root, 'artifacts', '0707吴裕泰批次', 'logs');
fs.mkdirSync(logDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.writeFileSync(
  path.join(logDir, `rog-phase8-suite-${stamp}.json`),
  JSON.stringify({ ok: true, live, gate, at: new Date().toISOString() }, null, 2),
);
console.log('\n[ok] ROG Phase 8 acceptance suite complete');
