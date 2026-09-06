#!/usr/bin/env node
/** PD-SAAS-FORK: SDM fixture replay gate */
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  'npx',
  ['vitest', 'run', 'tests/sdm/worldcup-fixtures.test.ts'],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);
process.exit(result.status === 0 ? 0 : 1);
