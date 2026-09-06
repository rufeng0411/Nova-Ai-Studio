#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Razer Pro Click V2 batch gate (L0–L4 slice; L2 with --live).
 * Usage:
 *   npm run test:razer-proclick-batch:gate
 *   npm run test:razer-four-line:live   # --live --rca-only [--html-export]
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const live = argv.includes('--live');
const rcaOnly = argv.includes('--rca-only');
const htmlExport = argv.includes('--html-export');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function runStep(name, cmd, args, options = {}) {
  console.log(`\n[razer-gate] ${name}…`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: true, cwd: root, ...options });
  if ((result.status ?? 1) !== 0) {
    console.error(`[razer-gate] FAIL: ${name}`);
    return false;
  }
  console.log(`[razer-gate] PASS: ${name}`);
  return true;
}

let ok = true;

if (!live || !rcaOnly) {
  ok = runStep('L0 check:task-dir-prompts', npmCmd, ['run', 'check:task-dir-prompts']) && ok;
  ok = runStep('L0 glue test', npxCmd, ['vitest', 'run', 'scripts/lib/promptTemplateStrategy.glue.test.mjs']) && ok;
  ok = runStep('L0 test:sdm:unit', npmCmd, ['run', 'test:sdm:unit']) && ok;
  ok = runStep('L0 test:turn-queue:unit', npmCmd, ['run', 'test:turn-queue:unit']) && ok;
  ok = runStep('L0 deliverableChecklistAuthority', npxCmd, ['vitest', 'run', 'src/saas/deliverables/deliverableChecklistAuthority.test.ts']) && ok;
  ok = runStep('L0 presentationLock', npxCmd, ['vitest', 'run', 'src/shared/deliverableRowPresentationLock.test.ts'], { cwd: path.join(root, 'ui') }) && ok;
  ok = runStep('L0 SessionDeliverableSummaryBar', npxCmd, ['vitest', 'run', 'src/components/chat/deliverables/SessionDeliverableSummaryBar.test.tsx'], { cwd: path.join(root, 'ui') }) && ok;
  ok = runStep('L0 DeliverableTurnPointer', npxCmd, ['vitest', 'run', 'src/components/chat/deliverables/DeliverableTurnPointer.test.tsx'], { cwd: path.join(root, 'ui') }) && ok;
  ok = runStep('L0 conversation-sync table', npxCmd, ['vitest', 'run', 'src/components/chat/deliverables/DeliverableSummaryTable.conversation-sync.test.tsx'], { cwd: path.join(root, 'ui') }) && ok;
  ok = runStep('L1 razer batch vitest', npxCmd, ['vitest', 'run', 'tests/saas/razer-proclick-batch-gate.test.ts']) && ok;
  ok = runStep('L1 test:deliverable-triple-unify', npmCmd, ['run', 'test:deliverable-triple-unify']) && ok;
  ok = runStep('L1 test:four-line-audit', npmCmd, ['run', 'test:four-line-audit']) && ok;
  ok = runStep('L1 test:export-four-line-parity', npmCmd, ['run', 'test:export-four-line-parity']) && ok;
  ok = runStep('L1 test:four-line-folder', npmCmd, ['run', 'test:four-line-folder']) && ok;
  ok = runStep('L4 check:saas-fork', npmCmd, ['run', 'check:saas-fork']) && ok;
}

if (live) {
  if (rcaOnly) {
    ok = runStep(
      'L2 RCA three-case SDM compile',
      npxCmd,
      [
        'vitest',
        'run',
        'tests/saas/razer-proclick-batch-gate.test.ts',
        '-t',
        'razer-geo-fast-check-nl|razer-geo-keyword-glued|razer-hf-constraint-paste',
      ],
    ) && ok;
  } else {
    console.error('[razer-gate] --live requires --rca-only for Gateway harness (use test:razer-four-line:live)');
    ok = false;
  }

  if (htmlExport && ok) {
    ok = runStep(
      'L3 sticky parity playwright (structural)',
      npxCmd,
      ['playwright', 'test', 'ui/e2e/saas/sticky-deliverable-parity.spec.ts', '--grep', 'structural'],
    ) && ok;
  }
}

if (!ok) {
  console.error('\n[razer-gate] NO_GO — one or more steps failed');
}

process.exit(ok ? 0 : 1);
