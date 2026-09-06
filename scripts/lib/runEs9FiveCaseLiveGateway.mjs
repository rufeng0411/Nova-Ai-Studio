/**
 * PD-SAAS-FORK: Gateway live replay for ES9 five-case acceptance (incl. four-format L3).
 */
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { ES9_FIVE_CASE_LIVE_CASES } from './es9FiveCaseLiveCases.mjs';
import { bridgeCliSessionToCatalog } from './bridgeCliSessionCatalog.mjs';
import {
  closeGateway,
  connectGateway,
  newSession,
  submitTurn,
  submitTurnSequence,
} from './gatewaySessionHarness.mjs';
import {
  fetchSaasAuthToken,
  resolveGeneralWorkspaceCwd,
} from './resolveGeneralWorkspaceCwd.mjs';
import {
  probe0717LiveStack,
  evaluateCaseGate,
} from './run0717FourLineLiveGateway.mjs';
import { compose0717LiveExportHtml } from './compose0717LiveExportHtml.mjs';
import {
  computeFourLineExportKpis,
  parseExportHtmlFourLine,
} from './parseExportHtmlFourLine.mjs';

const SERVER_URL = process.env.SERVER_URL || process.env.PLAYWRIGHT_SERVER_URL || 'http://127.0.0.1:7990';

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

async function waitForAcceptanceMeta(token, sessionId, projectName, waitMs = 120_000) {
  const deadline = Date.now() + waitMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await fetchSessionMessages(token, sessionId, projectName);
    const meta = last.json?.latestTurnAcceptanceMeta;
    if (meta?.acceptanceCertificate || meta?.acceptanceStatus) return last;
    await delay(2000);
  }
  return last;
}

function basenameSetFromArtifacts(snapshotEnvelope, certificate, toolWritePaths = []) {
  const paths = new Set([
    ...toolWritePaths,
    ...(certificate?.slots ?? []).flatMap((s) => [
      s.resolvedPath,
      ...(s.resolvedPaths ?? []),
    ].filter(Boolean)),
    ...(snapshotEnvelope?.files ?? snapshotEnvelope?.items ?? [])
      .map((f) => f.path ?? f.apiPath ?? f.name),
  ].filter(Boolean).map((p) => path.basename(String(p).replace(/\\/g, '/'))));
  return paths;
}

function missingRequiredBasenames(spec, basenameSet) {
  if (!spec.requiredBasenames?.length) return [];
  return spec.requiredBasenames.filter(
    (basename) => ![...basenameSet].some((p) => p === basename || p.endsWith(`/${basename}`)),
  );
}

/** Poll Bridge until deliverables settle or wall timeout (handles auto-continue after early submitTurn final). */
async function pollDeliverableSession({
  token,
  sessionId,
  projectKey,
  spec,
  turnResult,
  startedAtMs,
}) {
  const deadline = startedAtMs + (spec.timeoutMs ?? 2_400_000);
  let lastMessages = null;
  let lastSnapshot = null;
  let scopeDir = null;
  let manifest = null;

  while (Date.now() < deadline) {
    lastMessages = await fetchSessionMessages(token, sessionId, projectKey);
    manifest = lastMessages?.json?.sessionDeliverableManifest ?? manifest;
    scopeDir = lastMessages?.json?.sessionTaskDirectory?.taskArtifactDir
      ?? manifest?.taskArtifactDir
      ?? scopeDir;

    if (scopeDir) {
      lastSnapshot = await fetchTaskFolderSnapshot(token, projectKey, scopeDir, manifest?.slots);
    }

    const certificate = lastMessages?.json?.latestTurnAcceptanceMeta?.acceptanceCertificate
      ?? lastMessages?.json?.latestTurnAcceptanceMeta?.acceptanceCertificateV2
      ?? null;
    const basenames = basenameSetFromArtifacts(
      lastSnapshot?.json,
      certificate,
      turnResult.toolWritePaths ?? [],
    );
    const missing = missingRequiredBasenames(spec, basenames);
    const acceptanceStatus = lastMessages?.json?.latestTurnAcceptanceMeta?.acceptanceStatus
      ?? turnResult.acceptanceStatus;
    const executionStatus = lastMessages?.json?.executionStatus
      ?? lastMessages?.json?.sessionExecutionStatus;

    if (missing.length === 0 && spec.requiredBasenames?.length) {
      return { messagesRes: lastMessages, snapshotRes: lastSnapshot, settled: true, missing };
    }
    if (acceptanceStatus === 'passed' && missing.length === 0) {
      return { messagesRes: lastMessages, snapshotRes: lastSnapshot, settled: true, missing };
    }
    if (executionStatus && !['running', 'queued'].includes(String(executionStatus)) && missing.length === 0) {
      return { messagesRes: lastMessages, snapshotRes: lastSnapshot, settled: true, missing };
    }

    await delay(15_000);
  }

  const certificate = lastMessages?.json?.latestTurnAcceptanceMeta?.acceptanceCertificate ?? null;
  const basenames = basenameSetFromArtifacts(lastSnapshot?.json, certificate, turnResult.toolWritePaths ?? []);
  return {
    messagesRes: lastMessages,
    snapshotRes: lastSnapshot,
    settled: false,
    missing: missingRequiredBasenames(spec, basenames),
  };
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
    },
    diagnosticParsed: {
      contractHash: diagnosticParsed.contractHash,
      kpis: diagnosticParsed.kpis,
    },
    archiveHtml,
    diagnosticHtml,
  };
}

function evaluateEs9CaseGate(caseId, spec, artifacts) {
  const base = evaluateCaseGate(caseId, spec, artifacts);
  const reasons = [...base.reasons];

  const writeCount = artifacts.turnResult.toolWritePaths?.length ?? 0;
  if (writeCount === 0 && !artifacts.turnResult.timeout && !artifacts.turnResult.pollSettled) {
    reasons.push('empty_turn_no_tool_writes');
  }
  if (artifacts.turnResult.pollMissing?.length) {
    for (const basename of artifacts.turnResult.pollMissing) {
      if (!reasons.includes(`missing_basename:${basename}`)) {
        reasons.push(`missing_basename:${basename}`);
      }
    }
  }

  if (spec.requiredBasenames?.length) {
    const paths = new Set([
      ...(artifacts.turnResult.toolWritePaths ?? []),
      ...(artifacts.certificate?.slots ?? []).flatMap((s) => [
        s.resolvedPath,
        ...(s.resolvedPaths ?? []),
      ].filter(Boolean)),
      ...(artifacts.snapshotEnvelope?.files ?? artifacts.snapshotEnvelope?.items ?? [])
        .map((f) => f.path ?? f.apiPath ?? f.name),
    ].filter(Boolean).map((p) => path.basename(String(p).replace(/\\/g, '/'))));

    for (const basename of spec.requiredBasenames) {
      const found = [...paths].some((p) => path.basename(p) === basename || p.endsWith(`/${basename}`));
      if (!found) reasons.push(`missing_basename:${basename}`);
    }
  }

  const actionableKpis = ['hash_mismatch', 'slot_collision', 'literal_placeholder_path'];
  for (const kpi of actionableKpis) {
    if ((artifacts.kpis[kpi] ?? 0) > 0) {
      reasons.push(`four_line_kpi:${kpi}=${artifacts.kpis[kpi]}`);
    }
  }

  return { pass: reasons.length === 0, reasons };
}

/**
 * @param {{ caseIds: string[], outDir: string, projectKey?: string }} opts
 */
export async function runEs9FiveCaseLiveGateway(opts) {
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
    return { ok: false, skipped: true, reason: 'admin login failed', stack, cases: [] };
  }

  const workspaceCwd = await resolveGeneralWorkspaceCwd({ serverUrl: SERVER_URL, token });
  if (!workspaceCwd) {
    return { ok: false, skipped: true, reason: 'general workspace cwd missing', stack, cases: [] };
  }

  const kpiPath = path.join(outDir, 'kpi-live.jsonl');
  if (fs.existsSync(kpiPath)) fs.unlinkSync(kpiPath);

  const ws = await connectGateway({ clientName: 'es9-five-case-live' });
  const rows = [];

  try {
    for (const caseId of caseIds) {
      const spec = ES9_FIVE_CASE_LIVE_CASES[caseId];
      if (!spec) {
        rows.push({ caseId, ok: false, error: 'unknown_case' });
        continue;
      }

      console.log(`[es9-live] ▶ ${caseId} ${spec.label}`);
      const caseDir = path.join(outDir, 'cases', caseId);
      fs.mkdirSync(caseDir, { recursive: true });

      const caseStartedAt = Date.now();
      let turnResult;
      let sessionKey;
      try {
        sessionKey = await newSession(ws, projectKey);
        const turnMessages = [spec.message];
        const seqResults = await submitTurnSequence(ws, {
          sessionKey,
          projectKey,
          workspaceCwd,
          messages: turnMessages,
          tag: caseId,
          timeoutMs: spec.timeoutMs,
          maxTurns: spec.maxTurns,
        });
        turnResult = seqResults[seqResults.length - 1] ?? seqResults[0];
        const prefBlocked = seqResults.length === 1
          && (turnResult?.toolWritePaths?.length ?? 0) === 0
          && /(?:页数|直接开始做|补充主题)/u.test(String(turnResult?.assistantText ?? ''));
        if (prefBlocked) {
          const followUp = await submitTurn(ws, {
            sessionKey,
            projectKey,
            workspaceCwd,
            message: '直接开始做',
            tag: `${caseId}-continue`,
            timeoutMs: spec.timeoutMs,
            maxTurns: spec.maxTurns,
          });
          turnResult = {
            ...followUp,
            toolWritePaths: [
              ...(turnResult?.toolWritePaths ?? []),
              ...(followUp.toolWritePaths ?? []),
            ],
            durationMs: (turnResult?.durationMs ?? 0) + (followUp.durationMs ?? 0),
            recoveryAttempts: (turnResult?.recoveryAttempts ?? 0) + (followUp.recoveryAttempts ?? 0),
          };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        rows.push({ caseId, ok: false, error: message });
        fs.writeFileSync(path.join(caseDir, 'error.json'), `${JSON.stringify({ error: message }, null, 2)}\n`);
        continue;
      }

      const bridge = await bridgeCliSessionToCatalog({ sessionKey, projectName: projectKey }).catch(() => null);
      const sessionId = bridge?.sessionId ?? sessionKey;

      const polled = await pollDeliverableSession({
        token,
        sessionId,
        projectKey,
        spec,
        turnResult,
        startedAtMs: caseStartedAt,
      });
      const messagesRes = polled.messagesRes ?? await waitForAcceptanceMeta(
        token,
        sessionId,
        projectKey,
        spec.waitAcceptanceMs ?? 120_000,
      );
      const snapshotRes = polled.snapshotRes ?? { ok: false, json: null };

      turnResult = {
        ...turnResult,
        durationMs: Date.now() - caseStartedAt,
        pollSettled: polled.settled,
        pollMissing: polled.missing ?? [],
      };

      const artifacts = buildCaseArtifacts({
        caseId,
        spec,
        sessionKey,
        sessionId,
        turnResult,
        messagesEnvelope: messagesRes?.json ?? {},
        snapshotEnvelope: snapshotRes?.json ?? null,
      });

      fs.writeFileSync(path.join(caseDir, 'turn-result.json'), `${JSON.stringify({
        ...artifacts.turnResult,
        toolCalls: turnResult.toolCalls ?? {},
        assistantTextLen: (turnResult.assistantText ?? '').length,
        finishReason: turnResult.finishReason ?? turnResult.stopReason ?? null,
        resolvedBy: turnResult.resolvedBy ?? null,
      }, null, 2)}\n`);
      fs.writeFileSync(path.join(caseDir, 'certificate.json'), `${JSON.stringify(artifacts.certificate, null, 2)}\n`);
      fs.writeFileSync(path.join(caseDir, 'archive.html'), artifacts.archiveHtml, 'utf8');
      fs.writeFileSync(path.join(caseDir, 'diagnostic.html'), artifacts.diagnosticHtml, 'utf8');
      fs.writeFileSync(path.join(caseDir, 'kpis.json'), `${JSON.stringify(artifacts.kpis, null, 2)}\n`);

      const gate = evaluateEs9CaseGate(caseId, spec, artifacts);
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
        `[es9-live] ${caseId} ${gate.pass ? 'PASS' : 'FAIL'} `
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
