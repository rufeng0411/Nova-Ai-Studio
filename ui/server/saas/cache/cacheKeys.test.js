import test from 'node:test';
import assert from 'node:assert/strict';

import { sessionMessagesTailKey, sessionMessagesTailKeyPrefix } from './cacheKeys.js';
import { cacheGet, cacheSet, cacheDelByPattern, resetCacheForTests, getDefaultTtl } from './redisClient.js';

test('sessionMessagesTailKey includes tenant user session mtime cursor limit', () => {
  const key = sessionMessagesTailKey({
    tenantId: 'tenant-a',
    userId: 42,
    sessionId: 'web-s_abc',
    transcriptMtimeMs: 1710000000123,
    cursor: '80',
    limit: 120,
  });
  assert.match(key, /tenant-a/);
  assert.match(key, /42/);
  assert.match(key, /web-s_abc/);
  assert.match(key, /1710000000123/);
  assert.match(key, /:80:120$/);
});

test('sessionMessagesTailKeyPrefix scopes invalidate pattern', () => {
  const prefix = sessionMessagesTailKeyPrefix({
    tenantId: 'tenant-a',
    userId: 42,
    sessionId: 'web-s_abc',
  });
  assert.match(prefix, /messages:web-s_abc:\*$/);
});

test('cache hit/miss and invalidate for messages tail payload', async () => {
  resetCacheForTests();
  const key = sessionMessagesTailKey({
    tenantId: 't1',
    userId: 1,
    sessionId: 'web-s_x',
    transcriptMtimeMs: 100,
    cursor: 'tail',
    limit: 120,
  });
  const payload = { messages: [], total: 0, hasMore: false };
  assert.equal(await cacheGet(key), null);
  await cacheSet(key, payload, getDefaultTtl('messages'));
  assert.deepEqual(await cacheGet(key), payload);
  await cacheDelByPattern(sessionMessagesTailKeyPrefix({ tenantId: 't1', userId: 1, sessionId: 'web-s_x' }));
  assert.equal(await cacheGet(key), null);
});
