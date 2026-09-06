/**
 * PD-SAAS-FORK: Scan transcript JSONL for zombie / dead-loop session signals.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseJsonlFile } from './parseJsonlTurns.mjs';

export const INTERVENTION_PATTERNS = [
  /继续/,
  /怎么又停/,
  /为什么停/,
  /不对/,
  /重来/,
  /没做完/,
  /为什么没有/,
];

export function walkTranscriptJsonl(dirs) {
  const out = [];
  for (const dir of dirs) {
    if (!dir || !fs.existsSync(dir)) continue;
    const stack = [dir];
    while (stack.length) {
      const cur = stack.pop();
      for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
        const full = path.join(cur, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else if (entry.name.endsWith('.jsonl') && full.includes(`${path.sep}chats${path.sep}`)) {
          out.push(full);
        }
      }
    }
  }
  return out;
}

export function sessionIdFromTranscriptPath(filePath) {
  const base = path.basename(filePath, '.jsonl');
  return base.startsWith('agent-') ? base.slice('agent-'.length) : base;
}

function isSyntheticUser(entry) {
  const meta = entry?.message?.metadata ?? entry?.messages?.[0]?.metadata;
  const purpose = meta?.purpose;
  if (meta?.synthetic || purpose === 'auto_continue' || purpose === 'tool_recovery' || purpose === 'deliverable_repair') {
    return true;
  }
  const text = textFromUser(entry);
  return /task-resume|<task-resume>/i.test(text);
}

function textFromUser(entry) {
  const msg = entry?.message ?? entry?.messages?.[0];
  if (!msg?.content) return '';
  if (typeof msg.content === 'string') return msg.content;
  if (!Array.isArray(msg.content)) return '';
  return msg.content.filter((b) => b?.type === 'text').map((b) => b.text).join('\n');
}

function countSignals(entries) {
  let synthetic = 0;
  let recoveryAttempt = 0;
  let turnAcceptance = 0;
  let renderHtmlVideoFails = 0;
  let interventions = 0;
  let repairCircuitTripped = false;
  let postTripSynthetic = 0;
  let tripIndex = -1;
  let manifestPresent = false;
  const gaps = new Map();

  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i];
    const type = e?.type ?? e?.event;

    if (type === 'session_deliverable_manifest' || e?.sessionDeliverableManifest) {
      manifestPresent = true;
      const circuit = e?.repairCircuit ?? e?.sessionDeliverableManifest?.repairCircuit;
      if (circuit?.tripped) {
        repairCircuitTripped = true;
        if (tripIndex < 0) tripIndex = i;
      }
    }

    if (type === 'turn_acceptance_snapshot' || type === 'turn_acceptance_meta') {
      turnAcceptance += 1;
    }

    if (type === 'recovery_attempt') recoveryAttempt += 1;

    if (e?.role === 'user' || e?.message?.role === 'user') {
      if (isSyntheticUser(e)) {
        synthetic += 1;
        if (tripIndex >= 0 && i > tripIndex) postTripSynthetic += 1;
      } else {
        const text = textFromUser(e);
        if (INTERVENTION_PATTERNS.some((re) => re.test(text))) interventions += 1;
      }
    }

    if (type === 'tool_result' || e?.message?.content) {
      const content = e?.message?.content ?? e?.content;
      const blocks = Array.isArray(content) ? content : [];
      for (const b of blocks) {
        if (b?.type === 'tool_result' && /render_html_video/i.test(String(b?.name || b?.tool_name || ''))) {
          const text = typeof b.content === 'string' ? b.content : JSON.stringify(b.content || '');
          if (/error|fail|exhausted/i.test(text)) renderHtmlVideoFails += 1;
        }
      }
    }

    if (type === 'deliverable_repair' || e?.metadata?.purpose === 'deliverable_repair') {
      const gap = e?.missingPaths?.[0] || e?.gap || 'unknown';
      gaps.set(gap, (gaps.get(gap) || 0) + 1);
    }
  }

  const gapEntries = [...gaps.entries()];
  const totalRepairs = gapEntries.reduce((s, [, c]) => s + c, 0);
  const gapRotation = gapEntries.length >= 3 && gapEntries.every(([, c]) => c < 3) && totalRepairs >= 6;

  return {
    synthetic,
    recoveryAttempt,
    turnAcceptance,
    renderHtmlVideoFails,
    interventions,
    repairCircuitTripped,
    postTripSynthetic,
    manifestPresent,
    gapRotation,
    totalRepairs,
    turnCount: entries.filter((e) => e?.type === 'turn_result' || e?.event === 'turn_completed').length,
  };
}

function lastTurnIncomplete(entries) {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const t = entries[i]?.type ?? entries[i]?.event;
    if (t === 'turn_result' || t === 'turn_completed') return false;
  }
  return entries.length > 0;
}

export function analyzeTranscriptFile(filePath, { catalogRows = null, tombstones = null } = {}) {
  const sessionId = sessionIdFromTranscriptPath(filePath);
  const stat = fs.statSync(filePath);
  const parsed = parseJsonlFile(filePath);
  const entries = parsed.entries ?? [];
  const signals = countSignals(entries);
  const risks = [];

  if (signals.synthetic > 20) {
    risks.push('synthetic_storm');
  } else if (signals.synthetic > 8) {
    risks.push('synthetic_high');
  }
  if (signals.repairCircuitTripped && signals.postTripSynthetic > 0) {
    risks.push('circuit_bypass');
  }
  if (lastTurnIncomplete(entries) && Date.now() - stat.mtimeMs < 24 * 3600 * 1000) {
    risks.push('cold_resume_candidate');
  }
  if (signals.interventions >= 2) risks.push('user_intervention');
  if (signals.gapRotation) risks.push('gap_rotation');
  if (signals.renderHtmlVideoFails >= 3) risks.push('video_tool_stuck');
  if (signals.turnAcceptance > 12) risks.push('acceptance_dense');

  const catalog = catalogRows?.get(sessionId) ?? null;
  const tombstoned = tombstones?.has(sessionId) ?? false;

  let deleteState = 'legacy';
  if (tombstoned) deleteState = 'tombstone';
  else if (catalog?.deletedAt) deleteState = 'soft-delete';
  else if (catalog) deleteState = 'catalog_active';
  else deleteState = 'orphan';

  if (deleteState === 'orphan' && risks.length > 0) {
    risks.push('orphan_transcript');
  }

  const estValidateCalls = signals.turnAcceptance + signals.synthetic * 2;

  return {
    sessionId,
    filePath,
    mtime: stat.mtime.toISOString(),
    deleteState,
    risks,
    ...signals,
    estValidateCalls,
    score: risks.length + Math.floor(signals.synthetic / 5),
  };
}

export function discoverTranscriptRoots(dataRoot) {
  const roots = [];
  const pilotHome = process.env.PILOT_HOME || path.join(os.homedir(), '.pilotdeck');
  const tenantsDir = path.join(dataRoot, 'tenants');
  if (fs.existsSync(tenantsDir)) {
    for (const tenant of fs.readdirSync(tenantsDir, { withFileTypes: true })) {
      if (!tenant.isDirectory()) continue;
      const projects = path.join(tenantsDir, tenant.name, 'projects');
      if (fs.existsSync(projects)) roots.push(projects);
    }
  }
  const legacy = path.join(pilotHome, 'projects');
  if (fs.existsSync(legacy)) roots.push(legacy);
  return roots;
}

export function readTelemetryCounts(telemetryDir) {
  const out = { ui_auto_continue: 0, cold_resume_fired: 0 };
  const files = ['recovery-events.jsonl', 'stability-events.jsonl'];
  for (const name of files) {
    const p = path.join(telemetryDir, name);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line);
        if (e.event === 'ui_auto_continue' || e.type === 'ui_auto_continue') out.ui_auto_continue += 1;
        if (/cold_resume/i.test(String(e.event || e.type || ''))) out.cold_resume_fired += 1;
      } catch { /* skip */ }
    }
  }
  return out;
}
