import { describe, expect, it } from 'vitest';
import {
  shouldBlockRecoveryAutoContinue,
  shouldBlockSessionAutoContinue,
} from './sessionAutoContinueGate';
import type { ProjectSession } from '../types/app';

function session(status: ProjectSession['executionStatus']): ProjectSession {
  return {
    id: 'web-s_test',
    name: 'Test',
    created_at: new Date().toISOString(),
    executionStatus: status,
  };
}

describe('sessionAutoContinueGate', () => {
  it('blocks generic auto-continue while catalog is queued', () => {
    expect(
      shouldBlockSessionAutoContinue({
        session: session('queued'),
        syntheticAutoContinue: true,
      }),
    ).toBe(true);
  });

  it('allows recovery auto-continue while catalog ghost-queued after refresh', () => {
    expect(
      shouldBlockRecoveryAutoContinue({
        session: session('queued'),
      }),
    ).toBe(false);
  });

  it('still blocks recovery when session is paused', () => {
    expect(
      shouldBlockRecoveryAutoContinue({
        session: session('paused'),
      }),
    ).toBe(true);
  });

  it('blocks auto-continue after user unmarks sidebar task complete', () => {
    expect(
      shouldBlockSessionAutoContinue({
        session: session('idle'),
        userRevokedSidebarComplete: true,
      }),
    ).toBe(true);
  });
});
