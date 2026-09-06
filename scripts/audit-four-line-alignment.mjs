#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Four-line alignment audit (对话 / 记录 / 文件夹 / 成果链).
 * Usage:
 *   node scripts/audit-four-line-alignment.mjs [--tenant default] [--project general] [--limit 500] [--since 2026-01-01]
 *   node scripts/audit-four-line-alignment.mjs --gate  (exit 1 if G-4L thresholds fail)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProjectId } from '../ui/server/utils/pilotPaths.js';
import { getDataRoot, getTenantPilotHome } from '../ui/server/saas/tenant/paths.js';
import { openControlDatabase, closeControlDatabase } from '../ui/server/saas/db/control.js';
import { validatePathsForAudit, resolveLegacyProjectRoot, deliverableSearchRoots } from './lib/auditDeliverableContext.mjs';
import { resolveProjectDeliverableFile } from '../ui/server/utils/pathInProject.js';
import { deliverableResolveMatchesRequest } from '../ui/shared/deliverablePathResolve.mjs';
import {
  classifyTurnAlignmentLabel,
  isBareNameRiskTurn,
  isUnrecoverableTurn,
  parseJsonlFile,
} from './lib/parseJsonlTurns.mjs';
import { inferTurnArtifactDirectory } from './lib/inferTurnArtifactDirectory.mjs';
import { detectTurnKpis } from './lib/parseExportHtmlFourLine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

process.env.PILOTDECK_SAAS_MODE = '1';
const localDevDataRoot = path.join(REPO_ROOT, '.saas-dev-data');
if (!process.env.DATA_ROOT) {
  process.env.DATA_ROOT = fs.existsSync(localDevDataRoot) ? localDevDataRoot : getDataRoot();
}

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

const tenantFilter = argValue('--tenant', 'default');
const projectFilter = argValue('--project', null);
const limit = Number.parseInt(argValue('--limit', '500'), 10);
const since = argValue('--since', null);
const gateMode = process.argv.includes('--gate');
const sessionsFromPath = argValue('--sessions-from', null);

async function loadSessionsFromFixture(fixturePath) {
  const absFixture = path.isAbsolute(fixturePath)
    ? fixturePath
    : path.join(REPO_ROOT, fixturePath);
  const data = JSON.parse(fs.readFileSync(absFixture, 'utf8'));
  return (data.sessions ?? []).map((s) => {
    const jsonlPath = path.isAbsolute(s.jsonlPath) ? s.jsonlPath : path.join(REPO_ROOT, s.jsonlPath);
    const legacyProjectId = s.projectKey === 'general'
      ? resolveGeneralSlug(s.tenantId)
      : s.projectKey;
    return {
      tenantId: s.tenantId,
      legacyProjectId,
      sessionId: path.basename(jsonlPath, '.jsonl'),
      jsonlPath,
      transcriptRelPath: path.relative(getTenantPilotHome(s.tenantId), jsonlPath).split(path.sep).join('/'),
      projectRoot: s.projectRoot
        ? (path.isAbsolute(s.projectRoot) ? s.projectRoot : path.join(REPO_ROOT, s.projectRoot))
        : undefined,
      mtimeMs: Date.now(),
    };
  });
}

function resolveGeneralSlug(tenantId) {
  const pilotHome = getTenantPilotHome(tenantId);
  return createProjectId(pilotHome);
}

async function listJsonlSessions(tenantId) {
  const pilotHome = getTenantPilotHome(tenantId);
  const projectsRoot = path.join(pilotHome, 'projects');
  const sessions = [];
  let entries;
  try {
    entries = await fs.promises.readdir(projectsRoot, { withFileTypes: true });
  } catch {
    return sessions;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (projectFilter && projectFilter !== 'all' && entry.name !== projectFilter && projectFilter !== 'general') continue;
    if (projectFilter === 'general') {
      const generalSlug = resolveGeneralSlug(tenantId);
      if (entry.name !== generalSlug) continue;
    }
    // PD-SAAS-FORK: --project all or default (no filter) scans every legacy project dir.
    const chatsDir = path.join(projectsRoot, entry.name, 'chats');
    let files;
    try {
      files = await fs.promises.readdir(chatsDir);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      const absPath = path.join(chatsDir, file);
      const stat = await fs.promises.stat(absPath).catch(() => null);
      if (!stat) continue;
      if (since && stat.mtimeMs < Date.parse(since)) continue;
      sessions.push({
        tenantId,
        legacyProjectId: entry.name,
        sessionId: file.slice(0, -'.jsonl'.length),
        jsonlPath: absPath,
        transcriptRelPath: path.relative(pilotHome, absPath).split(path.sep).join('/'),
        mtimeMs: stat.mtimeMs,
      });
    }
  }

  sessions.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return sessions.slice(0, Math.max(1, limit));
}

async function loadCatalogMap(tenantId) {
  const db = await openControlDatabase();
  const rows = await db.queryAll(
    `SELECT session_id, legacy_project_id, transcript_rel_path, user_id
     FROM conversation_catalog
     WHERE tenant_id = ? AND deleted_at IS NULL`,
    [tenantId],
  );
  await closeControlDatabase();
  const map = new Map();
  for (const row of rows) {
    map.set(String(row.session_id), row);
  }
  return map;
}

async function auditTurn(session, turn, projectRoot, knownRoots) {
  const hintDir = turn.turnDeliverableMeta?.turnArtifactDir
    ?? inferTurnArtifactDirectory(turn.deliverableItems);

  let r1Pass = true;
  for (const toolPath of [...new Set(turn.toolPaths)]) {
    const resolved = resolveProjectDeliverableFile(projectRoot, toolPath, knownRoots, hintDir ? { hintDir } : {});
    if (!resolved.ok) {
      r1Pass = false;
      break;
    }
  }

  const panelPaths = (turn.finalDeliverables ?? []).map((d) => d.apiPath || d.path).filter(Boolean);
  const validation = panelPaths.length > 0
    ? await validatePathsForAudit(projectRoot, knownRoots, panelPaths, hintDir ?? undefined)
    : { items: [] };

  let r2Pass = panelPaths.length === 0
    || validation.items.every((item) => item.status === 'verified' || item.status === 'pending');
  let crossDeckPhantom = false;
  for (const item of validation.items) {
    if (item.status === 'verified' && item.resolvedPath) {
      const req = panelPaths.find((p) => p === item.path) ?? item.path;
      if (!deliverableResolveMatchesRequest(req, item.resolvedPath)) {
        r2Pass = false;
        crossDeckPhantom = true;
      }
    }
    if (item.status === 'broken') {
      r2Pass = false;
    }
  }

  const bodyPaths = turn.assistantText ? turn.assistantText.match(/(?:artifacts\/[^\s`"'<>]+|\b[\w.-]+\.(?:html|md|pdf|pptx|png|jpe?g))\b/gi) : [];
  const primaryPanel = panelPaths[0] ?? null;
  let r3Pass = true;
  if (bodyPaths?.length && primaryPanel) {
    const bodyFirst = bodyPaths[0].replace(/\\/g, '/');
    const resolvedBody = resolveProjectDeliverableFile(projectRoot, bodyFirst, knownRoots, hintDir ? { hintDir } : {});
    const resolvedPanel = resolveProjectDeliverableFile(projectRoot, primaryPanel, knownRoots, hintDir ? { hintDir } : {});
    if (resolvedBody.ok && resolvedPanel.ok) {
      r3Pass = resolvedBody.relativePath === resolvedPanel.relativePath
        || deliverableResolveMatchesRequest(bodyFirst, resolvedPanel.relativePath);
    }
  }

  const expectedLegacy = resolveGeneralSlug(session.tenantId);
  const catalogRow = session.catalogRow;
  let r4Pass = true;
  let catalogMismatch = false;
  if (catalogRow) {
    if (catalogRow.legacy_project_id === 'general' && session.legacyProjectId === expectedLegacy) {
      r4Pass = false;
      catalogMismatch = true;
    }
    if (catalogRow.transcript_rel_path && catalogRow.transcript_rel_path !== session.transcriptRelPath) {
      const normCatalog = catalogRow.transcript_rel_path.replace(/\\/g, '/');
      const normDisk = session.transcriptRelPath.replace(/\\/g, '/');
      if (normCatalog !== normDisk) {
        r4Pass = false;
        catalogMismatch = true;
      }
    }
  }

  const unrecoverable = isUnrecoverableTurn(turn);
  const bareNameRisk = isBareNameRiskTurn(turn) && !hintDir;
  const missingOnDisk = !r1Pass || validation.items.some((item) => item.status === 'broken');

  const acceptanceMeta = turn.turnAcceptanceMeta ?? null;
  let certFalseComplete = false;
  let legacyPassedIncomplete = false;
  if (acceptanceMeta?.acceptanceStatus === 'passed') {
    const cert = acceptanceMeta.acceptanceCertificate;
    if (cert?.certificateVersion === 1) {
      if (cert.requiredDone < cert.requiredTotal) certFalseComplete = true;
      if (cert.completionState === 'complete' && cert.requiredDone !== cert.requiredTotal) {
        certFalseComplete = true;
      }
    } else {
      const snap = acceptanceMeta.contractSnapshot;
      if (snap && snap.doneSlots < snap.totalSlots) legacyPassedIncomplete = true;
      if (cert && cert.requiredDone < cert.requiredTotal) legacyPassedIncomplete = true;
    }
  }

  const turnKpis = detectTurnKpis(
    {
      turnAcceptanceMeta: acceptanceMeta,
      verifiedPaths: validation.items.filter((i) => i.status === 'verified').map((i) => i.resolvedPath || i.path),
      panelPaths,
    },
    { certFalseComplete, legacyPassedIncomplete },
  );

  const checks = {
    aligned: r1Pass && r2Pass && r3Pass && r4Pass && !unrecoverable && !bareNameRisk && !certFalseComplete,
    bareNameRisk,
    crossDeckPhantom,
    missingOnDisk,
    catalogMismatch,
    unrecoverable,
    certFalseComplete,
    legacyPassedIncomplete,
    slot_collision: turnKpis.slot_collision > 0,
    hash_mismatch: turnKpis.hash_mismatch > 0,
    literal_placeholder_path: turnKpis.literal_placeholder_path > 0,
    snapshot_truncated: turnKpis.snapshot_truncated > 0,
    nonterminal_export_as_final: turnKpis.nonterminal_export_as_final > 0,
  };

  return {
    turnId: turn.turnId,
    label: classifyTurnAlignmentLabel(turn, checks),
    hintDir,
    r1Pass,
    r2Pass,
    r3Pass,
    r4Pass,
    panelPaths,
    verifiedPaths: validation.items.filter((i) => i.status === 'verified').map((i) => i.resolvedPath || i.path),
    checks,
    kpis: turnKpis,
  };
}

async function auditSession(session, catalogMap) {
  session.catalogRow = catalogMap.get(session.sessionId) ?? null;
  const parsed = parseJsonlFile(session.jsonlPath);
  const projectRoot = session.projectRoot
    ?? resolveLegacyProjectRoot(session.tenantId, session.legacyProjectId);
  const knownRoots = deliverableSearchRoots(projectRoot, session.tenantId);
  const turnResults = [];
  for (const turn of parsed.turns) {
    turnResults.push(await auditTurn(session, turn, projectRoot, knownRoots));
  }
  return { session, skipped: false, turns: turnResults, lineCount: parsed.lineCount };
}

function summarize(allResults) {
  const labels = {};
  for (const result of allResults) {
    for (const turn of result.turns) {
      labels[turn.label] = (labels[turn.label] ?? 0) + 1;
    }
  }
  const totalTurns = Object.values(labels).reduce((a, b) => a + b, 0);
  const aligned = labels.aligned ?? 0;
  const missingOnDisk = labels.missing_on_disk ?? 0;
  let certFalseComplete = 0;
  let legacyPassedIncomplete = 0;
  let slot_collision = 0;
  let hash_mismatch = 0;
  let literal_placeholder_path = 0;
  let snapshot_truncated = 0;
  let nonterminal_export_as_final = 0;
  for (const result of allResults) {
    for (const turn of result.turns) {
      if (turn.checks?.certFalseComplete) certFalseComplete += 1;
      if (turn.checks?.legacyPassedIncomplete) legacyPassedIncomplete += 1;
      if (turn.checks?.slot_collision) slot_collision += 1;
      if (turn.checks?.hash_mismatch) hash_mismatch += 1;
      if (turn.checks?.literal_placeholder_path) literal_placeholder_path += 1;
      if (turn.checks?.snapshot_truncated) snapshot_truncated += 1;
      if (turn.checks?.nonterminal_export_as_final) nonterminal_export_as_final += 1;
    }
  }
  const alignedPct = totalTurns > 0 ? (aligned / totalTurns) * 100 : 100;
  const actionableTurns = totalTurns - missingOnDisk;
  const actionableAlignedPct =
    actionableTurns > 0 ? (aligned / actionableTurns) * 100 : alignedPct;
  return {
    labels,
    totalTurns,
    alignedPct,
    actionableAlignedPct,
    missingOnDisk,
    certFalseComplete,
    legacyPassedIncomplete,
    slot_collision,
    hash_mismatch,
    literal_placeholder_path,
    snapshot_truncated,
    nonterminal_export_as_final,
  };
}

async function main() {
  const date = new Date().toISOString().slice(0, 10);
  const auditJsonlPath = path.join(REPO_ROOT, 'artifacts', 'audit', `four-line-alignment-${date}.jsonl`);
  const reportPath = path.join(REPO_ROOT, 'docs', `four-line-alignment-audit-${date}.md`);

  fs.mkdirSync(path.dirname(auditJsonlPath), { recursive: true });
  if (!fs.existsSync(auditJsonlPath)) {
    fs.writeFileSync(auditJsonlPath, '', 'utf8');
  }

  const sessions = sessionsFromPath
    ? await loadSessionsFromFixture(sessionsFromPath)
    : await listJsonlSessions(tenantFilter);
  const catalogMap = await loadCatalogMap(tenantFilter).catch(() => new Map());

  const allResults = [];
  for (const session of sessions) {
    const result = await auditSession(session, catalogMap);
    allResults.push(result);
    for (const turn of result.turns) {
      fs.appendFileSync(
        auditJsonlPath,
        `${JSON.stringify({
          tenantId: session.tenantId,
          sessionId: session.sessionId,
          legacyProjectId: session.legacyProjectId,
          jsonlPath: session.jsonlPath,
          transcriptRelPath: session.transcriptRelPath,
          ...turn,
          at: new Date().toISOString(),
        })}\n`,
        'utf8',
      );
    }
  }

  const summary = summarize(allResults);
  const topIssues = allResults
    .flatMap((r) => r.turns.map((t) => ({ ...t, sessionId: r.session.sessionId, jsonlPath: r.session.jsonlPath })))
    .filter((t) => t.label !== 'aligned')
    .slice(0, 20);

  const report = `# Four-line alignment audit (${date})

- Tenant: \`${tenantFilter}\`
- Sessions scanned: ${sessions.length}
- Turns audited: ${summary.totalTurns}
- Aligned: ${summary.labels.aligned ?? 0} (${summary.alignedPct.toFixed(1)}% raw, actionable ${summary.actionableAlignedPct.toFixed(1)}% excl. missing_on_disk)

## Label distribution

| Label | Count |
|-------|-------|
${Object.entries(summary.labels).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

## G-4L gates

| ID | Status | Notes |
|----|--------|-------|
| G-4L1 | PASS | Audit completed without crash |
| G-4L2 | ${summary.actionableAlignedPct >= 85 ? 'PASS' : 'WARN'} | actionable aligned ≥ 85% (actual ${summary.actionableAlignedPct.toFixed(1)}%, raw ${summary.alignedPct.toFixed(1)}%) |
| G-4L3 | pending | Run \`npm run test:four-line-e2e\` |
| G-4L4 | pending | Run catalog legacy backfill |

## Export / certificate KPIs (0717 cursor)

| KPI | Count |
|-----|-------|
| slot_collision | ${summary.slot_collision ?? 0} |
| hash_mismatch | ${summary.hash_mismatch ?? 0} |
| literal_placeholder_path | ${summary.literal_placeholder_path ?? 0} |
| snapshot_truncated | ${summary.snapshot_truncated ?? 0} |
| nonterminal_export_as_final | ${summary.nonterminal_export_as_final ?? 0} |

## Top issue turns

${topIssues.length === 0 ? '_None_' : topIssues.map((t) => `- \`${t.sessionId}\` turn \`${t.turnId}\`: **${t.label}** hint=\`${t.hintDir ?? ''}\``).join('\n')}

- JSONL detail: \`${path.relative(REPO_ROOT, auditJsonlPath)}\`
- Generated: ${new Date().toISOString()}
`;

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report, 'utf8');

  console.log(`[audit-four-line] sessions=${sessions.length} turns=${summary.totalTurns} aligned=${summary.alignedPct.toFixed(1)}%`);
  if ((summary.legacyPassedIncomplete ?? 0) > 0) {
    console.log(`[audit-four-line] legacy passed+incomplete (pre-cert-v1, informational): ${summary.legacyPassedIncomplete}`);
  }
  const kpiLine = [
    summary.slot_collision ? `slot_collision=${summary.slot_collision}` : null,
    summary.hash_mismatch ? `hash_mismatch=${summary.hash_mismatch}` : null,
    summary.literal_placeholder_path ? `literal_placeholder_path=${summary.literal_placeholder_path}` : null,
    summary.snapshot_truncated ? `snapshot_truncated=${summary.snapshot_truncated}` : null,
    summary.nonterminal_export_as_final ? `nonterminal_export_as_final=${summary.nonterminal_export_as_final}` : null,
  ].filter(Boolean).join(' ');
  if (kpiLine) {
    console.log(`[audit-four-line] export KPI flags: ${kpiLine}`);
  }
  console.log(`[audit-four-line] report → ${reportPath}`);
  console.log(`[audit-four-line] jsonl → ${auditJsonlPath}`);

  if (gateMode && sessions.length === 0) {
    console.error('[audit-four-line] G-4L0 FAIL: zero sessions scanned (check DATA_ROOT / tenant)');
    process.exit(1);
  }

  if (gateMode && summary.totalTurns > 0 && summary.actionableAlignedPct < 85) {
    console.error(
      `[audit-four-line] G-4L2 FAIL: actionable aligned < 85% (${summary.actionableAlignedPct.toFixed(1)}%, missing_on_disk=${summary.missingOnDisk})`,
    );
    process.exit(1);
  }

  if (gateMode && summary.totalTurns === 0) {
    console.error('[audit-four-line] G-4L0 FAIL: zero turns audited');
    process.exit(1);
  }

  if (gateMode && (summary.certFalseComplete ?? 0) > 0) {
    console.error(`[audit-four-line] G-4L5 FAIL: passed+incomplete certificate (${summary.certFalseComplete})`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[audit-four-line] FAIL:', error);
  process.exit(1);
});
