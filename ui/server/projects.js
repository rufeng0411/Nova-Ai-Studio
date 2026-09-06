/**
 * Project / session metadata layer (PilotDeck-only).
 *
 * Replaces the legacy four-provider scanner that used to read
 * ~/.gemini/projects/. After the PilotDeck-only migration:
 *
 *   - `getProjects()` lists projects via `gateway.listProjects()`.
 *   - `getSessions()` lists session transcripts via
 *     `gateway.listSessions()` (PilotDeck transcripts under
 *     ~/.pilotdeck/projects/<id>/chats/<sessionKey>.jsonl).
 *   - All sessions are returned in the single `sessions` array.
 *
 * Exports preserved for external callers under ui/server/:
 *
 *     getProjects, getProjectCronJobsOverview, getSessions,
 *     renameProject, deleteSession, deleteProject, addProjectManually,
 *     extractProjectDirectory, clearProjectDirectoryCache,
 *     searchConversations
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
    getPilotDeckGateway,
    getPilotDeckGatewayIfReady,
} from './pilotdeck-bridge.js';
import { mapLegacySessionPresentation } from '../../src/web/server/legacySessionPresentation.js';
import {
    resolvePilotHome,
    createProjectId,
    createCollisionResistantProjectId,
    sanitizeSessionIdForPath,
} from './utils/pilotPaths.js';
import { isSaasMode } from './saas/mode.js';
import { getSaasRequestContext, resolveEffectivePilotHome } from './saas/context.js';
import { resolveTenantSafeProjectKey, TenantForbiddenError } from './saas/tenant/projectGuard.js';
// PD-SAAS-FORK: keep only cron jobs whose projectKey belongs to the caller's tenant.
import { filterByTenantProjectKey } from './saas/alwaysOnScope.js';
import {
    listTenantDiskProjects,
    readMarkedProjectPathsForHome,
} from './saas/tenant/projectList.js';
// PD-SAAS-FORK: SaaS file storage (dual-root workspaces).
import {
    enrichSaasProjects,
    enrichSingleSaasProject,
    resolveFileRootForProjectName,
    resolveSessionProjectKeyForProjectName,
    resolveTranscriptProjectKeyForProjectName,
    resolveWorkspaceForProjectName,
    resolveDeliverableSearchRoots,
} from './saas/storage/fileStorageService.js';
import { isDeliverableCrossHubEnabled } from '../shared/deliverablePathResolve.mjs';
import { getCanonicalHubRoot } from './saas/storage/paths.js';
import { deleteWorkspaceForUser } from './saas/storage/workspaceStore.js';
import { mapCronRunOutcome } from '../../src/cron/protocol/types.js';
import { getPilotProjectChatDir } from '../../src/pilot/paths.ts';
import { countProjectSessions, countProjectSessionsFromChatDirs, listProjectSessions, listProjectSessionsFromChatDirs } from '../../src/session/index.js';
import sessionManager from './sessionManager.js';
import { applyCustomSessionNames } from './database/db.js';
import { getAlwaysOnRunHistoryPath } from './services/always-on-paths.js';
// PD-SAAS-FORK: conversation_catalog read/write integration
import { listCatalogSessionsForProject, listCatalogSessionsForSidebar, catalogRowToSessionInfo } from './saas/conversation/catalogReadPath.js';
import { catalogStore } from './saas/conversation/CatalogStore.js';
import { isCatalogShadowWriteEnabled, shouldReadConversationCatalog } from './saas/conversation/featureFlags.js';
import { normalizeSessionId } from './saas/conversation/normalizeSessionId.js';
import { resolveCatalogLegacyProjectId } from './saas/conversation/catalogLegacyProjectId.js';
import { resolveSidebarDefaultSinceMs } from './saas/conversation/sidebarDefaultWindow.js';
import { resolveSessionTranscriptAbsPath } from './saas/conversation/resolveSessionTranscriptPath.js';
import { recordSessionTombstone } from './saas/conversation/sessionTombstoneStore.js';

/** PD-SAAS-FORK: sidebar first paint + preview before "更多对话记录". */
const SIDEBAR_PROJECT_SESSION_PREVIEW_LIMIT = 10;
import { removeBridgeSessionState } from './pilotdeck-bridge.js';
import { cleanupSessionTurnResourcesOnDelete } from './saas/concurrency/turnQueuePump.js';

// Optional taskmaster detection. Read once per project; lightweight.
async function detectTaskMaster(projectPath) {
    try {
        const taskMasterDir = path.join(projectPath, '.taskmaster');
        const stat = await fs.stat(taskMasterDir);
        if (!stat.isDirectory()) {
            return { hasTaskmaster: false };
        }
        let tasksJson = false;
        try {
            await fs.access(path.join(taskMasterDir, 'tasks/tasks.json'));
            tasksJson = true;
        } catch {
            tasksJson = false;
        }
        return { hasTaskmaster: true, hasTasksJson: tasksJson };
    } catch {
        return { hasTaskmaster: false };
    }
}

const directoryCache = new Map();
// PD-SAAS-FORK: project list cold path is bounded-concurrent to reduce login sidebar latency.
const PROJECTS_LOAD_CONCURRENCY = 4;

async function mapWithConcurrency(items, limit, mapper) {
    const results = new Array(items.length);
    let nextIndex = 0;
    const workerCount = Math.max(1, Math.min(limit, items.length));
    const workers = Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            results[currentIndex] = await mapper(items[currentIndex], currentIndex);
        }
    });
    await Promise.all(workers);
    return results;
}

/** PD-SAAS-FORK: tenant-scoped pilot home when SaaS ALS context is active. */
function getPilotHome() {
    return resolveEffectivePilotHome(resolvePilotHome, process.env);
}

/**
 * PD-SAAS-FORK: gateway request fragment carrying the tenant transcript root.
 * Returns `{ pilotHome }` in SaaS so the single shared gateway stores/reads
 * transcripts under the tenant tree (isolating two tenants that registered the
 * same real project path); returns `{}` in single-user so the gateway keeps
 * using its global `~/.pilotdeck` home unchanged.
 */
function tenantPilotHomeOpt() {
    const tenantPilotHome = getSaasRequestContext()?.tenantPilotHome;
    return tenantPilotHome ? { pilotHome: tenantPilotHome } : {};
}

function rememberProjectDirectory(name, fullPath) {
    if (!name || !fullPath) return;
    directoryCache.set(name, fullPath);
}

function clearProjectDirectoryCache() {
    directoryCache.clear();
}

function getCachedProjectDirectories() {
    return [...directoryCache.values()];
}

const DELIVERABLE_WARM_TIMEOUT_MS = 3_000;

/** PD-SAAS-FORK: warm one project dir without blocking on full getProjects(). */
async function warmProjectDirectoryForDeliverables(projectName) {
    if (!projectName) return null;
    try {
        return await Promise.race([
            extractProjectDirectory(projectName),
            new Promise((_, reject) => {
                setTimeout(
                    () => reject(new Error('warm_project_directory_timeout')),
                    DELIVERABLE_WARM_TIMEOUT_MS,
                );
            }),
        ]);
    } catch {
        return null;
    }
}

/** PD-SAAS-FORK: merge cached project dirs with legacy/alternate storage roots. */
async function getDeliverableSearchRootsForProject(projectName) {
    const seen = new Set();
    const merged = [];
    const push = (value) => {
        if (!value) return;
        const key = path.resolve(value).toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        merged.push(path.resolve(value));
    };
    const allowCrossHub = isDeliverableCrossHubEnabled();
    if (isSaasMode()) {
        const storageRoots = await resolveDeliverableSearchRoots(projectName, { allowCrossHub }).catch(() => []);
        for (const root of storageRoots) {
            push(root);
        }
    }
    if (allowCrossHub) {
        for (const root of directoryCache.values()) {
            push(root);
        }
    } else {
        push(directoryCache.get(projectName));
        const warmed = await warmProjectDirectoryForDeliverables(projectName);
        push(warmed);
    }
    return merged;
}

function projectDisplayName(fullPath) {
    return path.basename(fullPath) || fullPath;
}

/**
 * Map a PilotDeck `WebSessionInfo` onto the legacy `ProjectSession`
 * shape the React frontend expects.
 */
function toLegacySession(session, projectName) {
    const presentation = mapLegacySessionPresentation(session);
    return {
        id: session.sessionId,
        title: presentation.title,
        summary: presentation.summary,
        name: presentation.name,
        createdAt: session.createdAt
            ? new Date(session.createdAt).toISOString()
            : new Date(session.lastModified || Date.now()).toISOString(),
        created_at: session.createdAt
            ? new Date(session.createdAt).toISOString()
            : new Date(session.lastModified || Date.now()).toISOString(),
        updated_at: session.lastModified
            ? new Date(session.lastModified).toISOString()
            : null,
        lastActivity: session.lastModified
            ? new Date(session.lastModified).toISOString()
            : null,
        messageCount: 0,
        cwd: session.cwd,
        customTitle: session.customTitle,
        aiTitle: session.aiTitle,
        firstPrompt: session.firstPrompt,
        tag: presentation.tag,
        __projectName: projectName,
        executionStatus: session.executionStatus ?? 'idle',
        queuePosition: session.queuePosition ?? null,
        pausedReason: session.pausedReason,
        sessionKind: session.sessionKind,
    };
}

function asRecencyMs(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function legacySessionRecencyMs(session) {
    return Math.max(
        asRecencyMs(session?.lastActivity),
        asRecencyMs(session?.updated_at),
        asRecencyMs(session?.createdAt),
        asRecencyMs(session?.created_at),
    );
}

function sortLegacySessions(sessions) {
    return [...sessions].sort((a, b) => {
        const diff = legacySessionRecencyMs(b) - legacySessionRecencyMs(a);
        if (diff !== 0) return diff;
        return String(a.id).localeCompare(String(b.id));
    });
}

function projectPayloadRecencyMs(project) {
    let latest = asRecencyMs(project?.lastActivity);
    for (const session of project.sessions ?? []) {
        latest = Math.max(latest, legacySessionRecencyMs(session));
    }
    return latest;
}

function sortProjectPayloads(projects) {
    return projects
        .map((project) => ({
            ...project,
            sessions: sortLegacySessions(project.sessions ?? []),
        }))
        .sort((a, b) => {
            const diff = projectPayloadRecencyMs(b) - projectPayloadRecencyMs(a);
            if (diff !== 0) return diff;
            return projectDisplayName(a.fullPath || a.path || a.name).localeCompare(
                projectDisplayName(b.fullPath || b.path || b.name),
            );
        });
}

async function readMarkedProjectPaths() {
    return readMarkedProjectPathsForHome(getPilotHome());
}

/** PD-SAAS-FORK: sidebar reads must survive a transient gateway disconnect. */
async function tryGetPilotDeckGateway() {
    const ready = await getPilotDeckGatewayIfReady();
    if (ready) {
        return ready;
    }
    // Warm the bridge for chat turns without blocking the sidebar on connectWithRetry().
    void getPilotDeckGateway().catch(() => undefined);
    return null;
}

function resolveSessionPilotHome() {
    return tenantPilotHomeOpt().pilotHome ?? getPilotHome();
}

/**
 * PD-SAAS-FORK: list sessions from tenant transcript dirs on disk (SaaS merge path).
 */
async function filterDiskSessionsAgainstCatalogDeleted(projectName, diskResult) {
    if (!diskResult || !isSaasMode() || !projectName) return diskResult;
    const ctx = getSaasRequestContext();
    // PD-SAAS-FORK: shadow-write marks deleted_at even when catalog read flag is off — disk lists must honor it.
    if (!ctx?.tenantId || !ctx.userId) {
        return diskResult;
    }
    if (!isCatalogShadowWriteEnabled() && !shouldReadConversationCatalog(ctx)) {
        return diskResult;
    }
    try {
        const deletedIds = await catalogStore.listSoftDeletedSessionIdsForUser({
            tenantId: String(ctx.tenantId),
            userId: Number(ctx.userId),
        });
        if (deletedIds.size === 0) return diskResult;
        const sessions = (diskResult.sessions ?? []).filter((session) => {
            const sessionId = typeof session?.sessionId === 'string' ? session.sessionId : '';
            if (!sessionId) return true;
            return !deletedIds.has(sessionId) && !deletedIds.has(normalizeSessionId(sessionId));
        });
        const removed = (diskResult.sessions?.length ?? 0) - sessions.length;
        return {
            ...diskResult,
            sessions,
            sessionCount:
                typeof diskResult.sessionCount === 'number'
                    ? Math.max(0, diskResult.sessionCount - removed)
                    : sessions.length,
        };
    } catch (error) {
        console.warn('[projects] filter disk sessions against catalog deleted failed:', error?.message || error);
        return diskResult;
    }
}

async function listDiskSessionsForProjectKey({
    sessionProjectKey,
    projectName = null,
    limit = SIDEBAR_PROJECT_SESSION_PREVIEW_LIMIT,
    offset = 0,
    includeTotal = true,
}) {
    const pilotHome = resolveSessionPilotHome();
    const chatDirs = projectName && isSaasMode()
        ? [...new Set(await resolveTranscriptChatsDirs(projectName))]
        : [getPilotProjectChatDir(sessionProjectKey, pilotHome)];

    const listOptions = {
        chatDirs,
        pilotHome,
        projectRoot: sessionProjectKey,
        limit,
        offset,
    };

    const [sessions, sessionCount] = await Promise.all([
        chatDirs.length <= 1
            ? listProjectSessions({
                  projectRoot: sessionProjectKey,
                  pilotHome,
                  limit,
                  offset,
              })
            : listProjectSessionsFromChatDirs(listOptions),
        includeTotal
            ? (chatDirs.length <= 1
                  ? countProjectSessions({
                        projectRoot: sessionProjectKey,
                        pilotHome,
                    })
                  : countProjectSessionsFromChatDirs(chatDirs))
            : Promise.resolve(undefined),
    ]);
    const nextOffset = offset + sessions.length;
    const diskResult = {
        sessions,
        sessionCount,
        nextCursor:
            typeof sessionCount === 'number' && nextOffset < sessionCount
                ? String(nextOffset)
                : undefined,
        source: 'disk',
    };
    return filterDiskSessionsAgainstCatalogDeleted(projectName, diskResult);
}

/**
 * PD-SAAS-FORK: apply default sidebar time window to disk session lists.
 */
function sessionListEntryRecencyMs(session) {
    const fields = [
        session?.lastModified,
        session?.last_modified,
        session?.lastActivity,
        session?.updated_at,
        session?.createdAt,
        session?.created_at,
    ];
    for (const field of fields) {
        if (field == null || field === '') continue;
        const ts = typeof field === 'number' ? field : Date.parse(String(field));
        if (Number.isFinite(ts)) return ts;
    }
    return 0;
}

function filterListResultBySidebarWindow(result, includeOlder = false) {
    if (!result || includeOlder) return result;
    const sinceMs = resolveSidebarDefaultSinceMs(false);
    if (sinceMs == null) return result;
    const sessions = (result.sessions ?? []).filter((session) => {
        const ts = sessionListEntryRecencyMs(session);
        if (!ts) return true;
        return ts >= sinceMs;
    });
    return {
        ...result,
        sessions,
    };
}

function finalizeSidebarSessionList(result, includeOlder, options = {}) {
    if (!result || includeOlder || !isSaasMode()) return result;
    const before = result.sessions?.length ?? 0;
    const filtered = filterListResultBySidebarWindow(result, false);
    const after = filtered.sessions?.length ?? 0;
    const removed = Math.max(0, before - after);
    const sessionCountAll = options.unfilteredCount
        ?? result.sessionCountAll
        ?? result.sessionCount
        ?? before;
    const sessionCount = typeof result.sessionCount === 'number'
        ? Math.max(after, result.sessionCount - removed)
        : after;
    const hasOlderSessions = Boolean(
        result.hasOlderSessions
        || removed > 0
        || (sessionCountAll > sessionCount && sessionCountAll > 0),
    );
    return {
        ...filtered,
        sessionCountAll,
        sessionCount,
        hasOlderSessions,
    };
}

function sidebarSessionId(session) {
    return typeof session?.sessionId === 'string' ? session.sessionId : '';
}

/**
 * PD-SAAS-FORK: catalog shadow-write can lag disk — merge disk-only sessions so sidebar never hides real chats.
 */
function mergeCatalogDiskSidebarSessions(catalogResult, diskResult, limit) {
    if (!catalogResult) return diskResult;
    if (!diskResult?.sessions?.length) return catalogResult;
    const byId = new Map();
    for (const session of catalogResult.sessions ?? []) {
        const id = sidebarSessionId(session);
        if (id) byId.set(id, session);
    }
    for (const session of diskResult.sessions ?? []) {
        const id = sidebarSessionId(session);
        if (!id || byId.has(id)) continue;
        byId.set(id, session);
    }
    const merged = [...byId.values()].sort(
        (a, b) => sessionListEntryRecencyMs(b) - sessionListEntryRecencyMs(a),
    );
    const capped = typeof limit === 'number' && limit > 0 ? merged.slice(0, limit) : merged;
    const diskCount = diskResult.sessionCount ?? diskResult.sessions?.length ?? 0;
    const catalogAll = catalogResult.sessionCountAll ?? catalogResult.sessionCount ?? 0;
    const sessionCountAll = Math.max(catalogAll, diskCount, merged.length);
    return {
        ...catalogResult,
        sessions: capped,
        sessionCount: Math.max(catalogResult.sessionCount ?? 0, merged.length),
        sessionCountAll,
        hasOlderSessions: Boolean(
            catalogResult.hasOlderSessions
            || sessionCountAll > capped.length,
        ),
    };
}

/**
 * PD-SAAS-FORK: list sessions from gateway when healthy; otherwise read tenant transcripts on disk.
 */
async function listSessionsForProjectKey({
    gateway,
    sessionProjectKey,
    projectName = null,
    limit = SIDEBAR_PROJECT_SESSION_PREVIEW_LIMIT,
    offset = 0,
    includeTotal = true,
    includeOlder = false,
}) {
    // PD-SAAS-FORK: Phase 2 — catalog sidebar window (shadow-write OK) with disk fallback.
    if (projectName && isSaasMode()) {
        const catalogResult = await listCatalogSessionsForSidebar({
            legacyProjectId: projectName,
            limit,
            offset,
            includeOlder,
        });
        const diskResult = await listDiskSessionsForProjectKey({
            sessionProjectKey,
            projectName,
            limit: Math.max(limit * 4, 40),
            offset: 0,
            includeTotal: true,
        });
        if (catalogResult && (
            (catalogResult.sessionCountAll ?? catalogResult.sessionCount ?? 0) > 0
            || (catalogResult.sessions ?? []).some((s) => ['queued', 'running', 'paused'].includes(s.executionStatus))
        )) {
            const merged = mergeCatalogDiskSidebarSessions(catalogResult, diskResult, limit);
            return finalizeSidebarSessionList(merged, includeOlder, {
                unfilteredCount: merged.sessionCountAll,
            });
        }
        return finalizeSidebarSessionList(diskResult, includeOlder, {
            unfilteredCount: diskResult.sessionCount,
        });
    }

    const pilotHome = resolveSessionPilotHome();
    const cursor = offset > 0 ? String(offset) : undefined;
    const gatewayOpt = tenantPilotHomeOpt();
    const preferDiskMerge = Boolean(projectName && isSaasMode());

    if (gateway && !preferDiskMerge) {
        try {
            const listResult = await gateway.listSessions({
                projectKey: sessionProjectKey,
                limit,
                cursor,
                ...gatewayOpt,
            });
            let sessionCount;
            if (includeTotal) {
                try {
                    const summary = await gateway.describeProject({
                        projectKey: sessionProjectKey,
                        ...gatewayOpt,
                    });
                    sessionCount = summary?.sessionCount;
                } catch {
                    sessionCount = undefined;
                }
            }
            return finalizeSidebarSessionList({
                sessions: listResult.sessions || [],
                sessionCount,
                nextCursor: listResult.nextCursor,
            }, includeOlder, { unfilteredCount: sessionCount });
        } catch (error) {
            console.warn(
                '[projects] gateway.listSessions failed, falling back to disk:',
                error?.message || error,
            );
        }
    }

    return finalizeSidebarSessionList(
        await listDiskSessionsForProjectKey({
            sessionProjectKey,
            projectName,
            limit,
            offset,
            includeTotal,
        }),
        includeOlder,
    );
}

async function getProjects(progressCallback = null) {
    const gateway = await tryGetPilotDeckGateway();
    const saasTenant = isSaasMode() && getSaasRequestContext();
    let gatewayProjects = [];
    if (saasTenant) {
        // SaaS project rows come from the tenant disk scan; gateway is only for session pages.
    } else if (!gateway) {
        throw new Error('Gateway WebSocket is not connected.');
    } else {
        ({ projects: gatewayProjects } = await gateway.listProjects());
    }
    const webProjects = saasTenant
        ? await listTenantDiskProjects(getPilotHome())
        : gatewayProjects;
    const markedProjects = await readMarkedProjectPaths();
    const markedProjectIdsByPath = new Map(
        [...markedProjects.entries()].map(([id, cwd]) => [path.resolve(cwd), id]),
    );

    // Dedupe by `createProjectId(fullPath)` rather than raw path string.
    // The gateway's heuristic decoder for project ids (which collapses
    // `-` back into `/`) may produce a path that differs from the
    // verbatim path stored in `.cwd`, yet both encode to the same id —
    // and the SidebarV2 keys rows by that id. A raw-path Set would let
    // both rows through and produce a visible duplicate that share an
    // expand-state.
    //
    // Strategy: build a Map<projectId, entry> from the gateway list,
    // then for each `.cwd` marker either backfill a missing project or
    // override the existing entry's path with the marker (the marker is
    // the user-typed verbatim path, so it wins over the heuristic
    // decode). Session counts from the gateway are preserved.
    const byId = new Map();
    for (const project of webProjects) {
        const fullPath = project.fullPath || project.projectKey;
        if (!fullPath) continue;
        const id = markedProjectIdsByPath.get(path.resolve(fullPath)) || createProjectId(fullPath);
        if (!byId.has(id)) {
            byId.set(id, { ...project, __projectId: id });
        }
    }
    for (const [id, markedCwd] of markedProjects) {
        const existing = byId.get(id);
        if (existing) {
            existing.fullPath = markedCwd;
            existing.projectKey = markedCwd;
            existing.__projectId = id;
        } else {
            byId.set(id, {
                __projectId: id,
                fullPath: markedCwd,
                projectKey: markedCwd,
                sessionCount: 0,
            });
        }
    }
    const dedupedProjects = [...byId.values()];
    const total = dedupedProjects.length;

    const result = await mapWithConcurrency(dedupedProjects, PROJECTS_LOAD_CONCURRENCY, async (project, index) => {
        let fullPath = project.fullPath || project.projectKey;
        const name = project.__projectId || createProjectId(fullPath);
        // PD-SAAS-FORK: never expose local .cwd paths to cloud UI; use effective tenant file root.
        if (isSaasMode()) {
            const effectiveRoot = await resolveFileRootForProjectName(name).catch(() => null);
            if (effectiveRoot) {
                fullPath = effectiveRoot;
            }
        }
        rememberProjectDirectory(name, fullPath);

        if (progressCallback) {
            progressCallback({
                phase: 'loading',
                processed: index,
                total,
                current: name,
            });
        }

        const sessionProjectKey =
            (await resolveTranscriptProjectKeyForProjectName(name)) || fullPath;
        const sessionsPromise = listSessionsForProjectKey({
            gateway,
            sessionProjectKey,
            projectName: name,
            limit: SIDEBAR_PROJECT_SESSION_PREVIEW_LIMIT,
            offset: 0,
        });
        // PD-SAAS-FORK: defer taskmaster detection off hot path when catalog read is enabled.
        const saasCtx = getSaasRequestContext();
        const skipTaskmaster = isSaasMode() && shouldReadConversationCatalog(saasCtx);
        const [sessionsResult, taskmaster] = await Promise.all([
            sessionsPromise,
            skipTaskmaster
                ? Promise.resolve({ hasTaskmaster: false })
                : detectTaskMaster(fullPath).catch(() => ({ hasTaskmaster: false })),
        ]);
        const sessions = sortLegacySessions((sessionsResult.sessions || []).map((session) =>
            toLegacySession(session, name),
        ));
        applyCustomSessionNames(sessions, 'claude');
        const sessionTotal =
            typeof sessionsResult.sessionCount === 'number'
                ? sessionsResult.sessionCount
                : (project.sessionCount ?? sessions.length);

        return {
            name,
            displayName: projectDisplayName(fullPath),
            fullPath,
            path: fullPath,
            lastActivity: project.lastActivity,
            sessions,
            sessionMeta: {
                total: sessionTotal,
                hasMore: sessions.length > 0 && sessionTotal > sessions.length,
                hasOlderSessions: Boolean(sessionsResult.hasOlderSessions),
            },
            taskmaster,
            alwaysOn: { enabled: false },
        };
    });

    if (progressCallback) {
        progressCallback({ phase: 'done', processed: total, total });
    }

    // PD-SAAS-FORK: enrich with storage metadata and filter device-invisible workspaces.
    let sortedResult = sortProjectPayloads(result);
    if (saasTenant) {
        sortedResult = await enrichSaasProjects(sortedResult);
    }
    result.length = 0;
    result.push(...sortedResult);

    // Virtual "general" workspace — a non-project chat space rooted at
    // ~/.pilotdeck. SidebarV2 looks for a project whose `name` or
    // `displayName` equals 'general' to populate the dedicated "General"
    // toggle section. PilotDeck's gateway.listProjects() only returns
    // real project directories, so we synthesize one here. New chats
    // started from the General section use this cwd; sessions are
    // sourced from the same backend as any other project.
    const generalHome = getPilotHome();
    let generalSessions = [];
    let generalTotal = 0;
    let generalLastActivity;
    let generalHasOlderSessions = false;
    try {
        const generalSessionKey =
            (await resolveTranscriptProjectKeyForProjectName('general')) || generalHome;
        const generalSessionsResult = await listSessionsForProjectKey({
            gateway,
            sessionProjectKey: generalSessionKey,
            projectName: 'general',
            limit: SIDEBAR_PROJECT_SESSION_PREVIEW_LIMIT,
            offset: 0,
        });
        generalHasOlderSessions = Boolean(generalSessionsResult.hasOlderSessions);
        generalSessions = sortLegacySessions((generalSessionsResult.sessions || []).map((session) =>
            toLegacySession(session, 'general'),
        ));
        applyCustomSessionNames(generalSessions, 'claude');
        generalTotal = typeof generalSessionsResult.sessionCount === 'number'
            ? generalSessionsResult.sessionCount
            : generalSessions.length;
        generalLastActivity = generalSessions[0]?.lastActivity
            ? Date.parse(generalSessions[0].lastActivity)
            : undefined;
    } catch (error) {
        console.warn(
            '[projects] general session list failed:',
            error instanceof Error ? error.message : error,
        );
        generalSessions = [];
        generalTotal = 0;
        generalLastActivity = undefined;
    }
    rememberProjectDirectory('general', generalHome);
    const generalProject = {
        name: 'general',
        displayName: 'general',
        fullPath: generalHome,
        path: generalHome,
        lastActivity: generalLastActivity,
        sessions: generalSessions,
        sessionMeta: {
            total: generalTotal,
            hasMore: generalSessions.length > 0 && generalTotal > generalSessions.length,
            hasOlderSessions: generalHasOlderSessions,
        },
        taskmaster: { hasTaskmaster: false },
        alwaysOn: { enabled: false },
    };
    if (saasTenant) {
        result.unshift(await enrichSingleSaasProject(generalProject));
    } else {
        result.unshift(generalProject);
    }

    return result;
}

async function getSessions(projectName, limit = SIDEBAR_PROJECT_SESSION_PREVIEW_LIMIT, offset = 0, options = {}) {
    const gateway = await tryGetPilotDeckGateway();
    const sessionKey =
        (await resolveTranscriptProjectKeyForProjectName(projectName)) ||
        (await extractProjectDirectory(projectName));
    // PD-SAAS-FORK: keep session listing inside the tenant boundary. An
    // out-of-tenant projectName must not surface another context's sessions.
    const safe = await resolveTenantSafeProjectKey(sessionKey);
    if (!safe.allowed) {
        throw new TenantForbiddenError('Project is not accessible for the current account.');
    }
    const projectPath = safe.projectKey;
    const listResult = await listSessionsForProjectKey({
        gateway,
        sessionProjectKey: projectPath,
        projectName,
        limit,
        offset,
        includeOlder: options.includeOlder,
    });
    const sessions = sortLegacySessions((listResult.sessions || []).map((session) =>
        toLegacySession(session, projectName),
    ));
    const hasMore = Boolean(listResult.nextCursor);
    const fallbackTotal = offset + sessions.length + (hasMore ? 1 : 0);
    const total = typeof listResult.sessionCount === 'number'
        ? listResult.sessionCount
        : fallbackTotal;
    return {
        sessions,
        total,
        hasMore,
        hasOlderSessions: Boolean(listResult.hasOlderSessions),
        offset,
        limit,
    };
}

/**
 * Resolve a `projectName` (encoded form like `-Users-miwi-PilotDeck`,
 * a basename, or an already-absolute path) to the absolute project root.
 * Falls back to consulting the directory cache populated by
 * `getProjects()` so worktree-aware paths resolve correctly.
 */
async function extractProjectDirectory(projectName) {
    if (!projectName) {
        return getPilotHome();
    }
    if (path.isAbsolute(projectName)) {
        rememberProjectDirectory(projectName, projectName);
        return projectName;
    }
    const cached = directoryCache.get(projectName);
    if (cached) {
        return cached;
    }
    const markedProjects = await readMarkedProjectPaths();
    const marked = markedProjects.get(projectName);
    if (marked) {
        rememberProjectDirectory(projectName, marked);
        return marked;
    }
    // PD-SAAS-FORK: dual-root file resolution for SaaS workspaces.
    if (isSaasMode()) {
        const fileRoot = await resolveFileRootForProjectName(projectName);
        if (fileRoot) {
            rememberProjectDirectory(projectName, fileRoot);
            return fileRoot;
        }
    }
    if (projectName.startsWith('-')) {
        // Legacy dash-encoding heuristic: `-Users-foo-foo` → `/Users/foo/foo`.
        const decoded = '/' + projectName.replace(/^-+/, '').replace(/-/g, '/');
        rememberProjectDirectory(projectName, decoded);
        return decoded;
    }
    return getPilotHome();
}

async function addProjectManually(projectPath, _displayName = null) {
    if (!projectPath) {
        throw new Error('projectPath is required');
    }
    const absolute = path.resolve(projectPath);
    const pilotHome = getPilotHome();
    const name = await allocateProjectIdForPath(absolute, pilotHome);
    rememberProjectDirectory(name, absolute);

    // Materialize a PilotDeck project directory and drop a `.cwd` marker
    // recording the real absolute path. We need the marker because
    // createProjectId() encodes both '/' and literal '-' to '-', so the
    // PilotDeck's listWebProjects() heuristically tries each `-` as a
    // path separator and drops the project when no decode matches an
    // existing directory — which would silently lose workspaces whose
    // real path contains a dash. getProjects() reads `.cwd` to backfill
    // any project listProjects() couldn't recover.
    const projectDir = path.join(pilotHome, 'projects', name);
    try {
        await fs.mkdir(projectDir, { recursive: true });
        await fs.writeFile(path.join(projectDir, '.cwd'), absolute, 'utf8');
    } catch (error) {
        console.warn(
            `[projects] failed to materialize PilotDeck project dir for ${name}:`,
            error?.message || error,
        );
    }

    return {
        name,
        displayName: projectDisplayName(absolute),
        fullPath: absolute,
        path: absolute,
    };
}

async function allocateProjectIdForPath(absolutePath, pilotHome) {
    const legacyId = createProjectId(absolutePath);
    const legacyDir = path.join(pilotHome, 'projects', legacyId);
    try {
        await fs.access(legacyDir);
    } catch (error) {
        if (error?.code === 'ENOENT') {
            return legacyId;
        }
        throw error;
    }

    const markerPath = path.join(legacyDir, '.cwd');
    try {
        const marker = (await fs.readFile(markerPath, 'utf8')).trim();
        if (marker && path.resolve(marker) === absolutePath) {
            return legacyId;
        }
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            throw error;
        }
    }

    return createCollisionResistantProjectId(absolutePath);
}

async function renameProject(_projectName, _displayName) {
    // PilotDeck does not yet expose a rename API. Display names are derived
    // from the project's basename today, so this is a no-op.
    return { success: true };
}

async function resolveProjectIdForPathOrName(projectName, fullPath) {
    const markedProjects = await readMarkedProjectPaths();
    if (projectName && !path.isAbsolute(projectName) && markedProjects.has(projectName)) {
        return projectName;
    }
    const resolved = path.resolve(fullPath);
    for (const [id, cwd] of markedProjects) {
        if (path.resolve(cwd) === resolved) {
            return id;
        }
    }
    return createProjectId(fullPath);
}

/**
 * PD-SAAS-FORK: resolve transcript chat dirs the same way as gateway.listSessions.
 * Includes legacy folders, canonical/local SaaS roots, and hash-based slug dirs.
 */
async function resolveTranscriptChatsDirs(projectName) {
    const pilotHome = getPilotHome();
    const fullPath = await extractProjectDirectory(projectName);
    const dirs = new Set();

    const addProjectRoot = (root) => {
        if (typeof root === 'string' && root.trim()) {
            dirs.add(getPilotProjectChatDir(root.trim(), pilotHome));
        }
    };

    const [transcriptKey, sessionKey] = await Promise.all([
        resolveTranscriptProjectKeyForProjectName(projectName),
        resolveSessionProjectKeyForProjectName(projectName),
    ]);
    addProjectRoot(transcriptKey);
    addProjectRoot(sessionKey);
    addProjectRoot(fullPath);

    const legacyId = await resolveProjectIdForPathOrName(projectName, fullPath);
    if (legacyId) {
        dirs.add(path.join(pilotHome, 'projects', legacyId, 'chats'));
    }

    if (isSaasMode()) {
        const workspace = await resolveWorkspaceForProjectName(projectName);
        if (workspace?.legacyProjectId) {
            dirs.add(path.join(pilotHome, 'projects', workspace.legacyProjectId, 'chats'));
        }
        // PD-SAAS-FORK: general transcripts live under tenant slug, not projects/general/chats.
        if (projectName === 'general') {
            const ctx = getSaasRequestContext();
            if (ctx?.tenantPilotHome) {
                const generalSlug = createProjectId(ctx.tenantPilotHome);
                dirs.add(path.join(pilotHome, 'projects', generalSlug, 'chats'));
            }
        }
        if (workspace?.canonicalProjectKey) {
            addProjectRoot(workspace.canonicalProjectKey);
        }
        if (workspace?.localRootPath) {
            addProjectRoot(workspace.localRootPath);
        }
    }

    return [...dirs];
}

/** PD-SAAS-FORK: Windows/Unix session key aliases + sanitized filename variants. */
function sessionTranscriptBasenames(sessionId) {
    const trimmed = String(sessionId || '').trim();
    if (!trimmed) return [];
    const names = new Set([trimmed, sanitizeSessionIdForPath(trimmed)]);
    if (trimmed.includes('web:s_')) {
        names.add(trimmed.replace(/web:s_/g, 'web-s_'));
    }
    if (trimmed.includes('web-s_')) {
        names.add(trimmed.replace(/web-s_/g, 'web:s_'));
    }
    return [...names];
}

/**
 * PD-SAAS-FORK: legacy slug dirs under projects/{id}/chats may hold transcripts when
 * .cwd markers moved but old jsonl files remain (cloud-only migration).
 */
async function findTenantSessionTranscriptPaths(pilotHome, basenameCandidates) {
    const matches = new Set();
    const projectsRoot = path.join(pilotHome, 'projects');
    let entries;
    try {
        entries = await fs.readdir(projectsRoot, { withFileTypes: true });
    } catch {
        return matches;
    }
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const chatsDir = path.join(projectsRoot, entry.name, 'chats');
        for (const base of basenameCandidates) {
            const candidate = path.join(chatsDir, `${base}.jsonl`);
            try {
                await fs.access(candidate);
                matches.add(candidate);
            } catch {
                // not in this chats dir
            }
        }
    }
    return matches;
}

async function deleteSession(projectName, sessionId, options = {}) {
    const fullPath = await extractProjectDirectory(projectName);
    const chatsDirs = await resolveTranscriptChatsDirs(projectName);
    const normalizedSessionId = normalizeSessionId(sessionId);
    let catalogHardDeleted = false;
    let catalogTranscriptRel = null;

    // PD-SAAS-FORK: resolve catalog transcript path before physical purge.
    if (isSaasMode()) {
        const saasCtx = getSaasRequestContext();
        if (saasCtx?.tenantId && saasCtx.userId && (isCatalogShadowWriteEnabled() || shouldReadConversationCatalog(saasCtx))) {
            try {
                const existing = await catalogStore.getBySessionId({
                    tenantId: saasCtx.tenantId,
                    userId: saasCtx.userId,
                    sessionId: normalizedSessionId,
                    includeDeleted: true,
                });
                catalogTranscriptRel = existing?.transcriptRelPath ?? null;
            } catch (error) {
                console.warn('[projects] catalog lookup before delete failed:', error?.message || error);
            }
        }
    }

    const sessionKind = typeof options.sessionKind === 'string' ? options.sessionKind : null;
    const parentSessionId = typeof options.parentSessionId === 'string' ? options.parentSessionId : null;
    const relativeTranscriptPath = typeof options.relativeTranscriptPath === 'string'
        ? options.relativeTranscriptPath
        : null;

    // PD-SAAS-FORK: tombstone before purge so orphan jsonl cannot be read/resumed.
    if (isSaasMode()) {
        const saasCtx = getSaasRequestContext();
        if (saasCtx?.tenantId && saasCtx.userId) {
            await recordSessionTombstone({
                sessionId: normalizedSessionId,
                tenantId: saasCtx.tenantId,
                userId: saasCtx.userId,
                reason: 'user-delete',
            });
        }
    }

    // PD-SAAS-FORK: stop in-flight gateway turns before removing transcripts.
    try {
        const gateway = await getPilotDeckGatewayIfReady();
        if (gateway) {
            const abortKeys = new Set([sessionId]);
            if (parentSessionId) abortKeys.add(parentSessionId);
            for (const sessionKey of abortKeys) {
                await gateway.abortTurn({ sessionKey }).catch(() => undefined);
                await gateway.closeSession({ sessionKey, reason: 'user-delete' }).catch(() => undefined);
            }
            if (typeof options.taskId === 'string' && options.taskId.trim()) {
                await gateway.cronDelete({ taskId: options.taskId.trim(), stopRunning: true }).catch(() => undefined);
            }
        }
    } catch (error) {
        console.warn('[projects] deleteSession gateway cleanup failed:', error?.message || error);
    }

    if (isSaasMode()) {
        const saasCtx = getSaasRequestContext();
        if (saasCtx?.tenantId && saasCtx.userId) {
            try {
                await cleanupSessionTurnResourcesOnDelete({
                    tenantId: saasCtx.tenantId,
                    userId: saasCtx.userId,
                    sessionKey: normalizedSessionId,
                    role: saasCtx.role ?? null,
                });
            } catch (error) {
                console.warn('[projects] deleteSession turn-queue cleanup failed:', error?.message || error);
            }
        }
    }

    removeBridgeSessionState(sessionId);
    if (parentSessionId) removeBridgeSessionState(parentSessionId);

    const transcriptPaths = new Set();
    const basenameCandidates = sessionTranscriptBasenames(sessionId);

    for (const chatsDir of chatsDirs) {
        if (sessionKind === 'background_task' && parentSessionId && relativeTranscriptPath) {
            const rel = relativeTranscriptPath.replace(/\\/g, '/').replace(/^\/+/, '');
            transcriptPaths.add(path.join(chatsDir, ...rel.split('/')));
            const fileName = path.posix.basename(rel);
            if (fileName && !fileName.startsWith('agent-')) {
                transcriptPaths.add(path.join(chatsDir, ...rel.split('/').slice(0, -1), `agent-${fileName}`));
            }
        }

        for (const name of basenameCandidates) {
            transcriptPaths.add(path.join(chatsDir, `${name}.jsonl`));
        }
    }

    if (isSaasMode()) {
        if (catalogTranscriptRel) {
            transcriptPaths.add(
                path.join(getPilotHome(), ...catalogTranscriptRel.split('/').filter(Boolean)),
            );
        }
        const resolvedAbs = await resolveSessionTranscriptAbsPath({
            sessionId: normalizedSessionId,
            tenantPilotHome: getPilotHome(),
            catalogTranscriptRel,
        });
        if (resolvedAbs) {
            transcriptPaths.add(resolvedAbs);
        }
        for (const orphan of await findTenantSessionTranscriptPaths(getPilotHome(), basenameCandidates)) {
            transcriptPaths.add(orphan);
        }
    }

    let removed = false;
    for (const transcript of transcriptPaths) {
        try {
            await fs.unlink(transcript);
            removed = true;
        } catch (error) {
            if (error?.code !== 'ENOENT') {
                throw error;
            }
        }
    }

    if (sessionKind === 'background_task') {
        const purged = await purgeAlwaysOnRunHistoryBySession(fullPath, {
            sessionId,
            parentSessionId,
            relativeTranscriptPath,
        });
        if (purged) removed = true;
    }

    // PD-SAAS-FORK: physical catalog purge after jsonl removal.
    if (isSaasMode()) {
        const saasCtx = getSaasRequestContext();
        if (saasCtx?.tenantId && saasCtx.userId && (isCatalogShadowWriteEnabled() || shouldReadConversationCatalog(saasCtx))) {
            try {
                catalogHardDeleted = await catalogStore.hardDelete({
                    tenantId: saasCtx.tenantId,
                    userId: saasCtx.userId,
                    sessionId: normalizedSessionId,
                });
            } catch (error) {
                console.warn('[projects] catalog hardDelete failed:', error?.message || error);
            }
        }
    }

    return removed || catalogHardDeleted;
}

async function purgeAlwaysOnRunHistoryBySession(projectRoot, { sessionId, parentSessionId, relativeTranscriptPath }) {
    const historyPath = getAlwaysOnRunHistoryPath(projectRoot);
    let raw = '';
    try {
        raw = await fs.readFile(historyPath, 'utf8');
    } catch (error) {
        if (error?.code === 'ENOENT') return false;
        throw error;
    }

    const lines = raw.split('\n').filter((line) => line.trim());
    if (lines.length === 0) return false;

    const kept = lines.filter((line) => {
        try {
            const entry = JSON.parse(line);
            const session = entry?.session && typeof entry.session === 'object' ? entry.session : {};
            const entrySessionId = typeof session.sessionId === 'string' ? session.sessionId : '';
            const entryParent = typeof session.parentSessionId === 'string' ? session.parentSessionId : '';
            const entryRel = typeof session.relativeTranscriptPath === 'string' ? session.relativeTranscriptPath : '';
            if (sessionId && entrySessionId === sessionId) return false;
            if (
                parentSessionId
                && relativeTranscriptPath
                && entryParent === parentSessionId
                && entryRel === relativeTranscriptPath
            ) {
                return false;
            }
            return true;
        } catch {
            return true;
        }
    });

    if (kept.length === lines.length) return false;
    await fs.writeFile(historyPath, kept.length > 0 ? `${kept.join('\n')}\n` : '', 'utf8');
    return true;
}

async function deleteProject(projectName, force = false) {
    if (!projectName || typeof projectName !== 'string') {
        return false;
    }
    if (projectName === 'general') {
        throw new Error('Cannot delete the General workspace');
    }

    const pilotHome = getPilotHome();
    const fullPath = await extractProjectDirectory(projectName);
    const pathsToRemove = new Set();
    const catalogLegacyIds = new Set([
        projectName,
        resolveCatalogLegacyProjectId(projectName),
    ]);

    const projectId = await resolveProjectIdForPathOrName(projectName, fullPath);
    if (projectId) {
        pathsToRemove.add(path.join(pilotHome, 'projects', projectId));
    }

    const chatsDirs = await resolveTranscriptChatsDirs(projectName);
    for (const chatsDir of chatsDirs) {
        pathsToRemove.add(chatsDir);
        pathsToRemove.add(path.dirname(chatsDir));
    }

    let workspaceRemoved = false;
    let catalogRowsRemoved = 0;

    if (isSaasMode()) {
        const saasCtx = getSaasRequestContext();
        const workspace = await resolveWorkspaceForProjectName(projectName);

        if (workspace) {
            catalogLegacyIds.add(workspace.legacyProjectId);
            if (workspace.canonicalProjectKey) {
                const canonical = path.resolve(workspace.canonicalProjectKey);
                pathsToRemove.add(canonical);
                pathsToRemove.add(path.join(pilotHome, 'projects', createProjectId(canonical)));
            }
            if (workspace.localRootPath) {
                pathsToRemove.add(path.resolve(workspace.localRootPath));
            }
            if (workspace.workspaceUuid && saasCtx?.tenantId && saasCtx?.userId) {
                pathsToRemove.add(getCanonicalHubRoot(saasCtx.tenantId, saasCtx.userId, workspace.workspaceUuid));
            }
            pathsToRemove.add(path.join(pilotHome, 'projects', workspace.legacyProjectId));
        }

        const marked = await readMarkedProjectPaths();
        const canonicalKey = workspace?.canonicalProjectKey
            ? path.resolve(workspace.canonicalProjectKey)
            : path.resolve(fullPath);
        for (const [slug, cwd] of marked) {
            const resolvedCwd = path.resolve(cwd);
            if (
                slug === projectName
                || resolvedCwd === canonicalKey
                || resolvedCwd === path.resolve(fullPath)
            ) {
                pathsToRemove.add(path.join(pilotHome, 'projects', slug));
                catalogLegacyIds.add(slug);
            }
        }

        if (saasCtx?.tenantId && saasCtx?.userId && (isCatalogShadowWriteEnabled() || shouldReadConversationCatalog(saasCtx))) {
            for (const legacyProjectId of catalogLegacyIds) {
                if (!legacyProjectId) continue;
                catalogRowsRemoved += await catalogStore.hardDeleteByProject({
                    tenantId: saasCtx.tenantId,
                    userId: saasCtx.userId,
                    legacyProjectId,
                }).catch(() => 0);
            }
        }

        if (workspace && saasCtx?.tenantId && saasCtx?.userId) {
            workspaceRemoved = await deleteWorkspaceForUser(
                saasCtx.userId,
                saasCtx.tenantId,
                workspace.legacyProjectId,
            ).catch(() => false);
        }
    } else if (!force) {
        // Standalone: legacy behavior — only delete empty project dirs unless forced.
        for (const chatsDir of chatsDirs) {
            try {
                const names = await fs.readdir(chatsDir);
                if (names.some((name) => name.endsWith('.jsonl'))) {
                    return false;
                }
            } catch {
                // missing chats dir is fine
            }
        }
    }

    let diskRemoved = false;
    for (const target of pathsToRemove) {
        if (!target) continue;
        try {
            await fs.rm(target, { recursive: true, force: true });
            diskRemoved = true;
        } catch (error) {
            if (error?.code !== 'ENOENT') {
                throw error;
            }
        }
    }

    directoryCache.delete(projectName);
    clearProjectDirectoryCache();

    return diskRemoved || workspaceRemoved || catalogRowsRemoved > 0;
}

async function getProjectCronJobsOverview(_projectName) {
    try {
        const gateway = await getPilotDeckGateway();
        const result = await gateway.cronList({ includeHistory: true, limit: 50 });
        const runsByTaskId = new Map();
        if (Array.isArray(result.recentRuns)) {
            for (const run of result.recentRuns) {
                if (!run.taskId) continue;
                const existing = runsByTaskId.get(run.taskId);
                if (!existing || run.startedAt > existing.startedAt) {
                    runsByTaskId.set(run.taskId, run);
                }
            }
        }
        const jobs = (result.tasks || []).map((task) => {
            const latestRun = runsByTaskId.get(task.taskId) || null;
            const isCron = task.schedule?.type === 'cron';
            return {
                id: task.taskId,
                projectKey: task.projectKey || null,
                cron: isCron ? task.schedule.expression : '',
                prompt: task.message || '',
                createdAt: task.createdAt,
                recurring: isCron,
                permanent: isCron,
                manualOnly: false,
                status: task.status === 'running' ? 'running' : 'scheduled',
                lastFiredAt: latestRun?.startedAt ? new Date(latestRun.startedAt).getTime() : undefined,
                latestRun: latestRun ? {
                    status: mapCronRunOutcome(latestRun.outcome, latestRun.finishedAt),
                    runId: latestRun.runId,
                    startedAt: latestRun.startedAt,
                    taskId: latestRun.taskId,
                    sessionId: latestRun.sessionKey,
                } : null,
            };
        });
        // PD-SAAS-FORK: tenant isolation — drop jobs from other tenants' projects.
        return { jobs: filterByTenantProjectKey(jobs) };
    } catch (error) {
        console.warn('[projects] cronList via gateway failed, returning empty:', error?.message);
        return { jobs: [] };
    }
}

async function searchConversations(query, limit = 50, onProjectResult = null, signal = null) {
    const needle = (query || '').trim().toLowerCase();
    if (!needle) {
        return { totalMatches: 0 };
    }

    const saasCtx = getSaasRequestContext();
    if (isSaasMode() && shouldReadConversationCatalog(saasCtx) && saasCtx?.tenantId && saasCtx.userId) {
        try {
            const rows = await catalogStore.search({
                tenantId: saasCtx.tenantId,
                userId: saasCtx.userId,
                query: needle,
                limit,
            });
            const byProject = new Map();
            for (const row of rows) {
                // PD-SAAS-FORK: N2 Bot steward stays out of conversation search.
                if (row.kind === 'n2_bot') continue;
                const projectName = row.legacyProjectId || 'general';
                if (!byProject.has(projectName)) {
                    byProject.set(projectName, []);
                }
                byProject.get(projectName).push(toLegacySession(catalogRowToSessionInfo(row), projectName));
            }
            let totalMatches = 0;
            let scanned = 0;
            for (const [projectName, matches] of byProject) {
                if (signal?.aborted) break;
                scanned += 1;
                totalMatches += matches.length;
                if (onProjectResult) {
                    const project = { name: projectName, fullPath: projectName };
                    await Promise.resolve(onProjectResult({
                        projectResult: { project, matches },
                        totalMatches,
                        scannedProjects: scanned,
                        totalProjects: byProject.size,
                    })).catch(() => undefined);
                }
                if (totalMatches >= limit) break;
            }
            return { totalMatches };
        } catch (error) {
            console.warn('[projects] catalog search failed, falling back:', error?.message || error);
        }
    }

    const projects = await getProjects();
    let totalMatches = 0;
    for (let index = 0; index < projects.length; index += 1) {
        if (signal?.aborted) break;
        const project = projects[index];
        const matches = (project.sessions || []).filter((session) => {
            const haystack = [
                session.title,
                session.summary,
                session.customTitle,
                session.aiTitle,
                session.firstPrompt,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(needle);
        });
        if (matches.length > 0) {
            const projectResult = {
                project: { name: project.name, fullPath: project.fullPath },
                matches,
            };
            totalMatches += matches.length;
            if (onProjectResult) {
                await Promise.resolve(
                    onProjectResult({
                        projectResult,
                        totalMatches,
                        scannedProjects: index + 1,
                        totalProjects: projects.length,
                    }),
                ).catch(() => undefined);
            }
            if (totalMatches >= limit) break;
        }
    }
    return { totalMatches };
}

export {
    getProjects,
    getProjectCronJobsOverview,
    getSessions,
    renameProject,
    deleteSession,
    deleteProject,
    addProjectManually,
    extractProjectDirectory,
    warmProjectDirectoryForDeliverables,
    getCachedProjectDirectories,
    getDeliverableSearchRootsForProject,
    clearProjectDirectoryCache,
    searchConversations,
};
