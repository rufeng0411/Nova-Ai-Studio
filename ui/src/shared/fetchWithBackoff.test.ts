import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../utils/api', () => ({
  authenticatedFetch: vi.fn(),
}));

import { authenticatedFetch } from '../utils/api';
import { fetchWithBackoff, isRetryableBackpressureStatus } from './fetchWithBackoff';

describe('fetchWithBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(authenticatedFetch).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries 503 with Retry-After header', async () => {
    vi.mocked(authenticatedFetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: false }), { status: 503, headers: { 'Retry-After': '1' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const pending = fetchWithBackoff('/api/test', { credentials: 'include' }, { maxJitterMs: 0 });
    await vi.runAllTimersAsync();
    const { response, attempts } = await pending;

    expect(response.status).toBe(200);
    expect(attempts).toBe(2);
    expect(authenticatedFetch).toHaveBeenCalledTimes(2);
  });

  it('classifies retryable statuses', () => {
    expect(isRetryableBackpressureStatus(503)).toBe(true);
    expect(isRetryableBackpressureStatus(429)).toBe(true);
    expect(isRetryableBackpressureStatus(404)).toBe(false);
  });
});
