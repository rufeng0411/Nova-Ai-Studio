/**
 * PD-SAAS-FORK: Per-user running turn slot registry (in-process + Redis fallback).
 * Session keys are stored canonical (`web-s_`); `web:s_` is treated as the same slot.
 */
import { getRedis } from '../cache/redisClient.js';
import {
  normalizeSessionId,
  sessionIdVariants,
} from '../conversation/normalizeSessionId.js';
import { resolveUserTurnLimit } from './turnQueueConfig.js';

/** @type {Map<string, Set<string>>} */
const inProcessSlots = new Map();

function slotKey(tenantId, userId) {
  return `${tenantId ?? 'local'}:${userId}`;
}

function getInProcessSet(key) {
  let set = inProcessSlots.get(key);
  if (!set) {
    set = new Set();
    inProcessSlots.set(key, set);
  }
  return set;
}

function canonicalSessionKey(sessionKey) {
  return normalizeSessionId(sessionKey);
}

const ACQUIRE_LUA = `
local key = KEYS[1]
local canonical = ARGV[1]
local alt = ARGV[2]
local limit = tonumber(ARGV[3])
local held = redis.call('SISMEMBER', key, canonical) == 1
  or (alt ~= '' and redis.call('SISMEMBER', key, alt) == 1)
if held then
  redis.call('SADD', key, canonical)
  if alt ~= '' then
    redis.call('SREM', key, alt)
  end
  return 2
end
local count = redis.call('SCARD', key)
if count >= limit then
  return 0
end
redis.call('SADD', key, canonical)
return 1
`;

/**
 * @param {{ tenantId?: string | null, userId: number, sessionKey: string, role?: string | null }} input
 */
export async function tryAcquireTurnSlot(input) {
  return (await acquireTurnSlotStatus(input)) !== 'full';
}

/**
 * @param {{ tenantId?: string | null, userId: number, sessionKey: string, role?: string | null }} input
 * @returns {Promise<'acquired'|'already_held'|'full'>}
 */
export async function acquireTurnSlotStatus(input) {
  const configuredLimit = resolveUserTurnLimit(input.role ?? null);
  const limit = Number.isFinite(configuredLimit) ? configuredLimit : Number.MAX_SAFE_INTEGER;
  const sessionKey = canonicalSessionKey(input.sessionKey);
  const variants = sessionIdVariants(sessionKey);
  const alt = variants.find((value) => value !== sessionKey) ?? '';

  const key = slotKey(input.tenantId, input.userId);
  const redis = await getRedis();
  if (redis) {
    try {
      const redisKey = `nova:turn-slots:${key}`;
      const result = await redis.eval(ACQUIRE_LUA, {
        keys: [redisKey],
        arguments: [sessionKey, alt, String(limit)],
      });
      if (Number(result) === 2) return 'already_held';
      return Number(result) === 1 ? 'acquired' : 'full';
    } catch (err) {
      console.warn('[turn-slot] redis acquire failed, falling back to in-process:', err instanceof Error ? err.message : err);
    }
  }

  const set = getInProcessSet(key);
  for (const variant of variants) {
    if (set.has(variant)) {
      set.add(sessionKey);
      if (variant !== sessionKey) set.delete(variant);
      return 'already_held';
    }
  }
  if (set.size >= limit) return 'full';
  set.add(sessionKey);
  return 'acquired';
}

/**
 * @param {{ tenantId?: string | null, userId: number, sessionKey: string }} input
 */
export async function releaseTurnSlot(input) {
  const key = slotKey(input.tenantId, input.userId);
  const variants = sessionIdVariants(input.sessionKey);
  const redis = await getRedis();
  if (redis) {
    try {
      const redisKey = `nova:turn-slots:${key}`;
      if (variants.length) {
        for (const variant of variants) {
          await redis.sRem(redisKey, variant);
        }
      }
      return;
    } catch (err) {
      console.warn('[turn-slot] redis release failed:', err instanceof Error ? err.message : err);
    }
  }
  const set = getInProcessSet(key);
  for (const variant of variants) {
    set.delete(variant);
  }
}

/**
 * @param {{ tenantId?: string | null, userId: number }} input
 */
export async function countTurnSlots(input) {
  const keys = await listTurnSlotSessionKeys(input);
  return keys.length;
}

/**
 * @param {{ tenantId?: string | null, userId: number }} input
 * @returns {Promise<string[]>}
 */
export async function listTurnSlotSessionKeys(input) {
  const key = slotKey(input.tenantId, input.userId);
  const redis = await getRedis();
  let members = [];
  if (redis) {
    try {
      const redisMembers = await redis.sMembers(`nova:turn-slots:${key}`);
      members = Array.isArray(redisMembers) ? redisMembers : [];
    } catch {
      members = [...getInProcessSlots(key)];
    }
  } else {
    members = [...getInProcessSlots(key)];
  }
  const unique = new Set();
  for (const member of members) {
    unique.add(canonicalSessionKey(member) || member);
  }
  return [...unique];
}

function getInProcessSlots(key) {
  return inProcessSlots.get(key) ?? new Set();
}

/** @param {{ tenantId?: string | null, userId: number }} input */
export async function clearTurnSlotsForUser(input) {
  const key = slotKey(input.tenantId, input.userId);
  const redis = await getRedis();
  if (redis) {
    try {
      await redis.del(`nova:turn-slots:${key}`);
    } catch {
      // ignore
    }
  }
  inProcessSlots.delete(key);
}

export function resetTurnSlotRegistryForTests() {
  inProcessSlots.clear();
}
