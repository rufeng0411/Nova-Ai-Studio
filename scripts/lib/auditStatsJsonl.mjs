/**
 * PD-SAAS-FORK: Read router stats.jsonl and build dashboard-shaped payloads for usage audits.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function resolveStatsJsonlPath(env = process.env) {
  const pilotHome = env.PILOT_HOME || path.join(os.homedir(), '.pilotdeck');
  return path.join(pilotHome, 'router', 'stats.jsonl');
}

export function loadAllStatsRecords(statsPath) {
  if (!fs.existsSync(statsPath)) return [];
  const raw = fs.readFileSync(statsPath, 'utf8');
  const records = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      if (rec?.sessionId && rec?.startedAt) records.push(rec);
    } catch {
      // skip malformed
    }
  }
  return records;
}

function emptyBucket() {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0, requestCount: 0, estimatedCost: 0 };
}

function addRecordToBucket(bucket, rec) {
  const usage = rec.usage || {};
  const input = usage.inputTokens || 0;
  const output = usage.outputTokens || 0;
  bucket.inputTokens += input;
  bucket.outputTokens += output;
  bucket.totalTokens += usage.totalTokens ?? input + output;
  bucket.requestCount += 1;
  bucket.estimatedCost += rec.cost?.total || 0;
}

function sessionKey(rec) {
  return `${rec.projectPath || ''}\0${rec.sessionId}`;
}

/**
 * Build minimal dashboard { projects: [{ fullPath, sessions }] } from raw records.
 * @param {object[]} records
 * @param {{ perProjectLimit?: number }} [opts]
 */
export function buildDashboardFromRecords(records, { perProjectLimit = null } = {}) {
  const byProject = new Map();

  for (const rec of records) {
    if (rec.sessionId?.includes('::sub::')) continue;
    const projectPath = rec.projectPath || '(unknown)';
    if (!byProject.has(projectPath)) {
      byProject.set(projectPath, { fullPath: projectPath, sessionMap: new Map(), allRecords: [] });
    }
    const proj = byProject.get(projectPath);
    proj.allRecords.push(rec);
    let session = proj.sessionMap.get(rec.sessionId);
    if (!session) {
      session = {
        sessionId: rec.sessionId,
        routing: { total: emptyBucket(), byModel: {} },
      };
      proj.sessionMap.set(rec.sessionId, session);
    }
    addRecordToBucket(session.routing.total, rec);
    const model = `${rec.provider || 'unknown'}/${rec.model || 'unknown'}`;
    if (!session.routing.byModel[model]) session.routing.byModel[model] = emptyBucket();
    addRecordToBucket(session.routing.byModel[model], rec);
  }

  const projects = [];
  for (const proj of byProject.values()) {
    let recs = proj.allRecords;
    recs.sort((a, b) => (a.startedAt || '').localeCompare(b.startedAt || ''));
    if (perProjectLimit != null && perProjectLimit > 0) {
      recs = recs.slice(-perProjectLimit);
      const allowedSessions = new Set(recs.map((r) => r.sessionId));
      const sessions = [...proj.sessionMap.values()].filter((s) => allowedSessions.has(s.sessionId));
      projects.push({ fullPath: proj.fullPath, sessions });
    } else {
      projects.push({ fullPath: proj.fullPath, sessions: [...proj.sessionMap.values()] });
    }
  }

  return { projects, unmatchedSessions: [] };
}

export function altSessionIdVariant(sessionId) {
  if (typeof sessionId !== 'string') return null;
  if (sessionId.includes('web:s_')) return sessionId.replace('web:s_', 'web-s_');
  if (sessionId.includes('web-s_')) return sessionId.replace('web-s_', 'web:s_');
  return null;
}

export function classifyProjectPath(projectPath, tenantIdForProjectPath) {
  const p = String(projectPath || '');
  if (p.includes('.saas-dev-data') || p.includes(`${path.sep}tenants${path.sep}`)) {
    return 'saas-tenant';
  }
  if (p.includes('cloud-storage')) return 'cloud-storage';
  if (p.includes('.pilotdeck') || p.includes(path.join(os.homedir(), '.pilotdeck'))) return 'legacy-pilotdeck';
  const tenant = tenantIdForProjectPath?.(p);
  if (tenant) return `tenant:${tenant}`;
  return 'other';
}
