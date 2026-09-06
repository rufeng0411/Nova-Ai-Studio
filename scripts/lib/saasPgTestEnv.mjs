/**
 * PD-SAAS-FORK: PostgreSQL test environment helpers for SaaS control DB tests.
 */
import pg from 'pg';
import { applyPostgresMigrations } from '../../ui/server/saas/db/postgresDriver.js';

const { Client, Pool } = pg;

export const DEFAULT_PG_TEST_URL =
  process.env.SAAS_PG_TEST_URL || 'postgresql://postgres@127.0.0.1:5432/pilotdeck_saas_test';

export function resolveSaasPgTestUrl() {
  return process.env.SAAS_DATABASE_URL || DEFAULT_PG_TEST_URL;
}

/**
 * Ensure the test database exists (connects to postgres maintenance DB).
 */
export async function ensurePgTestDatabase(url = DEFAULT_PG_TEST_URL) {
  const parsed = new URL(url);
  const dbName = parsed.pathname.replace(/^\//, '') || 'pilotdeck_saas_test';
  parsed.pathname = '/postgres';

  const client = new Client({ connectionString: parsed.toString() });
  await client.connect();
  try {
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (exists.rowCount === 0) {
      await client.query(`CREATE DATABASE ${dbName}`);
    }
  } finally {
    await client.end();
  }
}

export async function isPgReachable(url = DEFAULT_PG_TEST_URL) {
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    await client.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Apply schema migrations then truncate (fresh test DB).
 */
export async function resetPgControlTables(url) {
  const pool = new Pool({ connectionString: url });
  try {
    await applyPostgresMigrations(pool);
    await pool.query(`
      TRUNCATE tenants, users, sessions, plans, subscriptions, credit_wallet,
               credit_ledger, analytics_events, usage_session_owner
      RESTART IDENTITY CASCADE
    `);
  } finally {
    await pool.end();
  }
}

/**
 * Ensure database exists, schema applied, tables empty.
 */
export async function preparePgTestDatabase(url = DEFAULT_PG_TEST_URL) {
  await ensurePgTestDatabase(url);
  await resetPgControlTables(url);
}
