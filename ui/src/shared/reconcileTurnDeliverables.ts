// PD-SAAS-FORK: anchor turn deliverables to the folder written this turn (avoid cross-deck mix-ups)
import type { DeliverableItem } from './collectDeliverables';
import { getArtifactDirectory, getArtifactFileName, normalizeArtifactPath } from './artifactPaths';
import {
  isBareDeliverableFilename,
  isGenericClashProneBasename,
  sanitizeDeliverableLookupPath,
} from '../../shared/deliverablePathResolve.mjs';
import { isNonUserDeliverablePath } from './nonDeliverablePaths';

const NON_DELIVERABLE_TOP_DIRS = new Set([
  'cloud-storage',
  'data',
  'docs',
  'local-bindings',
  'output',
  'src',
  'test',
  'tests',
  'scripts',
  'config',
  'ui',
  'lib',
  'public',
  'skills',
  'products',
  'saas',
  'tenants',
  'drafts',
  'temp',
  'tmp',
  'scratch',
]);

const GENERIC_SLIDE_IMAGE = /^slide-\d+\.(png|jpe?g|webp|gif)$/i;
const GENERIC_SLIDES_HTML = /^slides\.html$/i;
const SLIDE_DECK_DIR_RE = /^artifacts\/slides-[^/]+$/i;

function isSlideDeckDirectory(dir: string): boolean {
  return SLIDE_DECK_DIR_RE.test(dir);
}

function isBareBasename(path: string): boolean {
  return isBareDeliverableFilename(normalizeArtifactPath(path));
}

function isAmbiguousDeliverableBasename(fileName: string): boolean {
  return (
    GENERIC_SLIDE_IMAGE.test(fileName) ||
    GENERIC_SLIDES_HTML.test(fileName) ||
    fileName.toLowerCase() === 'slide-manifest.json' ||
    fileName.toLowerCase() === 'outline.json' ||
    isGenericClashProneBasename(fileName)
  );
}

function isDeliverableDirectory(dir: string): boolean {
  if (!dir) return false;
  const top = dir.split('/')[0]?.toLowerCase() ?? '';
  return !NON_DELIVERABLE_TOP_DIRS.has(top);
}

/** Infer the turn-scoped folder (artifacts/… or task slug like 0608/) from tool writes. */
export function inferTurnArtifactDirectory(items: DeliverableItem[]): string | null {
  const scores = new Map<string, number>();
  for (const item of items) {
    const path = normalizeArtifactPath(item.apiPath || item.path);
    if (!path) continue;
    const dir = getArtifactDirectory(path);
    if (!dir || !isDeliverableDirectory(dir)) continue;
    if (item.source === 'tool') {
      scores.set(dir, (scores.get(dir) ?? 0) + 5);
    } else if (dir.includes('artifacts/')) {
      scores.set(dir, (scores.get(dir) ?? 0) + 1);
    }
  }
  let bestDir: string | null = null;
  let bestScore = 0;
  for (const [dir, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }
  return bestDir;
}

/** Best-effort turn folder from explicit paths (assistant anchors or tool full paths). */
export function inferTurnDirFromExplicitPaths(paths: string[]): string | null {
  const scores = new Map<string, number>();
  for (const raw of paths) {
    const path = sanitizeDeliverableLookupPath(raw).replace(/\\/g, '/');
    if (!path.includes('/')) continue;
    const dir = getArtifactDirectory(path);
    if (!dir || !isDeliverableDirectory(dir)) continue;
    scores.set(dir, (scores.get(dir) ?? 0) + 1);
  }
  let bestDir: string | null = null;
  let bestScore = 0;
  for (const [dir, score] of scores) {
    const depth = dir.split('/').length;
    const bestDepth = bestDir ? bestDir.split('/').length : Number.MAX_SAFE_INTEGER;
    if (score > bestScore || (score === bestScore && depth < bestDepth)) {
      bestScore = score;
      bestDir = dir;
    }
  }
  return bestDir;
}

function reanchorItem(item: DeliverableItem, dir: string): DeliverableItem {
  const base = getArtifactFileName(item.apiPath || item.path);
  const path = `${dir}/${base}`.replace(/\/+/g, '/');
  const kind = item.kind;
  return {
    ...item,
    path,
    apiPath: path,
    id: `${kind}:${path.toLowerCase()}`,
  };
}

/**
 * Drop or re-anchor ambiguous slide paths (e.g. bare `slide-01.png`) that belong to
 * another deck in the same project. Prevents ming-architecture assets showing up
 * for a ROG NUC turn when the assistant only mentioned slide filenames in prose.
 */
export function reconcileTurnDeliverables(items: DeliverableItem[]): DeliverableItem[] {
  if (items.length === 0) return items;

  const filtered = items.filter(
    (item) => item.kind === 'url' || !isNonUserDeliverablePath(item.apiPath || item.path),
  );
  if (filtered.length === 0) return filtered;

  const turnDir = inferTurnArtifactDirectory(filtered);
  const toolBasenamesInTurn = new Set<string>();
  if (turnDir) {
    for (const item of filtered) {
      if (item.source !== 'tool') continue;
      const path = normalizeArtifactPath(item.apiPath || item.path);
      if (getArtifactDirectory(path) === turnDir) {
        toolBasenamesInTurn.add(getArtifactFileName(path).toLowerCase());
      }
    }
  }

  const out: DeliverableItem[] = [];
  const seen = new Set<string>();

  for (const item of filtered) {
    let next = item;
    const path = normalizeArtifactPath(item.apiPath || item.path);
    const base = getArtifactFileName(path);

    if (item.source === 'tool' && isBareBasename(path) && turnDir) {
      next = reanchorItem(item, turnDir);
    } else if (item.source === 'text' && isBareBasename(path)) {
      if (turnDir && toolBasenamesInTurn.has(base.toLowerCase())) {
        next = reanchorItem(item, turnDir);
      } else if (
        turnDir
        && /^artifacts\/content-/i.test(turnDir)
        && /\.(md|html|json|jsonld)$/i.test(base)
      ) {
        next = reanchorItem(item, turnDir);
      } else if ((GENERIC_SLIDES_HTML.test(base) || isGenericClashProneBasename(base)) && turnDir) {
        next = reanchorItem(item, turnDir);
      } else if (GENERIC_SLIDE_IMAGE.test(base)) {
        if (!turnDir || !toolBasenamesInTurn.has(base.toLowerCase())) {
          continue;
        }
        next = reanchorItem(item, turnDir);
      } else if (turnDir && isAmbiguousDeliverableBasename(base)) {
        continue;
      }
    } else if (turnDir && path.includes('artifacts/') && getArtifactDirectory(path) !== turnDir) {
      if (item.source === 'text') {
        if (isAmbiguousDeliverableBasename(base)) {
          continue;
        }
        const itemDir = getArtifactDirectory(path);
        if (isSlideDeckDirectory(itemDir) || isSlideDeckDirectory(turnDir)) {
          continue;
        }
      }
    }

    const key = next.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }

  return out;
}
