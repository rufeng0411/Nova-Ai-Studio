/**
 * PD-SAAS-FORK: Catalog execution_status persistence for turn queue.
 */
import { catalogStore } from '../conversation/CatalogStore.js';
import { normalizeSessionId } from '../conversation/normalizeSessionId.js';

/** @typedef {'idle' | 'queued' | 'running' | 'paused'} ExecutionStatus */

/**
 * @param {{
 *   tenantId: string;
 *   userId: number;
 *   sessionId: string;
 *   executionStatus: ExecutionStatus;
 *   queuePosition?: number | null;
 *   queuedPayload?: Record<string, unknown> | null;
 *   pausedReason?: string | null;
 * }} input
 */
export async function updateExecutionStatus(input) {
  const sessionId = normalizeSessionId(input.sessionId);
  await catalogStore.updateExecutionFields({
    tenantId: input.tenantId,
    userId: input.userId,
    sessionId,
    executionStatus: input.executionStatus,
    queuePosition: input.queuePosition ?? null,
    queuedPayloadJson: input.queuedPayload ? JSON.stringify(input.queuedPayload) : null,
    pausedReason: input.pausedReason ?? null,
    setPausedAt: input.executionStatus === 'paused',
    clearPausedAt: input.executionStatus === 'running' || input.executionStatus === 'idle',
  });
}

/**
 * @param {{ tenantId: string, userId: number }} query
 */
export async function listQueuedCatalogRows(query) {
  return catalogStore.listByExecutionStatus({
    tenantId: query.tenantId,
    userId: query.userId,
    statuses: ['queued'],
  });
}

/**
 * @param {{ tenantId: string, userId: number }} query
 */
export async function countActiveExecutionRows(query) {
  return catalogStore.countByExecutionStatus({
    tenantId: query.tenantId,
    userId: query.userId,
    statuses: ['queued', 'running', 'paused'],
  });
}

/**
 * @param {{ tenantId: string, userId: number, sessionId: string }} query
 */
export async function getExecutionStatus(query) {
  const row = await catalogStore.getBySessionId({
    tenantId: query.tenantId,
    userId: query.userId,
    sessionId: query.sessionId,
  });
  return row?.executionStatus ?? 'idle';
}
