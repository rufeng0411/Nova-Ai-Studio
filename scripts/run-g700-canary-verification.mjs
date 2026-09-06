#!/usr/bin/env node
/**
 * PD-SAAS-FORK VAP: G700 canary verification (thin wrapper over generic + canary fixtures).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeReport } from './lib/visualDeliverableVerification.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const REPORT_DIR = path.join(REPO_ROOT, 'artifacts', 'g700-canary-verification');

function runNode(script, extraArgs = []) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', script, ...extraArgs], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    shell: false,
  });
  return result.status ?? 1;
}

function runNpm(script) {
  const result = spawnSync('npm', ['run', script], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return result.status ?? 1;
}

async function main() {
  const gate = process.argv.includes('--gate');
  const full = process.argv.includes('--full');
  const results = [];

  results.push({
    step: 'canary-disk',
    ok: runNode('scripts/audit-visual-deliverable-disk.mjs', [
      '--profile=g700-canary',
      ...(gate ? ['--gate'] : []),
    ]) === 0,
  });
  results.push({
    step: 'binding-replay',
    ok: runNpm('test:visual-asset-binding:acceptance') === 0,
  });
  results.push({
    step: 'five-case-replay',
    ok: runNode('scripts/replay-mingdi-g700-20260719-five-cases.mjs', gate ? ['--gate'] : []) === 0,
  });

  if (full) {
    results.push({
      step: 'visual-deliverable-full',
      ok: runNode('scripts/run-visual-deliverable-verification.mjs', ['--tier=full', ...(gate ? ['--gate'] : [])]) === 0,
    });
    results.push({
      step: 'live-matrix',
      ok: runNpm('test:vap:live-matrix:gate') === 0,
    });
  }

  const verdict = results.every((row) => row.ok) ? 'GO' : 'NO_GO';
  writeReport(REPORT_DIR, 'report.json', {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: full ? 'full' : 'gate',
    results,
    verdict,
  });
  console.log(`[g700:canary] verdict=${verdict}`);
  if (gate && verdict !== 'GO') process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(`[g700:canary] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
