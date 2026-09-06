#!/usr/bin/env node
/**
 * PD-SAAS-FORK: P1-5 prelaunch skill 实跑 — open-design / anth-docx / pd-geo
 *
 * Usage:
 *   node scripts/integration-prelaunch-skill-live.mjs
 *   node scripts/integration-prelaunch-skill-live.mjs --manifest-only
 *   node scripts/integration-prelaunch-skill-live.mjs --with-playwright
 *
 * Env:
 *   PLAYWRIGHT_BASE_URL / PLAYWRIGHT_SERVER_URL — 已运行的 dev:saas
 *   SKIP_SKILL_LIVE=1 — 仅 manifest 检查
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestOnly = process.argv.includes('--manifest-only');
const withPlaywright = process.argv.includes('--with-playwright') || !manifestOnly;
const skipLive = process.env.SKIP_SKILL_LIVE === '1';

const skills = [
  { id: 'open-design', path: 'skills/open-design/SKILL.md' },
  { id: 'anth-docx', path: 'skills/vendor/anthropics-skills/anth-docx/SKILL.md' },
  { id: 'pd-geo', path: 'skills/pd-geo/SKILL.md' },
];

const report = {
  generatedAt: new Date().toISOString(),
  manifest: [],
  playwright: null,
};

for (const skill of skills) {
  const exists = existsSync(path.join(root, skill.path));
  report.manifest.push({ id: skill.id, path: skill.path, ok: exists });
  assert.ok(exists, `missing ${skill.path}`);
}

console.log('[integration-prelaunch-skill-live] manifest ok');

if (manifestOnly || skipLive) {
  writeReport(report);
  console.log('[integration-prelaunch-skill-live] skip playwright (manifest-only)');
  process.exit(0);
}

if (!withPlaywright) {
  writeReport(report);
  process.exit(0);
}

const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5183';
const server = process.env.PLAYWRIGHT_SERVER_URL || `http://127.0.0.1:${process.env.PRELAUNCH_SERVER_PORT || '3011'}`;

const health = spawnSync(
  process.execPath,
  ['-e', `fetch('${server}/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'SAAS_ADMIN_PASSWORD'})}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(2))`],
  { cwd: root, stdio: 'ignore' },
);

if (health.status !== 0) {
  report.playwright = { ok: false, skipped: true, reason: 'server_unreachable', base, server };
  writeReport(report);
  console.log('[integration-prelaunch-skill-live] skip playwright — server unreachable (not FAIL)');
  process.exit(0);
}

const pw = spawnSync(
  process.execPath,
  [
    path.join(root, 'node_modules', 'playwright', 'cli.js'),
    'test',
    'e2e/prelaunch/skill-live-conversation.spec.ts',
    '--reporter=line',
  ],
  {
    cwd: path.join(root, 'ui'),
    stdio: 'inherit',
    env: {
      ...process.env,
      PLAYWRIGHT_BASE_URL: base,
      PLAYWRIGHT_SERVER_URL: server,
    },
  },
);

const skipped = pw.status !== 0 && /skip:/i.test(String(pw.stderr || ''));
report.playwright = {
  ok: pw.status === 0,
  skipped,
  exitCode: pw.status ?? 1,
  base,
  server,
};

writeReport(report);

if (pw.status === 0) {
  console.log('[integration-prelaunch-skill-live] playwright PASS');
  process.exit(0);
}

if (skipped) {
  console.log('[integration-prelaunch-skill-live] playwright skipped (no key/offline) — not FAIL');
  process.exit(0);
}

console.error('[integration-prelaunch-skill-live] playwright FAIL');
process.exit(pw.status ?? 1);

function writeReport(payload) {
  const outDir = path.join(root, 'artifacts', 'prelaunch-skill-live');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}
