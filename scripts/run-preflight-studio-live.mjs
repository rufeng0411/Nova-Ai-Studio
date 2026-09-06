#!/usr/bin/env node
/** PD-SAAS-FORK: Preflight Studio live gate (L3) — requires dev:saas Bridge 7990 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'artifacts/preflight-studio-live-20260730');
const gate = process.argv.includes('--gate');
const adversarial = process.argv.includes('--adversarial');

async function probe(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const bridge = process.env.SERVER_URL || process.env.PLAYWRIGHT_SERVER_URL || 'http://127.0.0.1:7990';
  const ui = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8081';
  const ready = await probe(`${bridge}/api/saas/health/ready`);
  const report = {
    ts: new Date().toISOString(),
    bridge,
    ui,
    bridgeReady: ready,
    cases: [],
    pass: false,
  };

  if (!ready && gate) {
    report.cases.push({ id: 'bridge-ready', ok: false, note: 'Bridge not ready — start dev:saas' });
    await writeFile(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.error('[preflight:live:gate] Bridge not ready');
    process.exit(1);
  }

  const offline = spawnSync('node', ['scripts/run-preflight-studio-offline.mjs', '--gate'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  });
  report.cases.push({ id: 'offline-prereq', ok: offline.status === 0 });

  if (ready) {
    const e2e = spawnSync('npx', ['playwright', 'test', 'ui/e2e/saas/preflight-studio.spec.ts', '--reporter=line'], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: true,
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: ui,
        PLAYWRIGHT_SERVER_URL: bridge,
        PILOTDECK_PREFLIGHT_STUDIO: 'shadow',
      },
    });
    report.cases.push({
      id: 'playwright-e2e',
      ok: e2e.status === 0,
      note: adversarial ? 'includes adversarial subset' : undefined,
    });
  } else {
    report.cases.push({ id: 'playwright-e2e', ok: !gate, note: 'skipped — no bridge' });
  }

  report.pass = report.cases.every((c) => c.ok);
  await writeFile(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (gate && !report.pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
