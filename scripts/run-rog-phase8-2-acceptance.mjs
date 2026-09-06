#!/usr/bin/env node
/** PD-SAAS-FORK (ROG Phase 8-2): acceptance orchestrator — 0707-2 unified plan. */
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

run('npm', ['run', 'test:rog-phase8-2:unit'], 'L1 unit');
run('npm', ['run', 'test:rog-phase8-2:integration'], 'L2 integration');
run('node', ['scripts/run-rog-phase8-2-error-task-matrix.mjs', ...(gate ? ['--gate'] : [])], '0707-2 error matrix');
run('npm', ['run', 'test:rog-phase8:acceptance', '--', ...(gate ? ['--gate'] : [])], 'Phase 8 regression');
run('node', ['scripts/ui-deliverable-dock-check.mjs', ...(gate ? ['--gate'] : [])], 'Deliverable dock static');
run('npm', ['--workspace', 'ui', 'run', 'test:e2e', '--', 'e2e/saas/rog-phase8-template-stage.spec.ts'], 'Template stage pill Playwright');

if (live) {
  run('npm', ['run', 'test:rog-phase8-2:live-p0'], 'L4-P0 live 0707-2');
}

const logDir = path.join(root, 'artifacts', '0707-2小罐茶批次', 'logs');
fs.mkdirSync(logDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.writeFileSync(
  path.join(logDir, `rog-phase8-2-suite-${stamp}.json`),
  JSON.stringify({ ok: true, live, gate, at: new Date().toISOString() }, null, 2),
);
console.log('\n[ok] ROG Phase 8-2 acceptance suite complete');
