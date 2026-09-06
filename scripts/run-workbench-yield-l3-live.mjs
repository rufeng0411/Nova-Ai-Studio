#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 工作台良品率对齐 L3 Playwright 实机编排
 *   node scripts/run-workbench-yield-l3-live.mjs --gate
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'artifacts/workbench-yield-L3');
const gate = process.argv.includes('--gate');

async function probe(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const bridge = process.env.PLAYWRIGHT_SERVER_URL || process.env.SERVER_URL || 'http://127.0.0.1:7990';
  const ui = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8081';
  const ready = await probe(`${bridge}/api/saas/health/ready`);
  const uiOk = await probe(ui);

  const meta = {
    ts: new Date().toISOString(),
    bridge,
    ui,
    bridgeReady: ready,
    uiReady: uiOk,
  };
  await writeFile(path.join(OUT, 'probe.json'), `${JSON.stringify(meta, null, 2)}\n`);

  if (!ready) {
    console.error('[workbench-yield-L3] Bridge not ready — start Nova Launcher / dev:saas');
    if (gate) process.exit(1);
    return;
  }

  const env = {
    ...process.env,
    WORKBENCH_YIELD_LIVE: '1',
    PLAYWRIGHT_BASE_URL: ui,
    PLAYWRIGHT_SERVER_URL: bridge,
  };

  const run = spawnSync(
    'npx',
    ['playwright', 'test', 'ui/e2e/saas/workbench-yield-l3-live.spec.ts', '--workers=1', '--reporter=line'],
    { cwd: ROOT, encoding: 'utf8', shell: true, env, timeout: 900_000 },
  );

  console.log(run.stdout || '');
  if (run.stderr) console.error(run.stderr);

  let report = null;
  try {
    report = JSON.parse(await readFile(path.join(OUT, 'report.json'), 'utf8'));
  } catch {
    report = { pass: false, note: 'report.json missing', exitCode: run.status };
  }

  console.log('[workbench-yield-L3] playwright exit=', run.status, 'report.pass=', report.pass);
  if (gate && (run.status !== 0 || !report.pass)) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
