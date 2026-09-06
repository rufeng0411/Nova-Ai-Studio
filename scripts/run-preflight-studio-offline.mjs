#!/usr/bin/env node
/** PD-SAAS-FORK: Preflight Studio offline acceptance (L0–L2) */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', shell: true, ...opts });
  return { ok: res.status === 0, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

const steps = [
  ['catalog:gen', () => run('node', ['scripts/gen-preflight-catalog-index.mjs'])],
  ['launch:check', () => run('npm', ['run', 'launch:check'])],
  ['unit', () => run('npx', ['vitest', 'run',
    'ui/src/shared/preflightStudioGate.test.ts',
    'ui/src/shared/preflightStudioBridge.test.ts',
    'ui/src/shared/preflightStudioCatalog.test.ts',
    'ui/src/components/super-preview/adapters/preflightStudio/usePreflightVirtualWindow.test.ts',
    'src/saas/preflight/preflightGate.test.ts',
  ])],
  ['flags', () => run('npm', ['run', 'test:preflight-studio:flags'])],
  ['demo-static', () => run('npm', ['run', 'test:preflight-studio:demo-static'])],
];

const gate = process.argv.includes('--gate');
let failed = false;

for (const [name, fn] of steps) {
  const result = fn();
  console.log(`[preflight:offline] ${name}: ${result.ok ? 'PASS' : 'FAIL'}`);
  if (!result.ok) {
    failed = true;
    if (result.stderr) console.error(result.stderr.slice(0, 2000));
    if (gate) break;
  }
}

if (failed) process.exit(1);
console.log('[preflight:offline] ALL PASS');
