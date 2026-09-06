#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Replay generic task-pattern fixtures (M1–M4).
 * Usage: node --import tsx scripts/replay-task-pattern-cases.mjs [--gate]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TASK_PATTERN_CASES,
  classifyTaskPatternCase,
} from '../tests/fixtures/task-pattern-cases.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'task-pattern-replay');
const gate = process.argv.includes('--gate');

const results = TASK_PATTERN_CASES.map((fixture) => {
  const actual = classifyTaskPatternCase(fixture);
  const pass = actual === fixture.expectedLabel;
  return {
    id: fixture.id,
    pattern: fixture.pattern,
    expectedLabel: fixture.expectedLabel,
    actualLabel: actual,
    pass,
  };
});

const totals = {
  total: results.length,
  pass: results.filter((r) => r.pass).length,
  fail: results.filter((r) => !r.pass).length,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const reportPath = path.join(OUT_DIR, `replay-${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(
  reportPath,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), results, totals, pass: totals.fail === 0 }, null, 2)}\n`,
  'utf8',
);

console.log(`[task-pattern:replay] ${totals.pass}/${totals.total} PASS → ${path.relative(REPO_ROOT, reportPath)}`);
for (const row of results) {
  console.log(`  ${row.pass ? '✓' : '✗'} ${row.id}: expected=${row.expectedLabel} actual=${row.actualLabel}`);
}

if (gate && totals.fail > 0) process.exit(1);
