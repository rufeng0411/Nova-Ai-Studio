/**
 * PD-SAAS-FORK: Billing data access (plans, wallet, subscriptions).
 */
import { getControlDriver } from '../db/control.js';
import { insertIgnorePlansSql } from '../db/dialect.js';

const DEFAULT_PLANS = [
  { id: 'trial', name: '试用版', credits_monthly: 100, price_cents: 0 },
  { id: 'pro', name: '专业版', credits_monthly: 5000, price_cents: 9900 },
  { id: 'team', name: '团队版', credits_monthly: 20000, price_cents: 29900 },
];

export async function seedDefaultPlans() {
  const db = await getControlDriver();
  const sql = insertIgnorePlansSql(db.dialect);
  for (const plan of DEFAULT_PLANS) {
    await db.execute(sql, [plan.id, plan.name, plan.credits_monthly, plan.price_cents]);
  }
}

async function ensureWalletOnConn(conn, userId, initialBalance = 0) {
  const existing = await conn.queryOne('SELECT user_id, balance, updated_at FROM credit_wallet WHERE user_id = ?', [
    userId,
  ]);
  if (existing) {
    return existing;
  }
  await conn.execute('INSERT INTO credit_wallet (user_id, balance) VALUES (?, ?)', [userId, initialBalance]);
  return conn.queryOne('SELECT user_id, balance, updated_at FROM credit_wallet WHERE user_id = ?', [userId]);
}

async function addCreditOnConn(conn, userId, delta, { reason = '', createdBy = null } = {}) {
  await ensureWalletOnConn(conn, userId, 0);
  await conn.execute(
    'UPDATE credit_wallet SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
    [delta, userId],
  );
  await conn.execute('INSERT INTO credit_ledger (user_id, delta, reason, created_by) VALUES (?, ?, ?, ?)', [
    userId,
    delta,
    reason,
    createdBy,
  ]);
  return conn.queryOne('SELECT user_id, balance, updated_at FROM credit_wallet WHERE user_id = ?', [userId]);
}

export const billingDb = {
  async listPlans() {
    const db = await getControlDriver();
    return db.queryAll(
      'SELECT id, name, credits_monthly, price_cents FROM plans WHERE is_active = TRUE ORDER BY price_cents',
    );
  },

  async getPlan(planId) {
    const db = await getControlDriver();
    return db.queryOne('SELECT id, name, credits_monthly, price_cents FROM plans WHERE id = ? AND is_active = TRUE', [
      planId,
    ]);
  },

  async getWallet(userId) {
    const db = await getControlDriver();
    return db.queryOne('SELECT user_id, balance, updated_at FROM credit_wallet WHERE user_id = ?', [userId]);
  },

  async ensureWallet(userId, initialBalance = 0) {
    const db = await getControlDriver();
    return ensureWalletOnConn(db, userId, initialBalance);
  },

  async addCredit(userId, delta, { reason = '', createdBy = null } = {}) {
    const db = await getControlDriver();
    return addCreditOnConn(db, userId, delta, { reason, createdBy });
  },

  async listLedger(userId, limit = 50) {
    const db = await getControlDriver();
    return db.queryAll(
      `SELECT id, delta, reason, created_by, created_at
       FROM credit_ledger WHERE user_id = ? ORDER BY id DESC LIMIT ?`,
      [userId, limit],
    );
  },

  async getActiveSubscription(userId) {
    const db = await getControlDriver();
    return db.queryOne(
      `SELECT s.id, s.plan_id, s.status, s.started_at, p.name AS plan_name
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.user_id = ? AND s.status = 'active'
       ORDER BY s.started_at DESC LIMIT 1`,
      [userId],
    );
  },

  async subscribeUser(userId, planId) {
    const plan = await billingDb.getPlan(planId);
    if (!plan) {
      throw new Error('plan_not_found');
    }
    const db = await getControlDriver();
    await db.transaction(async (tx) => {
      await tx.execute('UPDATE subscriptions SET status = ? WHERE user_id = ? AND status = ?', [
        'replaced',
        userId,
        'active',
      ]);
      await tx.execute('INSERT INTO subscriptions (user_id, plan_id, status) VALUES (?, ?, ?)', [
        userId,
        planId,
        'active',
      ]);
      await addCreditOnConn(tx, userId, plan.credits_monthly, {
        reason: `subscribe:${planId}`,
        createdBy: userId,
      });
    });
    return billingDb.getActiveSubscription(userId);
  },
};
