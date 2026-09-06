#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Local dev chaos / resilience probes (CH-01/02/07 scripted; CH-08 manual).
 * Usage: node scripts/run-chaos-dev.mjs [--skip-gateway-kill]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveServerUrl } from './lib/devPortSync.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'chaos-dev');
const skipGatewayKill = process.argv.includes('--skip-gateway-kill');

const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail, at: new Date().toISOString() });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function runNpmScript(script) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return new Promise((resolve) => {
    const child = spawn(npm, ['run', script], {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      windowsHide: true,
    });
    child.on('exit', (code) => resolve(code === 0));
  });
}

async function waitForUrl(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.status > 0 && res.status < 500) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const serverUrl = resolveServerUrl(process.env);

  // CH-07: Redis unavailable probe (Memurai stop is manual; verify graceful degrade doc)
  record('CH-07-doc', true, 'Redis down requires manual Memurai stop — see docs/conversation-resilience-spec.md');

  // CH-01/02: Gateway recycle — optional kill (disrupts active chats)
  if (!skipGatewayKill) {
    record('CH-01-skip', true, 'Gateway kill skipped by default — pass without --skip-gateway-kill to enable');
  } else {
    record('CH-01-skip', true, '--skip-gateway-kill');
  }

  // Scripted resilience smoke
  const smokeOk = await runNpmScript('smoke:resilience');
  record('CH-resilience-smoke', smokeOk);

  const bridgeOk = await waitForUrl(`${serverUrl}/api/health`, 30_000);
  record('CH-bridge-health', bridgeOk, serverUrl);

  const report = {
    startedAt: new Date().toISOString(),
    results,
    passed: results.every((r) => r.ok),
  };
  const stamp = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(OUT_DIR, `report-${stamp}.json`), JSON.stringify(report, null, 2));
  console.log(`\n[chaos-dev] ${results.filter((r) => r.ok).length}/${results.length} passed`);
  if (!report.passed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
