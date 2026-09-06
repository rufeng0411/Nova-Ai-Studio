/**
 * PD-SAAS-FORK: Node shared inferTurnArtifactDirectory (mirrors reconcileTurnDeliverables.ts).
 */
import {
  isBareDeliverableFilename,
  isGenericClashProneBasename,
  sanitizeDeliverableLookupPath,
} from '../../ui/shared/deliverablePathResolve.mjs';

const GENERIC_SLIDE_IMAGE = /^slide-\d+\.(png|jpe?g|webp|gif)$/i;
const GENERIC_SLIDES_HTML = /^slides\.html$/i;

function normalizeArtifactPath(raw) {
  return sanitizeDeliverableLookupPath(String(raw || '')).replace(/\\/g, '/');
}

function getArtifactDirectory(path) {
  const normalized = normalizeArtifactPath(path);
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(0, idx) : '';
}

const NON_DELIVERABLE_TOP_DIRS = new Set([
  'cloud-storage', 'data', 'docs', 'local-bindings', 'output', 'src', 'test', 'tests',
  'scripts', 'config', 'ui', 'lib', 'public', 'skills', 'products', 'saas', 'tenants',
  'drafts', 'temp', 'tmp', 'scratch',
]);

function isDeliverableDirectory(dir) {
  if (!dir) return false;
  const top = dir.split('/')[0]?.toLowerCase() ?? '';
  return !NON_DELIVERABLE_TOP_DIRS.has(top);
}

/**
 * @param {Array<{ path?: string, apiPath?: string, source?: string }>} items
 * @returns {string | null}
 */
export function inferTurnArtifactDirectory(items) {
  const scores = new Map();
  for (const item of items ?? []) {
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
  let bestDir = null;
  let bestScore = 0;
  for (const [dir, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }
  return bestDir;
}

/**
 * @param {string[]} paths
 * @returns {string | null}
 */
export function inferTurnDirFromExplicitPaths(paths) {
  const scores = new Map();
  for (const raw of paths ?? []) {
    const path = sanitizeDeliverableLookupPath(raw).replace(/\\/g, '/');
    if (!path.includes('/')) continue;
    const dir = getArtifactDirectory(path);
    if (!dir || !isDeliverableDirectory(dir)) continue;
    scores.set(dir, (scores.get(dir) ?? 0) + 1);
  }
  let bestDir = null;
  let bestScore = 0;
  for (const [dir, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }
  return bestDir;
}

function isAmbiguousDeliverableBasename(fileName) {
  return (
    GENERIC_SLIDE_IMAGE.test(fileName)
    || GENERIC_SLIDES_HTML.test(fileName)
    || fileName.toLowerCase() === 'slide-manifest.json'
    || fileName.toLowerCase() === 'outline.json'
    || isGenericClashProneBasename(fileName)
  );
}

/**
 * @param {Array<{ path?: string, apiPath?: string, source?: string, id?: string, kind?: string }>} items
 * @returns {typeof items}
 */
export function reconcileTurnDeliverablesLite(items) {
  if (!items?.length) return items ?? [];

  const turnDir = inferTurnArtifactDirectory(items);
  const toolBasenamesInTurn = new Set();
  if (turnDir) {
    for (const item of items) {
      if (item.source !== 'tool') continue;
      const path = normalizeArtifactPath(item.apiPath || item.path);
      if (getArtifactDirectory(path) === turnDir) {
        toolBasenamesInTurn.add(path.split('/').pop()?.toLowerCase() ?? '');
      }
    }
  }

  const out = [];
  const seen = new Set();

  for (const item of items) {
    let next = item;
    const path = normalizeArtifactPath(item.apiPath || item.path);
    const base = path.split('/').pop() ?? '';

    if (item.source === 'tool' && isBareDeliverableFilename(path) && turnDir) {
      const reanchored = `${turnDir}/${base}`.replace(/\/+/g, '/');
      next = { ...item, path: reanchored, apiPath: reanchored };
    } else if (item.source === 'text' && isBareDeliverableFilename(path)) {
      if (turnDir && toolBasenamesInTurn.has(base.toLowerCase())) {
        const reanchored = `${turnDir}/${base}`.replace(/\/+/g, '/');
        next = { ...item, path: reanchored, apiPath: reanchored };
      } else if ((GENERIC_SLIDES_HTML.test(base) || isGenericClashProneBasename(base)) && turnDir) {
        const reanchored = `${turnDir}/${base}`.replace(/\/+/g, '/');
        next = { ...item, path: reanchored, apiPath: reanchored };
      } else if (GENERIC_SLIDE_IMAGE.test(base)) {
        if (!turnDir || !toolBasenamesInTurn.has(base.toLowerCase())) {
          continue;
        }
        const reanchored = `${turnDir}/${base}`.replace(/\/+/g, '/');
        next = { ...item, path: reanchored, apiPath: reanchored };
      } else if (turnDir && isAmbiguousDeliverableBasename(base)) {
        continue;
      }
    } else if (turnDir && path.includes('artifacts/') && getArtifactDirectory(path) !== turnDir) {
      if (item.source === 'text' && isAmbiguousDeliverableBasename(base)) {
        continue;
      }
    }

    const key = next.id || `${next.kind}:${normalizeArtifactPath(next.apiPath || next.path)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }

  return out;
}
