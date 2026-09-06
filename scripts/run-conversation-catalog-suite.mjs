#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Conversation catalog test suite orchestrator.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(__dirname, '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(cmd, args, env = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(cmd, args, {
      cwd: repo,
      env: { ...process.env, ...env },
      stdio: 'inherit',
      windowsHide: true,
    });
    child.on('exit', (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${cmd} ${args.join(' ')} exit ${code}`));
    });
  });
}

async function step(name, fn) {
  console.log(`\n[catalog-suite] ${name}…`);
  try {
    await fn();
    console.log(`[catalog-suite] PASS ${name}`);
    return true;
  } catch (error) {
    console.error(`[catalog-suite] FAIL ${name}:`, error.message);
    return false;
  }
}

async function main() {
  process.env.PILOTDECK_SAAS_MODE = '1';
  process.env.SAAS_CONVERSATION_CATALOG_SHADOW = '1';

  const results = [];
  results.push(await step('catalogStore unit', () =>
    run(process.execPath, ['--test', 'ui/server/saas/conversation/catalogStore.test.mjs']),
  ));
  results.push(await step('session-list regression', () =>
    run(process.execPath, ['--import', 'tsx', '--test', 'tests/session/session-list.test.ts']),
  ));
  results.push(await step('smoke:conversation-catalog', () =>
    run(process.execPath, ['--import', 'tsx', 'scripts/smoke-conversation-catalog.mjs']),
  ));
  results.push(await step('benchmark', () =>
    run(process.execPath, ['--import', 'tsx', 'scripts/benchmark-conversation-catalog.mjs']),
  ));
  if (process.env.SAAS_DATABASE_URL?.trim()) {
    results.push(await step('test:saas:pg', () => run(npmCmd, ['run', 'test:saas:pg'])));
  }

  const vite = process.env.VITE_URL || 'http://127.0.0.1:5173';
  if (process.env.SKIP_LIVE !== '1') {
    results.push(await step('ui-conversation-catalog-check', () =>
      run(process.execPath, ['scripts/ui-conversation-catalog-check.mjs'], {
        VITE_URL: vite,
        BASE_URL: vite,
        PLAYWRIGHT_BASE_URL: vite,
      }),
    ));
  }

  const failed = results.filter((ok) => !ok).length;
  if (failed > 0) {
    console.error(`[catalog-suite] ${failed} step(s) failed`);
    process.exit(1);
  }
  console.log('[catalog-suite] OK');
}

main().catch((error) => {
  console.error('[catalog-suite] FAIL:', error);
  process.exit(1);
});
