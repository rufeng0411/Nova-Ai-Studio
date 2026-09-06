/**
 * PD-SAAS-FORK: Captcha store — Redis with in-memory fallback.
 */
import crypto from 'node:crypto';
import { captchaKey } from '../cache/cacheKeys.js';
import { cacheDel, cacheGet, cacheSet, getDefaultTtl } from '../cache/redisClient.js';

const TTL_MS = 5 * 60 * 1000;

/** @type {Map<string, { answer: string, expiresAt: number }>} */
const legacyMemoryStore = new Map();

function purgeLegacyExpired() {
  const now = Date.now();
  for (const [id, entry] of legacyMemoryStore.entries()) {
    if (entry.expiresAt <= now) legacyMemoryStore.delete(id);
  }
}

function randomChallenge(length = 4) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return out;
}

export async function createCaptchaChallenge() {
  purgeLegacyExpired();
  const captchaId = crypto.randomUUID();
  const challenge = randomChallenge();
  const answer = challenge.toLowerCase();
  await cacheSet(captchaKey(captchaId), { answer }, getDefaultTtl('captcha'));
  legacyMemoryStore.set(captchaId, { answer, expiresAt: Date.now() + TTL_MS });
  return { captchaId, challenge };
}

export async function verifyCaptcha(captchaId, captchaAnswer) {
  purgeLegacyExpired();
  if (!captchaId || !captchaAnswer) return false;
  const id = String(captchaId);
  const normalized = String(captchaAnswer).trim().toLowerCase();

  const cached = await cacheGet(captchaKey(id));
  await cacheDel(captchaKey(id));

  if (cached && typeof cached === 'object' && cached.answer === normalized) {
    legacyMemoryStore.delete(id);
    return true;
  }

  const legacy = legacyMemoryStore.get(id);
  if (legacy) {
    legacyMemoryStore.delete(id);
    return legacy.answer === normalized;
  }
  return false;
}

export function resetCaptchaStoreForTests() {
  legacyMemoryStore.clear();
}
