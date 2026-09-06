import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {

  isAutoSidebarCompleteOnPassEnabled,

  isSessionTerminalGateEnabled,

  resolveSessionTerminalComplete,

} from './sessionTerminalComplete';



describe('sessionTerminalComplete', () => {

  beforeEach(() => {

    vi.stubEnv('VITE_SESSION_TERMINAL_GATE', '1');

    vi.stubEnv('VITE_AUTO_SIDEBAR_COMPLETE_ON_PASS', '1');

  });



  afterEach(() => {

    vi.unstubAllEnvs();

  });



  it('returns non-terminal when gate flag is off', () => {

    vi.stubEnv('VITE_SESSION_TERMINAL_GATE', '0');

    const result = resolveSessionTerminalComplete({

      latestTurnAcceptanceMeta: { acceptanceStatus: 'passed' },

    });

    expect(result.terminal).toBe(false);

  });



  it('sidebar completed is terminal', () => {

    const result = resolveSessionTerminalComplete({

      sessionSidebarCompleted: true,

      latestTurnAcceptanceMeta: { acceptanceStatus: 'needs_repair' },

    });

    expect(result).toMatchObject({ terminal: true, reason: 'sidebar' });

    expect(result.shouldAutoMarkSidebarComplete).toBe(false);

  });



  it('envelope passed auto-marks sidebar but is not an invisible terminal lock', () => {

    const result = resolveSessionTerminalComplete({

      latestTurnAcceptanceMeta: { acceptanceStatus: 'passed' },

    });

    expect(result).toMatchObject({ terminal: false, reason: null });

    expect(result.shouldAutoMarkSidebarComplete).toBe(true);

  });



  it('prefers envelope passed for auto-mark over message scan needs_repair', () => {

    const result = resolveSessionTerminalComplete({

      latestTurnAcceptanceMeta: { acceptanceStatus: 'passed' },

      lastAssistantAcceptanceStatus: 'needs_repair',

    });

    expect(result.terminal).toBe(false);

    expect(result.shouldAutoMarkSidebarComplete).toBe(true);

  });



  it('falls back to message scan passed for auto-mark when envelope missing', () => {

    const result = resolveSessionTerminalComplete({

      lastAssistantAcceptanceStatus: 'passed',

    });

    expect(result).toMatchObject({ terminal: false, reason: null, shouldAutoMarkSidebarComplete: true });

  });



  it('user ack auto-marks sidebar without invisible terminal', () => {

    const result = resolveSessionTerminalComplete({

      userAcknowledgedComplete: true,

      lastAssistantAcceptanceStatus: 'needs_repair',

    });

    expect(result).toMatchObject({ terminal: false, reason: null, shouldAutoMarkSidebarComplete: true });

  });



  it('circuit breaker is not terminal — user may manually resume', () => {

    const result = resolveSessionTerminalComplete({

      latestTurnAcceptanceMeta: {

        acceptanceStatus: 'needs_repair',

        circuitBreakerTripped: true,

      },

    });

    expect(result).toMatchObject({ terminal: false, reason: null });

    expect(result.shouldAutoMarkSidebarComplete).toBe(false);

  });



  it('certificate complete auto-marks sidebar without invisible terminal', () => {

    const result = resolveSessionTerminalComplete({

      latestTurnAcceptanceMeta: {

        acceptanceStatus: 'needs_repair',

        completionState: 'complete',

      },

    });

    expect(result).toMatchObject({ terminal: false, reason: null, shouldAutoMarkSidebarComplete: true });

  });



  it('needs_repair alone is not terminal', () => {

    const result = resolveSessionTerminalComplete({

      latestTurnAcceptanceMeta: { acceptanceStatus: 'needs_repair' },

    });

    expect(result.terminal).toBe(false);

  });



  it('passed does not auto-mark while required SDM slots remain pending', () => {

    const result = resolveSessionTerminalComplete({

      latestTurnAcceptanceMeta: { acceptanceStatus: 'passed' },

      deliverableProgressIncomplete: true,

    });

    expect(result.terminal).toBe(false);

    expect(result.shouldAutoMarkSidebarComplete).toBe(false);

  });



  it('passed does not auto-mark after user revoked sidebar complete', () => {

    const result = resolveSessionTerminalComplete({

      userRevokedSidebarComplete: true,

      latestTurnAcceptanceMeta: { acceptanceStatus: 'passed' },

      userAcknowledgedComplete: true,

    });

    expect(result.terminal).toBe(false);

    expect(result.shouldAutoMarkSidebarComplete).toBe(false);

  });



  it('feature flag helpers default on', () => {

    expect(isSessionTerminalGateEnabled()).toBe(true);

    expect(isAutoSidebarCompleteOnPassEnabled()).toBe(true);

  });

});

