#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Drive Wuyutai-style PPT task via Gateway, then compare recovery baseline.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import WebSocket from 'ws';
import { guessGeneralWorkspaceCwdFromDataRoot } from './lib/resolveGeneralWorkspaceCwd.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN_PATH = path.join(os.homedir(), '.pilotdeck', 'server-token');
const GATEWAY_PORT = Number(process.env.PILOTDECK_GATEWAY_PORT || 18789);
const GATEWAY_URL = `ws://127.0.0.1:${GATEWAY_PORT}/ws`;
const PROJECT_KEY = process.env.WUYUTAI_PROJECT || 'general';
/** 3 页大纲+生图默认 15min；10 页全量可设 WUYUTAI_TIMEOUT_MS=1200000 */
const TIMEOUT_MS = Number(process.env.WUYUTAI_TIMEOUT_MS || 900_000);
const BASELINE_PATH = path.join(REPO_ROOT, 'docs', 'recovery-baseline-wuyutai.json');

const WUYUTAI_PROMPT = [
  '用 PPT 生成做一套演示稿：【严格根据以下营销内容生成，使用国风简约茶韵风格设计】',
  '品牌：吴裕泰；主题：暑期整合营销活动。',
  '要点：1) 暑期冰饮与茶礼盒组合促销 2) 国风年轻客群触达 3) 门店+线上联动 4) 监测转化与复购。',
  '先输出 3 页大纲并逐页 generate_image 到 artifacts/slides-wuyutai-test/，写入 slide-manifest.json。',
  '禁止 bash 解析 docx；勿空转 recovery。',
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function countToolCalls(toolCalls = {}) {
  return Object.values(toolCalls).reduce((sum, count) => sum + Number(count || 0), 0);
}

export function classifyWuyutaiRunResult(run) {
  if (run?.ok && run.turnCompleted && !run.timeout) {
    return { kind: 'completed', pass: true };
  }
  if (run?.timeout && countToolCalls(run.toolCalls) > 0) {
    return { kind: 'partial_timeout', pass: false };
  }
  if (run?.timeout) {
    return { kind: 'timeout', pass: false };
  }
  if (run?.ok && !run.turnCompleted) {
    return { kind: 'incomplete_response', pass: false };
  }
  return { kind: 'failed', pass: false };
}

export function collectWuyutaiGatewayFrame(metrics, msg, requestId) {
  if (msg?.type !== 'event' || msg.id !== requestId) {
    return { done: false };
  }
  const event = msg.event || {};
  if (event.type === 'recovery_attempt') {
    metrics.recoveryAttempts += 1;
  }
  if (event.type === 'tool_call_started') {
    const name = event.name || 'unknown';
    metrics.toolCalls[name] = (metrics.toolCalls[name] || 0) + 1;
  }
  if (event.type === 'turn_completed') {
    metrics.turnCompleted = true;
  }
  if (msg.final === true) {
    return { done: true, ok: metrics.turnCompleted };
  }
  return { done: false };
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

  const helloOk = await new Promise((resolve, reject) => {
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
  console.log('[wuyutai] gateway hello_ok', helloOk.serverVersion || '');
  return ws;
}

function newSession(ws, projectKey) {
  const id = `wuyutai-new-${Date.now()}`;
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

function submitTurn(ws, sessionKey, message, workspaceCwd) {
  const id = `wuyutai-run-${Date.now()}`;
  return new Promise((resolve) => {
    const metrics = {
      recoveryAttempts: 0,
      toolCalls: {},
      turnCompleted: false,
    };
    const startedAt = Date.now();
    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      resolve({ ok: false, timeout: true, durationMs: Date.now() - startedAt, ...metrics });
    }, TIMEOUT_MS);

    const onMessage = (raw) => {
      const msg = JSON.parse(raw.toString());
      const frameResult = collectWuyutaiGatewayFrame(metrics, msg, id);
      if (frameResult.done) {
        clearTimeout(timer);
        ws.off('message', onMessage);
        resolve({
          ok: Boolean(frameResult.ok),
          timeout: false,
          durationMs: Date.now() - startedAt,
          ...metrics,
        });
        return;
      }
      if (msg.type === 'response' && msg.id === id) {
        clearTimeout(timer);
        ws.off('message', onMessage);
        resolve({
          ok: Boolean(msg.ok),
          timeout: false,
          durationMs: Date.now() - startedAt,
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
        workspaceCwd: workspaceCwd || PROJECT_KEY,
        mode: 'bypassPermissions',
        maxTurns: 12,
        message: `[WUYUTAI-RECOVERY-TEST] ${message}`,
      }),
    );
  });
}

async function compareRecoveryBaseline(sinceMs = 0) {
  const mod = await import(pathToFileURL(path.join(REPO_ROOT, 'src/telemetry/recoveryTiming.ts')).href);
  const allEvents = await mod.loadRecoveryEventsFromLog();
  const events =
    sinceMs > 0 ? allEvents.filter((e) => (e.recordedAtMs ?? 0) >= sinceMs) : allEvents;
  const byReason = mod.summarizeRecoveryByReason(events);
  const total = events.length;
  let baselineTotal = total;
  let baselineExists = false;
  if (fs.existsSync(BASELINE_PATH)) {
    baselineExists = true;
    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    baselineTotal = baseline.sampleCount ?? total;
  }
  const reduction =
    baselineExists && baselineTotal > 0
      ? Math.round(((baselineTotal - total) / baselineTotal) * 100)
      : 0;

  const stamp = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(REPO_ROOT, 'docs', `recovery-stability-report-${stamp}.md`);
  const lines = [
    `# Recovery 稳定性报告（${stamp}）`,
    '',
    sinceMs > 0
      ? `本回合 recovery 事件：**${total}**（基线 ${baselineTotal}，变化 ${reduction}%）`
      : `总 recovery 事件：**${total}**（基线 ${baselineTotal}，变化 ${reduction}%）`,
    '',
    '| reason | 次数 |',
    '|--------|------|',
    ...Object.entries(byReason)
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([reason, stats]) => `| ${reason} | ${stats.count} |`),
    '',
    reduction >= 50
      ? '**达标**：recovery 较基线下降 ≥50%'
      : baselineExists
        ? '**待优化**：recovery 未达 50% 降幅目标'
        : '**首次基线**：已写入 docs/recovery-baseline-wuyutai.json',
  ];
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
  return { total, baselineTotal, reduction, reportPath, byReason };
}

async function main() {
  const compareOnly = process.argv.includes('--compare-only');
  if (compareOnly) {
    const result = await compareRecoveryBaseline();
    console.log(`recovery events: ${result.total} (baseline ${result.baselineTotal}, ${result.reduction}%)`);
    console.log(`Wrote ${result.reportPath}`);
    return;
  }

  console.log(`[wuyutai] Gateway ${GATEWAY_URL} timeout ${TIMEOUT_MS}ms`);
  const workspaceCwd =
    process.env.WUYUTAI_WORKSPACE_CWD?.trim() ||
    guessGeneralWorkspaceCwdFromDataRoot(process.env.DATA_ROOT || path.join(REPO_ROOT, '.saas-dev-data')) ||
    PROJECT_KEY;
  console.log(`[wuyutai] workspaceCwd=${workspaceCwd.slice(-96)}`);
  const runStartedMs = Date.now();
  const ws = await connectGateway();
  const sessionKey = await newSession(ws, PROJECT_KEY);
  console.log('[wuyutai] session created, submitting turn…');
  const run = await submitTurn(ws, sessionKey, WUYUTAI_PROMPT, workspaceCwd);
  ws.close();

  console.log(
    `[wuyutai] done ok=${run.ok} timeout=${run.timeout} duration=${run.durationMs}ms recoveryAttempts=${run.recoveryAttempts}`,
  );
  console.log('[wuyutai] toolCalls:', run.toolCalls);
  const classification = classifyWuyutaiRunResult(run);
  console.log(`[wuyutai] classification=${classification.kind} pass=${classification.pass}`);

  const result = await compareRecoveryBaseline(runStartedMs);
  console.log(`recovery events (this run): ${result.total} (baseline ${result.baselineTotal}, ${result.reduction}%)`);
  console.log(`Wrote ${result.reportPath}`);

  if (!classification.pass) {
    process.exitCode = 1;
  }
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
