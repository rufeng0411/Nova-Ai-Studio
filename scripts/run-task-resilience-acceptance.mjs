#!/usr/bin/env node
/**
 * PD-SAAS-FORK: task resilience acceptance orchestrator (offline-first).
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;

function run(label, args) {
  const result = spawnSync(node, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`[task-resilience] FAIL: ${label}`);
    process.exit(result.status ?? 1);
  }
  console.log(`[task-resilience] PASS: ${label}`);
}

run('catalog hooks test', ['--test', 'ui/server/saas/conversation/catalogBridgeHooks.test.mjs']);
run('session durability integration', ['scripts/integration-session-durability.mjs']);
run('infra interrupt integration', ['scripts/integration-infra-interrupt-resume.mjs']);
run('deliverable integrity integration', ['scripts/integration-deliverable-integrity.mjs']);

const vitest = path.join(root, 'node_modules', 'vitest', 'vitest.mjs');
run('vitest task-resilience unit', [vitest, 'run',
  'src/session/resume/buildTaskResumeContext.test.ts',
  'ui/src/components/chat-v2/hooks/taskResumeCoordinator.test.ts',
  'ui/src/shared/validateDeliverables.test.ts',
  'ui/src/hooks/useProjectsState.sessionIntent.test.ts',
]);

console.log('[task-resilience] acceptance complete');
