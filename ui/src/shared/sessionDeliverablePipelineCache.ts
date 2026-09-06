/**
 * PD-SAAS-FORK: module-level LRU cache for session deliverable pipeline bundles.
 */
import type { SessionDeliverablePipelineBundle } from './sessionDeliverablePipeline';

export const MAX_PIPELINE_CACHE_ENTRIES = 16;

type CacheEntry = {
  fingerprint: string;
  bundle: SessionDeliverablePipelineBundle;
};

const cache = new Map<string, CacheEntry>();

export function getPipelineCacheEntry(
  sessionId: string,
  fingerprint: string,
): SessionDeliverablePipelineBundle | undefined {
  const key = sessionId || '__no_session__';
  const entry = cache.get(key);
  if (!entry || entry.fingerprint !== fingerprint) return undefined;
  return entry.bundle;
}

export function setPipelineCacheEntry(
  sessionId: string,
  fingerprint: string,
  bundle: SessionDeliverablePipelineBundle,
): void {
  const key = sessionId || '__no_session__';
  if (cache.size >= MAX_PIPELINE_CACHE_ENTRIES && !cache.has(key)) {
    const oldestKey = cache.keys().next().value;
    if (typeof oldestKey === 'string') cache.delete(oldestKey);
  }
  cache.set(key, { fingerprint, bundle });
}

export function invalidateSessionPipelineCache(sessionId?: string | null): void {
  if (!sessionId) {
    cache.clear();
    return;
  }
  cache.delete(sessionId);
}

export function clearPipelineCache(): void {
  cache.clear();
}
