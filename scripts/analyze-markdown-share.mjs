#!/usr/bin/env node
// PD-SAAS-FORK: scan markdown-share telemetry JSONL for L4 KPIs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = process.argv.includes('--gate');

function resolveTelemetryPath() {
  const fromEnv = process.env.MARKDOWN_SHARE_TELEMETRY_PATH?.trim();
  if (fromEnv) return fromEnv;
  const dataRoot = process.env.DATA_ROOT?.trim();
  if (dataRoot) return path.join(dataRoot, 'telemetry', 'markdown-share-events.jsonl');
  return path.join(root, '.saas-dev-data', 'telemetry', 'markdown-share-events.jsonl');
}

const filePath = resolveTelemetryPath();
const counts = {
  share_created: 0,
  share_view: 0,
  share_export_started: 0,
  share_export_done: 0,
  share_export_failed: 0,
  share_revoked: 0,
  urlHasJwt: 0,
};

if (!fs.existsSync(filePath)) {
  const report = { filePath, empty: true, counts, ok: !gate };
  console.log(JSON.stringify(report, null, 2));
  if (gate) {
    console.error('analyze:markdown-share --gate: no telemetry file yet (empty sample window OK if no traffic)');
    process.exit(0);
  }
  process.exit(0);
}

const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
for (const line of lines) {
  try {
    const row = JSON.parse(line);
    const type = String(row.type || '');
    if (type in counts) counts[type] += 1;
    if (row.urlHasJwt === true) counts.urlHasJwt += 1;
    if (typeof row.url === 'string' && /[?&]token=/i.test(row.url)) counts.urlHasJwt += 1;
  } catch {
    // skip bad lines
  }
}

const ok = counts.urlHasJwt === 0 && counts.share_export_failed === 0;
const report = { filePath, lines: lines.length, counts, ok };
console.log(JSON.stringify(report, null, 2));

if (gate && !ok) {
  console.error('analyze:markdown-share --gate FAILED');
  process.exit(1);
}
