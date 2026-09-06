#!/usr/bin/env node
/**
 * PD-SAAS-FORK: seed stub for workbench-beta-11-acceptance project.
 * Full Bridge catalog inject can extend this; for now ensures fixture dir exists.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = join(root, 'tests/fixtures/workbench-beta-11');

const cases = [
  {
    id: 'LC-GEO',
    meta: {
      title: '吴裕泰 GEO 五案验收',
      executionStatus: 'completed',
      basenames: ['audit-checklist.md', 'keywords.md', 'optimized.md'],
    },
  },
  {
    id: 'LC-WIP',
    meta: { title: '足球分析进行中', executionStatus: 'running', basenames: [] },
  },
  {
    id: 'LC-CHAT',
    meta: { title: '随便聊聊', executionStatus: 'idle', basenames: [] },
  },
];

mkdirSync(fixtures, { recursive: true });
for (const c of cases) {
  const dir = join(fixtures, c.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'meta.json'), `${JSON.stringify(c.meta, null, 2)}\n`);
  if (!existsSync(join(dir, 'messages.jsonl'))) {
    writeFileSync(
      join(dir, 'messages.jsonl'),
      `${JSON.stringify({
        type: 'user',
        content: c.meta.title,
        timestamp: new Date().toISOString(),
      })}\n`,
    );
  }
}

console.log(`[seed:workbench-beta-11] fixtures ready under ${fixtures}`);
console.log('[seed:workbench-beta-11] Create project "workbench-beta-11-acceptance" in UI for live cases.');
