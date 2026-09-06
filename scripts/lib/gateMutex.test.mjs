/**
 * PD-SAAS-FORK: gateMutex unit tests
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import {
  acquireGateLock,
  assertGatePhaseAllowed,
  readGateLock,
  releaseGateLock,
} from './gateMutex.mjs';

const tmpLocks = [];

function tmpLock() {
  const p = path.join(os.tmpdir(), `gate-mutex-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  tmpLocks.push(p);
  return p;
}

afterEach(() => {
  for (const p of tmpLocks) {
    try {
      fs.unlinkSync(p);
    } catch {
      // ignore
    }
  }
  tmpLocks.length = 0;
});

describe('gateMutex', () => {
  it('acquire and release', () => {
    const lockPath = tmpLock();
    const a = acquireGateLock({ lockPath, phase: 'e2e', holder: 'test' });
    assert.equal(a.ok, true);
    const lock = readGateLock(lockPath);
    assert.equal(lock?.phase, 'e2e');
    const r = releaseGateLock({ lockPath });
    assert.equal(r.ok, true);
    assert.equal(readGateLock(lockPath), null);
  });

  it('blocks conflicting phase while alive', () => {
    const lockPath = tmpLock();
    acquireGateLock({ lockPath, phase: 'e2e', holder: 'test-a' });
    const check = assertGatePhaseAllowed('load', lockPath);
    assert.equal(check.ok, false);
    releaseGateLock({ lockPath });
  });

  it('allows same phase', () => {
    const lockPath = tmpLock();
    acquireGateLock({ lockPath, phase: 'offline', holder: 'test' });
    const check = assertGatePhaseAllowed('offline', lockPath);
    assert.equal(check.ok, true);
    releaseGateLock({ lockPath });
  });
});
