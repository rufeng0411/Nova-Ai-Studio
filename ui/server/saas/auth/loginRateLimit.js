/**
 * PD-SAAS-FORK: Redis-backed login/register rate limiting with in-memory fallback.
 */

const IP_LIMIT = Number(process.env.SAAS_LOGIN_RATE_IP_PER_MIN || 10);
const USER_LIMIT = Number(process.env.SAAS_LOGIN_RATE_USER_PER_MIN || 30);
const WINDOW_SEC = 60;

/** @type {Map<string, { count: number, resetAt: number }>} */
const memoryBuckets = new Map();

function memoryIncr(key, windowSec) {
  const now = Date.now();
  const entry = memoryBuckets.get(key);
  if (!entry || entry.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { count: 1, retryAfterSec: windowSec };
  }
  entry.count += 1;
  const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  return { count: entry.count, retryAfterSec };
}

async function incrBucket(key, windowSec) {
  return memoryIncr(key, windowSec);
}

/**
 * @param {{ ip?: string; username?: string }} input
 */
export async function checkLoginRateLimit(input) {
  const ip = input.ip?.trim() || 'unknown';
  const username = input.username?.trim().toLowerCase() || '';

  const ipKey = `ratelimit:login:ip:${ip}`;
  const ipResult = await incrBucket(ipKey, WINDOW_SEC);
  if (IP_LIMIT > 0 && ipResult.count > IP_LIMIT) {
    return {
      ok: false,
      retryAfterSec: ipResult.retryAfterSec,
      scope: 'ip',
    };
  }

  if (username) {
    const userKey = `ratelimit:login:user:${username}`;
    const userResult = await incrBucket(userKey, WINDOW_SEC);
    if (USER_LIMIT > 0 && userResult.count > USER_LIMIT) {
      return {
        ok: false,
        retryAfterSec: userResult.retryAfterSec,
        scope: 'user',
      };
    }
  }

  return { ok: true };
}

/** Test-only */
export function resetLoginRateLimitMemoryForTests() {
  memoryBuckets.clear();
}
