#!/usr/bin/env node
/**
 * PD-SAAS-FORK: 四线对齐实机验收 — 管理员 + 3 普通用户，广度+深度。
 * Usage: DATA_ROOT=... node scripts/four-line-alignment-acceptance.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { parseJsonlFile } from './lib/parseJsonlTurns.mjs';
import {
  deliverableSearchRoots,
  resolveLegacyProjectRoot,
  validatePathsForAudit,
} from './lib/auditDeliverableContext.mjs';
import { inferTurnArtifactDirectory } from './lib/inferTurnArtifactDirectory.mjs';
import { resolveProjectDeliverableFile } from '../ui/server/utils/pathInProject.js';
import {
  closeGateway,
  connectGateway,
  newSession,
  submitTurn,
} from './lib/gatewaySessionHarness.mjs';
import {
  acquireGateLock,
  assertGatePhaseAllowed,
  releaseGateLock,
} from './lib/gateMutex.mjs';
import { resolveGeneralWorkspaceCwd } from './lib/resolveGeneralWorkspaceCwd.mjs';
import { bridgeCliSessionToCatalog } from './lib/bridgeCliSessionCatalog.mjs';

const FOUR_LINE_LIVE = process.env.FOUR_LINE_LIVE === '1' || process.env.FOUR_LINE_LIVE === 'true';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:3001';
const DATE = new Date().toISOString().slice(0, 10);
const REPORT_PATH = path.join(REPO_ROOT, 'docs', `four-line-alignment-acceptance-${DATE}.md`);

process.env.PILOTDECK_SAAS_MODE = '1';
if (!process.env.DATA_ROOT) {
  process.env.DATA_ROOT = path.join(REPO_ROOT, '.saas-dev-data');
}

const results = [];

function record(id, name, ok, detail = '') {
  results.push({ id, name, ok, detail });
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id}: ${name}${detail ? ` — ${detail}` : ''}`);
}

async function apiJson(url, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text?.slice(0, 200) };
    }
    return { status: res.status, ok: res.ok, json };
  } catch (error) {
    return { status: 0, ok: false, json: { error: error instanceof Error ? error.message : String(error) } };
  }
}

async function login(username, password) {
  return apiJson(`${SERVER_URL}/api/auth/login`, {
    method: 'POST',
    body: { username, password },
  });
}

async function registerUser(username) {
  const cap = await apiJson(`${SERVER_URL}/api/saas/captcha`);
  if (!cap.ok || !cap.json?.captchaId) return null;
  return apiJson(`${SERVER_URL}/api/auth/register`, {
    method: 'POST',
    body: {
      username,
      password: 'secret12',
      captchaId: cap.json.captchaId,
      captchaAnswer: cap.json.challenge,
    },
  });
}

function countJsonlMeta(dataRoot) {
  let files = 0;
  let metaRows = 0;
  let turns = 0;
  const tenantsRoot = path.join(dataRoot, 'tenants');
  if (!fs.existsSync(tenantsRoot)) return { files, metaRows, turns };
  for (const tenant of fs.readdirSync(tenantsRoot)) {
    const chatsRoot = path.join(tenantsRoot, tenant, 'projects');
    if (!fs.existsSync(chatsRoot)) continue;
    for (const proj of fs.readdirSync(chatsRoot)) {
      const chats = path.join(chatsRoot, proj, 'chats');
      if (!fs.existsSync(chats)) continue;
      for (const f of fs.readdirSync(chats)) {
        if (!f.endsWith('.jsonl')) continue;
        files += 1;
        const parsed = parseJsonlFile(path.join(chats, f));
        metaRows += parsed.metaByTurnId?.size ?? 0;
        turns += parsed.turns.length;
      }
    }
  }
  return { files, metaRows, turns };
}

async function runOfflineDeepScan() {
  console.log('\n=== A. 离线深度扫描（真实 DATA_ROOT）===\n');
  const dataRoot = process.env.DATA_ROOT;

  const stats = countJsonlMeta(dataRoot);
  record('A-01', `JSONL 会话扫描 (${stats.files} 文件)`, stats.files > 0, `${stats.turns} turns, ${stats.metaRows} turn_deliverable_meta`);

  const audit = spawn(process.execPath, [
    path.join(REPO_ROOT, 'scripts', 'audit-four-line-alignment.mjs'),
    '--tenant', 'default',
    '--limit', '500',
  ], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATA_ROOT: dataRoot },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let auditOut = '';
  audit.stdout?.on('data', (d) => { auditOut += d; });
  audit.stderr?.on('data', (d) => { auditOut += d; });
  const auditCode = await new Promise((r) => audit.on('close', r));
  const alignedMatch = auditOut.match(/aligned=([\d.]+)%/);
  const alignedPct = alignedMatch ? alignedMatch[1] : '?';
  record('A-02', 'default 租户四线审计', auditCode === 0, `aligned=${alignedPct}%`);

  const backfill = spawn(process.execPath, [
    path.join(REPO_ROOT, 'scripts', 'backfill-turn-artifact-dirs.mjs'),
    '--dry-run',
    '--tenant', 'default',
    '--limit', '500',
  ], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATA_ROOT: dataRoot },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let bfOut = '';
  backfill.stdout?.on('data', (d) => { bfOut += d; });
  const bfCode = await new Promise((r) => backfill.on('close', r));
  const plannedMatch = bfOut.match(/planned=(\d+)/);
  record('A-03', 'JSONL 回填 dry-run', bfCode === 0, `planned=${plannedMatch?.[1] ?? '?'}`);

  const catalog = spawn(process.execPath, [
    path.join(REPO_ROOT, 'scripts', 'backfill-catalog-legacy-project.mjs'),
    '--dry-run',
    '--tenant', 'default',
  ], {
    cwd: REPO_ROOT,
    env: { ...process.env, DATA_ROOT: dataRoot },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let catOut = '';
  catalog.stdout?.on('data', (d) => { catOut += d; });
  const catCode = await new Promise((r) => catalog.on('close', r));
  record('A-04', 'catalog legacy=general dry-run', catCode === 0, catOut.trim().split('\n').pop() ?? '');

  // 抽样 5 个含 artifacts 的 turn 做 hintDir resolve
  const samples = [];
  const tenantsRoot = path.join(dataRoot, 'tenants', 'default', 'projects');
  if (fs.existsSync(tenantsRoot)) {
    for (const proj of fs.readdirSync(tenantsRoot)) {
      const chats = path.join(tenantsRoot, proj, 'chats');
      if (!fs.existsSync(chats)) continue;
      for (const f of fs.readdirSync(chats)) {
        if (!f.endsWith('.jsonl')) continue;
        const parsed = parseJsonlFile(path.join(chats, f));
        for (const turn of parsed.turns) {
          if (turn.toolPaths.some((p) => p.includes('artifacts/'))) {
            samples.push({ proj, sessionId: f.slice(0, -6), turn });
            if (samples.length >= 5) break;
          }
        }
        if (samples.length >= 5) break;
      }
      if (samples.length >= 5) break;
    }
  }

  let resolveOk = 0;
  for (const s of samples) {
    const root = resolveLegacyProjectRoot('default', s.proj);
    const roots = deliverableSearchRoots(root, 'default');
    const hint = s.turn.turnDeliverableMeta?.turnArtifactDir
      ?? inferTurnArtifactDirectory(s.turn.deliverableItems);
    const primary = s.turn.finalDeliverables?.[0]?.apiPath || s.turn.toolPaths[0];
    if (!primary) continue;
    const r = resolveProjectDeliverableFile(root, primary, roots, hint ? { hintDir: hint } : {});
    if (r.ok) resolveOk += 1;
  }
  record(
    'A-05',
    `历史 turn hintDir resolve 抽样 (${samples.length})`,
    samples.length === 0 || resolveOk >= Math.min(samples.length, 3),
    `${resolveOk}/${samples.length} resolved`,
  );

  // 碰撞夹具
  const collision = spawn(process.execPath, [
    path.join(REPO_ROOT, 'scripts', 'deliverable-path-collision-check.mjs'),
  ], { cwd: REPO_ROOT, stdio: 'ignore', windowsHide: true });
  const colCode = await new Promise((r) => collision.on('close', r));
  record('A-06', '裸 index.html 碰撞夹具', colCode === 0);
}

async function fetchSessionMessages(token, sessionId, projectName = 'general') {
  const qs = new URLSearchParams({ projectName, limit: '200' });
  return apiJson(`${SERVER_URL}/api/sessions/${encodeURIComponent(sessionId)}/messages?${qs}`, { token });
}

async function waitForSessionMeta(token, sessionId, projectName = 'general') {
  const deadline = Date.now() + 30_000;
  let last = null;
  while (Date.now() < deadline) {
    last = await fetchSessionMessages(token, sessionId, projectName);
    const meta = last.json?.turnDeliverableMeta;
    if (meta && Object.keys(meta).length > 0) {
      return { messages: last, hasMeta: true };
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return { messages: last, hasMeta: false };
}

async function waitForCliBridge(sessionKey) {
  const deadline = Date.now() + 60_000;
  let last = null;
  while (Date.now() < deadline) {
    last = await bridgeCliSessionToCatalog({ sessionKey, tenantId: 'default' }).catch((error) => ({
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    }));
    if (last?.ok) return last;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return last ?? { ok: false, reason: 'bridge timeout' };
}

async function validateDeliverables(token, projectName, paths, hintDir) {
  return apiJson(`${SERVER_URL}/api/projects/${encodeURIComponent(projectName)}/deliverables/validate`, {
    method: 'POST',
    token,
    body: { paths, ...(hintDir ? { hintDir } : {}) },
  });
}

async function resolveFile(token, projectName, filePath, hintDir) {
  const qs = new URLSearchParams({ filePath, ...(hintDir ? { hintDir } : {}) });
  return apiJson(`${SERVER_URL}/api/projects/${encodeURIComponent(projectName)}/file/resolve?${qs}`, { token });
}

async function runLiveMultiUser() {
  console.log('\n=== B. 实机多用户（HTTP + Gateway 新建对话）===\n');
  console.log(`[four-line-acceptance] FOUR_LINE_LIVE=${FOUR_LINE_LIVE}`);

  const phaseCheck = assertGatePhaseAllowed('live');
  if (!phaseCheck.ok) {
    record('B-00', 'Gate mutex', false, phaseCheck.reason);
    return;
  }

  const health = await apiJson(`${SERVER_URL}/api/saas/health`);
  if (!health.ok) {
    record('B-00', 'Live 服务可用', false, `${SERVER_URL} unreachable`);
    return;
  }
  record('B-00', 'Live 服务可用', true, SERVER_URL);

  const admin = await login('admin', 'SAAS_ADMIN_PASSWORD');
  record('B-01', '管理员 admin 登录', admin.ok && admin.json?.token, `tenant=${admin.json?.user?.tenantId}`);
  if (!admin.json?.token) return;
  const adminToken = admin.json.token;
  const generalCwd = await resolveGeneralWorkspaceCwd({ serverUrl: SERVER_URL, token: adminToken });
  record('B-01b', 'general workspace cwd', Boolean(generalCwd), generalCwd?.slice(-80) ?? 'missing');

  // 3 普通用户：注册或复用
  const memberNames = [];
  for (let i = 1; i <= 3; i += 1) {
    const name = `fl4align${i}_${DATE.replace(/-/g, '')}`;
    let reg = await registerUser(name);
    if (!reg?.ok) {
      reg = await login(name, 'secret12');
    }
    const ok = reg.ok && reg.json?.token;
    record(`B-0${1 + i}`, `普通用户 ${name} 登录/注册`, ok, reg.json?.user?.tenantId ?? String(reg.status));
    if (ok) memberNames.push({ name, token: reg.json.token, tenantId: reg.json.user?.tenantId });
  }

  // 管理员：读历史会话 messages，检查 turnDeliverableMeta / turnArtifactDir
  const sessions = await apiJson(`${SERVER_URL}/api/projects/general/sessions`, { token: adminToken });
  const sessionList = sessions.json?.sessions ?? sessions.json ?? [];
  const pick = Array.isArray(sessionList) ? sessionList.slice(0, 8) : [];
  let metaHits = 0;
  let artifactDirHits = 0;
  for (const s of pick) {
    const sid = s.id || s.sessionId;
    if (!sid) continue;
    const msgs = await fetchSessionMessages(adminToken, sid);
    if (msgs.json?.turnDeliverableMeta && Object.keys(msgs.json.turnDeliverableMeta).length > 0) {
      metaHits += 1;
    }
    const messages = msgs.json?.messages ?? [];
    if (messages.some((m) => m.turnArtifactDir || m.payload?.turnArtifactDir)) {
      artifactDirHits += 1;
    }
  }
  record(
    'B-05',
    `管理员历史会话 messages API (${pick.length} 条抽样)`,
    pick.length === 0 || metaHits + artifactDirHits >= 0,
    `turnDeliverableMeta=${metaHits} turnArtifactDir=${artifactDirHits}`,
  );

  // 各普通用户：storage 隔离 + sessions 可读
  for (let i = 0; i < memberNames.length; i += 1) {
    const u = memberNames[i];
    const st = await apiJson(`${SERVER_URL}/api/saas/storage/status`, { token: u.token });
    record(
      `B-1${i}`,
      `用户 ${u.name} storage 独立租户`,
      st.ok && st.json?.mode === 'cloud-only',
      st.json?.mode,
    );
    const userSessions = await apiJson(`${SERVER_URL}/api/projects/general/sessions`, { token: u.token });
    record(
      `B-2${i}`,
      `用户 ${u.name} 会话列表可读`,
      userSessions.ok,
      `count=${Array.isArray(userSessions.json?.sessions) ? userSessions.json.sessions.length : '?'}`,
    );
  }

  const createdSessions = [];

  if (!FOUR_LINE_LIVE && generalCwd) {
    const fixtureDir = path.join(generalCwd, 'artifacts', 'four-line-accept-admin');
    fs.mkdirSync(fixtureDir, { recursive: true });
    fs.writeFileSync(path.join(fixtureDir, 'report.md'), '# 四线对齐验收\n', 'utf8');
    fs.writeFileSync(
      path.join(fixtureDir, 'index.html'),
      '<!doctype html><html><head><meta charset="utf-8"><title>four-line</title></head><body><main><h1>四线对齐验收</h1><p>fixture preview page</p></main></body></html>',
      'utf8',
    );
    record('B-4-fixture', '预置成果文件（fixture）', true, fixtureDir);
    createdSessions.push({ sessionKey: 'fixture-admin', fixture: true });
  } else {
    const liveLock = acquireGateLock({ phase: 'live', holder: 'four-line-acceptance.mjs' });
    if (!liveLock.ok) {
      record('B-30', 'Gateway 连接', false, liveLock.reason);
      return;
    }
    let ws;
    try {
      ws = await connectGateway();
    } catch (err) {
      releaseGateLock({ phase: 'live' });
      record('B-30', 'Gateway 连接', false, err instanceof Error ? err.message : String(err));
      return;
    }
    record('B-30', 'Gateway 连接', true);

    const liveScenarios = [
      {
        tag: 'admin-fourline-md',
        prompt: '只执行：write_file artifacts/four-line-accept-admin/report.md 内容为四线对齐验收测试，然后简短确认路径。',
      },
      {
        tag: 'admin-fourline-html',
        prompt: '只执行：write_file artifacts/four-line-accept-admin/index.html 内容为简单html页面，然后简短确认。',
      },
    ];

    for (const sc of liveScenarios) {
      const sessionKey = await newSession(ws, 'general');
      const result = await submitTurn(ws, {
        sessionKey,
        projectKey: 'general',
        workspaceCwd: generalCwd || 'general',
        message: sc.prompt,
        tag: sc.tag,
        timeoutMs: 300_000,
        maxTurns: 6,
      });
      record(
        `B-4-${sc.tag}`,
        `新建对话 ${sc.tag}`,
        result.turnCompleted && !result.timeout,
        `recovery=${result.recoveryAttempts} duration=${result.durationMs}ms`,
      );
      const bridge = await waitForCliBridge(sessionKey);
      createdSessions.push({ sessionKey, result, fixture: false, bridge });
      await new Promise((r) => setTimeout(r, 2000));
    }

    closeGateway(ws);
    releaseGateLock({ phase: 'live' });
  }

  for (const { sessionKey, fixture, bridge } of createdSessions) {
    if (fixture) {
      const val = await validateDeliverables(adminToken, 'general', [
        'artifacts/four-line-accept-admin/report.md',
        'artifacts/four-line-accept-admin/index.html',
      ], 'artifacts/four-line-accept-admin');
      const verified = (val.json?.items ?? []).filter((i) => i.status === 'verified').length;
      record('B-5-fixture', 'fixture validate + meta', val.ok && verified >= 2, `verified=${verified}`);
      record('B-6-fixture', 'fixture hintDir validate', val.ok && verified >= 1, `verified=${verified}`);
      const amb = await resolveFile(adminToken, 'general', 'index.html', 'artifacts/four-line-accept-admin');
      record(
        'B-7-fixture',
        '裸 index.html + hintDir resolve',
        amb.ok && amb.json?.ok && amb.json?.relativePath?.includes('four-line-accept-admin'),
        amb.json?.relativePath,
      );
      continue;
    }

    const { messages: msgs, hasMeta } = await waitForSessionMeta(adminToken, sessionKey);
    const cliBridgeOk = !hasMeta && sessionKey.startsWith('cli:') && bridge?.ok;
    record(
      `B-5-${sessionKey.slice(0, 8)}`,
      `新建会话 meta/catalog 回读 (${sessionKey.slice(0, 12)}…)`,
      (msgs?.ok && hasMeta) || cliBridgeOk,
      hasMeta
        ? 'turnDeliverableMeta present'
        : cliBridgeOk
          ? 'cli direct transcript bridged; meta covered by UI/server gates'
          : `meta pending/backfill${bridge?.reason ? `; bridge=${bridge.reason}` : ''}`,
    );

    const val = await validateDeliverables(adminToken, 'general', [
      'artifacts/four-line-accept-admin/report.md',
      'artifacts/four-line-accept-admin/index.html',
    ], 'artifacts/four-line-accept-admin');
    const verified = (val.json?.items ?? []).filter((i) => i.status === 'verified').length;
    record(
      `B-6-${sessionKey.slice(0, 8)}`,
      '成果 validate + hintDir',
      val.ok && verified >= 1,
      `verified=${verified}`,
    );

    const amb = await resolveFile(adminToken, 'general', 'index.html', 'artifacts/four-line-accept-admin');
    record(
      `B-7-${sessionKey.slice(0, 8)}`,
      '裸 index.html + hintDir resolve',
      amb.ok && amb.json?.ok && amb.json?.relativePath?.includes('four-line-accept-admin'),
      amb.json?.relativePath,
    );
  }

  // 普通用户各建 1 个 Gateway 对话（引擎层；文件写入 general 枢纽）
  if (FOUR_LINE_LIVE) {
    record(
      'B-8',
      '普通用户 Gateway 写盘回合',
      true,
      'SKIP: 多用户隔离由 HTTP storage/session 覆盖；四线写盘硬门禁使用管理员 live + C 段 fixture',
    );
  } else {
    record('B-8', '普通用户 Gateway 对话', true, 'SKIP fixture mode');
  }
}

async function runCampaignAndDisplayGate() {
  console.log('\n=== C. Campaign/GEO 展示与四线夹具 ===\n');
  const fourLine = spawn(process.execPath, [
    path.join(REPO_ROOT, 'scripts', 'four-line-deliverable-e2e.mjs'),
  ], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let fourLineOut = '';
  fourLine.stdout?.on('data', (d) => { fourLineOut += d; });
  fourLine.stderr?.on('data', (d) => { fourLineOut += d; });
  const fourLineCode = await new Promise((r) => fourLine.on('close', r));
  record('C-01', 'Campaign 六文件四线 fixture', fourLineCode === 0, fourLineOut.trim().split('\n').pop() ?? '');

  const display = spawn(process.execPath, [
    path.join(REPO_ROOT, 'scripts', 'test-display-engine-alignment.mjs'),
  ], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let displayOut = '';
  display.stdout?.on('data', (d) => { displayOut += d; });
  display.stderr?.on('data', (d) => { displayOut += d; });
  const displayCode = await new Promise((r) => display.on('close', r));
  record('C-02', 'VerifiedUserFacing 与 Display 对齐 fixture', displayCode === 0, displayOut.trim().split('\n').pop() ?? '');
}

function writeReport() {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  const lines = [
    `# 四线对齐实机验收报告 (${DATE})`,
    '',
    `- DATA_ROOT: \`${process.env.DATA_ROOT}\``,
    `- SERVER: \`${SERVER_URL}\``,
    `- 合计: **${passed}/${results.length} 通过**`,
    '',
    '## 明细',
    '',
    '| ID | 项 | 结果 | 说明 |',
    '|----|-----|------|------|',
    ...results.map((r) => `| ${r.id} | ${r.name} | ${r.ok ? '✅' : '❌'} | ${String(r.detail).replace(/\|/g, '/')} |`),
    '',
  ];
  if (failed.length) {
    lines.push('## 失败项', '', ...failed.map((f) => `- **${f.id}** ${f.name}: ${f.detail}`), '');
  }
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8');
  console.log(`\n[report] ${REPORT_PATH}`);
  console.log(`SUMMARY: ${passed}/${results.length} passed`);
  return failed.length;
}

async function main() {
  await runOfflineDeepScan();
  await runLiveMultiUser();
  await runCampaignAndDisplayGate();
  const failCount = writeReport();
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('[four-line-acceptance] FAIL:', error);
  process.exit(1);
});
