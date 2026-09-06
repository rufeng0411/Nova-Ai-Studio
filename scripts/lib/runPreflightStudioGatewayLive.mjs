/**
 * PD-SAAS-FORK: Gateway live harness for Preflight Studio L-OD / L-PPT delivery.
 */
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import {
  PREFLIGHT_GATEWAY_CASE_IDS,
  PREFLIGHT_GATEWAY_CASES,
} from './preflightStudioGatewayCases.mjs';
import {
  evaluatePreflightGatewayGate,
  parsePreflightGatewayKpis,
} from './preflightStudioGatewayKpi.mjs';
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
import { findTranscriptAbsPath, parseEngineTruthFromJsonl } from './threeCaseSpeedRcaJsonlKpi.mjs';
import { parseExportHtmlFourLine, computeFourLineExportKpis } from './parseExportHtmlFourLine.mjs';

const SERVER_URL = process.env.SERVER_URL || process.env.PLAYWRIGHT_SERVER_URL || 'http://127.0.0.1:7990';
const UI_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8081';

function resolveCaseTimeout(caseId) {
  const envKey = caseId === 'L-PPT-GW' ? 'PREFLIGHT_LIVE_PPT_TIMEOUT_MS' : 'PREFLIGHT_LIVE_OD_TIMEOUT_MS';
  const fromEnv = Number(process.env[envKey] ?? process.env.PREFLIGHT_GATEWAY_TIMEOUT_MS ?? '');
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return caseId === 'L-PPT-GW' ? 900_000 : 600_000;
}

async function exportSessionHtml(token, projectName, sessionId) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${UI_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((t) => localStorage.setItem('auth-token', t), token);
    const html = await page.evaluate(async ({ projectName: project, sessionId: session }) => {
      const mod = await import('/src/shared/exportSessionHtml.ts');
      const out = await mod.exportSessionToHtmlFile({
        project,
        session,
        labels: {},
        mode: 'user_archive',
      });
      return out?.html ?? '';
    }, { projectName, sessionId });
    return html;
  } finally {
    await browser.close();
  }
}

/**
 * @param {{ caseIds?: string[]; outDir?: string; skipHtmlExport?: boolean }} opts
 */
export async function runPreflightStudioGatewayLive(opts = {}) {
  const caseIds = opts.caseIds?.length ? opts.caseIds : PREFLIGHT_GATEWAY_CASE_IDS;
  const outDir = opts.outDir ?? path.join(process.cwd(), 'artifacts', 'preflight-studio-gateway-20260730');
  fs.mkdirSync(outDir, { recursive: true });
  const kpiPath = path.join(outDir, 'kpi-gateway.jsonl');

  const token = await fetchSaasAuthToken(SERVER_URL);
  if (!token) {
    return { ok: false, skipped: true, reason: 'Bridge auth failed', cases: [] };
  }

  const workspaceCwd = await resolveGeneralWorkspaceCwd({ serverUrl: SERVER_URL, token });
  const projectKey = 'general';
  let ws;
  /** @type {Record<string, unknown>[]} */
  const rows = [];

  try {
    ws = await connectGateway({ clientName: 'preflight-studio-gateway-live' });
    for (const caseId of caseIds) {
      const spec = PREFLIGHT_GATEWAY_CASES[caseId];
      if (!spec) continue;
      const timeoutMs = resolveCaseTimeout(caseId);
      const caseStartedAt = Date.now();
      const message = spec.buildMessage();
      const sessionKey = await newSession(ws, projectKey);
      await bridgeCliSessionToCatalog({
        sessionKey,
        projectKey,
        title: `[preflight-gw] ${spec.label}`,
      });

      const turnResult = await submitTurn(ws, {
        sessionKey,
        message,
        projectKey,
        workspaceCwd,
        timeoutMs,
        maxTurns: caseId === 'L-PPT-GW' ? 16 : 14,
        tag: caseId,
        capabilityContext: { slug: spec.capabilitySlug },
      });

      const bridge = await bridgeCliSessionToCatalog({
        sessionKey,
        projectKey,
      });
      const sessionId = bridge?.sessionId ?? sessionKey;
      const transcriptPath = findTranscriptAbsPath(sessionKey);
      const preflightKpis = parsePreflightGatewayKpis(transcriptPath);
      const engineTruth = parseEngineTruthFromJsonl(transcriptPath, turnResult);
      const gateEval = evaluatePreflightGatewayGate(spec.gate, preflightKpis);

      let fourLine = null;
      if (!opts.skipHtmlExport && token && sessionId) {
        try {
          const html = await exportSessionHtml(token, projectKey, sessionId);
          if (html) {
            const parsed = parseExportHtmlFourLine(html);
            fourLine = computeFourLineExportKpis(parsed);
            fs.writeFileSync(path.join(outDir, `${caseId}-export.html`), html, 'utf8');
          }
        } catch (err) {
          fourLine = { error: err instanceof Error ? err.message : String(err) };
        }
      }

      const ok = gateEval.pass
        && preflightKpis.taskArtifactWrites.length > 0
        && preflightKpis.askUserBeforeFirstWrite === 0
        && turnResult.ok !== false;

      const row = {
        caseId,
        label: spec.label,
        sessionId,
        transcriptPath,
        ok,
        gateEval,
        preflightKpis,
        engineTruth,
        fourLine,
        durationMs: Date.now() - caseStartedAt,
        turnOk: turnResult.ok,
      };
      rows.push(row);
      fs.appendFileSync(kpiPath, `${JSON.stringify({ ...row, at: new Date().toISOString() })}\n`);
      console.log(
        `[preflight-gw] ${caseId} ${ok ? 'PASS' : 'FAIL'} `
        + `writes=${preflightKpis.taskArtifactWrites.length} `
        + `ask_user=${preflightKpis.askUserBeforeFirstWrite} `
        + `accept=${preflightKpis.acceptanceStatus ?? '—'} `
        + `${Math.round(row.durationMs / 1000)}s `
        + `${gateEval.reasons.join(', ') || 'ok'}`,
      );
      await delay(2000);
    }
  } finally {
    if (ws) closeGateway(ws);
  }

  const passCount = rows.filter((r) => r.ok).length;
  const report = {
    ts: new Date().toISOString(),
    bridge: SERVER_URL,
    ui: UI_URL,
    passCount,
    total: caseIds.length,
    cases: rows,
    pass: passCount === caseIds.length && rows.length === caseIds.length,
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return { ...report, ok: report.pass, skipped: false, outDir, kpiPath };
}
