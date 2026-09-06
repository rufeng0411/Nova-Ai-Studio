#!/usr/bin/env node
/**
 * PD-SAAS-FORK: integration matrix for deliverable path collision fixture.
 * Usage: node scripts/deliverable-path-collision-check.mjs
 */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { utimesSync } from 'node:fs';
import { resolveProjectDeliverableFile } from '../ui/server/utils/pathInProject.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURE_ROOT = path.join(REPO_ROOT, 'tests/fixtures/deliverable-collision');

function touchMtimes() {
  const taskA = path.join(FIXTURE_ROOT, 'artifacts/task-a/index.html');
  const taskB = path.join(FIXTURE_ROOT, 'artifacts/task-b/index.html');
  const base = Date.now() / 1000;
  utimesSync(taskA, base, base);
  utimesSync(taskB, base, base + 30);
}

function ok(relativePath) {
  return { ok: true, relativePath };
}

touchMtimes();

// bare index.html without hint → ambiguous (task-b is newer but must not win)
{
  const r = resolveProjectDeliverableFile(FIXTURE_ROOT, 'index.html', [FIXTURE_ROOT]);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'ambiguous_deliverable');
  assert.ok(Array.isArray(r.candidates) && r.candidates.length >= 2);
  console.log('[PASS] bare index.html returns ambiguous');
}

{
  const r = resolveProjectDeliverableFile(FIXTURE_ROOT, 'index.html', [FIXTURE_ROOT], {
    hintDir: 'artifacts/task-a',
  });
  assert.equal(r.relativePath, 'artifacts/task-a/index.html');
  console.log('[PASS] hintDir task-a resolves correctly');
}

{
  const r = resolveProjectDeliverableFile(FIXTURE_ROOT, 'index.html', [FIXTURE_ROOT], {
    hintDir: 'artifacts/task-b',
  });
  assert.equal(r.relativePath, 'artifacts/task-b/index.html');
  console.log('[PASS] hintDir task-b resolves correctly');
}

{
  const r = resolveProjectDeliverableFile(FIXTURE_ROOT, 'artifacts/task-b/index.html', [FIXTURE_ROOT]);
  assert.equal(r.relativePath, 'artifacts/task-b/index.html');
  console.log('[PASS] explicit full path resolves');
}

{
  const r = resolveProjectDeliverableFile(FIXTURE_ROOT, 'index.html', [FIXTURE_ROOT], {
    hintDir: 'artifacts/task-a',
  });
  assert.equal(r.relativePath, ok('artifacts/task-a/index.html').relativePath);
  console.log('[PASS] hintDir ignores newer mtime in other folder');
}

{
  const r = resolveProjectDeliverableFile(FIXTURE_ROOT, 'slide-01.png', [FIXTURE_ROOT], {
    hintDir: 'artifacts/slides-deck-b',
  });
  assert.equal(r.relativePath, 'artifacts/slides-deck-b/slide-01.png');
  console.log('[PASS] slide-01.png with deck hint');
}

console.log('\nAll deliverable-path collision checks passed.');
