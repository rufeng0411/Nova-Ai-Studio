/**
 * PD-SAAS-FORK: in-memory cache for Super Preview folder listings (listProjectFolder).
 * Avoids repeated Bridge calls when switching sessions back to the same artifact dir.
 */
import { getArtifactDirectory } from './artifactPaths';

const DEFAULT_TTL_MS = 60_000;
const MAX_ENTRIES = 32;

type CacheEntry = {
  siblings: string[];
  fetchedAt: number;
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string[]>>();
const textCache = new Map<string, { text: string; fetchedAt: number }>();

function textCacheKey(projectName: string, filePath: string): string {
  return `${projectName}::${filePath.replace(/\\/g, '/').replace(/\/+$/, '')}`;
}

function cacheKey(projectName: string, apiPath: string): string | null {
  const dir = getArtifactDirectory(apiPath);
  if (!dir) return null;
  return `${projectName}::${dir.replace(/\\/g, '/').replace(/\/+$/, '')}`;
}

/** PD-SAAS-FORK: promo.mp4 opens with sibling hf-project/ listing cached at task dir. */
export function readHfProjectSiblingCache(
  projectName: string,
  promoApiPath: string,
  ttlMs = DEFAULT_TTL_MS,
): string[] | null {
  const normalized = promoApiPath.replace(/\\/g, '/').trim();
  if (!/\/promo\.mp4$/i.test(normalized)) return null;
  const taskDir = normalized.replace(/\/promo\.mp4$/i, '');
  return readSuperPreviewSiblingCache(projectName, `${taskDir}/hf-project/index.html`, ttlMs);
}

function pruneIfNeeded(): void {
  if (cache.size <= MAX_ENTRIES) return;
  const oldest = [...cache.entries()].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);
  while (cache.size > MAX_ENTRIES && oldest.length > 0) {
    const [key] = oldest.shift()!;
    cache.delete(key);
  }
}

export function readSuperPreviewSiblingCache(
  projectName: string,
  apiPath: string,
  ttlMs = DEFAULT_TTL_MS,
): string[] | null {
  const key = cacheKey(projectName, apiPath);
  if (!key) return null;
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.siblings;
}

export function writeSuperPreviewSiblingCache(
  projectName: string,
  apiPath: string,
  siblings: string[],
): void {
  const key = cacheKey(projectName, apiPath);
  if (!key || siblings.length === 0) return;
  cache.set(key, { siblings: [...siblings], fetchedAt: Date.now() });
  pruneIfNeeded();
}

export function clearSuperPreviewSiblingCache(): void {
  cache.clear();
  inflight.clear();
  textCache.clear();
}

export function readCachedProjectText(
  projectName: string,
  filePath: string,
  ttlMs = DEFAULT_TTL_MS,
): string | null {
  const key = textCacheKey(projectName, filePath);
  const entry = textCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > ttlMs) {
    textCache.delete(key);
    return null;
  }
  return entry.text;
}

export function writeCachedProjectText(projectName: string, filePath: string, text: string): void {
  const key = textCacheKey(projectName, filePath);
  textCache.set(key, { text, fetchedAt: Date.now() });
  if (textCache.size > MAX_ENTRIES * 2) {
    const oldest = [...textCache.entries()].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);
    while (textCache.size > MAX_ENTRIES && oldest.length > 0) {
      const [k] = oldest.shift()!;
      textCache.delete(k);
    }
  }
}

export async function loadSuperPreviewSiblingsCached(
  projectName: string,
  apiPath: string,
  loader: () => Promise<string[]>,
): Promise<string[]> {
  const cached = readSuperPreviewSiblingCache(projectName, apiPath);
  if (cached) return cached;

  const key = cacheKey(projectName, apiPath);
  if (!key) return loader();

  const existing = inflight.get(key);
  if (existing) return existing;

  const task = loader()
    .then((siblings) => {
      writeSuperPreviewSiblingCache(projectName, apiPath, siblings);
      return siblings;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, task);
  return task;
}
