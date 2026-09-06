import { describe, expect, it, vi } from 'vitest';
import {
  cancelAllPendingNetworkRequests,
  createManagedFetchSignal,
  isAbortOrNetworkError,
  registerNetworkAbortController,
} from './networkFetchRegistry';

describe('networkFetchRegistry', () => {
  it('cancels registered controllers', () => {
    const controller = new AbortController();
    registerNetworkAbortController(controller);
    expect(cancelAllPendingNetworkRequests('test')).toBe(1);
    expect(controller.signal.aborted).toBe(true);
  });

  it('detects abort and timeout errors', () => {
    expect(isAbortOrNetworkError(new DOMException('aborted', 'AbortError'))).toBe(true);
    expect(isAbortOrNetworkError(new Error('The operation was aborted'))).toBe(true);
    expect(isAbortOrNetworkError(new Error('HTTP 500'))).toBe(false);
  });

  it('aborts managed signal on timeout', async () => {
    vi.useFakeTimers();
    const { signal, cleanup } = createManagedFetchSignal({ timeoutMs: 1000 });
    const abortPromise = new Promise<string>((resolve) => {
      signal.addEventListener('abort', () => resolve(String(signal.reason)), { once: true });
    });
    vi.advanceTimersByTime(1001);
    await expect(abortPromise).resolves.toBe('fetch-timeout');
    cleanup();
    vi.useRealTimers();
  });
});
