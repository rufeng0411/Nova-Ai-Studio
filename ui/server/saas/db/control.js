/**
 * PD-SAAS-FORK: SaaS control database (users, tenants) — SQLite or PostgreSQL.
 */
import { createSqliteDriver, resolveControlDbPath } from './sqliteDriver.js';
import { createPostgresDriver } from './postgresDriver.js';

/** @type {import('./sqliteDriver.js').default | ReturnType<typeof wrapPool> | null} */
let driver = null;
/** @type {Promise<any> | null} */
let initPromise = null;

export function getControlDbBackend(env = process.env) {
  return env.SAAS_DATABASE_URL ? 'postgres' : 'sqlite';
}

export function getControlDbPath(env = process.env) {
  if (env.SAAS_DATABASE_URL) {
    return env.SAAS_DATABASE_URL;
  }
  return resolveControlDbPath(env);
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export async function openControlDatabase(env = process.env) {
  if (driver) {
    return driver;
  }
  if (initPromise) {
    return initPromise;
  }
  initPromise = (async () => {
    try {
      if (env.SAAS_DATABASE_URL) {
        driver = await createPostgresDriver(env);
      } else {
        driver = await createSqliteDriver(env);
      }
      return driver;
    } catch (error) {
      driver = null;
      initPromise = null;
      throw error;
    }
  })();
  return initPromise;
}

export async function getControlDriver() {
  return openControlDatabase();
}

export async function pingControlDatabase(env = process.env) {
  try {
    const db = await openControlDatabase(env);
    return db.ping();
  } catch (error) {
    console.warn('[saas] control DB ping failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

export async function closeControlDatabase() {
  if (driver) {
    await driver.close().catch(() => {});
    driver = null;
  }
  initPromise = null;
}

export const controlUserDb = {
  async hasUsers() {
    const db = await getControlDriver();
    const row = await db.queryOne('SELECT COUNT(*) AS count FROM users');
    return Number(row?.count ?? 0) > 0;
  },

  async getUserByUsername(username) {
    const db = await getControlDriver();
    return db.queryOne('SELECT * FROM users WHERE username = ? AND is_active = TRUE', [username]);
  },

  async getUserById(userId) {
    const db = await getControlDriver();
    return db.queryOne(
      'SELECT id, tenant_id, username, role, group_id, created_at, last_login FROM users WHERE id = ? AND is_active = TRUE',
      [userId],
    );
  },

  async getUserGroupId(userId) {
    try {
      const db = await getControlDriver();
      const row = await db.queryOne('SELECT group_id FROM users WHERE id = ? AND is_active = TRUE', [userId]);
      const value = String(row?.group_id || '').trim();
      return value || 'normal';
    } catch (error) {
      console.warn('[saas] getUserGroupId fallback to normal:', error instanceof Error ? error.message : error);
      return 'normal';
    }
  },

  async setUserGroupId(userId, groupId) {
    const db = await getControlDriver();
    const next = String(groupId || 'normal').trim() || 'normal';
    const result = await db.execute('UPDATE users SET group_id = ? WHERE id = ?', [next, userId]);
    return result.changes > 0;
  },

  async getUserWithHashById(userId) {
    const db = await getControlDriver();
    return db.queryOne('SELECT * FROM users WHERE id = ? AND is_active = TRUE', [userId]);
  },

  async updatePassword(userId, passwordHash) {
    const db = await getControlDriver();
    await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
  },

  async createUser({ tenantId, username, passwordHash, role = 'member', groupId = 'normal' }) {
    const db = await getControlDriver();
    const normalizedGroupId = String(groupId || 'normal').trim() || 'normal';
    if (db.dialect === 'postgres') {
      const row = await db.queryOne(
        'INSERT INTO users (tenant_id, username, password_hash, role, group_id) VALUES (?, ?, ?, ?, ?) RETURNING id',
        [tenantId, username, passwordHash, role, normalizedGroupId],
      );
      return {
        id: row.id,
        tenant_id: tenantId,
        username,
        role,
        group_id: normalizedGroupId,
      };
    }
    const result = await db.execute(
      'INSERT INTO users (tenant_id, username, password_hash, role, group_id) VALUES (?, ?, ?, ?, ?)',
      [tenantId, username, passwordHash, role, normalizedGroupId],
    );
    return {
      id: result.lastInsertId,
      tenant_id: tenantId,
      username,
      role,
      group_id: normalizedGroupId,
    };
  },

  async updateLastLogin(userId) {
    try {
      const db = await getControlDriver();
      await db.execute('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
    } catch (error) {
      console.warn('[saas] failed to update last login:', error instanceof Error ? error.message : error);
    }
  },
};

export const controlTenantDb = {
  async getTenantById(tenantId) {
    const db = await getControlDriver();
    return db.queryOne('SELECT * FROM tenants WHERE id = ?', [tenantId]);
  },

  async ensureTenant(id, name) {
    const existing = await controlTenantDb.getTenantById(id);
    if (existing) {
      return existing;
    }
    const db = await getControlDriver();
    await db.execute('INSERT INTO tenants (id, name) VALUES (?, ?)', [id, name]);
    return controlTenantDb.getTenantById(id);
  },
};
