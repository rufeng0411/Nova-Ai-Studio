#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Goal Loop Phase 2 acceptance orchestrator (Steps H–L).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportDir = path.join(root, 'artifacts', 'goal-loop-acceptance');
const reportPath = path.join(reportDir, 'phase2-suite-log.jsonl');

const argStep = process.argv.find((a) => a.startsWith('--step='))?.split('=')[1]?.toUpperCase();
const layerArg = process.argv.find((a) => a.startsWith('--layer='))?.split('=')[1]?.toLowerCase();

const layers = {
  unit: [
    ['goal-loop:acceptance', 'node', ['scripts/run-goal-loop-acceptance.mjs']],
    ['detect-goal-pivot', 'npx', ['vitest', 'run', 'src/saas/taskState/detectGoalPivot.test.ts']],
    ['media-strategy', 'npx', ['vitest', 'run', 'src/saas/media/mediaStrategyResolver.test.ts']],
    ['turn-wall-clock', 'npx', ['tsx', '--test', 'src/agent/loop/turnWallClock.test.ts']],
    ['strip-leaked-markup', 'npm', ['--workspace', 'ui', 'run', 'test', '--', 'src/shared/stripLeakedToolMarkup.test.ts']],
    ['task-resume-coordinator', 'npm', ['--workspace', 'ui', 'run', 'test', '--', 'src/components/chat-v2/hooks/taskResumeCoordinator.test.ts']],
    ['deliverable-summary-acceptance', 'npm', ['--workspace', 'ui', 'run', 'test', '--', 'src/components/chat/deliverables/DeliverableSummaryTable.acceptance.test.tsx']],
  ],
  replay: [
    ['replay-task-resume-leak', 'npx', ['tsx', 'scripts/replay-goal-loop-fixture.mjs', 'tests/fixtures/goal-loop/task-resume-leak.jsonl']],
    ['replay-empty-table', 'npx', ['tsx', 'scripts/replay-goal-loop-fixture.mjs', 'tests/fixtures/goal-loop/empty-table-false-complete.jsonl']],
  ],
  live: [
    ['goal-loop-phase2-trust', 'npx', ['playwright', 'test', '-c', 'ui/playwright.config.ts', 'ui/e2e/prelaunch/goal-loop-phase2-trust.spec.ts', '--workers=1']],
  ],
  load: [
    ['final-load', 'node', ['scripts/run-goal-loop-final-load.mjs']],
  ],
  matrix: [
    ['final-live-matrix', 'npx', ['playwright', 'test', '-c', 'ui/playwright.config.ts', 'ui/e2e/saas/goal-loop-final-live-matrix.spec.ts', '--workers=1']],
  ],
};

const stepMap = {
  H: ['unit'],
  I: ['unit', 'replay'],
  J: ['unit'],
  K: ['unit'],
  L: ['unit', 'replay', 'live'],
};

function runStep(name, cmd, args) {
  console.log(`\n[goal-loop:phase2] ${name}`);
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true, env: process.env });
  const ok = (result.status ?? 1) === 0;
  fs.mkdirSync(reportDir, { recursive: true });
  fs.appendFileSync(reportPath, `${JSON.stringify({ name, ok, at: new Date().toISOString() })}\n`, 'utf8');
  return ok;
}

function resolveLayerNames() {
  if (layerArg && layers[layerArg]) return [layerArg];
  if (argStep && stepMap[argStep]) return stepMap[argStep];
  return ['unit', 'replay'];
}

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, '', 'utf8');

const failed = [];
for (const layerName of resolveLayerNames()) {
  for (const step of layers[layerName] ?? []) {
    const [name, cmd, args] = step;
    if (!runStep(`${layerName}:${name}`, cmd, args)) failed.push(`${layerName}:${name}`);
  }
}

if (failed.length > 0) {
  console.error('[goal-loop:phase2] failed:', failed.join(', '));
  process.exit(1);
}
console.log('[goal-loop:phase2] passed');
