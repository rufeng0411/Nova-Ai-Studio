/**
 * PD-SAAS-FORK: Router (gateway) token-usage attribution & aggregation.
 *
 * The PilotDeck gateway records token usage in `~/.pilotdeck/router/stats.jsonl`,
 * keyed by `sessionId` + `projectPath` only — there is no tenant/user dimension.
 * To answer "how many router tokens did this user / this project consume" in
 * SaaS mode we persist a lightweight `sessionId -> user/tenant/project` mapping
 * at turn time (recordSessionOwner) and join it against the gateway stats when
 * aggregating (aggregateRouterUsage).
 *
 * Outside SaaS mode none of this runs; the single-user dashboard keeps reading
 * the raw gateway stats unchanged.
 */
import { getControlDriver } from '../db/control.js';
import { controlUserDb } from '../db/control.js';
import { usageSessionOwnerUpsertSql } from '../db/dialect.js';
// PD-SAAS-FORK: infer tenant for owner-less sessions (cron/always-on/background)
// from their project path so background work stops falling into the
// "unattributed" black hole; truly un-inferable rows become system/historical.
import { tenantIdForProjectPath } from '../tenant/scope.js';

/**
 * Upsert the owner mapping for a gateway session.
 * @param {{ sessionId: string, userId?: number|null, tenantId?: string|null, projectPath?: string|null }} input
 */
export async function recordSessionOwner({ sessionId, userId = null, tenantId = null, projectPath = null }) {
  if (!sessionId) return;
  try {
    const db = await getControlDriver();
    const sql = usageSessionOwnerUpsertSql(db.dialect);
    await db.execute(sql, [sessionId, userId, tenantId, projectPath]);
  } catch (error) {
    console.warn('[saas] recordSessionOwner failed:', error instanceof Error ? error.message : error);
  }
}

/** @returns {Promise<Map<string, { userId: number|null, tenantId: string|null, projectPath: string|null }>>} */
async function loadOwners() {
  const map = new Map();
  try {
    const db = await getControlDriver();
    const rows = await db.queryAll('SELECT session_id, user_id, tenant_id, project_path FROM usage_session_owner');
    for (const row of rows) {
      map.set(row.session_id, {
        userId: row.user_id ?? null,
        tenantId: row.tenant_id ?? null,
        projectPath: row.project_path ?? null,
      });
    }
  } catch (error) {
    console.warn('[saas] loadOwners failed:', error instanceof Error ? error.message : error);
  }
  return map;
}

// Mirrors the gateway router-stats bucket shape (see makeBucket in
// pilotdeck-bridge.js): inputTokens/outputTokens/totalTokens/requestCount/estimatedCost.
function emptyBucket() {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0, requestCount: 0, estimatedCost: 0 };
}

function normalizeBucket(b = {}) {
  const inputTokens = b.inputTokens || 0;
  const outputTokens = b.outputTokens || 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: b.totalTokens || inputTokens + outputTokens,
    requestCount: b.requestCount || 0,
    estimatedCost: b.estimatedCost || 0,
  };
}

function addInto(target, bucket) {
  target.inputTokens += bucket.inputTokens || 0;
  target.outputTokens += bucket.outputTokens || 0;
  target.totalTokens += bucket.totalTokens || 0;
  target.requestCount += bucket.requestCount || 0;
  target.estimatedCost += bucket.estimatedCost || 0;
}

function emptyDashboardBucket() {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 0,
    requestCount: 0,
    estimatedCost: 0,
    baselineCost: 0,
    savedCost: 0,
  };
}

function addDashboardBuckets(target, source) {
  if (!source) return;
  target.inputTokens += source.inputTokens || 0;
  target.outputTokens += source.outputTokens || 0;
  target.cacheReadTokens += source.cacheReadTokens || 0;
  target.totalTokens += source.totalTokens || 0;
  target.requestCount += source.requestCount || 0;
  target.estimatedCost += source.estimatedCost || 0;
  target.baselineCost += source.baselineCost || 0;
  target.savedCost += source.savedCost || 0;
}

function recomputeProjectAggregated(sessions) {
  const aggregated = {
    total: emptyDashboardBucket(),
    byTier: {},
    byRole: {},
    sessionCount: sessions.length,
    routedSessionCount: 0,
  };
  for (const session of sessions) {
    if (!session.routing) continue;
    aggregated.routedSessionCount += 1;
    addDashboardBuckets(aggregated.total, session.routing.total);
    for (const [tier, bucket] of Object.entries(session.routing.byTier || {})) {
      aggregated.byTier[tier] = aggregated.byTier[tier] || emptyDashboardBucket();
      addDashboardBuckets(aggregated.byTier[tier], bucket);
    }
    for (const [role, bucket] of Object.entries(session.routing.byRole || {})) {
      aggregated.byRole[role] = aggregated.byRole[role] || emptyDashboardBucket();
      addDashboardBuckets(aggregated.byRole[role], bucket);
    }
  }
  return aggregated;
}

function recomputeOverall(projects) {
  const overall = {
    total: emptyDashboardBucket(),
    byTier: {},
    byRole: {},
    projectCount: projects.length,
    sessionCount: 0,
  };
  for (const project of projects) {
    const agg = project.aggregated || recomputeProjectAggregated(project.sessions || []);
    overall.sessionCount += agg.sessionCount || 0;
    addDashboardBuckets(overall.total, agg.total);
    for (const [tier, bucket] of Object.entries(agg.byTier || {})) {
      overall.byTier[tier] = overall.byTier[tier] || emptyDashboardBucket();
      addDashboardBuckets(overall.byTier[tier], bucket);
    }
    for (const [role, bucket] of Object.entries(agg.byRole || {})) {
      overall.byRole[role] = overall.byRole[role] || emptyDashboardBucket();
      addDashboardBuckets(overall.byRole[role], bucket);
    }
  }
  return overall;
}

/**
 * Filter router dashboard payload to a single user's sessions (SaaS user view).
 * Preserves savings fields (baselineCost / savedCost) on buckets.
 *
 * @param {object} dashboardData
 * @param {number} filterUserId
 */
export async function filterRouterDashboardByUser(dashboardData, filterUserId) {
  const owners = await loadOwners();
  const userId = Number(filterUserId);
  const filteredProjects = [];

  for (const project of dashboardData?.projects || []) {
    const sessions = (project.sessions || []).filter((session) => {
      const owner = owners.get(session.sessionId);
      return (owner?.userId ?? null) === userId;
    });
    if (sessions.length === 0) continue;
    filteredProjects.push({
      ...project,
      sessions,
      aggregated: recomputeProjectAggregated(sessions),
    });
  }

  const unmatchedSessions = (dashboardData?.unmatchedSessions || []).filter((session) => {
    const owner = owners.get(session.sessionId);
    return (owner?.userId ?? null) === userId;
  });

  return {
    projects: filteredProjects,
    overall: recomputeOverall(filteredProjects),
    unmatchedSessions,
  };
}

/** Flatten a router-dashboard session into a total bucket + per-model map. */
function sessionBucket(session) {
  return {
    bucket: normalizeBucket(session.routing?.total),
    byModel: session.routing?.byModel || {},
  };
}

/**
 * Aggregate router token usage with tenant/user attribution.
 *
 * @param {object} dashboardData Result of getRouterDashboardData() from the bridge.
 * @param {{ filterUserId?: number|null }} [opts] When set, only that user's
 *        sessions are considered (used by the user-facing endpoint).
 * @returns {{
 *   total: object,
 *   byUser: Array<{ userId: number|null, username: string, ...bucket }>,
 *   byProject: Array<{ projectPath: string, ...bucket }>,
 *   byModel: Array<{ model: string, ...bucket }>,
 *   attributed: number, unattributed: number,
 * }}
 */
export async function aggregateRouterUsage(dashboardData, { filterUserId = null } = {}) {
  const owners = await loadOwners();
  const total = emptyBucket();
  const byUser = new Map();
  const byProject = new Map();
  const byModel = new Map();
  let attributedSessions = 0;
  let backgroundSessions = 0;
  let unattributedSessions = 0;

  const projects = Array.isArray(dashboardData?.projects) ? dashboardData.projects : [];
  for (const project of projects) {
    const sessions = Array.isArray(project.sessions) ? project.sessions : [];
    for (const session of sessions) {
      const owner = owners.get(session.sessionId) || null;
      const ownerUserId = owner?.userId ?? null;

      if (filterUserId != null) {
        if (ownerUserId !== Number(filterUserId)) continue;
      }

      const { bucket, byModel: sessionModels } = sessionBucket(session);
      if (bucket.totalTokens === 0 && bucket.requestCount === 0) continue;

      addInto(total, bucket);

      const projectPath = owner?.projectPath || project.fullPath || '(unknown)';
      if (!byProject.has(projectPath)) byProject.set(projectPath, emptyBucket());
      addInto(byProject.get(projectPath), bucket);

      // PD-SAAS-FORK: attribution buckets.
      //  - user:       has an explicit owning userId (live logged-in chat).
      //  - tenant:     owner-less, but projectPath lives under a tenant tree
      //                (cron/always-on/background work) → attribute to tenant.
      //  - system:     owner-less and not under any tenant tree (single-host
      //                history written before SaaS, or system tasks).
      let userKey;
      if (ownerUserId != null) {
        userKey = ownerUserId;
        attributedSessions += 1;
      } else {
        const inferredTenant = tenantIdForProjectPath(projectPath);
        if (inferredTenant) {
          userKey = `tenant:${inferredTenant}`;
          backgroundSessions += 1;
        } else {
          userKey = '__system__';
          unattributedSessions += 1;
        }
      }
      if (!byUser.has(userKey)) byUser.set(userKey, emptyBucket());
      addInto(byUser.get(userKey), bucket);

      for (const [model, mb] of Object.entries(sessionModels)) {
        if (!byModel.has(model)) byModel.set(model, emptyBucket());
        addInto(byModel.get(model), normalizeBucket(mb));
      }
    }
  }

  const byUserArr = [];
  for (const [key, bucket] of byUser.entries()) {
    if (key === '__system__') {
      byUserArr.push({ userId: null, username: '系统/历史', ...bucket });
    } else if (typeof key === 'string' && key.startsWith('tenant:')) {
      const tenantId = key.slice('tenant:'.length);
      byUserArr.push({ userId: null, tenantId, username: `${tenantId}（后台任务）`, ...bucket });
    } else {
      let username = `#${key}`;
      try {
        const u = await controlUserDb.getUserById(Number(key));
        if (u?.username) username = u.username;
      } catch { /* ignore */ }
      byUserArr.push({ userId: Number(key), username, ...bucket });
    }
  }
  byUserArr.sort((a, b) => b.totalTokens - a.totalTokens);

  const byProjectArr = [...byProject.entries()]
    .map(([projectPath, bucket]) => ({ projectPath, ...bucket }))
    .sort((a, b) => b.totalTokens - a.totalTokens);

  const byModelArr = [...byModel.entries()]
    .map(([model, bucket]) => ({ model, ...bucket }))
    .sort((a, b) => b.totalTokens - a.totalTokens);

  return {
    total,
    byUser: byUserArr,
    byProject: byProjectArr,
    byModel: byModelArr,
    attributed: attributedSessions,
    backgroundAttributed: backgroundSessions,
    unattributed: unattributedSessions,
  };
}
