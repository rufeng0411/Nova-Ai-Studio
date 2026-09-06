#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Router usage attribution audit (full stats.jsonl vs dashboard slice).
 *
 *   node scripts/audit-usage-attribution.mjs --data-root=.saas-dev-data
 *   node scripts/audit-usage-attribution.mjs --json artifacts/usage-audit/report.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  altSessionIdVariant,
  buildDashboardFromRecords,
  classifyProjectPath,
  loadAllStatsRecords,
  resolveStatsJsonlPath,
} from './lib/auditStatsJsonl.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const opts = {
    dataRoot: path.join(REPO_ROOT, '.saas-dev-data'),
    json: null,
    statsPath: null,
    serverUrl: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--data-root=')) opts.dataRoot = path.resolve(arg.slice('--data-root='.length));
    else if (arg === '--json' && argv[i + 1]) {
      opts.json = path.resolve(argv[++i]);
    } else if (arg.startsWith('--json=')) opts.json = path.resolve(arg.slice('--json='.length));
    else if (arg.startsWith('--stats-path=')) opts.statsPath = path.resolve(arg.slice('--stats-path='.length));
    else if (arg.startsWith('--server-url=')) opts.serverUrl = arg.slice('--server-url='.length).replace(/\/$/, '');
  }
  return opts;
}

function fmt(n) {
  return (n ?? 0).toLocaleString('en-US');
}

function topSessionsByTokens(records, owners, limit = 20) {
  const bySession = new Map();
  for (const rec of records) {
    if (!rec.sessionId || rec.sessionId.includes('::sub::')) continue;
    const usage = rec.usage || {};
    const tokens = usage.totalTokens ?? (usage.inputTokens || 0) + (usage.outputTokens || 0);
    const cur = bySession.get(rec.sessionId) || {
      sessionId: rec.sessionId,
      totalTokens: 0,
      requestCount: 0,
      projectPath: rec.projectPath || '(unknown)',
      lastAt: rec.endedAt || rec.startedAt || '',
    };
    cur.totalTokens += tokens;
    cur.requestCount += 1;
    if ((rec.endedAt || rec.startedAt || '') > cur.lastAt) {
      cur.lastAt = rec.endedAt || rec.startedAt || '';
      cur.projectPath = rec.projectPath || cur.projectPath;
    }
    bySession.set(rec.sessionId, cur);
  }

  return [...bySession.values()]
    .filter((s) => {
      const owner = owners.get(s.sessionId);
      return !owner?.userId;
    })
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, limit)
    .map((s) => ({
      ...s,
      ownerHit: owners.has(s.sessionId),
      ownerVariantHit: (() => {
        const alt = altSessionIdVariant(s.sessionId);
        return alt ? owners.has(alt) : false;
      })(),
    }));
}

async function loadOwners(dataRoot) {
  const map = new Map();
  try {
    process.env.DATA_ROOT = dataRoot;
    process.env.PILOTDECK_SAAS_MODE = '1';
    const { getControlDriver } = await import('../ui/server/saas/db/control.js');
    const db = await getControlDriver();
    const rows = await db.queryAll(
      'SELECT session_id, user_id, tenant_id, project_path FROM usage_session_owner',
    );
    for (const row of rows) {
      map.set(row.session_id, {
        userId: row.user_id ?? null,
        tenantId: row.tenant_id ?? null,
        projectPath: row.project_path ?? null,
      });
    }
  } catch (error) {
    console.warn('[audit-usage] loadOwners failed:', error?.message || error);
  }
  return map;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  process.env.DATA_ROOT = opts.dataRoot;
  process.env.PILOTDECK_SAAS_MODE = '1';

  const statsPath = opts.statsPath || resolveStatsJsonlPath(process.env);
  const allRecords = loadAllStatsRecords(statsPath);
  const owners = await loadOwners(opts.dataRoot);

  const { tenantIdForProjectPath } = await import('../ui/server/saas/tenant/scope.js');
  const { aggregateRouterUsage } = await import('../ui/server/saas/usage/store.js');

  const fullDashboard = buildDashboardFromRecords(allRecords);
  const sliceDashboard = buildDashboardFromRecords(allRecords, { perProjectLimit: 1000 });

  const fullAgg = await aggregateRouterUsage(fullDashboard);
  const sliceAgg = await aggregateRouterUsage(sliceDashboard);

  let ownerHit = 0;
  let ownerMiss = 0;
  let variantMismatch = 0;
  const sessionIds = new Set(allRecords.map((r) => r.sessionId).filter(Boolean));
  for (const sid of sessionIds) {
    if (owners.has(sid)) {
      ownerHit += 1;
    } else {
      const alt = altSessionIdVariant(sid);
      if (alt && owners.has(alt)) variantMismatch += 1;
      else ownerMiss += 1;
    }
  }

  const pathDist = new Map();
  for (const rec of allRecords) {
    const cls = classifyProjectPath(rec.projectPath, tenantIdForProjectPath);
    pathDist.set(cls, (pathDist.get(cls) || 0) + 1);
  }

  const topUnattrib = topSessionsByTokens(allRecords, owners, 20);

  const report = {
    generatedAt: new Date().toISOString(),
    statsPath,
    recordCount: allRecords.length,
    uniqueSessions: sessionIds.size,
    ownerJoin: { hit: ownerHit, miss: ownerMiss, variantOnly: variantMismatch },
    fullJsonl: {
      totalTokens: fullAgg.total.totalTokens,
      requestCount: fullAgg.total.requestCount,
      attributedSessions: fullAgg.attributed,
      backgroundSessions: fullAgg.backgroundAttributed,
      systemSessions: fullAgg.unattributed,
      byUser: fullAgg.byUser,
    },
    dashboardSlice1000: {
      totalTokens: sliceAgg.total.totalTokens,
      requestCount: sliceAgg.total.requestCount,
      attributedSessions: sliceAgg.attributed,
      backgroundSessions: sliceAgg.backgroundAttributed,
      systemSessions: sliceAgg.unattributed,
      tokenDeltaVsFull: fullAgg.total.totalTokens - sliceAgg.total.totalTokens,
      requestDeltaVsFull: fullAgg.total.requestCount - sliceAgg.total.requestCount,
    },
    projectPathDistribution: Object.fromEntries(pathDist),
    topUnattributedSessions: topUnattrib,
  };

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const mdPath = path.join(REPO_ROOT, 'docs', `usage-attribution-audit-${date}.zh-CN.md`);
  const md = buildMarkdown(report);
  fs.mkdirSync(path.dirname(mdPath), { recursive: true });
  fs.writeFileSync(mdPath, md, 'utf8');
  console.log(`Wrote ${mdPath}`);

  if (opts.json) {
    fs.mkdirSync(path.dirname(opts.json), { recursive: true });
    fs.writeFileSync(opts.json, JSON.stringify(report, null, 2), 'utf8');
    console.log(`Wrote ${opts.json}`);
  }

  console.log(`\nFull jsonl tokens: ${fmt(report.fullJsonl.totalTokens)} | slice(-1000): ${fmt(report.dashboardSlice1000.totalTokens)} | delta: ${fmt(report.dashboardSlice1000.tokenDeltaVsFull)}`);
  process.exit(0);
}

function buildMarkdown(report) {
  const lines = [
    `# 路由用量归因审计报告`,
    ``,
    `**生成时间**：${report.generatedAt}`,
    `**stats.jsonl**：\`${report.statsPath}\``,
    `**记录数**：${fmt(report.recordCount)} · **会话数**：${fmt(report.uniqueSessions)}`,
    ``,
    `## owner 映射`,
    ``,
    `| 指标 | 数量 |`,
    `|------|------|`,
    `| owner 命中 | ${fmt(report.ownerJoin.hit)} |`,
    `| owner 缺失 | ${fmt(report.ownerJoin.miss)} |`,
    `| 仅变体命中 (web:s_ ↔ web-s_) | ${fmt(report.ownerJoin.variantOnly)} |`,
    ``,
    `## 三分桶（全量 jsonl）`,
    ``,
    `| 桶 | session 数 | Token | 请求 |`,
    `|----|-----------|-------|------|`,
    `| 已归属 user | ${fmt(report.fullJsonl.attributedSessions)} | — | — |`,
    `| 后台 tenant:* | ${fmt(report.fullJsonl.backgroundSessions)} | — | — |`,
    `| 系统/历史 __system__ | ${fmt(report.fullJsonl.systemSessions)} | — | — |`,
    ``,
    `| 用户/桶 | Token | 请求 |`,
    `|---------|-------|------|`,
  ];
  for (const row of report.fullJsonl.byUser.slice(0, 15)) {
    lines.push(`| ${row.username} | ${fmt(row.totalTokens)} | ${fmt(row.requestCount)} |`);
  }
  lines.push(
    ``,
    `## 全量 jsonl vs dashboard 每项目 slice(-1000)`,
    ``,
    `| 维度 | 全量 | slice | 差值 |`,
    `|------|------|-------|------|`,
    `| Token | ${fmt(report.fullJsonl.totalTokens)} | ${fmt(report.dashboardSlice1000.totalTokens)} | ${fmt(report.dashboardSlice1000.tokenDeltaVsFull)} |`,
    `| 请求 | ${fmt(report.fullJsonl.requestCount)} | ${fmt(report.dashboardSlice1000.requestCount)} | ${fmt(report.dashboardSlice1000.requestDeltaVsFull)} |`,
    ``,
    `> KPI「未归属」计数仅计 __system__ session 数（${fmt(report.fullJsonl.systemSessions)}），非表格全部无用户名 Token。`,
    ``,
    `## projectPath 分布（record 级）`,
    ``,
  );
  for (const [k, v] of Object.entries(report.projectPathDistribution)) {
    lines.push(`- **${k}**：${fmt(v)}`);
  }
  lines.push(``, `## Top20 高消耗无 userId session`, ``, `| sessionId | Token | 请求 | projectPath | owner | 变体 |`, `|-----------|-------|------|-------------|-------|------|`);
  for (const s of report.topUnattributedSessions) {
    lines.push(`| \`${s.sessionId.slice(0, 24)}…\` | ${fmt(s.totalTokens)} | ${fmt(s.requestCount)} | ${String(s.projectPath).slice(-40)} | ${s.ownerHit ? 'Y' : 'N'} | ${s.ownerVariantHit ? 'Y' : 'N'} |`);
  }
  lines.push(``, `---`, `audit_only — 未改写 stats.jsonl`);
  return lines.join('\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
