#!/usr/bin/env node
/**
 * PD-SAAS-FORK: deliverable validation priority smoke (offline, no server import).
 */
import assert from 'node:assert/strict';

const SOURCE_PRIORITY = { tool: 3, process: 2, text: 1 };

function rank(source) {
  return SOURCE_PRIORITY[source] ?? 0;
}

function dedupe(items) {
  const byBase = new Map();
  for (const item of items) {
    const key = item.path.split('/').pop();
    const existing = byBase.get(key);
    if (!existing) {
      byBase.set(key, item);
      continue;
    }
    const existingScore = rank(existing.source) * 10 + (existing.status === 'verified' ? 5 : 0);
    const itemScore = rank(item.source) * 10 + (item.status === 'verified' ? 5 : 0);
    if (itemScore >= existingScore) byBase.set(key, item);
  }
  return [...byBase.values()];
}

const merged = dedupe([
  { path: 'report.md', source: 'text', status: 'phantom' },
  { path: 'artifacts/report.md', source: 'tool', status: 'verified' },
]);
assert.equal(merged.length, 1);
assert.equal(merged[0].source, 'tool');

console.log('[integration-deliverable-integrity] ok');
