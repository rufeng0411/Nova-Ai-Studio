/**
 * PD-SAAS-FORK: Gateway live replay for 0717 four-line acceptance cases.
 */
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { FOUR_LINE_0717_LIVE_CASES } from './0717FourLineLiveCases.mjs';
import { compose0717LiveExportHtml } from './compose0717LiveExportHtml.mjs';
import {
  computeFourLineExportKpis,
  parseExportHtmlFourLine,
} from './parseExportHtmlFourLine.mjs';
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

const SERVER_URL = process.env.SERVER_URL || process.env.PLAYWRIGHT_SERVER_URL || 'http://127.0.0.1:7990';

async function probe(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.status > 0 && res.status < 500;
  } catch {
    return false;
  }
}

export async function probe0717LiveStack() {
  const bridgeReady = await probe(`${SERVER_URL}/api/saas/health/ready`)
    || await probe(`${SERVER_URL}/api/saas/health`)
    || await probe(`${SERVER_URL}/api/health`);
  let gatewayReady = false;
  try {
    const ws = await connectGateway({ clientName: '0717-live-probe' });
    gatewayReady = true;
    closeGateway(ws);
  } catch {
    gatewayReady = false;
  }
  return { bridgeReady, gatewayReady, serverUrl: SERVER_URL };
}

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

async function waitForAcceptanceMeta(token, sessionId, projectName = 'general') {
  const deadline = Date.now() + 120_000;
  let last = null;
  while (Date.now() < deadline) {
    last = await fetchSessionMessages(token, sessionId, projectName);
    const meta = last.json?.latestTurnAcceptanceMeta;
    if (meta?.acceptanceCertificate || meta?.acceptanceStatus) return last;
    await delay(2000);
  }
  return last;
}

async function fetchTaskFolderSnapshot(token, projectName, scopeDir, slotsJson) {
  const qs = new URLSearchParams({
    scopeDir,
    ...(slotsJson ? { slotsJson: JSON.stringify(slotsJson) } : {}),
  });
  return apiJson(
    `${SERVER_URL}/api/projects/${encodeURIComponent(projectName)}/deliverables/task-folder-snapshot?${qs}`,
    { token },
  );
}

function certificateRows(certificate) {
  if (!certificate?.slots?.length) return [];
  return certificate.slots.map((slot) => ({
    label: slot.label ?? slot.slotId,
    typeLabel: slot.kind ?? '—',
    statusLabel: slot.status === 'done' ? '已交付' : slot.status === 'missing' ? '未完成' : '校验中…',
    pathText: slot.resolvedPath ?? slot.resolvedPaths?.[0] ?? '—',
  }));
}

function buildCaseArtifacts({
  caseId,
  spec,
  sessionKey,
  sessionId,
  turnResult,
  messagesEnvelope,
  snapshotEnvelope,
}) {
  const certificate = messagesEnvelope?.latestTurnAcceptanceMeta?.acceptanceCertificate
    ?? messagesEnvelope?.latestTurnAcceptanceMeta?.acceptanceCertificateV2
    ?? null;
  const completionState = certificate?.completionState
    ?? (turnResult.acceptanceStatus === 'passed' ? 'complete' : 'incomplete');
  const deliverableRows = certificateRows(certificate);
  const folderFiles = snapshotEnvelope?.files ?? snapshotEnvelope?.items ?? [];
  const exportBase = {
    sessionId,
    title: `${spec.label} · ${caseId}`,
    contractHash: certificate?.contractHash ?? null,
    certificate,
    snapshotEnvelope,
    deliverableRows,
    folderFiles,
    completionState,
    snapshotBanner: completionState === 'complete' ? '终态快照' : '进行中快照',
  };

  const archiveHtml = compose0717LiveExportHtml({ ...exportBase, mode: 'user_archive' });
  const diagnosticHtml = compose0717LiveExportHtml({ ...exportBase, mode: 'diagnostic' });
  const archiveParsed = parseExportHtmlFourLine(archiveHtml);
  const diagnosticParsed = parseExportHtmlFourLine(diagnosticHtml);
  const kpis = computeFourLineExportKpis(archiveParsed);

  if (spec.expectSnapshotInconclusive && snapshotEnvelope?.truncated) {
    kpis.snapshot_inconclusive = 1;
  }

  return {
    caseId,
    label: spec.label,
    sessionKey,
    sessionId,
    turnId: messagesEnvelope?.latestTurnAcceptanceMeta?.turnId ?? null,
    turnResult: {
      ok: turnResult.ok,
      turnCompleted: turnResult.turnCompleted,
      timeout: turnResult.timeout,
      durationMs: turnResult.durationMs,
      recoveryAttempts: turnResult.recoveryAttempts,
      acceptanceStatus: turnResult.acceptanceStatus,
      toolWritePaths: turnResult.toolWritePaths ?? [],
    },
    certificate,
    snapshotEnvelope,
    latestTurnAcceptanceMeta: messagesEnvelope?.latestTurnAcceptanceMeta ?? null,
    kpis,
    archiveParsed: {
      contractHash: archiveParsed.contractHash,
      kpis: archiveParsed.kpis,
      snapshotCompleteness: archiveParsed.snapshotCompleteness,
    },
    diagnosticParsed: {
      contractHash: diagnosticParsed.contractHash,
      kpis: diagnosticParsed.kpis,
    },
    archiveHtml,
    diagnosticHtml,
  };
}

export function evaluateCaseGate(caseId, spec, artifacts) {
  const reasons = [];
  if (!artifacts.turnResult.turnCompleted) {
    reasons.push('turn_not_completed');
  }
  if (artifacts.turnResult.timeout) {
    reasons.push('turn_timeout');
  }
  for (const kpi of spec.forbidKpis ?? []) {
    const value = artifacts.kpis[kpi] ?? 0;
    if (value > 0) reasons.push(`forbidden_kpi:${kpi}=${value}`);
  }
  const cert = artifacts.certificate;
  if (cert && spec.requiredSlots > 0) {
    const requiredTotal = cert.requiredTotal ?? spec.requiredSlots;
    const requiredDone = cert.requiredDone ?? 0;
    if (requiredDone < requiredTotal && artifacts.turnResult.acceptanceStatus === 'passed') {
      reasons.push(`false_complete:${requiredDone}/${requiredTotal}`);
    }
  }
  return {
    pass: reasons.length === 0,
    reasons,
  };
}

/**
 * @param {{ caseIds: string[], outDir: string, projectKey?: string }} opts
 */
export async function run0717FourLineLiveGateway(opts) {
  const { caseIds, outDir } = opts;
  const projectKey = opts.projectKey || 'general';
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, 'cases'), { recursive: true });

  const stack = await probe0717LiveStack();
  if (!stack.bridgeReady || !stack.gatewayReady) {
    return {
      ok: false,
      skipped: true,
      reason: `live stack unavailable bridge=${stack.bridgeReady} gateway=${stack.gatewayReady}`,
      stack,
      cases: [],
    };
  }

  const token = await fetchSaasAuthToken(SERVER_URL);
  if (!token) {
    return {
      ok: false,
      skipped: true,
      reason: 'admin login failed',
      stack,
      cases: [],
    };
  }

  const workspaceCwd = await resolveGeneralWorkspaceCwd({ serverUrl: SERVER_URL, token });
  if (!workspaceCwd) {
    return {
      ok: false,
      skipped: true,
      reason: 'general workspace cwd missing',
      stack,
      cases: [],
    };
  }

  const kpiPath = path.join(outDir, 'kpi-live.jsonl');
  if (fs.existsSync(kpiPath)) fs.unlinkSync(kpiPath);

  const ws = await connectGateway({ clientName: '0717-four-line-live' });
  const rows = [];

  try {
    for (const caseId of caseIds) {
      const spec = FOUR_LINE_0717_LIVE_CASES[caseId];
      if (!spec) {
        rows.push({ caseId, ok: false, error: 'unknown_case' });
        continue;
      }

      console.log(`[0717-live] ▶ ${caseId} ${spec.label}`);
      const caseDir = path.join(outDir, 'cases', caseId);
      fs.mkdirSync(caseDir, { recursive: true });

      let turnResult;
      let sessionKey;
      try {
        sessionKey = await newSession(ws, projectKey);
        turnResult = await submitTurn(ws, {
          sessionKey,
          projectKey,
          workspaceCwd,
          message: spec.message,
          tag: caseId,
          timeoutMs: spec.timeoutMs,
          maxTurns: spec.maxTurns,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        rows.push({ caseId, ok: false, error: message });
        fs.writeFileSync(path.join(caseDir, 'error.json'), `${JSON.stringify({ error: message }, null, 2)}\n`);
        continue;
      }

      const bridge = await bridgeCliSessionToCatalog({ sessionKey, projectName: projectKey }).catch(() => null);
      const sessionId = bridge?.sessionId ?? sessionKey;
      const messagesRes = await waitForAcceptanceMeta(token, sessionId, projectKey);
      const manifest = messagesRes?.json?.sessionDeliverableManifest;
      const scopeDir = messagesRes?.json?.sessionTaskDirectory?.taskArtifactDir
        ?? manifest?.taskArtifactDir
        ?? null;
      const snapshotRes = scopeDir
        ? await fetchTaskFolderSnapshot(token, projectKey, scopeDir, manifest?.slots)
        : { ok: false, json: null };

      const artifacts = buildCaseArtifacts({
        caseId,
        spec,
        sessionKey,
        sessionId,
        turnResult,
        messagesEnvelope: messagesRes?.json ?? {},
        snapshotEnvelope: snapshotRes?.json ?? null,
      });

      fs.writeFileSync(path.join(caseDir, 'turn-result.json'), `${JSON.stringify(artifacts.turnResult, null, 2)}\n`);
      fs.writeFileSync(path.join(caseDir, 'certificate.json'), `${JSON.stringify(artifacts.certificate, null, 2)}\n`);
      fs.writeFileSync(path.join(caseDir, 'snapshot.json'), `${JSON.stringify(artifacts.snapshotEnvelope, null, 2)}\n`);
      fs.writeFileSync(path.join(caseDir, 'archive.html'), artifacts.archiveHtml, 'utf8');
      fs.writeFileSync(path.join(caseDir, 'diagnostic.html'), artifacts.diagnosticHtml, 'utf8');
      fs.writeFileSync(path.join(caseDir, 'kpis.json'), `${JSON.stringify(artifacts.kpis, null, 2)}\n`);

      const gate = evaluateCaseGate(caseId, spec, artifacts);
      const row = {
        caseId,
        label: spec.label,
        sessionKey,
        sessionId,
        turnId: artifacts.turnId,
        ok: gate.pass,
        gate,
        kpis: artifacts.kpis,
        durationMs: turnResult.durationMs,
      };
      rows.push(row);
      fs.appendFileSync(kpiPath, `${JSON.stringify({ ...row, at: new Date().toISOString() })}\n`);

      console.log(
        `[0717-live] ${caseId} ${gate.pass ? 'PASS' : 'FAIL'} `
        + `${Math.round((turnResult.durationMs || 0) / 1000)}s `
        + `${gate.reasons.join(', ') || 'ok'}`,
      );

      await delay(3000);
    }
  } finally {
    closeGateway(ws);
  }

  const passCount = rows.filter((row) => row.ok).length;
  return {
    ok: passCount === caseIds.length && rows.length === caseIds.length,
    skipped: false,
    stack,
    workspaceCwd,
    passCount,
    total: caseIds.length,
    cases: rows,
    kpiPath,
  };
}
