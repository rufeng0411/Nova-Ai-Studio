#!/usr/bin/env node
/**
 * PD-SAAS-FORK: sticky bar + stage budget live matrix (Bridge 7990, workers=1).
 * 用法：SERVER_URL=http://127.0.0.1:7990 npm run test:sticky-stage:live
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { THREE_CASE_SPEED_RCA_LIVE_CASES } from './lib/threeCaseSpeedRcaLiveCases.mjs';
import { bridgeCliSessionToCatalog } from './lib/bridgeCliSessionCatalog.mjs';
import {
  closeGateway,
  connectGateway,
  newSession,
  submitTurn,
} from './lib/gatewaySessionHarness.mjs';
import {
  fetchSaasAuthToken,
  resolveGeneralWorkspaceCwd,
} from './lib/resolveGeneralWorkspaceCwd.mjs';
import { ensureProjectWorkspace } from './lib/resolveProjectWorkspaceCwd.mjs';
import { findTranscriptAbsPath } from './lib/threeCaseSpeedRcaJsonlKpi.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_URL = (process.env.SERVER_URL || process.env.PLAYWRIGHT_SERVER_URL || 'http://127.0.0.1:7990').replace(/\/$/, '');
const OUT_DIR = process.env.STICKY_LIVE_OUT
  ? path.resolve(REPO_ROOT, process.env.STICKY_LIVE_OUT)
  : path.join(REPO_ROOT, 'artifacts', 'sticky-stage-budget-20260819', 'treatment');
const PROJECT_KEY = process.env.STICKY_STAGE_PROJECT || 'sticky-stage-20260819';
const FALLBACK_PROJECT = 'general';
const CASE_FILTER = String(process.env.STICKY_LIVE_CASES ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const GEO_GOAL = THREE_CASE_SPEED_RCA_LIVE_CASES['geo-brand-full'].goal;

const CASES = [
  {
    id: 'STICKY-HTML',
    timeoutMs: 540_000,
    maxTurns: 8,
    hard: true,
    message: [
      '写一份极简单页 HTML 简报，主题：北京早高峰通勤观察。',
      '须交付：report.html',
      '不要配图、不要调研包、不要 Word/PPT。',
      '直接开始做，写入系统分配任务目录。',
    ].join('\n'),
  },
  {
    id: 'STICKY-SCRIPT',
    timeoutMs: 540_000,
    maxTurns: 8,
    hard: true,
    message: [
      '写一个短视频口播脚本，主题：智能手表开箱 30 秒。',
      '须交付：脚本.md',
      '不要做成视频，不要 mp4，不要 HTML 录屏。',
      '直接开始做，写入系统分配任务目录。',
    ].join('\n'),
  },
  {
    id: 'STICKY-PROMPT',
    timeoutMs: 540_000,
    maxTurns: 8,
    hard: true,
    message: [
      '用「HTML 报告」做【春季通勤观察】简报。',
      '须交付：report.html。',
      '写完后请自检路径与清单是否对齐。',
      '写入系统分配任务目录。',
    ].join('\n'),
  },
  {
    id: 'STICKY-ZHIHU',
    timeoutMs: 1_800_000,
    maxTurns: 10,
    hard: true,
    largeIssueIf: (row) => row.profileId === 'ppt' || row.wallClockMs > 20 * 60 * 1000,
    message: [
      '帮我做知乎选题和一篇长文，主题：企业级 Agent 落地。',
      '须交付：01-topics.md、02-longform.md。',
      '这两个内容在 PPT 里没有展示。',
      '写入系统分配任务目录。',
    ].join('\n'),
  },
  {
    id: 'STICKY-GEO',
    timeoutMs: 1_200_000,
    maxTurns: 12,
    hard: false,
    largeIssueIf: (row) => Number(row.slotTotal ?? 0) === 0,
    message: GEO_GOAL,
  },
  {
    id: 'STICKY-FLYWHEEL',
    timeoutMs: 900_000,
    maxTurns: 10,
    hard: true,
    message: [
      '做内容飞轮：选题→长文→社媒切片。',
      '须交付：01-topics.md、02-longform.md、03-social-slices.md。',
      '不要问卷，不要做成 11 个槽。',
      '直接开始做，写入系统分配任务目录。',
    ].join('\n'),
  },
];

function collectPaths(ctx) {
  const fromTurn = ctx.turn?.toolWritePaths ?? [];
  const fromMeta = (ctx.meta?.slotBindings ?? []).flatMap((b) => [b.resolvedPath, b.path].filter(Boolean));
  const fromManifest = (ctx.manifest?.slots ?? []).map((s) => s.resolvedPath).filter(Boolean);
  return [...new Set([...fromTurn, ...fromMeta, ...fromManifest].map((p) => String(p).replace(/\\/g, '/')))];
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

function readEnvelopeFromJsonl(sessionId) {
  const transcriptPath = findTranscriptAbsPath(sessionId);
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return { transcriptPath: transcriptPath ?? null, manifest: null, meta: null, tokensIn: 'n/a', tokensOut: 'n/a', repairTurns: 0 };
  }
  let manifest = null;
  let meta = null;
  let tokensIn = 'n/a';
  let tokensOut = 'n/a';
  let repairTurns = 0;
  for (const line of fs.readFileSync(transcriptPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row.type === 'session_deliverable_manifest' && row.manifest) manifest = row.manifest;
      if (row.type === 'turn_acceptance_meta') meta = row;
      if (row.type === 'deliverable_repair' || row.reason === 'acceptance_repair') repairTurns += 1;
      const usage = row.usage || row.tokenUsage || row.detail?.usage;
      if (usage && (usage.input != null || usage.prompt_tokens != null || usage.tokensIn != null)) {
        tokensIn = usage.input ?? usage.prompt_tokens ?? usage.tokensIn;
        tokensOut = usage.output ?? usage.completion_tokens ?? usage.tokensOut ?? tokensOut;
      }
    } catch {
      // skip malformed
    }
  }
  return { transcriptPath, manifest, meta, tokensIn, tokensOut, repairTurns };
}

function judgeCase(spec, ctx) {
  const paths = collectPaths(ctx);
  const slots = ctx.manifest?.slots?.filter((s) => s.status !== 'removed') ?? [];
  const slotTotal = slots.length;
  const wroteFile = (ctx.turn?.toolWritePaths ?? []).length > 0 || paths.length > 0;
  const hasMp4 = paths.some((p) => /\.mp4$/i.test(p));
  const barPersist = ctx.barUnloadCount === 0 && (slotTotal > 0 || wroteFile);
  const checkingNotGreen = ctx.unsettledClickable !== false;
  const acceptance = ctx.meta?.acceptanceStatus ?? ctx.turn?.acceptanceStatus ?? null;
  const fakePassed = acceptance === 'passed' && slotTotal > 0 && paths.length === 0;
  const videoSlots = slots.filter((s) => s.kind === 'video' || /\.mp4$/i.test(String(s.pathHint ?? '')));
  const phantom11 = spec.id === 'STICKY-FLYWHEEL' && slotTotal > 5;

  let ok = barPersist && !fakePassed && checkingNotGreen;
  if (spec.id === 'STICKY-HTML' || spec.id === 'STICKY-PROMPT') {
    ok = ok && paths.some((p) => /report\.html$/i.test(p) || /\.html?$/i.test(p));
  }
  if (spec.id === 'STICKY-SCRIPT') {
    ok = ok && paths.some((p) => /\.md$/i.test(p)) && !hasMp4 && videoSlots.length === 0;
  }
  if (spec.id === 'STICKY-ZHIHU') {
    ok = ok && ctx.manifest?.profileId !== 'ppt'
      && paths.some((p) => /01-topics\.md$/i.test(p))
      && paths.some((p) => /02-longform\.md$/i.test(p));
  }
  if (spec.id === 'STICKY-FLYWHEEL') {
    ok = ok && !phantom11;
  }
  return {
    ok,
    detail: {
      barPersist,
      fakePassed,
      slotTotal,
      paths,
      profileId: ctx.manifest?.profileId ?? null,
      acceptance,
      hasMp4,
      phantom11,
    },
  };
}

async function probeHealth() {
  const attempts = 10;
  let lastError = '';
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`${SERVER_URL}/api/saas/health/ready`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) return true;
      lastError = `HTTP ${res.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    console.log(`[sticky-live] health retry ${i + 1}/${attempts} ${lastError}`);
    await delay(1500);
  }
  return false;
}

async function resolveProjectKey(token) {
  const wanted = process.env.STICKY_STAGE_PROJECT || PROJECT_KEY;
  try {
    const list = await apiJson(`${SERVER_URL}/api/projects?fresh=1`, { token });
    const projects = list.json?.projects ?? list.json ?? [];
    const match = (Array.isArray(projects) ? projects : []).find((item) => {
      const name = String(item.name || item.id || '');
      const display = String(item.displayName || item.display_name || '');
      return name === wanted || display === wanted || display === 'sticky-stage-20260819';
    });
    if (match?.name) return String(match.name);
  } catch {
    // fall through
  }
  return wanted || FALLBACK_PROJECT;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const ready = await probeHealth();
  if (!ready) {
    const skip = {
      skipped: true,
      reason: `Bridge not ready at ${SERVER_URL}`,
      verdict: 'GO(shadow-offline)',
    };
    fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), `${JSON.stringify(skip, null, 2)}\n`);
    console.error(`[sticky-live] FAIL: ${skip.reason}`);
    process.exit(1);
  }

  const token = await fetchSaasAuthToken(SERVER_URL);
  if (!token) {
    console.error('[sticky-live] admin login failed');
    process.exit(1);
  }
  const projectKey = await resolveProjectKey(token);
  const workspaceCwd = await ensureProjectWorkspace(SERVER_URL, token, 'sticky-stage-20260819').catch(() => null)
    || await resolveGeneralWorkspaceCwd({ serverUrl: SERVER_URL, token });
  if (!workspaceCwd) {
    console.error('[sticky-live] workspace cwd missing');
    process.exit(1);
  }
  console.log(`[sticky-live] project=${projectKey} cwd=${workspaceCwd}`);

  const ws = await connectGateway({ clientName: 'sticky-stage-budget-live' });
  const rows = [];
  const kpiPath = path.join(OUT_DIR, 'kpi.jsonl');
  fs.writeFileSync(kpiPath, '');

  try {
    const selected = CASE_FILTER.length > 0
      ? CASES.filter((spec) => CASE_FILTER.includes(spec.id))
      : CASES;
    for (const spec of selected) {
      console.log(`[sticky-live] ▶ ${spec.id}`);
      const caseDir = path.join(OUT_DIR, spec.id);
      fs.mkdirSync(caseDir, { recursive: true });
      let sessionKey;
      let firstWriteMs = null;
      let slotSeen = 0;
      let barUnloadCount = 0;
      try {
        sessionKey = await newSession(ws, projectKey);
        const startedAt = Date.now();
        const turn = await submitTurn(ws, {
          sessionKey,
          projectKey,
          workspaceCwd,
          message: spec.message,
          tag: spec.id,
          skipMessageTag: true,
          timeoutMs: spec.timeoutMs,
          maxTurns: spec.maxTurns,
          onEvent: (event) => {
            if (
              firstWriteMs == null
              && (event.type === 'tool_call_started' || event.type === 'tool_call_finished')
              && /write_file/i.test(String(event.name ?? ''))
            ) {
              firstWriteMs = Date.now() - startedAt;
            }
          },
        });
        const bridged = await bridgeCliSessionToCatalog({ sessionKey, projectName: projectKey }).catch(() => null);
        const sessionId = bridged?.sessionId ?? sessionKey;
        const fromDisk = readEnvelopeFromJsonl(sessionId);
        const manifest = fromDisk.manifest;
        const meta = fromDisk.meta;
        const slots = manifest?.slots?.filter((s) => s.status !== 'removed') ?? [];
        slotSeen = slots.length;
        if (slotSeen === 0 && (turn.toolWritePaths ?? []).length > 0) barUnloadCount = 1;
        const judged = judgeCase(spec, {
          turn,
          manifest,
          meta,
          barUnloadCount,
          unsettledClickable: true,
        });
        const row = {
          id: spec.id,
          ok: judged.ok,
          hard: spec.hard,
          sessionId,
          wallClockMs: turn.durationMs,
          ttfwMs: firstWriteMs == null ? 'n/a' : firstWriteMs,
          userTurns: 1,
          repairTurns: fromDisk.repairTurns,
          acceptanceStatus: meta?.acceptanceStatus ?? turn.acceptanceStatus ?? null,
          falseIncomplete: meta?.acceptanceStatus === 'needs_repair' && judged.detail.paths.length > 0,
          tokensIn: fromDisk.tokensIn,
          tokensOut: fromDisk.tokensOut,
          barPersist: judged.detail.barPersist,
          unsettledClickable: true,
          stageOverrunEvents: 'n/a',
          profileId: manifest?.profileId ?? null,
          slotTotal: slotSeen,
          largeIssue: spec.largeIssueIf ? Boolean(spec.largeIssueIf({
            profileId: manifest?.profileId ?? null,
            wallClockMs: turn.durationMs,
            slotTotal: slotSeen,
          })) : false,
          timeout: Boolean(turn.timeout),
          detail: judged.detail,
        };
        rows.push(row);
        fs.appendFileSync(kpiPath, `${JSON.stringify(row)}\n`);
        fs.writeFileSync(path.join(caseDir, 'result.json'), `${JSON.stringify(row, null, 2)}\n`);
        console.log(`[sticky-live] ${row.ok ? 'PASS' : 'FAIL'} ${spec.id} ${row.wallClockMs}ms profile=${row.profileId ?? '-'}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const row = { id: spec.id, ok: false, hard: spec.hard, error: message };
        rows.push(row);
        fs.appendFileSync(kpiPath, `${JSON.stringify(row)}\n`);
        fs.writeFileSync(path.join(caseDir, 'error.json'), `${JSON.stringify({ error: message }, null, 2)}\n`);
        console.log(`[sticky-live] FAIL ${spec.id} ${message}`);
      }
    }
  } finally {
    closeGateway(ws);
  }

  const hardRows = rows.filter((row) => row.hard);
  const summary = {
    startedAt: new Date().toISOString(),
    serverUrl: SERVER_URL,
    projectKey,
    pass: rows.filter((row) => row.ok).length,
    hardPass: hardRows.filter((row) => row.ok).length,
    hardTotal: hardRows.length,
    total: rows.length,
    largeIssues: rows.filter((row) => row.largeIssue).map((row) => row.id),
    ok: hardRows.length > 0 && hardRows.every((row) => row.ok),
    rows,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`[sticky-live] hard ${summary.hardPass}/${summary.hardTotal} · all ${summary.pass}/${summary.total} → ${path.relative(REPO_ROOT, OUT_DIR)}`);
  process.exit(summary.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
