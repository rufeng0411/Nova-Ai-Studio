// PD-SAAS-FORK: cancel in-flight Bridge fetches on WS disconnect / offline so UI stays interactive.

const DEFAULT_FETCH_TIMEOUT_MS = 12_000;

const activeControllers = new Set<AbortController>();

export function getDefaultAuthenticatedFetchTimeoutMs(): number {
  const raw = import.meta.env.VITE_AUTHENTICATED_FETCH_TIMEOUT_MS;
  if (raw === undefined || raw === '') return DEFAULT_FETCH_TIMEOUT_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FETCH_TIMEOUT_MS;
}

export function registerNetworkAbortController(controller: AbortController): () => void {
  activeControllers.add(controller);
  return () => {
    activeControllers.delete(controller);
  };
}

export function cancelAllPendingNetworkRequests(reason = 'network-disconnected'): number {
  let cancelled = 0;
  for (const controller of activeControllers) {
    try {
      if (!controller.signal.aborted) {
        controller.abort(reason);
        cancelled += 1;
      }
    } catch {
      // ignore
    }
  }
  activeControllers.clear();
  return cancelled;
}

export function isAbortOrNetworkError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'AbortError' || error.name === 'TimeoutError';
  }
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') return true;
    const message = error.message.toLowerCase();
    if (
      message.includes('aborted')
      || message.includes('abort')
      || message.includes('timeout')
      || message.includes('network error')
      || message.includes('failed to fetch')
      || message.includes('networkrequestfailed')
      || message.includes('load failed')
    ) {
      return true;
    }
  }
  return false;
}

export type ManagedFetchInit = RequestInit & {
  /** Disable default timeout (long downloads / explicit caller signal only). */
  noTimeout?: boolean;
  /** Override default timeout when no caller `signal` is provided. */
  timeoutMs?: number;
};

export function createManagedFetchSignal(
  init: ManagedFetchInit = {},
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const unregister = registerNetworkAbortController(controller);
  const cleanups: Array<() => void> = [];

  if (init.signal) {
    const source = init.signal;
    if (source.aborted) {
      controller.abort(source.reason);
    } else {
      const onAbort = () => controller.abort(source.reason);
      source.addEventListener('abort', onAbort, { once: true });
      cleanups.push(() => source.removeEventListener('abort', onAbort));
    }
  }

  const timeoutMs = init.noTimeout
    ? 0
    : (init.timeoutMs ?? (init.signal ? 0 : getDefaultAuthenticatedFetchTimeoutMs()));

  if (timeoutMs > 0) {
    const timer = setTimeout(() => {
      controller.abort('fetch-timeout');
    }, timeoutMs);
    cleanups.push(() => clearTimeout(timer));
  }

  const cleanup = () => {
    for (const fn of cleanups) fn();
    unregister();
  };

  return { signal: controller.signal, cleanup };
}
