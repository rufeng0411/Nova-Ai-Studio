#!/usr/bin/env node
/**
 * PD-SAAS-FORK: Cloud perf cache smoke — memory fallback + live Redis when reachable.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const requireFromUi = createRequire(join(dirname(fileURLToPath(import.meta.url)), '../ui/package.json'));
const { createClient } = requireFromUi('redis');
import { resetCacheForTests, cacheSet, cacheGet, getDefaultTtl } from '../ui/server/saas/cache/redisClient.js';
import { capabilitiesHubKey, captchaKey } from '../ui/server/saas/cache/cacheKeys.js';
import { createCaptchaChallenge, verifyCaptcha, resetCaptchaStoreForTests } from '../ui/server/saas/billing/captcha.js';
import { DEV_REDIS_URL, isRedisReachable } from './lib/devInfra.mjs';

async function testMemoryFallback() {
  const savedRedis = process.env.REDIS_URL;
  delete process.env.REDIS_URL;
  resetCacheForTests();
  resetCaptchaStoreForTests();

  const hubKey = capabilitiesHubKey({
    tenantId: 'default',
    userId: 1,
    projectPath: '/x',
    locale: 'zh-CN',
    catalogMtimeMs: 123,
    skillsRevision: 'hub',
  });
  await cacheSet(hubKey, { ok: true }, getDefaultTtl('capabilities'));
  const hubHit = await cacheGet(hubKey);
  assert.equal(hubHit?.ok, true);

  const { captchaId, challenge } = await createCaptchaChallenge();
  assert.ok(captchaKey(captchaId).includes('captcha:'));
  assert.equal(await verifyCaptcha(captchaId, challenge), true);

  if (savedRedis) process.env.REDIS_URL = savedRedis;
  console.log('[cloud-perf-smoke] PASS — memory fallback cache + captcha');
}

async function testLiveRedis(redisUrl) {
  process.env.REDIS_URL = redisUrl;
  process.env.REDIS_KEY_PREFIX = process.env.REDIS_KEY_PREFIX || 'nova:dev:test:';
  resetCacheForTests();
  resetCaptchaStoreForTests();

  const probeKey = capabilitiesHubKey({
    tenantId: 'cloud-perf',
    userId: 99,
    projectPath: '/probe',
    locale: 'zh-CN',
    catalogMtimeMs: Date.now(),
    skillsRevision: 'live',
  });
  const probeValue = { live: true, at: Date.now() };
  await cacheSet(probeKey, probeValue, 60);
  const fromApp = await cacheGet(probeKey);
  assert.deepEqual(fromApp, probeValue);

  const client = createClient({ url: redisUrl });
  await client.connect();
  try {
    const raw = await client.get(probeKey);
    assert.ok(raw, 'key missing in Redis — cache may still be using memory fallback');
    const parsed = JSON.parse(raw);
    assert.equal(parsed.live, true);

    const { captchaId, challenge } = await createCaptchaChallenge();
    const redisCaptchaKey = captchaKey(captchaId);
    const captchaRaw = await client.get(redisCaptchaKey);
    assert.ok(captchaRaw, 'captcha key should be stored in Redis');
    assert.equal(await verifyCaptcha(captchaId, challenge), true);
    await client.del(probeKey);
  } finally {
    await client.quit();
  }

  resetCacheForTests();
  console.log(`[cloud-perf-smoke] PASS — live Redis (${redisUrl})`);
}

async function main() {
  await testMemoryFallback();

  const redisUrl = process.env.REDIS_URL?.trim() || DEV_REDIS_URL;
  if (await isRedisReachable(redisUrl)) {
    await testLiveRedis(redisUrl);
  } else {
    console.warn(`[cloud-perf-smoke] SKIP live Redis — not reachable at ${redisUrl}`);
    console.warn('[cloud-perf-smoke] 运行 npm run dev:infra 或启动 Docker Desktop 后重试');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[cloud-perf-smoke] FAIL', err);
  process.exit(1);
});
