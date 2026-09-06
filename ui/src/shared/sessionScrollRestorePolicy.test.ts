import { describe, expect, it } from 'vitest';
import { resolveSessionScrollDecision } from './sessionScrollRestorePolicy';

const base = {
  enabled: true,
  uiScrollTop: 420,
  uiScrollCapturedAt: Date.now(),
  hasEverVisited: true,
  wasNearBottomAtLeave: false,
  searchScrollActive: false,
  isLoadingSessionMessages: false,
  messageCount: 12,
  pendingScrollRestore: false,
};

describe('resolveSessionScrollDecision', () => {
  it('keeps scroll during search navigation', () => {
    expect(resolveSessionScrollDecision({ ...base, searchScrollActive: true }).action).toBe('keep');
  });

  it('keeps scroll while loading older messages restore is pending', () => {
    expect(resolveSessionScrollDecision({ ...base, pendingScrollRestore: true }).action).toBe('keep');
  });

  it('keeps scroll while session messages are loading', () => {
    expect(resolveSessionScrollDecision({ ...base, isLoadingSessionMessages: true }).action).toBe('keep');
  });

  it('scrolls to bottom on first visit', () => {
    expect(resolveSessionScrollDecision({ ...base, hasEverVisited: false }).action).toBe('scrollBottom');
  });

  it('scrolls to bottom when user left near bottom', () => {
    expect(resolveSessionScrollDecision({ ...base, wasNearBottomAtLeave: true }).action).toBe('scrollBottom');
  });

  it('restores prior scroll position when mid-read', () => {
    const decision = resolveSessionScrollDecision(base);
    expect(decision).toEqual({ action: 'restore', scrollTop: 420 });
  });

  it('falls back to bottom when restore disabled', () => {
    expect(resolveSessionScrollDecision({ ...base, enabled: false }).action).toBe('scrollBottom');
  });

  it('falls back to bottom when message list is empty', () => {
    expect(resolveSessionScrollDecision({ ...base, messageCount: 0 }).action).toBe('scrollBottom');
  });
});
