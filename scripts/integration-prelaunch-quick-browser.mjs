#!/usr/bin/env node
/** Re-run browser-only slice of prelaunch quick (dev:saas must be started separately or auto-spawned). */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const child = spawn(process.execPath, ['scripts/integration-prelaunch-quick.mjs', '--browser-only'], {
  cwd: REPO_ROOT,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, PRELAUNCH_BROWSER_ONLY: '1' },
});
child.on('exit', (code) => process.exit(code ?? 1));
