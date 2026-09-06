#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Live Gateway drive — 北京 AI 转型调研报告（research-report 路径收敛验收）
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import WebSocket from 'ws';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN_PATH = path.join(os.homedir(), '.pilotdeck', 'server-token');
const GATEWAY_PORT = Number(process.env.PILOTDECK_GATEWAY_PORT || 18789);
const GATEWAY_URL = `ws://127.0.0.1:${GATEWAY_PORT}/ws`;
const PROJECT_KEY = process.env.BEIJING_PROJECT || 'general';
const DATA_ROOT = process.env.DATA_ROOT || path.join(REPO_ROOT, '.saas-dev-data');
const TIMEOUT_MS = Number(process.env.BEIJING_TIMEOUT_MS || 1_800_000);
const MAX_TURNS = Number(process.env.BEIJING_MAX_TURNS || 24);

const BEIJING_PROMPT = [
  '帮我就【北京地区企业人工智能业务转型研究】做一份正式调研报告，3 步一次做完，存 artifacts/research-beijing-ai-{时间}/ 并报路径：',
  '1. 深度调研：web_search 后 write_file 保存 01-sources-and-synthesis.md（信息源 + 结论综述）。',
  '2. 图表：在同目录用 Markdown 表格 + Mermaid 表达关键数据。',
  '3. Word：write_file 03-report-body.md 后调用 export_document 导出正式 .docx。',
  '禁止 read_file skills/；export 失败时至少交付两个 md。直接开始做，做完告诉我文件路径。',
].join('\n');

const BEIJING_CONTINUE_PROMPT = [
  '调研综述已保存在 artifacts/research-beijing-ai-20260614-1500/01-sources-and-synthesis.md。',
  '请在此基础上完成剩余交付，不要重新调研：',
  '1. write_file 同目录 02-charts.md（关键数据 Mermaid + 表格）。',
  '2. write_file 03-report-body.md（摘要、正文、图表引用、结论建议）。',
  '3. export_document 将 03-report-body.md 导出为同目录 .docx。',
  '禁止 read_file skills/；若 export 失败至少交付 02 与 03 两个 md。做完报完整路径。',
].join('\n');

function readToken() {
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error(`Missing ${TOKEN_PATH} — start dev:saas first`);
  }
  return fs.readFileSync(TOKEN_PATH, 'utf8').trim();
}

function req(id, method, params) {
  return JSON.stringify({ type: 'request', id, method, params });
}

async function connectGateway() {
  const token = readToken();
  const ws = new WebSocket(GATEWAY_URL);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Gateway handshake timeout')), 30_000);
    ws.once('open', () => {
      clearTimeout(timer);
      resolve();
    });
    ws.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Gateway hello timeout')), 15_000);
    const onMessage = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'hello_ok') {
        clearTimeout(timer);
        ws.off('message', onMessage);
        resolve(msg);
      }
    };
    ws.on('message', onMessage);
    ws.send(
      JSON.stringify({
        type: 'hello',
        protocolVersion: '1.0',
        clientName: 'cli',
        clientVersion: '0.1.0',
        token,
      }),
    );
  });
  return ws;
}

function newSession(ws, projectKey) {
  const id = `beijing-new-${Date.now()}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('new_session timeout')), 30_000);
    const onMessage = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'response' && msg.id === id) {
        clearTimeout(timer);
        ws.off('message', onMessage);
        if (!msg.ok) reject(new Error(msg.error?.message || 'new_session failed'));
        else resolve(msg.result.sessionKey);
      }
    };
    ws.on('message', onMessage);
    ws.send(req(id, 'new_session', { channelKey: 'cli', projectKey }));
  });
}

function submitTurn(ws, sessionKey, message) {
  const id = `beijing-run-${Date.now()}`;
  return new Promise((resolve) => {
    const metrics = {
      recoveryAttempts: 0,
      recoveryExhausted: false,
      toolCalls: {},
      stages: [],
      turnCompleted: false,
      stopReason: null,
    };
    const startedAt = Date.now();
    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      resolve({ ok: false, timeout: true, durationMs: Date.now() - startedAt, ...metrics });
    }, TIMEOUT_MS);

    const onMessage = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'event' && msg.id === id) {
        const event = msg.event || {};
        if (event.type === 'recovery_attempt') {
          metrics.recoveryAttempts += 1;
        }
        if (event.type === 'recovery_exhausted') {
          metrics.recoveryExhausted = true;
        }
        if (event.type === 'turn_stage_hint' && event.stage) {
          metrics.stages.push(event.stage);
        }
        if (event.type === 'tool_call_started') {
          const name = event.name || 'unknown';
          metrics.toolCalls[name] = (metrics.toolCalls[name] || 0) + 1;
        }
        if (event.type === 'turn_completed') {
          metrics.turnCompleted = true;
          metrics.stopReason = event.result?.stopReason ?? null;
        }
      }
      if (msg.type === 'response' && msg.id === id) {
        clearTimeout(timer);
        ws.off('message', onMessage);
        resolve({
          ok: Boolean(msg.ok),
          timeout: false,
          durationMs: Date.now() - startedAt,
          error: msg.error?.message,
          ...metrics,
        });
      }
    };
    ws.on('message', onMessage);
    ws.send(
      req(id, 'submit_turn', {
        sessionKey,
        channelKey: 'cli',
        projectKey: PROJECT_KEY,
        workspaceCwd: PROJECT_KEY,
        mode: 'bypassPermissions',
        maxTurns: MAX_TURNS,
        message: `[BEIJING-AI-RECOVERY-TEST] ${message}`,
      }),
    );
  });
}

function walkArtifacts(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name.startsWith('research-') || ent.name.includes('beijing')) {
        acc.push(full);
      }
      walkArtifacts(full, acc);
    }
  }
  return acc;
}

function scanDeliverables(sinceMs) {
  const roots = [
    path.join(DATA_ROOT, 'tenants', 'default', 'cloud-storage'),
    path.join(os.homedir(), '.pilotdeck', 'projects', PROJECT_KEY),
    path.join(REPO_ROOT, 'general', 'artifacts'),
    path.join(REPO_ROOT, 'artifacts'),
  ];
  const found = { dirs: [], md: [], docx: [] };
  for (const root of roots) {
    for (const dir of walkArtifacts(root)) {
      const stat = fs.statSync(dir);
      if (stat.mtimeMs < sinceMs - 60_000) continue;
      found.dirs.push(dir);
      for (const f of fs.readdirSync(dir)) {
        const fp = path.join(dir, f);
        const st = fs.statSync(fp);
        if (st.mtimeMs < sinceMs - 60_000) continue;
        if (f.endsWith('.md')) found.md.push(fp);
        if (f.endsWith('.docx')) found.docx.push(fp);
      }
    }
  }
  return found;
}

async function writeReport(run, deliverables, sinceMs) {
  const mod = await import(pathToFileURL(path.join(REPO_ROOT, 'src/telemetry/recoveryTiming.ts')).href);
  const allEvents = await mod.loadRecoveryEventsFromLog();
  const events = allEvents.filter((e) => (e.recordedAtMs ?? 0) >= sinceMs);
  const byReason = mod.summarizeRecoveryByReason(events);

  const stamp = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(REPO_ROOT, 'docs', `beijing-ai-report-live-${stamp}.md`);
  const success =
    run.ok
    && !run.timeout
    && !run.recoveryExhausted
    && deliverables.md.length >= 1
    && (deliverables.docx.length >= 1 || deliverables.md.length >= 2);

  const lines = [
    `# 北京 AI 转型报告 Live 验收（${stamp}）`,
    '',
    `| 指标 | 值 |`,
    `|------|-----|`,
    `| 回合成功 | ${run.ok && !run.timeout ? '是' : '否'} |`,
    `| 超时 | ${run.timeout ? '是' : '否'} |`,
    `| 耗时 | ${Math.round(run.durationMs / 1000)}s |`,
    `| Recovery 次数 | ${run.recoveryAttempts} |`,
    `| Recovery 耗尽 | ${run.recoveryExhausted ? '是' : '否'} |`,
    `| stopReason | ${run.stopReason ?? '—'} |`,
    `| 验收结论 | ${success ? '**通过**' : '**未通过**'} |`,
    '',
    '## 工具调用',
    '',
    '| 工具 | 次数 |',
    '|------|------|',
    ...Object.entries(run.toolCalls)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => `| ${name} | ${count} |`),
    '',
    '## Recovery 分 reason',
    '',
    '| reason | 次数 |',
    '|--------|------|',
    ...Object.entries(byReason).map(([reason, s]) => `| ${reason} | ${s.count} |`),
    '',
    '## 交付物',
    '',
    `- research 目录：${deliverables.dirs.length}`,
    `- .md：${deliverables.md.length}`,
    `- .docx：${deliverables.docx.length}`,
    '',
    ...deliverables.md.map((p) => `- md: \`${p}\``),
    ...deliverables.docx.map((p) => `- docx: \`${p}\``),
  ];
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
  return { reportPath, success };
}

async function main() {
  const continueOnly = process.argv.includes('--continue');
  const prompt = continueOnly ? BEIJING_CONTINUE_PROMPT : BEIJING_PROMPT;
  console.log(`[beijing] mode=${continueOnly ? 'continue' : 'full'} Gateway ${GATEWAY_URL} timeout ${TIMEOUT_MS}ms maxTurns=${MAX_TURNS}`);
  const runStartedMs = Date.now();
  const ws = await connectGateway();
  console.log('[beijing] gateway connected');
  const sessionKey = await newSession(ws, PROJECT_KEY);
  console.log('[beijing] session created, submitting turn…');
  const run = await submitTurn(ws, sessionKey, prompt);
  ws.close();

  const deliverables = scanDeliverables(runStartedMs);
  const { reportPath, success } = await writeReport(run, deliverables, runStartedMs);

  console.log(
    `[beijing] done ok=${run.ok} timeout=${run.timeout} duration=${run.durationMs}ms recovery=${run.recoveryAttempts} exhausted=${run.recoveryExhausted}`,
  );
  console.log('[beijing] toolCalls:', run.toolCalls);
  console.log('[beijing] deliverables:', {
    dirs: deliverables.dirs.length,
    md: deliverables.md.length,
    docx: deliverables.docx.length,
  });
  console.log(`[beijing] Wrote ${reportPath}`);
  console.log(`[beijing] verdict: ${success ? 'PASS' : 'FAIL'}`);

  if (!success) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[beijing] FAIL:', err);
  process.exitCode = 1;
});
