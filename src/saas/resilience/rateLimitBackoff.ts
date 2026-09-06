// PD-SAAS-FORK: shared 429 / rate-limit backoff helper

export type RateLimitBackoffOptions = {
  baseMs?: number;
  maxMs?: number;
  retryAfterHeaderMs?: number;
};

export function computeRateLimitDelayMs(
  attempt: number,
  options: RateLimitBackoffOptions = {},
): number {
  const base = options.baseMs ?? 1000;
  const max = options.maxMs ?? 30_000;
  if (options.retryAfterHeaderMs != null && options.retryAfterHeaderMs > 0) {
    return Math.min(max, options.retryAfterHeaderMs);
  }
  const exp = base * 2 ** Math.max(0, attempt - 1);
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(max, exp + jitter);
}

export function parseRetryAfterMs(header: string | null | undefined): number | undefined {
  if (!header) return undefined;
  const trimmed = header.trim();
  const asNum = Number(trimmed);
  if (Number.isFinite(asNum) && asNum >= 0) {
    return Math.floor(asNum * 1000);
  }
  const dateMs = Date.parse(trimmed);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return undefined;
}

export function isRateLimitMessage(message: string): boolean {
  return /(?:rate limit|too many requests|429|throttl)/i.test(message);
}
