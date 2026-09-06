/**
 * PD-SAAS-FORK: Read conversation catalog for sidebar / messages (Phase 2+).
 */
import { isSyntheticSessionTitlePrompt } from '../../../../src/agent/errors/userFacingErrors.ts';
import { catalogStore } from './CatalogStore.js';
import { shouldReadConversationCatalog, isCatalogShadowWriteEnabled } from './featureFlags.js';
import { getSaasRequestContext } from '../context.js';
import { resolveCatalogLegacyProjectId } from './catalogLegacyProjectId.js';
import { resolveSidebarDefaultSinceMs } from './sidebarDefaultWindow.js';
import { filterOrphanCatalogRowsForSidebar, purgeStaleCatalogRowsForSidebarProject } from './orphanCatalogSessions.js';
import { autoPauseStaleCatalogRows } from '../concurrency/staleSessionAutoPause.js';
import { pumpUserQueue, reconcileUnpumpableQueuedCatalogRows } from '../concurrency/turnQueuePump.js';
import { isTurnQueueEnabled } from '../concurrency/turnQueueConfig.js';
import { parseQueueItemsFromCatalogRow } from '../concurrency/turnQueueManager.js';

/**
 * @param {import('./CatalogStore.js').CatalogUpsertInput & { deletedAt?: string | null }} row
 */
function resolveCatalogDisplaySummary(row) {
  const candidates = [
    row.customTitle,
    row.summary,
    row.aiTitle,
    row.firstPrompt,
    row.title,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() && !isSyntheticSessionTitlePrompt(candidate)) {
      return candidate.trim();
    }
  }
  return '对话';
}

export function catalogRowToSessionInfo(row) {
  const lastModified = row.lastActivityAt
    ? Date.parse(String(row.lastActivityAt))
    : Date.now();
  const createdAt = row.createdAt ? Date.parse(String(row.createdAt)) : undefined;
  const executionStatus = normalizeCatalogExecutionStatusForSidebar(row);
  return {
    sessionId: row.sessionId,
    summary: resolveCatalogDisplaySummary(row),
    lastModified: Number.isFinite(lastModified) ? lastModified : Date.now(),
    customTitle: row.customTitle ?? undefined,
    aiTitle: row.aiTitle ?? undefined,
    firstPrompt: row.firstPrompt ?? undefined,
    tag: row.tag ?? undefined,
    createdAt: Number.isFinite(createdAt) ? createdAt : undefined,
    transcriptRelPath: row.transcriptRelPath,
    pausedReason: row.pausedReason ?? undefined,
    executionStatus,
    queuePosition: executionStatus === 'queued' ? (row.queuePosition ?? null) : null,
    sessionKind: row.kind === 'n2_bot' ? 'n2_bot' : undefined,
  };
}

/** PD-SAAS-FORK: N2 Bot steward stays out of sidebar / search lists. */
function hideN2BotCatalogRows(rows) {
  return rows.filter((row) => row.kind !== 'n2_bot');
}

/** Ghost catalog rows: queued with empty/unpumpable payload → idle for sidebar. */
function normalizeCatalogExecutionStatusForSidebar(row) {
  const status = row.executionStatus ?? 'idle';
  if (status !== 'queued') return status;
  const items = parseQueueItemsFromCatalogRow(row);
  if (items.length === 0) return 'idle';
  const queuePosition = row.queuePosition;
  if (typeof queuePosition === 'number' && Number.isFinite(queuePosition) && queuePosition > 0) {
    return 'queued';
  }
  return 'queued';
}

/**
 * @param {{ legacyProjectId: string, limit?: number, offset?: number, includeOlder?: boolean }} query
 * @param {{ requireReadFlag?: boolean }} [options]
 */
async function queryCatalogSessionsForProject(query, options = {}) {
  const requireReadFlag = options.requireReadFlag !== false;
  const ctx = getSaasRequestContext();
  if (!ctx?.tenantId || !ctx.userId) return null;
  if (requireReadFlag && !shouldReadConversationCatalog(ctx)) return null;
  if (!requireReadFlag && !shouldReadConversationCatalog(ctx) && !isCatalogShadowWriteEnabled()) {
    return null;
  }

  try {
    const legacyProjectId = resolveCatalogLegacyProjectId(query.legacyProjectId);
    if (isTurnQueueEnabled()) {
      await reconcileUnpumpableQueuedCatalogRows({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        role: ctx.role ?? null,
      }).catch((error) => {
        console.warn(
          '[conversation-catalog] ghost queue reconcile failed:',
          error instanceof Error ? error.message : error,
        );
      });
    }
    const sinceMs = resolveSidebarDefaultSinceMs(Boolean(query.includeOlder));
    const countAllPromise = query.includeOlder
      ? Promise.resolve(null)
      : catalogStore.countByProject({
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          legacyProjectId,
          includeOlder: true,
        });
    const [sessions, sessionCount, sessionCountAll] = await Promise.all([
      catalogStore.listByProject({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        legacyProjectId,
        limit: query.limit,
        offset: query.offset,
        sinceMs,
        includeOlder: query.includeOlder,
      }),
      catalogStore.countByProject({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        legacyProjectId,
        sinceMs,
        includeOlder: query.includeOlder,
      }),
      countAllPromise,
    ]);
    const tenantPilotHome = ctx.tenantPilotHome ?? null;
    let visibleRows = hideN2BotCatalogRows(
      await filterOrphanCatalogRowsForSidebar(sessions, tenantPilotHome),
    );
    let effectiveSessionCount = sessionCount;
    let effectiveSessionCountAll = sessionCountAll ?? sessionCount;

    if (
      (query.offset ?? 0) === 0
      && tenantPilotHome
      && effectiveSessionCount > visibleRows.length
    ) {
      const purged = await purgeStaleCatalogRowsForSidebarProject({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        legacyProjectId,
        tenantPilotHome,
      }).catch((error) => {
        console.warn(
          '[conversation-catalog] stale catalog purge failed:',
          error instanceof Error ? error.message : error,
        );
        return 0;
      });
      if (purged > 0) {
        effectiveSessionCount = await catalogStore.countByProject({
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          legacyProjectId,
          sinceMs,
          includeOlder: query.includeOlder,
        });
        if (!query.includeOlder) {
          effectiveSessionCountAll = await catalogStore.countByProject({
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            legacyProjectId,
            includeOlder: true,
          });
        } else {
          effectiveSessionCountAll = effectiveSessionCount;
        }
        const refreshed = await catalogStore.listByProject({
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          legacyProjectId,
          limit: query.limit,
          offset: query.offset,
          sinceMs,
          includeOlder: query.includeOlder,
        });
        visibleRows = hideN2BotCatalogRows(
          await filterOrphanCatalogRowsForSidebar(refreshed, tenantPilotHome),
        );
      }
    }

    const offset = query.offset ?? 0;
    const limit = query.limit ?? 5;
    // First page not full → no hidden pages; align total with visible (post-purge safety net).
    if (
      offset === 0
      && visibleRows.length < limit
      && effectiveSessionCount > visibleRows.length
    ) {
      effectiveSessionCount = visibleRows.length;
      if (effectiveSessionCountAll > visibleRows.length) {
        effectiveSessionCountAll = visibleRows.length;
      }
    }

    if (visibleRows.length > 0 && isCatalogShadowWriteEnabled()) {
      await autoPauseStaleCatalogRows({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        role: ctx.role ?? null,
        rows: visibleRows,
      }).catch((error) => {
        console.warn('[conversation-catalog] stale auto-pause sweep failed:', error instanceof Error ? error.message : error);
      });
      for (const row of visibleRows) {
        if (row.executionStatus === 'queued' || row.executionStatus === 'running') {
          const refreshed = await catalogStore.getBySessionId({
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            sessionId: row.sessionId,
          }).catch(() => null);
          if (refreshed) {
            row.executionStatus = refreshed.executionStatus;
            row.pausedReason = refreshed.pausedReason;
            row.pausedAt = refreshed.pausedAt;
          }
        }
      }
      if (
        isTurnQueueEnabled()
        && visibleRows.some((row) => row.executionStatus === 'queued')
      ) {
        void pumpUserQueue({
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          role: ctx.role ?? null,
        }).catch((error) => {
          console.warn('[conversation-catalog] queued pump sweep failed:', error instanceof Error ? error.message : error);
        });
      }
    }
    const nextOffset = offset + visibleRows.length;
    const totalAll = effectiveSessionCountAll;
    return {
      sessions: visibleRows.map(catalogRowToSessionInfo),
      sessionCount: effectiveSessionCount,
      sessionCountAll: totalAll,
      hasOlderSessions: !query.includeOlder && totalAll > effectiveSessionCount && totalAll > 0,
      nextCursor: nextOffset < effectiveSessionCount ? String(nextOffset) : undefined,
      source: 'catalog',
    };
  } catch (error) {
    console.warn('[conversation-catalog] read failed, falling back to disk:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * @param {{ legacyProjectId: string, limit?: number, offset?: number, includeOlder?: boolean }} query
 */
export async function listCatalogSessionsForProject(query) {
  return queryCatalogSessionsForProject(query, { requireReadFlag: true });
}

/**
 * Sidebar 7-day window: use catalog when table is populated (shadow-write OK).
 * @param {{ legacyProjectId: string, limit?: number, offset?: number, includeOlder?: boolean }} query
 */
export async function listCatalogSessionsForSidebar(query) {
  return queryCatalogSessionsForProject(query, { requireReadFlag: false });
}

/**
 * @param {string} sessionId
 * @returns {Promise<import('./CatalogStore.js').CatalogRow | null>}
 */
export async function getSessionCatalogAccessRow(sessionId) {
  const ctx = getSaasRequestContext();
  if (!ctx?.tenantId || !ctx.userId) return null;
  try {
    return await catalogStore.getBySessionId({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      sessionId,
      includeDeleted: true,
    });
  } catch {
    return null;
  }
}

/**
 * @param {string} sessionId
 */
export async function getCatalogEntryForSession(sessionId) {
  const row = await getSessionCatalogAccessRow(sessionId);
  if (!row || row.deletedAt) return null;
  return row;
}

/**
 * @param {string} sessionId
 */
export async function isSessionSoftDeleted(sessionId) {
  const row = await getSessionCatalogAccessRow(sessionId);
  return Boolean(row?.deletedAt);
}
