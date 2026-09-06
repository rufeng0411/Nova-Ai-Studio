/**
 * PD-SAAS-FORK: Tombstone registry for deleted sessions whose transcript jsonl may remain (orphan).
 */
import { getControlDriver } from '../db/control.js';
import { sessionTombstoneUpsertSql } from '../db/dialect.js';

/**
 * @param {{ sessionId: string, tenantId: string, userId: number, reason?: string }} input
 */
export async function recordSessionTombstone({ sessionId, tenantId, userId, reason = 'user-delete' }) {
  if (!sessionId || !tenantId || userId == null) return;
  try {
    const db = await getControlDriver();
    const sql = sessionTombstoneUpsertSql(db.dialect);
    await db.execute(sql, [sessionId, tenantId, userId, reason]);
  } catch (error) {
    console.warn('[saas] recordSessionTombstone failed:', error instanceof Error ? error.message : error);
  }
}

/**
 * @param {{ sessionId: string, tenantId: string, userId: number }} input
 * @returns {Promise<boolean>}
 */
export async function isSessionTombstoned({ sessionId, tenantId, userId }) {
  if (!sessionId || !tenantId || userId == null) return false;
  try {
    const db = await getControlDriver();
    const row = await db.queryOne(
      'SELECT 1 AS ok FROM session_tombstones WHERE session_id = ? AND tenant_id = ? AND user_id = ?',
      [sessionId, tenantId, userId],
    );
    return Boolean(row?.ok);
  } catch {
    return false;
  }
}

/** @returns {Promise<string[]>} */
export async function listAllTombstoneSessionIds() {
  try {
    const db = await getControlDriver();
    const rows = await db.queryAll('SELECT session_id FROM session_tombstones');
    return rows.map((r) => r.session_id).filter(Boolean);
  } catch {
    return [];
  }
}
