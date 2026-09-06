#!/usr/bin/env node
/** PD-SAAS-FORK: SDM Phase 3 acceptance orchestrator */
import { spawnSync } from 'node:child_process';

const steps = [
  ['sdm-unit', 'npx', ['vitest', 'run', 'src/saas/taskState/sessionDeliverableManifest.test.ts', 'src/saas/taskState/detectGoalMutation.test.ts', 'ui/src/shared/deliverableSummaryMountPolicy.sdm-live.test.ts']],
  ['udc-0709-live', 'npm', ['run', 'test:goal-loop:0709-live']],
  ['sdm-messages-hydrate', 'node', ['--import', 'tsx', '--test', 'tests/web/server/messages.sdm-hydrate.test.ts']],
  ['sdm-replay', 'node', ['scripts/run-sdm-replay.mjs']],
  ['goal-loop', 'npm', ['run', 'test:goal-loop:acceptance']],
];

let failed = 0;
for (const [name, cmd, args] of steps) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`[sdm-acceptance] FAIL: ${name}`);
    failed += 1;
  } else {
    console.log(`[sdm-acceptance] PASS: ${name}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
