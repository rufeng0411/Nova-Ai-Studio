/**
 * PD-SAAS-FORK: unpauseSession contract smoke — full DB integration in turn-queue lifecycle E2E.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('unpauseSession module', () => {
  it('exports unpauseSession function', async () => {
    const mod = await import('../../ui/server/saas/concurrency/turnAcceptanceService.js');
    assert.equal(typeof mod.unpauseSession, 'function');
  });
});

describe('queued synthetic reject policy', () => {
  it('blocks UI synthetic auto-continue when queued', async () => {
    const { shouldBlockUiAutoContinue } = await import('../../src/saas/concurrency/staleSessionPausePolicy.js');
    assert.equal(
      shouldBlockUiAutoContinue({
        executionStatus: 'queued',
        lastActivityMs: Date.now() - 60_000,
        syntheticAutoContinue: true,
      }),
      true,
    );
    assert.equal(
      shouldBlockUiAutoContinue({
        executionStatus: 'queued',
        lastActivityMs: Date.now() - 60_000,
        syntheticAutoContinue: false,
      }),
      false,
    );
  });
});
