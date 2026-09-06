// PD-SAAS-FORK: pick primary deliverable and resolve task folder for sidebar navigation
import type { DeliverableItem } from './collectDeliverables';
import { sortDeliverables } from './collectDeliverables';
import { getArtifactDirectory, getArtifactFileName } from './artifactPaths';
import { inferTurnArtifactDirectory } from './reconcileTurnDeliverables';
import { presentationDeliverableSortScore } from './presentationDeliverablePolicy';

export type TaskFolderLocation = {
  filePath: string;
  folderPath: string;
};
export function extractDeliverableLeadingIndex(fileName: string): number | null {
  const base = fileName.replace(/\.[^.]+$/, '').trim();
  const bracket = base.match(/^\[(\d+)\]/);
  if (bracket) {
    const value = Number(bracket[1]);
    return Number.isFinite(value) ? value : null;
  }
  const prefix = base.match(/^(\d+)[-_.\s]/);
  if (prefix) {
    const value = Number(prefix[1]);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

/** Pick the primary deliverable for folder navigation (sorted, then index 0/1, else first). */
export function pickPrimaryDeliverableFile(items: DeliverableItem[]): DeliverableItem | null {
  const files = sortDeliverables(items.filter((item) => item.kind !== 'url'));
  if (files.length === 0) return null;

  const turnDir =
    items.find((item) => item.turnArtifactDir)?.turnArtifactDir
    ?? inferTurnArtifactDirectory(items);
  if (turnDir) {
    const inTurn = files.filter(
      (item) => getArtifactDirectory(item.apiPath || item.path) === turnDir,
    );
    if (inTurn.length > 0) {
      const toolFirst = sortDeliverables(inTurn.filter((item) => item.source === 'tool'));
      if (toolFirst.length > 0) {
        return [...toolFirst].sort(
          (a, b) => presentationDeliverableSortScore(b) - presentationDeliverableSortScore(a),
        )[0];
      }
      return [...sortDeliverables(inTurn)].sort(
        (a, b) => presentationDeliverableSortScore(b) - presentationDeliverableSortScore(a),
      )[0];
    }
  }

  if (files.length === 1) return files[0];

  const numbered = files
    .map((item) => ({
      item,
      index: extractDeliverableLeadingIndex(getArtifactFileName(item.apiPath || item.path)),
    }))
    .filter((entry): entry is { item: DeliverableItem; index: number } => entry.index !== null);

  const preferred = numbered.find((entry) => entry.index === 0 || entry.index === 1);
  if (preferred) return preferred.item;

  return files[0];
}

export function resolveTaskFolderLocation(items: DeliverableItem[]): TaskFolderLocation | null {
  const primary = pickPrimaryDeliverableFile(items);
  if (!primary) return null;
  const filePath = (primary.apiPath || primary.path).replace(/\\/g, '/').trim();
  if (!filePath) return null;
  const folderPath = getArtifactDirectory(filePath);
  return { filePath, folderPath };
}
