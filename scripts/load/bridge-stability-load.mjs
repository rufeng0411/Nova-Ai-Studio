#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Bridge stability load — validate + messages + ready probe.
 * Usage: SERVER_URL=http://127.0.0.1:7990 node scripts/load/bridge-stability-load.mjs --scenario smoke
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createLatencyAccumulator,
  recordLatency,
  summarizeLatency,
} from '../lib/bridgeStabilityLatency.mjs';
import { assertGatePhaseAllowed } from '../lib/gateMutex.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(REPO_ROOT, 'artifacts', 'bridge-stability-test');

const args = process.argv.slice(2);
const scenarioIdx = args.indexOf('--scenario');
const scenario = scenarioIdx >= 0 ? args[scenarioIdx + 1] : 'smoke';

const SERVER = (process.env.SERVER_URL || 'http://127.0.0.1:7990').replace(/\/$/, '');
const USER = process.env.SAAS_E2E_USER || 'admin';
const PASS = process.env.SAAS_E2E_PASSWORD || 'SAAS_ADMIN_PASSWORD';

const configs = {
  smoke: { validateConcurrency: 10, messagesConcurrency: 5, durationMs: 60_000 },
  load: { validateConcurrency: 20, messagesConcurrency: 10, durationMs: 300_000 },
  stress: { validateConcurrency: 30, messagesConcurrency: 15, durationMs: 180_000 },
  soak: { validateConcurrency: 14, messagesConcurrency: 8, durationMs: Number(process.env.BRIDGE_SOAK_DURATION_MS) || 1_800_000 },
  /** Realistic: browse side-bar sessions sequentially (matches user report). */
  browse: { sessionCount: Number(process.env.BRIDGE_BROWSE_SESSIONS || 8), rounds: 2 },
};

const cfg = configs[scenario] || configs.smoke;

function initRouteStats() {
  return {
    ok: 0,
    retry503: 0,
    fail: 0,
    latency: createLatencyAccumulator(),
  };
}

function recordSample(routeStats, status, ms) {
  recordLatency(routeStats.latency, ms);
  if (status === 'ok') routeStats.ok += 1;
  else if (status === 'retry503') routeStats.retry503 += 1;
  else routeStats.fail += 1;
}

async function login() {
  const res = await fetch(`${SERVER}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  if (!res.ok) throw new Error(`login failed ${res.status}`);
  const data = await res.json();
  return data.token;
}

async function hitReady(stats) {
  const t0 = performance.now();
  try {
    const res = await fetch(`${SERVER}/api/saas/health/ready`, { signal: AbortSignal.timeout(5_000) });
    const ms = performance.now() - t0;
    recordLatency(stats.ready.latency, ms);
    if (!res.ok) {
      stats.ready.fail += 1;
      if (res.status === 503) {
        stats.ready.wedgedSoft = (stats.ready.wedgedSoft ?? 0) + 1;
        stats.ready.retry503Count = (stats.ready.retry503Count ?? 0) + 1;
      } else if (ms > 3_000) {
        stats.ready.wedgedHard = (stats.ready.wedgedHard ?? 0) + 1;
      }
      return { status: 'fail', ms, httpStatus: res.status, wedgedKind: res.status === 503 ? 'soft' : 'hard' };
    }
    stats.ready.ok += 1;
    return { status: 'ok', ms, httpStatus: res.status, wedgedKind: null };
  } catch {
    const ms = performance.now() - t0;
    recordLatency(stats.ready.latency, ms);
    stats.ready.fail += 1;
    stats.ready.wedgedHard = (stats.ready.wedgedHard ?? 0) + 1;
    return { status: 'fail', ms, httpStatus: 0, wedgedKind: 'hard' };
  }
}

async function hitValidate(token, stats, projectName = 'general') {
  const t0 = performance.now();
  try {
    const res = await fetch(`${SERVER}/api/projects/${encodeURIComponent(projectName)}/deliverables/validate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paths: ['artifacts/readme.md'], hintDir: '' }),
      signal: AbortSignal.timeout(15_000),
    });
    const ms = performance.now() - t0;
    const status = res.ok ? 'ok' : res.status === 503 ? 'retry503' : 'fail';
    recordSample(stats.validate, status, ms);
    return { status, ms, httpStatus: res.status };
  } catch {
    recordSample(stats.validate, 'fail', performance.now() - t0);
    return { status: 'fail', ms: performance.now() - t0, httpStatus: 0 };
  }
}

async function hitMessages(token, stats, sessionId, projectName = 'general') {
  const t0 = performance.now();
  try {
    const params = new URLSearchParams({
      projectName,
      provider: 'pilotdeck',
      limit: '120',
      direction: 'backward',
    });
    const res = await fetch(`${SERVER}/api/sessions/${encodeURIComponent(sessionId)}/messages?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    });
    const ms = performance.now() - t0;
    let status = 'fail';
    if (res.ok || res.status === 404) status = 'ok';
    else if (res.status === 503) status = 'retry503';
    recordSample(stats.messages, status, ms);
    return { status, ms, httpStatus: res.status };
  } catch {
    recordSample(stats.messages, 'fail', performance.now() - t0);
    return { status: 'fail', ms: performance.now() - t0, httpStatus: 0 };
  }
}

async function workerValidate(token, endAt, stats, projectName) {
  while (Date.now() < endAt) {
    await hitValidate(token, stats, projectName);
    await hitReady(stats);
  }
}

async function workerMessages(token, endAt, stats, sessionId, projectName) {
  while (Date.now() < endAt) {
    await hitMessages(token, stats, sessionId, projectName);
    await hitReady(stats);
  }
}

async function fetchBrowseTargets(token) {
  const res = await fetch(`${SERVER}/api/projects?fresh=1`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`projects failed ${res.status}`);
  const data = await res.json();
  const projects = Array.isArray(data) ? data : data.projects ?? [];
  const targets = [];
  for (const project of projects) {
    const projectName = project.name || project.id;
    const sessions = project.sessions ?? project.loadedSessions ?? [];
    for (const session of sessions) {
      if (!session?.id || String(session.id).startsWith('new-session-')) continue;
      targets.push({ sessionId: session.id, projectName });
      if (targets.length >= cfg.sessionCount) break;
    }
    if (targets.length >= cfg.sessionCount) break;
  }
  return targets;
}

async function runBrowseScenario(token) {
  const targets = await fetchBrowseTargets(token);
  if (targets.length === 0) {
    throw new Error('browse: no sessions in /api/projects');
  }

  const stats = {
    validate: initRouteStats(),
    messages: initRouteStats(),
    ready: { ...initRouteStats(), wedgedHard: 0, wedgedSoft: 0, retry503Count: 0 },
    browse: { sessions: targets.length, rounds: cfg.rounds, steps: [] },
  };

  for (let round = 0; round < cfg.rounds; round += 1) {
    for (const { sessionId, projectName } of targets) {
      const readyBefore = await hitReady(stats);
      const messages = await hitMessages(token, stats, sessionId, projectName);
      const validate = await hitValidate(token, stats, projectName);
      const readyAfter = await hitReady(stats);
      stats.browse.steps.push({
        round,
        sessionId,
        projectName,
        readyBeforeMs: readyBefore.ms,
        messagesMs: messages.ms,
        validateMs: validate.ms,
        readyAfterMs: readyAfter.ms,
        messagesStatus: messages.status,
        readyAfterWedged: readyAfter.wedgedKind === 'hard',
      });
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return stats;
}

function summarizeRoute(name, routeStats) {
  const total = routeStats.ok + routeStats.fail + (routeStats.retry503 ?? 0);
  const hardTotal = routeStats.ok + routeStats.fail;
  return {
    route: name,
    samples: total,
    ok: routeStats.ok,
    retry503: routeStats.retry503 ?? 0,
    fail: routeStats.fail,
    hardErrorRate: hardTotal ? Number((routeStats.fail / hardTotal).toFixed(4)) : 0,
    latencyMs: summarizeLatency(routeStats.latency),
    ...(name === 'GET ready' ? {
      wedgedHard: routeStats.wedgedHard ?? 0,
      wedgedSoft: routeStats.wedgedSoft ?? 0,
      retry503Count: routeStats.retry503Count ?? 0,
      wedgedCount: routeStats.wedgedHard ?? 0,
    } : {}),
  };
}

function evaluatePass(stats) {
  const readySummary = summarizeRoute('GET ready', stats.ready);
  const validateSummary = summarizeRoute('POST validate', stats.validate);
  const messagesSummary = summarizeRoute('GET messages', stats.messages);
  const wedgedHard = stats.ready.wedgedHard ?? 0;
  const wedgedSoft = stats.ready.wedgedSoft ?? 0;
  const readyP95 = readySummary.latencyMs.p95;
  return {
    wedgedHard,
    wedgedSoft,
    wedgedCount: wedgedHard,
    retry503Count: stats.ready.retry503Count ?? 0,
    readyP95Ms: readyP95,
    validateHardErrorRate: validateSummary.hardErrorRate,
    messagesHardErrorRate: messagesSummary.hardErrorRate,
    pass:
      wedgedHard === 0
      && readyP95 < 500
      && validateSummary.hardErrorRate < 0.05
      && messagesSummary.hardErrorRate < 0.05,
  };
}

async function main() {
  const phaseCheck = assertGatePhaseAllowed('load');
  if (!phaseCheck.ok) {
    console.error(`[bridge-stability-load] blocked: ${phaseCheck.reason}`);
    process.exit(1);
  }

  const token = await login();
  let stats;

  if (scenario === 'browse') {
    stats = await runBrowseScenario(token);
  } else {
    const endAt = Date.now() + cfg.durationMs;
    stats = {
      validate: initRouteStats(),
      messages: initRouteStats(),
      ready: { ...initRouteStats(), wedgedHard: 0, wedgedSoft: 0, retry503Count: 0 },
    };
    const workers = [
      ...Array.from({ length: cfg.validateConcurrency }, () => workerValidate(token, endAt, stats, 'general')),
      ...Array.from({ length: cfg.messagesConcurrency }, () => workerMessages(token, endAt, stats, 'web-s_test', 'general')),
    ];
    await Promise.all(workers);
  }

  const gate = evaluatePass(stats);
  const report = {
    scenario,
    server: SERVER,
    ...(scenario === 'browse'
      ? { sessionCount: cfg.sessionCount, rounds: cfg.rounds, browseSteps: stats.browse?.steps?.length ?? 0 }
      : {
        durationMs: cfg.durationMs,
        validateConcurrency: cfg.validateConcurrency,
        messagesConcurrency: cfg.messagesConcurrency,
      }),
    routes: [
      summarizeRoute('POST validate', stats.validate),
      summarizeRoute('GET messages', stats.messages),
      summarizeRoute('GET ready', stats.ready),
    ],
    gate,
    pass: gate.pass,
    generatedAt: new Date().toISOString(),
    ...(stats.browse ? { browseDetail: stats.browse } : {}),
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const iso = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.join(OUT_DIR, `load-${scenario}-${iso}.json`);
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`[bridge-stability-load] ${scenario} pass=${gate.pass} wedgedHard=${gate.wedgedHard} wedgedSoft=${gate.wedgedSoft} readyP95=${gate.readyP95Ms}ms → ${out}`);
  if (!gate.pass) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
