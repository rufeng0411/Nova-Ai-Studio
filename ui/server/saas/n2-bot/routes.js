// PD-SAAS-FORK: N2 Bot β steward HTTP API — session / ops / chat / speak / delegate / schedule / control / session-actions.
import express from 'express';
import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { authenticateToken } from '../../middleware/auth.js';
import { getSaasRequestContext } from '../context.js';
import { catalogStore } from '../conversation/CatalogStore.js';
import { resolveCatalogLegacyProjectId } from '../conversation/catalogLegacyProjectId.js';
import { acceptTurn, pauseTurn, unpauseSession } from '../concurrency/turnAcceptanceService.js';
import { deleteSession } from '../../projects.js';
import { isN2BotSession } from '../../../../src/saas/n2Bot/n2BotFlags.js';
import { greetingForOpen, novaLine, novaSystemPrompt } from '../../../../src/saas/n2Bot/novaPersona.js';
import { buildN2OpsFeed, planStopAll } from '../../../../src/saas/n2Bot/opsFeed.js';
import { stripToolsFromChatPayload } from '../../../../src/saas/n2Bot/stewardChatGuard.js';
import {
  buildScheduleFire,
  parseScheduleUtterance,
} from '../../../../src/saas/n2Bot/scheduleFire.js';
import { isValidDeleteConfirmToken } from '../../../../src/saas/n2Bot/sessionVoiceActions.js';
import { resolveN2BotModeEffective } from '../../../../scripts/lib/platformFeatures.mjs';
import { listWorkspacesForUser } from '../storage/workspaceStore.js';
import {
  isGeneralAliasLegacyId,
  resolveWorkspaceDisplayLabel,
} from '../storage/fileStorageService.js';
import { createProjectId } from '../../utils/pilotPaths.js';

const router = express.Router();

function resolveMode() {
  return resolveN2BotModeEffective();
}

function requireHud(req, res, next) {
  const mode = resolveMode();
  if (mode === 'off') {
    return res.status(404).json({ error: 'n2_bot_off' });
  }
  return next();
}

function ctxOr401(res) {
  const ctx = getSaasRequestContext();
  if (!ctx?.tenantId || !ctx.userId) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }
  return ctx;
}

function newStewardSessionId() {
  const sep = process.platform === 'win32' ? '-' : ':';
  return `web${sep}s_${randomUUID()}`;
}

async function ensureStewardSession(ctx) {
  const existing = await catalogStore.getByKind({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    kind: 'n2_bot',
  });
  if (existing?.sessionId) {
    return existing;
  }
  const sessionId = newStewardSessionId();
  const legacyProjectId = resolveCatalogLegacyProjectId('general');
  const transcriptRelPath = `projects/${legacyProjectId}/chats/${sessionId}.jsonl`;
  const abs = path.join(ctx.tenantPilotHome, transcriptRelPath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, '', { flag: 'a' });
  await catalogStore.upsert({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    sessionId,
    legacyProjectId,
    transcriptRelPath,
    title: 'N2 Bot',
    customTitle: 'N2 Bot',
    kind: 'n2_bot',
    source: 'web',
    status: 'active',
    messageCount: 0,
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
  });
  return catalogStore.getBySessionId({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    sessionId,
  });
}

async function appendStewardJsonl(ctx, sessionId, role, text, extra = {}) {
  try {
    const row = await catalogStore.getBySessionId({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      sessionId,
    });
    if (!row?.transcriptRelPath) return;
    const abs = path.join(ctx.tenantPilotHome, row.transcriptRelPath);
    const line = JSON.stringify({
      type: 'durable_message',
      message: {
        role,
        content: [{ type: 'text', text }],
        metadata: { n2Bot: true, ...extra },
      },
      timestamp: new Date().toISOString(),
    });
    await appendFile(abs, `${line}\n`);
  } catch {
    // T0 must not block on jsonl
  }
}

function filesFromLatestMeta(meta) {
  const bindings = Array.isArray(meta?.slotBindings)
    ? meta.slotBindings
    : Array.isArray(meta?.certificate?.slotBindings)
      ? meta.certificate.slotBindings
      : Array.isArray(meta?.turnAcceptanceMeta?.slotBindings)
        ? meta.turnAcceptanceMeta.slotBindings
        : Array.isArray(meta?.latestTurnAcceptanceMeta?.slotBindings)
          ? meta.latestTurnAcceptanceMeta.slotBindings
          : [];
  if (!Array.isArray(bindings)) return [];
  return bindings
    .filter((slot) => typeof slot.path === 'string' && slot.path.trim())
    .map((slot) => ({
      path: slot.path,
      kind: String(slot.kind || path.extname(slot.path).slice(1) || 'file').toLowerCase(),
      label: slot.label || slot.slotName || path.basename(slot.path),
    }));
}

function certExtrasFromMeta(meta) {
  const files = filesFromLatestMeta(meta);
  const done = Number(meta?.done ?? meta?.turnAcceptanceMeta?.done ?? files.length) || files.length;
  const total = Number(meta?.total ?? meta?.turnAcceptanceMeta?.total ?? 0) || undefined;
  const step = typeof meta?.step === 'string'
    ? meta.step
    : (typeof meta?.turnAcceptanceMeta?.step === 'string' ? meta.turnAcceptanceMeta.step : undefined);
  const userActionRequired = Boolean(meta?.userActionRequired || meta?.turnAcceptanceMeta?.userActionRequired);
  const issue = meta?.issue || meta?.turnAcceptanceMeta?.issue || '';
  return { files, done, total, step, userActionRequired, issue };
}

function resolveOpsWorkspace(row, ctx, workspaces) {
  const legacy = String(row.legacyProjectId || '').trim();
  const generalSlug = ctx.tenantPilotHome ? createProjectId(ctx.tenantPilotHome) : '';
  const isGeneral = !legacy
    || isGeneralAliasLegacyId(legacy, ctx.tenantPilotHome)
    || legacy === generalSlug;
  if (isGeneral) {
    return { isGeneral: true, projectLabel: '通用' };
  }
  const ws = workspaces.find((item) => (
    item.legacyProjectId === legacy
    || (row.workspaceUuid && item.workspaceUuid === row.workspaceUuid)
  ));
  return {
    isGeneral: false,
    projectLabel: resolveWorkspaceDisplayLabel(ws, { name: legacy, displayName: ws?.displayName }) || legacy || '项目',
  };
}

router.post('/session', authenticateToken, requireHud, async (req, res) => {
  const ctx = ctxOr401(res);
  if (!ctx) return;
  try {
    const row = await ensureStewardSession(ctx);
    res.json({
      ok: true,
      sessionId: row.sessionId,
      greeting: greetingForOpen({ hasOpenedBefore: Boolean(row.messageCount) }),
    });
  } catch (error) {
    res.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/ops', authenticateToken, requireHud, async (req, res) => {
  const ctx = ctxOr401(res);
  if (!ctx) return;
  try {
    const steward = await catalogStore.getByKind({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      kind: 'n2_bot',
    });
    const rows = await catalogStore.listActiveForUser({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      limit: 200,
    });
    let workspaces = [];
    try {
      workspaces = await listWorkspacesForUser(ctx.userId, ctx.tenantId);
    } catch {
      workspaces = [];
    }
    const certificates = rows.map((row) => {
      let meta = {};
      try {
        meta = row.queuedPayloadJson ? JSON.parse(row.queuedPayloadJson) : {};
      } catch {
        meta = {};
      }
      const extras = certExtrasFromMeta(meta);
      return {
        sessionId: row.sessionId,
        complete: row.status === 'complete',
        acceptance: row.status === 'complete' ? 'passed' : undefined,
        issue: extras.issue || '',
        slotBindings: extras.files,
        done: extras.done,
        total: extras.total,
        step: extras.step,
        userActionRequired: extras.userActionRequired,
      };
    });
    let crons = [];
    try {
      const gateway = req.app?.locals?.gateway;
      if (gateway?.cronList) {
        const listed = await gateway.cronList({ includeHistory: false, limit: 100 });
        crons = (listed?.tasks || listed?.jobs || []).map((task) => ({
          taskId: task.taskId,
          sessionKey: task.sessionKey,
          message: task.message,
          nextRunAt: task.nextRunAt,
        }));
      }
    } catch {
      crons = [];
    }
    const items = buildN2OpsFeed({
      viewerUserId: ctx.userId,
      stewardSessionId: steward?.sessionId,
      rows: rows.map((row) => {
        const scope = resolveOpsWorkspace(row, ctx, workspaces);
        return {
          sessionId: row.sessionId,
          userId: row.userId,
          title: row.customTitle || row.title,
          summary: row.summary,
          firstPrompt: row.firstPrompt,
          kind: row.kind,
          executionStatus: row.executionStatus,
          deletedAt: row.deletedAt,
          legacyProjectId: row.legacyProjectId,
          workspaceUuid: row.workspaceUuid,
          lastActivityAt: row.lastActivityAt,
          isGeneral: scope.isGeneral,
          projectLabel: scope.projectLabel,
        };
      }),
      certificates,
      crons,
    });
    res.json({ items, stewardSessionId: steward?.sessionId ?? null, n2SessionId: steward?.sessionId ?? null });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/chat', authenticateToken, requireHud, async (req, res) => {
  const ctx = ctxOr401(res);
  if (!ctx) return;
  const body = stripToolsFromChatPayload({ ...(req.body || {}) });
  const text = String(body.text || body.prompt || '').trim();
  const locale = body.locale === 'en' ? 'en' : 'zh-CN';
  const reply = text
    ? novaLine('stillHere', locale)
    : novaLine('idle', locale);
  const persona = novaSystemPrompt(locale);
  res.setHeader('Cache-Control', 'no-store');
  if (req.headers.accept?.includes('text/event-stream')) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.write(`data: ${JSON.stringify({ delta: reply, persona })}\n\n`);
    res.end();
    return;
  }
  res.json({ text: reply, tools: [], acceptTurn: false, sessionKind: 'n2_bot' });
  const steward = await catalogStore.getByKind({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    kind: 'n2_bot',
  }).catch(() => null);
  if (steward?.sessionId && text) {
    void appendStewardJsonl(ctx, steward.sessionId, 'user', text);
    void appendStewardJsonl(ctx, steward.sessionId, 'assistant', reply);
  }
});

router.post('/speak', authenticateToken, requireHud, async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'empty_text' });
  const apiKey = process.env.DASHSCOPE_API_KEY
    || process.env.PILOTDECK_TTS_API_KEY
    || '';
  if (!apiKey) {
    return res.status(200).json({ ok: false, reason: 'no_key', fallback: 'browser' });
  }
  try {
    const model = process.env.PILOTDECK_N2_BOT_TTS_MODEL
      || 'cosyvoice-v3-flash';
    const voice = 'longxiaochun';
    const url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/audio/speech';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: text,
        voice,
        response_format: 'mp3',
        speed: 1.05,
      }),
    });
    if (!response.ok) {
      return res.status(200).json({ ok: false, reason: 'tts_failed', fallback: 'browser' });
    }
    const buf = Buffer.from(await response.arrayBuffer());
    const tmpDir = path.join(os.tmpdir(), 'n2-bot-tts');
    await mkdir(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, `${randomUUID()}.mp3`);
    await writeFile(tmpFile, buf);
    if (tmpFile.includes(`${path.sep}artifacts${path.sep}task-`)) {
      return res.status(200).json({ ok: false, reason: 'tts_path_guard', fallback: 'browser' });
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('X-N2-Bot-Tts', 'cosyvoice-longxiaochun');
    res.send(buf);
  } catch {
    res.status(200).json({ ok: false, reason: 'tts_error', fallback: 'browser' });
  }
});

router.post('/delegate', authenticateToken, requireHud, async (req, res) => {
  const ctx = ctxOr401(res);
  if (!ctx) return;
  const command = String(req.body?.command || req.body?.text || '').trim();
  const followUp = req.body?.followUpWorkerSessionId;
  const capabilityContext = req.body?.capabilityContext;
  if (!command) return res.status(400).json({ error: 'empty_command' });
  try {
    const steward = await catalogStore.getByKind({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      kind: 'n2_bot',
    });
    if (followUp && (followUp === steward?.sessionId || isN2BotSession(followUp))) {
      return res.status(400).json({ error: 'cannot_delegate_steward' });
    }
    const options = {
      sessionId: followUp || undefined,
      projectName: req.body?.projectName || 'general',
      capabilityContext,
      n2BotTier: 'T3',
    };
    const writer = { send: () => undefined };
    const result = await acceptTurn({
      command,
      options,
      writer,
      userId: ctx.userId,
      role: ctx.role ?? null,
      tenantId: ctx.tenantId,
    });
    res.json({ ok: true, result });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/schedule', authenticateToken, requireHud, async (req, res) => {
  const ctx = ctxOr401(res);
  if (!ctx) return;
  const steward = await catalogStore.getByKind({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    kind: 'n2_bot',
  });
  const parsed = parseScheduleUtterance(String(req.body?.text || req.body?.message || ''));
  let workerSessionId = String(req.body?.workerSessionId || req.body?.sessionKey || '').trim();
  if (!workerSessionId || workerSessionId === steward?.sessionId || isN2BotSession(workerSessionId)) {
    try {
      const created = await acceptTurn({
        command: parsed?.message || String(req.body?.message || req.body?.text || '计划任务'),
        options: {
          projectName: req.body?.projectName || 'general',
          n2BotTier: 'T3',
        },
        writer: { send: () => undefined },
        userId: ctx.userId,
        role: ctx.role ?? null,
        tenantId: ctx.tenantId,
      });
      workerSessionId = created?.result?.sessionId || created?.sessionId || '';
    } catch {
      workerSessionId = '';
    }
  }
  const built = buildScheduleFire({
    sessionKey: workerSessionId,
    message: parsed?.message || String(req.body?.message || ''),
    expression: req.body?.expression || parsed?.expression,
    runAt: req.body?.runAt,
    stewardSessionId: steward?.sessionId,
  });
  if (!built.ok) {
    return res.status(400).json(built);
  }
  try {
    const gateway = req.app?.locals?.gateway;
    if (!gateway?.cronCreate) {
      return res.json({ ok: true, queued: true, ...built, note: 'gateway_unavailable' });
    }
    const created = await gateway.cronCreate({
      sessionKey: built.sessionKey,
      message: built.message,
      schedule: built.schedule,
    });
    res.json({ ok: true, task: created });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/control', authenticateToken, requireHud, async (req, res) => {
  const ctx = ctxOr401(res);
  if (!ctx) return;
  const action = String(req.body?.action || '');
  const sessionId = String(req.body?.sessionId || '');
  const steward = await catalogStore.getByKind({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    kind: 'n2_bot',
  });
  const rows = await catalogStore.listActiveForUser({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
  });
  try {
    if (action === 'stopall') {
      const plan = planStopAll({
        viewerUserId: ctx.userId,
        stewardSessionId: steward?.sessionId,
        rows: rows.map((row) => ({
          sessionId: row.sessionId,
          userId: row.userId,
          kind: row.kind,
          executionStatus: row.executionStatus,
          deletedAt: row.deletedAt,
        })),
      });
      for (const id of plan.pauseIds) {
        await pauseTurn({
          sessionId: id,
          userId: ctx.userId,
          tenantId: ctx.tenantId,
          role: ctx.role ?? null,
          reason: 'n2_bot_stopall',
        });
      }
      return res.json({ ok: true, paused: plan.pauseIds, skippedOtherUser: plan.skippedOtherUser });
    }
    if (sessionId === steward?.sessionId || isN2BotSession(sessionId)) {
      return res.status(400).json({ error: 'cannot_control_steward' });
    }
    const owned = rows.find((row) => row.sessionId === sessionId && row.userId === ctx.userId);
    if (!owned) return res.status(404).json({ error: 'not_found' });
    if (action === 'pause') {
      await pauseTurn({
        sessionId,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        role: ctx.role ?? null,
        reason: 'n2_bot_pause',
      });
    } else if (action === 'resume') {
      await unpauseSession({
        sessionId,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
        role: ctx.role ?? null,
        reason: 'n2_bot_resume',
      });
    } else {
      return res.status(400).json({ error: 'unknown_action' });
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/session-actions', authenticateToken, requireHud, async (req, res) => {
  const ctx = ctxOr401(res);
  if (!ctx) return;
  if (req.body?.action !== 'delete') {
    return res.status(400).json({ error: 'only_delete' });
  }
  const sessionIds = Array.isArray(req.body?.sessionIds) ? req.body.sessionIds.map(String) : [];
  const confirmToken = String(req.body?.confirmToken || '');
  const steward = await catalogStore.getByKind({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    kind: 'n2_bot',
  });
  if (sessionIds.some((id) => id === steward?.sessionId || isN2BotSession(id))) {
    return res.status(400).json({ error: 'cannot_delete_steward' });
  }
  if (!confirmToken || !isValidDeleteConfirmToken(confirmToken, sessionIds)) {
    if (steward?.sessionId) {
      void appendStewardJsonl(ctx, steward.sessionId, 'assistant', novaLine('deleteAsk'), {
        elicit: {
          kind: 'confirm_delete',
          optionIds: ['confirm', 'cancel'],
          sessionIds,
        },
      });
    }
    return res.json({
      ok: false,
      needsConfirm: true,
      body: novaLine('deleteBody'),
    });
  }
  const deleted = [];
  for (const id of sessionIds) {
    const row = await catalogStore.getBySessionId({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      sessionId: id,
    });
    if (!row) continue;
    await deleteSession(row.legacyProjectId, id, {});
    deleted.push(id);
  }
  res.json({ ok: true, deleted });
});

export default router;
