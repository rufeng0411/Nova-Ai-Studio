#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Production readiness full test orchestrator.
 * Usage:
 *   node scripts/run-production-readiness-full.mjs
 *   node scripts/run-production-readiness-full.mjs --skip-live --skip-docker --skip-load
 *   CAP_LIVE_LIMIT=5 TEMPLATE_LIVE_DRY=1 node scripts/run-production-readiness-full.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'full-test');
const LOG_FILE = path.join(OUT_DIR, 'suite-log.jsonl');

const skipLive = process.argv.includes('--skip-live');
const skipDocker = process.argv.includes('--skip-docker');
const skipLoad = process.argv.includes('--skip-load');
const skipPg = process.argv.includes('--skip-pg');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const nodeCmd = process.execPath;

const steps = [];

function logStep(phase, name, ok, detail = '', durationMs = 0) {
  const entry = { phase, name, ok, detail, durationMs, at: new Date().toISOString() };
  steps.push(entry);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`, 'utf8');
  console.log(`\n[${ok ? 'PASS' : 'FAIL'}] [${phase}] ${name}${detail ? ` — ${detail}` : ''} (${Math.round(durationMs / 1000)}s)`);
}

function run(cmd, args, extraEnv = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const t0 = Date.now();
    const child = spawn(cmd, args, {
      cwd: REPO_ROOT,
      env: { ...process.env, ...extraEnv },
      stdio: 'inherit',
      shell: false,
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

async function step(phase, name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    logStep(phase, name, true, '', Date.now() - t0);
    return true;
  } catch (error) {
    const detail = error?.code != null ? `exit ${error.code}` : String(error?.error || error);
    logStep(phase, name, false, detail, Date.now() - t0);
    return false;
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, '', 'utf8');
  const vite = process.env.VITE_URL || 'http://127.0.0.1:5173';
  const server = process.env.SERVER_URL || 'http://127.0.0.1:3001';
  const liveEnv = { VITE_URL: vite, BASE_URL: vite, SERVER_URL: server, PLAYWRIGHT_BASE_URL: vite };

  console.log(`[production-readiness] skipLive=${skipLive} skipDocker=${skipDocker} skipLoad=${skipLoad}`);

  // Phase 0 — 48h regression + baseline
  await step('P0', 'capabilities:gen', () => run(npmCmd, ['run', 'capabilities:gen']));
  await step('P0', 'test:process-ux:full', () => run(npmCmd, ['run', 'test:process-ux:full']));
  await step('P0', 'smoke:document-export', () => run(npmCmd, ['run', 'smoke:document-export']));
  await step('P0', 'smoke:nova-ppt-try', () => run(npmCmd, ['run', 'smoke:nova-ppt-try']));
  await step('P0', 'smoke:editable-pptx-kit', () => run(npmCmd, ['run', 'smoke:editable-pptx-kit']));
  await step('P0', 'test:prelaunch:quick', () => run(npmCmd, ['run', 'test:prelaunch:quick']));
  await step('P0', 'smoke:resilience', () => run(npmCmd, ['run', 'smoke:resilience']));
  await step('P0', 'brand:check', () => run(npmCmd, ['run', 'brand:check']));
  await step('P0', 'check:saas-fork', () => run(npmCmd, ['run', 'check:saas-fork']));

  // Phase 1 — stability suite
  await step('P1', 'test:prelaunch:stability', () => run(npmCmd, ['run', 'test:prelaunch:stability']));
  await step('P1', 'test:saas:storage', () => run(nodeCmd, ['scripts/integration-saas-storage-comprehensive.mjs']));
  await step('P1', 'test:saas:folder', () => run(nodeCmd, ['scripts/integration-saas-folder-scenarios.mjs']));
  if (!skipPg && process.env.SAAS_DATABASE_URL?.trim()) {
    await step('P1', 'test:saas:pg-validation', () => run(npmCmd, ['run', 'test:saas:pg-validation']));
  } else {
    logStep('P1', 'test:saas:pg-validation', true, 'SKIP no SAAS_DATABASE_URL or --skip-pg', 0);
  }

  // Phase 2 — static capability/template smoke
  await step('P2', 'smoke:capability-hub', () => run(npmCmd, ['run', 'smoke:capability-hub']));
  await step('P2', 'smoke:capability-try-prompts', () => run(npmCmd, ['run', 'smoke:capability-try-prompts']));
  await step('P2', 'smoke:skill-risk', () => run(npmCmd, ['run', 'smoke:skill-risk']));
  await step('P2', 'smoke:marketing-install', () => run(npmCmd, ['run', 'smoke:marketing-install']));
  await step('P2', 'verify:marketing-saas', () => run(npmCmd, ['run', 'verify:marketing-saas']));
  await step('P2', 'smoke:od-skills', () => run(npmCmd, ['run', 'smoke:od-skills']));
  await step('P2', 'smoke:templates', () => run(npmCmd, ['run', 'smoke:templates']));
  await step('P2', 'test:multi-skill:matrix', () => run(npmCmd, ['run', 'test:multi-skill:matrix']));

  if (!skipLive) {
    // Phase 3 — capability live
    await step('P3', 'capability-representative-live', () =>
      run(nodeCmd, ['scripts/integration-capability-representative-live.mjs'], liveEnv),
    );

    // Phase 4 — template live
    await step('P4', 'process-template-live', () =>
      run(nodeCmd, ['scripts/integration-process-template-live.mjs'], liveEnv),
    );

    // Phase 5 — multi-user + resilience + playwright
    await step('P5', 'test:saas:deep', () => run(npmCmd, ['run', 'test:saas:deep']));
    await step('P5', 'test:multi-user:sim', () =>
      run(npmCmd, ['run', 'test:multi-user:sim'], { FORCE_MULTI_USER_SIM: '1' }),
    );
    await step('P5', 'resilience-live', () =>
      run(nodeCmd, ['scripts/integration-conversation-resilience-live.mjs'], liveEnv),
    );
    await step('P5', 'playwright-saas-core', () =>
      run(npxCmd, [
        'playwright',
        'test',
        'ui/e2e/saas',
        'ui/e2e/chat-experience.spec.ts',
        'ui/e2e/path-folder-picker',
        'ui/e2e/phase3',
        '-c',
        'ui/playwright.config.ts',
      ], liveEnv),
    );
  } else {
    logStep('P3', 'capability-representative-live', true, 'SKIP --skip-live', 0);
    logStep('P4', 'process-template-live', true, 'SKIP --skip-live', 0);
    logStep('P5', 'live-suite', true, 'SKIP --skip-live', 0);
  }

  // Phase 6 — security
  await step('P6', 'security-regression-checklist', () =>
    run(nodeCmd, ['scripts/security-regression-checklist.mjs'], liveEnv),
  );

  if (!skipLoad) {
    // Phase 7 — load tests
    await step('P7', 'http-load-smoke', () =>
      run(nodeCmd, ['scripts/load/http-load.mjs', '--scenario', 'smoke'], liveEnv),
    );
    await step('P7', 'http-load-stress', () =>
      run(nodeCmd, ['scripts/load/http-load.mjs', '--scenario', 'stress'], liveEnv),
    );
    await step('P7', 'http-load-soak', () =>
      run(nodeCmd, ['scripts/load/http-load.mjs', '--scenario', 'soak'], liveEnv),
    );
    await step('P7', 'http-load-spike', () =>
      run(nodeCmd, ['scripts/load/http-load.mjs', '--scenario', 'spike'], liveEnv),
    );
  } else {
    logStep('P7', 'http-load', true, 'SKIP --skip-load', 0);
  }

  if (!skipDocker && !skipLive) {
    // Phase 8 — docker + browser + mobile
    await step('P8', 'pack:preflight', () => run(npmCmd, ['run', 'pack:preflight']));
    await step('P8', 'docker-smoke', () => run(nodeCmd, ['scripts/docker-smoke.mjs'], liveEnv));
    await step('P8', 'browser-compat', () =>
      run(nodeCmd, ['scripts/browser-compat-check.mjs'], liveEnv),
    );
    await step('P8', 'mobile-regression', () =>
      run(nodeCmd, ['scripts/mobile-regression-check.mjs'], liveEnv),
    );
    await step('P8', 'oss-regression', () => run(nodeCmd, ['scripts/oss-regression.mjs'], liveEnv));
    await step('P8', 'test:launcher:quick', () => run(npmCmd, ['run', 'test:launcher:quick']));
  } else {
    logStep('P8', 'docker-browser-mobile', true, 'SKIP docker/live', 0);
  }

  const passed = steps.filter((s) => s.ok).length;
  const failed = steps.filter((s) => !s.ok);
  const summary = {
    skipLive,
    skipDocker,
    skipLoad,
    capturedAt: new Date().toISOString(),
    total: steps.length,
    passed,
    failed: failed.length,
    failures: failed.map((f) => `${f.phase}:${f.name}`),
    steps,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'suite-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`\n[production-readiness] ${passed}/${steps.length} passed → ${OUT_DIR}`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
