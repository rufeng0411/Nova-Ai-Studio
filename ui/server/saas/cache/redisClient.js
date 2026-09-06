/**
 * PD-SAAS-FORK: Redis client with in-memory fallback when REDIS_URL unset.
 */
import { createClient } from 'redis';

/** @type {import('redis').RedisClientType | null} */
let redisClient = null;
let connectPromise = null;
let redisUnavailable = false;

/** @type {Map<string, { value: unknown, expiresAt: number }>} */
const memoryStore = new Map();

function purgeMemoryExpired() {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.expiresAt <= now) memoryStore.delete(key);
  }
}

async function getRedis() {
  const url = process.env.REDIS_URL?.trim();
  if (!url || redisUnavailable) return null;
  if (redisClient?.isOpen) return redisClient;
  if (!connectPromise) {
    connectPromise = (async () => {
      try {
        const client = createClient({ url });
        client.on('error', (err) => {
          console.warn('[redis] client error:', err instanceof Error ? err.message : err);
        });
        await client.connect();
        redisClient = client;
        return client;
      } catch (err) {
        redisUnavailable = true;
        console.warn('[redis] unavailable, using memory fallback:', err instanceof Error ? err.message : err);
        return null;
      }
    })();
  }
  return connectPromise;
}

/**
 * @param {string} key
 * @returns {Promise<unknown | null>}
 */
export async function cacheGet(key) {
  const redis = await getRedis();
  if (redis) {
    try {
      const raw = await redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.warn('[redis] cacheGet failed:', err instanceof Error ? err.message : err);
    }
  }
  purgeMemoryExpired();
  const entry = memoryStore.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * @param {string} key
 * @param {unknown} value
 * @param {number} ttlSec
 */
export async function cacheSet(key, value, ttlSec) {
  const redis = await getRedis();
  if (redis) {
    try {
      const payload = JSON.stringify(value);
      if (ttlSec > 0) {
        await redis.setEx(key, ttlSec, payload);
      } else {
        await redis.set(key, payload);
      }
      return;
    } catch (err) {
      console.warn('[redis] cacheSet failed:', err instanceof Error ? err.message : err);
    }
  }
  memoryStore.set(key, {
    value,
    expiresAt: ttlSec > 0 ? Date.now() + ttlSec * 1000 : Number.MAX_SAFE_INTEGER,
  });
}

/**
 * @param {string} key
 */
export async function cacheDel(key) {
  const redis = await getRedis();
  if (redis) {
    try {
      await redis.del(key);
    } catch {
      // ignore
    }
  }
  memoryStore.delete(key);
}

/**
 * @param {string} pattern e.g. nova:prod:t:default:u:1:capabilities:*
 */
export async function cacheDelByPattern(pattern) {
  const redis = await getRedis();
  if (redis) {
    try {
      const keys = [];
      for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        keys.push(key);
        if (keys.length >= 200) break;
      }
      if (keys.length > 0) await redis.del(keys);
      return;
    } catch (err) {
      console.warn('[redis] cacheDelByPattern failed:', err instanceof Error ? err.message : err);
    }
  }
  const prefix = pattern.replace(/\*$/, '');
  for (const key of [...memoryStore.keys()]) {
    if (key.startsWith(prefix)) memoryStore.delete(key);
  }
}

export function resetCacheForTests() {
  memoryStore.clear();
  redisUnavailable = false;
  connectPromise = null;
  if (redisClient?.isOpen) {
    void redisClient.quit().catch(() => {});
  }
  redisClient = null;
}

export { getRedis };

export function getDefaultTtl(name) {
  const envMap = {
    capabilities: 'CACHE_TTL_CAPABILITIES_SEC',
    projects: 'CACHE_TTL_PROJECTS_SEC',
    plugins: 'CACHE_TTL_PLUGINS_SEC',
    processTemplates: 'CACHE_TTL_PROCESS_TEMPLATES_SEC',
    taskmaster: 'CACHE_TTL_TASKMASTER_SEC',
    messages: 'CACHE_TTL_MESSAGES_SEC',
  };
  const defaults = {
    capabilities: 600,
    projects: 60,
    plugins: 120,
    processTemplates: 3600,
    taskmaster: 120,
    messages: 120,
    captcha: 300,
  };
  const envKey = envMap[name];
  const raw = envKey ? process.env[envKey] : null;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return defaults[name] ?? 300;
}
