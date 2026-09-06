#!/usr/bin/env node
/**
 * Start dev (unless already running), run preflight Playwright specs, then stop.
 */
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isStandaloneDevMode, prepareSaasDevRuntime } from './lib/devLauncherCore.mjs';
import { mapPorts } from './lib/devPortSync.mjs';
import { runDevStack } from './lib/spawnDevStack.mjs';
import { withHiddenConsole } from './lib/winSpawn.mjs';
import { getConnectableHost } from '../ui/shared/networkHosts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

/** Pin ports so parent wait URL matches child dev-launcher / dev-saas resolution. */
const pinnedDevEnv = {
  SERVER_PORT: process.env.PLAYWRIGHT_SERVER_PORT || process.env.SERVER_PORT || '3011',
  VITE_PORT: process.env.PLAYWRIGHT_VITE_PORT || process.env.VITE_PORT || '5183',
  PILOTDECK_GATEWAY_PORT:
    process.env.PLAYWRIGHT_GATEWAY_PORT || process.env.PILOTDECK_GATEWAY_PORT || '18801',
  PILOTDECK_GATEWAY_URL:
    process.env.PILOTDECK_GATEWAY_URL
    || `ws://127.0.0.1:${process.env.PLAYWRIGHT_GATEWAY_PORT || process.env.PILOTDECK_GATEWAY_PORT || '18801'}/ws`,
};

const ports = mapPorts({ ...process.env, ...pinnedDevEnv });
const host = getConnectableHost(process.env.HOST || '0.0.0.0');
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || `http://${host}:${ports.vitePort}`;

async function waitForUrl(url, timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(4_000) });
      if (response.status > 0 && response.status < 500) {
        return true;
      }
    } catch {
      // retry
    }
    await delay(1_500);
  }
  return false;
}

async function spawnDev() {
  const envOverrides = {
    ...process.env,
    ...pinnedDevEnv,
    PILOTDECK_SKIP_DEFAULT_PROJECT: '1',
  };
  if (isStandaloneDevMode(process.env)) {
    return runDevStack(repoRoot, envOverrides, { log: true });
  }
  const runtime = await prepareSaasDevRuntime(repoRoot);
  const env = { ...runtime.env, ...pinnedDevEnv };
  return runDevStack(repoRoot, env, { log: true });
}

function runPlaywright() {
  const useShell = process.platform === 'win32';
  const npxCmd = useShell ? 'npx' : 'npx';
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(
      npxCmd,
      [
        'playwright',
        'test',
        '-c',
        'ui/playwright.config.ts',
        ...(process.env.PLAYWRIGHT_SPEC_DIRS
          ? process.env.PLAYWRIGHT_SPEC_DIRS.split(',').map((s) => s.trim()).filter(Boolean)
          : ['ui/e2e/preflight']),
      ],
      withHiddenConsole({
        cwd: repoRoot,
        env: {
          ...process.env,
          PLAYWRIGHT_BASE_URL: baseUrl,
        },
        stdio: 'inherit',
        shell: useShell,
      }),
    );
    child.on('error', rejectRun);
    child.on('exit', (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`playwright exited with code ${code ?? 'null'}`));
    });
  });
}

async function main() {
  const skipSpawn = process.env.PILOTDECK_DEV_ALREADY_RUNNING === '1';
  let devChild = null;

  if (!skipSpawn) {
    console.log(`[playwright-with-dev] starting dev stack...`);
    devChild = await spawnDev();
    const ready = await waitForUrl(baseUrl);
    if (!ready) {
      if (devChild && !devChild.killed) devChild.kill('SIGTERM');
      throw new Error(`dev server did not become ready at ${baseUrl}`);
    }
  } else {
    console.log(`[playwright-with-dev] reusing running dev at ${baseUrl}`);
    const ready = await waitForUrl(baseUrl, 15_000);
    if (!ready) {
      throw new Error(`expected running dev at ${baseUrl}`);
    }
  }

  try {
    if (process.env.PLAYWRIGHT_RUN_OSS_REGRESSION === '1' && isStandaloneDevMode(process.env)) {
      await new Promise((resolveRun, rejectRun) => {
        const child = spawn(process.execPath, ['scripts/oss-regression.mjs'], {
          cwd: repoRoot,
          env: { ...process.env, PLAYWRIGHT_BASE_URL: baseUrl, VITE_URL: baseUrl },
          stdio: 'inherit',
        });
        child.on('error', rejectRun);
        child.on('exit', (code) => {
          if (code === 0) resolveRun();
          else rejectRun(new Error(`oss-regression exited with ${code ?? 'null'}`));
        });
      });
    }
    await runPlaywright();
    console.log('[playwright-with-dev] OK');
  } finally {
    if (devChild && !devChild.killed) {
      devChild.kill('SIGTERM');
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
