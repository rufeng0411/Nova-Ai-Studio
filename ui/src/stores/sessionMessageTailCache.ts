/**
 * PD-SAAS-FORK: 会话 tail120 本地缓存 — F5 / 二次打开先展示再后台刷新
 */
import type { LoadedRange } from './sessionMessagePagination';
import type { NormalizedMessage } from './useSessionStore';

export const SESSION_TAIL_CACHE_VERSION = 1;
export const SESSION_TAIL_CACHE_TTL_MS = 15 * 60 * 1000;
const STORAGE_PREFIX = 'pd:tail:v1:';
const MAX_CACHE_ENTRIES = 12;

export type SessionTailCacheEntry = {
  v: number;
  sessionId: string;
  projectName: string;
  messages: NormalizedMessage[];
  total: number;
  hasMore: boolean;
  loadedRange: LoadedRange | null;
  fetchedAt: number;
};

function storageKey(sessionId: string, projectName: string): string {
  return `${STORAGE_PREFIX}${sessionId}:${projectName}`;
}

function isFresh(entry: SessionTailCacheEntry, ttlMs = SESSION_TAIL_CACHE_TTL_MS): boolean {
  return Date.now() - entry.fetchedAt <= ttlMs;
}

export function readSessionTailCache(
  sessionId: string,
  projectName: string,
): SessionTailCacheEntry | null {
  if (typeof sessionStorage === 'undefined' || !sessionId || !projectName) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(sessionId, projectName));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionTailCacheEntry;
    if (parsed.v !== SESSION_TAIL_CACHE_VERSION) return null;
    if (parsed.sessionId !== sessionId || parsed.projectName !== projectName) return null;
    if (!Array.isArray(parsed.messages) || parsed.messages.length === 0) return null;
    if (!isFresh(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSessionTailCache(entry: Omit<SessionTailCacheEntry, 'v' | 'fetchedAt'> & {
  fetchedAt?: number;
}): void {
  if (typeof sessionStorage === 'undefined') return;
  const payload: SessionTailCacheEntry = {
    v: SESSION_TAIL_CACHE_VERSION,
    fetchedAt: entry.fetchedAt ?? Date.now(),
    sessionId: entry.sessionId,
    projectName: entry.projectName,
    messages: entry.messages,
    total: entry.total,
    hasMore: entry.hasMore,
    loadedRange: entry.loadedRange,
  };
  try {
    sessionStorage.setItem(storageKey(entry.sessionId, entry.projectName), JSON.stringify(payload));
    pruneSessionTailCache(entry.sessionId, entry.projectName);
  } catch {
    try {
      clearSessionTailCacheExcept(entry.sessionId, entry.projectName);
      sessionStorage.setItem(storageKey(entry.sessionId, entry.projectName), JSON.stringify(payload));
    } catch {
      /* quota — ignore */
    }
  }
}

function pruneSessionTailCache(keepSessionId: string, keepProjectName: string): void {
  /** @type {Array<{ key: string, fetchedAt: number }>} */
  const entries = [];
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i);
    if (!key?.startsWith(STORAGE_PREFIX)) continue;
    try {
      const parsed = JSON.parse(sessionStorage.getItem(key) || '') as SessionTailCacheEntry;
      entries.push({ key, fetchedAt: parsed.fetchedAt ?? 0 });
    } catch {
      entries.push({ key, fetchedAt: 0 });
    }
  }
  if (entries.length <= MAX_CACHE_ENTRIES) return;
  entries.sort((a, b) => a.fetchedAt - b.fetchedAt);
  const keepKey = storageKey(keepSessionId, keepProjectName);
  for (const item of entries) {
    if (entries.length - MAX_CACHE_ENTRIES <= 0) break;
    if (item.key === keepKey) continue;
    sessionStorage.removeItem(item.key);
    entries.pop();
  }
}

function clearSessionTailCacheExcept(sessionId: string, projectName: string): void {
  const keepKey = storageKey(sessionId, projectName);
  for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX) && key !== keepKey) {
      sessionStorage.removeItem(key);
    }
  }
}

export function invalidateSessionTailCache(sessionId: string, projectName?: string): void {
  if (typeof sessionStorage === 'undefined' || !sessionId) return;
  if (projectName) {
    sessionStorage.removeItem(storageKey(sessionId, projectName));
    return;
  }
  for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(`${STORAGE_PREFIX}${sessionId}:`)) {
      sessionStorage.removeItem(key);
    }
  }
}
