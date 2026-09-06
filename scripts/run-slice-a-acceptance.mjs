#!/usr/bin/env node
// PD-SAAS-FORK: Slice A strict acceptance — fail-stop, JSON report
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getOverlayEntry } from './lib/skillVendorOverlays/manifest.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_DIR = path.join(REPO_ROOT, 'artifacts', 'skills-acceptance');
const REPORT_PATH = path.join(REPORT_DIR, 'slice-a.json');

function runStep(name, command, args) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  return {
    name,
    command: [command, ...args].join(' '),
    exitCode: result.status ?? 1,
    assertions: [],
  };
}

function main() {
  const steps = [];
  steps.push(runStep('A1 overlay root', 'node', ['--test', 'scripts/lib/skillVendorOverlays/applySkillOverlays.root.test.mjs']));
  steps.push(runStep('A2 anth-pptx overlay smoke', 'node', ['scripts/integration-anth-pptx-overlay-smoke.mjs']));
  steps.push(runStep('A2 audit overlays', 'npm', ['run', 'audit:skill-overlays']));
  steps.push(runStep('A3 binding tests', 'npx', ['tsx', '--test', 'src/saas/capabilityBindingPrompt.test.ts']));
  steps.push(runStep('A4 check:saas-fork', 'npm', ['run', 'check:saas-fork']));

  const assertions = [];
  const pptMaster = getOverlayEntry('ppt-master');
  const checksText = JSON.stringify(pptMaster?.checks ?? []);
  const no48Checks = !pptMaster || (!checksText.includes('routing.md') && !checksText.includes('4.8.0'));
  assertions.push({
    name: 'must_not ppt-master 4.8 overlay checks',
    ok: no48Checks,
  });
  assertions.push({
    name: 'timesfm SKILL still on disk',
    ok: existsSync(path.join(REPO_ROOT, 'skills/vendor/education-ecosystem/edu-sci-timesfm-forecasting/SKILL.md')),
  });
  assertions.push({
    name: 'last30days SKILL still on disk',
    ok: existsSync(path.join(REPO_ROOT, 'skills/vendor/marketing-ecosystem/mkt-last30days/SKILL.md')),
  });
  const fork = readFileSync(path.join(REPO_ROOT, 'config/pilotdeck-core-fork.manifest.json'), 'utf8');
  assertions.push({
    name: 'fork.manifest Flask summary',
    ok: fork.includes('Flask') && fork.includes('不依赖 Preflight'),
  });

  const stepsOk = steps.every((s) => s.exitCode === 0);
  const assertOk = assertions.every((a) => a.ok);
  const ok = stepsOk && assertOk;
  mkdirSync(REPORT_DIR, { recursive: true });
  const report = {
    ok,
    generatedAt: new Date().toISOString(),
    steps,
    assertions,
  };
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[slice-a-acceptance] ok=${ok} → ${path.relative(REPO_ROOT, REPORT_PATH)}`);
  if (!ok) {
    for (const s of steps.filter((x) => x.exitCode !== 0)) {
      console.error(`  step fail: ${s.name} exit=${s.exitCode}`);
    }
    for (const a of assertions.filter((x) => !x.ok)) {
      console.error(`  assert fail: ${a.name}`);
    }
    process.exit(1);
  }
}

main();
