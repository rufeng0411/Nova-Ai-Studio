/**
 * PD-SAAS-FORK: Parse engine-truth KPIs from CLI session JSONL (three-case speed RCA).
 */
import fs from 'node:fs';
import path from 'node:path';
import { normalizeSessionId } from '../../ui/server/saas/conversation/normalizeSessionId.js';
import { sessionTranscriptBasenames } from '../../ui/server/saas/conversation/resolveSessionTranscriptPath.js';
import { getTenantPilotHome } from '../../ui/server/saas/tenant/paths.js';
import { resolvePilotHome } from '../../ui/server/utils/pilotPaths.js';

/**
 * @param {string} sessionKeyOrId
 * @param {{ tenantId?: string }} [opts]
 * @returns {string | null}
 */
export function findTranscriptAbsPath(sessionKeyOrId, opts = {}) {
  const sessionId = normalizeSessionId(sessionKeyOrId);
  if (!sessionId) return null;

  const tenantId = opts.tenantId || 'default';
  const pilotHomes = [getTenantPilotHome(tenantId)];
  const globalPilotHome = resolvePilotHome(process.env);
  if (tenantId === 'default' && !pilotHomes.includes(globalPilotHome)) {
    pilotHomes.push(globalPilotHome);
  }
  const basenameCandidates = sessionTranscriptBasenames(sessionId);

  for (const pilotHome of pilotHomes) {
    const projectsRoot = path.join(pilotHome, 'projects');
    if (!fs.existsSync(projectsRoot)) continue;
    for (const entry of fs.readdirSync(projectsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const chatsDir = path.join(projectsRoot, entry.name, 'chats');
      for (const base of basenameCandidates) {
        const candidate = path.join(chatsDir, `${base}.jsonl`);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }
  return null;
}

/**
 * @param {string} transcriptAbsPath
 * @param {{ toolCalls?: Record<string, number> }} [turnResult]
 */
export function parseEngineTruthFromJsonl(transcriptAbsPath, turnResult = {}) {
  if (!transcriptAbsPath || !fs.existsSync(transcriptAbsPath)) {
    return {
      source: 'jsonl',
      transcriptPath: transcriptAbsPath ?? null,
      firstWriteFileMs: null,
      repairCount: 0,
      tmpWorkspaceCount: 0,
      footerProgress: { done: 0, total: 0 },
      subagentCount: 0,
      passed: false,
      writePathCount: 0,
      acceptanceStatus: null,
      verifiedCount: 0,
      writes: [],
    };
  }

  const lines = fs.readFileSync(transcriptAbsPath, 'utf8').trim().split('\n').filter(Boolean);
  /** @type {Record<string, unknown>[]} */
  const rows = [];
  for (const line of lines) {
    try {
      rows.push(JSON.parse(line));
    } catch {
      // skip malformed
    }
  }

  let turnStartMs = null;
  let firstWriteFileMs = null;
  let repairCount = 0;
  let subagentCount = 0;
  let tmpWorkspaceCount = 0;
  /** @type {{ relMs: number; path: string }[]} */
  const writes = [];
  /** @type {Record<string, unknown> | null} */
  let finalMeta = null;
  /** @type {Record<string, unknown> | null} */
  let latestManifest = null;
  let acceptanceStatus = null;

  for (const row of rows) {
    const ts = Date.parse(String(row.createdAt ?? ''));
    if (turnStartMs == null && Number.isFinite(ts)) turnStartMs = ts;
    if (row.type === 'session_deliverable_manifest' && row.manifest?.slots) {
      latestManifest = /** @type {Record<string, unknown>} */ (row.manifest);
    }
    if (row.type === 'turn_acceptance_meta') {
      if (row.finality === 'final' || !finalMeta) {
        finalMeta = row;
      }
      if (row.finality === 'final') {
        acceptanceStatus = row.acceptanceStatus ?? null;
      }
    }

    const synthetic = row.message?.metadata?.synthetic === true;
    const msgText = JSON.stringify(row.message ?? row);
    if (synthetic && /deliverable_repair|验收未通过|task-resume/i.test(msgText)) {
      repairCount += 1;
    }
    if (/tmp_workspace/i.test(msgText)) tmpWorkspaceCount += 1;

    const content = row.message?.content;
    if (Array.isArray(content) && Number.isFinite(ts) && turnStartMs != null) {
      for (const part of content) {
        if (!part || typeof part !== 'object') continue;
        if (part.type === 'tool_call') {
          const name = part.name || '';
          if (name === 'agent' || name === 'Task') subagentCount += 1;
          if (name === 'write_file') {
            const writePath = part.input?.file_path || part.input?.path || '';
            const relMs = ts - turnStartMs;
            if (firstWriteFileMs == null) firstWriteFileMs = relMs;
            writes.push({ relMs, path: String(writePath) });
          }
        }
      }
    }
  }

  for (const tool of Object.keys(turnResult.toolCalls ?? {})) {
    if (tool === 'agent' || tool === 'Task') {
      subagentCount += turnResult.toolCalls[tool] ?? 0;
    }
  }

  const slots = (latestManifest?.slots ?? []).filter((s) => s.status !== 'removed');
  const total = slots.length;
  let done = slots.filter((s) => s.status === 'done').length;
  const verifiedPaths = finalMeta?.verifiedPaths ?? [];
  if (Array.isArray(verifiedPaths) && verifiedPaths.length > 0) {
    done = verifiedPaths.length;
  } else if (finalMeta?.slotBindings) {
    done = finalMeta.slotBindings.filter(
      (b) => b.status === 'verified' || b.status === 'passed',
    ).length;
  }

  const passed = acceptanceStatus === 'passed'
    || finalMeta?.acceptanceCertificate?.complete === true
    || finalMeta?.acceptanceStatus === 'passed';

  return {
    source: 'jsonl',
    transcriptPath: transcriptAbsPath,
    firstWriteFileMs,
    repairCount,
    tmpWorkspaceCount,
    footerProgress: { done, total },
    subagentCount,
    passed,
    writePathCount: writes.length,
    acceptanceStatus,
    verifiedCount: Array.isArray(verifiedPaths) ? verifiedPaths.length : done,
    writes,
  };
}
