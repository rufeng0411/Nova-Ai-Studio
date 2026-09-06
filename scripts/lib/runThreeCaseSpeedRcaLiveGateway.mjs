/**
 * PD-SAAS-FORK: Gateway live harness for three-case speed RCA (2026-07-26).
 */
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import {
  THREE_CASE_SPEED_RCA_CASE_IDS,
  THREE_CASE_SPEED_RCA_LIVE_CASES,
} from './threeCaseSpeedRcaLiveCases.mjs';
import { bridgeCliSessionToCatalog } from './bridgeCliSessionCatalog.mjs';
import {
  closeGateway,
  connectGateway,
  newSession,
  submitTurn,
} from './gatewaySessionHarness.mjs';
import {
  fetchSaasAuthToken,
  resolveGeneralWorkspaceCwd,
} from './resolveGeneralWorkspaceCwd.mjs';
import { resolveLiveTimeout } from './resolveLiveTimeout.mjs';
import {
  findTranscriptAbsPath,
  parseEngineTruthFromJsonl,
} from './threeCaseSpeedRcaJsonlKpi.mjs';
import { evaluateThreeCaseGate } from './threeCaseSpeedRcaGate.mjs';

const SERVER_URL = process.env.SERVER_URL || process.env.PLAYWRIGHT_SERVER_URL || 'http://127.0.0.1:7990';

/**
 * @typedef {{
 *   caseId: string;
 *   label: string;
 *   goal: string;
 *   capabilitySlug?: string;
 *   gate: {
 *     firstWriteFileMs: number;
 *     repairCount: number;
 *     tmpWorkspaceCount: number;
 *     footerProgressMin: { done: number; total: number };
 *   };
 * }} ThreeCaseLiveSpec
 */

async function apiJson(url, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text?.slice(0, 400) };
  }
  return { status: res.status, ok: res.ok, json };
}

async function fetchSessionMessages(token, sessionId, projectName = 'general') {
  const qs = new URLSearchParams({ projectName, limit: '200', direction: 'backward' });
  return apiJson(
    `${SERVER_URL}/api/sessions/${encodeURIComponent(sessionId)}/messages?${qs}`,
    { token },
  );
}

function countSdmProgress(envelope) {
  const manifest = envelope?.sessionDeliverableManifest;
  const meta = envelope?.latestTurnAcceptanceMeta;
  const slots = manifest?.slots?.filter((s) => s.status !== 'removed') ?? [];
  const total = slots.length;
  const bindings = meta?.slotBindings ?? meta?.acceptanceCertificate?.slots ?? [];
  const done = bindings.filter((b) => b.status === 'verified' || b.status === 'passed').length;
  if (total > 0) return { done, total };
  const cert = meta?.acceptanceCertificate ?? meta?.acceptanceCertificateV2;
  if (cert?.complete && cert?.slotSummary) {
    return {
      done: cert.slotSummary.verified ?? cert.slotSummary.done ?? 0,
      total: cert.slotSummary.total ?? total,
    };
  }
  return { done: 0, total };
}

function scanMessageKpis(messagesEnvelope, turnResult, caseStartedAt) {
  const messages = messagesEnvelope?.messages ?? [];
  let repairCount = 0;
  let subagentCount = 0;
  let tmpWorkspaceCount = 0;
  let firstWriteFileMs = null;

  for (const msg of messages) {
    const meta = msg.metadata ?? {};
    if (meta.synthetic === true && /deliverable_repair|task-resume/i.test(String(msg.content ?? ''))) {
      repairCount += 1;
    }
    const content = JSON.stringify(msg);
    if (/tmp_workspace/i.test(content)) tmpWorkspaceCount += 1;
  }

  for (const tool of Object.keys(turnResult?.toolCalls ?? {})) {
    if (tool === 'agent' || tool === 'Task') subagentCount += turnResult.toolCalls[tool] ?? 0;
  }

  const writePaths = turnResult?.toolWritePaths ?? [];
  if (writePaths.length > 0) {
    firstWriteFileMs = turnResult.durationMs ?? (Date.now() - caseStartedAt);
  }

  const footerProgress = countSdmProgress(messagesEnvelope);
  const passed = messagesEnvelope?.latestTurnAcceptanceMeta?.acceptanceStatus === 'passed'
    || messagesEnvelope?.latestTurnAcceptanceMeta?.acceptanceCertificate?.complete === true;

  return {
    firstWriteFileMs,
    repairCount,
    tmpWorkspaceCount,
    footerProgress,
    subagentCount,
    passed,
    writePathCount: writePaths.length,
  };
}


/**
 * @param {{ caseIds?: string[]; outDir?: string }} opts
 */
export async function runThreeCaseSpeedRcaLiveGateway(opts = {}) {
  const caseIds = opts.caseIds?.length ? opts.caseIds : THREE_CASE_SPEED_RCA_CASE_IDS;
  const outDir = opts.outDir ?? path.join(process.cwd(), 'artifacts', 'three-case-speed-rca-20260726');
  fs.mkdirSync(outDir, { recursive: true });
  const kpiPath = path.join(outDir, 'kpi-live.jsonl');

  let token;
  try {
    token = await fetchSaasAuthToken(SERVER_URL);
  } catch (err) {
    return { ok: false, skipped: true, reason: err.message, cases: [] };
  }

  const workspaceCwd = await resolveGeneralWorkspaceCwd(SERVER_URL, token);
  const projectKey = 'general';
  let ws;
  const rows = [];

  try {
    ws = await connectGateway({ clientName: 'three-case-speed-rca-live' });
    for (const caseId of caseIds) {
      const spec = THREE_CASE_SPEED_RCA_LIVE_CASES[caseId];
      if (!spec) continue;
      const { timeoutMs, maxTurns } = resolveLiveTimeout({ caseId });
      const caseStartedAt = Date.now();
      const sessionKey = await newSession(ws, projectKey);
      await bridgeCliSessionToCatalog({
        serverUrl: SERVER_URL,
        token,
        sessionKey,
        projectKey,
        title: `[three-case-rca] ${spec.label}`,
      });

      const turnResult = await submitTurn(ws, {
        sessionKey,
        message: spec.goal,
        projectKey,
        workspaceCwd,
        timeoutMs,
        maxTurns,
        tag: caseId,
        capabilityContext: spec.capabilitySlug ? { slug: spec.capabilitySlug } : undefined,
      });

      const bridge = await bridgeCliSessionToCatalog({
        serverUrl: SERVER_URL,
        token,
        sessionKey,
        projectKey,
      });
      const sessionId = bridge?.sessionId ?? sessionKey;

      // Legacy Bridge messages API (often 404 for CLI sessions — kept for comparison only).
      let messagesRes = await fetchSessionMessages(token, sessionId, projectKey);
      const pollDeadline = caseStartedAt + Math.min(timeoutMs, 120_000);
      while (Date.now() < pollDeadline) {
        const meta = messagesRes?.json?.latestTurnAcceptanceMeta;
        if (meta?.acceptanceStatus === 'passed' || meta?.acceptanceCertificate?.complete) break;
        await delay(3000);
        messagesRes = await fetchSessionMessages(token, sessionId, projectKey);
      }
      const legacyApiKpis = scanMessageKpis(messagesRes?.json ?? {}, turnResult, caseStartedAt);
      const harnessGate = evaluateThreeCaseGate(caseId, spec, legacyApiKpis);

      const transcriptPath = findTranscriptAbsPath(sessionId);
      const engineTruth = parseEngineTruthFromJsonl(transcriptPath, turnResult);
      const engineGate = evaluateThreeCaseGate(caseId, spec, engineTruth);
      const row = {
        caseId,
        label: spec.label,
        sessionId,
        transcriptPath,
        ok: engineGate.pass,
        engineTruth,
        engineGate,
        harnessGate,
        legacyApiKpis,
        durationMs: Date.now() - caseStartedAt,
        turnOk: turnResult.ok,
      };
      rows.push(row);
      fs.appendFileSync(kpiPath, `${JSON.stringify({ ...row, at: new Date().toISOString() })}\n`);
      const fp = engineTruth.footerProgress ?? { done: 0, total: 0 };
      const hfp = legacyApiKpis.footerProgress ?? { done: 0, total: 0 };
      const fw = engineTruth.firstWriteFileMs != null
        ? `${Math.round(engineTruth.firstWriteFileMs / 1000)}s firstWrite`
        : 'no write';
      console.log(
        `[three-case-rca] ${caseId} engineTruth=${engineGate.pass ? 'PASS' : 'FAIL'} `
        + `footer ${fp.done}/${fp.total} ${fw} | `
        + `harnessGate=${harnessGate.pass ? 'PASS' : 'FAIL'} footer ${hfp.done}/${hfp.total} | `
        + `${Math.round(row.durationMs / 1000)}s ${engineGate.reasons.join(', ') || 'ok'}`,
      );
      await delay(2000);
    }
  } finally {
    if (ws) closeGateway(ws);
  }

  const passCount = rows.filter((r) => r.ok).length;
  return {
    ok: passCount === caseIds.length && rows.length === caseIds.length,
    skipped: false,
    passCount,
    total: caseIds.length,
    cases: rows,
    kpiPath,
    outDir,
  };
}

export { THREE_CASE_SPEED_RCA_CASE_IDS, THREE_CASE_SPEED_RCA_LIVE_CASES };
