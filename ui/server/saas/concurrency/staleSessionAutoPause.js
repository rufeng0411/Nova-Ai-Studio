/**
 * PD-SAAS-FORK: auto-pause queued/running sessions idle longer than the stale window.
 */
import {
  resolveStaleSessionPauseMs,
  shouldAutoPauseStaleCatalogRow,
  STALE_AUTO_PAUSE_REASON,
} from '../../../../src/saas/concurrency/staleSessionPausePolicy.ts';
import { pauseTurn } from './turnAcceptanceService.js';
import { updateExecutionStatus } from './turnLifecycleStore.js';

/**
 * @param {{
 *   tenantId: string;
 *   userId: number;
 *   role?: string | null;
 *   rows: Array<{ sessionId: string; executionStatus?: string; lastActivityAt?: string; pausedReason?: string | null }>;
 *   writer?: { send: (msg: object) => void };
 * }} input
 */
export async function autoPauseStaleCatalogRows(input) {
  const nowMs = Date.now();
  const pauseMs = resolveStaleSessionPauseMs(process.env);
  let paused = 0;

  for (const row of input.rows ?? []) {
    if (!row?.sessionId) continue;
    if (!shouldAutoPauseStaleCatalogRow(row, nowMs, pauseMs)) continue;
    try {
      await pauseTurn({
        sessionId: row.sessionId,
        userId: input.userId,
        tenantId: input.tenantId,
        role: input.role ?? null,
        reason: STALE_AUTO_PAUSE_REASON,
        writer: input.writer,
      });
      paused += 1;
    } catch (error) {
      console.warn('[stale-session-auto-pause] pauseTurn failed:', row.sessionId, error instanceof Error ? error.message : error);
    }
  }

  return { paused, pauseMs };
}

/**
 * Mark a single idle/stale session paused without aborting Gateway (cold-resume guard).
 * @param {{ tenantId: string; userId: number; sessionId: string }} input
 */
export async function markSessionAutoStalePaused(input) {
  await updateExecutionStatus({
    tenantId: input.tenantId,
    userId: input.userId,
    sessionId: input.sessionId,
    executionStatus: 'paused',
    pausedReason: STALE_AUTO_PAUSE_REASON,
  });
}
