import { describe, expect, it, beforeEach } from 'vitest';
import {
  readSessionTailCache,
  writeSessionTailCache,
  invalidateSessionTailCache,
  SESSION_TAIL_CACHE_VERSION,
} from './sessionMessageTailCache';
import type { NormalizedMessage } from './useSessionStore';

const sampleMessage = (id: string): NormalizedMessage => ({
  id,
  sessionId: 'web:s_test',
  timestamp: '2026-06-29T00:00:00.000Z',
  provider: 'pilotdeck',
  kind: 'text',
  role: 'user',
  content: `hello ${id}`,
});

describe('sessionMessageTailCache', () => {
  beforeEach(() => {
    invalidateSessionTailCache('web:s_test', 'general');
  });

  it('writes and reads tail cache entry', () => {
    writeSessionTailCache({
      sessionId: 'web:s_test',
      projectName: 'general',
      messages: [sampleMessage('m1')],
      total: 5,
      hasMore: true,
      loadedRange: { start: 0, end: 5 },
    });
    const entry = readSessionTailCache('web:s_test', 'general');
    expect(entry?.v).toBe(SESSION_TAIL_CACHE_VERSION);
    expect(entry?.messages).toHaveLength(1);
    expect(entry?.total).toBe(5);
  });

  it('returns null for mismatched session', () => {
    writeSessionTailCache({
      sessionId: 'web:s_test',
      projectName: 'general',
      messages: [sampleMessage('m1')],
      total: 1,
      hasMore: false,
      loadedRange: { start: 0, end: 1 },
    });
    expect(readSessionTailCache('web:s_other', 'general')).toBeNull();
  });
});
