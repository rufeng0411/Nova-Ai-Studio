#!/usr/bin/env node
/**
 * PD-SAAS-FORK: live-cases runner — prefers Playwright when BASE_URL set; else fixture smoke.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(
  root,
  'artifacts/workbench-beta-11-acceptance',
  new Date().toISOString().replace(/[:.]/g, '-'),
);
mkdirSync(outDir, { recursive: true });

spawnSync('node', ['scripts/seed-workbench-beta-11-fixtures.mjs'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

const base = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL;
const summary = {
  ts: new Date().toISOString(),
  base: base || null,
  core: {},
};

if (base) {
  const res = spawnSync(
    'npx',
    [
      'playwright',
      'test',
      '-c',
      'ui/playwright.config.ts',
      'ui/e2e/saas/workbench-beta-11-live-cases.spec.ts',
    ],
    { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', env: process.env },
  );
  summary.playwrightStatus = res.status;
  if (res.status !== 0) {
    writeFileSync(join(outDir, 'live-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
    process.exit(res.status || 1);
  }
  for (const id of [
    'LC-GEO',
    'LC-WIP',
    'LC-CHAT',
    'LC-TOUR',
    'LC-SWITCH',
    'LC-ISOLATION',
    'LC-HUB',
  ]) {
    summary.core[id] = 'pass';
  }
} else {
  // Offline smoke: fixture presence = pass for seed-backed core docs
  for (const id of ['LC-GEO', 'LC-WIP', 'LC-CHAT']) {
    const ok = existsSync(join(root, 'tests/fixtures/workbench-beta-11', id, 'meta.json'));
    summary.core[id] = ok ? 'pass' : 'fail';
    if (!ok) {
      writeFileSync(join(outDir, 'live-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
      console.error(`[live-cases] missing fixture ${id}`);
      process.exit(1);
    }
  }
  summary.note =
    'PLAYWRIGHT_BASE_URL unset — fixture smoke only. Re-run with launcher + BASE_URL for full core cases.';
  console.warn(summary.note);
}

writeFileSync(join(outDir, 'live-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(`[live-cases] wrote ${join(outDir, 'live-summary.json')}`);
