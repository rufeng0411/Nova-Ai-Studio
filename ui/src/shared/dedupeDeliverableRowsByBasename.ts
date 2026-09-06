/** PD-SAAS-FORK: collapse duplicate SDM/summary rows that resolve to the same basename (f845 class). */
import { posixBasename } from '../../../src/saas/deliverables/sdmSlotMatching';
import type { DeliverableDockRow } from './buildDeliverableDockRows';
import { normalizeArtifactPath } from './artifactPaths';

const STATUS_RANK: Record<DeliverableDockRow['status'], number> = {
  delivered: 5,
  needContinue: 4,
  checking: 3,
  missing: 2,
  broken: 1,
  hidden: 0,
};

function rowBasename(row: DeliverableDockRow): string {
  const path = row.resolvedPath || row.apiPath || row.path || '';
  return posixBasename(normalizeArtifactPath(path) || path).toLowerCase();
}

function pickPreferredRow(
  current: DeliverableDockRow,
  candidate: DeliverableDockRow,
): DeliverableDockRow {
  const currentRank = STATUS_RANK[current.status] ?? 0;
  const candidateRank = STATUS_RANK[candidate.status] ?? 0;
  if (candidateRank > currentRank) return candidate;
  if (candidateRank < currentRank) return current;
  if ((candidate.resolvedPath || candidate.path) && !(current.resolvedPath || current.path)) {
    return candidate;
  }
  return current.label.trim().length >= candidate.label.trim().length ? current : candidate;
}

/** Keep one row per basename; prefer delivered over checking/missing duplicates. */
export function dedupeDeliverableRowsByBasename(rows: DeliverableDockRow[]): DeliverableDockRow[] {
  const byBasename = new Map<string, DeliverableDockRow>();
  const withoutBasename: DeliverableDockRow[] = [];

  for (const row of rows) {
    if (row.status === 'hidden') continue;
    const base = rowBasename(row);
    if (!base) {
      withoutBasename.push(row);
      continue;
    }
    const existing = byBasename.get(base);
    byBasename.set(base, existing ? pickPreferredRow(existing, row) : row);
  }

  return [...byBasename.values(), ...withoutBasename];
}
