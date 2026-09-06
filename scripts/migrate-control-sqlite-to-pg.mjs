#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Migrate SaaS control.db (SQLite) → PostgreSQL.
 *
 * Usage:
 *   node scripts/migrate-control-sqlite-to-pg.mjs --source DATA_ROOT/control.db --target "$SAAS_DATABASE_URL"
 *   node scripts/migrate-control-sqlite-to-pg.mjs --source ... --target ... --dry-run
 *   node scripts/migrate-control-sqlite-to-pg.mjs --source ... --target ... --verify-only
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { applyPostgresMigrations, resetPgIdentitySequences } from '../ui/server/saas/db/postgresDriver.js';

const { Pool } = pg;

const TABLE_SPECS = [
  {
    name: 'tenants',
    columns: ['id', 'name', 'created_at'],
    identity: null,
  },
  {
    name: 'users',
    columns: ['id', 'tenant_id', 'username', 'password_hash', 'role', 'is_active', 'created_at', 'last_login', 'preferences_json'],
    identity: 'id',
  },
  {
    name: 'plans',
    columns: ['id', 'name', 'credits_monthly', 'price_cents', 'is_active', 'created_at'],
    identity: null,
  },
  {
    name: 'sessions',
    columns: ['id', 'user_id', 'expires_at', 'created_at'],
    identity: null,
  },
  {
    name: 'subscriptions',
    columns: ['id', 'user_id', 'plan_id', 'status', 'started_at', 'expires_at'],
    identity: 'id',
  },
  {
    name: 'credit_wallet',
    columns: ['user_id', 'balance', 'updated_at'],
    identity: null,
  },
  {
    name: 'credit_ledger',
    columns: ['id', 'user_id', 'delta', 'reason', 'created_by', 'created_at'],
    identity: 'id',
  },
  {
    name: 'analytics_events',
    columns: ['id', 'event_type', 'user_id', 'tenant_id', 'payload', 'created_at'],
    identity: 'id',
  },
  {
    name: 'usage_session_owner',
    columns: ['session_id', 'user_id', 'tenant_id', 'project_path', 'first_seen', 'last_seen'],
    identity: null,
  },
];

function parseArgs(argv) {
  const args = { dryRun: false, verifyOnly: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--verify-only') args.verifyOnly = true;
    else if (arg === '--source') args.source = argv[++i];
    else if (arg === '--target') args.target = argv[++i];
  }
  if (!args.source || !args.target) {
    throw new Error('Usage: node scripts/migrate-control-sqlite-to-pg.mjs --source <control.db> --target <SAAS_DATABASE_URL> [--dry-run] [--verify-only]');
  }
  return args;
}

function openSqlite(sourcePath) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`SQLite source not found: ${sourcePath}`);
  }
  return new Database(sourcePath, { readonly: true });
}

async function countTableSqlite(sqlite, table) {
  const row = sqlite.prepare(`SELECT COUNT(*) AS cnt FROM ${table}`).get();
  return Number(row.cnt);
}

async function countTablePg(pool, table) {
  const result = await pool.query(`SELECT COUNT(*) AS cnt FROM ${table}`);
  return Number(result.rows[0].cnt);
}

async function sumSqlite(sqlite, sql) {
  const row = sqlite.prepare(sql).get();
  return Number(Object.values(row)[0] ?? 0);
}

async function sumPg(pool, sql) {
  const result = await pool.query(sql);
  return Number(Object.values(result.rows[0] ?? {})[0] ?? 0);
}

function buildInsertSql(spec) {
  const cols = spec.columns.join(', ');
  const placeholders = spec.columns.map((_, i) => `$${i + 1}`).join(', ');
  if (spec.identity) {
    return `INSERT INTO ${spec.name} (${cols}) OVERRIDING SYSTEM VALUE VALUES (${placeholders})`;
  }
  return `INSERT INTO ${spec.name} (${cols}) VALUES (${placeholders})`;
}

async function truncateTarget(pool) {
  const names = TABLE_SPECS.map((t) => t.name).join(', ');
  await pool.query(`TRUNCATE ${names} RESTART IDENTITY CASCADE`);
}

async function importTable(sqlite, pool, spec) {
  const rows = sqlite.prepare(`SELECT ${spec.columns.join(', ')} FROM ${spec.name}`).all();
  if (rows.length === 0) return 0;
  const insertSql = buildInsertSql(spec);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      const values = spec.columns.map((col) => row[col] ?? null);
      await client.query(insertSql, values);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return rows.length;
}

async function verifyCounts(sqlite, pool) {
  for (const spec of TABLE_SPECS) {
    const sqliteCount = await countTableSqlite(sqlite, spec.name);
    const pgCount = await countTablePg(pool, spec.name);
    if (sqliteCount !== pgCount) {
      throw new Error(`COUNT mismatch ${spec.name}: sqlite=${sqliteCount} pg=${pgCount}`);
    }
  }

  const sqliteWalletSum = await sumSqlite(sqlite, 'SELECT COALESCE(SUM(balance), 0) AS s FROM credit_wallet');
  const pgWalletSum = await sumPg(pool, 'SELECT COALESCE(SUM(balance), 0) AS s FROM credit_wallet');
  if (sqliteWalletSum !== pgWalletSum) {
    throw new Error(`credit_wallet SUM(balance) mismatch: sqlite=${sqliteWalletSum} pg=${pgWalletSum}`);
  }

  const sqliteLedgerSum = await sumSqlite(sqlite, 'SELECT COALESCE(SUM(delta), 0) AS s FROM credit_ledger');
  const pgLedgerSum = await sumPg(pool, 'SELECT COALESCE(SUM(delta), 0) AS s FROM credit_ledger');
  if (sqliteLedgerSum !== pgLedgerSum) {
    throw new Error(`credit_ledger SUM(delta) mismatch: sqlite=${sqliteLedgerSum} pg=${pgLedgerSum}`);
  }

  const sqliteUsers = sqlite.prepare('SELECT id, username, tenant_id, role FROM users ORDER BY id').all();
  const pgUsers = (await pool.query('SELECT id, username, tenant_id, role FROM users ORDER BY id')).rows;
  if (sqliteUsers.length !== pgUsers.length) {
    throw new Error('users row count mismatch during hash verify');
  }
  for (let i = 0; i < sqliteUsers.length; i += 1) {
    const a = sqliteUsers[i];
    const b = pgUsers[i];
    if (a.id !== b.id || a.username !== b.username || a.tenant_id !== b.tenant_id || a.role !== b.role) {
      throw new Error(`users mismatch at index ${i}: sqlite=${JSON.stringify(a)} pg=${JSON.stringify(b)}`);
    }
  }
}

export async function migrateControlSqliteToPg({ source, target, dryRun = false, verifyOnly = false }) {
  const sqlite = openSqlite(source);
  const prevUrl = process.env.SAAS_DATABASE_URL;
  process.env.SAAS_DATABASE_URL = target;
  let pool;
  try {
    pool = new Pool({ connectionString: target });
    await applyPostgresMigrations(pool);

    if (verifyOnly) {
      await verifyCounts(sqlite, pool);
      return { ok: true, mode: 'verify-only' };
    }

    if (dryRun) {
      const summary = {};
      for (const spec of TABLE_SPECS) {
        summary[spec.name] = await countTableSqlite(sqlite, spec.name);
      }
      return { ok: true, mode: 'dry-run', summary };
    }

    await truncateTarget(pool);
    const imported = {};
    for (const spec of TABLE_SPECS) {
      imported[spec.name] = await importTable(sqlite, pool, spec);
    }
    await resetPgIdentitySequences(pool);
    await verifyCounts(sqlite, pool);
    return { ok: true, mode: 'migrate', imported };
  } finally {
    sqlite.close();
    if (pool) await pool.end();
    if (prevUrl === undefined) delete process.env.SAAS_DATABASE_URL;
    else process.env.SAAS_DATABASE_URL = prevUrl;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  migrateControlSqliteToPg(parseArgs(process.argv))
    .then((result) => {
      console.log('[migrate-control-sqlite-to-pg] OK', result);
    })
    .catch((error) => {
      console.error('[migrate-control-sqlite-to-pg] FAIL:', error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
