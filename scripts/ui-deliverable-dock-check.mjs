#!/usr/bin/env node
/** PD-SAAS-FORK: static gate for deliverable dock kernel (no browser). */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = process.argv.includes('--gate');

const required = [
  'ui/src/shared/deliverableDockPolicy.ts',
  'ui/src/shared/buildDeliverableDockRows.ts',
  'ui/src/shared/deriveDeliverablesDockState.ts',
  'ui/src/shared/collectSessionFolderItems.ts',
  'ui/src/shared/RightWorkspaceRailContext.tsx',
  'ui/src/components/main-content/view/RightWorkspaceRail.tsx',
  'ui/src/components/chat/deliverables/DeliverableSessionDock.tsx',
  'ui/src/components/chat/deliverables/DeliverableSessionSheet.tsx',
  'ui/src/components/chat/deliverables/DeliverablesInProgressIcon.tsx',
  'ui/src/shared/deliverableQualityHints.ts',
];

let failed = 0;
for (const rel of required) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[fail] missing ${rel}`);
    failed += 1;
  }
}

const vitest = spawnSync('npx', [
  'vitest', 'run',
  'ui/src/shared/deriveDeliverablesDockState.test.ts',
  'ui/src/shared/deliverableDockPolicy.test.ts',
  'ui/src/shared/deliverableQualityHints.test.ts',
], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
if (vitest.status !== 0) failed += 1;

const i18nZh = JSON.parse(fs.readFileSync(path.join(root, 'ui/src/i18n/locales/zh-CN/chat.json'), 'utf8'));
const i18nEn = JSON.parse(fs.readFileSync(path.join(root, 'ui/src/i18n/locales/en/chat.json'), 'utf8'));
for (const key of ['composer.deliverablesOpen', 'deliverables.statusInProgress', 'deliverables.dockTitle']) {
  const [section, field] = key.split('.');
  if (!i18nZh[section]?.[field] || !i18nEn[section]?.[field]) {
    console.error(`[fail] missing i18n key ${key}`);
    failed += 1;
  }
}

if (failed > 0 && gate) process.exit(1);
console.log(`[ok] deliverable dock static check (${failed} failures)`);
