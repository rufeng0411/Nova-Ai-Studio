import { describe, expect, it } from 'vitest';
import { isSameSessionId, normalizeSessionId, sessionIdSetHas } from './sessionId';

describe('sessionId', () => {
  it('normalizes web:s_ to web-s_', () => {
    expect(normalizeSessionId('web:s_abc')).toBe('web-s_abc');
  });

  it('matches colon and dash session keys', () => {
    expect(isSameSessionId('web:s_abc', 'web-s_abc')).toBe(true);
  });

  it('sessionIdSetHas works across id forms', () => {
    const set = new Set(['web-s_xyz']);
    expect(sessionIdSetHas(set, 'web:s_xyz')).toBe(true);
  });
});
