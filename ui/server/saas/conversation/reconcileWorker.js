/**
 * PD-SAAS-FORK: Throttled reconcile — orphan jsonl → catalog rows + workspace registration.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getSaasRequestContext } from '../context.js';
import { getTenantPilotHome } from '../tenant/paths.js';
import { readSessionLite, parseSessionInfoFromLite } from '../../../../src/session/index.js';
import { catalogStore } from './CatalogStore.js';
import { isCatalogShadowWriteEnabled } from './featureFlags.js';
import { recordCatalogTelemetry } from './catalogTelemetry.js';
import { openControlDatabase } from '../db/control.js';
import { performCatalogShadowUpsert } from './catalogBridgeHooks.js';

const lastRunByUser = new Map();
const RECONCILE_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * @param {{ tenantId: string, userId: number, tenantPilotHome: string }} ctx
 */
async function countJsonlInDir(chatsDir) {
  try {
    const names = await fs.readdir(chatsDir);
    return names.filter((name) => name.endsWith('.jsonl')).length;
  } catch {
    return 0;
  }
}

/**
 * @param {{ tenantId: string, userId: number, tenantPilotHome: string }} ctx
 */
export async function reconcileConversationCatalog(ctx) {
  if (!isCatalogShadowWriteEnabled()) return { reconciled: 0, orphans: 0 };
  const key = `${ctx.tenantId}:${ctx.userId}`;
  const now = Date.now();
  const last = lastRunByUser.get(key) ?? 0;
  if (now - last < RECONCILE_COOLDOWN_MS) {
    return { reconciled: 0, orphans: 0, skipped: true };
  }
  lastRunByUser.set(key, now);

  const projectsRoot = path.join(ctx.tenantPilotHome, 'projects');
  let entries;
  try {
    entries = await fs.readdir(projectsRoot, { withFileTypes: true });
  } catch {
    return { reconciled: 0, orphans: 0 };
  }

  let reconciled = 0;
  let orphans = 0;
  const db = await openControlDatabase();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const chatsDir = path.join(projectsRoot, entry.name, 'chats');
    const count = await countJsonlInDir(chatsDir);
    if (count === 0) continue;

    const workspaceRow = await db.queryOne(
      `SELECT * FROM user_workspaces
       WHERE tenant_id = ? AND user_id = ? AND legacy_project_id = ?
       LIMIT 1`,
      [ctx.tenantId, ctx.userId, entry.name],
    );

    let legacyProjectId = entry.name;
    if (!workspaceRow) {
      orphans += 1;
      const cwdPath = path.join(projectsRoot, entry.name, '.cwd');
      let canonical = '';
      try {
        canonical = (await fs.readFile(cwdPath, 'utf8')).trim();
      } catch {
        canonical = path.join(ctx.tenantPilotHome, 'cloud-storage', 'orphan', entry.name);
      }
      const uuidMatch = canonical.match(/workspaces\/([0-9a-f-]{36})/i);
      if (uuidMatch) {
        legacyProjectId = `workspaces-${uuidMatch[1].slice(0, 8)}`;
      }
    }

    let names;
    try {
      names = await fs.readdir(chatsDir);
    } catch {
      continue;
    }

    for (const name of names) {
      if (!name.endsWith('.jsonl')) continue;
      const sessionId = name.slice(0, -'.jsonl'.length);
      const absPath = path.join(chatsDir, name);
      const lite = await readSessionLite(absPath);
      if (!lite) continue;
      const info = parseSessionInfoFromLite(sessionId, lite);
      const relPath = path.relative(ctx.tenantPilotHome, absPath).split(path.sep).join('/');
      const existing = await catalogStore.getBySessionId({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        sessionId,
        includeDeleted: true,
      });
      if (existing?.deletedAt) {
        continue;
      }
      try {
        await catalogStore.upsert({
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          sessionId,
          legacyProjectId,
          transcriptRelPath: relPath,
          summary: info?.summary ?? null,
          aiTitle: info?.aiTitle ?? null,
          customTitle: info?.customTitle ?? null,
          firstPrompt: info?.firstPrompt ?? null,
          tag: info?.tag ?? null,
          title: info?.summary ?? null,
          lastActivityAt: info ? new Date(info.lastModified).toISOString() : new Date().toISOString(),
          source: 'reconcile',
        });
        reconciled += 1;
      } catch (error) {
        console.warn('[conversation-catalog] reconcile upsert failed:', error instanceof Error ? error.message : error);
      }
    }
  }

  recordCatalogTelemetry({
    event: 'reconcile_complete',
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    reconciled,
    orphans,
  });

  return { reconciled, orphans };
}

const PENDING_ORPHAN_MINUTES = 30;

/**
 * PD-SAAS-FORK: Promote pending catalog rows when jsonl appears; orphan stale pending.
 * @param {{ tenantId: string, userId: number, tenantPilotHome: string }} ctx
 */
export async function reconcilePendingCatalogSessions(ctx) {
  if (!isCatalogShadowWriteEnabled()) return { promoted: 0, orphaned: 0 };
  const pendingRows = await catalogStore.listByStatus({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    status: 'pending',
    maxAgeHours: 24,
  });
  let promoted = 0;
  let orphaned = 0;
  const now = Date.now();

  for (const row of pendingRows) {
    const found = await findTranscriptPathForReconcile({
      pilotHome: ctx.tenantPilotHome,
      sessionId: row.sessionId,
      projectKey: row.legacyProjectId,
      legacyProjectId: row.legacyProjectId,
    });
    if (found?.lite) {
      await performCatalogShadowUpsert({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        sessionId: row.sessionId,
        projectKey: row.legacyProjectId,
        projectName: row.legacyProjectId,
        forcePending: false,
      }).catch(() => undefined);
      promoted += 1;
      continue;
    }
    const createdMs = row.createdAt ? Date.parse(String(row.createdAt)) : now;
    if (Number.isFinite(createdMs) && now - createdMs > PENDING_ORPHAN_MINUTES * 60 * 1000) {
      await catalogStore.upsert({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        sessionId: row.sessionId,
        legacyProjectId: row.legacyProjectId,
        transcriptRelPath: row.transcriptRelPath,
        status: 'orphaned',
        lastActivityAt: new Date().toISOString(),
        source: 'reconcile-pending',
      }).catch(() => undefined);
      orphaned += 1;
    }
  }
  return { promoted, orphaned };
}

async function findTranscriptPathForReconcile(opts) {
  const { readSessionLite, parseSessionInfoFromLite: _p } = await import('../../../../src/session/index.js');
  const { getPilotProjectChatDir } = await import('../../../../src/pilot/paths.ts');
  const sessionId = opts.sessionId;
  const basenameCandidates = [sessionId];
  if (sessionId.includes('web-s_')) {
    basenameCandidates.push(sessionId.replace(/web-s_/g, 'web:s_'));
  }
  const chatDirs = [
    getPilotProjectChatDir(opts.projectKey, opts.pilotHome),
    path.join(opts.pilotHome, 'projects', opts.legacyProjectId, 'chats'),
  ];
  for (const chatsDir of chatDirs) {
    for (const base of basenameCandidates) {
      const candidate = path.join(chatsDir, `${base}.jsonl`);
      const lite = await readSessionLite(candidate);
      if (lite) return { lite };
    }
  }
  return null;
}

/**
 * Schedule reconcile for current SaaS request (non-blocking).
 */
export function scheduleCatalogReconcile() {
  const ctx = getSaasRequestContext();
  if (!ctx?.tenantId || !ctx.userId || !ctx.tenantPilotHome) return;
  void reconcileConversationCatalog({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    tenantPilotHome: ctx.tenantPilotHome,
  }).catch((error) => {
    console.warn('[conversation-catalog] reconcile failed:', error instanceof Error ? error.message : error);
  });
  void reconcilePendingCatalogSessions({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    tenantPilotHome: ctx.tenantPilotHome,
  }).catch((error) => {
    console.warn('[conversation-catalog] pending reconcile failed:', error instanceof Error ? error.message : error);
  });
}

/**
 * Nightly / admin entry.
 * @param {{ tenantId: string, userId: number }} scope
 */
export async function reconcileConversationCatalogForUser(scope) {
  const tenantPilotHome = getTenantPilotHome(scope.tenantId);
  return reconcileConversationCatalog({
    tenantId: scope.tenantId,
    userId: scope.userId,
    tenantPilotHome,
  });
}
