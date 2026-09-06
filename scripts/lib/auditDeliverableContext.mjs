/**
 * PD-SAAS-FORK: Lightweight project root resolution for offline audit scripts (no projects.js).
 */
import fs from 'node:fs';
import path from 'node:path';
import { getTenantPilotHome } from '../../ui/server/saas/tenant/paths.js';
import { listFilesystemWorkspaceHubsForUser } from '../../ui/server/saas/storage/paths.js';
import { resolveProjectDeliverableFile } from '../../ui/server/utils/pathInProject.js';
import { deliverableResolveMatchesRequest, isNonUserDeliverablePath } from '../../ui/shared/deliverablePathResolve.mjs';

/**
 * @param {string} tenantId
 * @param {string} legacyProjectId
 */
export function resolveLegacyProjectRoot(tenantId, legacyProjectId) {
  const pilotHome = getTenantPilotHome(tenantId);
  const projectDir = path.join(pilotHome, 'projects', legacyProjectId);
  const cwdFile = path.join(projectDir, '.cwd');
  try {
    if (fs.existsSync(cwdFile)) {
      const root = fs.readFileSync(cwdFile, 'utf8').trim();
      if (root) return root;
    }
  } catch {
    // fall through
  }
  return projectDir;
}

/**
 * @param {string} projectRoot
 * @param {string} tenantId
 * @param {number | string} [userId=1]
 */
export function deliverableSearchRoots(projectRoot, tenantId, userId = 1) {
  const pilotHome = getTenantPilotHome(tenantId);
  const seen = new Set();
  const roots = [];
  for (const candidate of [projectRoot, pilotHome]) {
    if (!candidate) continue;
    const key = path.resolve(candidate).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    roots.push(path.resolve(candidate));
  }
  for (const hub of listFilesystemWorkspaceHubsForUser(tenantId, userId)) {
    const key = path.resolve(hub).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    roots.push(path.resolve(hub));
  }
  return roots;
}

/**
 * @param {string} projectRoot
 * @param {string[]} knownRoots
 * @param {string[]} paths
 * @param {string | undefined} hintDir
 */
export async function validatePathsForAudit(projectRoot, knownRoots, paths, hintDir) {
  const items = [];
  for (const filePath of paths) {
    if (isNonUserDeliverablePath(filePath)) {
      items.push({ path: filePath, status: 'broken' });
      continue;
    }
    const resolved = resolveProjectDeliverableFile(
      projectRoot,
      filePath,
      knownRoots,
      hintDir ? { hintDir } : {},
    );
    if (!resolved.ok) {
      items.push({ path: filePath, status: 'broken' });
      continue;
    }
    let sizeBytes = 0;
    try {
      sizeBytes = fs.statSync(resolved.absolutePath).size;
    } catch {
      items.push({ path: filePath, status: 'broken', resolvedPath: resolved.relativePath });
      continue;
    }
    if (sizeBytes === 0) {
      items.push({ path: filePath, status: 'pending', resolvedPath: resolved.relativePath, sizeBytes: 0 });
      continue;
    }
    if (!deliverableResolveMatchesRequest(filePath, resolved.relativePath)) {
      items.push({ path: filePath, status: 'broken', resolvedPath: resolved.relativePath, mismatch: true });
      continue;
    }
    if (isNonUserDeliverablePath(resolved.relativePath)) {
      items.push({ path: filePath, status: 'broken', resolvedPath: resolved.relativePath, mismatch: true });
      continue;
    }
    items.push({
      path: filePath,
      status: 'verified',
      resolvedPath: resolved.relativePath,
      sizeBytes,
    });
  }
  return { items };
}
