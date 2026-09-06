/**
 * PD-SAAS-FORK: Turn acceptance — catalog persist, slot acquire, queue or run.
 */
import path from 'node:path';
import { createNormalizedMessage } from '../../pilotdeck-message.js';
import { getSaasRequestContext } from '../context.js';
import { catalogStore } from '../conversation/CatalogStore.js';
import { resolveCatalogLegacyProjectId } from '../conversation/catalogLegacyProjectId.js';
import { resolveWorkspaceForProjectName } from '../storage/fileStorageService.js';
import { isCatalogShadowWriteEnabled } from '../conversation/featureFlags.js';
import {
  countGlobalActiveTurnSessions,
  evaluateTurnConcurrencyGate,
  isTurnConcurrencyExempt,
} from './turnConcurrencyGate.js';
import { isTurnQueueEnabled, resolveGlobalTurnLimit } from './turnQueueConfig.js';
import { acquireTurnSlotStatus, releaseTurnSlot } from './turnSlotRegistry.js';
import {
  buildAllowedQueueOptions,
  buildQueuedPayloadEnvelope,
  cancelQueuedTurn,
  enqueueTurn,
  parseQueueItemsFromCatalogRow,
  resetQueuedTurnRetry,
  resolveQueuePosition,
  serializeQueueItem,
} from './turnQueueManager.js';
import {
  appendQueuedUserTranscript,
  resolveQueuedUserTranscriptPath,
} from './turnQueueTranscript.js';
import { updateExecutionStatus, getExecutionStatus } from './turnLifecycleStore.js';
import { pumpUserQueue, createUserWriter } from './turnQueuePump.js';
import { isSyntheticSessionTitlePrompt, isAgentRecoveryBoilerplate } from '../../../../src/agent/errors/userFacingErrors.js';
import {
  buildQueueStatusReplyText,
  isQueueStatusInquiry,
} from './turnQueueIdempotency.js';
import {
  buildAcceptedInputIdentityFromUiResolved,
} from '../../../../src/session/transcript/acceptedInputIdentity.js';
import { isAcceptedInputRef } from '../../../../src/session/transcript/acceptedInputDedup.js';
import { withTurnQueueSessionFileLock } from './turnQueueSessionLock.js';

/** @type {typeof import('../../pilotdeck-bridge.js').newSessionKey | null} */
let newSessionKeyFn = null;

/** @type {((command: string, options: object, writer: object, provider?: string) => Promise<void>) | null} */
let runChatViaGatewayFn = null;

/** @type {((sessionId: string, provider?: string) => Promise<boolean>) | null} */
let abortViaGatewayFn = null;

/** @type {Map<string, Promise<void>>} */
const sessionAcceptanceLocks = new Map();

/** PD-SAAS-FORK: collapse duplicate pause-turn + abort-session bursts from UI. */
const recentPauseBySession = new Map();
const PAUSE_DEDUPE_MS = 2500;

function isSyntheticAutoContinueCommand(command) {
  const trimmed = String(command ?? '').trim();
  if (!trimmed) return true;
  return isSyntheticSessionTitlePrompt(trimmed) || isAgentRecoveryBoilerplate(trimmed);
}

/**
 * @param {{
 *   newSessionKey: () => string;
 *   runChatViaGateway: (command: string, options: object, writer: object, provider?: string) => Promise<void>;
 *   abortViaGateway: (sessionId: string, provider?: string) => Promise<boolean>;
 * }} deps
 */
export function registerTurnQueueBridgeDeps(deps) {
  newSessionKeyFn = deps.newSessionKey;
  runChatViaGatewayFn = deps.runChatViaGateway;
  abortViaGatewayFn = deps.abortViaGateway;
}

function isPilotDeckSessionKey(value) {
  return typeof value === 'string' && /^web[:_-]s_/.test(value);
}

/**
 * @param {{
 *   command?: string;
 *   options?: Record<string, unknown>;
 *   writer: { send: (msg: object) => void };
 *   providerHint?: string;
 *   userId: number;
 *   role?: string | null;
 *   tenantId?: string | null;
 *   consumeCredit?: () => Promise<void>;
 *   sessionStates?: { active: boolean, ownerUserId?: number|null, sessionKey: string }[];
 * }} input
 */
export async function acceptTurn(input) {
  if (!isTurnQueueEnabled()) {
    throw new Error('turn_queue_disabled');
  }
  if (!newSessionKeyFn || !runChatViaGatewayFn) {
    throw new Error('turn_queue_bridge_not_registered');
  }
  const ctx = getSaasRequestContext();
  const tenantId = input.tenantId ?? ctx?.tenantId ?? null;
  const options = { ...(input.options ?? {}) };
  const incoming = options.sessionId || options.sessionKey;
  const sessionKey = isPilotDeckSessionKey(incoming) ? incoming : newSessionKeyFn();
  const tenantPilotHome = ctx?.tenantPilotHome ?? null;
  const projectKey = options.projectPath || options.cwd || '';
  const transcriptTarget = tenantPilotHome
    ? resolveQueuedUserTranscriptPath({
        pilotHome: tenantPilotHome,
        projectKey,
        sessionId: sessionKey,
      })
    : null;
  const prepared = await withSessionAcceptanceLock(
    `${tenantId ?? 'local'}:${input.userId}:${sessionKey}`,
    () => {
      const operation = () => prepareAcceptedTurn({
        ...input,
        __resolvedSessionKey: sessionKey,
        __isNewSession: sessionKey !== incoming,
      });
      return transcriptTarget
        ? withTurnQueueSessionFileLock(
            {
              tenantPilotHome,
              sessionId: transcriptTarget.sessionId,
            },
            operation,
          )
        : operation();
    },
  );
  if (prepared?.__pumpRequest) {
    await pumpUserQueue(prepared.__pumpRequest);
    return prepared.result;
  }
  if (!prepared?.__runRequest) return prepared;
  await runChatViaGatewayFn(
    prepared.__runRequest.command,
    prepared.__runRequest.options,
    prepared.__runRequest.writer,
    prepared.__runRequest.providerHint,
  );
  return prepared.result;
}

async function prepareAcceptedTurn(input) {
  const ctx = getSaasRequestContext();
  const tenantId = input.tenantId ?? ctx?.tenantId ?? null;
  const tenantPilotHome = ctx?.tenantPilotHome ?? null;
  const userId = input.userId;
  const command = typeof input.command === 'string' ? input.command : '';
  const rawOptions = { ...(input.options ?? {}) };
  const providerHint = input.providerHint ?? 'pilotdeck';
  const writer = input.writer;

  const sessionKey = input.__resolvedSessionKey;
  const isNewSession = input.__isNewSession;
  const options = buildAllowedQueueOptions(sessionKey, rawOptions);
  const projectKey = options.projectPath || options.cwd || '';
  const projectName = options.projectName ?? options.project ?? null;

  const existingStatus = !isNewSession && tenantId
    ? await getExecutionStatus({ tenantId, userId, sessionId: sessionKey })
    : 'idle';
  const existingCatalogRow = !isNewSession && tenantId
    ? await catalogStore.getBySessionId({ tenantId, userId, sessionId: sessionKey })
    : null;
  const isResumeFromPaused = existingStatus === 'paused';

  // PD-SAAS-FORK: N2 Bot steward session must never take a worker acceptTurn.
  if (existingCatalogRow?.kind === 'n2_bot' || rawOptions.sessionKind === 'n2_bot') {
    writer.send({
      type: 'error',
      error: 'n2_bot_not_a_worker',
      sessionId: sessionKey,
      provider: providerHint,
    });
    writer.send(
      createNormalizedMessage({
        kind: 'complete',
        exitCode: 1,
        aborted: true,
        success: false,
        sessionId: sessionKey,
        provider: providerHint,
      }),
    );
    return { result: { rejected: true, reason: 'n2_bot_not_a_worker' } };
  }

  if (
    !isNewSession
    && (existingStatus === 'queued' || existingStatus === 'running')
    && isSyntheticAutoContinueCommand(command)
    && !isQueueStatusInquiry(command)
  ) {
    writer.send({
      type: 'turn_rejected',
      reason: 'turn_queued',
      retryable: false,
      sessionId: sessionKey,
      provider: providerHint,
    });
    writer.send(
      createNormalizedMessage({
        provider: providerHint,
        sessionId: sessionKey,
        kind: 'complete',
        exitCode: 0,
        success: true,
        aborted: true,
        userAborted: true,
      }),
    );
    return { accepted: false, reason: 'turn_queued' };
  }

  if (isResumeFromPaused && isSyntheticAutoContinueCommand(command)) {
    writer.send({
      type: 'turn_rejected',
      reason: 'session_paused',
      retryable: false,
      sessionId: sessionKey,
      provider: providerHint,
    });
    writer.send(
      createNormalizedMessage({
        provider: providerHint,
        sessionId: sessionKey,
        kind: 'complete',
        exitCode: 0,
        success: true,
        aborted: true,
        userAborted: true,
      }),
    );
    return { accepted: false, reason: 'session_paused' };
  }
  if (
    !isNewSession
    && (existingStatus === 'queued' || existingStatus === 'running')
    && tenantId
    && !isResumeFromPaused
  ) {
    const catalogRow = existingCatalogRow;
    const queuePosition = catalogRow?.queuePosition ?? null;
    const durableItems = catalogRow ? parseQueueItemsFromCatalogRow(catalogRow) : [];
    const incomingRef = isAcceptedInputRef(rawOptions.acceptedInputRef)
      ? rawOptions.acceptedInputRef
      : null;
    const incomingIdempotencyKey = normalizeStableRequestId(
      rawOptions.clientRequestId ?? rawOptions.idempotencyKey,
    );
    const stableItemIndex = durableItems.findIndex((item) => (
      (typeof rawOptions.queueItemId === 'string' && item.itemId === rawOptions.queueItemId)
      || (incomingRef && item.acceptedInputRef?.entryId === incomingRef.entryId)
      || (
        incomingIdempotencyKey
        && item.clientIdempotencyKey === incomingIdempotencyKey
      )
    ));
    const matchesStableItem = stableItemIndex >= 0;
    const reviveExhaustedItem = Boolean(
      matchesStableItem
      && existingStatus === 'queued'
      && durableItems[stableItemIndex]?.retryExhausted,
    );
    if (
      matchesStableItem
      || isQueueStatusInquiry(command)
    ) {
      const idempotentStatus = existingStatus === 'running' && stableItemIndex > 0
        ? 'queued'
        : existingStatus;
      writer.send({
        type: 'turn_accepted',
        sessionId: sessionKey,
        executionStatus: idempotentStatus,
        queuePosition,
        provider: providerHint,
        idempotent: true,
      });
      writer.send(
        createNormalizedMessage({
          kind: 'text',
          type: 'text',
          content: buildQueueStatusReplyText(command, queuePosition ?? 1),
          sessionId: sessionKey,
          provider: providerHint,
          metadata: { synthetic: true, queueNotice: true, idempotent: true },
        }),
      );
      if (reviveExhaustedItem) {
        const retryItem = durableItems[stableItemIndex];
        resetQueuedTurnRetry({
          tenantId,
          userId,
          itemId: retryItem.itemId,
        });
        const revivedItems = durableItems.map((item, index) => (
          index === stableItemIndex
            ? {
                ...item,
                retryCount: 0,
                retryAvailableAt: undefined,
                retryExhausted: false,
              }
            : item
        ));
        await updateExecutionStatus({
          tenantId,
          userId,
          sessionId: sessionKey,
          executionStatus: 'queued',
          queuePosition,
          queuedPayload: buildQueuedPayloadEnvelope(revivedItems),
        });
        return {
          __pumpRequest: {
            tenantId,
            userId,
            role: input.role ?? null,
          },
          result: {
            accepted: true,
            executionStatus: 'queued',
            sessionId: sessionKey,
            queuePosition,
            idempotent: true,
          },
        };
      }
      return {
        accepted: true,
        executionStatus: idempotentStatus,
        sessionId: sessionKey,
        queuePosition,
        idempotent: true,
      };
    }
  }

  const continuationExempt = isTurnConcurrencyExempt({ command, options })
    && !isNewSession;

  if (!continuationExempt) {
    const gate = evaluateTurnConcurrencyGate({
      userId,
      role: input.role ?? null,
      command,
      options: { ...options, sessionId: sessionKey },
      sessionStates: input.sessionStates ?? [],
    });
    if (!gate.allowed && gate.reason === 'platform_busy') {
      writer.send({
        type: 'turn_rejected',
        reason: gate.reason,
        activeCount: gate.activeCount,
        limit: gate.limit,
        retryable: true,
        sessionId: sessionKey,
        provider: providerHint,
      });
      return { accepted: false, reason: 'platform_busy' };
    }
  }

  if (isNewSession) {
    writer.send(
      createNormalizedMessage({
        provider: providerHint,
        sessionId: sessionKey,
        kind: 'session_created',
        newSessionId: sessionKey,
        sessionKey,
      }),
    );
  }

  const legacyProjectId = resolveCatalogLegacyProjectId(
    projectName ?? path.basename(projectKey || '') ?? 'general',
  );
  let transcriptRelPath = `projects/${legacyProjectId}/chats/${sessionKey}.jsonl`;
  /** @type {import('./turnQueueTranscript.js').appendQueuedUserTranscript extends (...args:any)=>Promise<infer R> ? R : null} */
  let queueTranscriptWrite = null;
  const acceptedInputIdentity = await buildAcceptedInputIdentityFromUiResolved(
    command,
    Array.isArray(options.images) ? options.images : undefined,
    Array.isArray(options.attachments) ? options.attachments : undefined,
    {
      allowedRoot: path.resolve(options.workspaceCwd || projectKey || tenantPilotHome || process.cwd()),
      maxFileBytes: 20 * 1024 * 1024,
    },
  );
  if (Array.isArray(options.attachments)) {
    const imageCount = Array.isArray(options.images) ? options.images.length : 0;
    options.attachments = options.attachments.map((attachment, index) => {
      const descriptor = acceptedInputIdentity.attachmentDescriptors[imageCount + index];
      return attachment
        && typeof attachment === 'object'
        && typeof descriptor?.contentHash === 'string'
        ? { ...attachment, sha256: descriptor.contentHash }
        : attachment;
    });
  }

  if (tenantPilotHome) {
    queueTranscriptWrite = await appendQueuedUserTranscript({
      pilotHome: tenantPilotHome,
      projectKey,
      projectName: typeof projectName === 'string' ? projectName : null,
      sessionId: sessionKey,
      command,
      inputFingerprint: acceptedInputIdentity.inputFingerprint,
      attachmentDescriptors: acceptedInputIdentity.attachmentDescriptors,
    });
    if (!queueTranscriptWrite?.relPath) {
      writer.send({
        type: 'turn_rejected',
        reason: 'transcript_write_failed',
        retryable: true,
        sessionId: sessionKey,
        provider: providerHint,
      });
      return { accepted: false, reason: 'transcript_write_failed' };
    }
    transcriptRelPath = queueTranscriptWrite.relPath;
  }

  const workspace = projectName
    ? await resolveWorkspaceForProjectName(String(projectName)).catch(() => null)
    : null;

  const syntheticTitle = isSyntheticSessionTitlePrompt(command);
  const enqueuedAt = Date.now();
  const sessionCreatedAtMs = resolveSessionCreatedAtMs(existingCatalogRow, isNewSession);
  const queueItemId = queueTranscriptWrite?.acceptedInputRef?.entryId
    ?? `${sessionKey}:${enqueuedAt}`;
  const queuedPayload = {
    itemId: queueItemId,
    command,
    options: { ...options, sessionId: sessionKey, sessionKey },
    providerHint,
    role: input.role ?? null,
    resumeFromPaused: isResumeFromPaused,
    ...(normalizeStableRequestId(rawOptions.clientRequestId ?? rawOptions.idempotencyKey)
      ? {
          clientIdempotencyKey: normalizeStableRequestId(
            rawOptions.clientRequestId ?? rawOptions.idempotencyKey,
          ),
        }
      : {}),
    ...(queueTranscriptWrite?.acceptedInputRef
      ? { acceptedInputRef: queueTranscriptWrite.acceptedInputRef }
      : {}),
    ...(queueTranscriptWrite?.inputFingerprint
      ? { acceptedInputFingerprint: queueTranscriptWrite.inputFingerprint }
      : {}),
    ...(queueTranscriptWrite?.attachmentDescriptors
      ? { acceptedInputAttachmentDescriptors: queueTranscriptWrite.attachmentDescriptors }
      : {}),
    transcriptRelPath,
    enqueuedAt,
    sessionCreatedAtMs,
  };
  const existingQueueItems = existingCatalogRow
    && (existingStatus === 'running' || existingStatus === 'queued')
    ? parseQueueItemsFromCatalogRow(existingCatalogRow).map((item) => serializeQueueItem(item))
    : [];
  const durableQueueItems = [
    ...existingQueueItems.filter((item) => item.itemId !== queueItemId),
    queuedPayload,
  ];
  const durableQueuedPayload = { version: 2, items: durableQueueItems };
  const catalogPayload = {
    tenantId,
    userId,
    sessionId: sessionKey,
    legacyProjectId,
    transcriptRelPath,
    workspaceId: workspace?.id ?? null,
    workspaceUuid: workspace?.workspace_uuid ?? null,
    firstPrompt: syntheticTitle ? null : (command.slice(0, 500) || null),
    title: syntheticTitle ? null : (command.slice(0, 80) || 'New session'),
    messageCount: 1,
    lastActivityAt: new Date().toISOString(),
    status: 'pending',
    source: 'web',
    executionStatus: 'queued',
    queuedPayloadJson: JSON.stringify(durableQueuedPayload),
    ...(isNewSession || !existingCatalogRow?.createdAt
      ? { createdAt: new Date(sessionCreatedAtMs).toISOString() }
      : {}),
  };

  if (!tenantId || !isCatalogShadowWriteEnabled()) {
    writer.send({
      type: 'turn_rejected',
      reason: 'catalog_unavailable',
      retryable: true,
      sessionId: sessionKey,
      provider: providerHint,
    });
    return { accepted: false, reason: 'catalog_unavailable' };
  }

  try {
    await catalogStore.upsertAcceptTurn(catalogPayload);
  } catch (error) {
    console.warn('[turn-queue] catalog upsert failed:', error instanceof Error ? error.message : error);
    writer.send({
      type: 'turn_rejected',
      reason: 'catalog_write_failed',
      retryable: true,
      sessionId: sessionKey,
      provider: providerHint,
    });
    return { accepted: false, reason: 'catalog_write_failed' };
  }

  if (input.consumeCredit) {
    await input.consumeCredit();
  }

  const position = enqueueTurn({
    itemId: queueItemId,
    sessionKey,
    tenantId,
    userId,
    role: input.role ?? null,
    command,
    options: { ...options, sessionId: sessionKey, sessionKey },
    providerHint,
    enqueuedAt,
    sessionCreatedAtMs,
    acceptedInputRef: queueTranscriptWrite?.acceptedInputRef,
    acceptedInputFingerprint: queueTranscriptWrite?.inputFingerprint,
    acceptedInputAttachmentDescriptors: queueTranscriptWrite?.attachmentDescriptors,
    transcriptRelPath,
    clientIdempotencyKey: normalizeStableRequestId(
      rawOptions.clientRequestId ?? rawOptions.idempotencyKey,
    ) ?? undefined,
  });
  const queuePosition = resolveQueuePosition({ tenantId, userId }, queueItemId);

  const mustQueueBehindExisting = existingQueueItems.length > 0 && !continuationExempt;
  const slotStatus = mustQueueBehindExisting
    ? 'already_held'
    : await acquireTurnSlotStatus({
        tenantId,
        userId,
        sessionKey,
        role: input.role ?? null,
      });
  const acquired = !mustQueueBehindExisting && (
    slotStatus === 'acquired'
    || (continuationExempt && slotStatus === 'full')
  );

  if (acquired) {
    await updateExecutionStatus({
      tenantId,
      userId,
      sessionId: sessionKey,
      executionStatus: 'running',
      queuePosition: null,
      queuedPayload: durableQueuedPayload,
    });
    writer.send({
      type: 'turn_accepted',
      sessionId: sessionKey,
      executionStatus: 'running',
      provider: providerHint,
    });
    if (isResumeFromPaused) {
      writer.send({
        type: 'turn_started',
        sessionId: sessionKey,
        executionStatus: 'running',
        provider: providerHint,
      });
    }
    return {
      __runRequest: {
        command,
        options: {
          ...options,
          sessionId: sessionKey,
          sessionKey,
          queueItemId,
          ...(queueTranscriptWrite?.acceptedInputRef
            ? { acceptedInputRef: queueTranscriptWrite.acceptedInputRef }
            : {}),
          ...(queueTranscriptWrite?.inputFingerprint
            ? { acceptedInputFingerprint: queueTranscriptWrite.inputFingerprint }
            : {}),
          ...(queueTranscriptWrite?.attachmentDescriptors
            ? { acceptedInputAttachmentDescriptors: queueTranscriptWrite.attachmentDescriptors }
            : {}),
          transcriptRelPath,
        },
        writer,
        providerHint,
      },
      result: { accepted: true, executionStatus: 'running', sessionId: sessionKey },
    };
  }

  const sessionExecutionStatus = mustQueueBehindExisting
    ? (existingStatus === 'running' ? 'running' : 'queued')
    : (slotStatus === 'already_held' ? 'running' : 'queued');
  const acceptResultStatus = mustQueueBehindExisting ? 'queued' : sessionExecutionStatus;
  await updateExecutionStatus({
    tenantId,
    userId,
    sessionId: sessionKey,
    executionStatus: sessionExecutionStatus,
    queuePosition: queuePosition,
    queuedPayload: durableQueuedPayload,
  });

  writer.send({
    type: 'turn_accepted',
    sessionId: sessionKey,
    executionStatus: acceptResultStatus,
    queuePosition: queuePosition,
    provider: providerHint,
  });

  writer.send(
    createNormalizedMessage({
      kind: 'text',
      type: 'text',
      content: buildQueueSyntheticText(queuePosition),
      sessionId: sessionKey,
      provider: providerHint,
      metadata: { synthetic: true, queueNotice: true },
    }),
  );

  return {
    __pumpRequest: {
      tenantId,
      userId,
      role: input.role ?? null,
    },
    result: {
      accepted: true,
      executionStatus: acceptResultStatus,
      sessionId: sessionKey,
      queuePosition: queuePosition,
    },
  };
}

/**
 * @param {{ createdAt?: string | null } | null | undefined} existingCatalogRow
 * @param {boolean} isNewSession
 */
function resolveSessionCreatedAtMs(existingCatalogRow, isNewSession) {
  if (!isNewSession && existingCatalogRow?.createdAt) {
    const ms = Date.parse(existingCatalogRow.createdAt);
    if (Number.isFinite(ms)) return ms;
  }
  return Date.now();
}

/**
 * @param {number} position
 */
function buildQueueSyntheticText(position) {
  const running = resolveGlobalTurnLimit();
  return `已收到您的需求。当前有 ${running} 个任务正在处理，您的任务已加入队列（第 ${position} 位），将按顺序自动开始。`;
}

function normalizeStableRequestId(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized && normalized.length <= 256 ? normalized : null;
}

async function withSessionAcceptanceLock(key, operation) {
  const previous = sessionAcceptanceLocks.get(key) ?? Promise.resolve();
  /** @type {() => void} */
  let release = () => {};
  const current = new Promise((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current);
  sessionAcceptanceLocks.set(key, queued);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (sessionAcceptanceLocks.get(key) === queued) {
      sessionAcceptanceLocks.delete(key);
    }
  }
}

/**
 * @param {{
 *   sessionId: string;
 *   userId: number;
 *   tenantId?: string | null;
 *   role?: string | null;
 *   reason?: string;
 *   writer?: { send: (msg: object) => void };
 * }} input
 */
export async function pauseTurn(input) {
  const tenantId = input.tenantId ?? getSaasRequestContext()?.tenantId ?? null;
  if (!tenantId) return false;

  const dedupeKey = `${tenantId}:${input.userId}:${input.sessionId}`;
  const now = Date.now();
  const lastPauseAt = recentPauseBySession.get(dedupeKey) ?? 0;
  if (now - lastPauseAt < PAUSE_DEDUPE_MS) {
    return true;
  }
  recentPauseBySession.set(dedupeKey, now);

  cancelQueuedTurn({
    tenantId,
    userId: input.userId,
    sessionKey: input.sessionId,
  });

  if (abortViaGatewayFn) {
    await abortViaGatewayFn(input.sessionId, 'pilotdeck');
  }

  await releaseTurnSlot({
    tenantId,
    userId: input.userId,
    sessionKey: input.sessionId,
  });

  await updateExecutionStatus({
    tenantId,
    userId: input.userId,
    sessionId: input.sessionId,
    executionStatus: 'paused',
    pausedReason: input.reason ?? 'user_stop',
  });

  const writer = input.writer ?? createUserWriter(input.userId);
  writer.send({
    type: 'turn_paused',
    sessionId: input.sessionId,
    executionStatus: 'paused',
    reason: input.reason ?? 'user_stop',
    provider: 'pilotdeck',
  });
  writer.send(
    createNormalizedMessage({
      provider: 'pilotdeck',
      sessionId: input.sessionId,
      kind: 'complete',
      exitCode: 0,
      success: true,
      aborted: true,
      userAborted: true,
    }),
  );

  await pumpUserQueue({ tenantId, userId: input.userId, role: input.role ?? null });
  return true;
}

/**
 * PD-SAAS-FORK: restore catalog idle when user unmarks sidebar「完成」— no auto submitTurn.
 * @param {{
 *   sessionId: string;
 *   userId: number;
 *   tenantId?: string | null;
 *   role?: string | null;
 *   reason?: string;
 *   writer?: { send: (msg: object) => void };
 * }} input
 */
export async function unpauseSession(input) {
  const tenantId = input.tenantId ?? getSaasRequestContext()?.tenantId ?? null;
  if (!tenantId) return false;

  const sessionKey = input.sessionId;
  const existingStatus = await getExecutionStatus({
    tenantId,
    userId: input.userId,
    sessionId: sessionKey,
  });
  if (existingStatus !== 'paused') {
    return true;
  }

  await updateExecutionStatus({
    tenantId,
    userId: input.userId,
    sessionId: sessionKey,
    executionStatus: 'idle',
    pausedReason: null,
    queuePosition: null,
    queuedPayload: null,
  });

  const writer = input.writer ?? createUserWriter(input.userId);
  writer.send({
    type: 'session_unpaused',
    sessionId: sessionKey,
    executionStatus: 'idle',
    reason: input.reason ?? 'user_unmark_complete',
    provider: 'pilotdeck',
  });

  await pumpUserQueue({ tenantId, userId: input.userId, role: input.role ?? null });
  return true;
}

/**
 * @param {{
 *   sessionId: string;
 *   userId: number;
 *   tenantId?: string | null;
 *   writer?: { send: (msg: object) => void };
 * }} input
 */
export async function cancelQueuedTurnRequest(input) {
  const tenantId = input.tenantId ?? getSaasRequestContext()?.tenantId ?? null;
  if (!tenantId) return false;

  const removed = cancelQueuedTurn({
    tenantId,
    userId: input.userId,
    sessionKey: input.sessionId,
  });
  if (!removed) return false;

  await updateExecutionStatus({
    tenantId,
    userId: input.userId,
    sessionId: input.sessionId,
    executionStatus: 'idle',
    queuePosition: null,
    queuedPayload: null,
  });

  const writer = input.writer ?? createUserWriter(input.userId);
  writer.send({
    type: 'queue_updated',
    sessionId: input.sessionId,
    executionStatus: 'idle',
    cancelled: true,
    provider: 'pilotdeck',
  });

  await pumpUserQueue({
    tenantId,
    userId: input.userId,
    role: input.role ?? null,
  });
  return true;
}

/**
 * @param {{ sessionStates: { active: boolean, sessionKey: string }[] }} input
 */
export function isPlatformBusy(input) {
  const globalActive = countGlobalActiveTurnSessions(input.sessionStates);
  const limit = resolveGlobalTurnLimit();
  return Number.isFinite(limit) && globalActive >= limit;
}
