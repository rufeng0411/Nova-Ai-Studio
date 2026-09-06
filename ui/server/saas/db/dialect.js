/**
 * PD-SAAS-FORK: SQL dialect helpers for SQLite / PostgreSQL control DB.
 */

/** @typedef {'sqlite' | 'postgres'} ControlDbDialect */

/**
 * @param {string} sql
 * @param {ControlDbDialect} dialect
 */
export function convertPlaceholders(sql, dialect) {
  if (dialect !== 'postgres') {
    return sql;
  }
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

/**
 * @param {string} column
 * @param {ControlDbDialect} dialect
 */
export function dateExpr(column, dialect) {
  return dialect === 'postgres' ? `(${column})::date` : `date(${column})`;
}

/**
 * @param {ControlDbDialect} dialect
 */
export function insertIgnorePlansSql(dialect) {
  if (dialect === 'postgres') {
    return `INSERT INTO plans (id, name, credits_monthly, price_cents, is_active)
            VALUES (?, ?, ?, ?, TRUE)
            ON CONFLICT (id) DO NOTHING`;
  }
  return `INSERT OR IGNORE INTO plans (id, name, credits_monthly, price_cents, is_active)
          VALUES (?, ?, ?, ?, 1)`;
}

/**
 * @param {ControlDbDialect} dialect
 */
export function usageSessionOwnerUpsertSql(dialect) {
  return `INSERT INTO usage_session_owner (session_id, user_id, tenant_id, project_path, first_seen, last_seen)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(session_id) DO UPDATE SET
            user_id = COALESCE(excluded.user_id, usage_session_owner.user_id),
            tenant_id = COALESCE(excluded.tenant_id, usage_session_owner.tenant_id),
            project_path = COALESCE(excluded.project_path, usage_session_owner.project_path),
            last_seen = CURRENT_TIMESTAMP`;
}

/**
 * @param {ControlDbDialect} _dialect
 */
export function sessionTombstoneUpsertSql(_dialect) {
  return `INSERT INTO session_tombstones (session_id, tenant_id, user_id, reason, created_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(tenant_id, user_id, session_id) DO UPDATE SET
            reason = excluded.reason,
            created_at = CURRENT_TIMESTAMP`;
}

/**
 * @param {ControlDbDialect} dialect
 */
export function conversationCatalogUpsertSql(_dialect) {
  return `INSERT INTO conversation_catalog (
            tenant_id, user_id, workspace_id, session_id, legacy_project_id,
            transcript_rel_path, transcript_abs_hash, workspace_uuid,
            title, ai_title, custom_title, summary, first_prompt, tag,
            message_count, created_at, last_activity_at, updated_at,
            status, kind, source, transcript_uri
          ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP,
            COALESCE(?, 'active'), ?, COALESCE(?, 'web'), ?
          )
          ON CONFLICT(tenant_id, user_id, session_id) DO UPDATE SET
            workspace_id = COALESCE(excluded.workspace_id, conversation_catalog.workspace_id),
            legacy_project_id = COALESCE(excluded.legacy_project_id, conversation_catalog.legacy_project_id),
            transcript_rel_path = COALESCE(excluded.transcript_rel_path, conversation_catalog.transcript_rel_path),
            transcript_abs_hash = COALESCE(excluded.transcript_abs_hash, conversation_catalog.transcript_abs_hash),
            workspace_uuid = COALESCE(excluded.workspace_uuid, conversation_catalog.workspace_uuid),
            title = COALESCE(conversation_catalog.title, excluded.title),
            ai_title = COALESCE(conversation_catalog.ai_title, excluded.ai_title),
            custom_title = COALESCE(conversation_catalog.custom_title, excluded.custom_title),
            summary = COALESCE(conversation_catalog.summary, excluded.summary),
            first_prompt = COALESCE(conversation_catalog.first_prompt, excluded.first_prompt),
            tag = COALESCE(excluded.tag, conversation_catalog.tag),
            message_count = CASE
              WHEN excluded.message_count > 0 THEN excluded.message_count
              ELSE conversation_catalog.message_count
            END,
            last_activity_at = COALESCE(excluded.last_activity_at, conversation_catalog.last_activity_at),
            updated_at = CURRENT_TIMESTAMP,
            status = CASE
              WHEN conversation_catalog.deleted_at IS NOT NULL THEN conversation_catalog.status
              ELSE COALESCE(excluded.status, conversation_catalog.status)
            END,
            kind = COALESCE(excluded.kind, conversation_catalog.kind),
            source = COALESCE(excluded.source, conversation_catalog.source),
            transcript_uri = COALESCE(excluded.transcript_uri, conversation_catalog.transcript_uri),
            deleted_at = conversation_catalog.deleted_at,
            purge_pending = conversation_catalog.purge_pending`;
}

/**
 * PD-SAAS-FORK: Accept-turn catalog upsert with execution_status.
 * @param {ControlDbDialect} _dialect
 */
export function conversationCatalogAcceptTurnUpsertSql(_dialect) {
  return `INSERT INTO conversation_catalog (
            tenant_id, user_id, workspace_id, session_id, legacy_project_id,
            transcript_rel_path, transcript_abs_hash, workspace_uuid,
            title, ai_title, custom_title, summary, first_prompt, tag,
            message_count, created_at, last_activity_at, updated_at,
            status, kind, source, transcript_uri,
            execution_status, queue_position, queued_payload_json
          ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP,
            COALESCE(?, 'pending'), ?, COALESCE(?, 'web'), ?,
            COALESCE(?, 'queued'), ?, ?
          )
          ON CONFLICT(tenant_id, user_id, session_id) DO UPDATE SET
            legacy_project_id = COALESCE(excluded.legacy_project_id, conversation_catalog.legacy_project_id),
            transcript_rel_path = COALESCE(excluded.transcript_rel_path, conversation_catalog.transcript_rel_path),
            first_prompt = COALESCE(conversation_catalog.first_prompt, excluded.first_prompt),
            title = COALESCE(conversation_catalog.title, excluded.title),
            summary = COALESCE(conversation_catalog.summary, excluded.summary),
            ai_title = COALESCE(conversation_catalog.ai_title, excluded.ai_title),
            custom_title = COALESCE(conversation_catalog.custom_title, excluded.custom_title),
            message_count = CASE
              WHEN excluded.message_count > 0 THEN excluded.message_count
              ELSE conversation_catalog.message_count
            END,
            last_activity_at = COALESCE(excluded.last_activity_at, conversation_catalog.last_activity_at),
            updated_at = CURRENT_TIMESTAMP,
            status = CASE
              WHEN conversation_catalog.deleted_at IS NOT NULL THEN conversation_catalog.status
              ELSE COALESCE(excluded.status, conversation_catalog.status)
            END,
            execution_status = COALESCE(excluded.execution_status, conversation_catalog.execution_status),
            queue_position = excluded.queue_position,
            queued_payload_json = excluded.queued_payload_json,
            deleted_at = conversation_catalog.deleted_at,
            purge_pending = conversation_catalog.purge_pending`;
}
