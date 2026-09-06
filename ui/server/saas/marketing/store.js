// PD-SAAS-FORK: marketing contact / invite / page events store
import crypto from 'node:crypto';
import { getControlDriver } from '../db/control.js';
import { dateExpr } from '../db/dialect.js';
import {
  classifyBrowser,
  classifyChannel,
  classifyDevice,
  DEVICE_LABELS,
  normalizeReferrerHost,
  pctDelta,
  rankTop,
} from './analyticsHelpers.js';
import {
  getDefaultInviteCode,
  isDefaultInviteCode,
  normalizeInviteCode,
} from './validate.js';

export function hashMarketingIp(ip, env = process.env) {
  const salt = env.PILOTDECK_MARKETING_IP_SALT || 'nova-marketing-ip-salt';
  return crypto.createHash('sha256').update(`${salt}|${ip || 'unknown'}`).digest('hex').slice(0, 32);
}

export async function ensureMarketingTables() {
  const db = await getControlDriver();
  // schema.sql / PG migration already create tables; no-op probe
  await db.queryOne('SELECT 1 AS ok FROM marketing_contact_leads LIMIT 1').catch(() => null);
  await ensureDefaultInviteCode().catch(() => null);
}

export async function insertContactLead(row) {
  const db = await getControlDriver();
  const result = await db.execute(
    `INSERT INTO marketing_contact_leads
      (display_name, email, phone, company, message, status, ip_hash, user_agent)
     VALUES (?, ?, ?, ?, ?, 'new', ?, ?)`,
    [
      row.displayName,
      row.email,
      row.phone,
      row.company,
      row.message,
      row.ipHash || null,
      row.userAgent || null,
    ],
  );
  return { id: result.lastInsertId };
}

export async function listContactLeads({ status = '', limit = 100, offset = 0 } = {}) {
  const db = await getControlDriver();
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const off = Math.max(Number(offset) || 0, 0);
  if (status) {
    return db.queryAll(
      `SELECT * FROM marketing_contact_leads WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [status, lim, off],
    );
  }
  return db.queryAll(
    `SELECT * FROM marketing_contact_leads ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [lim, off],
  );
}

export async function updateContactLeadStatus(id, status) {
  const db = await getControlDriver();
  await db.execute(
    `UPDATE marketing_contact_leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, id],
  );
}

function randomInviteCode() {
  const banned = getDefaultInviteCode();
  for (let i = 0; i < 32; i += 1) {
    const code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    if (code !== banned) return code;
  }
  return '0420';
}

export async function ensureDefaultInviteCode() {
  const db = await getControlDriver();
  const code = getDefaultInviteCode();
  try {
    await db.execute(
      `INSERT INTO marketing_invite_codes (code, created_by, note) VALUES (?, NULL, ?)`,
      [code, '默认邀请码（可重复使用）'],
    );
  } catch {
    // already present
  }
  return code;
}

export async function createInviteCode({ createdBy = null, note = '' } = {}) {
  const db = await getControlDriver();
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = randomInviteCode();
    try {
      await db.execute(
        `INSERT INTO marketing_invite_codes (code, created_by, note) VALUES (?, ?, ?)`,
        [code, createdBy, note || null],
      );
      return { code };
    } catch {
      // collision — retry
    }
  }
  throw new Error('invite_code_generate_failed');
}

export async function listInviteCodes({ limit = 200 } = {}) {
  const db = await getControlDriver();
  const lim = Math.min(Math.max(Number(limit) || 200, 1), 500);
  return db.queryAll(
    `SELECT * FROM marketing_invite_codes ORDER BY created_at DESC LIMIT ?`,
    [lim],
  );
}

export async function revokeInviteCode(code) {
  const normalized = normalizeInviteCode(code);
  if (isDefaultInviteCode(normalized)) {
    throw new Error('default_invite_not_revocable');
  }
  const db = await getControlDriver();
  await db.execute(
    `UPDATE marketing_invite_codes SET revoked_at = CURRENT_TIMESTAMP
     WHERE code = ? AND revoked_at IS NULL AND used_by IS NULL`,
    [normalized],
  );
}

/**
 * Soft-check invite before creating a user (race still possible).
 * @returns {{ ok: true, code: string, reusable?: boolean } | { ok: false, error: string }}
 */
export async function assertInviteAvailable(code) {
  const db = await getControlDriver();
  const normalized = normalizeInviteCode(code);
  if (!/^\d{4}$/.test(normalized)) {
    return { ok: false, error: '请填写客服提供的四位数字邀请码' };
  }
  // Default code is always valid and reusable (shared onboarding code).
  if (isDefaultInviteCode(normalized)) {
    return { ok: true, code: normalized, reusable: true };
  }
  const row = await db.queryOne(
    `SELECT code, used_by, revoked_at FROM marketing_invite_codes WHERE code = ?`,
    [normalized],
  );
  if (!row) return { ok: false, error: '邀请码无效' };
  if (row.revoked_at) return { ok: false, error: '邀请码已作废' };
  if (row.used_by) return { ok: false, error: '邀请码已被使用' };
  return { ok: true, code: normalized };
}

/**
 * Atomically redeem invite code. Returns { ok, error? }
 */
export async function redeemInviteCode(code, userId) {
  const available = await assertInviteAvailable(code);
  if (!available.ok) return available;
  if (available.reusable || isDefaultInviteCode(available.code)) {
    return { ok: true, code: available.code };
  }
  const db = await getControlDriver();
  const result = await db.execute(
    `UPDATE marketing_invite_codes
     SET used_by = ?, used_at = CURRENT_TIMESTAMP
     WHERE code = ? AND used_by IS NULL AND revoked_at IS NULL`,
    [userId, available.code],
  );
  if (!result.changes) return { ok: false, error: '邀请码已被使用' };
  return { ok: true, code: available.code };
}

export async function insertPageEvent(row) {
  const db = await getControlDriver();
  await db.execute(
    `INSERT INTO marketing_page_events
      (path, referrer, utm_source, utm_medium, utm_campaign, ip_hash, user_agent, country_hint, session_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.path,
      row.referrer || null,
      row.utmSource || null,
      row.utmMedium || null,
      row.utmCampaign || null,
      row.ipHash || null,
      row.userAgent || null,
      row.countryHint || null,
      row.sessionKey || null,
    ],
  );
}

export async function aggregateMarketingAnalytics({ days = 14 } = {}) {
  const db = await getControlDriver();
  const n = Math.min(Math.max(Number(days) || 14, 1), 90);
  const dayList = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayList.push(d.toISOString().slice(0, 10));
  }
  const since = `${dayList[0]} 00:00:00`;
  const prevStartDate = new Date(`${dayList[0]}T00:00:00.000Z`);
  prevStartDate.setUTCDate(prevStartDate.getUTCDate() - n);
  const prevSince = `${prevStartDate.toISOString().slice(0, 10)} 00:00:00`;
  const prevUntil = since;
  const dayCol = dateExpr('created_at', db.dialect);

  const seriesRows = await db.queryAll(
    `SELECT ${dayCol} AS day,
            COUNT(*) AS pv,
            COUNT(DISTINCT CASE WHEN session_key IS NOT NULL AND session_key != '' THEN session_key END) AS uv
     FROM marketing_page_events WHERE created_at >= ?
     GROUP BY day ORDER BY day`,
    [since],
  );
  const seriesMap = new Map(
    seriesRows.map((r) => [
      String(r.day),
      { pv: Number(r.pv) || 0, uv: Number(r.uv) || 0 },
    ]),
  );
  const series = dayList.map((date) => {
    const row = seriesMap.get(date) || { pv: 0, uv: 0 };
    return { date, count: row.pv, pv: row.pv, uv: row.uv };
  });

  const totalRow = await db.queryOne(
    `SELECT COUNT(*) AS cnt FROM marketing_page_events WHERE created_at >= ?`,
    [since],
  );
  const uvRow = await db.queryOne(
    `SELECT COUNT(DISTINCT session_key) AS cnt FROM marketing_page_events
     WHERE created_at >= ? AND session_key IS NOT NULL AND session_key != ''`,
    [since],
  );
  const prevPvRow = await db.queryOne(
    `SELECT COUNT(*) AS cnt FROM marketing_page_events
     WHERE created_at >= ? AND created_at < ?`,
    [prevSince, prevUntil],
  );
  const prevUvRow = await db.queryOne(
    `SELECT COUNT(DISTINCT session_key) AS cnt FROM marketing_page_events
     WHERE created_at >= ? AND created_at < ?
       AND session_key IS NOT NULL AND session_key != ''`,
    [prevSince, prevUntil],
  );
  const leadsRow = await db.queryOne(
    `SELECT COUNT(*) AS cnt FROM marketing_contact_leads WHERE created_at >= ?`,
    [since],
  );
  const prevLeadsRow = await db.queryOne(
    `SELECT COUNT(*) AS cnt FROM marketing_contact_leads
     WHERE created_at >= ? AND created_at < ?`,
    [prevSince, prevUntil],
  );

  const pv = Number(totalRow?.cnt ?? 0);
  const uvApprox = Number(uvRow?.cnt ?? 0);
  const leads = Number(leadsRow?.cnt ?? 0);
  const prevPv = Number(prevPvRow?.cnt ?? 0);
  const prevUv = Number(prevUvRow?.cnt ?? 0);
  const prevLeads = Number(prevLeadsRow?.cnt ?? 0);

  const topPaths = await db.queryAll(
    `SELECT path, COUNT(*) AS cnt FROM marketing_page_events
     WHERE created_at >= ? GROUP BY path ORDER BY cnt DESC LIMIT 15`,
    [since],
  );

  const contactPathRow = await db.queryOne(
    `SELECT COUNT(*) AS cnt FROM marketing_page_events
     WHERE created_at >= ? AND (path = '/contact/' OR path = '/contact' OR path LIKE '/contact/%')`,
    [since],
  );
  const contactPv = Number(contactPathRow?.cnt ?? 0);

  const sessionRows = await db.queryAll(
    `SELECT session_key AS sk, COUNT(*) AS pages
     FROM marketing_page_events
     WHERE created_at >= ? AND session_key IS NOT NULL AND session_key != ''
     GROUP BY session_key`,
    [since],
  );
  const sessionCount = sessionRows.length;
  let bounceSessions = 0;
  let pageSum = 0;
  for (const row of sessionRows) {
    const pages = Number(row.pages) || 0;
    pageSum += pages;
    if (pages <= 1) bounceSessions += 1;
  }
  const bounceRate = sessionCount > 0 ? Math.round((bounceSessions / sessionCount) * 1000) / 10 : 0;
  const pagesPerSession =
    sessionCount > 0 ? Math.round((pageSum / sessionCount) * 10) / 10 : 0;

  let topLandings = [];
  try {
    const landingRows = await db.queryAll(
      `SELECT path, COUNT(*) AS cnt FROM (
         SELECT path,
                ROW_NUMBER() OVER (PARTITION BY session_key ORDER BY created_at ASC) AS rn
         FROM marketing_page_events
         WHERE created_at >= ?
           AND session_key IS NOT NULL AND session_key != ''
       ) t
       WHERE rn = 1
       GROUP BY path
       ORDER BY cnt DESC
       LIMIT 10`,
      [since],
    );
    topLandings = landingRows.map((r) => ({ path: r.path, count: Number(r.cnt) }));
  } catch {
    topLandings = topPaths.slice(0, 10).map((r) => ({ path: r.path, count: Number(r.cnt) }));
  }

  const attrRows = await db.queryAll(
    `SELECT utm_source, utm_medium, utm_campaign, referrer, COUNT(*) AS cnt
     FROM marketing_page_events WHERE created_at >= ?
     GROUP BY utm_source, utm_medium, utm_campaign, referrer`,
    [since],
  );

  const channelItems = [];
  const referrerItems = [];
  const utmSourceItems = [];
  const utmMediumItems = [];
  const utmCampaignItems = [];
  for (const row of attrRows) {
    const cnt = Number(row.cnt) || 0;
    channelItems.push({
      label: classifyChannel({
        utmSource: row.utm_source,
        utmMedium: row.utm_medium,
        referrer: row.referrer,
      }),
      count: cnt,
    });
    referrerItems.push({ label: normalizeReferrerHost(row.referrer), count: cnt });
    utmSourceItems.push({
      label: String(row.utm_source || '').trim() || '(无 UTM)',
      count: cnt,
    });
    utmMediumItems.push({
      label: String(row.utm_medium || '').trim() || '(无 medium)',
      count: cnt,
    });
    utmCampaignItems.push({
      label: String(row.utm_campaign || '').trim() || '(无 campaign)',
      count: cnt,
    });
  }

  const topChannels = rankTop(channelItems, 12);
  const topReferrerHosts = rankTop(referrerItems, 12);
  const topUtmSources = rankTop(utmSourceItems, 12);
  const topUtmMediums = rankTop(utmMediumItems, 10);
  const topUtmCampaigns = rankTop(utmCampaignItems, 10);

  const countryRows = await db.queryAll(
    `SELECT COALESCE(NULLIF(country_hint, ''), '(未知)') AS country, COUNT(*) AS cnt
     FROM marketing_page_events WHERE created_at >= ?
     GROUP BY COALESCE(NULLIF(country_hint, ''), '(未知)')
     ORDER BY cnt DESC LIMIT 12`,
    [since],
  );

  const uaRows = await db.queryAll(
    `SELECT COALESCE(user_agent, '') AS ua, COUNT(*) AS cnt
     FROM marketing_page_events WHERE created_at >= ?
     GROUP BY ua ORDER BY cnt DESC LIMIT 400`,
    [since],
  );
  const deviceItems = [];
  const browserItems = [];
  for (const row of uaRows) {
    const cnt = Number(row.cnt) || 0;
    const device = classifyDevice(row.ua);
    deviceItems.push({ label: DEVICE_LABELS[device] || device, count: cnt });
    browserItems.push({ label: classifyBrowser(row.ua), count: cnt });
  }
  const topDevices = rankTop(deviceItems, 8);
  const topBrowsers = rankTop(browserItems, 8);

  const conversionRate =
    uvApprox > 0 ? Math.round((leads / uvApprox) * 1000) / 10 : 0;

  return {
    days: n,
    range: { since: dayList[0], until: dayList[dayList.length - 1] },
    pv,
    uvApprox,
    leads,
    contactPv,
    conversionRate,
    bounceRate,
    pagesPerSession,
    deltas: {
      pv: pctDelta(pv, prevPv),
      uv: pctDelta(uvApprox, prevUv),
      leads: pctDelta(leads, prevLeads),
    },
    previous: { pv: prevPv, uvApprox: prevUv, leads: prevLeads },
    series,
    funnel: [
      { key: 'pv', label: '页面浏览', count: pv },
      { key: 'uv', label: '访客(会话)', count: uvApprox },
      { key: 'contact', label: '联系页浏览', count: contactPv },
      { key: 'leads', label: '线索提交', count: leads },
    ],
    topPaths: topPaths.map((r) => ({ path: r.path, count: Number(r.cnt) })),
    topLandings,
    topChannels,
    topReferrerHosts,
    topUtmSources,
    topUtmMediums,
    topUtmCampaigns,
    topCountries: countryRows.map((r) => ({
      label: String(r.country),
      count: Number(r.cnt),
    })),
    topDevices,
    topBrowsers,
    // backward-compatible aliases
    topReferrers: topReferrerHosts.map((r) => ({ referrer: r.label, count: r.count })),
    topUtm: topUtmSources.map((r) => ({ utmSource: r.label, count: r.count })),
  };
}
