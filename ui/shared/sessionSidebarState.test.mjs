import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearSessionSidebarState,
  isSessionSidebarCompleted,
  isSessionSidebarLocked,
  isSessionSidebarRevokedAutoComplete,
  normalizeSessionIdKey,
  readSessionSidebarStateMap,
  SESSION_SIDEBAR_STATE_STORAGE_KEY,
  setSessionSidebarCompleted,
  setSessionSidebarLocked,
  toggleSessionSidebarCompleted,
  toggleSessionSidebarLocked,
} from './sessionSidebarState.mjs';

describe('sessionSidebarState', () => {
  beforeEach(() => {
    localStorage.removeItem(SESSION_SIDEBAR_STATE_STORAGE_KEY);
  });

  it('normalizes web:s_ session ids to web-s_ storage key', () => {
    expect(normalizeSessionIdKey('web:s_abc')).toBe('web-s_abc');
    expect(normalizeSessionIdKey('web-s_abc')).toBe('web-s_abc');
  });

  it('tracks completed and locked independently', () => {
    setSessionSidebarCompleted('web:s_a', true);
    setSessionSidebarLocked('web:s_a', true);
    expect(isSessionSidebarCompleted('web-s_a')).toBe(true);
    expect(isSessionSidebarLocked('web:s_a')).toBe(true);

    setSessionSidebarLocked('web:s_a', false);
    expect(isSessionSidebarLocked('web:s_a')).toBe(false);
    expect(isSessionSidebarCompleted('web:s_a')).toBe(true);

    toggleSessionSidebarCompleted('web:s_a');
    expect(isSessionSidebarCompleted('web:s_a')).toBe(false);
    expect(isSessionSidebarRevokedAutoComplete('web:s_a')).toBe(true);
    expect(readSessionSidebarStateMap()['web-s_a']).toMatchObject({ revokedAutoComplete: true });

    toggleSessionSidebarCompleted('web:s_a');
    expect(isSessionSidebarCompleted('web:s_a')).toBe(true);
    expect(isSessionSidebarRevokedAutoComplete('web:s_a')).toBe(false);
  });

  it('clears all flags for a session', () => {
    setSessionSidebarLocked('web:s_b', true);
    clearSessionSidebarState('web-s_b');
    expect(isSessionSidebarLocked('web:s_b')).toBe(false);
  });

  it('toggle helpers return the new boolean state', () => {
    expect(toggleSessionSidebarCompleted('web:s_c')).toBe(true);
    expect(toggleSessionSidebarCompleted('web:s_c')).toBe(false);
    expect(toggleSessionSidebarLocked('web:s_c')).toBe(true);
    expect(toggleSessionSidebarLocked('web:s_c')).toBe(false);
  });
});
