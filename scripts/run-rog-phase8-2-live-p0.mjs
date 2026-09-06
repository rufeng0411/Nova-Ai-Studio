#!/usr/bin/env node
/** PD-SAAS-FORK (ROG Phase 8-2): L4-P0 live harness extension for 0707-2 scenarios. */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = process.argv.includes('--gate');
const live = process.argv.includes('--live');

if (!live) {
  console.log('[skip] Phase 8-2 live P0 — pass --live with dev:saas + DashScope key');
  process.exit(0);
}

const result = spawnSync('node', [path.join(root, 'scripts', 'run-rog-phase8-live-p0.mjs'), '--live', ...(gate ? ['--gate'] : [])], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
