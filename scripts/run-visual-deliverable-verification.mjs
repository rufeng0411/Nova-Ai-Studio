#!/usr/bin/env node
/**
 * PD-SAAS-FORK VAP: orchestrate visual-deliverable verification tiers.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeReport } from './lib/visualDeliverableVerification.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const REPORT_DIR = path.join(REPO_ROOT, 'artifacts', 'visual-deliverable-verification');

function readArg(args, name) {
  const inlinePrefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(inlinePrefix));
  if (inline) return inline.slice(inlinePrefix.length);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

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
  const args = process.argv.slice(2);
  const gate = args.includes('--gate');
  const tier = readArg(args, '--tier') ?? 'gate';
  const steps = [];

  if (tier === 'unit' || tier === 'gate' || tier === 'full') {
    steps.push({ name: 'unit', fn: () => runNpm('test:visual-deliverable:unit') });
  }
  if (tier === 'disk' || tier === 'gate' || tier === 'full') {
    steps.push({
      name: 'disk',
      fn: () => runNode('scripts/audit-visual-deliverable-disk.mjs', ['--profile=core', ...(gate ? ['--gate'] : [])]),
    });
  }
  if (tier === 'preview-http' || tier === 'gate' || tier === 'full') {
    steps.push({
      name: 'preview-http',
      fn: () => runNode('scripts/audit-visual-deliverable-preview-http.mjs', gate ? ['--gate'] : []),
    });
  }
  if (tier === 'e2e' || tier === 'full') {
    steps.push({ name: 'e2e', fn: () => runNpm('test:visual-deliverable:e2e') });
  }
  if (tier === 'full') {
    steps.push({ name: 'office-embed', fn: () => runNode('scripts/audit-visual-deliverable-office-embed.mjs', gate ? ['--gate'] : []) });
    steps.push({ name: 'binding-acceptance', fn: () => runNpm('test:visual-asset-binding:acceptance') });
  }

  const results = [];
  for (const step of steps) {
    console.log(`[visual-deliverable:verify] ▶ ${step.name}`);
    const code = step.fn();
    results.push({ step: step.name, ok: code === 0, exitCode: code });
    if (gate && code !== 0) {
      writeReport(REPORT_DIR, 'report.json', {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        tier,
        results,
        verdict: 'NO_GO',
      });
      process.exit(code);
    }
  }

  const verdict = results.every((row) => row.ok) ? 'GO' : 'NO_GO';
  writeReport(REPORT_DIR, 'report.json', {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    tier,
    results,
    verdict,
  });
  console.log(`[visual-deliverable:verify] verdict=${verdict}`);
  if (gate && verdict !== 'GO') process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(`[visual-deliverable:verify] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
