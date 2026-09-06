#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Cloud history messages load diagnostic (nightly / pre-release).
 * Requires: PROD_BASE_URL, DIAG_USER, DIAG_PASS — or SKIP_CLOUD_CHAT_LOAD=1 / LOCAL_DEV=1
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

if (
  process.env.SKIP_CLOUD_CHAT_LOAD === '1' ||
  process.env.SKIP_CLOUD_CHAT_LOAD === 'true' ||
  process.env.LOCAL_DEV === '1' ||
  process.env.LOCAL_DEV === 'true'
) {
  console.log('[test:cloud:chat-load] skipped (SKIP_CLOUD_CHAT_LOAD or LOCAL_DEV)');
  process.exit(0);
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[test:cloud:chat-load] missing env ${name}`);
    process.exit(1);
  }
  return value;
}

requireEnv('DIAG_USER');
requireEnv('DIAG_PASS');
if (!process.env.PROD_BASE_URL?.trim()) {
  process.env.PROD_BASE_URL = 'https://www.novapage.online';
}

const steps = [
  'scripts/diag-cloud-all-sessions.mjs',
  'scripts/diag-cloud-sidebar-click.mjs',
  'scripts/diag-cloud-chat-load-api.mjs',
];

for (const script of steps) {
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, [join(REPO_ROOT, script)], {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.on('exit', resolve);
  });
  if (code !== 0) process.exit(code ?? 1);
}

console.log('[test:cloud:chat-load] all diagnostics completed');
