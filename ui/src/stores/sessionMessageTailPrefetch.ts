/**
 * PD-SAAS-FORK: 侧栏悬停预取 tail120 → sessionStorage（不阻塞 UI）
 */
import { TAIL_MESSAGE_PAGINATION } from '../constants/config';
import { fetchWithBackoff } from '../shared/fetchWithBackoff';
import { SESSION_MESSAGES_FETCH_TIMEOUT_MS } from './sessionMessagePagination';
import {
  readSessionTailCache,
  writeSessionTailCache,
} from './sessionMessageTailCache';
import {
  buildTailFetchQueryParams,
  computeLoadedRangeAfterTailFetch,
  TAIL_PAGE_INITIAL_LIMIT,
} from './sessionMessagePagination';
import type { NormalizedMessage } from './useSessionStore';
import {
  bumpPrefetchGeneration,
  getActivePrimarySessionId,
  getPrefetchGeneration,
  shouldAllowSidebarTailPrefetch,
} from './sessionMessagePrefetchGate';

const prefetchInflight = new Map<string, Promise<void>>();
let activePrefetchAbort: AbortController | null = null;
const PREFETCH_FRESH_MS = 45_000;
const SIDEBAR_DEFAULT_DAYS = Number(import.meta.env.VITE_SAAS_SIDEBAR_DEFAULT_DAYS || 7);
const SIDEBAR_DEFAULT_MS = SIDEBAR_DEFAULT_DAYS * 86_400_000;
/** Only one hover prefetch at a time — prevents Bridge JSONL parse pile-up. */
const MAX_GLOBAL_PREFETCH = 1;
let globalPrefetchActive = 0;

export type SessionTailPrefetchOpts = {
  projectName: string;
  projectPath?: string;
  provider?: string;
  sessionKind?: string;
  parentSessionId?: string;
  relativeTranscriptPath?: string;
  /** Skip prefetch when session is outside default sidebar window (ms epoch). */
  lastModifiedAtMs?: number;
};

function prefetchKey(sessionId: string, projectName: string): string {
  return `${sessionId}:${projectName}`;
}

export function cancelSessionTailPrefetches(): void {
  activePrefetchAbort?.abort();
  activePrefetchAbort = null;
  bumpPrefetchGeneration();
}

export function isSessionTailPrefetchInflight(sessionId: string, projectName: string): boolean {
  return prefetchInflight.has(prefetchKey(sessionId, projectName));
}

export function prefetchSessionTailMessages(
  sessionId: string,
  opts: SessionTailPrefetchOpts,
): Promise<void> {
  if (!sessionId || !opts.projectName || !TAIL_MESSAGE_PAGINATION) {
    return Promise.resolve();
  }
  if (sessionId.startsWith('new-session-')) return Promise.resolve();
  if (!shouldAllowSidebarTailPrefetch()) return Promise.resolve();
  if (getActivePrimarySessionId() === sessionId) return Promise.resolve();
  if (globalPrefetchActive >= MAX_GLOBAL_PREFETCH) return Promise.resolve();
  if (
    typeof opts.lastModifiedAtMs === 'number'
    && Number.isFinite(opts.lastModifiedAtMs)
    && Date.now() - opts.lastModifiedAtMs > SIDEBAR_DEFAULT_MS
  ) {
    return Promise.resolve();
  }

  const key = prefetchKey(sessionId, opts.projectName);
  const existing = prefetchInflight.get(key);
  if (existing) return existing;

  const cached = readSessionTailCache(sessionId, opts.projectName);
  if (cached && Date.now() - cached.fetchedAt < PREFETCH_FRESH_MS) {
    return Promise.resolve();
  }

  const generationAtStart = getPrefetchGeneration();
  globalPrefetchActive += 1;

  const abortController = new AbortController();
  activePrefetchAbort = abortController;

  const task = (async () => {
    if (generationAtStart !== getPrefetchGeneration()) return;
    if (!shouldAllowSidebarTailPrefetch()) return;
    if (getActivePrimarySessionId() === sessionId) return;

    const paginationParams = buildTailFetchQueryParams(
      { limit: TAIL_PAGE_INITIAL_LIMIT, direction: 'backward' },
      true,
      TAIL_PAGE_INITIAL_LIMIT,
    );
    const params = new URLSearchParams(paginationParams);
    if (opts.provider) params.append('provider', opts.provider);
    if (opts.projectName) params.append('projectName', opts.projectName);
    if (opts.projectPath) params.append('projectPath', opts.projectPath);
    if (opts.sessionKind) params.append('sessionKind', opts.sessionKind);
    if (opts.parentSessionId) params.append('parentSessionId', opts.parentSessionId);
    if (opts.relativeTranscriptPath) {
      params.append('relativeTranscriptPath', opts.relativeTranscriptPath);
    }

    const url = `/api/sessions/${encodeURIComponent(sessionId)}/messages?${params.toString()}`;
    const timeoutId = globalThis.setTimeout(() => abortController.abort(), SESSION_MESSAGES_FETCH_TIMEOUT_MS);
    try {
      const { response } = await fetchWithBackoff(url, {
        signal: abortController.signal,
      });
      if (!response.ok) return;
      if (generationAtStart !== getPrefetchGeneration()) return;

      const data = await response.json();
      const messages = (data.messages || []) as NormalizedMessage[];
      if (messages.length === 0) return;

      const total = data.total ?? messages.length;
      const loadedRange = computeLoadedRangeAfterTailFetch(total, data.nextCursor ?? null);

      writeSessionTailCache({
        sessionId,
        projectName: opts.projectName,
        messages,
        total,
        hasMore: loadedRange.start > 0,
        loadedRange,
      });
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  })().catch(() => {
    /* silent */
  }).finally(() => {
    globalPrefetchActive = Math.max(0, globalPrefetchActive - 1);
    prefetchInflight.delete(key);
    if (activePrefetchAbort === abortController) {
      activePrefetchAbort = null;
    }
  });

  prefetchInflight.set(key, task);
  return task;
}
