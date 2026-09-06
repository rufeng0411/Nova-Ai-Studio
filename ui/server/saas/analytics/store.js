/**
 * PD-SAAS-FORK: Analytics event store & aggregation.
 */
import { getControlDriver } from '../db/control.js';
import { dateExpr } from '../db/dialect.js';
import { billingDb } from '../billing/store.js';

export async function recordAnalyticsEvent(
  eventType,
  { userId = null, tenantId = null, payload = null } = {},
) {
  try {
    const db = await getControlDriver();
    await db.execute('INSERT INTO analytics_events (event_type, user_id, tenant_id, payload) VALUES (?, ?, ?, ?)', [
      eventType,
      userId,
      tenantId,
      payload ? JSON.stringify(payload) : null,
    ]);
  } catch (error) {
    console.warn('[saas] analytics record failed:', error instanceof Error ? error.message : error);
  }
}

function lastNDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function seriesFromCounts(rows, days, valueKey = 'count') {
  const map = new Map(rows.map((row) => [String(row.day), row.cnt]));
  return days.map((date) => ({ date, [valueKey]: map.get(date) ?? 0 }));
}

export async function aggregateDashboardStats({ routerStats = null } = {}) {
  const db = await getControlDriver();
  const days = lastNDays(14);
  const since = `${days[0]} 00:00:00`;
  const createdDay = dateExpr('created_at', db.dialect);
  const startedDay = dateExpr('started_at', db.dialect);

  const visitRows = await db.queryAll(
    `SELECT ${createdDay} AS day, COUNT(*) AS cnt
     FROM analytics_events WHERE event_type = 'visit' AND created_at >= ?
     GROUP BY day ORDER BY day`,
    [since],
  );

  const userRows = await db.queryAll(
    `SELECT ${createdDay} AS day, COUNT(*) AS cnt
     FROM analytics_events WHERE event_type = 'register' AND created_at >= ?
     GROUP BY day ORDER BY day`,
    [since],
  );

  const opRows = await db.queryAll(
    `SELECT ${createdDay} AS day, COUNT(*) AS cnt
     FROM analytics_events WHERE event_type IN ('login', 'subscription') AND created_at >= ?
     GROUP BY day ORDER BY day`,
    [since],
  );

  const subRows = await db.queryAll(
    `SELECT ${startedDay} AS day, COUNT(*) AS cnt
     FROM subscriptions WHERE started_at >= ?
     GROUP BY day ORDER BY day`,
    [since],
  );

  const userCountRow = await db.queryOne('SELECT COUNT(*) AS cnt FROM users');
  const activeUsersRow = await db.queryOne('SELECT COUNT(*) AS cnt FROM users WHERE last_login IS NOT NULL');
  const activeSubsRow = await db.queryOne("SELECT COUNT(*) AS cnt FROM subscriptions WHERE status = 'active'");
  const trialSubsRow = await db.queryOne(
    "SELECT COUNT(*) AS cnt FROM subscriptions WHERE status = 'active' AND plan_id = 'trial'",
  );

  const visitSeries = seriesFromCounts(visitRows, days, 'count');
  const userSeries = seriesFromCounts(userRows, days, 'count');
  const opSeries = seriesFromCounts(opRows, days, 'count');
  const subSeries = seriesFromCounts(subRows, days, 'count');

  const aiTotal = routerStats?.lifetime?.total?.totalTokens ?? 0;
  const aiCost = routerStats?.lifetime?.total?.totalCost ?? 0;
  const aiSeries = days.map((date) => ({
    date,
    tokens: Math.round(aiTotal / Math.max(days.length, 1)),
  }));

  return {
    visits: {
      total: visitRows.reduce((sum, row) => sum + Number(row.cnt), 0),
      series: visitSeries,
    },
    users: {
      total: userCountRow?.cnt ?? 0,
      active: activeUsersRow?.cnt ?? 0,
      series: userSeries,
    },
    ops: {
      total: opRows.reduce((sum, row) => sum + Number(row.cnt), 0),
      series: opSeries,
    },
    subscriptions: {
      active: activeSubsRow?.cnt ?? 0,
      trial: trialSubsRow?.cnt ?? 0,
      series: subSeries,
    },
    aiUsage: {
      totalTokens: aiTotal,
      totalCost: aiCost,
      series: aiSeries,
    },
  };
}

function normalizeWalletBalance(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function loadWalletBalanceMap(db, userIds) {
  const map = new Map();
  if (!userIds.length) return map;
  const placeholders = userIds.map(() => '?').join(',');
  const walletRows = await db.queryAll(
    `SELECT user_id, balance FROM credit_wallet WHERE user_id IN (${placeholders})`,
    userIds,
  );
  for (const row of walletRows) {
    map.set(Number(row.user_id), normalizeWalletBalance(row.balance));
  }
  return map;
}

export async function listAdminUsers(search = '') {
  const db = await getControlDriver();
  const like = `%${search.trim()}%`;
  const rows = search.trim()
    ? await db.queryAll(
        `SELECT u.id, u.username, u.role, u.group_id, u.created_at, u.last_login, u.is_active,
                COALESCE(w.balance, 0) AS balance
         FROM users u
         LEFT JOIN credit_wallet w ON w.user_id = u.id
         WHERE u.username LIKE ?
         ORDER BY u.id DESC LIMIT 200`,
        [like],
      )
    : await db.queryAll(
        `SELECT u.id, u.username, u.role, u.group_id, u.created_at, u.last_login, u.is_active,
                COALESCE(w.balance, 0) AS balance
         FROM users u
         LEFT JOIN credit_wallet w ON w.user_id = u.id
         ORDER BY u.id DESC LIMIT 200`,
      );

  const walletMap = await loadWalletBalanceMap(
    db,
    rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id)),
  );

  const enriched = [];
  for (const row of rows) {
    const userId = Number(row.id);
    const sub = await billingDb.getActiveSubscription(userId);
    const joinedBalance = normalizeWalletBalance(row.balance);
    const walletBalance = walletMap.get(userId);
    enriched.push({
      ...row,
      id: userId,
      balance: walletBalance != null ? walletBalance : joinedBalance,
      subscription: sub ? sub.plan_name : '—',
      status: sub?.plan_id === 'trial' ? 'trial' : row.is_active ? 'active' : 'suspended',
    });
  }
  return enriched;
}

const ANALYTICS_EVENT_LABELS = {
  register: '完成注册',
  login: '登录工作区',
  password_change: '修改密码',
  subscription: '订阅变更',
  visit: '访问工作台',
  marketing_contact_submit: '提交联系表单',
  marketing_page_view: '浏览营销页',
};

function ledgerReasonLabel(reason) {
  if (!reason) return '积分调整';
  if (reason.startsWith('subscribe:')) return `订阅充值 · ${reason.slice('subscribe:'.length)}`;
  if (reason === 'admin_credit') return '管理员调整积分';
  if (reason === 'chat_turn') return '对话消耗';
  return reason;
}

function parseEventPayload(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function summarizeAnalyticsEvent(row) {
  const label = ANALYTICS_EVENT_LABELS[row.event_type] ?? row.event_type;
  const payload = parseEventPayload(row.payload);
  if (row.event_type === 'subscription' && payload?.planId) {
    return `${label} · ${payload.planId}`;
  }
  if (row.event_type === 'login' && payload?.ip) {
    return `${label} · ${payload.ip}`;
  }
  return label;
}

/** PD-SAAS-FORK: 后台用户日志 — 聚合 analytics、credit_ledger、对话与用量摘要 */
export async function getAdminUserLogs(userId) {
  const db = await getControlDriver();
  const user = await db.queryOne(
    `SELECT id, tenant_id, username, role, created_at, last_login, is_active
     FROM users WHERE id = ?`,
    [userId],
  );
  if (!user) return null;

  let wallet = { balance: 0, updated_at: null };
  try {
    wallet = (await billingDb.ensureWallet(userId, 0)) ?? wallet;
  } catch (error) {
    console.warn('[saas] user logs wallet failed:', error instanceof Error ? error.message : error);
  }

  let sub = null;
  try {
    sub = await billingDb.getActiveSubscription(userId);
  } catch (error) {
    console.warn('[saas] user logs subscription failed:', error instanceof Error ? error.message : error);
  }

  let events = [];
  try {
    events = await db.queryAll(
      `SELECT id, event_type, payload, created_at
       FROM analytics_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 80`,
      [userId],
    );
  } catch (error) {
    console.warn('[saas] user logs events failed:', error instanceof Error ? error.message : error);
  }

  let ledger = [];
  try {
    ledger = await billingDb.listLedger(userId, 60);
  } catch (error) {
    console.warn('[saas] user logs ledger failed:', error instanceof Error ? error.message : error);
  }

  let convStats = { session_count: 0, last_activity_at: null };
  try {
    convStats =
      (await db.queryOne(
        `SELECT COUNT(*) AS session_count, MAX(last_activity_at) AS last_activity_at
         FROM conversation_catalog WHERE user_id = ? AND deleted_at IS NULL`,
        [userId],
      )) ?? convStats;
  } catch (error) {
    console.warn('[saas] user logs conversations failed:', error instanceof Error ? error.message : error);
  }

  let usageSummary = null;
  try {
    const { getRouterDashboardData } = await import('../../pilotdeck-bridge.js');
    const { aggregateRouterUsage } = await import('../usage/store.js');
    const dashboard = getRouterDashboardData();
    const agg = await aggregateRouterUsage(dashboard, { filterUserId: userId });
    usageSummary = agg.total;
  } catch {
    usageSummary = null;
  }

  const timeline = [];
  for (const row of events) {
    timeline.push({
      id: `event-${row.id}`,
      at: row.created_at,
      category: 'event',
      type: row.event_type,
      summary: summarizeAnalyticsEvent(row),
      detail: null,
    });
  }
  for (const row of ledger) {
    timeline.push({
      id: `ledger-${row.id}`,
      at: row.created_at,
      category: 'credit',
      type: row.delta >= 0 ? 'credit_in' : 'credit_out',
      summary: `${row.delta >= 0 ? '+' : ''}${row.delta} 积分 · ${ledgerReasonLabel(row.reason)}`,
      detail: row.reason,
    });
  }
  timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    user,
    wallet: {
      ...wallet,
      balance: normalizeWalletBalance(wallet.balance),
    },
    subscription: sub ?? null,
    stats: {
      sessionCount: Number(convStats?.session_count ?? 0),
      lastActivityAt: convStats?.last_activity_at ?? null,
      usage: usageSummary,
    },
    timeline: timeline.slice(0, 100),
  };
}
