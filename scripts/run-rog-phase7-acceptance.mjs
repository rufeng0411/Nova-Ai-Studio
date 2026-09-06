#!/usr/bin/env node
/**
 * PD-SAAS-FORK (ROG Phase 7): unit + integration acceptance orchestrator.
 * Usage:
 *   node scripts/run-rog-phase7-acceptance.mjs [--live] [--gate]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const live = args.includes('--live');
const gate = args.includes('--gate');

function run(cmd, cmdArgs, label) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(cmd, cmdArgs, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`[fail] ${label}`);
    process.exit(gate ? 1 : result.status ?? 1);
  }
}

run('npm', ['run', 'test:rog-phase7:unit'], 'L1 unit');
run('npm', ['run', 'test:rog-phase7:integration'], 'L2 integration');

run('node', ['--import', 'tsx', 'scripts/run-rog-phase7-kpi-automation.mjs', ...(gate ? ['--gate'] : [])], 'T0706 KPI automation');

run('npm', ['run', 'test:rog-phase6:acceptance'], 'Phase 6 regression');

run('npm', ['--workspace', 'ui', 'run', 'test:e2e', '--', 'e2e/saas/rog-phase7-ppt-matrix.spec.ts', 'e2e/saas/rog-phase7-combo-stage.spec.ts', 'e2e/saas/task-lifecycle-dock.spec.ts'], 'L5 Playwright');

if (live) {
  run('npm', ['run', 'test:rog-phase7:live'], 'L4 live');
}

const reportDir = path.join(root, 'artifacts', '0706雷神批次', 'logs');
fs.mkdirSync(reportDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.writeFileSync(
  path.join(reportDir, `rog-phase7-suite-${stamp}.json`),
  JSON.stringify({ ok: true, live, gate, at: new Date().toISOString() }, null, 2),
);
console.log('\n[ok] ROG Phase 7 acceptance suite complete');
