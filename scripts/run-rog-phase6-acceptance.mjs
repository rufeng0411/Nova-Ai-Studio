#!/usr/bin/env node
/**
 * PD-SAAS-FORK (ROG Phase 6): unit + integration acceptance orchestrator.
 * Usage:
 *   node scripts/run-rog-phase6-acceptance.mjs [--live] [--gate]
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

run('npm', ['run', 'test:rog-phase6:unit'], 'L1 unit');
run('npm', ['run', 'test:rog-phase6:integration'], 'L2 integration');

run('node', ['--import', 'tsx', 'scripts/run-rog-phase6-kpi-automation.mjs', ...(gate ? ['--gate'] : [])], 'T01-T23 KPI automation');

run('npm', ['--workspace', 'ui', 'run', 'test:e2e', '--', 'e2e/saas/task-lifecycle-dock.spec.ts'], 'T22/T23 Playwright');

if (live) {
  run('npm', ['run', 'test:rog-phase6:live'], 'L4 live');
}

const reportDir = path.join(root, 'artifacts', '0705验收测试', 'logs');
fs.mkdirSync(reportDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
fs.writeFileSync(
  path.join(reportDir, `rog-phase6-suite-${stamp}.json`),
  JSON.stringify({ ok: true, live, gate, at: new Date().toISOString() }, null, 2),
);
console.log('\n[ok] ROG Phase 6 acceptance suite complete');
