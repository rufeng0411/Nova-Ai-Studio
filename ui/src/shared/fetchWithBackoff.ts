/**
 * PD-SAAS-FORK: shared 503/429 backoff for messages + deliverable validate fetches.
 */
import { authenticatedFetch } from '../utils/api';

export type FetchWithBackoffOptions = {
  maxAttempts?: number;
  defaultRetryAfterMs?: number;
  maxJitterMs?: number;
};

export type FetchWithBackoffResult = {
  response: Response;
  attempts: number;
};

function parseRetryAfterMs(response: Response, defaultMs: number): number {
  const header = response.headers.get('Retry-After');
  if (!header) return defaultMs;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const dateMs = Date.parse(header);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return defaultMs;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function isRetryableBackpressureStatus(status: number): boolean {
  return status === 503 || status === 429;
}

export async function fetchWithBackoff(
  url: string,
  init: RequestInit,
  options: FetchWithBackoffOptions = {},
): Promise<FetchWithBackoffResult> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const defaultRetryAfterMs = options.defaultRetryAfterMs ?? 2000;
  const maxJitterMs = options.maxJitterMs ?? 500;

  let lastResponse: Response | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await authenticatedFetch(url, init);
    lastResponse = response;
    if (response.ok || !isRetryableBackpressureStatus(response.status)) {
      return { response, attempts: attempt };
    }
    if (attempt >= maxAttempts) break;
    const retryMs = parseRetryAfterMs(response, defaultRetryAfterMs);
    const jitter = Math.floor(Math.random() * (maxJitterMs + 1));
    await sleep(retryMs + jitter);
  }

  return { response: lastResponse!, attempts: maxAttempts };
}
