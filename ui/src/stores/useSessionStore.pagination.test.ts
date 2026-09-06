import { describe, expect, it } from 'vitest';
import {
  buildTailFetchMoreParams,
  buildTailFetchQueryParams,
  computeLoadedRangeAfterTailFetch,
  hasMoreFromLoadedRange,
  mergeTailRefreshMessages,
  TAIL_PAGE_INITIAL_LIMIT,
  TAIL_PAGE_MORE_LIMIT,
} from './sessionMessagePagination';
import type { NormalizedMessage } from './useSessionStore';

function msg(id: string): NormalizedMessage {
  return {
    id,
    sessionId: 'web:s_test',
    timestamp: '2026-06-09T00:00:00.000Z',
    provider: 'pilotdeck',
    kind: 'text',
    role: 'user',
    content: id,
  };
}

describe('sessionMessagePagination', () => {
  it('buildTailFetchQueryParams uses backward tail page when enabled', () => {
    const params = buildTailFetchQueryParams({ limit: TAIL_PAGE_INITIAL_LIMIT }, true);
    expect(params.get('direction')).toBe('backward');
    expect(params.get('limit')).toBe(String(TAIL_PAGE_INITIAL_LIMIT));
    expect(params.get('offset')).toBeNull();
  });

  it('buildTailFetchQueryParams keeps legacy offset paging when disabled', () => {
    const params = buildTailFetchQueryParams({ limit: 20, offset: 40 }, false);
    expect(params.get('limit')).toBe('20');
    expect(params.get('offset')).toBe('40');
    expect(params.get('direction')).toBeNull();
  });

  it('buildTailFetchMoreParams requests older page via cursor', () => {
    const params = buildTailFetchMoreParams({ start: 80, end: 200 }, TAIL_PAGE_MORE_LIMIT);
    expect(params.get('direction')).toBe('backward');
    expect(params.get('cursor')).toBe('80');
    expect(params.get('limit')).toBe(String(TAIL_PAGE_MORE_LIMIT));
  });

  it('computeLoadedRangeAfterTailFetch tracks transcript coordinates', () => {
    expect(computeLoadedRangeAfterTailFetch(200, '100')).toEqual({ start: 100, end: 200 });
    expect(computeLoadedRangeAfterTailFetch(50, undefined)).toEqual({ start: 0, end: 50 });
  });

  it('hasMoreFromLoadedRange is true until start reaches zero', () => {
    expect(hasMoreFromLoadedRange({ start: 60, end: 200 })).toBe(true);
    expect(hasMoreFromLoadedRange({ start: 0, end: 200 })).toBe(false);
  });

  it('mergeTailRefreshMessages keeps loaded prefix when refreshing tail only', () => {
    const existing = [msg('m-0'), msg('m-1'), msg('m-2')];
    const newTail = [msg('m-1'), msg('m-2'), msg('m-3')];
    const merged = mergeTailRefreshMessages(existing, newTail, { start: 1, end: 4 });
    expect(merged.map((m) => m.id)).toEqual(['m-0', 'm-1', 'm-2', 'm-3']);
  });

  it('backward pages prepend without overlap', () => {
    const first = [msg('m-100'), msg('m-101')];
    const older = [msg('m-80'), msg('m-81')];
    const combined = [...older, ...first];
    expect(combined.map((m) => m.id)).toEqual(['m-80', 'm-81', 'm-100', 'm-101']);
    expect(computeLoadedRangeAfterTailFetch(102, '80')).toEqual({ start: 80, end: 102 });
  });

  it('refreshFromServer uses tail limit even when loadedRange.start is zero', () => {
    const params = buildTailFetchQueryParams(
      { limit: TAIL_PAGE_INITIAL_LIMIT, direction: 'backward' },
      true,
      TAIL_PAGE_INITIAL_LIMIT,
    );
    expect(params.get('limit')).toBe(String(TAIL_PAGE_INITIAL_LIMIT));
    expect(params.get('direction')).toBe('backward');
    expect(params.get('offset')).toBeNull();
  });
});
