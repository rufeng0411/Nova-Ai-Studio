#!/usr/bin/env node
// PD-SAAS-FORK: P0 termination whitelist gate.
import { spawnSync } from 'node:child_process';

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npx, [
  'vitest',
  'run',
  'tests/saas/task-continuation-policy.test.ts',
], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: process.platform === 'win32',
  windowsHide: true,
});

process.exit(result.status ?? 1);
