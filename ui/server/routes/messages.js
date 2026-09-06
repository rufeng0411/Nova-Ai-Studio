/**
 * Unified session messages endpoint (PilotDeck-only).
 *
 * GET /api/sessions/:sessionId/messages?projectName=&projectPath=&limit=&offset=
 *
 * Reads transcripts through the gateway's `readSessionMessages` RPC.
 * Previously this route imported `readWebSessionMessages` directly from
 * `dist/src/web/server/` — that coupled `ui/server/` to compiled
 * artifacts and meant `src/` edits were silently invisible until a
 * `npm run build`. Going through the gateway WebSocket means the
 * standalone `pilotdeck server` process owns the read path and we pick
 * up its in-flight session writes automatically.
 *
 * @module routes/messages
 */

import express from 'express';
import { stat } from 'node:fs/promises';
import {
  getPilotDeckGateway,
  getPilotDeckGatewayIfReady,
  getPilotDeckReadGatewayIfReady,
  isSessionActiveViaGateway,
} from '../pilotdeck-bridge.js';
import { createNormalizedMessage } from '../pilotdeck-message.js';
import { resolveTenantSafeProjectKey } from '../saas/tenant/projectGuard.js';
import { getSaasRequestContext } from '../saas/context.js';
import { resolveTranscriptProjectKeyForProjectName } from '../saas/storage/fileStorageService.js';
import {
  readWebSessionMessages,
  sanitizeTurnAcceptanceMetaForHistoryWire,
} from '../../../src/web/server/readSessionMessages.js';
import {
  isHistorySanitizeEnabled,
  sanitizeHistoryMessages,
  sanitizeTurnDeliverableMeta,
} from '../../../src/web/server/historyMessageSanitize.js';
import { isHistoryMessageCacheEnabled } from '../../../src/web/server/historyReadFlags.js';
import { resolvePilotHome } from '../utils/pilotPaths.js';
import { isSaasMode } from '../saas/mode.js';
import { getCatalogEntryForSession } from '../saas/conversation/catalogReadPath.js';
import { resolveSessionTranscriptAbsPath } from '../saas/conversation/resolveSessionTranscriptPath.js';
import { cacheGet, cacheSet, getDefaultTtl } from '../saas/cache/redisClient.js';
import { sessionMessagesTailKey } from '../saas/cache/cacheKeys.js';
import { readTranscript } from '../../../src/session/index.js';
import {
  buildTaskResumeContextFromTranscript,
  detectIncompleteTurn,
} from '../../../src/session/resume/buildTaskResumeContext.js';
import { resolveTerminalCompleteFromTranscript } from '../../../src/session/resume/sessionTerminalFromTranscript.js';
import { resolveSaasSessionReadAccess } from '../saas/conversation/sessionReadAccess.js';
import { isColdResumeEnabled } from '../../../src/saas/resilience/stabilityFlags.js';
import {
  decideColdResume,
  parseActivityMs,
  resolveColdResumeConfig,
} from '../../../src/session/resume/coldResumeGuard.js';
import { readColdResumeGuard, recordColdResumeFired } from '../saas/resume/coldResumeStore.js';
import { recordStabilityEvent } from '../../../src/telemetry/stabilityEvents.js';
import {
  isSessionStale,
  parseSessionLastActivityMs,
  resolveStaleSessionPauseMs,
} from '../../../src/saas/concurrency/staleSessionPausePolicy.js';
import { markSessionAutoStalePaused } from '../saas/concurrency/staleSessionAutoPause.js';
import { requestBackpressure } from '../middleware/requestBackpressure.js';

const router = express.Router();
// PD-SAAS-FORK: HTML export uses a dedicated backpressure bucket so it does not fight session open.
router.use((req, res, next) => {
  const kind = req.query.purpose === 'export' ? 'messages_export' : 'messages';
  requestBackpressure(kind)(req, res, next);
});

const MESSAGES_ROUTE_BUDGET_MS = Number(process.env.PILOTDECK_MESSAGES_ROUTE_BUDGET_MS || 12_000);
const REPO_ROOT = process.cwd();
/** PD-SAAS-FORK: never block history load behind a long agent turn on the shared gateway WS. */
const GATEWAY_READ_TIMEOUT_MS = 5_000;
const SESSION_ACCESS_TIMEOUT_MS = 3_000;

/**
 * @param {import('../../../src/web/server/readSessionMessages.js').WebReadSessionMessagesInput} gatewayInput
 * @param {{ projectRoot: string, pilotHome: string, transcriptAbsPath?: string }} diskReadOpts
 * @param {string | null | undefined} transcriptAbsPath
 */
async function readTranscriptMessagesForRequest(gatewayInput, diskReadOpts, transcriptAbsPath) {
  // SaaS: disk-first when transcript path is known — gateway may be busy with auto-resume turns.
  if (isSaasMode() && transcriptAbsPath) {
    try {
      return await readWebSessionMessages(gatewayInput, diskReadOpts);
    } catch (diskError) {
      console.warn(
        '[messages] SaaS disk read failed, trying gateway:',
        diskError instanceof Error ? diskError.message : diskError,
      );
    }
  }

  let result;
  const gw = await getPilotDeckReadGatewayIfReady();
  if (gw) {
    try {
      result = await Promise.race([
        gw.readSessionMessages(gatewayInput),
        new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error('read_session_messages timeout')),
            GATEWAY_READ_TIMEOUT_MS,
          );
        }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('not connected') && !message.includes('timeout')) {
        throw error;
      }
    }
  }

  const gatewayMessageCount = result?.messages?.length ?? 0;
  const gatewayTotal = typeof result?.total === 'number' ? result.total : gatewayMessageCount;
  const needsDiskFallback = !result || (gatewayTotal === 0 && Boolean(transcriptAbsPath));
  if (needsDiskFallback) {
    const diskResult = await readWebSessionMessages(gatewayInput, diskReadOpts);
    const diskTotal = typeof diskResult.total === 'number'
      ? diskResult.total
      : (diskResult.messages?.length ?? 0);
    if (!result || diskTotal > gatewayTotal) {
      return diskResult;
    }
  }

  return result ?? { messages: [], total: 0 };
}

async function resolveSessionReadAccessWithTimeout(sessionId) {
  try {
    return await Promise.race([
      resolveSaasSessionReadAccess(sessionId),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('session_read_access_timeout')), SESSION_ACCESS_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    const saasCtx = getSaasRequestContext();
    const tenantPilotHome = saasCtx?.tenantPilotHome;
    if (!isSaasMode() || !tenantPilotHome) {
      throw error;
    }
    const transcriptAbsPath = await resolveSessionTranscriptAbsPath({
      sessionId,
      tenantPilotHome,
      catalogTranscriptRel: null,
    });
    if (!transcriptAbsPath) {
      return {
        allowed: false,
        status: 503,
        error: 'Conversation temporarily unavailable.',
      };
    }
    console.warn(
      '[messages] session access slow; disk fallback:',
      error instanceof Error ? error.message : error,
    );
    return {
      allowed: true,
      transcriptAbsPath,
      pilotHome: tenantPilotHome,
      tenantPilotHome,
      catalogTranscriptRel: null,
    };
  }
}

async function resolveSessionProjectContext(req, sessionId) {
  const projectName = req.query.projectName ? String(req.query.projectName) : '';
  let requestedProjectPath = req.query.projectPath ? String(req.query.projectPath) : '';
  if (projectName) {
    const sessionKey = await resolveTranscriptProjectKeyForProjectName(projectName);
    if (sessionKey) {
      requestedProjectPath = sessionKey;
    } else if (!requestedProjectPath) {
      requestedProjectPath = projectName;
    }
  }
  const safe = await resolveTenantSafeProjectKey(
    requestedProjectPath ? String(requestedProjectPath) : '',
  );
  if (!safe.allowed) {
    return { error: 'Project is not accessible for the current account.' };
  }
  const projectPath = safe.projectKey || REPO_ROOT;
  const tenantPilotHome = getSaasRequestContext()?.tenantPilotHome;
  const pilotHome = tenantPilotHome ?? resolvePilotHome(process.env);
  let catalogTranscriptRel = null;
  if (isSaasMode()) {
    const catalogRow = await getCatalogEntryForSession(sessionId);
    if (catalogRow?.transcriptRelPath) {
      catalogTranscriptRel = catalogRow.transcriptRelPath;
    }
  }
  const transcriptAbsPath = isSaasMode()
    ? await resolveSessionTranscriptAbsPath({
        sessionId,
        tenantPilotHome: pilotHome,
        catalogTranscriptRel,
      })
    : null;
  return { projectPath, pilotHome, transcriptAbsPath };
}

// PD-SAAS-FORK: structured resume payload for UI auto-continue (P0-4)
router.get('/:sessionId/resume-context', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const access = await resolveSaasSessionReadAccess(sessionId);
    if (!access.allowed) {
      return res.status(access.status).json({ resumeContext: null, error: access.error });
    }
    const ctx = await resolveSessionProjectContext(req, sessionId);
    if (ctx.error) {
      return res.status(403).json({ resumeContext: null, error: ctx.error });
    }
    if (!ctx.transcriptAbsPath) {
      return res.json({ resumeContext: null, incomplete: null });
    }
    const readResult = await readTranscript(ctx.transcriptAbsPath);
    const resumeContext = buildTaskResumeContextFromTranscript(readResult.entries);
    const incomplete = detectIncompleteTurn(readResult.entries);
    return res.json({
      resumeContext,
      incomplete: incomplete
        ? {
            turnId: incomplete.turnId,
            userGoal: incomplete.userGoal,
            lastCompletedStep: incomplete.lastCompletedStep,
            blockedOn: incomplete.blockedOn,
            lastActivityAt: incomplete.lastActivityAt,
          }
        : null,
    });
  } catch (error) {
    console.error('[resume-context]', error);
    return res.status(500).json({ resumeContext: null, error: 'Failed to build resume context.' });
  }
});

// PD-SAAS-FORK (P0-2): server-anchored cold-resume claim.
//
// The UI calls this at load-time when it detects a possibly-interrupted last turn (cold reconnect /
// full-stack restart). The SERVER owns idempotency + crash-loop budget + recency, so refreshes,
// multiple tabs and crash loops can NEVER trigger a resume storm. The claim is atomic: only the
// caller that records the fire is told allowed=true. Single-machine OSS has no control plane and is
// always denied (harmless). Gated OFF by default in production (PILOTDECK_COLD_RESUME).
router.post('/:sessionId/cold-resume', async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!isColdResumeEnabled()) {
      return res.json({ allowed: false, reason: 'disabled' });
    }
    if (!isSaasMode()) {
      return res.json({ allowed: false, reason: 'no_control_plane' });
    }
    const access = await resolveSaasSessionReadAccess(sessionId);
    if (!access.allowed) {
      return res
        .status(access.status)
        .json({ allowed: false, reason: 'forbidden', error: access.error });
    }
    const saasCtx = getSaasRequestContext();
    const tenantId = saasCtx?.tenantId;
    const userId = saasCtx?.userId;
    if (!tenantId || !userId) {
      return res.json({ allowed: false, reason: 'no_control_plane' });
    }
    const ctx = await resolveSessionProjectContext(req, sessionId);
    if (ctx.error || !ctx.transcriptAbsPath) {
      return res.json({ allowed: false, reason: 'no_incomplete_turn' });
    }
    const readResult = await readTranscript(ctx.transcriptAbsPath);
    const incomplete = detectIncompleteTurn(readResult.entries);
    if (!incomplete) {
      return res.json({ allowed: false, reason: 'no_incomplete_turn' });
    }
    if (isSessionActiveViaGateway(sessionId)) {
      recordStabilityEvent({
        event: 'cold_resume_suppressed',
        sessionId,
        turnId: incomplete.turnId,
        reason: 'gateway_turn_active',
      });
      return res.json({ allowed: false, reason: 'gateway_turn_active' });
    }
    const terminalDecision = resolveTerminalCompleteFromTranscript(
      readResult.entries,
      incomplete.turnId,
    );
    if (terminalDecision.terminal) {
      recordStabilityEvent({
        event: 'cold_resume_suppressed',
        sessionId,
        turnId: incomplete.turnId,
        reason: 'terminal_complete',
        detail: { terminalReason: terminalDecision.reason },
      });
      return res.json({
        allowed: false,
        reason: 'terminal_complete',
        terminalReason: terminalDecision.reason,
      });
    }
    const catalogRow = await getCatalogEntryForSession(sessionId);
    if (catalogRow?.executionStatus === 'paused') {
      return res.json({ allowed: false, reason: 'session_paused' });
    }
    const guard = await readColdResumeGuard({
      tenantId,
      userId,
      sessionId,
      turnId: incomplete.turnId,
    });
    const nowMs = Date.now();
    const lastActivityMs = parseActivityMs(incomplete.lastActivityAt) ?? guard.lastActivityAtMs;
    const stalePauseMs = resolveStaleSessionPauseMs(process.env);
    const catalogLastMs = parseSessionLastActivityMs(catalogRow?.lastActivityAt ?? null);
    const recencyMs = lastActivityMs ?? catalogLastMs;
    if (isSessionStale(recencyMs, nowMs, stalePauseMs)) {
      await markSessionAutoStalePaused({ tenantId, userId, sessionId }).catch(() => undefined);
      recordStabilityEvent({
        event: 'cold_resume_suppressed',
        sessionId,
        turnId: incomplete.turnId,
        reason: 'stale_auto_paused',
      });
      return res.json({ allowed: false, reason: 'stale_auto_paused' });
    }
    const decision = decideColdResume({
      incomplete: { turnId: incomplete.turnId, blockedOn: incomplete.blockedOn },
      lastActivityMs,
      nowMs,
      priorAttempts: guard.attempts,
      lastFiredAtMs: guard.lastFiredAtMs,
      userBlocked: incomplete.blockedOn === 'permission',
      config: resolveColdResumeConfig(),
    });
    if (!decision.allowed) {
      recordStabilityEvent({
        event: 'cold_resume_suppressed',
        sessionId,
        turnId: incomplete.turnId,
        reason: decision.reason,
      });
      return res.json({ allowed: false, reason: decision.reason });
    }
    // Record the fire BEFORE telling the UI it may resume, so a crash mid-resume still counts
    // against the budget (fail-closed: if the store write fails we deny rather than risk a loop).
    const attempts = await recordColdResumeFired({
      tenantId,
      userId,
      sessionId,
      turnId: incomplete.turnId,
      firedAtMs: nowMs,
      lastActivityAtMs: lastActivityMs ?? undefined,
    });
    if (attempts == null) {
      return res.json({ allowed: false, reason: 'no_control_plane' });
    }
    const resumeContext = buildTaskResumeContextFromTranscript(readResult.entries);
    recordStabilityEvent({
      event: 'cold_resume_fired',
      sessionId,
      turnId: incomplete.turnId,
      detail: { attempts },
    });
    return res.json({
      allowed: true,
      reason: 'allowed',
      turnId: incomplete.turnId,
      attempts,
      resumeContext,
    });
  } catch (error) {
    console.error('[cold-resume]', error);
    return res.status(500).json({ allowed: false, reason: 'error' });
  }
});

router.get('/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const projectName = req.query.projectName ? String(req.query.projectName) : '';

    const access = await resolveSessionReadAccessWithTimeout(sessionId);
    if (!access.allowed) {
      return res.status(access.status).json({
        messages: [],
        total: 0,
        hasMore: false,
        offset: 0,
        limit: null,
        error: access.error,
      });
    }

    let requestedProjectPath = req.query.projectPath ? String(req.query.projectPath) : '';
    // PD-SAAS-FORK: transcript reads use canonical session key when workspace is registered.
    if (projectName) {
      const sessionKey = await resolveTranscriptProjectKeyForProjectName(projectName);
      if (sessionKey) {
        requestedProjectPath = sessionKey;
      } else if (!requestedProjectPath) {
        requestedProjectPath = projectName;
      }
    }
    // PD-SAAS-FORK: clamp the gateway projectKey to the current tenant's
    // boundary. In SaaS, an out-of-tenant path (e.g. the single-user install's
    // `~/.pilotdeck` projects) is denied instead of leaking another context's
    // transcript; a blank key anchors to the tenant general home, never the
    // server process cwd. Outside SaaS this passes through unchanged.
    const safe = await resolveTenantSafeProjectKey(
      requestedProjectPath ? String(requestedProjectPath) : '',
    );
    if (!safe.allowed) {
      return res.status(403).json({
        messages: [],
        total: 0,
        hasMore: false,
        offset: 0,
        limit: null,
        error: 'Project is not accessible for the current account.',
      });
    }
    const projectPath = safe.projectKey || REPO_ROOT;

    // PD-SAAS-FORK: resolve transcript via catalog row when available.
    let catalogTranscriptRel = access.catalogTranscriptRel ?? null;
    if (catalogTranscriptRel == null && isSaasMode()) {
      const catalogRow = access.catalogRow ?? await getCatalogEntryForSession(sessionId);
      if (catalogRow?.transcriptRelPath) {
        catalogTranscriptRel = catalogRow.transcriptRelPath;
      }
    }

    const tenantPilotHome = access.tenantPilotHome ?? getSaasRequestContext()?.tenantPilotHome;
    const pilotHome = access.pilotHome ?? tenantPilotHome ?? resolvePilotHome(process.env);
    const transcriptAbsPath = access.transcriptAbsPath ?? (isSaasMode()
      ? await resolveSessionTranscriptAbsPath({
          sessionId,
          tenantPilotHome: pilotHome,
          catalogTranscriptRel,
        })
      : null);

    const limitParam = req.query.limit;
    const limit = limitParam !== undefined && limitParam !== null && limitParam !== ''
      ? parseInt(limitParam, 10)
      : null;
    const offset = parseInt(req.query.offset || '0', 10);
    const direction = req.query.direction === 'backward' ? 'backward' : 'forward';
    const cursorParam = req.query.cursor ? String(req.query.cursor) : undefined;
    const cursor = direction === 'backward'
      ? cursorParam
      : (offset > 0 ? String(offset) : cursorParam);

    const gatewayInput = {
      sessionKey: sessionId,
      projectKey: projectPath,
      limit: limit ?? undefined,
      cursor,
      direction,
      ...(tenantPilotHome ? { pilotHome: tenantPilotHome } : {}),
    };

    // PD-SAAS-FORK: optional Redis cache for sanitized tail pages.
    let transcriptMtimeMs = 0;
    if (transcriptAbsPath) {
      try {
        const transcriptStat = await stat(transcriptAbsPath);
        transcriptMtimeMs = transcriptStat.mtimeMs;
      } catch {
        transcriptMtimeMs = 0;
      }
    }

    const saasCtx = getSaasRequestContext();
    const cacheEligible = isHistoryMessageCacheEnabled()
      && direction === 'backward'
      && limit != null
      && isHistorySanitizeEnabled();
    const cacheKey = cacheEligible
      ? sessionMessagesTailKey({
          tenantId: saasCtx?.tenantId,
          userId: saasCtx?.userId,
          sessionId,
          transcriptMtimeMs,
          cursor: cursor ?? 'tail',
          limit,
        })
      : null;

    if (cacheKey) {
      const cached = await cacheGet(cacheKey);
      if (cached && typeof cached === 'object') {
        return res.json(cached);
      }
    }

    const diskReadOpts = {
      projectRoot: projectPath,
      pilotHome,
      ...(transcriptAbsPath ? { transcriptAbsPath } : {}),
    };

    const result = await Promise.race([
      readTranscriptMessagesForRequest(
        gatewayInput,
        diskReadOpts,
        transcriptAbsPath,
      ),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('messages_route_budget_exceeded')), MESSAGES_ROUTE_BUDGET_MS);
      }),
    ]).catch((error) => {
      if (error instanceof Error && error.message === 'messages_route_budget_exceeded') {
        return null;
      }
      throw error;
    });

    if (!result) {
      return res.status(503).json({
        retryable: true,
        error: 'Loading messages is taking longer than expected. Please retry shortly.',
      });
    }

    let messages = result.messages.map((message) => mapWebMessageToNormalized(message, sessionId));
    if (isHistorySanitizeEnabled()) {
      messages = sanitizeHistoryMessages(messages);
    }
    const totalKnown = typeof result.total === 'number' ? result.total : messages.length + offset;
    const hasMore = result.nextCursor !== undefined && result.nextCursor !== null;
    const pageStart = direction === 'backward'
      ? Math.max(0, (cursor ? Number.parseInt(cursor, 10) : totalKnown) - messages.length)
      : offset;

    const turnDeliverableMeta = isHistorySanitizeEnabled() && result.turnDeliverableMeta
      ? sanitizeTurnDeliverableMeta(result.turnDeliverableMeta)
      : result.turnDeliverableMeta;
    const latestTurnAcceptanceMeta = sanitizeTurnAcceptanceMetaForHistoryWire(
      result.latestTurnAcceptanceMeta,
    );

    const payload = {
      messages,
      total: totalKnown,
      hasMore,
      offset: pageStart,
      limit,
      ...(result.nextCursor !== undefined ? { nextCursor: result.nextCursor } : {}),
      ...(result.transcriptWarning ? { transcriptWarning: result.transcriptWarning } : {}),
      ...(turnDeliverableMeta ? { turnDeliverableMeta } : {}),
      ...(result.sessionDeliverableManifest
        ? { sessionDeliverableManifest: result.sessionDeliverableManifest }
        : {}),
      ...(result.sessionTaskDirectory
        ? { sessionTaskDirectory: result.sessionTaskDirectory }
        : {}),
      ...(latestTurnAcceptanceMeta
        ? { latestTurnAcceptanceMeta }
        : {}),
    };

    if (cacheKey) {
      void cacheSet(cacheKey, payload, getDefaultTtl('messages'));
    }

    return res.json(payload);
  } catch (error) {
    console.error('[messages] read_session_messages failed:', error);
    const message = error instanceof Error ? error.message : 'Unable to load conversation messages.';
    return res.status(500).json({
      messages: [],
      total: 0,
      hasMore: false,
      offset: 0,
      limit: null,
      error: message,
    });
  }
});

function mapWebMessageToNormalized(message, sessionId) {
  const base = {
    id: message.id,
    sessionId,
    timestamp: message.createdAt,
    provider: message.provider || 'pilotdeck',
  };
  switch (message.kind) {
    case 'text':
      return createNormalizedMessage({
        ...base,
        kind: 'text',
        role: message.role === 'user' ? 'user' : 'assistant',
        content: message.text || '',
        ...(message.payload?.turnArtifactDir ? { turnArtifactDir: message.payload.turnArtifactDir } : {}),
        ...(Array.isArray(message.payload?.verifiedDeliverablePaths)
          ? { verifiedDeliverablePaths: message.payload.verifiedDeliverablePaths.filter((item) => typeof item === 'string') }
          : {}),
        ...(Array.isArray(message.payload?.missingPaths)
          ? { missingPaths: message.payload.missingPaths.filter((item) => typeof item === 'string') }
          : {}),
        ...(Array.isArray(message.payload?.brokenPaths)
          ? { brokenPaths: message.payload.brokenPaths.filter((item) => typeof item === 'string') }
          : {}),
        ...(Array.isArray(message.payload?.displayPaths)
          ? { displayPaths: message.payload.displayPaths.filter((item) => typeof item === 'string') }
          : {}),
        ...(Array.isArray(message.payload?.hiddenByPolicyPaths)
          ? { hiddenByPolicyPaths: message.payload.hiddenByPolicyPaths.filter((item) => typeof item === 'string') }
          : {}),
        ...(Array.isArray(message.payload?.expectedManifest)
          ? { expectedManifest: message.payload.expectedManifest }
          : {}),
        ...(message.payload?.resolvedPathMap && typeof message.payload.resolvedPathMap === 'object'
          ? { resolvedPathMap: message.payload.resolvedPathMap }
          : {}),
        ...(typeof message.payload?.acceptanceStatus === 'string'
          ? { acceptanceStatus: message.payload.acceptanceStatus }
          : {}),
        ...(typeof message.payload?.continuationOwner === 'string'
          ? { continuationOwner: message.payload.continuationOwner }
          : {}),
        ...(message.payload?.turnAcceptanceMeta && typeof message.payload.turnAcceptanceMeta === 'object'
          ? { turnAcceptanceMeta: message.payload.turnAcceptanceMeta }
          : {}),
        ...(typeof message.payload?.contractHash === 'string'
          ? { contractHash: message.payload.contractHash }
          : {}),
        // PD-SAAS-FORK: SDM wire — hydrate session manifest from history payload
        ...(message.payload?.sessionDeliverableManifest
          && typeof message.payload.sessionDeliverableManifest === 'object'
          ? { sessionDeliverableManifest: message.payload.sessionDeliverableManifest }
          : {}),
        ...(message.payload?.sessionTaskDirectory
          && typeof message.payload.sessionTaskDirectory === 'object'
          ? { sessionTaskDirectory: message.payload.sessionTaskDirectory }
          : {}),
        ...(typeof message.payload?.sessionManifestVersion === 'number'
          ? { sessionManifestVersion: message.payload.sessionManifestVersion }
          : {}),
        ...(typeof message.payload?.goalVersion === 'number'
          ? { goalVersion: message.payload.goalVersion }
          : {}),
        ...(typeof message.payload?.turnId === 'string'
          ? { turnId: message.payload.turnId }
          : {}),
        ...(message.payload?.turnDeliverableUnrecoverable
          ? { turnDeliverableUnrecoverable: true }
          : {}),
        ...(Array.isArray(message.images) && message.images.length > 0
          ? { images: message.images.map((image) => image?.data).filter(Boolean) }
          : {}),
      });
    case 'thinking':
      return createNormalizedMessage({ ...base, kind: 'thinking', content: message.text || '' });
    case 'tool_use':
      return createNormalizedMessage({
        ...base,
        kind: 'tool_use',
        toolName: message.toolName,
        toolInput: message.payload,
        toolId: message.toolCallId,
      });
    case 'tool_result': {
      const planPayload = message.payload && typeof message.payload === 'object'
          ? message.payload
          : {};
      const writtenFilePath = extractWrittenFilePathFromToolResult(message.text, planPayload, message.payload);
      return createNormalizedMessage({
        ...base,
        kind: 'tool_result',
        toolId: message.toolCallId,
        content: message.text || '',
        isError: message.ok === false,
        ...(message.errorCode ? { errorCode: message.errorCode } : {}),
        ...(writtenFilePath ? { writtenFilePath } : {}),
        // Inline tool-result images (e.g. read_file on a PNG). The web
        // server already wraps the bare base64 from canonical messages as
        // data URLs in `toWebMessageImage`, so just pass them through.
        ...(Array.isArray(message.images) && message.images.length > 0
          ? {
              toolResultImages: message.images
                .filter((image) => image && typeof image.data === 'string')
                .map((image) => ({ data: image.data, mimeType: image.mimeType })),
            }
          : {}),
        ...(planPayload.planFilePath ? {
            planFilePath: planPayload.planFilePath,
            planTitle: planPayload.planTitle,
            planSummary: planPayload.planSummary,
        } : {}),
      });
    }
    case 'permission_request':
      return createNormalizedMessage({
        ...base,
        kind: 'permission_request',
        requestId: message.requestId,
        toolName: message.toolName,
        input: message.payload,
      });
    case 'elicitation_request': {
      const payload = message.payload && typeof message.payload === 'object'
        ? message.payload
        : {};
      const toolName = message.toolName === 'exit_plan_mode'
        ? 'ExitPlanModeV2'
        : 'AskUserQuestion';
      return createNormalizedMessage({
        ...base,
        kind: 'permission_request',
        requestId: message.requestId,
        toolCallId: message.toolCallId,
        toolName,
        input: {
          questions: payload.questions,
          metadata: payload.metadata,
          previewFormat: payload.previewFormat,
          ...(message.toolName === 'exit_plan_mode'
            ? {
                plan: payload.plan,
                planFilePath: payload.planFilePath,
              }
            : {}),
        },
        context: { originalToolName: message.toolName },
        isElicitation: true,
      });
    }
    case 'structured_output':
      return createNormalizedMessage({
        ...base,
        kind: 'status',
        text: 'structured',
        payload: message.payload,
      });
    case 'status':
      return createNormalizedMessage({ ...base, kind: 'status', text: message.text || '' });
    case 'complete':
      return createNormalizedMessage({ ...base, kind: 'complete' });
    case 'error':
      return createNormalizedMessage({ ...base, kind: 'error', content: message.text || '' });
    case 'interrupted':
      return createNormalizedMessage({ ...base, kind: 'interrupted', content: message.text || '' });
    case 'compact_boundary': {
      const payload = message.payload || {};
      return createNormalizedMessage({
        ...base,
        kind: 'compact_boundary',
        trigger: payload.trigger || 'auto',
        preTokens: payload.preTokens,
        compactLevel: payload.level,
        compactStage: payload.stage,
        compactStageLabel: payload.stageLabel || payload.stage,
        compactMetadata: payload,
      });
    }
    default:
      return createNormalizedMessage({ ...base, kind: 'status', text: message.kind });
  }
}

function extractWrittenFilePathFromToolResult(text, planPayload, payload) {
  if (typeof planPayload?.planFilePath === 'string' && planPayload.planFilePath.trim()) {
    return planPayload.planFilePath.trim();
  }
  if (payload && typeof payload === 'object' && typeof payload.path === 'string' && payload.path.trim()) {
    return payload.path.trim();
  }
  const source = String(text || '').trim();
  if (!source) return undefined;
  try {
    const parsed = JSON.parse(source);
    if (parsed && typeof parsed === 'object') {
      const direct = parsed.writtenFilePath || parsed.filePath || parsed.file_path || parsed.outputPath || parsed.relativePath;
      if (typeof direct === 'string' && direct.trim()) return direct.trim();
      const data = parsed.data;
      if (data && typeof data === 'object') {
        const fromData = data.relativePath || data.filePath || data.file_path || data.outputPath;
        if (typeof fromData === 'string' && fromData.trim()) return fromData.trim();
      }
    }
  } catch {
    // fall through
  }
  const match = source.match(/(?:artifacts|drafts|general\/artifacts)\/[^\s"'<>|]+/i);
  return match?.[0];
}

export { mapWebMessageToNormalized };

export default router;
