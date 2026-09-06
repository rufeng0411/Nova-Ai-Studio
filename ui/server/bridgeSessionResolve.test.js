import { describe, expect, it } from 'vitest';

import {
  bridgeAbortSessionKeys,
  resolveBridgeSessionState,
} from './bridgeSessionResolve.js';

describe('bridgeSessionResolve', () => {
  it('resolveBridgeSessionState matches web-s_ lookup to web:s_ bridge key', () => {
    const sessionState = new Map([
      ['web:s_live', {
        sessionKey: 'web:s_live',
        runId: 'run-1',
        active: true,
      }],
    ]);

    const resolved = resolveBridgeSessionState(sessionState, 'web-s_live');
    expect(resolved?.sessionKey).toBe('web:s_live');
    expect(resolved?.state.runId).toBe('run-1');
  });

  it('bridgeAbortSessionKeys includes alias variants', () => {
    const sessionState = new Map([
      ['web:s_live', { sessionKey: 'web:s_live', active: true }],
    ]);
    const keys = bridgeAbortSessionKeys(sessionState, 'web-s_live');
    expect(keys).toContain('web:s_live');
    expect(keys).toContain('web-s_live');
  });
});
