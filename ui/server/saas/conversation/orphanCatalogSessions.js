/**
 * PD-SAAS-FORK: Ghost / orphan catalog rows — index without readable transcript.
 */
import { resolveSessionTranscriptAbsPath } from './resolveSessionTranscriptPath.js';
import { isSessionTombstoned } from './sessionTombstoneStore.js';

/** @readonly */
export const CONVERSATION_ORPHAN_ERROR = 'conversation_orphan';

/**
 * @param {string | null | undefined} status
 */
export function isActiveExecutionStatus(status) {
  return ['queued', 'running', 'paused'].includes(String(status ?? '').toLowerCase());
}

/**
 * Catalog row with no resolvable transcript and no in-flight execution.
 * @param {{ catalogRow?: object | null, transcriptAbsPath?: string | null }} input
 */
export function isOrphanCatalogSession(input) {
  if (input.transcriptAbsPath) return false;
  if (!input.catalogRow) return false;
  if (isActiveExecutionStatus(input.catalogRow.executionStatus)) return false;
  return true;
}

/**
 * @param {{
 *   sessionId: string;
 *   tenantPilotHome: string;
 *   catalogTranscriptRel?: string | null;
 *   catalogRow?: object | null;
 * }} input
 * @returns {Promise<boolean>}
 */
export async function isOrphanCatalogSessionForTenant(input) {
  if (!input.sessionId || !input.tenantPilotHome) return false;
  const transcriptAbsPath = await resolveSessionTranscriptAbsPath({
    sessionId: input.sessionId,
    tenantPilotHome: input.tenantPilotHome,
    catalogTranscriptRel: input.catalogTranscriptRel ?? input.catalogRow?.transcriptRelPath ?? null,
  });
  return isOrphanCatalogSession({
    catalogRow: input.catalogRow ?? { sessionId: input.sessionId },
    transcriptAbsPath,
  });
}

/**
 * @param {Array<object>} rows
 * @param {string | null | undefined} tenantPilotHome
 * @returns {Promise<object[]>}
 */
export async function filterOrphanCatalogRowsForSidebar(rows, tenantPilotHome) {
  if (!tenantPilotHome || !Array.isArray(rows) || rows.length === 0) return rows ?? [];
  const kept = [];
  for (const row of rows) {
    const orphan = await isOrphanCatalogSessionForTenant({
      sessionId: row.sessionId,
      tenantPilotHome,
      catalogTranscriptRel: row.transcriptRelPath,
      catalogRow: row,
    });
    if (!orphan) kept.push(row);
  }
  return kept;
}

/**
 * Remove catalog rows that were user-deleted (tombstone) or lost their transcript (orphan).
 * Keeps sidebar totals aligned with visible sessions after delete.
 * @param {{
 *   tenantId: string,
 *   userId: number,
 *   legacyProjectId: string,
 *   tenantPilotHome: string,
 * }} input
 * @returns {Promise<number>} rows hard-deleted from conversation_catalog
 */
export async function purgeStaleCatalogRowsForSidebarProject(input) {
  const { tenantId, userId, legacyProjectId, tenantPilotHome } = input;
  if (!tenantId || userId == null || !legacyProjectId || !tenantPilotHome) return 0;

  const { catalogStore } = await import('./CatalogStore.js');
  let purged = 0;
  let offset = 0;
  const limit = 100;

  while (true) {
    const batch = await catalogStore.listByProject({
      tenantId,
      userId,
      legacyProjectId,
      limit,
      offset,
      includeOlder: true,
    });
    if (!batch.length) break;

    for (const row of batch) {
      const tombstoned = await isSessionTombstoned({
        sessionId: row.sessionId,
        tenantId,
        userId,
      });
      const orphan = tombstoned || await isOrphanCatalogSessionForTenant({
        sessionId: row.sessionId,
        tenantPilotHome,
        catalogTranscriptRel: row.transcriptRelPath,
        catalogRow: row,
      });
      if (!orphan) continue;
      const deleted = await catalogStore.hardDelete({
        tenantId,
        userId,
        sessionId: row.sessionId,
      });
      if (deleted) purged += 1;
    }

    offset += batch.length;
    if (batch.length < limit) break;
  }

  return purged;
}
