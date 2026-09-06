/**
 * PD-SAAS-FORK: SQLite control DB driver (better-sqlite3).
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDataRoot } from '../tenant/paths.js';
import { convertPlaceholders } from './dialect.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

function resolveControlDbPath(env = process.env) {
  return path.join(getDataRoot(env), 'control.db');
}

function wrapDb(db) {
  const dialect = 'sqlite';

  return {
    dialect,

    async queryOne(sql, params = []) {
      const stmt = db.prepare(convertPlaceholders(sql, dialect));
      return stmt.get(...params) ?? undefined;
    },

    async queryAll(sql, params = []) {
      const stmt = db.prepare(convertPlaceholders(sql, dialect));
      return stmt.all(...params);
    },

    async execute(sql, params = []) {
      const stmt = db.prepare(convertPlaceholders(sql, dialect));
      const result = stmt.run(...params);
      return {
        changes: result.changes,
        lastInsertId: Number(result.lastInsertRowid),
      };
    },

    async transaction(fn) {
      db.exec('BEGIN');
      try {
        const result = await fn(wrapDb(db));
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },

    async ping() {
      db.prepare('SELECT 1 AS ok').get();
      return true;
    },

    async close() {
      db.close();
    },
  };
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export async function createSqliteDriver(env = process.env) {
  const dbPath = resolveControlDbPath(env);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);

  const userCols = db.prepare('PRAGMA table_info(users)').all();
  if (!userCols.some((col) => col.name === 'preferences_json')) {
    db.exec('ALTER TABLE users ADD COLUMN preferences_json TEXT');
  }
  if (!userCols.some((col) => col.name === 'group_id')) {
    db.exec("ALTER TABLE users ADD COLUMN group_id TEXT NOT NULL DEFAULT 'normal'");
    db.exec('CREATE INDEX IF NOT EXISTS idx_saas_users_group ON users(group_id)');
  }

  // PD-SAAS-FORK: migration 002_user_workspaces (SQLite)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_workspaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      tenant_id TEXT NOT NULL,
      workspace_uuid TEXT NOT NULL,
      legacy_project_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      storage_kind TEXT NOT NULL DEFAULT 'local',
      local_root_path TEXT,
      canonical_project_key TEXT NOT NULL,
      origin_device_id TEXT,
      sync_enabled INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, user_id, workspace_uuid),
      UNIQUE (tenant_id, user_id, legacy_project_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_user_workspaces_user ON user_workspaces(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_workspaces_tenant ON user_workspaces(tenant_id);
    CREATE TABLE IF NOT EXISTS storage_sync_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      bytes_synced INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      started_at DATETIME,
      finished_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workspace_id) REFERENCES user_workspaces(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_storage_sync_jobs_workspace ON storage_sync_jobs(workspace_id);
  `);

  // PD-SAAS-FORK: migration 003_conversation_catalog (SQLite)
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversation_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      workspace_id INTEGER,
      session_id TEXT NOT NULL,
      legacy_project_id TEXT NOT NULL,
      transcript_rel_path TEXT NOT NULL,
      transcript_abs_hash TEXT,
      workspace_uuid TEXT,
      title TEXT,
      ai_title TEXT,
      custom_title TEXT,
      summary TEXT,
      first_prompt TEXT,
      tag TEXT,
      message_count INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME,
      purge_pending INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      kind TEXT,
      source TEXT NOT NULL DEFAULT 'web',
      transcript_uri TEXT,
      UNIQUE (tenant_id, user_id, session_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (workspace_id) REFERENCES user_workspaces(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_conversation_catalog_user_active
      ON conversation_catalog (tenant_id, user_id, last_activity_at DESC);
    CREATE INDEX IF NOT EXISTS idx_conversation_catalog_project_active
      ON conversation_catalog (tenant_id, user_id, legacy_project_id, last_activity_at DESC);
    CREATE INDEX IF NOT EXISTS idx_conversation_catalog_purge
      ON conversation_catalog (purge_pending, updated_at);
    CREATE TABLE IF NOT EXISTS conversation_catalog_path_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      catalog_id INTEGER NOT NULL,
      old_transcript_rel_path TEXT NOT NULL,
      new_transcript_rel_path TEXT NOT NULL,
      reason TEXT,
      changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (catalog_id) REFERENCES conversation_catalog(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_conversation_catalog_path_history_catalog
      ON conversation_catalog_path_history (catalog_id, changed_at DESC);
    CREATE TABLE IF NOT EXISTS conversation_catalog_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      session_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      next_retry_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_conversation_catalog_outbox_retry
      ON conversation_catalog_outbox (next_retry_at, attempts);
  `);

  // PD-SAAS-FORK: migration 004_cold_resume_guard (SQLite)
  db.exec(`
    CREATE TABLE IF NOT EXISTS cold_resume_guard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      session_id TEXT NOT NULL,
      turn_id TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_fired_at DATETIME,
      last_activity_at DATETIME,
      last_progress_ptr TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (tenant_id, user_id, session_id, turn_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_cold_resume_guard_session
      ON cold_resume_guard (tenant_id, user_id, session_id);
  `);

  // PD-SAAS-FORK: migration 006_turn_execution_status (SQLite)
  try {
    db.exec(`ALTER TABLE conversation_catalog ADD COLUMN execution_status TEXT NOT NULL DEFAULT 'idle'`);
  } catch {
    // column exists
  }
  try {
    db.exec(`ALTER TABLE conversation_catalog ADD COLUMN queue_position INTEGER`);
  } catch {
    // column exists
  }
  try {
    db.exec(`ALTER TABLE conversation_catalog ADD COLUMN queued_payload_json TEXT`);
  } catch {
    // column exists
  }
  try {
    db.exec(`ALTER TABLE conversation_catalog ADD COLUMN paused_at DATETIME`);
  } catch {
    // column exists
  }
  try {
    db.exec(`ALTER TABLE conversation_catalog ADD COLUMN paused_reason TEXT`);
  } catch {
    // column exists
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversation_catalog_execution_status
      ON conversation_catalog (tenant_id, user_id, execution_status);
    UPDATE conversation_catalog SET execution_status = 'idle'
      WHERE execution_status IS NULL OR execution_status = '';
  `);

  // PD-SAAS-FORK: migration 005_session_tombstones (SQLite)
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_tombstones (
      session_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      reason TEXT NOT NULL DEFAULT 'user-delete',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (tenant_id, user_id, session_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_session_tombstones_session ON session_tombstones(session_id);
  `);

  // PD-SAAS-FORK: migration 007_showcase (SQLite)
  db.exec(`
    CREATE TABLE IF NOT EXISTS showcase_sections (
      id TEXT PRIMARY KEY,
      title_zh TEXT NOT NULL,
      title_en TEXT NOT NULL,
      lead_zh TEXT,
      lead_en TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      star INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_showcase_sections_sort ON showcase_sections(sort_order);
    CREATE TABLE IF NOT EXISTS showcase_items (
      id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      name_zh TEXT NOT NULL,
      name_en TEXT NOT NULL,
      annotation_zh TEXT,
      annotation_en TEXT,
      badge_zh TEXT,
      badge_en TEXT,
      prompt_zh TEXT,
      prompt_en TEXT,
      thumb TEXT,
      href TEXT,
      star INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      source_session_id TEXT,
      source_artifact_paths TEXT,
      published_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (section_id) REFERENCES showcase_sections(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_showcase_items_section ON showcase_items(section_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_showcase_items_status ON showcase_items(status);
    CREATE INDEX IF NOT EXISTS idx_showcase_items_published ON showcase_items(published_at);
  `);

  // PD-SAAS-FORK: migration 008_markdown_share_links (SQLite)
  db.exec(`
    CREATE TABLE IF NOT EXISTS markdown_share_links (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      project_key TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      hint_dir TEXT,
      title TEXT,
      word_count INTEGER NOT NULL DEFAULT 0,
      seo_indexable INTEGER NOT NULL DEFAULT 0,
      revoked_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_markdown_share_links_lookup
      ON markdown_share_links (tenant_id, user_id, project_key, relative_path);
  `);

  return wrapDb(db);
}

export { resolveControlDbPath };
