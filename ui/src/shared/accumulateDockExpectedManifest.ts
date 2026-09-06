/**
 * PD-SAAS-FORK: merge session SDM baseline with later user-added deliverables (accumulation mode).
 */
import type { ExpectedManifestEntry } from './buildDeliverableSummaryRows';
import type { DeliverableItem } from './collectDeliverables';
import {
  CAMPAIGN_SLOT_PATTERNS,
  kindMatchAllowed,
  pathMatchesKind,
  sdmBasename,
} from '../../../src/saas/deliverables/sdmSlotMatching';
import { semanticSlotLabel } from '../../../src/saas/deliverables/sdmSlotLabels';

function normalizePathKey(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

function pathsLooselyMatch(a: string, b: string): boolean {
  const na = normalizePathKey(a);
  const nb = normalizePathKey(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ba = sdmBasename(na);
  const bb = sdmBasename(nb);
  return ba.length > 0 && ba === bb;
}

function expectedEntryCoversDeliverable(
  entry: ExpectedManifestEntry,
  item: DeliverableItem,
): boolean {
  const path = item.resolvedPath || item.apiPath || item.path;
  if (!path) return false;

  if (entry.path && pathsLooselyMatch(entry.path, path)) return true;

  const pathHints = entry.pathHints?.length
    ? entry.pathHints
    : (entry.path ? [entry.path] : []);
  for (const hint of pathHints) {
    if (pathsLooselyMatch(hint, path)) return true;
  }

  if (
    entry.kind
    && kindMatchAllowed({ id: entry.id ?? '', pathHint: entry.path, kind: entry.kind, pathHints: entry.pathHints })
    && pathMatchesKind(path, entry.kind)
  ) {
    return true;
  }

  const stagePattern = entry.id ? CAMPAIGN_SLOT_PATTERNS[entry.id] : undefined;
  if (stagePattern?.test(path)) return true;

  return false;
}

function itemKindFromPath(path: string): DeliverableItem['kind'] {
  const ext = sdmBasename(path).split('.').pop()?.toLowerCase() ?? '';
  if (['md', 'markdown'].includes(ext)) return 'document';
  if (['html', 'htm'].includes(ext)) return 'html';
  if (ext === 'pdf') return 'pdf';
  if (['pptx', 'ppt'].includes(ext)) return 'presentation';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  return 'file';
}

/** Normalize slot/item kinds for cross-format accumulation under frozen baseline. */
function normalizeAccumulationKind(kind?: string): string {
  if (!kind || kind === 'document') return 'markdown';
  if (kind === 'presentation') return 'pptx';
  if (kind === 'file') return 'file';
  return kind;
}

/** User-facing formats that may accumulate after frozen baseline (e.g. HTML after md slots). */
const LOCK_BASELINE_ACCUMULABLE_KINDS = new Set([
  'html',
  'pdf',
  'docx',
  'pptx',
  'markdown',
]);

function baseSlotKinds(entries: ExpectedManifestEntry[]): Set<string> {
  const kinds = new Set<string>();
  for (const entry of entries) {
    kinds.add(normalizeAccumulationKind(entry.kind));
  }
  return kinds;
}

function deliverableItemsFromVerifiedPaths(
  paths: string[],
  existing: DeliverableItem[],
): DeliverableItem[] {
  const seen = new Set(
    existing.map((item) => normalizePathKey(item.resolvedPath || item.apiPath || item.path)),
  );
  const extras: DeliverableItem[] = [];
  for (const raw of paths) {
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const path = raw.replace(/\\/g, '/').trim();
    const key = normalizePathKey(path);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (existing.some((item) => pathsLooselyMatch(item.resolvedPath || item.apiPath || item.path, path))) {
      continue;
    }
    extras.push({
      id: `verified:${key}`,
      path,
      apiPath: path,
      kind: itemKindFromPath(path),
      source: 'text',
    });
  }
  return extras;
}

/**
 * Extend SDM / expected baseline with session deliverables not covered by any slot
 * (e.g. user later asks for HTML dashboard after markdown report).
 */
export function accumulateDockExpectedManifest(
  base: ExpectedManifestEntry[] | undefined,
  sessionDeliverables: DeliverableItem[],
  verifiedPaths: string[] = [],
  options?: { lockBaseline?: boolean },
): ExpectedManifestEntry[] {
  const entries = [...(base ?? [])];
  const seenIds = new Set(entries.map((entry) => entry.id));

  // PD-SAAS-FORK: frozen baseline blocks phantom md rows mid-task, but still
  // surfaces user-added cross-format verified deliverables (e.g. HTML after md slots).
  const allItems = options?.lockBaseline && entries.length > 0
    ? deliverableItemsFromVerifiedPaths(verifiedPaths, sessionDeliverables).filter((item) => {
      const path = item.resolvedPath || item.apiPath || item.path;
      if (!path) return false;
      if (entries.some((entry) => expectedEntryCoversDeliverable(entry, item))) return false;
      const itemKind = normalizeAccumulationKind(item.kind ?? itemKindFromPath(path));
      if (baseSlotKinds(entries).has(itemKind)) return false;
      // PD-SAAS-FORK Fix-4: lockBaseline blocks png/json/process cross-kind phantom rows.
      return LOCK_BASELINE_ACCUMULABLE_KINDS.has(itemKind);
    })
    : [
      ...sessionDeliverables,
      ...deliverableItemsFromVerifiedPaths(verifiedPaths, sessionDeliverables),
    ];

  for (const item of allItems) {
    if (entries.some((entry) => expectedEntryCoversDeliverable(entry, item))) continue;

    const path = item.resolvedPath || item.apiPath || item.path;
    if (!path) continue;

    const normalized = normalizePathKey(path);
    const id = `accumulated-${normalized.replace(/[^a-z0-9]+/g, '-')}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const kind = item.kind ?? itemKindFromPath(path);
    entries.push({
      id,
      label: semanticSlotLabel({ pathHint: path, kind }),
      kind,
      path,
      status: 'done',
      required: true,
    });
  }

  return entries;
}
