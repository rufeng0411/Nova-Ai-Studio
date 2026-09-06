import type { NormalizedMessage } from './useSessionStore';

export const TAIL_PAGE_INITIAL_LIMIT = 120;
export const TAIL_PAGE_MORE_LIMIT = 60;
/** PD-SAAS-FORK: bound tail/messages fetch so load-more cannot hang forever on wedged Bridge. */
export const SESSION_MESSAGES_FETCH_TIMEOUT_MS = 30_000;

export type LoadedRange = { start: number; end: number };

export function computeLoadedRangeAfterTailFetch(
  total: number,
  nextCursor: string | null | undefined,
): LoadedRange {
  const start = nextCursor ? Number.parseInt(nextCursor, 10) : 0;
  return {
    start: Number.isFinite(start) && start >= 0 ? start : 0,
    end: total,
  };
}

export function hasMoreFromLoadedRange(range: LoadedRange | null | undefined): boolean {
  return (range?.start ?? 0) > 0;
}

export function mergeTailRefreshMessages(
  existing: NormalizedMessage[],
  newTail: NormalizedMessage[],
  loadedRange: LoadedRange | null | undefined,
): NormalizedMessage[] {
  if (!loadedRange || loadedRange.start === 0) {
    return newTail;
  }
  const tailIds = new Set(newTail.map((message) => message.id));
  const prefix = existing.filter((message) => !tailIds.has(message.id));
  return [...prefix, ...newTail];
}

export type TailFetchQueryOpts = {
  limit?: number | null;
  offset?: number;
  cursor?: string;
  direction?: 'forward' | 'backward';
};

export function buildTailFetchQueryParams(
  opts: TailFetchQueryOpts,
  tailPagination: boolean,
  initialLimit = TAIL_PAGE_INITIAL_LIMIT,
): URLSearchParams {
  const params = new URLSearchParams();
  if (!tailPagination) {
    if (opts.limit !== null && opts.limit !== undefined) {
      params.append('limit', String(opts.limit));
      params.append('offset', String(opts.offset ?? 0));
    }
    return params;
  }

  if (opts.limit === null) {
    return params;
  }

  params.append('limit', String(opts.limit ?? initialLimit));
  params.append('direction', opts.direction ?? 'backward');
  if (opts.cursor) {
    params.append('cursor', opts.cursor);
  }
  return params;
}

export function buildTailFetchMoreParams(
  loadedRange: LoadedRange | null | undefined,
  limit = TAIL_PAGE_MORE_LIMIT,
): URLSearchParams {
  const params = new URLSearchParams();
  params.append('limit', String(limit));
  params.append('direction', 'backward');
  if (loadedRange && loadedRange.start > 0) {
    params.append('cursor', String(loadedRange.start));
  }
  return params;
}
