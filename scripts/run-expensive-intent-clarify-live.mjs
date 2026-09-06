#!/usr/bin/env node
/**
 * PD-SAAS-FORK: expensive intent fuse live matrix.
 * Two Gateway passes: A=shadow (default launcher), B=spawned enforce on a spare port.
 * Usage: SERVER_URL=http://127.0.0.1:7990 npm run test:expensive-intent:live
 * Optional: EI_LIVE_PASS=shadow|enforce|all  EI_SKIP_STICKY=1
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
const OUT_DIR = process.env.EI_LIVE_OUT
  ? path.resolve(REPO_ROOT, process.env.EI_LIVE_OUT)
  : path.join(REPO_ROOT, 'artifacts', 'expensive-intent-clarify-20260819');
const PROJECT_NAME = process.env.EI_LIVE_PROJECT || 'expensive-intent-20260819';
const PASS = String(process.env.EI_LIVE_PASS ?? 'all').trim().toLowerCase();
const SKIP_STICKY = process.env.EI_SKIP_STICKY === '1';
const FINGERPRINT = 'expensive_intent:ppt_vs_named_files';

const ZHIHU = [
  '帮我做知乎选题和一篇长文，主题：企业级 Agent 落地。',
  '须交付：01-topics.md、02-longform.md。',
  '这两个内容在 PPT 里没有展示。',
  '写入系统分配任务目录。',
].join('\n');

const DUAL = [
  '帮我做知乎选题和一篇长文，主题：企业级 Agent 落地。',
  '须交付：01-topics.md、02-longform.md。',
  '另外做成一份PPT。',
  '写入系统分配任务目录。',
].join('\n');

const TRUE_PPT = '做一份周会PPT，须交付 presentation.pptx';

function inspectTranscript(sessionId) {
  const transcriptPath = findTranscriptAbsPath(sessionId);
  const result = {
    transcriptPath: transcriptPath ?? null,
    asked: 0,
    titles: [],
    pending: false,
    profileId: null,
    purpose: null,
    tokensIn: 'n/a',
    tokensOut: 'n/a',
  };
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return result;
  const messages = [];
  for (const line of fs.readFileSync(transcriptPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      const manifest = row.manifest
        ?? row.sessionDeliverableManifest
        ?? row.message?.metadata?.sessionDeliverableManifest
        ?? row.metadata?.sessionDeliverableManifest;
      if (manifest?.profileId) {
        result.profileId = manifest.profileId;
      }
      if (row.type === 'durable_message' || row.type === 'assistant_message') {
        messages.push(row.message ?? row);
      }
      if (row.type === 'accepted_input') {
        messages.push(...(row.messages ?? []));
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
  let lastFuseIndex = -1;
  messages.forEach((message, index) => {
    const meta = message?.metadata ?? {};
    const fingerprint = String(meta.expensiveIntentFingerprint ?? '');
    const noticeTitle = String(meta.userActionNotice?.title ?? '');
    if (fingerprint === FINGERPRINT) {
      result.asked += 1;
      lastFuseIndex = index;
      result.purpose = meta.purpose ?? result.purpose;
      if (noticeTitle) result.titles.push(noticeTitle);
    }
  });
  if (lastFuseIndex >= 0) {
    result.pending = true;
    for (let i = lastFuseIndex + 1; i < messages.length; i += 1) {
      const message = messages[i];
      const role = message?.role ?? message?.type;
      if (role !== 'user') continue;
      if (message?.metadata?.synthetic) continue;
      const text = Array.isArray(message?.content)
        ? message.content.map((block) => (block && block.text ? block.text : '')).join('')
        : String(message?.content ?? '');
      if (text.trim()) {
        result.pending = false;
        break;
      }
    }
  }
  return result;
}

function askedFromTurn(turn, disk) {
  const text = String(turn?.assistantText ?? '');
  const textAsked = /需要你选一下|点名要做的文件|Need a quick choice/.test(text);
  return Math.max(disk.asked, textAsked ? 1 : 0);
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
    await delay(1500);
  }
  return false;
}

async function waitForGateway(url, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const ws = await connectGateway({ url, clientName: 'expensive-intent-probe' });
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
      PILOTDECK_EXPENSIVE_INTENT_CLARIFY: 'enforce',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);
  child.on('exit', () => log.end());
  return child;
}

async function runStickyRetest() {
  if (SKIP_STICKY) return { skipped: true, ok: true };
  const outDir = path.join(OUT_DIR, 'sticky-retest');
  fs.mkdirSync(outDir, { recursive: true });
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(REPO_ROOT, 'scripts', 'run-sticky-stage-budget-live.mjs')], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        SERVER_URL,
        STICKY_LIVE_OUT: outDir,
        STICKY_LIVE_CASES: 'STICKY-ZHIHU,STICKY-HTML,STICKY-SCRIPT',
      },
      stdio: 'inherit',
      windowsHide: true,
    });
    child.on('close', (code) => resolve({ skipped: false, ok: code === 0, code }));
  });
}

async function runCase(ws, ctx, spec, passLabel = 'run') {
  const caseDir = path.join(OUT_DIR, passLabel || spec.pass || 'run', spec.id);
  fs.mkdirSync(caseDir, { recursive: true });
  const sessionKey = spec.reuseSessionKey ?? await newSession(ws, ctx.projectKey);
  const turn = await submitTurn(ws, {
    sessionKey,
    projectKey: ctx.projectKey,
    workspaceCwd: ctx.workspaceCwd,
    message: spec.message,
    tag: spec.id,
    skipMessageTag: true,
    timeoutMs: spec.timeoutMs,
    maxTurns: spec.maxTurns ?? 4,
  });
  const bridged = await ctx.bridgeCliSessionToCatalog?.({ sessionKey, projectName: ctx.projectKey }).catch(() => null);
  const sessionId = bridged?.sessionId ?? sessionKey;
  const disk = inspectTranscript(sessionId);
  const asked = askedFromTurn(turn, disk);
  const wrotePptx = (turn.toolWritePaths ?? []).some((item) => /\.pptx$/i.test(String(item)));
  const titleOk = disk.titles.length === 0 || disk.titles.every((title) => title.includes('需要你选一下') || /Need a quick choice/.test(title));
  return {
    spec,
    sessionKey,
    sessionId,
    turn,
    disk,
    asked,
    wrotePptx,
    titleOk,
    pending: disk.pending,
    profileId: disk.profileId,
    caseDir,
  };
}

function judge(result) {
  const { spec, asked, wrotePptx, titleOk, pending, profileId, turn } = result;
  const checks = { asked, pending, profileId, wrotePptx, titleOk, timeout: Boolean(turn.timeout) };
  switch (spec.id) {
    case 'EI-ZHIHU':
      return { ok: asked === 0 && profileId !== 'ppt', checks };
    case 'EI-DUAL-SHADOW':
      return { ok: asked === 0, checks };
    case 'EI-DUAL-ENFORCE':
      return {
        ok: asked === 1 && titleOk && !wrotePptx
          && (!result.disk.purpose || result.disk.purpose === 'user_action_required'),
        checks: { ...checks, purpose: result.disk.purpose },
      };
    case 'EI-DUAL-CONTINUE':
    case 'EI-DUAL-QMARK':
    case 'EI-DUAL-GARBAGE':
      return {
        ok: Number(result.parentAsked) === 1 && asked === 0 && pending === false && profileId !== 'ppt',
        checks: { ...checks, parentAsked: result.parentAsked },
      };
    case 'EI-DIRECT':
      return { ok: asked === 0 && profileId !== 'ppt', checks };
    case 'EI-TRUE-PPT':
      return { ok: asked === 0 && profileId === 'ppt', checks };
    case 'EI-RESUME':
      return {
        ok: Number(result.parentAsked) === 1 && asked === 0,
        checks: { ...checks, parentAsked: result.parentAsked },
      };
    default:
      return { ok: false, checks };
  }
}

async function runPass(label, ws, ctx, specs, kpiPath) {
  const rows = [];
  for (const spec of specs) {
    console.log(`[ei-live] ▶ ${label} ${spec.id}`);
    try {
      let follow = null;
      if (spec.followUp) {
        const first = await runCase(ws, ctx, {
          ...spec,
          id: `${spec.id}-ASK`,
          message: DUAL,
          timeoutMs: spec.askTimeoutMs ?? 180_000,
        }, label);
        const firstAsked = askedFromTurn(first.turn, first.disk);
        follow = await runCase(ws, ctx, {
          ...spec,
          reuseSessionKey: first.sessionKey,
          message: spec.followUp,
        }, label);
        follow.asked = firstAsked > 0 ? follow.asked : firstAsked;
        follow.parentAsked = firstAsked;
        follow.sessionId = follow.sessionId || first.sessionId;
        follow.disk = inspectTranscript(follow.sessionId);
        follow.asked = follow.disk.asked > 1 ? follow.disk.asked - 1 : 0;
        follow.pending = follow.disk.pending;
        follow.profileId = follow.disk.profileId ?? first.profileId;
        follow.titleOk = first.titleOk;
      }
      const result = follow ?? await runCase(ws, ctx, spec, label);
      const judged = judge(result);
      const row = {
        id: spec.id,
        pass: label,
        ok: judged.ok,
        hard: spec.hard !== false,
        sessionId: result.sessionId,
        wallClockMs: result.turn.durationMs,
        asked: result.asked,
        pending: result.pending,
        profileId: result.profileId ?? null,
        tokensIn: result.disk.tokensIn,
        tokensOut: result.disk.tokensOut,
        titleOk: result.titleOk,
        wrotePptx: result.wrotePptx,
        timeout: Boolean(result.turn.timeout),
        purpose: result.disk.purpose ?? null,
        assistantPreview: String(result.turn.assistantText ?? '').slice(0, 240),
        checks: judged.checks,
      };
      rows.push(row);
      fs.appendFileSync(kpiPath, `${JSON.stringify(row)}\n`);
      fs.writeFileSync(path.join(result.caseDir, 'result.json'), `${JSON.stringify(row, null, 2)}\n`);
      console.log(`[ei-live] ${row.ok ? 'PASS' : 'FAIL'} ${spec.id} asked=${row.asked} profile=${row.profileId ?? '-'} pending=${row.pending}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const row = { id: spec.id, pass: label, ok: false, hard: spec.hard !== false, error: message };
      rows.push(row);
      fs.appendFileSync(kpiPath, `${JSON.stringify(row)}\n`);
      console.log(`[ei-live] FAIL ${spec.id} ${message}`);
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
    console.error(`[ei-live] FAIL: ${skip.reason}`);
    process.exit(1);
  }

  const token = await fetchSaasAuthToken(SERVER_URL);
  if (!token) {
    console.error('[ei-live] admin login failed');
    process.exit(1);
  }
  const { bridgeCliSessionToCatalog } = await import('./lib/bridgeCliSessionCatalog.mjs');
  const workspaceCwd = await ensureProjectWorkspace(SERVER_URL, token, PROJECT_NAME).catch(() => null)
    || await resolveGeneralWorkspaceCwd({ serverUrl: SERVER_URL, token });
  if (!workspaceCwd) {
    console.error('[ei-live] workspace cwd missing');
    process.exit(1);
  }
  const projectKey = await resolveProjectKey(token);
  console.log(`[ei-live] project=${projectKey} cwd=${workspaceCwd}`);
  const ctx = { projectKey, workspaceCwd, bridgeCliSessionToCatalog };
  const kpiPath = path.join(OUT_DIR, 'kpi.jsonl');
  fs.writeFileSync(kpiPath, '');
  let rows = [];
  let sticky = { skipped: true, ok: true };

  if (PASS === 'all' || PASS === 'shadow') {
    const ws = await connectGateway({ clientName: 'expensive-intent-shadow' });
    try {
      rows = rows.concat(await runPass('A-shadow', ws, ctx, [
        { id: 'EI-ZHIHU', message: ZHIHU, timeoutMs: 420_000, maxTurns: 8, hard: true },
        { id: 'EI-DUAL-SHADOW', message: DUAL, timeoutMs: 180_000, maxTurns: 3, hard: true },
      ], kpiPath));
    } finally {
      closeGateway(ws);
    }
    sticky = await runStickyRetest();
  }

  let enforceChild = null;
  try {
    if (PASS === 'all' || PASS === 'enforce') {
      const port = Number(process.env.EI_ENFORCE_GATEWAY_PORT || 19891);
      enforceChild = spawnEnforceGateway(port);
      const url = `ws://127.0.0.1:${port}/ws`;
      const up = await waitForGateway(url);
      if (!up) {
        rows.push({ id: 'EI-ENFORCE-GATEWAY', pass: 'B-enforce', ok: false, hard: true, error: `enforce Gateway not ready at ${url}` });
      } else {
        const ws = await connectGateway({ url, clientName: 'expensive-intent-enforce' });
        try {
          rows = rows.concat(await runPass('B-enforce', ws, ctx, [
            { id: 'EI-DUAL-ENFORCE', message: DUAL, timeoutMs: 180_000, maxTurns: 2, hard: true },
            { id: 'EI-DUAL-CONTINUE', followUp: '继续', timeoutMs: 180_000, maxTurns: 3, hard: true },
            { id: 'EI-DUAL-QMARK', followUp: '？', timeoutMs: 180_000, maxTurns: 3, hard: true },
            { id: 'EI-DUAL-GARBAGE', followUp: '啊？', timeoutMs: 180_000, maxTurns: 3, hard: true },
            { id: 'EI-DIRECT', message: `${DUAL}\n直接开始做`, timeoutMs: 180_000, maxTurns: 3, hard: true },
            { id: 'EI-TRUE-PPT', message: TRUE_PPT, timeoutMs: 180_000, maxTurns: 3, hard: true },
            {
              id: 'EI-RESUME',
              followUp: '<task-resume>\n<user_goal>继续完成点名文件</user_goal>\n</task-resume>',
              timeoutMs: 180_000,
              maxTurns: 3,
              hard: true,
            },
          ], kpiPath));
        } finally {
          closeGateway(ws);
        }
      }
    }
  } finally {
    stopChild(enforceChild);
  }

  const hardRows = rows.filter((row) => row.hard);
  const hardFail = hardRows.filter((row) => !row.ok);
  const reask = rows.filter((row) => Number(row.asked) > 1);
  const summary = {
    startedAt: new Date().toISOString(),
    serverUrl: SERVER_URL,
    projectKey: PROJECT_NAME,
    pass: rows.filter((row) => row.ok).length,
    hardPass: hardRows.filter((row) => row.ok).length,
    hardTotal: hardRows.length,
    total: rows.length,
    reask: reask.map((row) => row.id),
    sticky,
    ok: hardFail.length === 0 && reask.length === 0 && sticky.ok !== false,
    verdict: hardFail.length === 0 && reask.length === 0 ? 'GO(shadow)' : 'NO_GO',
    rows,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`[ei-live] hard ${summary.hardPass}/${summary.hardTotal} sticky=${sticky.ok} verdict=${summary.verdict}`);
  process.exit(summary.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
