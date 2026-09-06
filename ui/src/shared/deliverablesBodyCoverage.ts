// PD-SAAS-FORK: detect when assistant prose already lists final deliverable paths
import type { DeliverableItem } from './collectDeliverables';
import {
  extractDeliverablePathsFromText,
  getArtifactFileName,
  normalizeArtifactPath,
} from './artifactPaths';

function norm(path: string): string {
  return normalizeArtifactPath(path).toLowerCase();
}

function pathsReferToSameFile(bodyPath: string, itemPath: string): boolean {
  const a = norm(bodyPath);
  const b = norm(itemPath);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.endsWith(`/${b}`) || b.endsWith(`/${a}`)) return true;
  const aBase = getArtifactFileName(a).toLowerCase();
  const bBase = getArtifactFileName(b).toLowerCase();
  return Boolean(aBase) && aBase === bBase;
}

export type DeliverablesBodyCoverage = {
  fileItemCount: number;
  mentionedInBodyCount: number;
  /** Every local deliverable path appears in assistant text (clickable list redundant with panel). */
  bodyListsAllFiles: boolean;
};

/** Whether assistant markdown already names every final deliverable file. */
export function assessDeliverablesBodyCoverage(
  assistantText: string,
  items: DeliverableItem[],
): DeliverablesBodyCoverage {
  const fileItems = items.filter((item) => item.kind !== 'url');
  const extracted = extractDeliverablePathsFromText(assistantText || '');
  let mentionedInBodyCount = 0;
  for (const item of fileItems) {
    const itemPath = item.apiPath || item.path;
    const hit = extracted.some((bodyPath) => pathsReferToSameFile(bodyPath, itemPath));
    if (hit) mentionedInBodyCount += 1;
  }
  const bodyListsAllFiles =
    fileItems.length > 0 && mentionedInBodyCount >= fileItems.length;
  return {
    fileItemCount: fileItems.length,
    mentionedInBodyCount,
    bodyListsAllFiles,
  };
}
