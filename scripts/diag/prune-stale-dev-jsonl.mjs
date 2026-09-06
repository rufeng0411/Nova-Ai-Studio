#!/usr/bin/env node
/**
 * PD-SAAS-FORK: list stale large dev jsonl transcripts (dry-run default).
 *
 * Usage:
 *   node scripts/diag/prune-stale-dev-jsonl.mjs
 *   node scripts/diag/prune-stale-dev-jsonl.mjs --apply
 *
 * Env:
 *   DATA_ROOT=.saas-dev-data
 *   PRUNE_MIN_MB=10
 *   PRUNE_MIN_AGE_DAYS=7
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const DATA_ROOT = process.env.DATA_ROOT || path.join(REPO_ROOT, '.saas-dev-data');
const MIN_MB = Number(process.env.PRUNE_MIN_MB || 10);
const MIN_AGE_DAYS = Number(process.env.PRUNE_MIN_AGE_DAYS || 7);
const APPLY = process.argv.includes('--apply');
const ARCHIVE_DIR = path.join(DATA_ROOT, '_archive', 'stale-jsonl');

function walkJsonlFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsonlFiles(full, acc);
    else if (entry.name.endsWith('.jsonl')) acc.push(full);
  }
  return acc;
}

function main() {
  const cutoffMs = Date.now() - MIN_AGE_DAYS * 86_400_000;
  const candidates = walkJsonlFiles(path.join(DATA_ROOT, 'tenants'))
    .map((filePath) => {
      const stat = fs.statSync(filePath);
      return {
        filePath,
        rel: path.relative(REPO_ROOT, filePath),
        mb: Number((stat.size / (1024 * 1024)).toFixed(2)),
        mtime: stat.mtime.toISOString(),
        mtimeMs: stat.mtimeMs,
      };
    })
    .filter((row) => row.mb >= MIN_MB && row.mtimeMs < cutoffMs)
    .sort((a, b) => b.mb - a.mb);

  const report = {
    generatedAt: new Date().toISOString(),
    mode: APPLY ? 'apply' : 'dry-run',
    dataRoot: DATA_ROOT,
    minMb: MIN_MB,
    minAgeDays: MIN_AGE_DAYS,
    count: candidates.length,
    totalMb: Number(candidates.reduce((sum, row) => sum + row.mb, 0).toFixed(2)),
    candidates: candidates.map(({ filePath, ...rest }) => rest),
    moved: [],
  };

  if (APPLY && candidates.length > 0) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    for (const row of candidates) {
      const dest = path.join(ARCHIVE_DIR, path.basename(row.filePath));
      fs.renameSync(row.filePath, dest);
      report.moved.push({ from: row.rel, to: path.relative(REPO_ROOT, dest) });
    }
  }

  console.log(JSON.stringify(report, null, 2));
  if (!APPLY && candidates.length > 0) {
    console.error(`Dry-run only — re-run with --apply to move ${candidates.length} file(s) to ${path.relative(REPO_ROOT, ARCHIVE_DIR)}`);
  }
}

main();
