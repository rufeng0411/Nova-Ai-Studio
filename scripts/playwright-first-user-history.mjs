#!/usr/bin/env node
/** Run first-user-history Playwright spec with dev stack. */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const child = spawn(
  process.execPath,
  [resolve(__dirname, 'playwright-with-dev.mjs')],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      PLAYWRIGHT_SPEC_DIRS: 'ui/e2e/saas/first-user-history.spec.ts',
      PILOTDECK_HISTORY_TAIL_READ: process.env.PILOTDECK_HISTORY_TAIL_READ ?? '1',
      PILOTDECK_HISTORY_SANITIZE: process.env.PILOTDECK_HISTORY_SANITIZE ?? '1',
    },
  },
);

child.on('exit', (code) => process.exit(code ?? 1));
