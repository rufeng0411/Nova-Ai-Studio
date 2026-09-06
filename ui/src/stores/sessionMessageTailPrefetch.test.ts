import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchWithBackoffMock = vi.fn();
const shouldAllowSidebarTailPrefetchMock = vi.fn(() => true);
const readSessionTailCacheMock = vi.fn(() => null);
const writeSessionTailCacheMock = vi.fn();
const getPrefetchGenerationMock = vi.fn(() => 0);

vi.mock('../constants/config', () => ({
  TAIL_MESSAGE_PAGINATION: true,
}));

vi.mock('../shared/fetchWithBackoff', () => ({
  fetchWithBackoff: (...args: unknown[]) => fetchWithBackoffMock(...args),
}));

vi.mock('./sessionMessagePrefetchGate', () => ({
  bumpPrefetchGeneration: vi.fn(),
  getActivePrimarySessionId: vi.fn(() => null),
  getPrefetchGeneration: () => getPrefetchGenerationMock(),
  shouldAllowSidebarTailPrefetch: () => shouldAllowSidebarTailPrefetchMock(),
}));

vi.mock('./sessionMessagePagination', () => ({
  buildTailFetchQueryParams: () => ({ limit: '120', direction: 'backward' }),
  computeLoadedRangeAfterTailFetch: () => ({ start: 0, end: 0 }),
  TAIL_PAGE_INITIAL_LIMIT: 120,
  SESSION_MESSAGES_FETCH_TIMEOUT_MS: 30_000,
}));

vi.mock('./sessionMessageTailCache', () => ({
  readSessionTailCache: (...args: unknown[]) => readSessionTailCacheMock(...args),
  writeSessionTailCache: (...args: unknown[]) => writeSessionTailCacheMock(...args),
}));

describe('prefetchSessionTailMessages', () => {
  beforeEach(() => {
    vi.resetModules();
    fetchWithBackoffMock.mockReset();
    shouldAllowSidebarTailPrefetchMock.mockReturnValue(true);
    readSessionTailCacheMock.mockReturnValue(null);
    fetchWithBackoffMock.mockResolvedValue({
      response: {
        ok: true,
        json: async () => ({ messages: [], total: 0, hasMore: false }),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips duplicate prefetch within fresh window', async () => {
    readSessionTailCacheMock.mockReturnValue({
      fetchedAt: Date.now(),
      messages: [{ id: 'm1' }],
      total: 1,
      hasMore: false,
      loadedRange: null,
    });
    const { prefetchSessionTailMessages } = await import('./sessionMessageTailPrefetch');
    await prefetchSessionTailMessages('web:s_a', { projectName: 'general' });
    expect(fetchWithBackoffMock).not.toHaveBeenCalled();
  });

  it('does not prefetch while primary session load is active', async () => {
    shouldAllowSidebarTailPrefetchMock.mockReturnValue(false);
    const { prefetchSessionTailMessages } = await import('./sessionMessageTailPrefetch');
    await prefetchSessionTailMessages('web:s_b', { projectName: 'general' });
    expect(fetchWithBackoffMock).not.toHaveBeenCalled();
  });

  it('fires network prefetch for cold session', async () => {
    const { prefetchSessionTailMessages } = await import('./sessionMessageTailPrefetch');
    await prefetchSessionTailMessages('web:s_c', { projectName: 'general' });
    expect(fetchWithBackoffMock).toHaveBeenCalledTimes(1);
  });
});
