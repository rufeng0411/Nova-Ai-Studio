#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 0709 代表性失败案例实机 Playwright 复测编排。
 * 默认端口对齐 Nova Launcher（8081/7990）；禁止 teardown 验收项目。
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8081';
const serverUrl = process.env.PLAYWRIGHT_SERVER_URL || 'http://127.0.0.1:7990';
const spec = 'ui/e2e/saas/0709-failure-retest-live.spec.ts';

async function probe(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.status > 0 && res.status < 500;
  } catch {
    return false;
  }
}

async function waitForDev(timeoutMs = 180_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const uiOk = await probe(baseUrl);
    const bridgeOk = await probe(`${serverUrl}/api/health`).catch(() => false)
      || await probe(`${serverUrl}/api/auth/login`).catch(() => false);
    if (uiOk && bridgeOk) return true;
    await delay(2000);
  }
  return false;
}

function startDevIfNeeded() {
  return new Promise((resolveStart) => {
    probe(baseUrl).then(async (ok) => {
      if (ok) {
        resolveStart(null);
        return;
      }
      console.log('[0709-retest] starting dev:saas…');
      const child = spawn('npm', ['run', 'dev'], {
        cwd: root,
        stdio: 'ignore',
        detached: true,
        shell: true,
        env: { ...process.env },
      });
      child.unref();
      resolveStart(child);
    });
  });
}

async function main() {
  fs.mkdirSync(path.join(root, 'artifacts/0709-TEST/logs'), { recursive: true });

  await startDevIfNeeded();
  const ready = await waitForDev(240_000);
  if (!ready) {
    console.error(`[0709-retest] dev not ready at ${baseUrl} / ${serverUrl}`);
    process.exit(1);
  }
  console.log(`[0709-retest] dev ready → ${baseUrl}`);

  const env = {
    ...process.env,
    O709_LIVE_RETEST: '1',
    PLAYWRIGHT_BASE_URL: baseUrl,
    PLAYWRIGHT_SERVER_URL: serverUrl,
    SAAS_E2E_PROJECT: '0709-TEST',
  };

  const result = spawnSync(
    'npx',
    ['playwright', 'test', '-c', 'ui/playwright.config.ts', spec, '--workers=1'],
    {
      cwd: root,
      stdio: 'inherit',
      shell: true,
      env,
    },
  );

  const code = result.status ?? 1;
  console.log(`[0709-retest] finished exit=${code}`);
  console.log('[0709-retest] logs: artifacts/0709-TEST/logs/0709-live-retest.jsonl');
  console.log('[0709-retest] report: docs/0709-test-live-retest-report-*.zh-CN.md');
  process.exit(code);
}

main().catch((err) => {
  console.error('[0709-retest] fatal', err);
  process.exit(1);
});
