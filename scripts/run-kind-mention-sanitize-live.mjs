#!/usr/bin/env node
/**
 * PD-SAAS-FORK: kind-mention sanitize live matrix.
 * A=explicit shadow  B=spawned enforce (launcher/pack default is now enforce). Spawn MUST set SDM=1.
 * Usage: SERVER_URL=http://127.0.0.1:7990 npm run test:kind-mention:live
 * Optional: KIND_LIVE_PASS=shadow|enforce|all
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
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
import { getPatchImportUrl } from './lib/hiddenConsoleEnv.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.DATA_ROOT?.trim()) {
  process.env.DATA_ROOT = path.join(REPO_ROOT, '.saas-dev-data');
}
const SERVER_URL = (process.env.SERVER_URL || process.env.PLAYWRIGHT_SERVER_URL || 'http://127.0.0.1:7990').replace(/\/$/, '');
const OUT_DIR = process.env.KIND_LIVE_OUT
  ? path.resolve(REPO_ROOT, process.env.KIND_LIVE_OUT)
  : path.join(REPO_ROOT, 'artifacts', 'kind-mention-sanitize-20260820');
const PROJECT_NAME = process.env.KIND_LIVE_PROJECT || 'kind-mention-20260820';
const PASS = String(process.env.KIND_LIVE_PASS ?? 'all').trim().toLowerCase();

const CASE_12FC6055 = [
  '你现在是一个很厉害的做内容营销的人，请你根据附件公司的介绍，一个知乎的系列选题。先做 5 期。',
  'PDF 中的檽糯映画是 AI 漫剧生成的产品。NOVA-KOL 是大号蒸馏。',
  '这两个内容在 PPT 里没有展示，因此说明一下',
].join('');
const CASE_PDF_SOURCE_NOTES = '根据这份 PDF 写一份会议纪要';
const CASE_TRUE_PPT = '请根据资料生成一份 12 页可编辑 PPT，做完告诉我文件在哪';
const CASE_WEEKLY_PPT = '做一份周会PPT，须交付 presentation.pptx';
const CASE_STICKY_ZHIHU = [
  '帮我做知乎选题和一篇长文，主题：企业级 Agent 落地。',
  '须交付：01-topics.md、02-longform.md。',
  '这两个内容在 PPT 里没有展示。',
  '写入系统分配任务目录。',
].join('\n');
const CASE_DUAL = [
  '帮我做知乎选题和一篇长文，主题：企业级 Agent 落地。',
  '须交付：01-topics.md、02-longform.md。',
  '另外做成一份PPT。',
  '写入系统分配任务目录。',
].join('\n');

function inspectTranscript(sessionId) {
  const transcriptPath = findTranscriptAbsPath(sessionId);
  const result = {
    transcriptPath: transcriptPath ?? null,
    asked: 0,
    profileId: null,
    slotIds: [],
    pathHints: [],
    tokensIn: 'n/a',
    tokensOut: 'n/a',
  };
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return result;
  for (const line of fs.readFileSync(transcriptPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row.type === 'session_deliverable_manifest' && row.manifest) {
        result.profileId = row.manifest.profileId ?? result.profileId;
        result.slotIds = (row.manifest.slots ?? []).map((slot) => String(slot.id ?? ''));
        result.pathHints = (row.manifest.slots ?? []).flatMap((slot) => [
          slot.pathHint ?? '',
          ...(slot.pathHints ?? []),
        ]);
      }
      const meta = row.message?.metadata ?? row.metadata ?? {};
      if (String(meta.expensiveIntentFingerprint ?? '') === 'expensive_intent:ppt_vs_named_files') {
        result.asked += 1;
      }
      const usage = row.usage || row.tokenUsage || row.detail?.usage;
      if (usage && (usage.input != null || usage.prompt_tokens != null || usage.tokensIn != null)) {
        result.tokensIn = usage.input ?? usage.prompt_tokens ?? usage.tokensIn;
        result.tokensOut = usage.output ?? usage.completion_tokens ?? usage.tokensOut ?? result.tokensOut;
      }
    } catch {
      // skip
    }
  }
  return result;
}

function hasOfficePhantom(disk) {
  const blob = [...disk.slotIds, ...disk.pathHints].join('|');
  return /required_pdf_|required_pptx_|report\.pdf|presentation\.pptx/i.test(blob);
}

function hasHint(disk, re) {
  return disk.pathHints.some((hint) => re.test(String(hint)));
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

async function resolveProjectKey(token) {
  try {
    const list = await apiJson(`${SERVER_URL}/api/projects?fresh=1`, { token });
    const projects = list.json?.projects ?? list.json ?? [];
    const match = (Array.isArray(projects) ? projects : []).find((item) => {
      const name = String(item.name || item.id || '');
      const display = String(item.displayName || item.display_name || '');
      return name === PROJECT_NAME || display === PROJECT_NAME;
    });
    if (match?.name) return String(match.name);
  } catch {
    // fall through
  }
  return PROJECT_NAME;
}

async function probeHealth() {
  for (let i = 0; i < 10; i += 1) {
    try {
      const res = await fetch(`${SERVER_URL}/api/saas/health/ready`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) return true;
    } catch {
      // retry
    }
    await delay(1000);
  }
  return false;
}

async function waitForGateway(url, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const ws = await connectGateway({ url, clientName: 'kind-mention-probe' });
      closeGateway(ws);
      return true;
    } catch {
      await delay(1000);
    }
  }
  return false;
}

function stopChild(child) {
  if (!child?.pid || child.killed) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    return;
  }
  child.kill('SIGTERM');
}

function spawnEnforceGateway(port) {
  const gatewayEntry = path.join(REPO_ROOT, 'src', 'cli', 'pilotdeck.ts');
  const patch = getPatchImportUrl(REPO_ROOT);
  const dataRoot = process.env.DATA_ROOT?.trim() || path.join(REPO_ROOT, '.saas-dev-data');
  const logPath = path.join(OUT_DIR, 'enforce-gateway.log');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const log = fs.createWriteStream(logPath, { flags: 'a' });
  const child = spawn(process.execPath, ['--import', patch, '--import', 'tsx', gatewayEntry, 'server'], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      DATA_ROOT: dataRoot,
      PILOTDECK_SAAS_MODE: process.env.PILOTDECK_SAAS_MODE || '1',
      PILOTDECK_SKIP_MEMORY_DREAM: process.env.PILOTDECK_SKIP_MEMORY_DREAM || '1',
      PILOTDECK_CLARIFICATION_GATE: process.env.PILOTDECK_CLARIFICATION_GATE || '1',
      PILOTDECK_SESSION_DELIVERABLE_MANIFEST: process.env.PILOTDECK_SESSION_DELIVERABLE_MANIFEST || '1',
      PILOTDECK_SDM_PARSE_MUST_DELIVER: process.env.PILOTDECK_SDM_PARSE_MUST_DELIVER || '1',
      PILOTDECK_GATEWAY_PORT: String(port),
      PILOTDECK_GATEWAY_URL: `ws://127.0.0.1:${port}/ws`,
      PILOTDECK_KIND_MENTION_SANITIZE: 'enforce',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);
  child.on('exit', () => log.end());
  return child;
}

async function runCase(ws, ctx, spec, passLabel = 'run') {
  const caseDir = path.join(OUT_DIR, passLabel || spec.pass || 'run', spec.id);
  fs.mkdirSync(caseDir, { recursive: true });
  const sessionKey = await newSession(ws, ctx.projectKey);
  const turn = await submitTurn(ws, {
    sessionKey,
    projectKey: ctx.projectKey,
    workspaceCwd: ctx.workspaceCwd,
    message: spec.message,
    tag: spec.id,
    skipMessageTag: true,
    timeoutMs: spec.timeoutMs,
    maxTurns: spec.maxTurns ?? 3,
  });
  const bridged = await ctx.bridgeCliSessionToCatalog?.({ sessionKey, projectName: ctx.projectKey }).catch(() => null);
  const sessionId = bridged?.sessionId ?? sessionKey;
  const disk = inspectTranscript(sessionId);
  const askedText = /需要你选一下|Need a quick choice/.test(String(turn.assistantText ?? ''));
  return {
    spec,
    sessionKey,
    sessionId,
    turn,
    disk,
    asked: Math.max(disk.asked, askedText ? 1 : 0),
    caseDir,
  };
}

function judge(result, passLabel) {
  const enforce = passLabel.includes('enforce');
  const { spec, asked, disk, turn } = result;
  const phantom = hasOfficePhantom(disk);
  const flywheel = disk.pathHints.some((hint) => /01-topics\.md$/i.test(String(hint)))
    && spec.id === 'KM-12FC';
  const checks = {
    asked,
    phantom,
    flywheel,
    profileId: disk.profileId,
    slotIds: disk.slotIds,
    timeout: Boolean(turn.timeout),
  };
  switch (spec.id) {
    case 'KM-12FC':
      if (enforce) {
        return { ok: asked === 0 && !phantom && !flywheel, checks };
      }
      return { ok: asked === 0, checks };
    case 'KM-SOURCE':
      if (enforce) {
        return { ok: asked === 0 && !/report\.pdf/i.test(disk.pathHints.join('|')), checks };
      }
      return { ok: asked === 0, checks };
    case 'KM-TRUE':
    case 'KM-WEEKLY':
      return {
        ok: asked === 0 && hasHint(disk, /\.pptx$/i),
        checks,
      };
    case 'KM-ZHIHU':
      return {
        ok: asked === 0
          && hasHint(disk, /01-topics\.md$/i)
          && !hasHint(disk, /presentation\.pptx$/i),
        checks,
      };
    case 'KM-DUAL':
      // Shadow fuse does not strip; profile may be ppt. This batch only forbids asking.
      return { ok: asked === 0, checks };
    default:
      return { ok: false, checks };
  }
}

const SPECS = [
  { id: 'KM-12FC', message: CASE_12FC6055, timeoutMs: 180_000, maxTurns: 3, hard: true },
  { id: 'KM-SOURCE', message: CASE_PDF_SOURCE_NOTES, timeoutMs: 120_000, maxTurns: 2, hard: true },
  { id: 'KM-TRUE', message: CASE_TRUE_PPT, timeoutMs: 180_000, maxTurns: 3, hard: true },
  { id: 'KM-WEEKLY', message: CASE_WEEKLY_PPT, timeoutMs: 180_000, maxTurns: 3, hard: true },
  { id: 'KM-ZHIHU', message: CASE_STICKY_ZHIHU, timeoutMs: 180_000, maxTurns: 3, hard: true },
  { id: 'KM-DUAL', message: CASE_DUAL, timeoutMs: 180_000, maxTurns: 3, hard: true },
];

async function runPass(label, ws, ctx, kpiPath) {
  const rows = [];
  for (const spec of SPECS) {
    console.log(`[kind-live] ▶ ${label} ${spec.id}`);
    try {
      const result = await runCase(ws, ctx, spec, label);
      const judged = judge(result, label);
      const row = {
        id: spec.id,
        pass: label,
        ok: judged.ok,
        hard: spec.hard !== false,
        sessionId: result.sessionId,
        wallClockMs: result.turn.durationMs,
        asked: result.asked,
        phantom: hasOfficePhantom(result.disk),
        profileId: result.disk.profileId ?? null,
        slotIds: result.disk.slotIds,
        pathHints: result.disk.pathHints,
        tokensIn: result.disk.tokensIn,
        tokensOut: result.disk.tokensOut,
        timeout: Boolean(result.turn.timeout),
        assistantPreview: String(result.turn.assistantText ?? '').slice(0, 240),
        checks: judged.checks,
      };
      rows.push(row);
      fs.appendFileSync(kpiPath, `${JSON.stringify(row)}\n`);
      fs.writeFileSync(path.join(result.caseDir, 'result.json'), `${JSON.stringify(row, null, 2)}\n`);
      console.log(`[kind-live] ${row.ok ? 'PASS' : 'FAIL'} ${spec.id} asked=${row.asked} phantom=${row.phantom} profile=${row.profileId ?? '-'}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const row = { id: spec.id, pass: label, ok: false, hard: spec.hard !== false, error: message };
      rows.push(row);
      fs.appendFileSync(kpiPath, `${JSON.stringify(row)}\n`);
      console.log(`[kind-live] FAIL ${spec.id} ${message}`);
    }
  }
  return rows;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const ready = await probeHealth();
  if (!ready) {
    const skip = { skipped: true, reason: `Bridge not ready at ${SERVER_URL}`, verdict: 'NO_GO' };
    fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), `${JSON.stringify(skip, null, 2)}\n`);
    console.error(`[kind-live] FAIL: ${skip.reason}`);
    process.exit(1);
  }

  const token = await fetchSaasAuthToken(SERVER_URL);
  if (!token) {
    console.error('[kind-live] admin login failed');
    process.exit(1);
  }
  const { bridgeCliSessionToCatalog } = await import('./lib/bridgeCliSessionCatalog.mjs');
  const workspaceCwd = await ensureProjectWorkspace(SERVER_URL, token, PROJECT_NAME).catch(() => null)
    || await resolveGeneralWorkspaceCwd({ serverUrl: SERVER_URL, token });
  if (!workspaceCwd) {
    console.error('[kind-live] workspace cwd missing');
    process.exit(1);
  }
  const projectKey = await resolveProjectKey(token);
  console.log(`[kind-live] project=${projectKey} cwd=${workspaceCwd}`);
  const ctx = { projectKey, workspaceCwd, bridgeCliSessionToCatalog };
  const kpiPath = path.join(OUT_DIR, 'kpi.jsonl');
  fs.writeFileSync(kpiPath, '');
  let rows = [];

  if (PASS === 'all' || PASS === 'shadow') {
    const ws = await connectGateway({ clientName: 'kind-mention-shadow' });
    try {
      rows = rows.concat(await runPass('A-shadow', ws, ctx, kpiPath));
    } finally {
      closeGateway(ws);
    }
  }

  if (PASS === 'all' || PASS === 'enforce') {
    const port = Number(process.env.KIND_ENFORCE_PORT || 19892);
    const child = spawnEnforceGateway(port);
    const url = `ws://127.0.0.1:${port}/ws`;
    const up = await waitForGateway(url);
    if (!up) {
      stopChild(child);
      throw new Error(`enforce gateway not ready on ${port}`);
    }
    const ws = await connectGateway({ url, clientName: 'kind-mention-enforce' });
    try {
      rows = rows.concat(await runPass('B-enforce', ws, ctx, kpiPath));
    } finally {
      closeGateway(ws);
      stopChild(child);
    }
  }

  const hardFails = rows.filter((row) => row.hard !== false && row.ok === false);
  const summary = {
    verdict: hardFails.length === 0 ? 'GO(shadow)' : 'NO_GO',
    hardFails: hardFails.map((row) => `${row.pass}:${row.id}`),
    rows,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`[kind-live] verdict=${summary.verdict} hardFails=${summary.hardFails.join(',') || 'none'}`);
  if (hardFails.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
