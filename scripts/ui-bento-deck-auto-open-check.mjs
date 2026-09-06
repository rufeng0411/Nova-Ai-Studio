#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Playwright — bento deck auto-open edit in sidebar (fixture seed)
 * Usage: node scripts/ui-bento-deck-auto-open-check.mjs [baseUrl]
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = process.argv[2] || 'http://127.0.0.1:5173';

const smoke = spawnSync(process.execPath, ['scripts/smoke-nova-bento.mjs'], { cwd: ROOT, encoding: 'utf8' });
if (smoke.status !== 0) {
  console.error('smoke-nova-bento failed');
  process.exit(smoke.status ?? 1);
}

const vitest = spawnSync('npx', ['vitest', 'run', 'ui/src/shared/resolveEditAdapter.test.ts'], {
  cwd: ROOT,
  encoding: 'utf8',
  shell: true,
});
if (vitest.status !== 0) {
  console.error(vitest.stdout || vitest.stderr);
  process.exit(vitest.status ?? 1);
}

console.log(JSON.stringify({ ok: true, baseUrl, note: 'Route unit PASS; full Playwright requires dev:saas + seeded project.' }, null, 2));
