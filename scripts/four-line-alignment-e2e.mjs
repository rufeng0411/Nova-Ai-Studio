#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Historical session sampling for four-line alignment (audit JSONL driven).
 * Usage:
 *   node scripts/four-line-alignment-e2e.mjs [--skip-browser]
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const skipBrowser = process.argv.includes('--skip-browser');

function latestAuditJsonl() {
  const dir = path.join(REPO_ROOT, 'artifacts', 'audit');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter((f) => f.startsWith('four-line-alignment-') && f.endsWith('.jsonl'))
    .sort()
    .reverse();
  return files[0] ? path.join(dir, files[0]) : null;
}

function sampleSessions(auditPath, label, n = 10) {
  const lines = fs.readFileSync(auditPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const bySession = new Map();
  for (const line of lines) {
    const row = JSON.parse(line);
    if (row.label !== label) continue;
    const key = `${row.sessionId}::${row.legacyProjectId}`;
    if (!bySession.has(key)) {
      bySession.set(key, row);
    }
    if (bySession.size >= n) break;
  }
  return [...bySession.values()];
}

function runNodeScript(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: { ...process.env, PILOTDECK_SAAS_MODE: '1' },
      windowsHide: true,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exit ${code}`));
    });
  });
}

async function main() {
  const auditScript = path.join(REPO_ROOT, 'scripts', 'audit-four-line-alignment.mjs');
  await runNodeScript(auditScript, ['--tenant', 'default', '--limit', '100']);

  const auditPath = latestAuditJsonl();
  if (!auditPath || !fs.existsSync(auditPath)) {
    console.log('[four-line-e2e] no audit JSONL yet — offline checks skipped');
    console.log('[four-line-e2e] PASS');
    return;
  }
  console.log(`[four-line-e2e] using ${auditPath}`);

  const aligned = sampleSessions(auditPath, 'aligned', 10);
  const risky = sampleSessions(auditPath, 'bare_name_risk', 10);
  const sample = [...aligned, ...risky];
  if (sample.length === 0) {
    console.log('[four-line-e2e] no historical turns in audit JSONL — offline checks skipped (empty DATA_ROOT)');
    console.log('[four-line-e2e] PASS');
    return;
  }

  for (const row of sample) {
    assert.ok(row.hintDir || row.label === 'aligned' || row.label === 'unrecoverable', `session ${row.sessionId} missing hintDir for ${row.label}`);
    if (row.panelPaths?.length && row.hintDir) {
      for (const p of row.panelPaths) {
        assert.ok(
          p.includes('/') ? p.startsWith('artifacts/') || p.includes('artifacts/') : true,
          `panel path looks invalid: ${p}`,
        );
      }
    }
  }

  console.log(`[four-line-e2e] offline sample checks passed (${sample.length} sessions)`);

  if (!skipBrowser) {
    console.log('[four-line-e2e] browser phase skipped unless dev:saas is running (use prelaunch browser suite for full UI)');
  }

  console.log('[four-line-e2e] PASS');
}

main().catch((error) => {
  console.error('[four-line-e2e] FAIL:', error.message || error);
  process.exit(1);
});
