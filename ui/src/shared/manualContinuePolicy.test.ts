import { describe, expect, it } from 'vitest';
import { readDefaultAutoContinueEnabled, resolveManualContinueOffer } from './manualContinuePolicy';

describe('manualContinuePolicy', () => {
  it('readDefaultAutoContinueEnabled defaults to true', () => {
    expect(readDefaultAutoContinueEnabled()).toBe(true);
  });

  it('shows manual continue when auto is off and cold payload pending', () => {
    const offer = resolveManualContinueOffer({
      autoContinueEnabled: false,
      sessionId: 'web-s_test',
      isConnected: true,
      userActionBlocked: false,
      userAcknowledgedComplete: false,
      sessionTerminalComplete: false,
      autoContinueBlocked: false,
      circuitBreakerTripped: false,
      isLoading: false,
      isLoadingSessionMessages: false,
      sessionTaskPhase: 'idle',
      deliverableIncomplete: false,
      staleTurnPhase: null,
      pendingResumeMessage: '<task-resume>goal</task-resume>',
      pendingReason: 'cold_resume',
    });
    expect(offer.showButton).toBe(true);
    expect(offer.reason).toBe('cold_resume');
  });

  it('hides manual continue when auto-continue is enabled', () => {
    const offer = resolveManualContinueOffer({
      autoContinueEnabled: true,
      sessionId: 'web-s_test',
      isConnected: true,
      userActionBlocked: false,
      userAcknowledgedComplete: false,
      sessionTerminalComplete: false,
      autoContinueBlocked: false,
      circuitBreakerTripped: false,
      isLoading: false,
      isLoadingSessionMessages: false,
      sessionTaskPhase: 'deliverable_incomplete',
      deliverableIncomplete: true,
      staleTurnPhase: 'warn',
      pendingResumeMessage: 'continue',
      pendingReason: 'reconnect',
    });
    expect(offer.showButton).toBe(false);
  });

  it('shows manual continue when auto is off and circuit tripped with incomplete deliverable', () => {
    const offer = resolveManualContinueOffer({
      autoContinueEnabled: false,
      sessionId: 'web-s_test',
      isConnected: true,
      userActionBlocked: false,
      userAcknowledgedComplete: false,
      sessionTerminalComplete: false,
      autoContinueBlocked: false,
      circuitBreakerTripped: true,
      isLoading: false,
      isLoadingSessionMessages: false,
      sessionTaskPhase: 'deliverable_incomplete',
      deliverableIncomplete: true,
      staleTurnPhase: null,
      pendingResumeMessage: null,
      pendingReason: null,
    });
    expect(offer.showButton).toBe(true);
    expect(offer.reason).toBe('incomplete_deliverable');
  });
});
