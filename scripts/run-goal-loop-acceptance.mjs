#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Goal-Loop incremental acceptance (offline-first).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportDir = path.join(root, 'artifacts', 'goal-loop-acceptance');
const reportPath = path.join(reportDir, 'suite-log.jsonl');

const steps = [
  ['bridge-recovery-regression', 'node', ['--test', 'scripts/lib/bridgeRecoveryRegression.test.mjs']],
  ['fallback-eligible', 'npx', ['tsx', '--test', 'tests/router/fallback-eligible.test.ts']],
  ['deliverable-partial:unit', 'npm', ['run', 'test:deliverable-partial:unit']],
  ['dialogue-stability:historical', 'npm', ['run', 'test:dialogue-stability:historical']],
  ['recovery-wuyutai', 'npm', ['run', 'test:recovery-wuyutai']],
  ['four-line-audit', 'npm', ['run', 'test:four-line-audit']],
  ['display-engine-alignment', 'npm', ['run', 'test:display-engine-alignment']],
  ['recovery-budget', 'npx', ['tsx', '--test', 'tests/saas/resilience/recoveryBudget.test.ts']],
  ['task-goal-contract', 'npx', ['vitest', 'run', 'src/saas/taskState/taskGoalContract.test.ts']],
  ['turn-acceptance-meta', 'npx', ['vitest', 'run', 'ui/src/shared/turnAcceptanceMeta.test.ts']],
  ['messages-pane-render', 'npm', ['--workspace', 'ui', 'run', 'test', '--', 'src/components/chat-v2/MessagesPaneV2.render.test.tsx']],
  ['strip-leaked-markup', 'npm', ['--workspace', 'ui', 'run', 'test', '--', 'src/shared/stripLeakedToolMarkup.test.ts']],
  ['detect-goal-pivot', 'npx', ['vitest', 'run', 'src/saas/taskState/detectGoalPivot.test.ts']],
  ['read-session-goal-loop', 'npx', ['tsx', '--test', 'tests/web/server/readSessionMessages.goal-loop.test.ts']],
  ['turn-wall-clock', 'npx', ['tsx', '--test', 'src/agent/loop/turnWallClock.test.ts']],
];

if (process.env.GOAL_LOOP_LIVE === '1') {
  steps.push([
    'argentina-failed-records-live',
    'npx',
    [
      'playwright',
      'test',
      '-c',
      'ui/playwright.config.ts',
      'ui/e2e/saas/argentina-failed-records-live.spec.ts',
      '--workers=1',
    ],
  ]);
}

function runStep(name, cmd, args) {
  console.log(`\n[goal-loop:acceptance] ${name}`);
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true });
  const ok = (result.status ?? 1) === 0;
  fs.mkdirSync(reportDir, { recursive: true });
  fs.appendFileSync(
    reportPath,
    `${JSON.stringify({ name, ok, at: new Date().toISOString() })}\n`,
    'utf8',
  );
  return ok;
}

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, '', 'utf8');

const failed = [];
for (const [name, cmd, args] of steps) {
  if (!runStep(name, cmd, args)) failed.push(name);
}

if (failed.length > 0) {
  console.error('[goal-loop:acceptance] failed:', failed.join(', '));
  process.exit(1);
}
console.log('[goal-loop:acceptance] passed');
