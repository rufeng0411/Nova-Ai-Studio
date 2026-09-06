/**
 * PD-SAAS-FORK: open session deliverables dock row in right-rail preview.
 */
import type { FileOpenOptions } from '../components/code-editor/utils/fileOpen';
import type { DeliverableDockRow } from './buildDeliverableDockRows';
import { scopeDeliverablePathToTurnDir } from './artifactPaths';
import { shouldSkipDeliverablePathResolve } from './deliverablePreviewFastPath';
import { buildBentoFileOpenOptions } from './bentoStudioDock';

export function resolveDockRowOpenPath(
  row: DeliverableDockRow,
  turnArtifactDir?: string | null,
): string | undefined {
  const path = row.resolvedPath || row.apiPath || row.path;
  if (typeof path !== 'string' || !path.trim()) return undefined;
  return scopeDeliverablePathToTurnDir(path.trim(), turnArtifactDir);
}

export function canOpenDeliverableDockRow(row: DeliverableDockRow): boolean {
  const path = resolveDockRowOpenPath(row);
  if (!path) return false;
  if (row.linkable) return true;
  if (row.status === 'delivered') return true;
  return path.includes('/') || path.includes('artifacts');
}

export function buildDockRowOpenOptions(
  row: DeliverableDockRow,
  turnArtifactDir?: string | null,
): FileOpenOptions {
  const path = resolveDockRowOpenPath(row, turnArtifactDir);
  const hintDir = turnArtifactDir ?? undefined;
  const fileName = path?.split('/').pop() || path || '';
  const bentoOptions = path
    ? buildBentoFileOpenOptions(fileName, path, { hintDir })
    : undefined;
  return {
    initialPreview: row.previewable !== false,
    ...(hintDir ? { hintDir } : {}),
    skipResolve: path ? shouldSkipDeliverablePathResolve(path, hintDir) : false,
    ...(bentoOptions ?? {}),
  };
}
