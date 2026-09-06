#!/usr/bin/env node
/**
 * PD-SAAS-FORK: One-shot Mingdi G700 full acceptance — dev stack + bridge soak + live Gateway.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { probeServer, resolveLiveServerUrl, runMingdiG700LiveGateway } from './run-mingdi-g700-live-gateway.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'mingdi-g700-production-acceptance');

function runStep(label, fn) {
  console.log(`\n[full-acceptance] === ${label} ===`);
  return Promise.resolve(fn());
}

function npmRun(script, extraEnv = {}) {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCmd, ['run', script], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...extraEnv },
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return {
    label: script,
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function nodeScript(relativePath, args = [], extraEnv = {}) {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', path.join(REPO_ROOT, relativePath), ...args],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, ...extraEnv },
      encoding: 'utf8',
      shell: false,
    },
  );
  return {
    label: relativePath,
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

async function startDevIfNeeded(serverUrl) {
  if (await probeServer(serverUrl)) {
    console.log(`[full-acceptance] dev 已就绪 ${serverUrl}`);
    return null;
  }
  console.log('[full-acceptance] 启动 dev:saas…');
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npmCmd, ['run', 'dev:saas'], {
    cwd: REPO_ROOT,
    stdio: 'ignore',
    detached: true,
    shell: process.platform === 'win32',
    env: { ...process.env },
  });
  child.unref();
  return child;
}

async function waitForServer(timeoutMs = 360_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const url = await resolveLiveServerUrl();
    if (url && await probeServer(url)) return url;
    // eslint-disable-next-line no-await-in-loop
    await delay(4_000);
  }
  return null;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const startedAt = new Date().toISOString();
  const matrix = [];

  const seedUrl = process.env.SERVER_URL || process.env.MINGDI_G700_LIVE_URL || 'http://127.0.0.1:7990';
  await startDevIfNeeded(seedUrl);
  const serverUrl = await waitForServer(360_000);
  if (!serverUrl) {
    throw new Error('dev:saas 360s 内未就绪');
  }
  console.log(`[full-acceptance] Bridge ${serverUrl}`);

  const envBase = {
    SERVER_URL: serverUrl,
    MINGDI_G700_LIVE_URL: serverUrl,
    PILOTDECK_CLOUD_OFFICIAL_MEDIA_URL: `${serverUrl}/api/saas/health/ready`,
  };

  async function pushStep(label, fn) {
    console.log(`\n[full-acceptance] === ${label} ===`);
    const row = await Promise.resolve(fn());
    matrix.push(row);
    return row;
  }

  await pushStep('unit', () => npmRun('test:mingdi-g700:unit'));
  await pushStep('replay', () => nodeScript('scripts/audit-mingdi-g700-exports.mjs'));
  await pushStep('official-media', () => npmRun('test:official-media:acceptance'));
  await pushStep('export-four-line', () => npmRun('test:export-four-line-parity'));
  await pushStep('saas-fork', () => npmRun('check:saas-fork'));
  await pushStep('scope-audit', () => nodeScript('scripts/audit-capability-scope.mjs'));
  await pushStep('cloud-smoke', () => nodeScript('scripts/smoke-cloud-official-media.mjs', [], envBase));
  await pushStep('bridge-unit', () => npmRun('test:bridge-stability:unit'));
  await pushStep('bridge-smoke', () => npmRun('test:bridge-stability:smoke', envBase));
  await pushStep('bridge-browse', () => npmRun('test:bridge-stability:browse', envBase));
  await pushStep('bridge-load', () => npmRun('test:bridge-stability:load', envBase));
  await pushStep('bridge-soak', () => npmRun('test:bridge-stability:soak', {
    ...envBase,
    BRIDGE_SOAK_DURATION_MS: process.env.BRIDGE_SOAK_DURATION_MS || '180000',
  }));

  let liveReport = null;
  try {
    await runStep('live-gateway-7', async () => {
      liveReport = await runMingdiG700LiveGateway({ serverUrl });
      matrix.push({
        label: 'live-gateway-7',
        ok: Boolean(liveReport?.pass),
        status: liveReport?.pass ? 0 : 1,
      });
    });
  } catch (error) {
    liveReport = {
      pass: false,
      error: error instanceof Error ? error.message : String(error),
    };
    matrix.push({ label: 'live-gateway-7', ok: false, status: 1, stderr: liveReport.error });
  }

  const summary = {
    schemaVersion: 2,
    reportTitle: '鸣镝 G700 全量实机验收',
    generatedAt: new Date().toISOString(),
    startedAt,
    serverUrl,
    productionGo: false,
    matrix: matrix.map((row) => ({
      id: row.label,
      status: row.ok ? 'PASS' : 'FAIL',
      exitCode: row.status,
    })),
    live: liveReport,
  };

  summary.productionGo = summary.matrix.every((row) => row.status === 'PASS')
    && Boolean(liveReport?.pass);

  const jsonPath = path.join(OUT_DIR, 'full-acceptance-report.json');
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`\n[full-acceptance] 汇总 → ${path.relative(REPO_ROOT, jsonPath)}`);
  console.log(`[full-acceptance] productionGo=${summary.productionGo}`);

  if (!summary.productionGo) process.exit(1);
}

main().catch((error) => {
  console.error(`[full-acceptance] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
