#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Unit tests for partial deliverable display + legacy path mode.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const uiSuites = [
  'src/shared/legacyPathMode.test.ts',
  'src/shared/buildDeliverableSummaryRows.test.ts',
  'src/shared/slideManifestExpand.test.ts',
  'src/shared/turnAcceptanceMeta.test.ts',
  'src/shared/validateDeliverables.test.ts',
  'server/utils/pathInProject.test.js',
  'src/components/chat/deliverables/DeliverableSummaryTable.acceptance.test.tsx',
];

const uiResult = spawnSync(
  'npm',
  ['--workspace', 'ui', 'run', 'test', '--', ...uiSuites],
  { cwd: root, stdio: 'inherit', shell: true },
);

const rootResult = spawnSync(
  'npx',
  ['vitest', 'run', 'tests/web/readSessionMessages.deliverable-meta.test.ts'],
  { cwd: root, stdio: 'inherit', shell: true },
);

const writerResult = spawnSync(
  'node',
  ['--test', 'ui/server/saas/deliverables/turnDeliverableMetaWriter.test.mjs'],
  { cwd: root, stdio: 'inherit', shell: true },
);

const code = (uiResult.status ?? 1) || (rootResult.status ?? 1) || (writerResult.status ?? 1);
if (code !== 0) {
  console.error('[deliverable-partial:unit] failed');
  process.exit(code);
}
console.log('[deliverable-partial:unit] passed');
