#!/usr/bin/env node
/** PD-SAAS-FORK: Summarize kpi-live.jsonl for L4 post-implementation tables. */
import fs from 'node:fs';
import path from 'node:path';

const kpiPath = process.argv[2];
if (!kpiPath || !fs.existsSync(kpiPath)) {
  console.error('Usage: node scripts/lib/summarize-live-kpi.mjs <kpi-live.jsonl>');
  process.exit(1);
}

const lines = fs.readFileSync(kpiPath, 'utf8').trim().split(/\n/).filter(Boolean);
const rows = lines.map((line) => JSON.parse(line));
const summary = {
  total: rows.length,
  pass: rows.filter((r) => r.ok).length,
  fail: rows.filter((r) => !r.ok).length,
  cases: rows.map((r) => ({
    caseId: r.caseId,
    ok: r.ok,
    durationMs: r.durationMs,
    durationMin: r.durationMs ? Math.round(r.durationMs / 600) / 100 : null,
    reasons: r.gate?.reasons,
  })),
};
console.log(JSON.stringify(summary, null, 2));
