import { describe, expect, it } from 'vitest';

import { shouldSuppressStaleTurnFallback } from './staleTurnFallbackPolicy';

describe('shouldSuppressStaleTurnFallback', () => {
  it('suppresses when Bridge stale_idle already handled', () => {
    expect(shouldSuppressStaleTurnFallback({ bridgeStaleHandled: true })).toBe(true);
  });

  it('suppresses when recovery_pause while turn still loading', () => {
    expect(shouldSuppressStaleTurnFallback({
      isLoading: true,
      workingStatus: { statusKind: 'recovery_pause', text: 'recovery_pause' },
    })).toBe(true);
  });

  it('suppresses when recovery_handling scheduled', () => {
    expect(shouldSuppressStaleTurnFallback({
      isLoading: true,
      workingStatus: { statusKind: 'recovery_handling', text: 'recovery_handling' },
    })).toBe(true);
  });

  it('allows fallback when idle with no bridge recovery', () => {
    expect(shouldSuppressStaleTurnFallback({
      isLoading: true,
      workingStatus: { statusKind: 'thinking', text: 'thinking' },
    })).toBe(false);
  });

  it('suppresses when user marked sidebar complete', () => {
    expect(shouldSuppressStaleTurnFallback({
      userAcknowledgedComplete: true,
      isLoading: true,
    })).toBe(true);
  });

  it('suppresses when auto-continue is blocked (paused / stale)', () => {
    expect(shouldSuppressStaleTurnFallback({
      autoContinueBlocked: true,
      isLoading: true,
    })).toBe(true);
  });

  it('suppresses when model hard stop (欠费/鉴权)', () => {
    expect(shouldSuppressStaleTurnFallback({
      hardTurnStop: true,
      isLoading: true,
    })).toBe(true);
  });
});
