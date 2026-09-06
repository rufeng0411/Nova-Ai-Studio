// PD-SAAS-FORK: SEC-12 session read access (unknown → 404, soft-deleted → 403)

import { resolvePilotHome } from '../../utils/pilotPaths.js';
import { getSaasRequestContext } from '../context.js';
import { isSaasMode } from '../mode.js';
import { getSessionCatalogAccessRow } from './catalogReadPath.js';
import { resolveSessionTranscriptAbsPath } from './resolveSessionTranscriptPath.js';
import { isSessionTombstoned } from './sessionTombstoneStore.js';
import {
  CONVERSATION_ORPHAN_ERROR,
  isOrphanCatalogSession,
} from './orphanCatalogSessions.js';

/**
 * Pure decision helper for unit tests.
 * @param {{ deleted?: boolean, tombstoned?: boolean, catalogRow?: object|null, transcriptAbsPath?: string|null }} input
 */
export function evaluateSessionReadAccessDecision(input) {
  if (input.deleted || input.tombstoned) {
    return {
      allowed: false,
      status: 403,
      error: 'Conversation has been deleted.',
    };
  }
  if (isOrphanCatalogSession({
    catalogRow: input.catalogRow,
    transcriptAbsPath: input.transcriptAbsPath,
  })) {
    return {
      allowed: false,
      status: 410,
      error: CONVERSATION_ORPHAN_ERROR,
    };
  }
  if (!input.catalogRow && !input.transcriptAbsPath) {
    return {
      allowed: false,
      status: 404,
      error: 'Conversation not found.',
    };
  }
  return { allowed: true };
}

/** @param {string} sessionId */
export async function resolveSaasSessionReadAccess(sessionId) {
  if (!isSaasMode()) {
    return { allowed: true };
  }
  const saasCtx = getSaasRequestContext();
  const catalogRow = await getSessionCatalogAccessRow(sessionId);
  const deleted = Boolean(catalogRow?.deletedAt);
  const tombstoned = saasCtx?.tenantId && saasCtx?.userId
    ? await isSessionTombstoned({
        sessionId,
        tenantId: saasCtx.tenantId,
        userId: saasCtx.userId,
      })
    : false;
  const tenantPilotHome = saasCtx?.tenantPilotHome;
  const pilotHome = tenantPilotHome ?? resolvePilotHome(process.env);
  const catalogTranscriptRel = catalogRow?.transcriptRelPath ?? null;
  const transcriptAbsPath = pilotHome
    ? await resolveSessionTranscriptAbsPath({
        sessionId,
        tenantPilotHome: pilotHome,
        catalogTranscriptRel,
      })
    : null;

  const decision = evaluateSessionReadAccessDecision({
    deleted,
    tombstoned,
    catalogRow,
    transcriptAbsPath,
  });
  if (!decision.allowed) {
    return decision;
  }
  return {
    allowed: true,
    catalogRow,
    catalogTranscriptRel,
    transcriptAbsPath,
    pilotHome,
    tenantPilotHome,
  };
}
