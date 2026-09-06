#!/usr/bin/env node
/**
 * PD-SAAS-FORK P0-10: Mingdi G700 dev:saas Gateway live runner (serial workers=1).
 */
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import {
  MINGDI_G700_LIVE_SCENARIOS,
  aggregateLiveKpis,
  evaluateLiveScenarioKpis,
} from './lib/mingdiG700LiveScenarios.mjs';
import {
  closeGateway,
  connectGateway,
  newSession,
  submitTurn,
} from './lib/gatewaySessionHarness.mjs';
import { fetchSaasAuthToken, resolveGeneralWorkspaceCwd } from './lib/resolveGeneralWorkspaceCwd.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const REPORT_DIR = path.join(REPO_ROOT, 'artifacts', 'mingdi-g700-production-acceptance');
const PROJECT_KEY = process.env.MINGDI_G700_LIVE_PROJECT || 'general';

function readArg(args, name) {
  const inlinePrefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(inlinePrefix));
  if (inline) return inline.slice(inlinePrefix.length);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export async function probeServer(url) {
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/api/saas/health/ready`, {
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function resolveLiveServerUrl(env = process.env) {
  const explicit = readArg(process.argv.slice(2), '--live-url')
    ?? env.MINGDI_G700_LIVE_URL
    ?? env.SERVER_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const candidates = [7990, 3001, 3002, 3003, 3004, 3005, 3006].map(
    (port) => `http://127.0.0.1:${port}`,
  );
  for (const url of candidates) {
    // eslint-disable-next-line no-await-in-loop
    if (await probeServer(url)) return url;
  }
  return null;
}

export async function waitForLiveServer(url, timeoutMs = 300_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    if (await probeServer(url)) return true;
    // eslint-disable-next-line no-await-in-loop
    await delay(3_000);
  }
  return false;
}

function filterScenarios(args) {
  const raw = readArg(args, '--scenarios') ?? process.env.MINGDI_G700_LIVE_SCENARIOS;
  if (!raw || raw === 'all') return MINGDI_G700_LIVE_SCENARIOS;
  const ids = new Set(String(raw).split(',').map((item) => item.trim()).filter(Boolean));
  return MINGDI_G700_LIVE_SCENARIOS.filter((item) => ids.has(item.id));
}

export async function runMingdiG700LiveGateway(options = {}) {
  const serverUrl = options.serverUrl ?? await resolveLiveServerUrl();
  if (!serverUrl) {
    throw new Error('dev:saas Bridge 未就绪 — 请先 npm run dev:saas 或设置 MINGDI_G700_LIVE_URL');
  }

  const ready = await waitForLiveServer(serverUrl, options.readyTimeoutMs ?? 300_000);
  if (!ready) {
    throw new Error(`Bridge ready 超时: ${serverUrl}`);
  }

  const token = await fetchSaasAuthToken(serverUrl);
  if (!token) throw new Error('SaaS login failed — 使用 admin/SAAS_ADMIN_PASSWORD');

  const workspaceCwd = await resolveGeneralWorkspaceCwd({ serverUrl, token });
  if (!workspaceCwd) throw new Error(`无法解析 ${PROJECT_KEY} workspaceCwd`);

  const scenarios = options.scenarios ?? filterScenarios(process.argv.slice(2));
  const ws = await connectGateway();
  const scenarioResults = [];

  for (const scenario of scenarios) {
    console.log(`[mingdi live] ▶ ${scenario.id} (${scenario.capabilitySlug})`);
    const sessionKey = await newSession(ws, PROJECT_KEY);
    const startedAt = new Date().toISOString();
    const result = await submitTurn(ws, {
      sessionKey,
      projectKey: PROJECT_KEY,
      workspaceCwd,
      message: scenario.message,
      tag: scenario.id,
      timeoutMs: scenario.timeoutMs ?? 600_000,
      maxTurns: 12,
      capabilityContext: {
        slug: scenario.capabilitySlug,
        // PD-SAAS-FORK P0-I: displayName required by binding prompt; slug-only used to crash turns.
        displayName: scenario.displayName || scenario.title || scenario.capabilitySlug,
        ...(scenario.completionMode ? { completionMode: scenario.completionMode } : {}),
      },
    });
    const kpis = evaluateLiveScenarioKpis(scenario, result);
    const row = {
      id: scenario.id,
      title: scenario.title,
      capabilitySlug: scenario.capabilitySlug,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: result.durationMs,
      ok: result.ok,
      timeout: Boolean(result.timeout),
      acceptanceStatus: result.acceptanceStatus,
      acceptanceFailureReasons: result.acceptanceFailureReasons ?? [],
      turnCompleted: Boolean(result.turnCompleted),
      resolvedBy: result.resolvedBy ?? null,
      toolCalls: result.toolCalls ?? {},
      toolWritePaths: result.toolWritePaths ?? [],
      kpis,
    };
    scenarioResults.push(row);
    console.log(
      `[mingdi live] ◀ ${scenario.id} ok=${row.ok} timeout=${row.timeout} `
      + `acceptance=${row.acceptanceStatus ?? 'n/a'} kpis=${JSON.stringify(kpis)}`,
    );
  }

  closeGateway(ws);

  const { totals, pass: kpiPass } = aggregateLiveKpis(scenarioResults);
  const durationPass = scenarioResults.every(
    (row) => row.durationMs == null || row.durationMs >= 10_000 || row.id === 'strategy-consultation',
  );
  const pass = kpiPass && durationPass;
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: 'live',
    serverUrl,
    projectName: PROJECT_KEY,
    scenarioCount: scenarioResults.length,
    scenarios: scenarioResults,
    kpis: totals,
    pass,
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = path.join(REPORT_DIR, 'live-p0-report.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[mingdi live] 报告 ${path.relative(REPO_ROOT, reportPath)} pass=${pass}`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  const gate = process.argv.includes('--gate');
  runMingdiG700LiveGateway()
    .then((report) => {
      if (gate && !report.pass) process.exit(1);
    })
    .catch((error) => {
      console.error(`[mingdi live] ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    });
}
