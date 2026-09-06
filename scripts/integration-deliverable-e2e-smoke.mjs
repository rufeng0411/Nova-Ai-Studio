#!/usr/bin/env node
/**
 * PD-SAAS-FORK: offline deliverable policy smoke (item 9 integration leg).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const steps = [
  {
    name: 'presentationDeliverablePolicy',
    cmd: 'npm',
    args: ['--workspace', 'ui', 'run', 'test', '--', 'src/shared/presentationDeliverablePolicy.test.ts'],
    shell: true,
  },
  {
    name: 'p0-p2-deliverable-profiles',
    cmd: 'npm',
    args: ['run', 'test:p0-p2:unit'],
    shell: true,
  },
];

let failed = 0;
for (const step of steps) {
  const r = spawnSync(step.cmd, step.args, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    windowsHide: true,
    shell: step.shell ?? false,
  });
  if (r.status !== 0) {
    console.error(`[deliverable-e2e-smoke] FAIL ${step.name}`);
    failed += 1;
  } else {
    console.log(`[deliverable-e2e-smoke] PASS ${step.name}`);
  }
}

if (failed > 0) process.exit(1);
console.log('[deliverable-e2e-smoke] all offline checks passed');
