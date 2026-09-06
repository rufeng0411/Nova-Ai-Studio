#!/usr/bin/env node
// PD-SAAS-FORK: cross-platform live four-line acceptance wrapper.
import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['scripts/four-line-alignment-acceptance.mjs'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: { ...process.env, FOUR_LINE_LIVE: '1' },
  windowsHide: true,
});

process.exit(result.status ?? 1);
