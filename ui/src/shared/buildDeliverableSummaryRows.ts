/**
 * PD-SAAS-FORK: Build one row per expected deliverable slot for partial-delivery display.
 * Merges expectedManifest, slide-manifest pages, acceptance meta, and validated items.
 */

import {
  CAMPAIGN_SLOT_PATTERNS,
  findBestVerifiedPathForSlot,
  kindMatchAllowed,
  pathMatchesKind,
  pathSatisfiesSdmSlot,
  slotMatchPatterns,
  sdmBasename as basename,
  normalizeSdmPath as normalizePath,
} from '../../../src/saas/deliverables/sdmSlotMatching';
import {
  isRawKindLabel,
  semanticSlotLabel,
} from '../../../src/saas/deliverables/sdmSlotLabels';
import { compileDeliverableSlotPath } from '../../shared/deliverablePathResolve.mjs';
import { extractDeliverablePathsFromText } from './artifactPaths';
import { isNonUserDeliverablePath } from './nonDeliverablePaths';
import { isDeliverableCertificateUiEnabled } from './perfFeatureFlags';
import type { ValidatedDeliverable } from './validateDeliverables';

export type SummaryRowStatus = 'delivered' | 'missing' | 'broken' | 'hidden' | 'checking' | 'needContinue';

export interface AcceptanceRowLike {
  id: string;
  label: string;
  path?: string;
  status: 'delivered' | 'missing' | 'broken' | 'hidden' | 'checking' | 'needContinue';
  resolvedPath?: string;
}

export interface DeliverableSummaryRow {
  id: string;
  label: string;
  path: string;
  status: SummaryRowStatus;
  resolvedPath?: string;
  apiPath?: string;
  previewable: boolean;
  linkable: boolean;
}

export interface ExpectedManifestEntry {
  id?: string;
  path?: string;
  pathHints?: string[];
  label?: string;
  kind?: string;
  page?: number;
  count?: number;
  required?: boolean;
  /** SDM slot lifecycle — done slots render as delivered without path match. */
  status?: 'pending' | 'active' | 'done' | 'removed';
}

export interface SlideManifestPage {
  page?: number;
  file?: string;
  path?: string;
  title?: string;
}

export interface BuildDeliverableSummaryRowsInput {
  expectedManifest?: ExpectedManifestEntry[] | null;
  slideManifestPages?: SlideManifestPage[] | null;
  acceptanceRows?: AcceptanceRowLike[] | null;
  validatedItems?: ValidatedDeliverable[] | null;
  /** Map missing/wildcard paths to resolved paths when known */
  resolvedPathMap?: Record<string, string> | null;
  /** Engine-verified paths from turn acceptance meta — used for kind-only SDM slots. */
  verifiedPaths?: string[] | null;
  turnArtifactDir?: string | null;
  /** When true, pending without resolvedPath → missing (not checking). */
  validationSettled?: boolean;
  /** Scope directory for linkable gate (STDA / turnArtifactDir). */
  scopeDir?: string | null;
}

type ManifestSlot = {
  id: string;
  label: string;
  path: string;
  kind?: string;
  pathHints?: string[];
};

/** Campaign patterns re-exported for tests — authoritative in sdmSlotMatching. */
export { CAMPAIGN_SLOT_PATTERNS };

function displayLabelForSlot(
  slot: ManifestSlot,
  validatedItem: ValidatedDeliverable | undefined,
  resolvedPath?: string,
): string {
  if (validatedItem) {
    const path = validatedItem.apiPath || validatedItem.resolvedPath || validatedItem.path;
    if (path) {
      return semanticSlotLabel({ pathHint: path, kind: slot.kind });
    }
  }
  if (resolvedPath) {
    return semanticSlotLabel({ pathHint: resolvedPath, kind: slot.kind });
  }
  return semanticSlotLabel({
    label: slot.label,
    kind: slot.kind,
    pathHint: slot.path,
  });
}

export { displayLabelForSlot, isRawKindLabel };

function slotLikeFromManifestSlot(slot: ManifestSlot, entry?: ExpectedManifestEntry) {
  return {
    id: slot.id,
    label: slot.label,
    kind: slot.kind ?? entry?.kind,
    pathHint: slot.path || entry?.path,
    pathHints: entry?.pathHints ?? slot.pathHints,
  };
}

function findVerifiedPathForSlot(
  slot: ManifestSlot,
  verifiedPaths: string[],
  usedPaths: Set<string>,
  entry?: ExpectedManifestEntry,
  scopeDir?: string | null,
): string | undefined {
  return findBestVerifiedPathForSlot(
    slotLikeFromManifestSlot(slot, entry),
    verifiedPaths,
    usedPaths,
    scopeDir,
  );
}

function findValidatedForSlot(
  slot: ManifestSlot,
  validated: ValidatedDeliverable[],
  usedIds: Set<string>,
  verifiedPathHint?: string,
  entry?: ExpectedManifestEntry,
): ValidatedDeliverable | undefined {
  const slotLike = slotLikeFromManifestSlot(slot, entry);
  if (slot.path) {
    const byPath = findValidatedForPath(slot.path, validated);
    if (byPath && !usedIds.has(byPath.id)) return byPath;
  }
  if (verifiedPathHint) {
    const item = findValidatedForPath(verifiedPathHint, validated);
    if (item && !usedIds.has(item.id)) return item;
  }
  for (const item of validated) {
    if (usedIds.has(item.id)) continue;
    const paths = [item.resolvedPath, item.apiPath, item.path].filter(Boolean) as string[];
    if (paths.some((p) => pathSatisfiesSdmSlot(p, slotLike))) {
      return item;
    }
  }
  const patterns = slotMatchPatterns(slotLike);
  if (patterns.length > 0) {
    for (const item of validated) {
      if (usedIds.has(item.id)) continue;
      const paths = [item.resolvedPath, item.apiPath, item.path].filter(Boolean) as string[];
      if (paths.some((p) => patterns.some((pattern) => pattern.test(p) || pattern.test(basename(p))))) {
        return item;
      }
    }
  }
  if (slot.kind && kindMatchAllowed(slotLike)) {
    for (const item of validated) {
      if (usedIds.has(item.id)) continue;
      const paths = [item.resolvedPath, item.apiPath, item.path].filter(Boolean) as string[];
      if (paths.some((p) => pathMatchesKind(p, slot.kind!))) return item;
    }
  }
  return undefined;
}

function fallbackManifestSlotLabel(
  entry: ExpectedManifestEntry,
  idx: number,
): string {
  return semanticSlotLabel({
    label: entry.label,
    kind: entry.kind,
    pathHint: entry.path,
  }) || `成果 ${idx + 1}`;
}

/** True when manifest rows are all missing but we have files/acceptance/text paths to show instead. */
export function shouldFallbackFromManifestSummaryRows(
  rows: DeliverableSummaryRow[],
  options: {
    itemCount?: number;
    acceptanceRows?: AcceptanceRowLike[] | null;
    assistantText?: string;
  },
): boolean {
  if (rows.length === 0) return false;
  const allIncomplete = rows.every((row) =>
    row.status === 'missing' || row.status === 'needContinue' || row.status === 'checking',
  );
  if (!allIncomplete) return false;
  if ((options.itemCount ?? 0) > 0) return true;
  if (options.acceptanceRows?.some((row) => row.status === 'delivered')) return true;
  return extractDeliverablePathsFromText(String(options.assistantText ?? '')).length > 0;
}

function pathsEqual(a: string, b: string): boolean {
  return normalizePath(a).toLowerCase() === normalizePath(b).toLowerCase();
}

function findValidatedForPath(
  path: string,
  items: ValidatedDeliverable[],
): ValidatedDeliverable | undefined {
  const norm = normalizePath(path);
  return items.find((item) => {
    const candidates = [item.path, item.apiPath, item.resolvedPath].filter(Boolean) as string[];
    return candidates.some((c) => pathsEqual(c, norm) || basename(c) === basename(norm));
  });
}

function findAcceptanceForPath(
  path: string,
  rows: AcceptanceRowLike[],
): AcceptanceRowLike | undefined {
  const norm = normalizePath(path);
  return rows.find((row) => {
    const candidates = [row.path, row.resolvedPath].filter(Boolean) as string[];
    return candidates.some((c) => pathsEqual(c, norm) || basename(c) === basename(norm));
  });
}

function findAcceptanceForSlot(
  slot: { id: string; label: string; path: string },
  rows: AcceptanceRowLike[],
): AcceptanceRowLike | undefined {
  if (slot.path) {
    const byPath = findAcceptanceForPath(slot.path, rows);
    if (byPath) return byPath;
  }
  const labelKey = slot.label.trim().toLowerCase();
  if (!labelKey) return undefined;
  return rows.find((row) => row.label.trim().toLowerCase() === labelKey || row.id === slot.id);
}

function resolvePagePath(
  page: SlideManifestPage,
  turnDir: string | null | undefined,
): string {
  const raw = page.path || page.file || '';
  if (!raw) return '';
  const norm = normalizePath(raw);
  if (norm.includes('/')) return norm;
  if (turnDir) return `${normalizePath(turnDir)}/${norm}`;
  return norm;
}

function expectedManifestIsDocumentDeliverable(
  expectedManifest: ExpectedManifestEntry[],
): boolean {
  return expectedManifest.some((entry) => {
    const kind = String(entry.kind ?? '').toLowerCase();
    const path = String(entry.path ?? entry.pathHints?.[0] ?? '').toLowerCase();
    if (['md', 'html', 'json', 'docx', 'pdf', 'markdown', 'jsonld'].includes(kind)) return true;
    return /\.(md|html|jsonld?|docx|pdf)$/i.test(path);
  });
}

function shouldExpandCountAsSlideDeck(
  entry: ExpectedManifestEntry,
  manifest: ExpectedManifestEntry[],
): boolean {
  const kind = String(entry.kind ?? '').toLowerCase();
  if (kind === 'markdown' || kind === 'html' || kind === 'docx' || kind === 'pdf' || kind === 'jsonld') {
    return false;
  }
  const path = String(entry.path ?? entry.pathHints?.[0] ?? entry.label ?? '').toLowerCase();
  if (/\.(md|html|jsonld?|docx|pdf|json)$/i.test(path)) return false;
  if (/platform|成稿|article|zhihu|xiaohongshu|wechat|weibo|csdn/.test(path)) return false;
  if (kind === 'image' || kind === 'png') return true;
  if (/slide-\d+\.png/.test(path)) return true;
  return !expectedManifestIsDocumentDeliverable(manifest);
}

function expandCountSlotAsMarkdownDrafts(
  entry: ExpectedManifestEntry,
  count: number,
  turnDir: string | null | undefined,
  idx: number,
): ManifestSlot[] {
  const platformLabels = ['知乎成稿', '小红书成稿', '公众号成稿', '微博成稿', 'CSDN成稿'];
  const platformFiles = ['zhihu-article.md', 'xiaohongshu-article.md', 'wechat-article.md', 'weibo-article.md', 'csdn-article.md'];
  return Array.from({ length: count }, (_, i) => {
    const file = platformFiles[i] ?? `platform-draft-${i + 1}.md`;
    const path = turnDir ? `${normalizePath(turnDir)}/${file}` : file;
    return {
      id: entry.id ? `${entry.id}_${i + 1}` : `expected-platform-${idx}-${i + 1}`,
      label: platformLabels[i] ?? `平台成稿 ${i + 1}`,
      path,
      kind: 'markdown',
      pathHints: entry.pathHints,
    };
  });
}

function isLongformCountEntry(entry: ExpectedManifestEntry): boolean {
  const label = String(entry.label ?? '');
  const count = typeof entry.count === 'number' ? entry.count : 0;
  if (count < 2) return false;
  return /长文|pillar|支柱|系列长文/i.test(label) || /长文|pillar/i.test(String(entry.id ?? ''));
}

function expandCountSlotAsLongformArticles(
  entry: ExpectedManifestEntry,
  count: number,
  turnDir: string | null | undefined,
  idx: number,
): ManifestSlot[] {
  const letters = ['A', 'B', 'C', 'D', 'E'];
  return Array.from({ length: count }, (_, i) => {
    const letter = letters[i] ?? String(i + 1);
    const fileStem = `02-支柱长文${letter}`;
    const path = turnDir ? `${normalizePath(turnDir)}/${fileStem}.md` : `${fileStem}.md`;
    return {
      id: entry.id ? `${entry.id}_${i + 1}` : `expected-longform-${idx}-${i + 1}`,
      label: `支柱长文 ${letter}`,
      path,
      kind: 'markdown',
      pathHints: entry.pathHints,
    };
  });
}

function compileManifestSlotPath(
  entry: ExpectedManifestEntry,
  turnDir: string | null | undefined,
): string {
  const raw = entry.path || entry.pathHints?.[0] || '';
  if (!raw) return '';
  const compiled = compileDeliverableSlotPath(raw, turnDir ?? undefined);
  return normalizePath(compiled || raw);
}

function pathUnderScopeDir(filePath: string | undefined, scopeDir: string | null | undefined): boolean {
  if (!filePath) return false;
  const normalized = normalizePath(filePath).replace(/\\/g, '/');
  if (!scopeDir) return true;
  const scope = normalizePath(scopeDir).replace(/\\/g, '/').replace(/\/+$/, '');
  if (!scope) return true;
  return normalized === scope || normalized.startsWith(`${scope}/`);
}

function rowIsLinkable(
  status: SummaryRowStatus,
  resolvedPath: string | undefined,
  scopeDir: string | null | undefined,
): boolean {
  if (!resolvedPath) return false;
  if (status !== 'delivered' && status !== 'checking' && status !== 'needContinue') return false;
  return pathUnderScopeDir(resolvedPath, scopeDir);
}

function expandManifestEntryToSlots(
  entry: ExpectedManifestEntry,
  idx: number,
  turnDir: string | null | undefined,
  manifest: ExpectedManifestEntry[],
): ManifestSlot[] {
  const count = typeof entry.count === 'number' && entry.count > 0 ? entry.count : 0;
  if (count > 1 && turnDir) {
    if (shouldExpandCountAsSlideDeck(entry, manifest)) {
      return Array.from({ length: count }, (_, slideIdx) => {
        const pageNum = slideIdx + 1;
        const padded = String(pageNum).padStart(2, '0');
        return {
          id: `expected-slide-${pageNum}`,
          label: `第 ${pageNum} 页`,
          path: `${normalizePath(turnDir)}/slide-${padded}.png`,
        };
      });
    }
    if (isLongformCountEntry(entry)) {
      return expandCountSlotAsLongformArticles(entry, count, turnDir, idx);
    }
    return expandCountSlotAsMarkdownDrafts(entry, count, turnDir, idx);
  }
  return [{
    id: entry.id || `expected-${idx}`,
    label: fallbackManifestSlotLabel(entry, idx),
    path: compileManifestSlotPath(entry, turnDir),
    kind: entry.kind,
    pathHints: entry.pathHints,
  }];
}

function buildSlotsFromManifest(
  expectedManifest: ExpectedManifestEntry[] | null | undefined,
  slidePages: SlideManifestPage[] | null | undefined,
  turnDir: string | null | undefined,
): Array<ManifestSlot> {
  if (
    slidePages && slidePages.length > 0
    && !(expectedManifest?.length && expectedManifestIsDocumentDeliverable(expectedManifest))
  ) {
    return slidePages.map((page, idx) => {
      const path = resolvePagePath(page, turnDir);
      const pageNum = page.page ?? idx + 1;
      return {
        id: `slide-${pageNum}`,
        label: page.title || `第 ${pageNum} 页`,
        path,
      };
    });
  }
  if (expectedManifest && expectedManifest.length > 0) {
    // Multi-slot SDM: expand per-entry count (longform/platform/slides) then one row per leaf slot.
    if (expectedManifest.length > 1) {
      return expectedManifest.flatMap((entry, idx) =>
        expandManifestEntryToSlots(entry, idx, turnDir, expectedManifest),
      );
    }

    const singleEntry = expectedManifest[0]!;
    const count = typeof singleEntry.count === 'number' && singleEntry.count > 0 ? singleEntry.count : 0;
    if (count > 0 && turnDir) {
      return expandManifestEntryToSlots(singleEntry, 0, turnDir, expectedManifest);
    }
    return expectedManifest.map((entry, idx) => ({
      id: entry.id || `expected-${idx}`,
      label: fallbackManifestSlotLabel(entry, idx),
      path: compileManifestSlotPath(entry, turnDir),
      kind: entry.kind,
      pathHints: entry.pathHints,
    }));
  }
  return [];
}

function pathMatchesVerifiedList(path: string, verifiedPaths: string[]): boolean {
  const normalized = normalizePath(path).toLowerCase();
  if (!normalized) return false;
  return verifiedPaths.some((verified) => {
    const v = normalizePath(verified).toLowerCase();
    return v === normalized || v.endsWith(`/${normalized}`) || normalized.endsWith(`/${v}`);
  });
}

function statusFromValidated(
  item: ValidatedDeliverable | undefined,
  acceptance: AcceptanceRowLike | undefined,
  validationSettled = false,
  verifiedPaths: string[] = [],
): SummaryRowStatus {
  if (item) {
    if (item.validationStatus === 'verified' || item.validationStatus === 'softVerified') return 'delivered';
    if (item.validationStatus === 'broken') return 'broken';
    const itemPath = item.resolvedPath || item.apiPath || item.path;
    // PD-SAAS-FORK fd7c166c: engine/transcript already verified — show delivered immediately,
    // do not wait for validationSettled (assistant still working / validate API lag).
    if (
      item.validationStatus === 'pending'
      && itemPath
      && pathMatchesVerifiedList(itemPath, verifiedPaths)
    ) {
      return 'delivered';
    }
    if (item.validationStatus === 'pending') {
      return validationSettled ? 'missing' : 'checking';
    }
  }
  if (acceptance) {
    if (acceptance.status === 'delivered') return 'delivered';
    if (acceptance.status === 'broken') return 'broken';
    if (acceptance.status === 'checking') return 'checking';
    if (acceptance.status === 'missing') return 'missing';
    if (acceptance.status === 'needContinue') return 'needContinue';
  }
  return 'missing';
}

function isPreviewable(status: SummaryRowStatus, path: string): boolean {
  if (status !== 'delivered' && status !== 'checking' && status !== 'needContinue') return false;
  const ext = basename(path).split('.').pop()?.toLowerCase() ?? '';
  return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf', 'html', 'htm', 'md', 'json'].includes(ext);
}

/**
 * Build summary rows — one per expected slot when manifest exists,
 * otherwise fall back to acceptance + validated union.
 */
export function buildDeliverableSummaryRows(input: BuildDeliverableSummaryRowsInput): DeliverableSummaryRow[] {
  const acceptance = input.acceptanceRows ?? [];
  const validated = input.validatedItems ?? [];
  const turnDir = input.turnArtifactDir ?? null;
  const scopeDir = input.scopeDir ?? turnDir;
  const resolvedMap = input.resolvedPathMap ?? {};

  const validationSettled = input.validationSettled ?? false;
  const verifiedPaths = (input.verifiedPaths ?? []).map((p) => normalizePath(p)).filter(Boolean);
  const slots = buildSlotsFromManifest(input.expectedManifest, input.slideManifestPages, turnDir);
  const usedValidatedIds = new Set<string>();
  const usedVerifiedPaths = new Set<string>();

  if (slots.length > 0) {
    return slots.map((slot) => {
      const manifestEntry = input.expectedManifest?.find((entry) => entry.id === slot.id);
      const verifiedPathForSlot = findVerifiedPathForSlot(slot, verifiedPaths, usedVerifiedPaths, manifestEntry, scopeDir);

      if (manifestEntry?.status === 'done') {
        const validatedItem = findValidatedForSlot(slot, validated, usedValidatedIds, verifiedPathForSlot, manifestEntry);
        if (validatedItem) usedValidatedIds.add(validatedItem.id);
        const acceptanceRow = findAcceptanceForSlot(slot, acceptance);
        const resolvedPath = validatedItem?.resolvedPath
          ?? acceptanceRow?.resolvedPath
          ?? verifiedPathForSlot
          ?? resolvedMap[slot.path]
          ?? resolvedMap[basename(slot.path)]
          ?? undefined;
        const hasAuthority = Boolean(
          validatedItem?.resolvedPath
          || verifiedPathForSlot
          || (resolvedPath && pathMatchesVerifiedList(resolvedPath, verifiedPaths)),
        );
        const status: SummaryRowStatus = hasAuthority && resolvedPath ? 'delivered' : 'checking';
        const displayPath = validatedItem?.apiPath || validatedItem?.path || resolvedPath || slot.path || slot.label;
        return {
          id: slot.id,
          label: displayLabelForSlot(slot, validatedItem, resolvedPath),
          path: displayPath,
          status,
          resolvedPath,
          apiPath: validatedItem?.apiPath,
          previewable: isPreviewable(status, resolvedPath || slot.path),
          linkable: rowIsLinkable(status, resolvedPath, scopeDir),
        };
      }

      const resolvedFromMap = resolvedMap[slot.path] || resolvedMap[basename(slot.path)];
      let validatedItem = findValidatedForSlot(slot, validated, usedValidatedIds, verifiedPathForSlot, manifestEntry);
      if (validatedItem) usedValidatedIds.add(validatedItem.id);
      if (!validatedItem && resolvedFromMap) {
        validatedItem = findValidatedForPath(resolvedFromMap, validated);
        if (validatedItem) usedValidatedIds.add(validatedItem.id);
      }
      const acceptanceRow = findAcceptanceForSlot(slot, acceptance)
        ?? (resolvedFromMap ? findAcceptanceForPath(resolvedFromMap, acceptance) : undefined);

      let status = statusFromValidated(validatedItem, acceptanceRow, validationSettled, verifiedPaths);
      let resolvedPath = validatedItem?.resolvedPath
        ?? acceptanceRow?.resolvedPath
        ?? resolvedFromMap
        ?? verifiedPathForSlot
        ?? (status === 'delivered' ? slot.path : undefined);

      if (verifiedPathForSlot) {
        status = 'delivered';
        resolvedPath = resolvedPath ?? verifiedPathForSlot;
      } else if (!isDeliverableCertificateUiEnabled() && status === 'missing' && resolvedFromMap) {
        status = 'delivered';
        resolvedPath = resolvedFromMap;
      }
      if (status === 'missing' && acceptanceRow?.status === 'missing' && !validatedItem && !resolvedPath) {
        status = 'needContinue';
      }

      const displayPath = validatedItem?.apiPath || validatedItem?.path || resolvedPath || slot.path;
      const linkable = rowIsLinkable(status, resolvedPath ?? displayPath, scopeDir);

      return {
        id: slot.id,
        label: displayLabelForSlot(slot, validatedItem, resolvedPath),
        path: displayPath || slot.label,
        status,
        resolvedPath,
        apiPath: validatedItem?.apiPath,
        previewable: isPreviewable(status, resolvedPath || displayPath),
        linkable,
      };
    });
  }

  // Fallback: union acceptance rows + validated items not in acceptance
  const seen = new Set<string>();
  const rows: DeliverableSummaryRow[] = [];

  for (const acc of acceptance) {
    if (acc.status === 'hidden') continue;
    const acceptancePath = acc.path ?? acc.resolvedPath;
    if (!acceptancePath) continue;
    const key = normalizePath(acceptancePath);
    if (seen.has(key)) continue;
    seen.add(key);

    const validatedItem = findValidatedForPath(acceptancePath, validated);
    let status: SummaryRowStatus = acc.status === 'delivered' ? 'delivered'
      : acc.status === 'broken' ? 'broken'
      : acc.status === 'checking' ? 'checking'
      : 'needContinue';

    if (validatedItem) {
      status = statusFromValidated(validatedItem, acc, validationSettled, verifiedPaths);
    }

    rows.push({
      id: `acc-${key}`,
      label: acc.label || basename(acceptancePath),
      path: validatedItem?.apiPath || acceptancePath,
      status,
      resolvedPath: validatedItem?.resolvedPath ?? acc.resolvedPath,
      apiPath: validatedItem?.apiPath,
      previewable: isPreviewable(status, validatedItem?.resolvedPath ?? acceptancePath),
      linkable: rowIsLinkable(status, validatedItem?.resolvedPath ?? acc.resolvedPath, scopeDir),
    });
  }

  for (const item of validated) {
    const key = normalizePath(item.path);
    if (seen.has(key)) continue;
    if (isNonUserDeliverablePath(item.path) || isNonUserDeliverablePath(item.apiPath ?? '')) {
      continue;
    }
    seen.add(key);

    const status = statusFromValidated(item, undefined, validationSettled, verifiedPaths);
    if (status === 'hidden' as SummaryRowStatus) continue;

    rows.push({
      id: `val-${key}`,
      label: basename(item.path),
      path: item.apiPath || item.path,
      status,
      resolvedPath: item.resolvedPath,
      apiPath: item.apiPath,
      previewable: isPreviewable(status, item.resolvedPath ?? item.path),
      linkable: rowIsLinkable(status, item.resolvedPath, scopeDir),
    });
  }

  return rows;
}

/** Fallback rows when manifest/validation produced nothing but assistant text cites paths. */
export function buildDeliverableSummaryRowsFromTextPaths(input: {
  assistantText: string;
  turnArtifactDir?: string | null;
  validatedItems?: ValidatedDeliverable[] | null;
  validationSettled?: boolean;
}): DeliverableSummaryRow[] {
  const paths = [...new Set(
    extractDeliverablePathsFromText(String(input.assistantText ?? '')),
  )]
    .map((path) => normalizePath(path))
    .filter(Boolean);

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const path of paths) {
    const key = path.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(path);
  }

  const withoutNestedDupes = deduped.filter((path, idx, all) => {
    const lower = path.toLowerCase();
    return !all.some((other, j) => {
      if (j === idx) return false;
      const otherLower = other.toLowerCase();
      return otherLower.length > lower.length
        && (otherLower.endsWith(`/${lower}`) || otherLower.includes(`${lower}`));
    });
  });

  if (withoutNestedDupes.length === 0) return [];

  const validated = input.validatedItems ?? [];
  const validationSettled = input.validationSettled ?? false;

  return withoutNestedDupes.map((path, idx) => {
    const validatedItem = findValidatedForPath(path, validated);
    let status = statusFromValidated(validatedItem, undefined, validationSettled, []);
    const resolvedPath = validatedItem?.resolvedPath ?? (status === 'delivered' ? path : undefined);
    if (status === 'missing' && resolvedPath && validationSettled) {
      status = 'delivered';
    }
    if (status === 'missing' && !validationSettled) status = 'checking';

    return {
      id: `text-${idx}-${basename(path)}`,
      label: semanticSlotLabel({ pathHint: path }) || `成果 ${idx + 1}`,
      path: validatedItem?.apiPath || path,
      status,
      resolvedPath,
      apiPath: validatedItem?.apiPath,
      previewable: isPreviewable(status, resolvedPath || path),
      linkable: (status === 'delivered' || status === 'checking' || status === 'needContinue')
        && Boolean(resolvedPath || path),
    };
  });
}
