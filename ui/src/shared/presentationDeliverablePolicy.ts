// PD-SAAS-FORK: when anth-pptx / PPT tasks produce both HTML scripts and real .pptx, prefer .pptx
import type { DeliverableItem } from './collectDeliverables';
import { getArtifactDirectory, getArtifactFileName, normalizeArtifactPath } from './artifactPaths';

const PRESENTATION_HTML_BASENAMES = new Set([
  'presentation.html',
  'slides.html',
]);

const PRESENTATION_SCRIPT_RE = /^create_.*\.(py|mjs|js)$/i;

function isPptxPath(path: string): boolean {
  return /\.pptx$/i.test(path);
}

function isPresentationHtml(path: string): boolean {
  const base = getArtifactFileName(path).toLowerCase();
  return PRESENTATION_HTML_BASENAMES.has(base);
}

function isPresentationScript(path: string): boolean {
  return PRESENTATION_SCRIPT_RE.test(getArtifactFileName(path));
}

function isStubPresentationPptx(path: string, allPptxPaths: string[]): boolean {
  const base = getArtifactFileName(path).toLowerCase();
  if (base !== 'presentation.pptx') return false;
  const dir = getArtifactDirectory(path);
  const others = allPptxPaths.filter(
    (candidate) =>
      candidate !== path && getArtifactDirectory(candidate) === dir,
  );
  return others.length > 0;
}

/** Tool-written .pptx deliverables, dropping generic stub names when a real sibling exists. */
export function selectAuthoritativePptxDeliverables(allItems: DeliverableItem[]): DeliverableItem[] {
  const pptxItems = allItems.filter(
    (item) =>
      item.kind !== 'url'
      && item.source === 'tool'
      && isPptxPath(normalizeArtifactPath(item.apiPath || item.path)),
  );
  if (pptxItems.length === 0) return [];

  const paths = pptxItems.map((item) => normalizeArtifactPath(item.apiPath || item.path));
  return pptxItems.filter((item) => {
    const path = normalizeArtifactPath(item.apiPath || item.path);
    return !isStubPresentationPptx(path, paths);
  });
}

/** When assistant anchored HTML only and the only tool pptx is generic presentation.pptx, keep HTML. */
export function shouldSuppressGenericPptxPromotion(
  anchorPaths: string[],
  authoritativePptx: DeliverableItem[],
): boolean {
  if (authoritativePptx.length === 0) return false;
  const normalizedAnchors = anchorPaths.map((path) => normalizeArtifactPath(path));
  const anchorsHtml = normalizedAnchors.some((path) => isPresentationHtml(path));
  const anchorsPptx = normalizedAnchors.some((path) => isPptxPath(path));
  const onlyGenericPptx = authoritativePptx.every((item) => {
    const base = getArtifactFileName(normalizeArtifactPath(item.apiPath || item.path)).toLowerCase();
    return base === 'presentation.pptx';
  });
  return anchorsHtml && !anchorsPptx && onlyGenericPptx;
}

/**
 * After final deliverables are collected, promote real .pptx and demote HTML/script fallbacks
 * unless the assistant explicitly anchored those fallback paths.
 */
export function applyPresentationDeliverablePolicy(
  finalItems: DeliverableItem[],
  allItems: DeliverableItem[],
  anchorPaths: string[] = [],
): DeliverableItem[] {
  const authoritativePptx = selectAuthoritativePptxDeliverables(allItems);
  if (authoritativePptx.length === 0) return finalItems;
  if (shouldSuppressGenericPptxPromotion(anchorPaths, authoritativePptx)) {
    return finalItems;
  }

  const normalizedAnchors = anchorPaths.map((path) => normalizeArtifactPath(path));
  const isAnchored = (path: string) => {
    const normalized = normalizeArtifactPath(path);
    return normalizedAnchors.some(
      (anchor) => anchor === normalized || anchor.endsWith(`/${normalized}`) || normalized.endsWith(`/${anchor}`),
    );
  };

  const merged = [...finalItems];
  for (const pptx of authoritativePptx) {
    const path = normalizeArtifactPath(pptx.apiPath || pptx.path);
    if (!merged.some((item) => normalizeArtifactPath(item.apiPath || item.path) === path)) {
      merged.push(pptx);
    }
  }

  return merged.filter((item) => {
    if (item.kind === 'url') return true;
    const path = normalizeArtifactPath(item.apiPath || item.path);
    if (!path) return false;

    if (isPresentationHtml(path) || isPresentationScript(path)) {
      // Real .pptx tool writes supersede HTML/script fallbacks even when the
      // assistant incorrectly anchors the HTML path in closing text.
      return false;
    }

    if (isStubPresentationPptx(path, authoritativePptx.map((p) => normalizeArtifactPath(p.apiPath || p.path)))) {
      return isAnchored(path);
    }

    return true;
  });
}

/** Prefer .pptx over HTML/scripts when picking a single primary file in the same turn folder. */
export function presentationDeliverableSortScore(item: DeliverableItem): number {
  const path = normalizeArtifactPath(item.apiPath || item.path);
  if (isPptxPath(path)) return 100;
  if (isPresentationHtml(path)) return 10;
  if (isPresentationScript(path)) return 5;
  return 50;
}
