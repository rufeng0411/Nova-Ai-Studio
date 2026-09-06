/**
 * PD-SAAS-FORK: PostgreSQL control DB driver (pg Pool + migrations).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { convertPlaceholders } from './dialect.js';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function poolOptions(env = process.env) {
  const connectionString = env.SAAS_DATABASE_URL;
  if (!connectionString) {
    throw new Error('SAAS_DATABASE_URL is required for PostgreSQL control DB');
  }
  const sslMode = env.SAAS_DATABASE_SSL;
  let ssl;
  if (sslMode === 'require' || sslMode === 'true') {
    ssl = { rejectUnauthorized: sslMode !== 'true' };
  }
  return {
    connectionString,
    max: Number(env.SAAS_DATABASE_POOL_MAX || 10),
    idleTimeoutMillis: Number(env.SAAS_DATABASE_IDLE_MS || 30_000),
    connectionTimeoutMillis: Number(env.SAAS_DATABASE_CONNECT_MS || 5_000),
    options: '-c statement_timeout=8000',
    ...(ssl ? { ssl } : {}),
  };
}

function wrapClient(client) {
  const dialect = 'postgres';

  return {
    dialect,

    async queryOne(sql, params = []) {
      const text = convertPlaceholders(sql, dialect);
      const result = await client.query(text, params);
      return result.rows[0] ?? undefined;
    },

    async queryAll(sql, params = []) {
      const text = convertPlaceholders(sql, dialect);
      const result = await client.query(text, params);
      return result.rows;
    },

    async execute(sql, params = []) {
      const text = convertPlaceholders(sql, dialect);
      const result = await client.query(text, params);
      return {
        changes: result.rowCount ?? 0,
        lastInsertId: result.rows[0]?.id != null ? Number(result.rows[0].id) : undefined,
      };
    },

    async transaction(fn) {
      await client.query('BEGIN');
      try {
        const result = await fn(wrapClient(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    },

    async ping() {
      await client.query('SELECT 1 AS ok');
      return true;
    },

    async close() {
      // client lifecycle managed by pool
    },
  };
}

function wrapPool(pool) {
  const dialect = 'postgres';

  return {
    dialect,

    async queryOne(sql, params = []) {
      const text = convertPlaceholders(sql, dialect);
      const result = await pool.query(text, params);
      return result.rows[0] ?? undefined;
    },

    async queryAll(sql, params = []) {
      const text = convertPlaceholders(sql, dialect);
      const result = await pool.query(text, params);
      return result.rows;
    },

    async execute(sql, params = []) {
      const text = convertPlaceholders(sql, dialect);
      const result = await pool.query(text, params);
      return {
        changes: result.rowCount ?? 0,
        lastInsertId: result.rows[0]?.id != null ? Number(result.rows[0].id) : undefined,
      };
    },

    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const tx = wrapClient(client);
        const result = await fn(tx);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async ping() {
      await pool.query('SELECT 1 AS ok');
      return true;
    },

    async close() {
      await pool.end();
    },

    pool,
  };
}

async function applyMigrations(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    const applied = await pool.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
    if (applied.rowCount > 0) {
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export async function createPostgresDriver(env = process.env) {
  const pool = new Pool(poolOptions(env));
  await applyMigrations(pool);
  return wrapPool(pool);
}

/**
 * Apply pending SQL migrations to a PostgreSQL pool.
 * @param {import('pg').Pool} pool
 */
export async function applyPostgresMigrations(pool) {
  await applyMigrations(pool);
}

/**
 * Reset identity sequences after bulk import (migration CLI).
 * @param {import('pg').Pool} pool
 */
export async function resetPgIdentitySequences(pool) {
  const tables = [
    { table: 'users', column: 'id' },
    { table: 'subscriptions', column: 'id' },
    { table: 'credit_ledger', column: 'id' },
    { table: 'analytics_events', column: 'id' },
  ];
  for (const { table, column } of tables) {
    await pool.query(
      `SELECT setval(
         pg_get_serial_sequence('${table}', '${column}'),
         COALESCE((SELECT MAX(${column}) FROM ${table}), 1),
         (SELECT COUNT(*) > 0 FROM ${table})
       )`,
    );
  }
}

export { poolOptions };
