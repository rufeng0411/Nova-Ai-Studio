/**
 * PD-SAAS-FORK: Dequeue and start queued turns when slots free.
 */
import { getSaasRequestContext, saasRequestStore } from '../context.js';
import { getTenantPilotHome } from '../tenant/paths.js';
import path from 'node:path';
import { catalogStore } from '../conversation/CatalogStore.js';
import {
  acquireTurnSlotStatus,
  listTurnSlotSessionKeys,
  releaseTurnSlot,
} from './turnSlotRegistry.js';
import {
  cancelQueuedTurn,
  clearUserQueue,
  dequeueTurnByItemId,
  getQueuedTurnByItemId,
  markQueuedTurnFailed,
  markQueuedTurnHardFailed,
  parseQueueItemsFromCatalogRow,
  withPumpLock,
  hydrateQueueFromCatalogRows,
  buildQueuedPayloadEnvelope,
  listQueuedTurnsForPump,
  listQueuedTurnsForSession,
} from './turnQueueManager.js';
import { updateExecutionStatus, getExecutionStatus } from './turnLifecycleStore.js';
import { isTurnQueueEnabled } from './turnQueueConfig.js';
import {
  hasDurableAcceptedInputReceipt,
  receiptMatchesIdentity,
} from '../../../../src/session/transcript/acceptedInputReceipt.js';
import { readTranscript } from '../../../../src/session/index.js';
import { detectIncompleteTurn } from '../../../../src/session/resume/buildTaskResumeContext.js';
import { withTurnQueueSessionFileLock } from './turnQueueSessionLock.js';
import { sessionKeySetHas } from '../conversation/normalizeSessionId.js';

/** @type {Set<import('ws').WebSocket> | null} */
let connectedClients = null;

/** @type {((command: string, options: object, writer: object, provider?: string) => Promise<void>) | null} */
let runChatViaGatewayFn = null;

/** @type {(() => { active: boolean, ownerUserId?: number|null, sessionKey: string }[]) | null} */
let getBridgeSessionStatesFn = null;

/** @type {Map<string, { dueAt: number, timer: NodeJS.Timeout }>} */
const retryWakeups = new Map();

/** @type {Map<string, number>} */
const recentGatewayErrorLogs = new Map();

function isHardTurnQueueFailure(input) {
  if (input.failureRecoverable === false) return true;
  const code = typeof input.failureCode === 'string' ? input.failureCode.trim() : '';
  if (!code) return false;
  return code === 'agent_model_error'
    || code === 'agent_auth_error'
    || code === 'agent_quota_error';
}

/**
 * @param {Set<import('ws').WebSocket>} clients
 * @param {(command: string, options: object, writer: object, provider?: string) => Promise<void>} runChat
 * @param {() => { active: boolean, ownerUserId?: number|null, sessionKey: string }[]} [getBridgeSessionStates]
 */
export function registerTurnQueuePump(deps) {
  connectedClients = deps.clients;
  runChatViaGatewayFn = deps.runChat;
  getBridgeSessionStatesFn = deps.getBridgeSessionStates ?? null;
}

/**
 * @param {number} userId
 */
export function createUserWriter(userId) {
  return {
    send(data) {
      const message = JSON.stringify(data);
      if (!connectedClients) return;
      for (const client of connectedClients) {
        if (client.readyState !== 1) continue;
        if (client.__pilotdeckUserId !== userId) continue;
        client.send(message);
      }
    },
  };
}

async function ensureQueueHydrated(input) {
  const rows = await catalogStore.listByExecutionStatus({
    tenantId: input.tenantId,
    userId: input.userId,
    statuses: ['queued', 'running'],
  });
  if (rows.length === 0) return;
  hydrateQueueFromCatalogRows(rows);
}

/**
 * PD-SAAS-FORK: release slot leases held by sessions that are no longer active in Bridge.
 * @param {{ tenantId: string, userId: number }} input
 */
function ownerMatchesUser(state, userId) {
  return Number(state.ownerUserId) === Number(userId);
}

function collectActiveSessionKeys(bridgeStates, userId) {
  const keys = new Set();
  for (const state of bridgeStates ?? []) {
    if (!state?.active) continue;
    if (userId != null && !ownerMatchesUser(state, userId)) continue;
    if (state.sessionKey) keys.add(state.sessionKey);
  }
  return keys;
}

async function retainSlotsHeldByActiveBridge(input) {
  const heldKeys = await listTurnSlotSessionKeys(input);
  if (heldKeys.length === 0) return;
  const bridgeStates = getBridgeSessionStatesFn?.() ?? [];
  const activeKeys = collectActiveSessionKeys(bridgeStates, input.userId);
  for (const sessionKey of heldKeys) {
    if (sessionKeySetHas(activeKeys, sessionKey)) continue;
    await releaseTurnSlot({ ...input, sessionKey });
  }
}

/**
 * PD-SAAS-FORK: release slot leases held by sessions that are no longer active in Bridge.
 * @param {{ tenantId: string, userId: number }} input
 */
export async function reconcileLeakedTurnSlots(input) {
  if (!getBridgeSessionStatesFn) return { released: 0 };
  const heldKeys = await listTurnSlotSessionKeys(input);
  if (heldKeys.length === 0) return { released: 0 };

  const bridgeStates = getBridgeSessionStatesFn?.() ?? [];
  const activeKeys = collectActiveSessionKeys(bridgeStates, input.userId);

  let released = 0;
  for (const sessionKey of heldKeys) {
    if (sessionKeySetHas(activeKeys, sessionKey)) continue;
    await releaseTurnSlot({ ...input, sessionKey });
    released += 1;
  }
  return { released };
}

/**
 * PD-SAAS-FORK: interrupted running turn (refresh/close) — prefer idle + cold-resume over ghost queued.
 * @param {{
 *   tenantId: string;
 *   userId: number;
 *   sessionId: string;
 *   transcriptRelPath?: string | null;
 *   pendingForSession: Array<{ itemId: string }>;
 * }} input
 */
async function resolveStaleRunningExecutionStatus(input) {
  const pending = input.pendingForSession ?? [];
  if (pending.length === 0) {
    return {
      executionStatus: 'idle',
      queuePosition: null,
      queuedPayload: null,
      dequeueItemIds: [],
    };
  }
  const relPath = typeof input.transcriptRelPath === 'string' ? input.transcriptRelPath.trim() : '';
  if (!relPath) {
    return {
      executionStatus: 'queued',
      queuePosition: pending.length,
      queuedPayload: buildQueuedPayloadEnvelope(pending),
      dequeueItemIds: [],
    };
  }
  try {
    const pilotHome = getTenantPilotHome(input.tenantId);
    const transcriptAbsPath = path.resolve(pilotHome, ...relPath.split('/'));
    const readResult = await readTranscript(transcriptAbsPath);
    const incomplete = detectIncompleteTurn(readResult.entries);
    if (incomplete) {
      return {
        executionStatus: 'idle',
        queuePosition: null,
        queuedPayload: null,
        dequeueItemIds: pending.map((item) => item.itemId).filter(Boolean),
      };
    }
  } catch (error) {
    console.warn(
      '[turn-queue] stale running incomplete probe failed:',
      error instanceof Error ? error.message : error,
    );
  }
  return {
    executionStatus: 'queued',
    queuePosition: pending.length,
    queuedPayload: buildQueuedPayloadEnvelope(pending),
    dequeueItemIds: [],
  };
}

async function reconcileStaleRunningCatalogRows(input) {
  if (!getBridgeSessionStatesFn) return;
  const rows = await catalogStore.listByExecutionStatus({
    tenantId: input.tenantId,
    userId: input.userId,
    statuses: ['running'],
  });
  if (rows.length === 0) return;

  const bridgeStates = getBridgeSessionStatesFn?.() ?? [];
  const activeKeys = collectActiveSessionKeys(bridgeStates, input.userId);
  const writer = createUserWriter(input.userId);

  for (const row of rows) {
    if (sessionKeySetHas(activeKeys, row.sessionId)) continue;
    await releaseTurnSlot({
      tenantId: input.tenantId,
      userId: input.userId,
      sessionKey: row.sessionId,
    });
    const pendingForSession = listQueuedTurnsForSession({
      tenantId: input.tenantId,
      userId: input.userId,
      sessionKey: row.sessionId,
    });
    const resolved = await resolveStaleRunningExecutionStatus({
      tenantId: input.tenantId,
      userId: input.userId,
      sessionId: row.sessionId,
      transcriptRelPath: row.transcriptRelPath,
      pendingForSession,
    });
    for (const itemId of resolved.dequeueItemIds) {
      dequeueTurnByItemId({
        tenantId: input.tenantId,
        userId: input.userId,
        itemId,
      });
    }
    await updateExecutionStatus({
      tenantId: input.tenantId,
      userId: input.userId,
      sessionId: row.sessionId,
      executionStatus: resolved.executionStatus,
      queuePosition: resolved.queuePosition,
      queuedPayload: resolved.queuedPayload,
    });
    writer.send({
      type: 'queue_updated',
      sessionId: row.sessionId,
      executionStatus: resolved.executionStatus,
      repaired: true,
      provider: 'pilotdeck',
    });
  }
}

/**
 * PD-SAAS-FORK: catalog queued/running but memory queue empty or only retry-exhausted items.
 * @param {{ tenantId: string, userId: number, role?: string | null }} input
 */
export async function reconcileUnpumpableQueuedCatalogRows(input) {
  if (!getBridgeSessionStatesFn) return { cleared: 0, finalized: 0 };
  const rows = await catalogStore.listByExecutionStatus({
    tenantId: input.tenantId,
    userId: input.userId,
    statuses: ['queued', 'running'],
  });
  if (rows.length === 0) return { cleared: 0, finalized: 0 };

  const bridgeStates = getBridgeSessionStatesFn?.() ?? [];
  const activeKeys = collectActiveSessionKeys(bridgeStates, input.userId);

  let cleared = 0;
  let finalized = 0;
  const writer = createUserWriter(input.userId);

  for (const row of rows) {
    if (sessionKeySetHas(activeKeys, row.sessionId)) continue;

    const parsedItems = parseQueueItemsFromCatalogRow(row);
    if (parsedItems.length > 0) {
      hydrateQueueFromCatalogRows([row]);
    }

    const sessionItems = listQueuedTurnsForSession({
      tenantId: input.tenantId,
      userId: input.userId,
      sessionKey: row.sessionId,
    });
    const pumpable = sessionItems.filter((item) => !item.retryExhausted);

    if (pumpable.length > 0) continue;

    if (sessionItems.some((item) => item.retryExhausted)) {
      for (const item of sessionItems) {
        if (!item.retryExhausted) continue;
        dequeueTurnByItemId({
          tenantId: input.tenantId,
          userId: input.userId,
          itemId: item.itemId,
        });
        cleared += 1;
      }
      const remaining = listQueuedTurnsForSession({
        tenantId: input.tenantId,
        userId: input.userId,
        sessionKey: row.sessionId,
      });
      if (remaining.length === 0) {
        await updateExecutionStatus({
          tenantId: input.tenantId,
          userId: input.userId,
          sessionId: row.sessionId,
          executionStatus: 'idle',
          queuePosition: null,
          queuedPayload: null,
        });
        writer.send({
          type: 'queue_updated',
          sessionId: row.sessionId,
          executionStatus: 'idle',
          repaired: true,
          provider: 'pilotdeck',
        });
      }
      finalized += sessionItems.filter((item) => item.retryExhausted).length;
      continue;
    }

    if (parsedItems.length > 0 && pumpable.length === 0) {
      cancelQueuedTurn({
        tenantId: input.tenantId,
        userId: input.userId,
        sessionKey: row.sessionId,
      });
      await releaseTurnSlot({
        tenantId: input.tenantId,
        userId: input.userId,
        sessionKey: row.sessionId,
      });
      await updateExecutionStatus({
        tenantId: input.tenantId,
        userId: input.userId,
        sessionId: row.sessionId,
        executionStatus: 'idle',
        queuePosition: null,
        queuedPayload: null,
      });
      writer.send({
        type: 'queue_updated',
        sessionId: row.sessionId,
        executionStatus: 'idle',
        repaired: true,
        provider: 'pilotdeck',
      });
      cleared += 1;
      continue;
    }

    if (parsedItems.length > 0) {
      continue;
    }

    cancelQueuedTurn({
      tenantId: input.tenantId,
      userId: input.userId,
      sessionKey: row.sessionId,
    });
    await releaseTurnSlot({
      tenantId: input.tenantId,
      userId: input.userId,
      sessionKey: row.sessionId,
    });
    await updateExecutionStatus({
      tenantId: input.tenantId,
      userId: input.userId,
      sessionId: row.sessionId,
      executionStatus: 'idle',
      queuePosition: null,
      queuedPayload: null,
    });
    writer.send({
      type: 'queue_updated',
      sessionId: row.sessionId,
      executionStatus: 'idle',
      repaired: true,
      provider: 'pilotdeck',
    });
    cleared += 1;
  }

  return { cleared, finalized };
}

/**
 * PD-SAAS-FORK: user-visible repair — clear ghost slots, rehydrate queue, pump.
 * @param {{
 *   tenantId: string;
 *   userId: number;
 *   role?: string | null;
 * }} input
 */
export async function repairUserTurnQueue(input) {
  await retainSlotsHeldByActiveBridge(input);
  clearUserQueue(input);
  await ensureQueueHydrated(input);
  const leaked = await reconcileLeakedTurnSlots(input);
  await reconcileStaleRunningCatalogRows(input);
  const unpumpable = await reconcileUnpumpableQueuedCatalogRows(input);
  await ensureQueueHydrated(input);
  await pumpUserQueue(input);
  return {
    releasedGhostSlots: leaked.released,
    clearedOrphanCatalogRows: unpumpable.cleared,
    finalizedRetryExhausted: unpumpable.finalized,
  };
}

/**
 * @param {{
 *   tenantId: string;
 *   userId: number;
 *   sessionKey: string;
 *   role?: string | null;
 * }} input
 */
export async function cleanupSessionTurnResourcesOnDelete(input) {
  cancelQueuedTurn({
    tenantId: input.tenantId,
    userId: input.userId,
    sessionKey: input.sessionKey,
  });
  await releaseTurnSlot({
    tenantId: input.tenantId,
    userId: input.userId,
    sessionKey: input.sessionKey,
  });
  try {
    await updateExecutionStatus({
      tenantId: input.tenantId,
      userId: input.userId,
      sessionId: input.sessionKey,
      executionStatus: 'idle',
      queuePosition: null,
      queuedPayload: null,
    });
  } catch (error) {
    console.warn(
      '[turn-queue] delete cleanup status update failed:',
      error instanceof Error ? error.message : error,
    );
  }
  await pumpUserQueue({
    tenantId: input.tenantId,
    userId: input.userId,
    role: input.role ?? null,
  });
}

/**
 * @param {{
 *   tenantId: string;
 *   userId: number;
 *   role?: string | null;
 * }} input
 */
export async function pumpUserQueue(input) {
  if (!runChatViaGatewayFn) return;

  await ensureQueueHydrated(input);
  await reconcileLeakedTurnSlots(input);
  await reconcileStaleRunningCatalogRows(input);
  await reconcileUnpumpableQueuedCatalogRows(input);
  await ensureQueueHydrated(input);

  let keepPumping = true;
  while (keepPumping) {
    keepPumping = false;
    const candidates = listQueuedTurnsForPump(input);
    for (const head of candidates) {
      if (head.retryExhausted) {
        continue;
      }
      if (head.retryAvailableAt && head.retryAvailableAt > Date.now()) {
        scheduleRetryWakeup(input, head);
        continue;
      }
      const sessionFifoHead = listQueuedTurnsForSession({
        tenantId: input.tenantId,
        userId: input.userId,
        sessionKey: head.sessionKey,
      })[0];
      if (sessionFifoHead?.itemId !== head.itemId) {
        continue;
      }
      clearRetryWakeup(input, head.itemId);
      let started = false;
      let userLimitFull = false;
      await withPumpLock(
        {
          tenantId: input.tenantId,
          userId: input.userId,
          sessionKey: head.sessionKey,
          itemId: head.itemId,
        },
        async () => {
          const item = getQueuedTurnByItemId({
            tenantId: input.tenantId,
            userId: input.userId,
            itemId: head.itemId,
          });
          if (!item) return;
          const transcriptPath = resolvePersistedTranscriptPath(item);
          if (
            transcriptPath
            && await hasDurableAcceptedInputReceipt(transcriptPath, {
              entryId: item.acceptedInputRef?.entryId,
              queueItemId: item.itemId,
            })
          ) {
            await acknowledgeDurableReceipt(item);
            keepPumping = true;
            return;
          }
          const slotStatus = await acquireTurnSlotStatus({
            tenantId: input.tenantId,
            userId: input.userId,
            sessionKey: head.sessionKey,
            role: input.role ?? head.role ?? null,
          });
          if (slotStatus === 'full') {
            userLimitFull = true;
            return;
          }
          if (slotStatus !== 'acquired') return;

          started = true;

          const writer = createUserWriter(item.userId);
          const pendingForSession = listQueuedTurnsForSession({
            tenantId: item.tenantId,
            userId: item.userId,
            sessionKey: item.sessionKey,
          });
          const runningQueuedPayload = buildQueuedPayloadEnvelope(pendingForSession);

          await updateExecutionStatus({
            tenantId: item.tenantId,
            userId: item.userId,
            sessionId: item.sessionKey,
            executionStatus: 'running',
            queuePosition: null,
            queuedPayload: runningQueuedPayload,
          });

          writer.send({
            type: 'turn_started',
            sessionId: item.sessionKey,
            executionStatus: 'running',
            provider: item.providerHint,
          });

          try {
            await saasRequestStore.run({
              tenantId: item.tenantId,
              tenantPilotHome: getTenantPilotHome(item.tenantId),
              userId: item.userId,
            }, () => runChatViaGatewayFn(
              item.command,
              {
                ...item.options,
                queueItemId: item.itemId,
                ...(item.acceptedInputRef ? { acceptedInputRef: item.acceptedInputRef } : {}),
                ...(item.acceptedInputFingerprint
                  ? { acceptedInputFingerprint: item.acceptedInputFingerprint }
                  : {}),
                ...(item.acceptedInputAttachmentDescriptors
                  ? {
                      acceptedInputAttachmentDescriptors: item.acceptedInputAttachmentDescriptors,
                    }
                  : {}),
                ...(item.transcriptRelPath ? { transcriptRelPath: item.transcriptRelPath } : {}),
              },
              writer,
              item.providerHint,
            ));
          } catch (error) {
            console.warn(
              '[turn-queue] pump run failed:',
              error instanceof Error ? error.message : error,
            );
          }
        },
      );
      if (userLimitFull) break;
      if (started) {
        keepPumping = true;
        break;
      }
    }
  }
}

function scheduleRetryWakeup(input, item) {
  const key = retryWakeupKey(input, item.itemId);
  const dueAt = item.retryAvailableAt;
  if (!dueAt) return;
  const existing = retryWakeups.get(key);
  if (existing && existing.dueAt <= dueAt) return;
  if (existing) clearTimeout(existing.timer);
  const timer = setTimeout(() => {
    retryWakeups.delete(key);
    void pumpUserQueue(input);
  }, Math.max(0, dueAt - Date.now()));
  timer.unref?.();
  retryWakeups.set(key, { dueAt, timer });
}

function clearRetryWakeup(input, itemId) {
  const key = retryWakeupKey(input, itemId);
  const existing = retryWakeups.get(key);
  if (!existing) return;
  clearTimeout(existing.timer);
  retryWakeups.delete(key);
}

function retryWakeupKey(input, itemId) {
  return `${input.tenantId}:${input.userId}:${itemId}`;
}

/**
 * @param {{
 *   tenantId?: string | null;
 *   userId: number;
 *   sessionKey: string;
 *   role?: string | null;
 *   paused?: boolean;
 *   queueItemId?: string;
 *   success?: boolean;
 *   final?: boolean;
 *   receipt?: object | null;
 * }} input
 */
export async function onTurnExecutionFinished(input) {
  const tenantId = input.tenantId ?? getSaasRequestContext()?.tenantId ?? null;
  if (!tenantId || !input.userId) return;
  const outcome = await withTurnQueueSessionFileLock({
    tenantPilotHome: getTenantPilotHome(tenantId),
    sessionId: input.sessionKey,
  }, () => finalizeTurnExecution({ ...input, tenantId }));
  if (!outcome || outcome.paused) return;
  if (outcome.completedSuccessfully) {
    await pumpUserQueue({
      tenantId,
      userId: input.userId,
      role: input.role ?? null,
    });
    return;
  }
  if (outcome.failedItem && !outcome.failedItem.retryExhausted && outcome.failedItem.retryAvailableAt) {
    const delayMs = Math.max(0, outcome.failedItem.retryAvailableAt - Date.now());
    const retryTimer = setTimeout(() => {
      void pumpUserQueue({
        tenantId,
        userId: input.userId,
        role: input.role ?? null,
      });
    }, delayMs);
    retryTimer.unref?.();
  }
}

async function finalizeTurnExecution(input) {
  const catalogRow = await catalogStore.getBySessionId({
    tenantId: input.tenantId,
    userId: input.userId,
    sessionId: input.sessionKey,
  });
  if (catalogRow) hydrateQueueFromCatalogRows([catalogRow]);
  const stableItemId = typeof input.queueItemId === 'string' && input.queueItemId.trim()
    ? input.queueItemId.trim()
    : (
        typeof input.receipt?.queueItemId === 'string'
          ? input.receipt.queueItemId
          : input.receipt?.entryId
      );
  const queueItem = stableItemId
    ? getQueuedTurnByItemId({
        tenantId: input.tenantId,
        userId: input.userId,
        itemId: stableItemId,
      })
    : null;
  const completedSuccessfully = Boolean(
    input.success === true
    && input.final === true
    && queueItem
    && receiptMatchesIdentity(input.receipt, {
      entryId: queueItem.acceptedInputRef?.entryId,
      queueItemId: queueItem.itemId,
    }),
  );
  await releaseTurnSlot({
    tenantId: input.tenantId,
    userId: input.userId,
    sessionKey: input.sessionKey,
  });
  const currentStatus = await getExecutionStatus({
    tenantId: input.tenantId,
    userId: input.userId,
    sessionId: input.sessionKey,
  });
  if (currentStatus === 'paused') return { paused: true };
  if (queueItem && completedSuccessfully) {
    dequeueTurnByItemId({
      tenantId: input.tenantId,
      userId: input.userId,
      itemId: queueItem.itemId,
    });
  } else if (queueItem) {
    if (isHardTurnQueueFailure(input)) {
      markQueuedTurnHardFailed({
        tenantId: input.tenantId,
        userId: input.userId,
        itemId: queueItem.itemId,
      });
      dequeueTurnByItemId({
        tenantId: input.tenantId,
        userId: input.userId,
        itemId: queueItem.itemId,
      });
    } else {
      markQueuedTurnFailed({
        tenantId: input.tenantId,
        userId: input.userId,
        itemId: queueItem.itemId,
      });
    }
  }
  const pendingForSession = listQueuedTurnsForSession({
    tenantId: input.tenantId,
    userId: input.userId,
    sessionKey: input.sessionKey,
  });
  const nextExecutionStatus = pendingForSession.length > 0 ? 'queued' : 'idle';
  await updateExecutionStatus({
    tenantId: input.tenantId,
    userId: input.userId,
    sessionId: input.sessionKey,
    executionStatus: nextExecutionStatus,
    queuePosition: null,
    queuedPayload: pendingForSession.length > 0
      ? buildQueuedPayloadEnvelope(pendingForSession)
      : null,
  });
  try {
    const writer = createUserWriter(input.userId);
    writer.send({
      type: 'queue_updated',
      sessionId: input.sessionKey,
      executionStatus: nextExecutionStatus,
      provider: 'pilotdeck',
    });
  } catch (error) {
    console.warn(
      '[turn-queue] finalize queue_updated broadcast failed:',
      error instanceof Error ? error.message : error,
    );
  }
  return {
    completedSuccessfully,
    failedItem: stableItemId
      ? getQueuedTurnByItemId({
          tenantId: input.tenantId,
          userId: input.userId,
          itemId: stableItemId,
        })
      : null,
  };
}

/**
 * PD-SAAS-FORK (Train-0D): after Bridge restart, hydrate queued rows and pump each user queue.
 */
export async function hydrateAndPumpAllQueuedOnStartup() {
  if (!isTurnQueueEnabled()) return;
  try {
    const targets = await catalogStore.listQueuedPumpTargets({ statuses: ['queued', 'running'] });
    for (const target of targets) {
      if (!target?.tenantId || !target?.userId) continue;
      await repairUserTurnQueue({
        tenantId: target.tenantId,
        userId: target.userId,
        role: null,
      });
    }
  } catch (error) {
    console.warn('[turn-queue] startup pump failed:', error instanceof Error ? error.message : error);
  }
}

async function persistSessionQueueState(item, emptyStatus) {
  const pendingForSession = listQueuedTurnsForSession({
    tenantId: item.tenantId,
    userId: item.userId,
    sessionKey: item.sessionKey,
  });
  await updateExecutionStatus({
    tenantId: item.tenantId,
    userId: item.userId,
    sessionId: item.sessionKey,
    executionStatus: pendingForSession.length > 0 ? 'queued' : emptyStatus,
    queuePosition: null,
    queuedPayload: pendingForSession.length > 0
      ? buildQueuedPayloadEnvelope(pendingForSession)
      : null,
  });
}

async function acknowledgeDurableReceipt(item) {
  await withTurnQueueSessionFileLock({
    tenantPilotHome: getTenantPilotHome(item.tenantId),
    sessionId: item.sessionKey,
  }, async () => {
    const catalogRow = await catalogStore.getBySessionId({
      tenantId: item.tenantId,
      userId: item.userId,
      sessionId: item.sessionKey,
    });
    if (catalogRow) hydrateQueueFromCatalogRows([catalogRow]);
    dequeueTurnByItemId({
      tenantId: item.tenantId,
      userId: item.userId,
      itemId: item.itemId,
    });
    await persistSessionQueueState(item, 'idle');
  });
}

function resolvePersistedTranscriptPath(item) {
  if (typeof item.transcriptRelPath !== 'string') return null;
  const pilotHome = path.resolve(getTenantPilotHome(item.tenantId));
  const candidate = path.resolve(pilotHome, ...item.transcriptRelPath.split('/'));
  const relativePath = path.relative(pilotHome, candidate);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return null;
  return candidate;
}
