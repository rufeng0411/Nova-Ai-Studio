// PD-SAAS-FORK: in-memory rate limit for marketing public APIs

/** @type {Map<string, { count: number, resetAt: number }>} */
const buckets = new Map();

function incr(key, windowSec) {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { count: 1, retryAfterSec: windowSec };
  }
  entry.count += 1;
  return {
    count: entry.count,
    retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

/**
 * @param {{ key: string, limit: number, windowSec: number }} opts
 */
export function checkMarketingRateLimit(opts) {
  const { key, limit, windowSec } = opts;
  const result = incr(key, windowSec);
  if (limit > 0 && result.count > limit) {
    return { ok: false, retryAfterSec: result.retryAfterSec };
  }
  return { ok: true };
}

export function resetMarketingRateLimitForTests() {
  buckets.clear();
}
