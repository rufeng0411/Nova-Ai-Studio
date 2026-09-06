#!/usr/bin/env node
/**
 * PD-SAAS-FORK: conversation deliverable table audit — footer/Dock parity + turn invariants.
 * Usage: node scripts/audit-conversation-deliverable-tables.mjs [--gate]
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const gate = process.argv.includes('--gate');

const targets = [
  'ui/src/shared/deliverableContextInvariants.test.ts',
  'ui/src/components/chat/deliverables/DeliverableSummaryTable.conversation-sync.test.tsx',
  'ui/src/components/chat/deliverables/DeliverableSummaryTable.folder-reconcile.test.tsx',
];

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['vitest', 'run', ...targets],
  { cwd: repoRoot, stdio: 'inherit', shell: process.platform === 'win32' },
);

if (result.status !== 0) {
  console.error('\nConversation deliverable audit: FAILED');
  process.exit(gate ? 1 : 0);
}

console.log('\nConversation deliverable audit: all checks passed');
process.exit(0);
