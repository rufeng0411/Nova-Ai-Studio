/**
 * PD-SAAS-FORK: resolve task folder navigation target for rail / files tab.
 */
import type { Project } from '../types/app';
import type { DeliverableItem } from './collectDeliverables';
import { getArtifactDirectory } from './artifactPaths';
import { resolveTaskFolderLocation } from './pickPrimaryDeliverable';
import { resolveDeliverablePath } from './resolveDeliverablePath';

export type TaskFolderNavigationTarget = {
  filePath: string;
  folderPath?: string;
  id: number;
  hintDir?: string;
};

function normalizeFolderPath(path: string | null | undefined): string {
  return String(path ?? '').replace(/\\/g, '/').trim().replace(/\/+$/, '');
}

function enrichItemsWithHint(items: DeliverableItem[], hintDir?: string): DeliverableItem[] {
  if (!hintDir) return items;
  return items.map((item) => ({
    ...item,
    turnArtifactDir: item.turnArtifactDir ?? hintDir,
  }));
}

export async function resolveTaskFolderNavigation(
  items: DeliverableItem[],
  selectedProject: Pick<Project, 'name' | 'fullPath' | 'path'>,
  nextId: number,
): Promise<TaskFolderNavigationTarget | null> {
  const location = resolveTaskFolderLocation(items);
  if (!location?.filePath) return null;

  let resolvedPath = location.filePath.replace(/\\/g, '/').trim();
  const turnArtifactDir = items.find((item) => item.turnArtifactDir)?.turnArtifactDir;

  try {
    const resolved = await resolveDeliverablePath({
      projectName: selectedProject.name,
      path: location.filePath,
      turnArtifactDir,
      projectRoot: selectedProject.fullPath || selectedProject.path,
    });
    if (resolved?.relativePath && !resolved.ambiguous) {
      resolvedPath = resolved.relativePath.replace(/\\/g, '/').trim();
    }
  } catch {
    // If resolve API is temporarily unavailable, still navigate to best-known folder.
  }

  const folderPath = normalizeFolderPath(getArtifactDirectory(resolvedPath))
    || normalizeFolderPath(location.folderPath)
    || normalizeFolderPath(turnArtifactDir);

  return {
    filePath: resolvedPath,
    folderPath: folderPath || undefined,
    id: nextId,
    hintDir: turnArtifactDir ?? folderPath,
  };
}

type DockFolderHint = {
  folderItems?: DeliverableItem[];
  folderPath?: string | null;
  turnArtifactDir?: string;
};

/** Resolve task folder nav from deliverable items, falling back to session dock folder hints. */
export async function resolveTaskFolderNavigationWithDockFallback(
  items: DeliverableItem[],
  dockState: DockFolderHint | null | undefined,
  selectedProject: Pick<Project, 'name' | 'fullPath' | 'path'>,
  nextId: number,
): Promise<TaskFolderNavigationTarget | null> {
  const hintDir = normalizeFolderPath(
    items.find((item) => item.turnArtifactDir)?.turnArtifactDir
    ?? dockState?.turnArtifactDir,
  ) || undefined;
  const dockFolder = normalizeFolderPath(dockState?.folderPath) || hintDir || '';

  const merged = items.length > 0
    ? enrichItemsWithHint(items, hintDir)
    : enrichItemsWithHint(dockState?.folderItems ?? [], hintDir);

  if (merged.length > 0) {
    const resolved = await resolveTaskFolderNavigation(merged, selectedProject, nextId);
    if (resolved) {
      const folderPath = dockFolder
        || normalizeFolderPath(resolved.folderPath)
        || hintDir;
      return {
        ...resolved,
        folderPath: folderPath || resolved.folderPath,
        hintDir: hintDir ?? folderPath ?? resolved.hintDir,
        id: nextId,
      };
    }
  }

  if (dockFolder) {
    return {
      filePath: dockFolder,
      folderPath: dockFolder,
      id: nextId,
      hintDir: hintDir ?? dockFolder,
    };
  }

  return null;
}

export function buildOptimisticTaskFolderTarget(
  items: DeliverableItem[],
  dockState: DockFolderHint | null | undefined,
  nextId: number,
): TaskFolderNavigationTarget | null {
  const hintDir = normalizeFolderPath(
    items.find((item) => item.turnArtifactDir)?.turnArtifactDir
    ?? dockState?.turnArtifactDir,
  ) || undefined;
  const dockFolder = normalizeFolderPath(dockState?.folderPath) || hintDir || '';

  const merged = items.length > 0
    ? enrichItemsWithHint(items, hintDir)
    : enrichItemsWithHint(dockState?.folderItems ?? [], hintDir);

  const location = merged.length > 0 ? resolveTaskFolderLocation(merged) : null;
  const filePath = location?.filePath
    ?? merged[0]?.resolvedPath
    ?? merged[0]?.apiPath
    ?? merged[0]?.path
    ?? dockFolder;

  const folderPath = dockFolder
    || normalizeFolderPath(location?.folderPath)
    || normalizeFolderPath(getArtifactDirectory(filePath))
    || hintDir;

  if (!filePath && !folderPath) return null;

  return {
    filePath: filePath || folderPath,
    folderPath: folderPath || undefined,
    id: nextId,
    hintDir: hintDir ?? folderPath,
  };
}

type SessionFolderDockHint = {
  sessionId?: string | null;
  folderItems?: DeliverableItem[];
  folderPath?: string | null;
  turnArtifactDir?: string;
};

/**
 * Resolve the folder tree scope for the active session.
 * Explicit navigation wins; otherwise derive from session dock hints.
 * Never falls back to project root.
 */
export function resolveEffectiveTaskFolderNavigationTarget(input: {
  explicitTarget: TaskFolderNavigationTarget | null | undefined;
  dockState: SessionFolderDockHint | null | undefined;
  selectedSessionId: string | null | undefined;
  navId?: number;
}): TaskFolderNavigationTarget | null {
  if (input.explicitTarget) {
    return input.explicitTarget;
  }
  const sessionId = input.selectedSessionId ?? null;
  if (!sessionId || !input.dockState) return null;
  if (input.dockState.sessionId != null && input.dockState.sessionId !== sessionId) {
    return null;
  }
  return buildOptimisticTaskFolderTarget(
    input.dockState.folderItems ?? [],
    input.dockState,
    input.navId ?? 0,
  );
}

