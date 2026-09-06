#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Acceptance orchestration for partial deliverable + collision guard.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = path.join(root, 'docs', 'deliverable-partial-collision-acceptance-20260628.md');

function run(label, cmd, args) {
  console.log(`\n[deliverable-partial:acceptance] ${label}`);
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true });
  return result.status ?? 1;
}

const results = [];
results.push(['unit', run('unit', 'node', ['scripts/run-deliverable-partial-unit.mjs'])]);
results.push(['four-line-audit', run('four-line-audit', 'npm', ['run', 'test:four-line-audit'])]);
results.push(['display-engine-alignment', run('display-engine-alignment', 'npm', ['run', 'test:display-engine-alignment'])]);
results.push(['goal-loop-playwright', run('goal-loop-playwright', 'npx', [
  'playwright',
  'test',
  'ui/e2e/prelaunch/deliverable-five-entry.spec.ts',
  'ui/e2e/prelaunch/goal-loop-repair-terminal.spec.ts',
])]);
results.push(['goal-loop-playwright', run('goal-loop-playwright', 'npx', [
  'playwright',
  'test',
  'ui/e2e/prelaunch/deliverable-five-entry.spec.ts',
  'ui/e2e/prelaunch/goal-loop-repair-terminal.spec.ts',
])]);

const failed = results.filter(([, code]) => code !== 0);
const lines = [
  '# 部分交付与目录防串台验收报告',
  '',
  `日期：2026-06-28`,
  '',
  '## 结果',
  '',
  ...results.map(([name, code]) => `- ${name}: ${code === 0 ? 'PASS' : 'FAIL'}`),
  '',
  '## 覆盖范围',
  '',
  '- 部分交付汇总表（3/6 + 6/6 bad meta 单测）',
  '- LegacyPathMode / hintDir strict 双轨',
  '- turnDeliverableMetaWriter pending+resolvedPath 向前修正',
  '- four-line-audit 历史路径零 diff 门禁',
  '- display-engine-alignment 五线对齐',
  '',
];

import fs from 'node:fs';
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`\nReport: ${reportPath}`);

if (failed.length > 0) {
  console.error('[deliverable-partial:acceptance] failed:', failed.map(([n]) => n).join(', '));
  process.exit(1);
}
console.log('[deliverable-partial:acceptance] passed');
