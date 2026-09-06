// PD-SAAS-FORK: only surface "continue" UX after a formal multi-retry stop — not mid-task.

/** Engine codes that mean the turn formally stopped after repeated recovery. */
export function isFormalRecoveryInterruptCode(code?: string | null): boolean {
  return code === 'agent_tool_error_loop' || code === 'recovery_exhausted';
}

export function shouldShowFormalRecoveryGuidance(options: {
  autoContinueEnabled: boolean;
  isAssistantWorking?: boolean;
  errorCode?: string | null;
  isTurnFinalPause: boolean;
  isPermission: boolean;
}): boolean {
  if (options.isPermission) return false;
  if (options.autoContinueEnabled) return false;
  if (options.isAssistantWorking) return false;
  if (!options.isTurnFinalPause) return false;
  return isFormalRecoveryInterruptCode(options.errorCode);
}

/** @deprecated Prefer shouldShowRecoveryErrorInThread — kept for tests. */
export function shouldHideTransientRecoveryNotice(options: {
  autoContinueEnabled: boolean;
  isPermission: boolean;
  isAssistantWorking?: boolean;
  showFormalGuidance: boolean;
  isUnifiedRecoveryCopy?: boolean;
}): boolean {
  if (options.showFormalGuidance || options.isPermission) return false;
  if (options.isUnifiedRecoveryCopy) {
    return options.autoContinueEnabled || Boolean(options.isAssistantWorking);
  }
  if (!options.autoContinueEnabled) return false;
  return Boolean(options.isAssistantWorking);
}
