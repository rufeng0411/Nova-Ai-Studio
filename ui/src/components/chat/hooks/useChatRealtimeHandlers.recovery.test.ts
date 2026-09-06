import { describe, expect, it } from 'vitest';

import {
  buildRecoveryTurnCompleteOutcome,
  shouldSuppressRecoveryForRealtimeError,
} from './useChatRealtimeHandlers';

describe('useChatRealtimeHandlers recovery normalization', () => {
  it('preserves recovery owner and deliverable evidence fields', () => {
    expect(buildRecoveryTurnCompleteOutcome({
      exitCode: 1,
      aborted: true,
      userAborted: false,
      success: false,
      budgetRemaining: 2,
      interruptKind: 'infra',
      missingPaths: ['artifacts/brief.docx'],
      verifiedPaths: ['artifacts/research.md'],
      recoveryOwner: 'deliverable_repair',
    }, 'turn-fallback')).toEqual({
      exitCode: 1,
      aborted: true,
      userAborted: false,
      success: false,
      budgetRemaining: 2,
      interruptKind: 'infra',
      missingPaths: ['artifacts/brief.docx'],
      verifiedPaths: ['artifacts/research.md'],
      lastTurnId: 'turn-fallback',
      recoveryOwner: 'deliverable_repair',
    });
  });

  it('suppresses recovery auto-continue for session_busy internal races', () => {
    expect(shouldSuppressRecoveryForRealtimeError({
      code: 'session_busy',
      message: 'Session web-s_1 already has an active turn.',
      recoverable: true,
    })).toBe(true);
  });
});
