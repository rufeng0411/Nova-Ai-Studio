import { describe, expect, it } from 'vitest';
import {
  isFormalRecoveryInterruptCode,
  shouldHideTransientRecoveryNotice,
  shouldShowFormalRecoveryGuidance,
} from './formalRecoveryInterrupt';

describe('formalRecoveryInterrupt', () => {
  it('recognizes formal interrupt codes', () => {
    expect(isFormalRecoveryInterruptCode('agent_tool_error_loop')).toBe(true);
    expect(isFormalRecoveryInterruptCode('recovery_exhausted')).toBe(true);
    expect(isFormalRecoveryInterruptCode('tool_execution_failed')).toBe(false);
  });

  it('hides guidance while auto-continue or task is live', () => {
    expect(shouldShowFormalRecoveryGuidance({
      autoContinueEnabled: true,
      errorCode: 'agent_tool_error_loop',
      isTurnFinalPause: true,
      isPermission: false,
    })).toBe(false);
    expect(shouldShowFormalRecoveryGuidance({
      autoContinueEnabled: false,
      isAssistantWorking: true,
      errorCode: 'agent_tool_error_loop',
      isTurnFinalPause: true,
      isPermission: false,
    })).toBe(false);
  });

  it('shows guidance only for formal stop without auto-continue', () => {
    expect(shouldShowFormalRecoveryGuidance({
      autoContinueEnabled: false,
      isAssistantWorking: false,
      errorCode: 'agent_tool_error_loop',
      isTurnFinalPause: true,
      isPermission: false,
    })).toBe(true);
    expect(shouldShowFormalRecoveryGuidance({
      autoContinueEnabled: false,
      isAssistantWorking: false,
      errorCode: 'tool_execution_failed',
      isTurnFinalPause: true,
      isPermission: false,
    })).toBe(false);
  });

  it('hides unified recovery copy in-thread while auto-continue is on', () => {
    expect(shouldHideTransientRecoveryNotice({
      autoContinueEnabled: true,
      isPermission: false,
      isAssistantWorking: false,
      showFormalGuidance: false,
      isUnifiedRecoveryCopy: true,
    })).toBe(true);
    expect(shouldHideTransientRecoveryNotice({
      autoContinueEnabled: false,
      isPermission: false,
      isAssistantWorking: true,
      showFormalGuidance: false,
      isUnifiedRecoveryCopy: true,
    })).toBe(true);
    expect(shouldHideTransientRecoveryNotice({
      autoContinueEnabled: false,
      isPermission: false,
      isAssistantWorking: false,
      showFormalGuidance: false,
      isUnifiedRecoveryCopy: true,
    })).toBe(false);
  });
});
