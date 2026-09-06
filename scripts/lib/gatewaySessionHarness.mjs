#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Shared Gateway WebSocket harness for integration sims.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TOKEN_PATH = path.join(os.homedir(), '.pilotdeck', 'server-token');

export function getGatewayUrl() {
  const port = Number(process.env.PILOTDECK_GATEWAY_PORT || 18789);
  return `ws://127.0.0.1:${port}/ws`;
}

export function readGatewayToken() {
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error(`Missing ${TOKEN_PATH} — start dev:saas first`);
  }
  return fs.readFileSync(TOKEN_PATH, 'utf8').trim();
}

function req(id, method, params) {
  return JSON.stringify({ type: 'request', id, method, params });
}

export async function connectGateway(options = {}) {
  const token = options.token ?? readGatewayToken();
  const url = options.url ?? getGatewayUrl();
  const ws = new WebSocket(url);
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
        clientName: options.clientName ?? 'gateway-harness',
        clientVersion: '0.1.0',
        token,
      }),
    );
  });
  return ws;
}

export function newSession(ws, projectKey, channelKey = 'cli') {
  const id = `harness-new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
    ws.send(req(id, 'new_session', { channelKey, projectKey }));
  });
}

// PD-SAAS-FORK: Phase 7 — extract deliverable paths from tool_call_started.argsPreview
// (argsPreview is JSON.stringify(toolInput); write_file/compose/export carry the target path).
const DELIVERABLE_PATH_KEYS = [
  'path', 'file_path', 'filePath', 'file', 'fileName', 'file_name',
  'outputPath', 'output_path', 'output', 'target', 'target_path', 'dest', 'dest_path', 'save_path',
];
export function extractDeliverablePaths(argsPreview) {
  if (typeof argsPreview !== 'string' || argsPreview.length === 0) return [];
  const found = [];
  for (const key of DELIVERABLE_PATH_KEYS) {
    const re = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'g');
    let match;
    while ((match = re.exec(argsPreview)) !== null) {
      const raw = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      if (raw && !found.includes(raw)) found.push(raw);
    }
  }
  return found;
}

// PD-SAAS-FORK: Phase 7 — extract written paths from tool_call_finished.resultPreview.
// write_file/compose/export emit "Created <path>." / "Wrote ... to <path>"; this is the
// reliable source because argsPreview can bury the path key behind very long content.
const RESULT_PATH_RE =
  /(?:Created|Wrote|Saved|Updated|Exported|Generated|Rendered|已创建|已写入|已保存|已生成)\s+(?:.*?\bto\s+)?([A-Za-z0-9_.\-]+(?:[\\/][A-Za-z0-9_.\- ]+)*\.[A-Za-z0-9]+)/g;
export function extractResultPaths(resultPreview) {
  if (typeof resultPreview !== 'string' || resultPreview.length === 0) return [];
  const found = [];
  RESULT_PATH_RE.lastIndex = 0;
  let match;
  while ((match = RESULT_PATH_RE.exec(resultPreview)) !== null) {
    const raw = match[1].trim().replace(/[.。]+$/, '');
    if (raw && !found.includes(raw)) found.push(raw);
  }
  return found;
}

function normalizeWritePath(value) {
  return value.replace(/\\/g, '/');
}

/**
 * @param {import('ws').WebSocket} ws
 * @param {object} opts
 */
export function submitTurn(ws, opts) {
  const {
    sessionKey,
    message,
    projectKey = 'general',
    timeoutMs = 120_000,
    maxTurns = 8,
    tag = 'harness',
    mode = 'bypassPermissions',
    workspaceCwd,
    capabilityContext,
    onEvent,
    skipMessageTag = false,
    attachments,
  } = opts;
  const id = `${tag}-run-${Date.now()}`;
  return new Promise((resolve) => {
    let settled = false;
    const metrics = {
      recoveryAttempts: 0,
      recoveryExhausted: false,
      budgetRemainingSamples: [],
      toolCalls: {},
      stages: [],
      turnCompleted: false,
      stopReason: null,
      // PD-SAAS-FORK: Phase 7 multitask isolation + per-task acceptance observability.
      assistantText: '',
      acceptanceStatus: null,
      acceptanceFailureReasons: [],
      toolWritePaths: [],
      success: null,
      finishReason: null,
    };
    const startedAt = Date.now();
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.off('message', onMessage);
      resolve({
        durationMs: Date.now() - startedAt,
        ...metrics,
        ...result,
      });
    };
    const timer = setTimeout(() => {
      finish({ ok: false, timeout: true, resolvedBy: 'timeout' });
    }, timeoutMs);

    const onMessage = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'event' && msg.id === id) {
        const event = msg.event || {};
        onEvent?.(event);
        if (event.type === 'recovery_attempt') {
          metrics.recoveryAttempts += 1;
          if (typeof event.budgetRemaining === 'number') {
            metrics.budgetRemainingSamples.push(event.budgetRemaining);
          }
        }
        if (event.type === 'recovery_exhausted') {
          metrics.recoveryExhausted = true;
          if (typeof event.budgetRemaining === 'number') {
            metrics.budgetRemainingSamples.push(event.budgetRemaining);
          }
        }
        if (event.type === 'turn_stage_hint' && event.stage) {
          metrics.stages.push(event.stage);
        }
        if (event.type === 'assistant_text_delta' && typeof event.text === 'string') {
          metrics.assistantText += event.text;
        }
        if (event.type === 'tool_call_started') {
          const name = event.name || 'unknown';
          metrics.toolCalls[name] = (metrics.toolCalls[name] || 0) + 1;
          for (const writePath of extractDeliverablePaths(event.argsPreview)) {
            const norm = normalizeWritePath(writePath);
            if (!metrics.toolWritePaths.includes(norm)) metrics.toolWritePaths.push(norm);
          }
        }
        if (event.type === 'tool_call_finished') {
          for (const writePath of extractResultPaths(event.resultPreview)) {
            const norm = normalizeWritePath(writePath);
            if (!metrics.toolWritePaths.includes(norm)) metrics.toolWritePaths.push(norm);
          }
        }
        // PD-SAAS-FORK: acceptance_completed is delivered as agent_status with an inner event name.
        if (event.type === 'agent_status' && event.event === 'acceptance_completed') {
          if (event.detail?.status) metrics.acceptanceStatus = event.detail.status;
          if (Array.isArray(event.detail?.failureReasons)) {
            metrics.acceptanceFailureReasons = event.detail.failureReasons;
          }
        }
        if (event.type === 'turn_completed') {
          metrics.turnCompleted = true;
          if (typeof event.success === 'boolean') metrics.success = event.success;
          metrics.finishReason = event.finishReason ?? event.result?.stopReason ?? metrics.finishReason;
          metrics.stopReason = metrics.finishReason;
        }
        if (msg.final === true) {
          const toolCallCount = Object.values(metrics.toolCalls).reduce((a, b) => a + b, 0);
          const emptyTurn = metrics.turnCompleted
            && toolCallCount === 0
            && metrics.assistantText.trim().length === 0
            && Date.now() - startedAt < 5_000;
          finish({
            ok: (event.type === 'turn_completed' || metrics.turnCompleted) && !emptyTurn,
            timeout: false,
            resolvedBy: emptyTurn ? 'empty_turn' : 'final_event',
            emptyTurn,
          });
        }
      }
      if (msg.type === 'response' && msg.id === id) {
        if (!msg.ok) {
          finish({
            ok: false,
            timeout: false,
            error: msg.error?.message,
            resolvedBy: 'response',
          });
        }
        // PD-SAAS-FORK: submit_turn ack — wait for streaming final event, do not resolve early.
      }
    };
    ws.on('message', onMessage);
    ws.send(
      req(id, 'submit_turn', {
        sessionKey,
        channelKey: 'cli',
        projectKey,
        workspaceCwd: workspaceCwd || projectKey,
        mode,
        maxTurns,
        message: skipMessageTag ? message : `[${tag.toUpperCase()}] ${message}`,
        ...(capabilityContext?.slug ? { capabilityContext: {
          slug: capabilityContext.slug,
          displayName: capabilityContext.displayName || capabilityContext.slug,
          ...(capabilityContext.completionMode ? { completionMode: capabilityContext.completionMode } : {}),
          ...(capabilityContext.majorCategory ? { majorCategory: capabilityContext.majorCategory } : {}),
        } } : {}),
        promptLanguage: 'zh-CN',
        ...(Array.isArray(attachments) && attachments.length > 0 ? { attachments } : {}),
      }),
    );
  });
}

/** PD-SAAS-FORK: multi-turn harness for clarification follow-ups (e.g. K6 page count). */
export async function submitTurnSequence(ws, opts) {
  const { messages = [], ...rest } = opts;
  const results = [];
  for (const message of messages) {
    const result = await submitTurn(ws, { ...rest, message });
    results.push(result);
    if (!result.ok && !result.timeout) break;
  }
  return results;
}

export function closeGateway(ws) {
  try {
    ws.close();
  } catch {
    // ignore
  }
}

export { REPO_ROOT };
