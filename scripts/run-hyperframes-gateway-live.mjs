#!/usr/bin/env node
// PD-SAAS-FORK: HyperFrames Gateway + Playwright live acceptance
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8081';
const serverUrl = process.env.PLAYWRIGHT_SERVER_URL || 'http://127.0.0.1:7990';
const spec = 'ui/e2e/saas/hyperframes-gateway-live.spec.ts';
const artifactRoot = path.join(root, 'artifacts/hyperframes-gateway-live');

async function probe(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.status > 0 && res.status < 500;
  } catch {
    return false;
  }
}

async function waitForDev(timeoutMs = 300_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const uiOk = await probe(baseUrl);
    const bridgeOk = await probe(`${serverUrl}/api/health`).catch(() => false)
      || await probe(`${serverUrl}/api/saas/health/ready`).catch(() => false);
    const gwToken = path.join(process.env.USERPROFILE || process.env.HOME || '', '.pilotdeck', 'server-token');
    const gwOk = fs.existsSync(gwToken);
    if (uiOk && bridgeOk && gwOk) return true;
    await delay(3000);
  }
  return false;
}

function startDevBackground() {
  console.log('[hf-gateway-live] starting npm run dev …');
  const child = spawn('npm', ['run', 'dev'], {
    cwd: root,
    stdio: 'ignore',
    detached: true,
    shell: true,
    env: { ...process.env },
  });
  child.unref();
  return child;
}

async function main() {
  fs.mkdirSync(artifactRoot, { recursive: true });

  const ffprobe = spawnSync('where', ['ffprobe'], { encoding: 'utf8', shell: true, windowsHide: true });
  if (ffprobe.status !== 0) {
    console.error('[hf-gateway-live] ffprobe not found');
    process.exit(2);
  }

  if (!(await probe(baseUrl))) {
    startDevBackground();
  }

  const ready = await waitForDev(360_000);
  if (!ready) {
    console.error(`[hf-gateway-live] dev stack not ready (UI=${baseUrl} Bridge=${serverUrl})`);
    process.exit(1);
  }
  console.log(`[hf-gateway-live] stack ready → UI ${baseUrl} Bridge ${serverUrl}`);

  const env = {
    ...process.env,
    HYPERFRAMES_GATEWAY_LIVE: '1',
    PLAYWRIGHT_BASE_URL: baseUrl,
    PLAYWRIGHT_SERVER_URL: serverUrl,
    SAAS_E2E_PROJECT: process.env.SAAS_E2E_PROJECT || 'HF-Gateway-Test',
  };

  const result = spawnSync(
    'npx',
    ['playwright', 'test', '-c', 'ui/playwright.config.ts', spec, '--workers=1', '--retries=0'],
    { cwd: root, stdio: 'inherit', shell: true, env },
  );

  const code = result.status ?? 1;
  console.log(`[hf-gateway-live] finished exit=${code}`);
  console.log(`[hf-gateway-live] report: artifacts/hyperframes-gateway-live/acceptance-report.zh-CN.md`);
  process.exit(code);
}

main().catch((err) => {
  console.error('[hf-gateway-live] fatal', err);
  process.exit(1);
});
