/**
 * PD-SAAS-FORK: resolve file roots, visibility, and workspace lifecycle.
 */
import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getSaasRequestContext } from '../context.js';
import { isSaasMode } from '../mode.js';
import { getUserPreferences } from '../userPreferences.js';
import {
  getCanonicalHubRoot,
  getUserCloudStorageRoot,
  listFilesystemWorkspaceHubsForUser,
  pathContainsUserSegment,
  resolveFileRootFromWorkspace,
  resolveSessionProjectKeyFromWorkspace,
} from './paths.js';
import {
  getWorkspaceByLegacyProjectId,
  insertWorkspace,
  listWorkspacesForUser,
} from './workspaceStore.js';
import { createProjectId } from '../../utils/pilotPaths.js';
import { isPathWithinProjectRoot } from '../../utils/pathInProject.js';
import { readMarkedProjectPathsForHome } from '../tenant/projectList.js';
import {
  ensureSaasWorkspacesProvisioned,
  ensureTranscriptMarkerForWorkspace,
} from './ensureWorkspaces.js';
import { isSaasOssActive, saasOssStatusSummary } from './ossConfig.js';
import { mirrorDirectoryToOss } from './ossObjectStorage.js';
import { isDeliverableCrossHubEnabled } from '../../../shared/deliverablePathResolve.mjs';
import { isHtmlDeliverableWritePath } from './htmlStudioWritePolicy.js';
import { isHfStudioWritePath } from './hfStudioWritePolicy.js';
import { isBentoDeckWritePath } from './bentoWritePolicy.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Legacy folder ids that represent the virtual general workspace, not user projects.
 * @param {string} legacyProjectId
 * @param {string} tenantPilotHome
 */
export function isGeneralAliasLegacyId(legacyProjectId, tenantPilotHome) {
  if (!legacyProjectId || legacyProjectId === 'general') {
    return true;
  }
  if (!tenantPilotHome) {
    return false;
  }
  return legacyProjectId === createProjectId(tenantPilotHome);
}

/**
 * @param {string} value
 */
export function looksLikeWorkspaceUuid(value) {
  if (!value || typeof value !== 'string') return false;
  const base = path.basename(value.replace(/\\/g, '/'));
  return UUID_RE.test(base);
}

/**
 * User-facing SaaS projects are created via createSaasNamedWorkspace (`workspaces-*` ids).
 * @param {string} projectName
 * @param {{ legacyProjectId?: string } | null | undefined} ws
 */
export function isUserCreatedSaasProject(projectName, ws) {
  const legacyId = ws?.legacyProjectId || projectName || '';
  return typeof legacyId === 'string' && legacyId.startsWith('workspaces-');
}

/**
 * Human label for sidebar / file tree (never show raw workspace uuid when avoidable).
 * @param {import('./workspaceStore.js').mapRow | null | undefined} ws
 * @param {{ name?: string; displayName?: string }} project
 */
export function resolveWorkspaceDisplayLabel(ws, project) {
  const legacyId = ws?.legacyProjectId || project.name || '';
  if (
    ws?.displayName &&
    ws.displayName !== 'general' &&
    !looksLikeWorkspaceUuid(ws.displayName)
  ) {
    return ws.displayName;
  }
  if (legacyId.startsWith('workspaces-')) {
    return legacyId.slice('workspaces-'.length) || legacyId;
  }
  const fallback = project.displayName || legacyId;
  if (looksLikeWorkspaceUuid(fallback)) {
    return legacyId.startsWith('workspaces-')
      ? legacyId.slice('workspaces-'.length)
      : legacyId;
  }
  return fallback;
}

/**
 * Hide duplicate general / cloud-alias rows from the Projects sidebar section.
 * @param {string} projectName
 * @param {string} tenantPilotHome
 * @param {Array<{ legacyProjectId: string; canonicalProjectKey: string }>} workspaces
 * @param {{ cloudOnly?: boolean; migrationVersion?: number }} [fileStorage]
 */
export function shouldOmitFromProjectSidebar(
  projectName,
  tenantPilotHome,
  workspaces,
  fileStorage = {},
) {
  if (!projectName || projectName === 'general') {
    return true;
  }
  if (isGeneralAliasLegacyId(projectName, tenantPilotHome)) {
    return true;
  }
  const cloudOnly = fileStorage.cloudOnly !== false;
  const migrationVersion =
    typeof fileStorage.migrationVersion === 'number' ? fileStorage.migrationVersion : 2;
  const sidebarUserProjectsOnly = cloudOnly && migrationVersion >= 2;

  const ws = workspaces.find((w) => w.legacyProjectId === projectName);
  if (sidebarUserProjectsOnly && !isUserCreatedSaasProject(projectName, ws)) {
    return true;
  }
  if (!ws) {
    return false;
  }
  const generalWs = workspaces.find((w) => w.legacyProjectId === 'general');
  if (
    generalWs &&
    path.resolve(generalWs.canonicalProjectKey) === path.resolve(ws.canonicalProjectKey)
  ) {
    return true;
  }
  return false;
}

function defaultFileStoragePrefs() {
  return {
    cloudOnly: true,
    migrationVersion: 2,
  };
}

export function parseFileStoragePrefs(prefs) {
  const raw = prefs?.fileStorage;
  if (!raw || typeof raw !== 'object') {
    return defaultFileStoragePrefs();
  }
  return {
    cloudOnly: raw.cloudOnly !== false,
    migrationVersion: typeof raw.migrationVersion === 'number' ? raw.migrationVersion : 2,
  };
}

async function getRequestFileStorage() {
  const ctx = getSaasRequestContext();
  if (!ctx?.userId) return { ctx: null, fileStorage: defaultFileStoragePrefs() };
  const prefs = await getUserPreferences(ctx.userId);
  return { ctx, fileStorage: parseFileStoragePrefs(prefs) };
}

/**
 * @param {string} projectName
 */
export async function resolveWorkspaceForProjectName(projectName) {
  if (!isSaasMode()) return null;
  const { ctx } = await getRequestFileStorage();
  if (!ctx?.userId || !ctx.tenantId || !projectName) {
    return null;
  }
  return getWorkspaceByLegacyProjectId(ctx.userId, ctx.tenantId, projectName);
}

/**
 * @param {string} projectName
 */
export async function resolveFileRootForProjectName(projectName) {
  const workspace = await resolveWorkspaceForProjectName(projectName);
  if (!workspace) return null;
  return resolveFileRootFromWorkspace(
    {
      storageKind: workspace.storageKind,
      syncEnabled: true,
      canonicalProjectKey: workspace.canonicalProjectKey,
      localRootPath: workspace.localRootPath,
      originDeviceId: workspace.originDeviceId,
    },
    null,
  );
}

/**
 * @param {string} projectName
 */
export async function resolveSessionProjectKeyForProjectName(projectName) {
  const workspace = await resolveWorkspaceForProjectName(projectName);
  if (!workspace) return null;
  return resolveSessionProjectKeyFromWorkspace({
    storageKind: workspace.storageKind,
    syncEnabled: true,
    canonicalProjectKey: workspace.canonicalProjectKey,
    localRootPath: workspace.localRootPath,
  });
}

/**
 * Resolve the gateway projectKey for listing/reading transcripts.
 * When sync is on, writes anchor to canonical but legacy chats may still live
 * under the stable project folder until `.cwd` links them (C2).
 * @param {string} projectName
 */
export async function resolveTranscriptProjectKeyForProjectName(projectName) {
  const sessionKey = await resolveSessionProjectKeyForProjectName(projectName);
  if (!sessionKey) return null;

  const ctx = getSaasRequestContext();
  if (!isSaasMode() || !ctx?.tenantPilotHome) return sessionKey;

  const workspace = await resolveWorkspaceForProjectName(projectName);
  if (!workspace) return sessionKey;

  const stableProjectId =
    workspace.legacyProjectId === 'general'
      ? createProjectId(ctx.tenantPilotHome)
      : workspace.legacyProjectId;
  const markerPath = path.join(ctx.tenantPilotHome, 'projects', stableProjectId, '.cwd');

  if (existsSync(markerPath)) {
    try {
      const marker = path.resolve((await fs.readFile(markerPath, 'utf8')).trim());
      if (marker === path.resolve(sessionKey)) {
        return sessionKey;
      }
    } catch {
      /* fall through */
    }
  }

  if (workspace.legacyProjectId === 'general') {
    return ctx.tenantPilotHome;
  }

  const marked = await readMarkedProjectPathsForHome(ctx.tenantPilotHome);
  return marked.get(workspace.legacyProjectId) || sessionKey;
}

/**
 * Extra roots to search when resolving deliverables / previews (legacy agent writes).
 * @param {string} projectName
 */
export async function resolveDeliverableSearchRoots(projectName, options = {}) {
  const ctx = getSaasRequestContext();
  if (!isSaasMode() || !ctx?.tenantPilotHome) {
    const primary = await resolveFileRootForProjectName(projectName);
    return primary ? [primary] : [];
  }

  const allowCrossHub = options.allowCrossHub === true || isDeliverableCrossHubEnabled();
  const primary = await resolveFileRootForProjectName(projectName);
  if (!allowCrossHub) {
    return primary ? [path.resolve(primary)] : [];
  }

  const roots = [];
  const seen = new Set();
  const push = (value) => {
    if (!value || typeof value !== 'string') return;
    const key = path.resolve(value).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    roots.push(path.resolve(value));
  };

  push(await resolveFileRootForProjectName(projectName));
  push(ctx.tenantPilotHome);

  const workspace = await resolveWorkspaceForProjectName(projectName);
  if (workspace?.canonicalProjectKey) {
    push(workspace.canonicalProjectKey);
  }

  // PD-SAAS-FORK: gateway may write to a hub UUID that is not yet linked in PG/.cwd.
  for (const hub of listFilesystemWorkspaceHubsForUser(ctx.tenantId, ctx.userId)) {
    push(hub);
  }

  const workspaces = await listWorkspacesForUser(ctx.userId, ctx.tenantId).catch(() => []);
  for (const ws of workspaces) {
    push(resolveFileRootFromWorkspace(
      {
        storageKind: ws.storageKind,
        syncEnabled: true,
        canonicalProjectKey: ws.canonicalProjectKey,
        localRootPath: ws.localRootPath,
        originDeviceId: ws.originDeviceId,
      },
      null,
    ));
  }

  return roots;
}

const WORKSPACE_HUB_PATH_RE =
  /[\\/]cloud-storage[\\/]users[\\/][^\\/]+[\\/]workspaces[\\/][0-9a-f-]{36}(?:[\\/]|$)/i;

/**
 * Pin agent tool cwd to the UI canonical hub (prevents orphan hub writes when UI omits workspaceCwd).
 * @param {{ projectKey?: string; workspaceCwd?: string; projectName?: string | null }} input
 * @returns {Promise<string | undefined>}
 */
export async function resolveSaasTurnWorkspaceCwd(input) {
  const ctx = getSaasRequestContext();
  if (!isSaasMode() || !ctx?.userId) {
    const trimmed = typeof input.workspaceCwd === 'string' ? input.workspaceCwd.trim() : '';
    return trimmed || undefined;
  }

  const trimmed = typeof input.workspaceCwd === 'string' ? input.workspaceCwd.trim() : '';
  if (trimmed) {
    return trimmed;
  }

  const projectName = typeof input.projectName === 'string' ? input.projectName.trim() : '';
  if (projectName) {
    const fromName = await resolveFileRootForProjectName(projectName);
    if (fromName) {
      return path.resolve(fromName);
    }
  }

  const projectKey = typeof input.projectKey === 'string' ? input.projectKey.trim() : '';
  if (projectKey && WORKSPACE_HUB_PATH_RE.test(projectKey.replace(/\\/g, '/'))) {
    return path.resolve(projectKey);
  }

  return undefined;
}

/**
 * Whether workspace appears in project list for current device.
 * @param {import('./workspaceStore.js').mapRow extends (...args: any) => infer R ? R : never} workspace
 */
export function isWorkspaceVisibleOnDevice(workspace) {
  if (!workspace) return true;
  return true;
}

/**
 * @param {string} absPath
 */
const SAAS_PLATFORM_ADMIN_ROLES = new Set(['super-admin', 'admin']);

/**
 * Whether SaaS UI file mutations (upload/create/rename/delete) must be blocked.
 * Platform admins may manage project files directly; tenant members use chat deliverables.
 */
export function saasBlocksUserFileMutation() {
  if (!isSaasMode()) return false;
  const ctx = getSaasRequestContext();
  if (!ctx?.userId) return false;
  if (ctx.role && SAAS_PLATFORM_ADMIN_ROLES.has(ctx.role)) return false;
  return true;
}

/** PD-SAAS-FORK: allow tenant writes under design canvas board directories. */
const CANVAS_BOARD_ROOT_RE = /(?:^|[\\/])artifacts[\\/]canvas-[^\\/]+(?:[\\/]|$)/i;

export function isDesignCanvasBoardWritePath(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!CANVAS_BOARD_ROOT_RE.test(normalized)) return false;
  if (/(?:^|\/)canvas-manifest\.json$/i.test(normalized)) return true;
  if (/(?:^|\/)assets(?:\/|$)/i.test(normalized)) return true;
  if (/(?:^|\/)diagrams(?:\/|$)/i.test(normalized)) return true;
  if (/(?:^|\/)exports(?:\/|$)/i.test(normalized)) return true;
  return false;
}

/**
 * Whether SaaS should block this specific file mutation path.
 * Design canvas board paths are whitelisted for tenant workspace writes.
 * @param {string} [relativePath]
 */
export function saasBlocksUserFileMutationForPath(relativePath) {
  if (!saasBlocksUserFileMutation()) return false;
  if (relativePath && isDesignCanvasBoardWritePath(relativePath)) return false;
  if (relativePath && isHtmlDeliverableWritePath(relativePath)) return false;
  if (relativePath && isHfStudioWritePath(relativePath)) return false;
  // PD-SAAS-FORK: Bento 右栏编辑保存须允许 *.bento.html 写入
  if (relativePath && isBentoDeckWritePath(relativePath)) return false;
  return true;
}

export async function assertStoragePathAllowed(absPath) {
  if (!isSaasMode()) return absPath;
  const ctx = getSaasRequestContext();
  if (!ctx?.tenantPilotHome || !ctx.userId) return absPath;
  const resolved = path.resolve(absPath);
  const tenantRoot = path.resolve(ctx.tenantPilotHome);
  if (!isPathWithinProjectRoot(resolved, tenantRoot)) {
    const err = new Error('Path is outside tenant boundary.');
    err.code = 'tenant_forbidden';
    throw err;
  }
  if (
    resolved.includes(`${path.sep}cloud-storage${path.sep}`) ||
    resolved.includes(`${path.sep}local-bindings${path.sep}`)
  ) {
    if (!pathContainsUserSegment(resolved, ctx.userId)) {
      const err = new Error('Path is not accessible for the current account.');
      err.code = 'tenant_forbidden';
      throw err;
    }
  }
  return resolved;
}

/**
 * @param {Record<string, unknown>} project
 * @param {Map<string, import('./workspaceStore.js').mapRow extends (...args: any) => infer R ? R : never>} byLegacy
 * @param {{ activeDeviceId: string; syncLocalToCloud: boolean }} fileStorage
 */
function enrichSaasProjectEntry(project, byLegacy) {
  const ws = byLegacy.get(String(project.name));
  if (ws && !isWorkspaceVisibleOnDevice(ws)) {
    return null;
  }
  const fileRoot = ws
    ? resolveFileRootFromWorkspace(
        {
          storageKind: ws.storageKind,
          syncEnabled: true,
          canonicalProjectKey: ws.canonicalProjectKey,
          localRootPath: ws.localRootPath,
          originDeviceId: ws.originDeviceId,
        },
        null,
      )
    : project.fullPath;
  const sessionKey = ws
    ? resolveSessionProjectKeyFromWorkspace({
        storageKind: ws.storageKind,
        syncEnabled: true,
        canonicalProjectKey: ws.canonicalProjectKey,
        localRootPath: ws.localRootPath,
      })
    : project.fullPath;
  return {
    ...project,
    fullPath: fileRoot || project.fullPath,
    path: fileRoot || project.path,
    displayName: resolveWorkspaceDisplayLabel(ws, project),
    sessionProjectKey: sessionKey,
    storageKind: ws?.storageKind ?? 'cloud',
    syncEnabled: true,
    writable: true,
    workspaceUuid: ws?.workspaceUuid,
  };
}

/**
 * Enrich one project entry (e.g. virtual "general").
 * @param {Record<string, unknown>} project
 */
export async function enrichSingleSaasProject(project) {
  if (!isSaasMode()) return project;
  const { ctx } = await getRequestFileStorage();
  if (!ctx?.userId) return project;
  await ensureSaasWorkspacesProvisioned(ctx);
  const workspaces = await listWorkspacesForUser(ctx.userId, ctx.tenantId);
  const byLegacy = new Map(workspaces.map((w) => [w.legacyProjectId, w]));
  return enrichSaasProjectEntry(project, byLegacy) ?? project;
}

/**
 * Enrich project list entries with storage metadata; filter invisible workspaces.
 * @param {Array<Record<string, unknown>>} projects
 */
export async function enrichSaasProjects(projects) {
  if (!isSaasMode()) return projects;
  const { ctx, fileStorage } = await getRequestFileStorage();
  if (!ctx?.userId) return projects;

  await ensureSaasWorkspacesProvisioned(ctx);

  const workspaces = await listWorkspacesForUser(ctx.userId, ctx.tenantId);
  const byLegacy = new Map(workspaces.map((w) => [w.legacyProjectId, w]));

  const enriched = [];
  for (const project of projects) {
    if (
      shouldOmitFromProjectSidebar(
        String(project.name),
        ctx.tenantPilotHome,
        workspaces,
        fileStorage,
      )
    ) {
      continue;
    }
    const entry = enrichSaasProjectEntry(project, byLegacy);
    if (entry) enriched.push(entry);
  }
  return enriched;
}

/**
 * Register SaaS workspace after addProjectManually.
 * @param {{
 *   legacyProjectId: string;
 *   displayName: string;
 *   canonicalProjectKey: string;
 *   localRootPath?: string | null;
 *   storageKind?: 'local' | 'cloud';
 *   syncEnabled?: boolean;
 *   originDeviceId?: string | null;
 * }} input
 */
function slugifyWorkspaceName(displayName) {
  const raw = String(displayName || '')
    .trim()
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return raw.slice(0, 48) || 'workspace';
}

async function allocateLegacyProjectId(ctx, displayName) {
  const base = `workspaces-${slugifyWorkspaceName(displayName)}`;
  let candidate = base;
  let suffix = 2;
  while (await getWorkspaceByLegacyProjectId(ctx.userId, ctx.tenantId, candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

/**
 * PD-SAAS-FORK: one-click SaaS project — name only, cloud hub created server-side.
 * @param {string} displayName
 */
export async function createSaasNamedWorkspace(displayName) {
  const ctx = getSaasRequestContext();
  if (!ctx?.userId || !ctx?.tenantId) {
    throw new Error('SaaS context required');
  }
  const label = String(displayName || '').trim();
  if (!label) {
    throw new Error('displayName is required');
  }

  const plan = await planNewWorkspacePaths(label);
  await fs.mkdir(plan.canonical, { recursive: true });
  const legacyProjectId = await allocateLegacyProjectId(ctx, label);

  await ensureTranscriptMarkerForWorkspace(ctx.tenantPilotHome, {
    legacyProjectId,
    canonicalProjectKey: plan.canonical,
  });

  await registerSaasWorkspace({
    workspaceUuid: plan.workspaceUuid,
    legacyProjectId,
    displayName: label,
    canonicalProjectKey: plan.canonical,
  });

  return {
    name: legacyProjectId,
    displayName: label,
    fullPath: plan.canonical,
    path: plan.canonical,
    sessionProjectKey: plan.canonical,
    storageKind: 'cloud',
    syncEnabled: true,
  };
}

export async function registerSaasWorkspace(input) {
  const ctx = getSaasRequestContext();
  if (!ctx?.userId || !ctx.tenantId) return null;

  const existing = await getWorkspaceByLegacyProjectId(
    ctx.userId,
    ctx.tenantId,
    input.legacyProjectId,
  );
  if (existing) return existing;

  const workspaceUuid = input.workspaceUuid || randomUUID();
  await fs.mkdir(input.canonicalProjectKey, { recursive: true });

  return insertWorkspace({
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    workspaceUuid,
    legacyProjectId: input.legacyProjectId,
    displayName: input.displayName,
    storageKind: 'cloud',
    localRootPath: null,
    canonicalProjectKey: path.resolve(input.canonicalProjectKey),
    originDeviceId: null,
    syncEnabled: true,
  });
}

/**
 * Build paths for a new workspace (SaaS create-workspace).
 */
export async function planNewWorkspacePaths(_displayName) {
  const { ctx } = await getRequestFileStorage();
  if (!ctx?.userId || !ctx?.tenantId) {
    throw new Error('SaaS context required');
  }
  const workspaceUuid = randomUUID();
  const canonical = getCanonicalHubRoot(ctx.tenantId, ctx.userId, workspaceUuid);
  return {
    workspaceUuid,
    canonical,
    localRoot: null,
    storageKind: 'cloud',
    syncEnabled: true,
    originDeviceId: null,
  };
}

export async function getStorageStatus() {
  if (!isSaasMode()) {
    return { mode: 'single-user', storageHint: null };
  }
  const { ctx, fileStorage } = await getRequestFileStorage();
  if (!ctx?.userId) {
    return { mode: 'saas', storageHint: null };
  }

  await ensureSaasWorkspacesProvisioned(ctx);

  const workspaces = await listWorkspacesForUser(ctx.userId, ctx.tenantId);
  const userProjects = workspaces.filter((ws) => isUserCreatedSaasProject(ws.legacyProjectId, ws));

  return {
    mode: 'cloud-only',
    fileStorage,
    workspaceCount: workspaces.length,
    visibleCount: userProjects.length,
    storageHint: userProjects.length === 0 ? 'no_workspaces' : null,
    migrationVersion: fileStorage.migrationVersion,
    oss: saasOssStatusSummary(),
  };
}

/**
 * PD-SAAS-FORK: post-login reconcile — auto-provision cloud hubs (no local sync).
 */
export async function reconcileStorageForCurrentUser() {
  if (!isSaasMode()) {
    return { ok: true, reconciled: false, reason: 'not_saas' };
  }
  const { ctx } = await getRequestFileStorage();
  if (!ctx?.userId) {
    return { ok: false, reconciled: false, reason: 'no_context' };
  }

  const { provisioned } = await ensureSaasWorkspacesProvisioned(ctx);
  /** @type {{ uploaded?: number; skipped?: number; errors?: Array<{ path: string; error: string }> } | null} */
  let ossMirror = null;
  if (isSaasOssActive()) {
    const userRoot = getUserCloudStorageRoot(ctx.tenantId, ctx.userId);
    ossMirror = await mirrorDirectoryToOss(userRoot);
  }
  const status = await getStorageStatus();

  return {
    ok: true,
    reconciled: true,
    changed: Number(provisioned) > 0,
    provisioned,
    ossMirror,
    status,
    chats: { mode: 'server_authoritative' },
  };
}
