/**
 * PD-SAAS-FORK: Append turn_deliverable_meta to session JSONL after turn_completed.
 */
import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { parseJsonlFile, isUnrecoverableTurn } from '../../../../scripts/lib/parseJsonlTurns.mjs';
import { inferTurnArtifactDirectory, inferTurnDirFromExplicitPaths } from '../../../../scripts/lib/inferTurnArtifactDirectory.mjs';
import {
  deliverableSearchRoots,
  resolveLegacyProjectRoot,
  validatePathsForAudit,
} from '../../../../scripts/lib/auditDeliverableContext.mjs';
import { resolveSessionTranscriptAbsPath } from '../conversation/resolveSessionTranscriptPath.js';
import { getSaasRequestContext } from '../context.js';
import { getTenantPilotHome } from '../tenant/paths.js';
import { createProjectId } from '../../utils/pilotPaths.js';
import { appendTranscriptEntriesLocked } from '../../../../src/session/transcript/lockedTranscriptAppend.ts';

const META_WRITE_RETRY_DELAYS_MS = [150, 500, 1000, 2000, 4000];

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** PD-SAAS-FORK: Gate — engine turn_acceptance_meta must not be overwritten by Bridge writer. */
export function shouldSkipBridgeDeliverableMetaWrite(input) {
  const turnId = String(input?.turnId ?? "");
  if (!turnId) return false;
  if (input.metaByTurnId?.has?.(turnId)) return true;
  if (input.acceptanceMetaByTurnId?.has?.(turnId)) return true;
  return false;
}

/**
 * @param {{ sessionKey: string, turnId?: string, projectKey?: string, projectName?: string }} input
 */
export async function scheduleTurnDeliverableMetaWrite(input) {
  if (process.env.PILOTDECK_TURN_DELIVERABLE_META === '0') {
    return;
  }
  const turnId = input.turnId;
  if (!input.sessionKey || !turnId) return;

  setImmediate(() => {
    void writeTurnDeliverableMetaWithRetry(input).catch((error) => {
      console.warn('[turn-deliverable-meta] write failed:', error?.message || error);
    });
  });
}

async function writeTurnDeliverableMetaWithRetry(input) {
  for (let attempt = 0; attempt < META_WRITE_RETRY_DELAYS_MS.length; attempt += 1) {
    const status = await writeTurnDeliverableMeta(input);
    if (status !== 'retry') return;
    await sleep(META_WRITE_RETRY_DELAYS_MS[attempt]);
  }
  await writeTurnDeliverableMeta(input);
}

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
  const toolItems = allItems.filter((item) => item.source === 'tool');
  const hintDir = inferTurnArtifactDirectory(toolItems) ?? inferTurnArtifactDirectory(allItems);
  if (!hintDir) return { hintDir: null, paths: [] };
  const paths = uniquePaths(
    allItems
      .map((item) => item.apiPath || item.path)
      .filter((filePath) => isPathInDir(filePath, hintDir)),
  );
  return { hintDir, paths };
}

function inferTurnHintDir(turn, cumulative) {
  const toolItems = (turn.deliverableItems ?? []).filter((item) => item.source === 'tool');
  const toolHint = inferTurnArtifactDirectory(toolItems);
  if (toolHint && /^artifacts\/task-/i.test(toolHint)) return toolHint;
  const explicitPaths = (turn.deliverableItems ?? [])
    .map((item) => item.apiPath || item.path)
    .filter(Boolean);
  return inferTurnArtifactDirectory(turn.deliverableItems)
    ?? cumulative.hintDir
    ?? inferTurnDirFromExplicitPaths(explicitPaths);
}

/**
 * @param {{ sessionKey: string, turnId?: string, projectKey?: string, projectName?: string }} input
 */
export async function writeTurnDeliverableMeta(input) {
  const ctx = getSaasRequestContext();
  const tenantId = ctx?.tenantId ?? 'default';
  const pilotHome = ctx?.tenantPilotHome ?? getTenantPilotHome(tenantId);
  const transcriptAbsPath = await resolveSessionTranscriptAbsPath({
    sessionId: input.sessionKey,
    tenantPilotHome: pilotHome,
    catalogTranscriptRel: null,
  });
  if (!transcriptAbsPath || !fs.existsSync(transcriptAbsPath)) {
    return 'missing_transcript';
  }

  const parsed = parseJsonlFile(transcriptAbsPath);
  if (shouldSkipBridgeDeliverableMetaWrite({
    turnId: input.turnId,
    metaByTurnId: parsed.metaByTurnId,
    acceptanceMetaByTurnId: parsed.acceptanceMetaByTurnId,
  })) {
    return parsed.acceptanceMetaByTurnId?.has(input.turnId) ? 'exists_acceptance' : 'exists';
  }

  const turn = parsed.turns.find((t) => t.turnId === input.turnId);
  if (!turn) return 'retry';

  const legacySlug = createProjectId(pilotHome);
  const projectRoot = resolveLegacyProjectRoot(tenantId, legacySlug);
  const knownRoots = deliverableSearchRoots(projectRoot, tenantId);

  const cumulative = buildCumulativeDeliverableSnapshot(parsed.turns, input.turnId);
  const hintDir = inferTurnHintDir(turn, cumulative);
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

  const alignmentStatus = isUnrecoverableTurn(turn) ? 'unrecoverable' : 'aligned';
  if (!hintDir && verifiedPaths.length === 0) {
    return 'empty';
  }

  let appendStatus = 'written';
  await appendTranscriptEntriesLocked(transcriptAbsPath, (state) => {
    const latestParsed = parseJsonlFile(transcriptAbsPath);
    if (shouldSkipBridgeDeliverableMetaWrite({
      turnId: input.turnId,
      metaByTurnId: latestParsed.metaByTurnId,
      acceptanceMetaByTurnId: latestParsed.acceptanceMetaByTurnId,
    })) {
      appendStatus = latestParsed.acceptanceMetaByTurnId?.has(input.turnId)
        ? 'exists_acceptance'
        : 'exists';
      return [];
    }
    const row = {
      type: 'turn_deliverable_meta',
      sessionId: turn.sessionId ?? input.sessionKey,
      turnId: input.turnId,
      sequence: state.nextSequence,
      createdAt: new Date().toISOString(),
      entryId: randomUUID(),
      turnArtifactDir: hintDir ?? undefined,
      verifiedPaths,
      alignmentStatus,
    };
    const latestSdm = readLatestSdmFromTranscript(transcriptAbsPath);
    const goalVersion = latestSdm?.goalVersion ?? 1;
    const ledgerRows = buildLedgerRows({
      row,
      tenantId,
      projectRoot,
      validation,
      goalVersion,
    });
    const acceptanceRow = buildAcceptanceMetaRow({
      row,
      turn,
      validation,
      panelPaths,
      maxSequence: row.sequence + ledgerRows.length,
    });
    const entries = [row];
    for (let index = 0; index < ledgerRows.length; index += 1) {
      entries.push({
        type: 'task_deliverable_ledger',
        sessionId: row.sessionId,
        turnId: row.turnId,
        sequence: row.sequence + index + 1,
        createdAt: row.createdAt,
        entryId: randomUUID(),
        record: ledgerRows[index],
      });
    }
    if (acceptanceRow) entries.push(acceptanceRow);
    return entries;
  });
  return appendStatus;
}

function basenameOf(filePath) {
  return String(filePath || '').replace(/\\/g, '/').split('/').pop() || undefined;
}

function mapValidationStatus(status, resolvedPath) {
  switch (status) {
    case 'verified':
      return 'verified';
    case 'pending':
      return resolvedPath ? 'verified' : 'missing';
    case 'phantom':
      return 'phantom';
    case 'broken':
    default:
      return 'broken';
  }
}

function readLatestSdmFromTranscript(transcriptAbsPath) {
  try {
    const body = fs.readFileSync(transcriptAbsPath, 'utf8');
    let latest = null;
    for (const line of body.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let row;
      try {
        row = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (row?.type === 'session_deliverable_manifest' && row.manifest) {
        latest = row.manifest;
      }
    }
    return latest;
  } catch {
    return null;
  }
}

function buildLedgerRows({ row, tenantId, projectRoot, validation, goalVersion = 1 }) {
  const items = validation.items ?? [];
  return items
    .map((item) => {
      const apiPath = normalizePanelPath(item.path);
      const resolvedPath = normalizePanelPath(item.resolvedPath || item.path);
      if (!apiPath && !resolvedPath) return null;
      const validationStatus = mapValidationStatus(item.status, item.resolvedPath);
      const displayable = validationStatus === 'verified';
      return {
        taskId: row.turnId,
        sessionId: row.sessionId,
        turnId: row.turnId,
        tenantId,
        workspaceRoot: projectRoot,
        goalVersion,
        apiPath: apiPath || resolvedPath,
        resolvedPath: resolvedPath || undefined,
        hintDir: row.turnArtifactDir,
        turnArtifactDir: row.turnArtifactDir,
        basename: basenameOf(resolvedPath || apiPath),
        previewKind: item.previewKind,
        sizeBytes: item.sizeBytes,
        source: 'meta_backfill',
        validationStatus,
        displayRole: displayable ? 'primary' : 'hidden',
        acceptanceRole: displayable ? 'required' : 'notApplicable',
        resolvedBy: item.resolvedPath && item.resolvedPath !== item.path ? 'hintDir' : 'exact',
      };
    })
    .filter(Boolean);
}

function buildExpectedManifestFromTurn(turn, hintDir, validation) {
  const items = validation.items ?? [];
  const slideManifest = items.find((item) => /slide-manifest\.json$/i.test(item.path || item.resolvedPath || ''));
  if (slideManifest && hintDir) {
    const pngItems = items.filter((item) => /\.png$/i.test(item.resolvedPath || item.path || ''));
    if (pngItems.length > 0) {
      return pngItems.map((item, idx) => ({
        id: `slide_page_${idx + 1}`,
        kind: 'png',
        path: item.resolvedPath || item.path,
        required: true,
      }));
    }
    return [{
      id: 'nova_slide_deck',
      kind: 'png',
      count: Math.max(1, items.filter((item) => /slide-\d+\.png$/i.test(item.path || '')).length),
      required: true,
    }];
  }
  const panelPaths = (turn.finalDeliverables ?? []).map((d) => d.apiPath || d.path).filter(Boolean);
  if (panelPaths.length > 0) {
    return panelPaths.map((filePath, idx) => ({
      id: `panel_${idx + 1}`,
      path: filePath,
      required: true,
    }));
  }
  return [];
}

function buildAcceptanceMetaRow({ row, turn, validation, panelPaths, maxSequence }) {
  if (process.env.PILOTDECK_TURN_ACCEPTANCE_META === '0') return null;
  const resolvedPathMap = {};
  for (const item of validation.items ?? []) {
    if (item.path && item.resolvedPath) resolvedPathMap[item.path] = item.resolvedPath;
  }
  const verifiedPaths = (validation.items ?? [])
    .filter((item) => item.status === 'verified' || (item.status === 'pending' && item.resolvedPath))
    .map((item) => item.resolvedPath || item.path)
    .filter(Boolean);
  const brokenPaths = (validation.items ?? [])
    .filter((item) => item.status === 'broken' || item.status === 'phantom')
    .map((item) => item.resolvedPath || item.path)
    .filter(Boolean);
  const missingPaths = (validation.items ?? [])
    .filter((item) => item.status === 'pending' && !item.resolvedPath)
    .map((item) => item.resolvedPath || item.path)
    .filter(Boolean);
  if (verifiedPaths.length === 0 && brokenPaths.length === 0 && missingPaths.length === 0) {
    return null;
  }
  const userGoalHash = createHash('sha1')
    .update(String(turn.assistantText ?? '').slice(0, 4096))
    .digest('hex')
    .slice(0, 12);
  return {
    type: 'turn_acceptance_meta',
    sessionId: row.sessionId,
    turnId: row.turnId,
    sequence: maxSequence + 1,
    createdAt: new Date().toISOString(),
    entryId: randomUUID(),
    userGoalHash,
    expectedManifest: buildExpectedManifestFromTurn(turn, row.turnArtifactDir, validation),
    verifiedPaths,
    missingPaths,
    brokenPaths,
    displayPaths: verifiedPaths.filter((filePath) => panelPaths.includes(filePath) || panelPaths.includes(Object.entries(resolvedPathMap).find(([, v]) => v === filePath)?.[0])),
    hiddenByPolicyPaths: [],
    turnArtifactDir: row.turnArtifactDir,
    resolvedPathMap,
    acceptanceStatus: brokenPaths.length > 0 || missingPaths.length > 0 ? 'needs_repair' : 'passed',
    // Disk-audit fallback only runs when engine did not write acceptance meta; terminal owner.
    continuationOwner: 'none',
  };
}
