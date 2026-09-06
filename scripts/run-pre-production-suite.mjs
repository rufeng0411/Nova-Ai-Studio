#!/usr/bin/env node
/**
 * PD-SAAS-FORK: lean pre-production test orchestrator.
 * Usage: node scripts/run-pre-production-suite.mjs [--lean] [--skip-live]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'pre-production-test');
const LOG_FILE = path.join(OUT_DIR, 'suite-log.jsonl');

const lean = process.argv.includes('--lean') || !process.argv.includes('--full');
const skipLive =
  process.argv.includes('--skip-live') ||
  process.env.PILOTDECK_SKIP_LIVE === '1' ||
  process.env.PRE_PRODUCTION_SKIP_LIVE === '1';

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const isWindowsShellScript = (cmd) => process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(cmd);

const steps = [];

function logStep(name, ok, detail = '', durationMs = 0) {
  const entry = { name, ok, detail, durationMs, at: new Date().toISOString() };
  steps.push(entry);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`, 'utf8');
  console.log(`\n[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''} (${Math.round(durationMs / 1000)}s)`);
}

function run(cmd, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const t0 = Date.now();
    const cwd = options.cwd || REPO_ROOT;
    const extraEnv = options.env || {};
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...extraEnv },
      stdio: 'inherit',
      shell: isWindowsShellScript(cmd),
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

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, '', 'utf8');
  console.log(`[pre-production] lean=${lean} skipLive=${skipLive}`);

  await step('os-compat-smoke', () => run(process.execPath, ['scripts/os-compat-smoke.mjs']));
  await step('build', () => run(npmCmd, ['run', 'build']));
  await step('test:termination-policy', () => run(npmCmd, ['run', 'test:termination-policy']));
  await step('test:early-stop-deliverable', () => run(npmCmd, ['run', 'test:early-stop-deliverable']));
  await step('test:display-engine-alignment', () => run(npmCmd, ['run', 'test:display-engine-alignment']));
  await step('test:four-line-e2e', () => run(npmCmd, ['run', 'test:four-line-e2e']));
  await step('test:dialogue-stability:full-chain', () => run(npmCmd, ['run', 'test:dialogue-stability:full-chain']));
  await step('test:saas:deep', () => run(npmCmd, ['run', 'test:saas:deep']));
  await step('check:saas-fork', () => run(npmCmd, ['run', 'check:saas-fork']));
  await step('brand:check', () => run(npmCmd, ['run', 'brand:check']));
  await step('smoke:resilience', () => run(npmCmd, ['run', 'smoke:resilience']));
  await step('smoke:project-memory', () => run(npmCmd, ['run', 'smoke:project-memory']));
  await step('smoke:saas-isolation', () => run(npmCmd, ['run', 'smoke:saas-isolation']));
  await step('vitest-resilience-ui', () =>
    run(npmCmd, [
      '--workspace',
      'ui',
      'run',
      'test',
      '--',
      'src/components/chat-v2/hooks/useAutoRecoveryContinue.test.ts',
      'src/shared/userFacingErrors.test.ts',
      'src/shared/stripLeakedToolMarkup.test.ts',
    ]),
  );
  await step('test:saas:storage', () => run(process.execPath, ['scripts/integration-saas-storage-comprehensive.mjs']));
  await step('test:saas:folder', () => run(process.execPath, ['scripts/integration-saas-folder-scenarios.mjs']));
  await step('smoke:capability-hub', () => run(npmCmd, ['run', 'smoke:capability-hub']));
  await step('smoke:conversation-catalog', () => run(npmCmd, ['run', 'smoke:conversation-catalog']));

  if (process.env.SAAS_DATABASE_URL?.trim()) {
    await step('test:saas:pg-validation', () => run(npmCmd, ['run', 'test:saas:pg-validation']));
  } else {
    logStep('test:saas:pg-validation', true, 'SKIP no SAAS_DATABASE_URL', 0);
  }

  if (!skipLive) {
    const vite = process.env.VITE_URL || 'http://127.0.0.1:5173';
    const server = process.env.SERVER_URL || 'http://127.0.0.1:3001';
    const liveEnv = { VITE_URL: vite, BASE_URL: vite, SERVER_URL: server, PLAYWRIGHT_BASE_URL: vite };

    await step('resilience-live', () =>
      run(process.execPath, ['scripts/integration-conversation-resilience-live.mjs'], { env: liveEnv }),
    );
    await step('oss-regression', () => run(process.execPath, ['scripts/oss-regression.mjs'], { env: liveEnv }));
    await step('mobile-regression', () =>
      run(process.execPath, ['scripts/mobile-regression-check.mjs'], { env: liveEnv }),
    );
    await step('browser-compat-lean', () =>
      run(process.execPath, ['scripts/browser-compat-check.mjs', '--lean'], { env: liveEnv }),
    );
    await step('playwright-saas-core', () =>
      run(npxCmd, [
        'playwright',
        'test',
        'ui/e2e/chat-experience.spec.ts',
        'ui/e2e/saas/resilience-recovery.spec.ts',
        'ui/e2e/saas/isolation.spec.ts',
        'ui/e2e/saas/deep-uat.spec.ts',
        'ui/e2e/saas/long-session.spec.ts',
        'ui/e2e/phase3/admin-dashboard.spec.ts',
        '-c',
        'ui/playwright.config.ts',
      ], { env: liveEnv }),
    );
    await step('http-load-smoke', () =>
      run(process.execPath, ['scripts/load/http-load.mjs', '--scenario', 'smoke'], { env: liveEnv }),
    );
  }

  await step('pack:preflight', () => run(npmCmd, ['run', 'pack:preflight']));

  const passed = steps.filter((s) => s.ok).length;
  const failed = steps.filter((s) => !s.ok);
  const summary = {
    lean,
    skipLive,
    capturedAt: new Date().toISOString(),
    total: steps.length,
    passed,
    failed: failed.length,
    failures: failed.map((f) => f.name),
    steps,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'suite-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`\n[pre-production] ${passed}/${steps.length} passed → ${OUT_DIR}`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
