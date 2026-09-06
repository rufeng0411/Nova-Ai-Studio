/**
 * PD-SAAS-FORK (P0-2): control-plane store for the server-anchored cold-resume guard.
 *
 * Thin, defensive data-access over the `cold_resume_guard` table (migration 004 / SQLite inline).
 * Persists per-(tenant, user, session, turn) attempt count + last-fired timestamp so cold
 * reconnect can auto-resume an interrupted turn exactly once and never loops forever.
 *
 * All methods degrade harmlessly: on any failure they log + return safe defaults (attempts=0),
 * so a missing/locked control DB never blocks the chat path. Single-machine OSS has no control
 * plane and never calls these (the endpoint is gated off there).
 */
import { getControlDriver } from '../db/control.js';

/** @param {unknown} value */
function toEpochMs(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

/** @param {number} [ms] */
function toIso(ms) {
  const epoch = Number.isFinite(ms) ? Number(ms) : Date.now();
  return new Date(epoch).toISOString();
}

/**
 * Read the persistent guard row for a (tenant, user, session, turn).
 * @returns {Promise<{ attempts: number, lastFiredAtMs: number | null, lastActivityAtMs: number | null, lastProgressPtr: string | null }>}
 */
export async function readColdResumeGuard({ tenantId, userId, sessionId, turnId }) {
  const empty = { attempts: 0, lastFiredAtMs: null, lastActivityAtMs: null, lastProgressPtr: null };
  if (!tenantId || !userId || !sessionId || !turnId) {
    return empty;
  }
  try {
    const db = await getControlDriver();
    const row = await db.queryOne(
      `SELECT attempts, last_fired_at, last_activity_at, last_progress_ptr
         FROM cold_resume_guard
        WHERE tenant_id = ? AND user_id = ? AND session_id = ? AND turn_id = ?`,
      [tenantId, userId, sessionId, turnId],
    );
    if (!row) return empty;
    return {
      attempts: Number(row.attempts ?? 0) || 0,
      lastFiredAtMs: toEpochMs(row.last_fired_at),
      lastActivityAtMs: toEpochMs(row.last_activity_at),
      lastProgressPtr: row.last_progress_ptr != null ? String(row.last_progress_ptr) : null,
    };
  } catch (error) {
    console.warn(
      '[saas] readColdResumeGuard failed:',
      error instanceof Error ? error.message : error,
    );
    return empty;
  }
}

/**
 * Record that a cold resume just fired: increment attempts + set last_fired_at (upsert).
 * Returns the new attempt count (or null on failure so callers can decide not to fire).
 * @returns {Promise<number | null>}
 */
export async function recordColdResumeFired({
  tenantId,
  userId,
  sessionId,
  turnId,
  firedAtMs,
  lastActivityAtMs,
  lastProgressPtr = null,
}) {
  if (!tenantId || !userId || !sessionId || !turnId) {
    return null;
  }
  const firedIso = toIso(firedAtMs);
  const activityIso = lastActivityAtMs != null ? toIso(lastActivityAtMs) : null;
  try {
    const db = await getControlDriver();
    await db.execute(
      `INSERT INTO cold_resume_guard
         (tenant_id, user_id, session_id, turn_id, attempts, last_fired_at, last_activity_at, last_progress_ptr, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (tenant_id, user_id, session_id, turn_id) DO UPDATE SET
         attempts = cold_resume_guard.attempts + 1,
         last_fired_at = excluded.last_fired_at,
         last_activity_at = COALESCE(excluded.last_activity_at, cold_resume_guard.last_activity_at),
         last_progress_ptr = COALESCE(excluded.last_progress_ptr, cold_resume_guard.last_progress_ptr),
         updated_at = CURRENT_TIMESTAMP`,
      [tenantId, userId, sessionId, turnId, firedIso, activityIso, lastProgressPtr],
    );
    const row = await db.queryOne(
      `SELECT attempts FROM cold_resume_guard
        WHERE tenant_id = ? AND user_id = ? AND session_id = ? AND turn_id = ?`,
      [tenantId, userId, sessionId, turnId],
    );
    return Number(row?.attempts ?? 1) || 1;
  } catch (error) {
    console.warn(
      '[saas] recordColdResumeFired failed:',
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export { toEpochMs };
