#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Goal-Loop final acceptance + optional retest pass.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const retest = process.argv.includes('--retest');
const skipLive = process.argv.includes('--skip-live');
const reportDir = path.join(root, 'artifacts', 'goal-loop-acceptance');
const docPath = path.join(root, 'docs', `deliverable-goal-loop-acceptance-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.md`);

const layers = [
  ['goal-loop:acceptance', 'node', ['scripts/run-goal-loop-acceptance.mjs']],
  ['p0-p2:unit', 'npm', ['run', 'test:p0-p2:unit']],
  ['deliverable-partial:acceptance', 'npm', ['run', 'test:deliverable-partial:acceptance']],
  ['goal-loop-playwright', 'npx', ['playwright', 'test', 'ui/e2e/prelaunch/deliverable-five-entry.spec.ts', 'ui/e2e/prelaunch/goal-loop-repair-terminal.spec.ts']],
];

if (!skipLive) {
  layers.push(['prelaunch:quick', 'npm', ['run', 'test:prelaunch:quick']]);
}

function runLayer(name, cmd, args) {
  console.log(`\n[goal-loop:final] ${name}`);
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true });
  return (result.status ?? 1) === 0;
}

const results = [];
const passes = retest ? 2 : 1;
for (let pass = 1; pass <= passes; pass += 1) {
  console.log(`\n[goal-loop:final] pass ${pass}/${passes}`);
  for (const [name, cmd, args] of layers) {
    const key = passes > 1 ? `${name}#${pass}` : name;
    const ok = runLayer(key, cmd, args);
    results.push({ name: key, ok, pass });
    if (!ok) {
      writeReport(results, false);
      process.exit(1);
    }
  }
}

writeReport(results, true);
console.log('[goal-loop:final] passed');

function writeReport(rows, ok) {
  fs.mkdirSync(reportDir, { recursive: true });
  const lines = [
    `# Goal-Loop 验收报告`,
    '',
    `日期：${new Date().toISOString()}`,
    `结果：${ok ? 'PASS' : 'FAIL'}`,
    '',
    '| 层级 | 结果 |',
    '|------|------|',
    ...rows.map((row) => `| ${row.name} | ${row.ok ? 'PASS' : 'FAIL'} |`),
    '',
  ];
  fs.writeFileSync(docPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Report: ${docPath}`);
}
