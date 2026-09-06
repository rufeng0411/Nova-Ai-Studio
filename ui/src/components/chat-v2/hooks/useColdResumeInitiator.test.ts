import { describe, expect, it } from 'vitest';
import { shouldProbeColdResume, type ColdResumeInitiatorState } from './useColdResumeInitiator';

function base(overrides: Partial<ColdResumeInitiatorState> = {}): ColdResumeInitiatorState {
  return {
    sessionId: 's1',
    enabled: true,
    autoContinueEnabled: true,
    isConnected: true,
    isLoading: false,
    isLoadingSessionMessages: false,
    hasMessages: true,
    alreadyAttempted: false,
    ...overrides,
  };
}

describe('shouldProbeColdResume', () => {
  it('probes on a settled cold load with history', () => {
    expect(shouldProbeColdResume(base())).toBe(true);
  });

  it('does not probe when disabled or auto-continue is off (auto mode)', () => {
    expect(shouldProbeColdResume(base({ enabled: false }))).toBe(false);
    expect(shouldProbeColdResume(base({ autoContinueEnabled: false }))).toBe(false);
    expect(shouldProbeColdResume(base({ autoContinueBlocked: true }))).toBe(false);
    expect(shouldProbeColdResume(base({ sessionTerminalComplete: true }))).toBe(false);
    expect(shouldProbeColdResume(base({ circuitBreakerTripped: true }))).toBe(false);
  });

  it('probes in manual mode when auto-continue is off', () => {
    expect(shouldProbeColdResume(base({ autoContinueEnabled: false, manualMode: true }))).toBe(true);
  });

  it('does not probe without a session or while disconnected', () => {
    expect(shouldProbeColdResume(base({ sessionId: null }))).toBe(false);
    expect(shouldProbeColdResume(base({ isConnected: false }))).toBe(false);
  });

  it('does not probe while a turn streams or messages still load (a live owner handles it)', () => {
    expect(shouldProbeColdResume(base({ isLoading: true }))).toBe(false);
    expect(shouldProbeColdResume(base({ isLoadingSessionMessages: true }))).toBe(false);
  });

  it('does not probe an empty conversation', () => {
    expect(shouldProbeColdResume(base({ hasMessages: false }))).toBe(false);
  });

  it('probes at most once per session', () => {
    expect(shouldProbeColdResume(base({ alreadyAttempted: true }))).toBe(false);
  });
});
