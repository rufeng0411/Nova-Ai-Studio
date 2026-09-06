/**
 * PD-SAAS-FORK: Bridge hooks — shadow UPSERT conversation_catalog from disk lite-read.
 */
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readSessionLite, parseSessionInfoFromLite } from '../../../../src/session/index.js';
import { getPilotProjectChatDir } from '../../../../src/pilot/paths.ts';
import { getSaasRequestContext } from '../context.js';
import { isCatalogShadowWriteEnabled } from './featureFlags.js';
import { catalogStore } from './CatalogStore.js';
import { debounceCatalogWrite, flushDebouncedCatalogWrites } from './catalogDebounce.js';
import { normalizeSessionId } from './normalizeSessionId.js';
import { sessionTranscriptBasenames } from './resolveSessionTranscriptPath.js';
import { resolveCatalogLegacyProjectId } from './catalogLegacyProjectId.js';
import { resolveWorkspaceForProjectName } from '../storage/fileStorageService.js';
import { cacheDelByPattern } from '../cache/redisClient.js';
import { sessionMessagesTailKeyPrefix } from '../cache/cacheKeys.js';

/**
 * @param {string} projectKey
 * @param {string} [projectName]
 */
async function resolveLegacyProjectId(projectKey, projectName) {
  const name = (projectName && projectName.trim()) || path.basename(projectKey || '') || 'general';
  return resolveCatalogLegacyProjectId(name);
}

/**
 * Find transcript file for session under pilot home.
 * @param {{ pilotHome: string, sessionId: string, projectKey: string, legacyProjectId: string }} opts
 */
async function findTranscriptPath(opts) {
  const sessionId = normalizeSessionId(opts.sessionId);
  const basenameCandidates = sessionTranscriptBasenames(sessionId);
  const chatDirs = new Set();
  chatDirs.add(getPilotProjectChatDir(opts.projectKey, opts.pilotHome));
  chatDirs.add(path.join(opts.pilotHome, 'projects', opts.legacyProjectId, 'chats'));

  for (const chatsDir of chatDirs) {
    for (const base of basenameCandidates) {
      const candidate = path.join(chatsDir, `${base}.jsonl`);
      const lite = await readSessionLite(candidate);
      if (lite) {
        const rel = path.relative(opts.pilotHome, candidate).split(path.sep).join('/');
        return { absPath: candidate, relPath: rel, lite };
      }
    }
  }
  return null;
}

/**
 * @param {{ sessionKey: string, projectKey: string, projectName?: string, isNewSession?: boolean, firstPrompt?: string }} params
 */
export async function scheduleCatalogShadowUpsert(params) {
  if (!isCatalogShadowWriteEnabled()) return;
  const ctx = getSaasRequestContext();
  if (!ctx?.tenantId || !ctx.userId) return;

  const sessionId = normalizeSessionId(params.sessionKey);
  if (!sessionId) return;

  const upsertInput = {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    sessionId,
    projectKey: params.projectKey,
    projectName: params.projectName,
    firstPrompt: params.firstPrompt,
    forcePending: Boolean(params.isNewSession),
  };

  if (params.isNewSession) {
    await awaitCatalogShadowUpsertWithTimeout(upsertInput, 300);
    return;
  }

  const debounceKey = `${ctx.tenantId}:${ctx.userId}:${sessionId}`;
  debounceCatalogWrite(debounceKey, async () => {
    await performCatalogShadowUpsert(upsertInput);
  }, 30_000);
}

const CATALOG_SYNC_TIMEOUT_MS = 300;

/**
 * PD-SAAS-FORK: sync catalog write for new sessions with bounded wait.
 * @param {Parameters<typeof performCatalogShadowUpsert>[0]} input
 * @param {number} [timeoutMs]
 */
export async function awaitCatalogShadowUpsertWithTimeout(input, timeoutMs = CATALOG_SYNC_TIMEOUT_MS) {
  if (!isCatalogShadowWriteEnabled()) return;
  try {
    await Promise.race([
      performCatalogShadowUpsert(input),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('catalog_shadow_timeout')), timeoutMs);
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message !== 'catalog_shadow_timeout') {
      console.warn('[conversation-catalog] sync upsert failed:', message);
    }
    try {
      await catalogStore.flushOutbox(5);
    } catch {
      // best-effort
    }
  }
}

/**
 * @param {{ tenantId: string, userId: number, sessionId: string, projectKey: string, projectName?: string, firstPrompt?: string, forcePending?: boolean }} input
 */
export async function performCatalogShadowUpsert(input) {
  if (!isCatalogShadowWriteEnabled()) return;
  const ctx = getSaasRequestContext();
  const tenantPilotHome = ctx?.tenantPilotHome;
  if (!tenantPilotHome) return;

  const legacyProjectId = await resolveLegacyProjectId(input.projectKey, input.projectName);
  const found = await findTranscriptPath({
    pilotHome: tenantPilotHome,
    sessionId: input.sessionId,
    projectKey: input.projectKey,
    legacyProjectId,
  });

  const workspace = input.projectName
    ? await resolveWorkspaceForProjectName(input.projectName).catch(() => null)
    : null;

  let summary = null;
  let aiTitle = null;
  let customTitle = null;
  let firstPrompt = input.firstPrompt ?? null;
  let tag = null;
  let createdAt = input.forcePending && !found ? new Date().toISOString() : null;
  let lastActivityAt = new Date().toISOString();
  let transcriptRelPath = found?.relPath ?? `projects/${legacyProjectId}/chats/${input.sessionId}.jsonl`;
  let transcriptAbsHash = null;
  const catalogStatus = found?.lite ? 'active' : (input.forcePending ? 'pending' : 'active');

  if (found?.lite) {
    const info = parseSessionInfoFromLite(input.sessionId, found.lite, input.projectKey);
    if (info) {
      summary = info.summary ?? null;
      aiTitle = info.aiTitle ?? null;
      customTitle = info.customTitle ?? null;
      firstPrompt = firstPrompt ?? info.firstPrompt ?? null;
      tag = info.tag ?? null;
      createdAt = info.createdAt ? new Date(info.createdAt).toISOString() : createdAt;
      lastActivityAt = new Date(info.lastModified).toISOString();
    }
    transcriptAbsHash = createHash('sha256').update(String(found.lite.size)).digest('hex').slice(0, 16);
  }

  const payload = {
    tenantId: input.tenantId,
    userId: input.userId,
    sessionId: input.sessionId,
    legacyProjectId,
    transcriptRelPath,
    workspaceId: workspace?.id ?? null,
    workspaceUuid: workspace?.workspace_uuid ?? null,
    summary,
    aiTitle,
    customTitle,
    firstPrompt,
    tag,
    title: summary ?? (firstPrompt ? String(firstPrompt).slice(0, 80) : null),
    createdAt,
    lastActivityAt,
    transcriptAbsHash,
    status: catalogStatus,
    source: 'web',
  };

  try {
    await catalogStore.upsert(payload);
    const prefix = sessionMessagesTailKeyPrefix({
      tenantId: input.tenantId,
      userId: input.userId,
      sessionId: input.sessionId,
    }).replace('*', '');
    void cacheDelByPattern(`${prefix}*`);
  } catch (error) {
    console.warn('[conversation-catalog] upsert failed, enqueue outbox:', error instanceof Error ? error.message : error);
    await catalogStore.enqueueOutbox({
      tenantId: input.tenantId,
      userId: input.userId,
      sessionId: input.sessionId,
      payload,
      lastError: error instanceof Error ? error.message : String(error),
    }).catch(() => undefined);
  }
}

/** Flush debounced writes + outbox (Bridge shutdown). */
export async function flushCatalogWritesOnShutdown() {
  await flushDebouncedCatalogWrites();
  try {
    await catalogStore.flushOutbox(50);
  } catch (error) {
    console.warn('[conversation-catalog] shutdown flush failed:', error instanceof Error ? error.message : error);
  }
}
