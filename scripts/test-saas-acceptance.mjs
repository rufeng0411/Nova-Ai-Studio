#!/usr/bin/env node
/**
 * L5 acceptance: L6 automated stack + Playwright (OSS preflight + SaaS phase0–3).
 * OSS LAN specs require `PILOTDECK_DEV_MODE=standalone` (`npm run dev:standalone`);
 * SaaS specs use default `npm run dev`.
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(args, extraEnv = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(npmCmd, args, {
      cwd: repoRoot,
      env: { ...process.env, ...extraEnv },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', rejectRun);
    child.on('exit', (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${args.join(' ')} exited with ${code ?? 'null'}`));
    });
  });
}

function runPlaywrightHarness(extraEnv) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, ['scripts/playwright-with-dev.mjs'], {
      cwd: repoRoot,
      env: { ...process.env, ...extraEnv },
      stdio: 'inherit',
    });
    child.on('error', rejectRun);
    child.on('exit', (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`playwright-with-dev exited with ${code ?? 'null'}`));
    });
  });
}

function runPlaywrightStatic(specs) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(
      npxCmd,
      ['playwright', 'test', '-c', 'ui/playwright.config.ts', ...specs],
      {
        cwd: repoRoot,
        env: { ...process.env },
        stdio: 'inherit',
        shell: process.platform === 'win32',
      },
    );
    child.on('error', rejectRun);
    child.on('exit', (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`playwright static exited with ${code ?? 'null'}`));
    });
  });
}

async function main() {
  await run(['run', 'test:saas:deep']);
  await run(['run', 'test:saas:all']);
  await run(['run', 'test:ui:unit']);
  await run(['test']);
  await run(['run', 'check:saas-fork']);
  await run(['run', 'brand:check']);

  // Phase 0 design HTML — no dev server
  await runPlaywrightStatic(['ui/e2e/phase0/design-sketch.spec.ts']);

  // OSS LAN preflight — must not use SaaS (login wall blocks composer)
  await runPlaywrightHarness({
    PILOTDECK_DEV_MODE: 'standalone',
    PLAYWRIGHT_SPEC_DIRS: 'ui/e2e/preflight,ui/e2e/chat-experience.spec.ts',
    PLAYWRIGHT_RUN_OSS_REGRESSION: process.env.OSS_REGRESSION_SKIP === '1' ? '' : '1',
    SERVER_PORT: process.env.PLAYWRIGHT_OSS_SERVER_PORT || '3001',
    VITE_PORT: process.env.PLAYWRIGHT_OSS_VITE_PORT || '5173',
    PILOTDECK_GATEWAY_PORT: process.env.PLAYWRIGHT_OSS_GATEWAY_PORT || '18789',
  });

  // SaaS phase 1–3 — pinned ports match playwright-with-dev defaults
  await runPlaywrightHarness({
    PILOTDECK_DEV_MODE: 'saas',
    PLAYWRIGHT_SPEC_DIRS: 'ui/e2e/phase1,ui/e2e/phase2,ui/e2e/phase3,ui/e2e/saas',
    SERVER_PORT: process.env.PLAYWRIGHT_SAAS_SERVER_PORT || '3011',
    VITE_PORT: process.env.PLAYWRIGHT_SAAS_VITE_PORT || '5183',
    PILOTDECK_GATEWAY_PORT: process.env.PLAYWRIGHT_SAAS_GATEWAY_PORT || '18801',
  });

  console.log('[test:saas:acceptance] OK');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
