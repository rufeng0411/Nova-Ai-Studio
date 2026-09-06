/**
 * PD-SAAS-FORK: cloud workspace lifecycle (Phase 2 cloud-only).
 * - migrationVersion < 2: one-time local `.cwd` → cloud-storage hub copy
 * - migrationVersion >= 2: no re-scan of local folders; only repair registered hubs
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getUserPreferences, updateUserPreferences } from '../userPreferences.js';
import { readMarkedProjectPathsForHome } from '../tenant/projectList.js';
import { createProjectId } from '../../utils/pilotPaths.js';
import { getCanonicalHubRoot, getUserCloudStorageRoot } from './paths.js';
import {
  getWorkspaceByLegacyProjectId,
  getWorkspaceByUuid,
  insertWorkspace,
  listWorkspacesForUser,
  updateWorkspaceDisplayName,
} from './workspaceStore.js';

function isWorkspaceUniqueViolation(error) {
  const message = String(error?.message || error || '');
  return (
    message.includes('user_workspaces_tenant_id_user_id_workspace_uuid_key')
    || message.includes('user_workspaces_tenant_id_user_id_legacy_project_id_key')
    || message.includes('UNIQUE constraint failed: user_workspaces')
  );
}

/**
 * PD-SAAS-FORK: cloud hub UUID is globally unique per user; skip duplicate inserts
 * when legacy slug dirs repoint at an already-registered hub.
 */
async function registerWorkspaceIfAbsent(ctx, record) {
  const existingByUuid = await getWorkspaceByUuid(
    ctx.userId,
    ctx.tenantId,
    record.workspaceUuid,
  );
  if (existingByUuid) {
    if (existingByUuid.legacyProjectId !== record.legacyProjectId) {
      console.warn(
        `[saas] workspace uuid ${record.workspaceUuid} already registered as ${existingByUuid.legacyProjectId}; skip duplicate for ${record.legacyProjectId}`,
      );
    }
    await ensureTranscriptMarkerForWorkspace(ctx.tenantPilotHome, {
      legacyProjectId: record.legacyProjectId,
      canonicalProjectKey: existingByUuid.canonicalProjectKey,
    });
    return false;
  }

  const existingByLegacy = await getWorkspaceByLegacyProjectId(
    ctx.userId,
    ctx.tenantId,
    record.legacyProjectId,
  );
  if (existingByLegacy) {
    return false;
  }

  try {
    await insertWorkspace(record);
    return true;
  } catch (error) {
    if (isWorkspaceUniqueViolation(error)) {
      console.warn(
        `[saas] workspace insert skipped (${record.legacyProjectId}):`,
        error instanceof Error ? error.message : error,
      );
      return false;
    }
    throw error;
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function looksLikeWorkspaceUuid(value) {
  if (!value || typeof value !== 'string') return false;
  const base = path.basename(value.replace(/\\/g, '/'));
  return UUID_RE.test(base);
}

function parseFileStoragePrefs(fileStorage) {
  const raw = fileStorage ?? {};
  const cloudOnly = raw.cloudOnly !== false;
  const migrationVersion =
    typeof raw.migrationVersion === 'number' ? raw.migrationVersion : 2;
  return {
    cloudOnly,
    migrationVersion,
    isCloudOnlyCutover: cloudOnly && migrationVersion >= 2,
  };
}

function isUnderCloudStorageRoot(cloudRoot, absPath) {
  const root = path.resolve(cloudRoot);
  const resolved = path.resolve(absPath);
  return resolved === root || resolved.startsWith(`${root}${path.sep}`);
}

/**
 * PD-SAAS-FORK: link canonical session anchor to the stable transcript folder
 * (C2 — keep legacy project id, only repoint `.cwd`).
 * @param {string} tenantPilotHome
 * @param {{ legacyProjectId: string; canonicalProjectKey: string }} workspace
 */
export async function ensureTranscriptMarkerForWorkspace(tenantPilotHome, workspace) {
  if (!tenantPilotHome || !workspace?.canonicalProjectKey) return;
  const stableProjectId =
    workspace.legacyProjectId === 'general'
      ? createProjectId(tenantPilotHome)
      : workspace.legacyProjectId;
  const projectDir = path.join(tenantPilotHome, 'projects', stableProjectId);
  const markerPath = path.join(projectDir, '.cwd');
  const canonical = path.resolve(workspace.canonicalProjectKey);
  await fs.mkdir(projectDir, { recursive: true });
  try {
    const existing = (await fs.readFile(markerPath, 'utf8')).trim();
    if (path.resolve(existing) === canonical) {
      return;
    }
  } catch {
    /* write below */
  }
  await fs.writeFile(markerPath, `${canonical}\n`, 'utf8');
}

async function ensureAllTranscriptMarkers(ctx) {
  const workspaces = await listWorkspacesForUser(ctx.userId, ctx.tenantId);
  for (const ws of workspaces) {
    await ensureTranscriptMarkerForWorkspace(ctx.tenantPilotHome, ws);
  }
}

/**
 * PD-SAAS-FORK: agent turns that ran before workspaceCwd fix wrote under
 * `<tenantPilotHome>/artifacts`. Hoist into the general canonical hub.
 */
export async function migrateLooseTenantArtifacts(ctx) {
  const looseArtifacts = path.join(ctx.tenantPilotHome, 'artifacts');
  let entries;
  try {
    entries = await fs.readdir(looseArtifacts, { withFileTypes: true });
  } catch {
    return { migrated: 0 };
  }
  if (entries.length === 0) {
    return { migrated: 0 };
  }

  const workspaces = await listWorkspacesForUser(ctx.userId, ctx.tenantId);
  const general = workspaces.find((w) => w.legacyProjectId === 'general');
  if (!general?.canonicalProjectKey) {
    return { migrated: 0 };
  }

  const targetArtifacts = path.join(general.canonicalProjectKey, 'artifacts');
  await fs.mkdir(targetArtifacts, { recursive: true });

  let migrated = 0;
  for (const entry of entries) {
    const from = path.join(looseArtifacts, entry.name);
    const to = path.join(targetArtifacts, entry.name);
    try {
      await fs.cp(from, to, { recursive: true, force: true });
      migrated += 1;
    } catch {
      /* best effort */
    }
  }
  return { migrated };
}

/** Ensure every registered workspace has its canonical hub directory (same UUID, no new hub). */
async function ensureExistingWorkspaceHubs(ctx) {
  const workspaces = await listWorkspacesForUser(ctx.userId, ctx.tenantId);
  for (const ws of workspaces) {
    if (!ws.canonicalProjectKey) continue;
    await fs.mkdir(ws.canonicalProjectKey, { recursive: true });
  }
}

async function ensureGeneralWorkspace(ctx) {
  const workspaces = await listWorkspacesForUser(ctx.userId, ctx.tenantId);
  if (workspaces.some((w) => w.legacyProjectId === 'general')) {
    return false;
  }

  const workspaceUuid = randomUUID();
  const canonical = getCanonicalHubRoot(ctx.tenantId, ctx.userId, workspaceUuid);
  await fs.mkdir(canonical, { recursive: true });

  const inserted = await registerWorkspaceIfAbsent(ctx, {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    workspaceUuid,
    legacyProjectId: 'general',
    displayName: 'general',
    storageKind: 'cloud',
    localRootPath: null,
    canonicalProjectKey: canonical,
    originDeviceId: null,
    syncEnabled: true,
  });
  if (!inserted) {
    return false;
  }

  await ensureTranscriptMarkerForWorkspace(ctx.tenantPilotHome, {
    legacyProjectId: 'general',
    canonicalProjectKey: canonical,
  });
  return true;
}

/**
 * Re-link a workspace DB row when `.cwd` already points at an existing cloud hub.
 * Avoids minting a new UUID directory after cloud-only cutover.
 */
async function recoverWorkspaceFromCloudMarker(ctx, legacyProjectId, canonicalPath) {
  const canonical = path.resolve(canonicalPath);
  const workspaceUuid = path.basename(canonical);
  if (!looksLikeWorkspaceUuid(workspaceUuid)) {
    return false;
  }

  await fs.mkdir(canonical, { recursive: true });
  const inserted = await registerWorkspaceIfAbsent(ctx, {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    workspaceUuid,
    legacyProjectId,
    displayName:
      legacyProjectId === 'general'
        ? 'general'
        : legacyProjectId.startsWith('workspaces-')
          ? legacyProjectId.slice('workspaces-'.length)
          : path.basename(canonical) || legacyProjectId,
    storageKind: 'cloud',
    localRootPath: null,
    canonicalProjectKey: canonical,
    originDeviceId: null,
    syncEnabled: true,
  });
  if (!inserted) {
    return false;
  }

  await ensureTranscriptMarkerForWorkspace(ctx.tenantPilotHome, {
    legacyProjectId,
    canonicalProjectKey: canonical,
  });
  return true;
}

async function provisionLegacyLocalMarker(ctx, legacyProjectId, cwd) {
  const workspaceUuid = randomUUID();
  const canonical = getCanonicalHubRoot(ctx.tenantId, ctx.userId, workspaceUuid);

  await fs.mkdir(canonical, { recursive: true });
  try {
    await fs.access(cwd);
    await fs.cp(cwd, canonical, { recursive: true, force: true });
  } catch {
    /* empty hub */
  }

  const inserted = await registerWorkspaceIfAbsent(ctx, {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    workspaceUuid,
    legacyProjectId,
    displayName: legacyProjectId === 'general' ? 'general' : path.basename(cwd) || legacyProjectId,
    storageKind: 'cloud',
    localRootPath: null,
    canonicalProjectKey: canonical,
    originDeviceId: null,
    syncEnabled: true,
  });
  if (!inserted) {
    return false;
  }

  await ensureTranscriptMarkerForWorkspace(ctx.tenantPilotHome, {
    legacyProjectId,
    canonicalProjectKey: canonical,
  });
  return true;
}

async function repairUserWorkspaceDisplayNames(ctx) {
  const workspaces = await listWorkspacesForUser(ctx.userId, ctx.tenantId);
  for (const ws of workspaces) {
    if (!ws.legacyProjectId.startsWith('workspaces-')) continue;
    if (!looksLikeWorkspaceUuid(ws.displayName)) continue;
    const label = ws.legacyProjectId.slice('workspaces-'.length);
    if (label && label !== ws.displayName) {
      await updateWorkspaceDisplayName(ws.id, label);
    }
  }
}

async function countJsonlSessionsInChatsDir(chatsDir) {
  try {
    const files = await fs.readdir(chatsDir);
    return files.filter((name) => name.endsWith('.jsonl')).length;
  } catch {
    return 0;
  }
}

function suggestRecoveredLegacyProjectId(workspaceUuid, existingIds) {
  const short = workspaceUuid.split('-')[0];
  let candidate = `workspaces-${short}`;
  if (!existingIds.has(candidate)) {
    return candidate;
  }
  let suffix = 2;
  while (existingIds.has(`${candidate}-${suffix}`)) {
    suffix += 1;
  }
  return `${candidate}-${suffix}`;
}

/**
 * PD-SAAS-FORK: cloud hub reprovision can leave transcripts under slug dirs with no
 * workspace row or stable `.cwd` marker — recover them into the sidebar.
 */
async function migrateOrphanSlugTranscripts(tenantPilotHome, canonicalProjectKey, legacyProjectId) {
  const orphanSlug = createProjectId(path.resolve(canonicalProjectKey));
  const fromChats = path.join(tenantPilotHome, 'projects', orphanSlug, 'chats');
  const stableProjectId =
    legacyProjectId === 'general' ? createProjectId(tenantPilotHome) : legacyProjectId;
  const toChats = path.join(tenantPilotHome, 'projects', stableProjectId, 'chats');
  let files;
  try {
    files = await fs.readdir(fromChats);
  } catch {
    return 0;
  }

  await fs.mkdir(toChats, { recursive: true });
  let moved = 0;
  for (const fileName of files) {
    if (!fileName.endsWith('.jsonl')) continue;
    const from = path.join(fromChats, fileName);
    const to = path.join(toChats, fileName);
    try {
      await fs.access(to);
      continue;
    } catch {
      /* destination missing — move below */
    }
    try {
      await fs.rename(from, to);
    } catch {
      try {
        await fs.copyFile(from, to);
        await fs.unlink(from);
      } catch {
        continue;
      }
    }
    moved += 1;
  }
  return moved;
}

async function recoverOrphanCloudTranscriptHubs(ctx) {
  const cloudRoot = path.join(getUserCloudStorageRoot(ctx.tenantId, ctx.userId), 'workspaces');
  let entries;
  try {
    entries = await fs.readdir(cloudRoot, { withFileTypes: true });
  } catch {
    return 0;
  }

  const workspaces = await listWorkspacesForUser(ctx.userId, ctx.tenantId);
  const registeredPaths = new Set(
    workspaces.map((ws) => path.resolve(ws.canonicalProjectKey).toLowerCase()),
  );
  const existingIds = new Set(workspaces.map((ws) => ws.legacyProjectId));
  let recovered = 0;

  for (const entry of entries) {
    if (!entry.isDirectory() || !looksLikeWorkspaceUuid(entry.name)) continue;
    const canonical = path.join(cloudRoot, entry.name);
    const canonicalKey = path.resolve(canonical).toLowerCase();
    if (registeredPaths.has(canonicalKey)) continue;

    const orphanSlug = createProjectId(canonical);
    const orphanChats = path.join(ctx.tenantPilotHome, 'projects', orphanSlug, 'chats');
    const sessionCount = await countJsonlSessionsInChatsDir(orphanChats);
    if (sessionCount === 0) continue;

    const legacyProjectId = suggestRecoveredLegacyProjectId(entry.name, existingIds);
    existingIds.add(legacyProjectId);
    registeredPaths.add(canonicalKey);

    await fs.mkdir(canonical, { recursive: true });
    const inserted = await registerWorkspaceIfAbsent(ctx, {
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      workspaceUuid: entry.name,
      legacyProjectId,
      displayName: entry.name.split('-')[0],
      storageKind: 'cloud',
      localRootPath: null,
      canonicalProjectKey: canonical,
      originDeviceId: null,
      syncEnabled: true,
    });
    if (!inserted) {
      continue;
    }

    await ensureTranscriptMarkerForWorkspace(ctx.tenantPilotHome, {
      legacyProjectId,
      canonicalProjectKey: canonical,
    });
    const moved = await migrateOrphanSlugTranscripts(
      ctx.tenantPilotHome,
      canonical,
      legacyProjectId,
    );
    console.log(
      `[saas] recovered orphan transcript hub ${entry.name} → ${legacyProjectId} (${sessionCount} sessions, moved ${moved})`,
    );
    recovered += 1;
  }

  return recovered;
}

/**
 * @param {{ userId: number; tenantId: string; tenantPilotHome: string }} ctx
 */
export async function ensureSaasWorkspacesProvisioned(ctx) {
  if (!ctx?.userId || !ctx?.tenantId || !ctx?.tenantPilotHome) {
    return { provisioned: 0 };
  }

  const prefs = await getUserPreferences(ctx.userId);
  const fileStorage = prefs?.fileStorage ?? {};
  const { isCloudOnlyCutover } = parseFileStoragePrefs(fileStorage);

  let provisioned = 0;
  if (await ensureGeneralWorkspace(ctx)) {
    provisioned += 1;
  }

  const marked = await readMarkedProjectPathsForHome(ctx.tenantPilotHome);
  marked.set('general', path.resolve(ctx.tenantPilotHome));

  let existing = await listWorkspacesForUser(ctx.userId, ctx.tenantId);
  const existingIds = new Set(existing.map((w) => w.legacyProjectId));
  const tenantEncodedId = createProjectId(ctx.tenantPilotHome);
  const cloudRoot = getUserCloudStorageRoot(ctx.tenantId, ctx.userId);

  for (const [legacyProjectId, cwd] of marked.entries()) {
    if (existingIds.has(legacyProjectId)) continue;
    if (legacyProjectId !== 'general' && legacyProjectId === tenantEncodedId) {
      continue;
    }

    const resolvedCwd = path.resolve(cwd);
    const pointsAtCloud = isUnderCloudStorageRoot(cloudRoot, resolvedCwd);

    if (isCloudOnlyCutover) {
      // Cloud-only: never copy from local disk again. Recover DB rows for cloud hubs only.
      if (pointsAtCloud && looksLikeWorkspaceUuid(resolvedCwd)) {
        if (await recoverWorkspaceFromCloudMarker(ctx, legacyProjectId, resolvedCwd)) {
          existingIds.add(legacyProjectId);
          provisioned += 1;
        }
      }
      continue;
    }

    if (await provisionLegacyLocalMarker(ctx, legacyProjectId, resolvedCwd)) {
      existingIds.add(legacyProjectId);
      provisioned += 1;
    }
  }

  await ensureExistingWorkspaceHubs(ctx);
  const recoveredOrphans = await recoverOrphanCloudTranscriptHubs(ctx);
  if (recoveredOrphans > 0) {
    provisioned += recoveredOrphans;
  }
  await ensureAllTranscriptMarkers(ctx);

  if (!isCloudOnlyCutover) {
    await migrateLooseTenantArtifacts(ctx);
  }

  if (provisioned > 0 || (fileStorage.migrationVersion ?? 0) < 2) {
    await updateUserPreferences(ctx.userId, {
      fileStorage: {
        ...fileStorage,
        cloudOnly: true,
        migrationVersion: 2,
      },
    });
  }

  await repairUserWorkspaceDisplayNames(ctx);

  return { provisioned };
}
