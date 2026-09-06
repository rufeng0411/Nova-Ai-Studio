#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Zombie / dead-loop session audit.
 *
 *   node scripts/audit-zombie-sessions.mjs --data-root=.saas-dev-data --limit=100
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analyzeTranscriptFile,
  discoverTranscriptRoots,
  readTelemetryCounts,
  walkTranscriptJsonl,
} from './lib/auditZombieLib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const opts = {
    dataRoot: path.join(REPO_ROOT, '.saas-dev-data'),
    limit: 0,
    json: null,
  };
  for (const arg of argv) {
    if (arg.startsWith('--data-root=')) opts.dataRoot = path.resolve(arg.slice('--data-root='.length));
    else if (arg.startsWith('--limit=')) opts.limit = Number(arg.slice('--limit='.length)) || 0;
    else if (arg.startsWith('--json=')) opts.json = path.resolve(arg.slice('--json='.length));
  }
  return opts;
}

async function loadCatalogIndex(dataRoot) {
  const map = new Map();
  try {
    process.env.DATA_ROOT = dataRoot;
    process.env.PILOTDECK_SAAS_MODE = '1';
    const { getControlDriver } = await import('../ui/server/saas/db/control.js');
    const db = await getControlDriver();
    const rows = await db.queryAll(
      'SELECT session_id, deleted_at, status FROM conversation_catalog',
    );
    for (const row of rows) {
      map.set(row.session_id, {
        deletedAt: row.deleted_at ?? null,
        status: row.status,
      });
    }
  } catch (error) {
    console.warn('[audit-zombie] catalog load failed:', error?.message || error);
  }
  return map;
}

async function loadTombstones() {
  const set = new Set();
  try {
    const { listAllTombstoneSessionIds } = await import('../ui/server/saas/conversation/sessionTombstoneStore.js');
    for (const id of await listAllTombstoneSessionIds()) set.add(id);
  } catch {
    // table may not exist yet in readonly audit before migration
  }
  return set;
}

function fmt(n) {
  return (n ?? 0).toLocaleString('en-US');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  process.env.DATA_ROOT = opts.dataRoot;
  process.env.PILOTDECK_SAAS_MODE = '1';

  const roots = discoverTranscriptRoots(opts.dataRoot);
  const files = walkTranscriptJsonl(roots);
  const catalogRows = await loadCatalogIndex(opts.dataRoot);
  const tombstones = await loadTombstones();
  const telemetry = readTelemetryCounts(path.join(opts.dataRoot, 'telemetry'));

  let results = files.map((f) => analyzeTranscriptFile(f, { catalogRows, tombstones }));
  results = results.filter((r) => r.risks.length > 0);
  results.sort((a, b) => b.score - a.score || b.synthetic - a.synthetic);
  if (opts.limit > 0) results = results.slice(0, opts.limit);

  const sdmPresent = results.filter((r) => r.manifestPresent).length;
  const orphans = results.filter((r) => r.deleteState === 'orphan');

  const report = {
    generatedAt: new Date().toISOString(),
    scannedFiles: files.length,
    highRiskCount: results.length,
    orphanCount: orphans.length,
    manifestPresentAmongRisk: sdmPresent,
    telemetry,
    sessions: results,
  };

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const mdPath = path.join(REPO_ROOT, 'docs', `zombie-sessions-audit-${date}.zh-CN.md`);
  fs.writeFileSync(mdPath, buildMarkdown(report), 'utf8');
  console.log(`Wrote ${mdPath}`);

  if (opts.json) {
    fs.mkdirSync(path.dirname(opts.json), { recursive: true });
    fs.writeFileSync(opts.json, JSON.stringify(report, null, 2), 'utf8');
  }

  console.log(`Scanned ${files.length} transcripts, ${results.length} high-risk`);
  process.exit(0);
}

function buildMarkdown(report) {
  const lines = [
    `# 僵尸 / 死循环会话审计`,
    ``,
    `**生成时间**：${report.generatedAt}`,
    `**扫描 jsonl**：${fmt(report.scannedFiles)} · **高风险**：${fmt(report.highRiskCount)} · **orphan**：${fmt(report.orphanCount)}`,
    `**SDM manifest（高风险子集）**：${fmt(report.manifestPresentAmongRisk)} / ${fmt(report.highRiskCount)}`,
    ``,
    `## Telemetry（若存在）`,
    ``,
    `- ui_auto_continue：${fmt(report.telemetry.ui_auto_continue)}`,
    `- cold_resume：${fmt(report.telemetry.cold_resume_fired)}`,
    `- validate cache：**无独立埋点**；下列 estValidateCalls 为 turn_acceptance + synthetic×2 代理`,
    ``,
    `## 高风险会话`,
    ``,
    `| sessionId | 风险 | synthetic | turn | 删除态 | estValidate | 建议 |`,
    `|-----------|------|-----------|------|--------|-------------|------|`,
  ];
  for (const s of report.sessions.slice(0, 50)) {
    const action = s.deleteState === 'orphan' ? 'tombstone/删' : s.risks.includes('synthetic_storm') ? '锁定观察' : '观察';
    lines.push(`| \`${s.sessionId.slice(0, 20)}…\` | ${s.risks.join(', ')} | ${s.synthetic} | ${s.turnCount} | ${s.deleteState} | ${s.estValidateCalls} | ${action} |`);
  }
  return lines.join('\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
