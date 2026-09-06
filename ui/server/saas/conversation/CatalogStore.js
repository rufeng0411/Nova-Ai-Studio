/**
 * PD-SAAS-FORK: PostgreSQL/SQLite conversation_catalog store.
 */
import { getControlDriver } from '../db/control.js';
import { conversationCatalogUpsertSql, conversationCatalogAcceptTurnUpsertSql } from '../db/dialect.js';
import { normalizeSessionId, sessionIdVariants } from './normalizeSessionId.js';

/**
 * @typedef {Object} CatalogUpsertInput
 * @property {string} tenantId
 * @property {number} userId
 * @property {string} sessionId
 * @property {string} legacyProjectId
 * @property {string} transcriptRelPath
 * @property {number} [workspaceId]
 * @property {string} [transcriptAbsHash]
 * @property {string} [workspaceUuid]
 * @property {string} [title]
 * @property {string} [aiTitle]
 * @property {string} [customTitle]
 * @property {string} [summary]
 * @property {string} [firstPrompt]
 * @property {string} [tag]
 * @property {number} [messageCount]
 * @property {string | Date} [createdAt]
 * @property {string | Date} [lastActivityAt]
 * @property {string} [status]
 * @property {string} [kind]
 * @property {string} [source]
 * @property {string} [source]
 * @property {string | null} [transcriptUri]
 * @property {string} [executionStatus]
 * @property {number | null} [queuePosition]
 * @property {string | null} [queuedPayloadJson]
 * @property {string | null} [pausedAt]
 * @property {string | null} [pausedReason]
 */

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    workspaceId: row.workspace_id ?? null,
    sessionId: row.session_id,
    legacyProjectId: row.legacy_project_id,
    transcriptRelPath: row.transcript_rel_path,
    transcriptAbsHash: row.transcript_abs_hash ?? null,
    workspaceUuid: row.workspace_uuid ?? null,
    title: row.title ?? null,
    aiTitle: row.ai_title ?? null,
    customTitle: row.custom_title ?? null,
    summary: row.summary ?? null,
    firstPrompt: row.first_prompt ?? null,
    tag: row.tag ?? null,
    messageCount: Number(row.message_count ?? 0),
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? null,
    purgePending: Boolean(row.purge_pending),
    status: row.status ?? 'active',
    kind: row.kind ?? null,
    source: row.source ?? 'web',
    transcriptUri: row.transcript_uri ?? null,
    executionStatus: row.execution_status ?? 'idle',
    queuePosition: row.queue_position != null ? Number(row.queue_position) : null,
    queuedPayloadJson: row.queued_payload_json ?? null,
    pausedAt: row.paused_at ?? null,
    pausedReason: row.paused_reason ?? null,
  };
}

export const catalogStore = {
  /**
   * @param {CatalogUpsertInput} input
   */
  async upsert(input) {
    const db = await getControlDriver();
    const sessionId = normalizeSessionId(input.sessionId);
    if (!sessionId || !input.tenantId || !input.userId || !input.legacyProjectId || !input.transcriptRelPath) {
      throw new Error('catalog upsert missing required fields');
    }
    const sql = conversationCatalogUpsertSql(db.dialect);
    await db.execute(sql, [
      input.tenantId,
      input.userId,
      input.workspaceId ?? null,
      sessionId,
      input.legacyProjectId,
      input.transcriptRelPath,
      input.transcriptAbsHash ?? null,
      input.workspaceUuid ?? null,
      input.title ?? null,
      input.aiTitle ?? null,
      input.customTitle ?? null,
      input.summary ?? null,
      input.firstPrompt ?? null,
      input.tag ?? null,
      input.messageCount ?? 0,
      toIso(input.createdAt),
      toIso(input.lastActivityAt),
      input.status ?? null,
      input.kind ?? null,
      input.source ?? null,
      input.transcriptUri ?? null,
    ]);
  },

  /**
   * @param {CatalogUpsertInput & {
   *   executionStatus?: string;
   *   queuePosition?: number | null;
   *   queuedPayloadJson?: string | null;
   * }} input
   */
  async upsertAcceptTurn(input) {
    const db = await getControlDriver();
    const sessionId = normalizeSessionId(input.sessionId);
    if (!sessionId || !input.tenantId || !input.userId || !input.legacyProjectId || !input.transcriptRelPath) {
      throw new Error('catalog accept upsert missing required fields');
    }
    const sql = conversationCatalogAcceptTurnUpsertSql(db.dialect);
    await db.execute(sql, [
      input.tenantId,
      input.userId,
      input.workspaceId ?? null,
      sessionId,
      input.legacyProjectId,
      input.transcriptRelPath,
      input.transcriptAbsHash ?? null,
      input.workspaceUuid ?? null,
      input.title ?? null,
      input.aiTitle ?? null,
      input.customTitle ?? null,
      input.summary ?? null,
      input.firstPrompt ?? null,
      input.tag ?? null,
      input.messageCount ?? 1,
      toIso(input.createdAt),
      toIso(input.lastActivityAt),
      input.status ?? 'pending',
      input.kind ?? null,
      input.source ?? 'web',
      input.transcriptUri ?? null,
      input.executionStatus ?? 'queued',
      input.queuePosition ?? null,
      input.queuedPayloadJson ?? null,
    ]);
  },

  /**
   * @param {{
   *   tenantId: string;
   *   userId: number;
   *   sessionId: string;
   *   executionStatus: string;
   *   queuePosition?: number | null;
   *   queuedPayloadJson?: string | null;
   *   pausedReason?: string | null;
   *   setPausedAt?: boolean;
   *   clearPausedAt?: boolean;
   * }} input
   */
  async updateExecutionFields(input) {
    const db = await getControlDriver();
    const sessionId = normalizeSessionId(input.sessionId);
    let extraSql = '';
    const params = [
      input.executionStatus,
      input.queuePosition ?? null,
      input.queuedPayloadJson ?? null,
    ];
    if (input.setPausedAt) {
      extraSql = ', paused_at = CURRENT_TIMESTAMP, paused_reason = ?';
      params.push(input.pausedReason ?? 'user_stop');
    } else if (input.clearPausedAt) {
      extraSql = ', paused_at = NULL, paused_reason = NULL';
    }
    params.push(input.tenantId, input.userId, sessionId);
    await db.execute(
      `UPDATE conversation_catalog
       SET execution_status = ?,
           queue_position = ?,
           queued_payload_json = ?,
           updated_at = CURRENT_TIMESTAMP
           ${extraSql}
       WHERE tenant_id = ? AND user_id = ? AND session_id = ? AND deleted_at IS NULL`,
      params,
    );
  },

  /**
   * @param {{ tenantId: string, userId: number, statuses: string[] }} query
   */
  async listByExecutionStatus(query) {
    const db = await getControlDriver();
    if (!query.statuses.length) return [];
    const placeholders = query.statuses.map(() => '?').join(', ');
    const rows = await db.queryAll(
      `SELECT * FROM conversation_catalog
       WHERE tenant_id = ? AND user_id = ? AND deleted_at IS NULL
         AND execution_status IN (${placeholders})
       ORDER BY COALESCE(queue_position, 999999) ASC, created_at ASC`,
      [query.tenantId, query.userId, ...query.statuses],
    );
    return rows.map(mapRow);
  },

  /**
   * PD-SAAS-FORK (Train-0D): distinct tenant/user pairs with queued turns (Bridge startup pump).
   * @param {{ statuses?: string[] }} [query]
   */
  async listQueuedPumpTargets(query = {}) {
    const db = await getControlDriver();
    const statuses = query.statuses?.length ? query.statuses : ['queued'];
    const placeholders = statuses.map(() => '?').join(', ');
    const rows = await db.queryAll(
      `SELECT DISTINCT tenant_id, user_id FROM conversation_catalog
       WHERE deleted_at IS NULL AND execution_status IN (${placeholders})
       ORDER BY tenant_id, user_id`,
      statuses,
    );
    return rows.map((row) => ({
      tenantId: row.tenant_id,
      userId: Number(row.user_id),
    }));
  },

  /**
   * @param {{ tenantId: string, userId: number, statuses: string[] }} query
   */
  async countByExecutionStatus(query) {
    const db = await getControlDriver();
    if (!query.statuses.length) return 0;
    const placeholders = query.statuses.map(() => '?').join(', ');
    const row = await db.queryOne(
      `SELECT COUNT(*) AS count FROM conversation_catalog
       WHERE tenant_id = ? AND user_id = ? AND deleted_at IS NULL
         AND execution_status IN (${placeholders})`,
      [query.tenantId, query.userId, ...query.statuses],
    );
    return Number(row?.count ?? 0);
  },

  /**
   * @param {{ tenantId: string, userId: number, sessionId: string, includeDeleted?: boolean }} query
   */
  async getBySessionId(query) {
    const db = await getControlDriver();
    const sessionId = normalizeSessionId(query.sessionId);
    const variants = sessionIdVariants(sessionId);
    if (variants.length === 0) return null;
    const placeholders = variants.map(() => '?').join(', ');
    const deletedClause = query.includeDeleted ? '' : 'AND deleted_at IS NULL';
    const row = await db.queryOne(
      `SELECT * FROM conversation_catalog
       WHERE tenant_id = ? AND user_id = ? AND session_id IN (${placeholders})
       ${deletedClause}
       ORDER BY updated_at DESC
       LIMIT 1`,
      [query.tenantId, query.userId, ...variants],
    );
    return mapRow(row);
  },

  /**
   * @param {{
   *   tenantId: string,
   *   userId: number,
   *   legacyProjectId: string,
   *   limit?: number,
   *   offset?: number,
   *   sinceMs?: number,
   *   includeOlder?: boolean,
   * }} query
   */
  async listByProject(query) {
    const db = await getControlDriver();
    const limit = Math.max(1, Math.min(query.limit ?? 5, 200));
    const offset = Math.max(0, query.offset ?? 0);
    const sinceMs = query.includeOlder ? undefined : query.sinceMs;
    const params = [query.tenantId, query.userId, query.legacyProjectId];
    let sql = `SELECT * FROM conversation_catalog
       WHERE tenant_id = ? AND user_id = ? AND legacy_project_id = ? AND deleted_at IS NULL`;
    if (typeof sinceMs === 'number' && Number.isFinite(sinceMs)) {
      sql += ` AND (last_activity_at >= ? OR execution_status IN ('queued', 'running', 'paused'))`;
      params.push(new Date(sinceMs).toISOString());
    }
    sql += ' ORDER BY last_activity_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = await db.queryAll(sql, params);
    return rows.map(mapRow);
  },

  /**
   * @param {{
   *   tenantId: string,
   *   userId: number,
   *   legacyProjectId: string,
   *   sinceMs?: number,
   *   includeOlder?: boolean,
   * }} query
   */
  async countByProject(query) {
    const db = await getControlDriver();
    const sinceMs = query.includeOlder ? undefined : query.sinceMs;
    const params = [query.tenantId, query.userId, query.legacyProjectId];
    let sql = `SELECT COUNT(*) AS count FROM conversation_catalog
       WHERE tenant_id = ? AND user_id = ? AND legacy_project_id = ? AND deleted_at IS NULL`;
    if (typeof sinceMs === 'number' && Number.isFinite(sinceMs)) {
      sql += ` AND (last_activity_at >= ? OR execution_status IN ('queued', 'running', 'paused'))`;
      params.push(new Date(sinceMs).toISOString());
    }
    const row = await db.queryOne(sql, params);
    return Number(row?.count ?? 0);
  },

  /**
   * @param {{ tenantId: string, userId: number, legacyProjectId: string }} query
   */
  async listSoftDeletedSessionIds(query) {
    const db = await getControlDriver();
    const rows = await db.queryAll(
      `SELECT session_id FROM conversation_catalog
       WHERE tenant_id = ? AND user_id = ? AND legacy_project_id = ? AND deleted_at IS NOT NULL`,
      [query.tenantId, query.userId, query.legacyProjectId],
    );
    return catalogStore._sessionIdsToVariantSet(rows);
  },

  /**
   * All soft-deleted session ids for a user (any legacy project).
   * Used to filter disk sidebar lists when catalog shadow-write is on.
   * @param {{ tenantId: string, userId: number }} query
   */
  async listSoftDeletedSessionIdsForUser(query) {
    const db = await getControlDriver();
    const rows = await db.queryAll(
      `SELECT session_id FROM conversation_catalog
       WHERE tenant_id = ? AND user_id = ? AND deleted_at IS NOT NULL`,
      [query.tenantId, query.userId],
    );
    return catalogStore._sessionIdsToVariantSet(rows);
  },

  /** @param {Array<{ session_id?: string }> | null | undefined} rows */
  _sessionIdsToVariantSet(rows) {
    const ids = new Set();
    for (const row of rows ?? []) {
      for (const variant of sessionIdVariants(row.session_id)) {
        ids.add(variant);
      }
    }
    return ids;
  },

  /**
   * @param {{ tenantId: string, userId: number, sessionId: string }} query
   */
  async softDelete(query) {
    const db = await getControlDriver();
    const variants = sessionIdVariants(query.sessionId);
    if (variants.length === 0) return false;
    const placeholders = variants.map(() => '?').join(', ');
    const purgeFlag = db.dialect === 'postgres' ? true : 1;
    const result = await db.execute(
      `UPDATE conversation_catalog
       SET deleted_at = CURRENT_TIMESTAMP, purge_pending = ?, updated_at = CURRENT_TIMESTAMP, status = 'deleted'
       WHERE tenant_id = ? AND user_id = ? AND session_id IN (${placeholders}) AND deleted_at IS NULL`,
      [purgeFlag, query.tenantId, query.userId, ...variants],
    );
    return result.changes > 0;
  },

  /**
   * Physically remove catalog row (+ outbox); path_history cascades on catalog delete.
   * @param {{ tenantId: string, userId: number, sessionId: string }} query
   */
  async hardDelete(query) {
    const db = await getControlDriver();
    const variants = sessionIdVariants(query.sessionId);
    if (variants.length === 0) return false;
    const placeholders = variants.map(() => '?').join(', ');
    await db.execute(
      `DELETE FROM conversation_catalog_outbox
       WHERE tenant_id = ? AND user_id = ? AND session_id IN (${placeholders})`,
      [query.tenantId, query.userId, ...variants],
    );
    const result = await db.execute(
      `DELETE FROM conversation_catalog
       WHERE tenant_id = ? AND user_id = ? AND session_id IN (${placeholders})`,
      [query.tenantId, query.userId, ...variants],
    );
    return result.changes > 0;
  },

  /**
   * Physically remove all catalog rows (+ outbox) for a legacy project id.
   * @param {{ tenantId: string, userId: number, legacyProjectId: string }} query
   */
  async hardDeleteByProject(query) {
    const db = await getControlDriver();
    const rows = await db.queryAll(
      `SELECT session_id FROM conversation_catalog
       WHERE tenant_id = ? AND user_id = ? AND legacy_project_id = ?`,
      [query.tenantId, query.userId, query.legacyProjectId],
    );
    let removed = 0;
    for (const row of rows ?? []) {
      const deleted = await catalogStore.hardDelete({
        tenantId: query.tenantId,
        userId: query.userId,
        sessionId: row.session_id,
      });
      if (deleted) removed += 1;
    }
    return removed;
  },

  /**
   * @param {{ tenantId: string, userId: number, sessionId: string, customTitle: string }} query
   */
  async updateCustomTitle(query) {
    const db = await getControlDriver();
    const sessionId = normalizeSessionId(query.sessionId);
    const result = await db.execute(
      `UPDATE conversation_catalog
       SET custom_title = ?, summary = COALESCE(?, summary), updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND user_id = ? AND session_id = ? AND deleted_at IS NULL`,
      [query.customTitle, query.customTitle, query.tenantId, query.userId, sessionId],
    );
    return result.changes > 0;
  },

  /**
   * @param {{ tenantId: string, userId: number }} query
   */
  async listActiveForUser(query) {
    const db = await getControlDriver();
    const limit = Math.max(1, Math.min(query.limit ?? 200, 500));
    const rows = await db.queryAll(
      `SELECT * FROM conversation_catalog
       WHERE tenant_id = ? AND user_id = ? AND deleted_at IS NULL
       ORDER BY last_activity_at DESC
       LIMIT ?`,
      [query.tenantId, query.userId, limit],
    );
    return rows.map(mapRow);
  },

  async getByKind(query) {
    const db = await getControlDriver();
    const row = await db.queryOne(
      `SELECT * FROM conversation_catalog
       WHERE tenant_id = ? AND user_id = ? AND kind = ? AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 1`,
      [query.tenantId, query.userId, query.kind],
    );
    return mapRow(row);
  },

  async getMaxUpdatedAt(query) {
    const db = await getControlDriver();
    const row = await db.queryOne(
      `SELECT MAX(updated_at) AS max_updated FROM conversation_catalog
       WHERE tenant_id = ? AND user_id = ?`,
      [query.tenantId, query.userId],
    );
    return row?.max_updated ?? null;
  },

  /**
   * @param {{ tenantId: string, userId: number, status?: string, maxAgeHours?: number }} query
   */
  async listByStatus(query) {
    const db = await getControlDriver();
    const status = query.status ?? 'pending';
    const maxAgeHours = query.maxAgeHours ?? 24;
    const rows = await db.queryAll(
      db.dialect === 'postgres'
        ? `SELECT * FROM conversation_catalog
           WHERE tenant_id = $1 AND user_id = $2 AND deleted_at IS NULL
             AND status = $3
             AND created_at >= NOW() - ($4 || ' hours')::interval
           ORDER BY created_at DESC`
        : `SELECT * FROM conversation_catalog
           WHERE tenant_id = ? AND user_id = ? AND deleted_at IS NULL
             AND status = ?
             AND datetime(created_at) >= datetime('now', ?)
           ORDER BY created_at DESC`,
      db.dialect === 'postgres'
        ? [query.tenantId, query.userId, status, String(maxAgeHours)]
        : [query.tenantId, query.userId, status, `-${maxAgeHours} hours`],
    );
    return rows.map(mapRow);
  },

  /**
   * @param {{ tenantId: string, userId: number, query: string, limit?: number }} search
   */
  async search(search) {
    const db = await getControlDriver();
    const needle = `%${String(search.query ?? '').trim().toLowerCase()}%`;
    const limit = Math.max(1, Math.min(search.limit ?? 50, 200));
    const rows = await db.queryAll(
      `SELECT * FROM conversation_catalog
       WHERE tenant_id = ? AND user_id = ? AND deleted_at IS NULL
         AND (
           LOWER(COALESCE(summary, '')) LIKE ?
           OR LOWER(COALESCE(custom_title, '')) LIKE ?
           OR LOWER(COALESCE(ai_title, '')) LIKE ?
           OR LOWER(COALESCE(title, '')) LIKE ?
           OR LOWER(COALESCE(first_prompt, '')) LIKE ?
         )
       ORDER BY last_activity_at DESC
       LIMIT ?`,
      [
        search.tenantId,
        search.userId,
        needle,
        needle,
        needle,
        needle,
        needle,
        limit,
      ],
    );
    return rows.map(mapRow);
  },

  /**
   * @param {{ tenantId: string, userId: number, sessionId: string, payload: CatalogUpsertInput, lastError?: string }} entry
   */
  async enqueueOutbox(entry) {
    const db = await getControlDriver();
    await db.execute(
      `INSERT INTO conversation_catalog_outbox (tenant_id, user_id, session_id, payload_json, last_error)
       VALUES (?, ?, ?, ?, ?)`,
      [
        entry.tenantId,
        entry.userId,
        normalizeSessionId(entry.sessionId),
        JSON.stringify(entry.payload),
        entry.lastError ?? null,
      ],
    );
  },

  /**
   * @param {number} [batchSize]
   */
  async flushOutbox(batchSize = 20) {
    const db = await getControlDriver();
    const rows = await db.queryAll(
      `SELECT * FROM conversation_catalog_outbox
       WHERE next_retry_at <= CURRENT_TIMESTAMP AND attempts < 10
       ORDER BY created_at ASC
       LIMIT ?`,
      [batchSize],
    );
    let flushed = 0;
    for (const row of rows) {
      try {
        const payload = JSON.parse(row.payload_json);
        await catalogStore.upsert(payload);
        await db.execute('DELETE FROM conversation_catalog_outbox WHERE id = ?', [row.id]);
        flushed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const retrySql = db.dialect === 'postgres'
          ? `UPDATE conversation_catalog_outbox
             SET attempts = attempts + 1, last_error = ?, next_retry_at = CURRENT_TIMESTAMP + interval '30 seconds'
             WHERE id = ?`
          : `UPDATE conversation_catalog_outbox
             SET attempts = attempts + 1, last_error = ?, next_retry_at = datetime('now', '+30 seconds')
             WHERE id = ?`;
        await db.execute(retrySql, [message, row.id]);
      }
    }
    return flushed;
  },

  /**
   * Mark purge complete after jsonl removal.
   * @param {{ tenantId: string, userId: number, sessionId: string }} query
   */
  async markPurged(query) {
    const db = await getControlDriver();
    const purgeFlag = db.dialect === 'postgres' ? false : 0;
    await db.execute(
      `UPDATE conversation_catalog
       SET purge_pending = ?, updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND user_id = ? AND session_id = ?`,
      [purgeFlag, query.tenantId, query.userId, normalizeSessionId(query.sessionId)],
    );
  },
};
