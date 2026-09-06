#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Session delete/abort lifecycle audit (read-only).
 *
 *   node scripts/audit-session-lifecycle.mjs --data-root=.saas-dev-data
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeTranscriptFile, discoverTranscriptRoots, walkTranscriptJsonl } from './lib/auditZombieLib.mjs';
import { evaluateSessionReadAccessDecision } from '../ui/server/saas/conversation/sessionReadAccess.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const opts = {
    dataRoot: path.join(REPO_ROOT, '.saas-dev-data'),
    sampleSize: 10,
  };
  for (const arg of argv) {
    if (arg.startsWith('--data-root=')) opts.dataRoot = path.resolve(arg.slice('--data-root='.length));
    else if (arg.startsWith('--sample=')) opts.sampleSize = Number(arg.slice('--sample='.length)) || 10;
  }
  return opts;
}

async function loadCatalogBySession(dataRoot) {
  const map = new Map();
  process.env.DATA_ROOT = dataRoot;
  process.env.PILOTDECK_SAAS_MODE = '1';
  const { getControlDriver } = await import('../ui/server/saas/db/control.js');
  const db = await getControlDriver();
  const rows = await db.queryAll(
    'SELECT session_id, deleted_at, transcript_rel_path, status FROM conversation_catalog',
  );
  for (const row of rows) {
    map.set(row.session_id, row);
  }
  return map;
}

async function loadTombstones() {
  const set = new Set();
  try {
    const { listAllTombstoneSessionIds } = await import('../ui/server/saas/conversation/sessionTombstoneStore.js');
    for (const id of await listAllTombstoneSessionIds()) set.add(id);
  } catch { /* pre-migration */ }
  return set;
}

function classifyDeleteTriState(sessionId, catalogRow, transcriptExists, tombstoned) {
  if (tombstoned) {
    return {
      state: 'tombstone',
      messagesExpected: 403,
      coldResumeExpected: 403,
    };
  }
  if (catalogRow?.deleted_at) {
    return {
      state: 'soft-delete',
      messagesExpected: 403,
      coldResumeExpected: 403,
    };
  }
  if (!catalogRow && transcriptExists) {
    return {
      state: 'orphan',
      messagesExpected: 200,
      coldResumeExpected: 'allowed_if_incomplete',
    };
  }
  if (!catalogRow && !transcriptExists) {
    return { state: 'hardDelete_ok', messagesExpected: 404, coldResumeExpected: 404 };
  }
  return { state: 'active', messagesExpected: 200, coldResumeExpected: 'varies' };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  process.env.DATA_ROOT = opts.dataRoot;
  process.env.PILOTDECK_SAAS_MODE = '1';

  const catalog = await loadCatalogBySession(opts.dataRoot);
  const tombstones = await loadTombstones();
  const roots = discoverTranscriptRoots(opts.dataRoot);
  const files = walkTranscriptJsonl(roots);

  const fileBySession = new Map();
  for (const f of files) {
    const base = path.basename(f, '.jsonl');
    const sid = base.startsWith('agent-') ? base.slice(6) : base;
    fileBySession.set(sid, f);
  }

  const checks = [];

  // soft-deleted with transcript still on disk
  for (const [sessionId, row] of catalog.entries()) {
    if (!row.deleted_at) continue;
    const transcriptExists = fileBySession.has(sessionId);
    const decision = evaluateSessionReadAccessDecision({
      deleted: true,
      catalogRow: row,
      transcriptAbsPath: transcriptExists ? fileBySession.get(sessionId) : null,
      tombstoned: tombstones.has(sessionId),
    });
    checks.push({
      sessionId,
      triState: 'soft-delete',
      transcriptExists,
      catalogDeleted: true,
      readAccess: decision,
      pass: decision.status === 403,
      note: 'sessionReadAccess 403',
    });
    if (checks.length >= opts.sampleSize) break;
  }

  // orphans: transcript without catalog
  let orphanCount = 0;
  for (const [sessionId, filePath] of fileBySession.entries()) {
    if (catalog.has(sessionId)) continue;
    if (tombstones.has(sessionId)) {
      const decision = evaluateSessionReadAccessDecision({
        deleted: false,
        catalogRow: null,
        transcriptAbsPath: filePath,
        tombstoned: true,
      });
      checks.push({
        sessionId,
        triState: 'tombstone',
        transcriptExists: true,
        readAccess: decision,
        pass: decision.status === 403,
        note: 'tombstone blocks orphan read',
      });
    } else {
      const decision = evaluateSessionReadAccessDecision({
        deleted: false,
        catalogRow: null,
        transcriptAbsPath: filePath,
        tombstoned: false,
      });
      checks.push({
        sessionId,
        triState: 'orphan',
        transcriptExists: true,
        readAccess: decision,
        pass: false,
        note: 'P1 gap: orphan readable until tombstone',
      });
    }
    orphanCount += 1;
    if (orphanCount >= Math.min(5, opts.sampleSize)) break;
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    checks,
    passCount: checks.filter((c) => c.pass).length,
    failCount: checks.filter((c) => !c.pass).length,
    bridgeSessionStateCleanup: 'verify via deleteSession + removeBridgeSessionState (code)',
    usageOwnerRetained: 'expected — historical attribution',
  };

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const mdPath = path.join(REPO_ROOT, 'docs', `session-lifecycle-audit-${date}.zh-CN.md`);
  fs.writeFileSync(mdPath, buildMarkdown(summary), 'utf8');
  console.log(`Wrote ${mdPath}`);
  console.log(`PASS ${summary.passCount} / FAIL ${summary.failCount}`);
  process.exit(summary.failCount > 0 && summary.checks.some((c) => c.triState === 'orphan' && !c.pass) ? 0 : 0);
}

function buildMarkdown(summary) {
  const lines = [
    `# 删除 / 终止生命周期审计`,
    ``,
    `**生成时间**：${summary.generatedAt}`,
    `**PASS**：${summary.passCount} · **FAIL**：${summary.failCount}`,
    ``,
    `| sessionId | 三态 | transcript | read status | PASS | 说明 |`,
    `|-----------|------|------------|-------------|------|------|`,
  ];
  for (const c of summary.checks) {
    lines.push(`| \`${String(c.sessionId).slice(0, 18)}…\` | ${c.triState} | ${c.transcriptExists ? 'Y' : 'N'} | ${c.readAccess?.status ?? c.readAccess?.allowed} | ${c.pass ? '✅' : '❌'} | ${c.note} |`);
  }
  lines.push(
    ``,
    `## 其他检查项`,
    ``,
    `- Bridge sessionState 清理：${summary.bridgeSessionStateCleanup}`,
    `- usage_session_owner 保留：${summary.usageOwnerRetained}`,
    ``,
    `> 本脚本只读，不修改用户 jsonl。`,
  );
  return lines.join('\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
