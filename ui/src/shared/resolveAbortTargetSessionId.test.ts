import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isTemporarySessionId,
  processingSessionsHas,
  resolveAbortTargetSessionId,
} from './resolveAbortTargetSessionId';

describe('resolveAbortTargetSessionId', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    });
  });

  it('skips temporary session ids and picks the first real id', () => {
    expect(
      resolveAbortTargetSessionId({
        currentSessionId: 'new-session-123',
        pendingViewSessionId: 'web-s_abc',
        selectedSessionId: 'web-s_def',
      }),
    ).toBe('web-s_abc');
  });

  it('reads realSessionId from pending session intents', () => {
    localStorage.setItem(
      'pilotdeck:pendingSessionIntents',
      JSON.stringify([{
        optimisticId: 'new-session-1',
        projectKey: 'general',
        realSessionId: 'web-s_from-intent',
        ts: Date.now(),
      }]),
    );

    expect(
      resolveAbortTargetSessionId({
        currentSessionId: 'new-session-1',
      }),
    ).toBe('web-s_from-intent');
  });

  it('falls back to processing session ids', () => {
    expect(
      resolveAbortTargetSessionId({
        currentSessionId: 'new-session-9',
        processingSessionIds: ['web:s_running'],
      }),
    ).toBe('web:s_running');
  });

  it('processingSessionsHas matches web:s_ and web-s_ aliases', () => {
    const set = new Set(['web:s_alias']);
    expect(processingSessionsHas(set, 'web-s_alias')).toBe(true);
    expect(isTemporarySessionId('new-session-1')).toBe(true);
  });
});
