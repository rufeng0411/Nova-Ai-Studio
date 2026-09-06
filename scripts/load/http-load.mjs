#!/usr/bin/env node
/**
 * PD-SAAS-FORK: lightweight HTTP load smoke for SaaS pre-production checks.
 *
 * SERVER_URL must target the Bridge/API port (default 3001), not Vite dev (5173).
 * Example: SERVER_URL=http://127.0.0.1:3001 node scripts/load/http-load.mjs --scenario smoke
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertGatePhaseAllowed } from '../lib/gateMutex.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'pre-production-test');

const args = process.argv.slice(2);
const scenarioIdx = args.indexOf('--scenario');
const scenario = scenarioIdx >= 0 ? args[scenarioIdx + 1] : 'smoke';

const SERVER = (process.env.SERVER_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const configs = {
  smoke: { concurrency: 10, durationMs: 30_000, endpoints: ['captcha'] },
  stress: { concurrency: 50, durationMs: 120_000, endpoints: ['captcha', 'login'] },
  soak: { concurrency: 20, durationMs: 900_000, endpoints: ['captcha'] },
  spike: { concurrency: 100, durationMs: 60_000, endpoints: ['captcha'] },
};
const cfg = configs[scenario] || configs.smoke;

async function hitCaptcha() {
  const t0 = performance.now();
  try {
    const res = await fetch(`${SERVER}/api/saas/captcha`);
    return { ok: res.ok, ms: performance.now() - t0, status: res.status };
  } catch (error) {
    return { ok: false, ms: performance.now() - t0, error: String(error) };
  }
}

async function hitLogin() {
  const t0 = performance.now();
  try {
    const res = await fetch(`${SERVER}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'SAAS_ADMIN_PASSWORD' }),
    });
    return { ok: res.ok, ms: performance.now() - t0, status: res.status };
  } catch (error) {
    return { ok: false, ms: performance.now() - t0, error: String(error) };
  }
}

async function worker(endAt, stats) {
  while (Date.now() < endAt) {
    for (const ep of cfg.endpoints) {
      const r = ep === 'login' ? await hitLogin() : await hitCaptcha();
      stats.total += 1;
      if (r.ok) stats.ok += 1;
      else stats.fail += 1;
      stats.latencies.push(r.ms);
    }
  }
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]);
}

async function main() {
  const phaseCheck = assertGatePhaseAllowed('load');
  if (!phaseCheck.ok) {
    console.error(`[http-load] blocked: ${phaseCheck.reason}`);
    process.exit(1);
  }

  const stats = { total: 0, ok: 0, fail: 0, latencies: [] };
  const endAt = Date.now() + cfg.durationMs;
  const workers = Array.from({ length: cfg.concurrency }, () => worker(endAt, stats));
  await Promise.all(workers);

  const errorRate = stats.total ? stats.fail / stats.total : 1;
  const report = {
    scenario,
    server: SERVER,
    concurrency: cfg.concurrency,
    durationMs: cfg.durationMs,
    total: stats.total,
    ok: stats.ok,
    fail: stats.fail,
    errorRate: Number(errorRate.toFixed(4)),
    p50Ms: percentile(stats.latencies, 50),
    p95Ms: percentile(stats.latencies, 95),
    pass: errorRate < (scenario === 'smoke' ? 0.01 : 0.05),
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, `http-load-${scenario}.json`);
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[http-load] ${scenario}: total=${report.total} fail=${report.fail} p95=${report.p95Ms}ms → ${out}`);
  if (!report.pass) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
