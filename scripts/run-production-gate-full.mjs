#!/usr/bin/env node
/**
 * PD-SAAS-FORK: production gate orchestrator (post-gate dev item 5).
 * Usage:
 *   node scripts/run-production-gate-full.mjs [--skip-live] [--skip-load] [--with-deliverable-e2e]
 *   node scripts/run-production-gate-full.mjs --phase=offline|e2e|load|live|all
 *
 * SERVER_URL defaults to Bridge/API port (3001/3002), not Vite 5173.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  acquireGateLock,
  assertGatePhaseAllowed,
  releaseGateLock,
} from './lib/gateMutex.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'pre-production-test');
const SUMMARY_FILE = path.join(OUT_DIR, 'gate-full-summary.json');

const skipLive = process.argv.includes('--skip-live');
const skipLoad = process.argv.includes('--skip-load');
const withDeliverableE2e = process.argv.includes('--with-deliverable-e2e');
const phaseArg = process.argv.find((a) => a.startsWith('--phase='));
const phaseMode = phaseArg ? phaseArg.split('=')[1] : 'all';

const npmCmd = 'npm';
const npxCmd = 'npx';
const steps = [];

function logStep(name, ok, detail = '', durationMs = 0) {
  const entry = { name, ok, detail, durationMs, at: new Date().toISOString() };
  steps.push(entry);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`\n[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''} (${Math.round(durationMs / 1000)}s)`);
}

function run(cmd, args, extraEnv = {}, opts = {}) {
  const useShell = opts.shell ?? (process.platform === 'win32' && (cmd === 'npm' || cmd === 'npx'));
  return new Promise((resolveRun, rejectRun) => {
    const t0 = Date.now();
    const child = spawn(cmd, args, {
      cwd: REPO_ROOT,
      env: { ...process.env, ...extraEnv },
      stdio: 'inherit',
      shell: useShell,
      windowsHide: true,
    });
    child.on('error', (error) => rejectRun({ error, durationMs: Date.now() - t0 }));
    child.on('exit', (code) => {
      const durationMs = Date.now() - t0;
      if (code === 0) resolveRun({ durationMs });
      else rejectRun({ code, durationMs });
    });
  });
}

async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    logStep(name, true, '', Date.now() - t0);
    return true;
  } catch (error) {
    const detail = error?.code != null ? `exit ${error.code}` : String(error?.error || error);
    logStep(name, false, detail, Date.now() - t0);
    return false;
  }
}

async function runOfflineSteps() {
  await step('build', () => run(npmCmd, ['run', 'build']));
  await step('check:saas-fork', () => run(npmCmd, ['run', 'check:saas-fork']));
  await step('brand:check', () => run(npmCmd, ['run', 'brand:check']));
  await step('test:history-messages:quick', () => run(npmCmd, ['run', 'test:history-messages:quick']));
  await step('test:p0-p2:full', () => run(npmCmd, ['run', 'test:p0-p2:full']));
  await step('analyze:task-completion --gate', () =>
    run(npmCmd, ['run', 'analyze:task-completion', '--', '--gate']),
  );
  await step('test:saas:storage', () =>
    run('node', ['scripts/integration-saas-storage-comprehensive.mjs'], {}, { shell: false }),
  );
  await step('test:saas:folder', () =>
    run('node', ['scripts/integration-saas-folder-scenarios.mjs'], {}, { shell: false }),
  );
  await step('test:process-ux', () => run(npmCmd, ['run', 'test:process-ux']));
  await step('test:deliverable-paths', () => run(npmCmd, ['run', 'test:deliverable-paths']));
  await step('test:four-line-audit', () => run(npmCmd, ['run', 'test:four-line-audit']));
  await step('session-read-access', () =>
    run('node', ['--import', 'tsx', '--test', 'ui/server/saas/conversation/sessionReadAccess.test.mjs'], {}, { shell: false }),
  );
  await step('gate-mutex-unit', () =>
    run('node', ['--test', 'scripts/lib/gateMutex.test.mjs'], {}, { shell: false }),
  );
  await step('pack:preflight', () => run(npmCmd, ['run', 'pack:preflight']));
}

async function runE2eSteps() {
  const phaseCheck = assertGatePhaseAllowed('e2e');
  if (!phaseCheck.ok) {
    logStep('prelaunch-e2e-serial', false, phaseCheck.reason, 0);
    return;
  }
  const lock = acquireGateLock({ phase: 'e2e', holder: 'run-production-gate-full.mjs' });
  if (!lock.ok) {
    logStep('prelaunch-e2e-serial', false, lock.reason, 0);
    return;
  }
  try {
    await step('prelaunch-e2e-serial', () => run(npmCmd, ['run', 'test:prelaunch:e2e-serial']));
  } finally {
    releaseGateLock({ phase: 'e2e' });
  }
}

async function runLoadSteps() {
  if (skipLoad) {
    logStep('http-load-smoke', true, 'SKIP --skip-load', 0);
    return;
  }
  const phaseCheck = assertGatePhaseAllowed('load');
  if (!phaseCheck.ok) {
    logStep('http-load-smoke', false, phaseCheck.reason, 0);
    return;
  }
  const lock = acquireGateLock({ phase: 'load', holder: 'run-production-gate-full.mjs' });
  if (!lock.ok) {
    logStep('http-load-smoke', false, lock.reason, 0);
    return;
  }
  const server = process.env.SERVER_URL || 'http://127.0.0.1:3001';
  try {
    await step('http-load-smoke', () =>
      run('node', ['scripts/load/http-load.mjs', '--scenario', 'smoke'], { SERVER_URL: server }, { shell: false }),
    );
  } finally {
    releaseGateLock({ phase: 'load' });
  }
}

async function runLiveSteps() {
  if (skipLive) {
    logStep('security-regression', true, 'SKIP --skip-live', 0);
    return;
  }
  const vite = process.env.VITE_URL || 'http://127.0.0.1:5173';
  const server = process.env.SERVER_URL || 'http://127.0.0.1:3001';
  const liveEnv = { VITE_URL: vite, BASE_URL: vite, SERVER_URL: server, PLAYWRIGHT_BASE_URL: vite };

  await step('security-regression', () =>
    run('node', ['scripts/security-regression-checklist.mjs'], liveEnv, { shell: false }),
  );
  await step('smoke:conversation-catalog', () => run(npmCmd, ['run', 'smoke:conversation-catalog']));

  if (withDeliverableE2e) {
    await step('deliverable-e2e-smoke', () =>
      run('node', ['scripts/integration-deliverable-e2e-smoke.mjs'], liveEnv, { shell: false }),
    );
    await step('playwright-deliverable', () =>
      run(npxCmd, [
        'playwright',
        'test',
        'ui/e2e/saas/deliverable-ppt.spec.ts',
        'ui/e2e/saas/deliverable-doc.spec.ts',
        '-c',
        'ui/playwright.config.ts',
        '--workers=1',
      ], liveEnv),
    );
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(
    `[production-gate-full] phase=${phaseMode} skipLive=${skipLive} skipLoad=${skipLoad} deliverableE2e=${withDeliverableE2e}`,
  );

  if (phaseMode === 'all' || phaseMode === 'offline') {
    await runOfflineSteps();
  }
  if (phaseMode === 'all' || phaseMode === 'e2e') {
    if (!skipLive) await runE2eSteps();
    else logStep('prelaunch-e2e-serial', true, 'SKIP --skip-live', 0);
  }
  if (phaseMode === 'all' || phaseMode === 'load') {
    await runLoadSteps();
  }
  if (phaseMode === 'all' || phaseMode === 'live') {
    await runLiveSteps();
  }

  const passed = steps.filter((s) => s.ok).length;
  const failed = steps.filter((s) => !s.ok);
  const summary = {
    phaseMode,
    skipLive,
    skipLoad,
    withDeliverableE2e,
    capturedAt: new Date().toISOString(),
    total: steps.length,
    passed,
    failed: failed.length,
    failures: failed.map((f) => f.name),
    steps,
  };
  fs.writeFileSync(SUMMARY_FILE, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`\n[production-gate-full] ${passed}/${steps.length} passed → ${SUMMARY_FILE}`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
