import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkLoginRateLimit,
  resetLoginRateLimitMemoryForTests,
} from '../../ui/server/saas/auth/loginRateLimit.js';

describe('loginRateLimit', () => {
  beforeEach(() => {
    resetLoginRateLimitMemoryForTests();
  });

  it('returns 429 semantics after IP limit exceeded', async () => {
    let last;
    for (let i = 0; i < 11; i += 1) {
      last = await checkLoginRateLimit({ ip: '127.0.0.1', username: 'admin' });
    }
    assert.equal(last?.ok, false);
    assert.equal(last?.scope, 'ip');
    assert.ok((last?.retryAfterSec ?? 0) > 0);
  });
});
