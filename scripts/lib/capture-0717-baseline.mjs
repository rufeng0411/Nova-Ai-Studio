#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Capture pre-change baseline for 0717 four-line hardening (P0-0).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', '0717-four-line-acceptance');
const BASELINE_PATH = path.join(OUT_DIR, 'baseline.json');

const BASELINE_COMMANDS = [
  'test:four-line-audit',
  'test:export-four-line-parity',
  'test:deliverable-triple-unify',
  'test:turn-queue:unit',
  'test:bridge-stability:unit',
];

function runNpmScript(script) {
  const started = Date.now();
  const result = spawnSync('npm', ['run', script], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    shell: true,
    env: { ...process.env },
  });
  return {
    script,
    exitCode: result.status ?? 1,
    durationMs: Date.now() - started,
    stdoutTail: (result.stdout ?? '').split('\n').slice(-12).join('\n'),
    stderrTail: (result.stderr ?? '').split('\n').slice(-8).join('\n'),
  };
}

function runUiBuild() {
  const started = Date.now();
  const result = spawnSync('npm', ['--workspace', 'ui', 'run', 'build'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    shell: true,
    env: { ...process.env },
  });
  return {
    script: 'ui:build',
    exitCode: result.status ?? 1,
    durationMs: Date.now() - started,
    stdoutTail: (result.stdout ?? '').split('\n').slice(-12).join('\n'),
    stderrTail: (result.stderr ?? '').split('\n').slice(-8).join('\n'),
  };
}

function readAuditSummary() {
  const auditJsonl = path.join(REPO_ROOT, 'artifacts', 'audit', 'four-line-alignment-2026-07-17.jsonl');
  if (!fs.existsSync(auditJsonl)) return null;
  const lines = fs.readFileSync(auditJsonl, 'utf8').trim().split('\n').filter(Boolean);
  const last = lines.length ? JSON.parse(lines[lines.length - 1]) : null;
  return last?.summary ?? null;
}

function estimateHtmlSizeBudget() {
  const samples = [];
  for (const dir of [
    path.join(REPO_ROOT, 'artifacts', '0717-four-line-acceptance'),
    path.join(REPO_ROOT, 'artifacts'),
  ]) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.html$/i.test(entry.name)) continue;
      const stat = fs.statSync(path.join(dir, entry.name));
      samples.push(stat.size);
    }
  }
  samples.sort((a, b) => a - b);
  const p95 = samples.length
    ? samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))]
    : 2 * 1024 * 1024;
  const userArchiveMax = Math.min(50 * 1024 * 1024, Math.max(20 * 1024 * 1024, 2 * p95));
  return {
    sampleCount: samples.length,
    p95Bytes: p95,
    userArchiveMaxBytes: userArchiveMax,
    diagnosticMaxBytes: 50 * 1024 * 1024,
  };
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const commandResults = BASELINE_COMMANDS.map(runNpmScript);
commandResults.push(runUiBuild());

const baseline = {
  capturedAt: new Date().toISOString(),
  repoRoot: REPO_ROOT,
  commands: commandResults,
  auditSummary: readAuditSummary(),
  htmlSizeBudget: estimateHtmlSizeBudget(),
  compatibilitySamples: [
    'v1_certificate',
    'no_certificate',
    'goalVersion_add',
    'turn_queue_double_write',
    'truncated_folder_snapshot',
  ],
  strictBinderBudget: { maxUnits: 128, maxEvidence: 500, p95TargetMs: 50 },
  folderSnapshotBudget: { p95TargetMs: 1500, maxFiles: 500 },
  knownPeripheralFailures: [],
};

fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
console.log(`[0717-baseline] wrote ${path.relative(REPO_ROOT, BASELINE_PATH)}`);
const failed = commandResults.filter((r) => r.exitCode !== 0);
if (failed.length) {
  console.warn(`[0717-baseline] ${failed.length} command(s) non-zero: ${failed.map((f) => f.script).join(', ')}`);
  process.exitCode = 0;
}
