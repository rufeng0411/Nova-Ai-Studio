import { describe, expect, it } from 'vitest';
import { evictColdBridgeSessionStates } from './bridgeSessionStateLru.js';

describe('bridgeSessionStateLru', () => {
  it('evicts oldest inactive sessions when over cap', () => {
    const sessionState = new Map([
      ['a', { active: false, lastActiveAt: 100 }],
      ['b', { active: false, lastActiveAt: 200 }],
      ['c', { active: true, lastActiveAt: 50 }],
    ]);
    evictColdBridgeSessionStates(sessionState, 2);
    expect(sessionState.has('a')).toBe(false);
    expect(sessionState.has('b')).toBe(true);
    expect(sessionState.has('c')).toBe(true);
  });
});
