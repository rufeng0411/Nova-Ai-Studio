#!/usr/bin/env node
/**
 * PD-SAAS-FORK: UDC R11 六案实机 Playwright（0709-Test-2，workers=1 长任务）。
 * 保留全部测试记录；跑完后自动深度分析。
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8081';
const serverUrl = process.env.PLAYWRIGHT_SERVER_URL || 'http://127.0.0.1:7990';
const spec = 'ui/e2e/saas/0709-udc-live.spec.ts';
const artifactRoot = path.join(root, 'artifacts/0709-Test-2');

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
    const bridgeOk =
      (await probe(`${serverUrl}/api/health`).catch(() => false))
      || (await probe(`${serverUrl}/api/auth/login`).catch(() => false));
    if (uiOk && bridgeOk) return true;
    await delay(3000);
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
      console.log('[0709-udc] starting dev:saas…');
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

async function ensureProject() {
  const loginRes = await fetch(`${serverUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'SAAS_ADMIN_PASSWORD' }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!loginRes.ok) throw new Error('login_failed');
  const { token } = await loginRes.json();
  const listRes = await fetch(`${serverUrl}/api/projects?fresh=1`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  const listBody = await listRes.json();
  const projects = Array.isArray(listBody) ? listBody : (listBody.projects ?? []);
  const existing = projects.find(
    (p) => p.displayName === '0709-Test-2' || p.name === '0709-Test-2',
  );
  if (existing?.name) {
    console.log(`[0709-udc] reuse project → ${existing.name}`);
    return existing.name;
  }
  const created = await fetch(`${serverUrl}/api/projects/create-workspace`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: '0709-Test-2' }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!created.ok) throw new Error(`create_workspace_failed_${created.status}`);
  const body = await created.json();
  const slug = body?.project?.name || body?.name || '0709-Test-2';
  console.log(`[0709-udc] created project → ${slug}`);
  return slug;
}

async function main() {
  fs.mkdirSync(path.join(artifactRoot, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(artifactRoot, 'screenshots'), { recursive: true });

  const runMeta = {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exitCode: null,
    baseUrl,
    serverUrl,
    project: '0709-Test-2',
    workers: 1,
    cases: 6,
  };
  fs.writeFileSync(
    path.join(artifactRoot, 'logs/run-meta.json'),
    `${JSON.stringify(runMeta, null, 2)}\n`,
    'utf8',
  );

  await startDevIfNeeded();
  const ready = await waitForDev(300_000);
  if (!ready) {
    console.error(`[0709-udc] dev not ready at ${baseUrl} / ${serverUrl}`);
    process.exit(1);
  }
  console.log(`[0709-udc] dev ready → ${baseUrl}`);

  let projectSlug = '0709-Test-2';
  try {
    projectSlug = await ensureProject();
    runMeta.projectSlug = projectSlug;
    fs.writeFileSync(
      path.join(artifactRoot, 'logs/run-meta.json'),
      `${JSON.stringify(runMeta, null, 2)}\n`,
      'utf8',
    );
  } catch (err) {
    console.warn('[0709-udc] pre-create project failed, workers may race:', err);
  }

  const env = {
    ...process.env,
    O709_UDC_LIVE: '1',
    PLAYWRIGHT_BASE_URL: baseUrl,
    PLAYWRIGHT_SERVER_URL: serverUrl,
    SAAS_E2E_PROJECT: '0709-Test-2',
    SAAS_E2E_PROJECT_SLUG: projectSlug,
  };
  if (process.env.O709_UDC_CASES) env.O709_UDC_CASES = process.env.O709_UDC_CASES;
  if (process.env.O709_FRESH) env.O709_FRESH = process.env.O709_FRESH;

  const result = spawnSync(
    'npx',
    [
      'playwright',
      'test',
      '-c',
      'ui/playwright.config.ts',
      spec,
      '--workers=1',
      '--retries=0',
    ],
    {
      cwd: root,
      stdio: 'inherit',
      shell: true,
      env,
    },
  );

  runMeta.finishedAt = new Date().toISOString();
  runMeta.exitCode = result.status ?? 1;
  fs.writeFileSync(
    path.join(artifactRoot, 'logs/run-meta.json'),
    `${JSON.stringify(runMeta, null, 2)}\n`,
    'utf8',
  );

  console.log('[0709-udc] running deep analysis…');
  const analyze = spawnSync('node', ['scripts/analyze-0709-udc-live.mjs'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });

  const code = (result.status ?? 1) || (analyze.status ?? 0);
  console.log(`[0709-udc] finished exit=${code}`);
  console.log('[0709-udc] logs: artifacts/0709-Test-2/logs/');
  console.log('[0709-udc] report: docs/0709-Test-2-udc-live-report-*.zh-CN.md');
  console.log('[0709-udc] analysis: docs/0709-Test-2-udc-live-analysis-*.zh-CN.md');
  process.exit(code);
}

main().catch((err) => {
  console.error('[0709-udc] fatal', err);
  process.exit(1);
});
