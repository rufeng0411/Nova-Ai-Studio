#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Backfill turn_deliverable_meta rows into historical JSONL (append-only).
 * Usage:
 *   node scripts/backfill-turn-artifact-dirs.mjs [--dry-run]
 *   node scripts/backfill-turn-artifact-dirs.mjs --apply [--tenant default] [--limit 500]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { getDataRoot, getTenantPilotHome } from '../ui/server/saas/tenant/paths.js';
import { validatePathsForAudit, resolveLegacyProjectRoot, deliverableSearchRoots } from './lib/auditDeliverableContext.mjs';
import { inferTurnArtifactDirectory } from './lib/inferTurnArtifactDirectory.mjs';
import { isUnrecoverableTurn, parseJsonlFile } from './lib/parseJsonlTurns.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

process.env.PILOTDECK_SAAS_MODE = '1';
if (!process.env.DATA_ROOT) {
  process.env.DATA_ROOT = getDataRoot();
}

const dryRun = !process.argv.includes('--apply');
const tenantFilter = process.argv.includes('--tenant')
  ? process.argv[process.argv.indexOf('--tenant') + 1]
  : 'default';
const limit = Number.parseInt(
  process.argv.includes('--limit') ? process.argv[process.argv.indexOf('--limit') + 1] : '5000',
  10,
);

function normalizePanelPath(filePath) {
  return String(filePath || '').replace(/\\/g, '/').trim();
}

function isPathInDir(filePath, dir) {
  const normalized = normalizePanelPath(filePath);
  return normalized === dir || normalized.startsWith(`${dir}/`);
}

function uniquePaths(paths) {
  const seen = new Set();
  const out = [];
  for (const filePath of paths) {
    const normalized = normalizePanelPath(filePath);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function buildCumulativeDeliverableSnapshot(turns, turnId) {
  const currentIndex = turns.findIndex((turn) => turn.turnId === turnId);
  if (currentIndex < 0) return { hintDir: null, paths: [] };
  const scopedTurns = turns.slice(0, currentIndex + 1);
  const allItems = scopedTurns.flatMap((turn) => turn.deliverableItems ?? []);
  const hintDir = inferTurnArtifactDirectory(allItems);
  if (!hintDir) return { hintDir: null, paths: [] };
  const paths = uniquePaths(
    allItems
      .map((item) => item.apiPath || item.path)
      .filter((filePath) => isPathInDir(filePath, hintDir)),
  );
  return { hintDir, paths };
}

async function listJsonlFiles(tenantId) {
  const pilotHome = getTenantPilotHome(tenantId);
  const projectsRoot = path.join(pilotHome, 'projects');
  const files = [];
  let entries;
  try {
    entries = await fs.promises.readdir(projectsRoot, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const chatsDir = path.join(projectsRoot, entry.name, 'chats');
    let names;
    try {
      names = await fs.promises.readdir(chatsDir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.endsWith('.jsonl')) continue;
      files.push({
        tenantId,
        legacyProjectId: entry.name,
        jsonlPath: path.join(chatsDir, name),
      });
    }
  }
  return files.slice(0, limit);
}

async function planBackfill(fileInfo) {
  const parsed = parseJsonlFile(fileInfo.jsonlPath);
  const projectRoot = resolveLegacyProjectRoot(fileInfo.tenantId, fileInfo.legacyProjectId);
  const knownRoots = deliverableSearchRoots(projectRoot, fileInfo.tenantId);
  const planned = [];

  for (const turn of parsed.turns) {
    if (parsed.metaByTurnId.has(turn.turnId)) continue;
    const cumulative = buildCumulativeDeliverableSnapshot(parsed.turns, turn.turnId);
    const hintDir = inferTurnArtifactDirectory(turn.deliverableItems) ?? cumulative.hintDir;
    const directPanelPaths = (turn.finalDeliverables ?? []).map((d) => d.apiPath || d.path).filter(Boolean);
    const panelPaths = uniquePaths([
      ...directPanelPaths,
      ...(hintDir ? cumulative.paths.filter((filePath) => isPathInDir(filePath, hintDir)) : []),
    ]);
    const validation = panelPaths.length > 0
      ? await validatePathsForAudit(projectRoot, knownRoots, panelPaths, hintDir ?? undefined)
      : { items: [] };
    const verifiedPaths = validation.items
      .filter((item) => item.status === 'verified')
      .map((item) => item.resolvedPath || item.path);
    if (!hintDir && verifiedPaths.length === 0 && !isUnrecoverableTurn(turn)) continue;

    planned.push({
      turnId: turn.turnId,
      sessionId: turn.sessionId,
      tenantId: fileInfo.tenantId,
      projectRoot,
      turnArtifactDir: hintDir ?? undefined,
      verifiedPaths,
      alignmentStatus: isUnrecoverableTurn(turn) ? 'unrecoverable' : 'aligned',
      sequence: parsed.entries.reduce((max, e) => Math.max(max, e.sequence ?? 0), 0) + planned.length + 1,
    });
  }

  return { fileInfo, planned, lineCountBefore: parsed.lineCount };
}

async function applyBackfill(jsonlPath, planned, lineCountBefore) {
  const backupPath = `${jsonlPath}.bak`;
  if (!fs.existsSync(backupPath)) {
    await fs.promises.copyFile(jsonlPath, backupPath);
  }
  const stamp = new Date().toISOString();
  let sequenceOffset = 0;
  for (const row of planned) {
    const entry = {
      type: 'turn_deliverable_meta',
      sessionId: row.sessionId,
      turnId: row.turnId,
      sequence: row.sequence + sequenceOffset,
      createdAt: stamp,
      entryId: randomUUID(),
      turnArtifactDir: row.turnArtifactDir,
      verifiedPaths: row.verifiedPaths,
      alignmentStatus: row.alignmentStatus,
    };
    await fs.promises.appendFile(jsonlPath, `${JSON.stringify(entry)}\n`, 'utf8');
    sequenceOffset += 1;
    for (const verifiedPath of row.verifiedPaths ?? []) {
      const ledgerEntry = {
        type: 'task_deliverable_ledger',
        sessionId: row.sessionId,
        turnId: row.turnId,
        sequence: row.sequence + sequenceOffset,
        createdAt: stamp,
        entryId: randomUUID(),
        record: {
          taskId: row.turnId,
          sessionId: row.sessionId,
          turnId: row.turnId,
          tenantId: row.tenantId,
          workspaceRoot: row.projectRoot,
          goalVersion: 1,
          apiPath: verifiedPath,
          resolvedPath: verifiedPath,
          hintDir: row.turnArtifactDir,
          turnArtifactDir: row.turnArtifactDir,
          basename: path.basename(verifiedPath),
          source: 'meta_backfill',
          validationStatus: 'verified',
          displayRole: 'primary',
          acceptanceRole: 'required',
          resolvedBy: 'legacyMeta',
        },
      };
      await fs.promises.appendFile(jsonlPath, `${JSON.stringify(ledgerEntry)}\n`, 'utf8');
      sequenceOffset += 1;
    }
  }
  const lineCountAfter = fs.readFileSync(jsonlPath, 'utf8').split(/\r?\n/).filter(Boolean).length;
  return { lineCountBefore, lineCountAfter, appended: planned.length };
}

async function main() {
  const date = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(REPO_ROOT, 'docs', `historical-turn-artifact-backfill-${date}.md`);
  const files = await listJsonlFiles(tenantFilter);

  let totalPlanned = 0;
  let totalApplied = 0;
  let sessionsTouched = 0;
  const samples = [];

  for (let i = 0; i < files.length; i += 1) {
    const plan = await planBackfill(files[i]);
    if (plan.planned.length === 0) continue;
    totalPlanned += plan.planned.length;
    sessionsTouched += 1;

    if (!dryRun) {
      const result = await applyBackfill(plan.fileInfo.jsonlPath, plan.planned, plan.lineCountBefore);
      totalApplied += result.appended;
      if (samples.length < 5) {
        samples.push({ jsonl: plan.fileInfo.jsonlPath, ...result });
      }
    }

    if ((i + 1) % 100 === 0) {
      console.log(`[backfill] checkpoint ${i + 1}/${files.length} planned=${totalPlanned}`);
    }
  }

  const body = `# Historical turn artifact backfill (${date})

- Mode: ${dryRun ? 'dry-run' : 'apply'}
- Tenant: \`${tenantFilter}\`
- JSONL scanned: ${files.length}
- Sessions with planned meta: ${sessionsTouched}
- Turns planned: ${totalPlanned}
- Turns applied: ${totalApplied}
- At: ${new Date().toISOString()}

## Samples

${samples.length === 0 ? '_None_' : samples.map((s) => `- \`${s.jsonl}\`: +${s.appended} rows (${s.lineCountBefore} → ${s.lineCountAfter} lines)`).join('\n')}
`;

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, body, 'utf8');
  console.log(`[backfill-turn-artifact-dirs] mode=${dryRun ? 'dry-run' : 'apply'} planned=${totalPlanned} applied=${totalApplied}`);
  console.log(`[backfill-turn-artifact-dirs] report → ${reportPath}`);
}

main().catch((error) => {
  console.error('[backfill-turn-artifact-dirs] FAIL:', error);
  process.exit(1);
});
