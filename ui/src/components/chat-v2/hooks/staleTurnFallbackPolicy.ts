// PD-SAAS-FORK: dedupe Bridge 120s stale abort vs UI 180s watchdog fallback
import type { AutoRecoveryStatus } from './useAutoRecoveryContinue';
import { isBridgeStaleIdleStatus, isRecoveryPauseStatus } from './useAutoRecoveryContinue';

export type StaleTurnFallbackSuppressInput = {
  bridgeStaleHandled?: boolean;
  /** User marked sidebar complete — never stale-abort+continue. */
  userAcknowledgedComplete?: boolean;
  /** UI incomplete-deliverable auto-continue armed for this turn. */
  pendingAutoContinue?: boolean;
  /** Engine recovery_pause / recovery_handling already scheduled UI continue. */
  recoveryContinuePending?: boolean;
  /** Paused / 24h-stale session — no stale abort+continue. */
  autoContinueBlocked?: boolean;
  /** PD-SAAS-FORK: model/auth hard stop — no synthetic stale continue. */
  hardTurnStop?: boolean;
  workingStatus?: AutoRecoveryStatus;
  isLoading?: boolean;
};

/** Bridge already aborted or UI recovery continue owns this turn — no second abort+submit. */
export function shouldSuppressStaleTurnFallback(input: StaleTurnFallbackSuppressInput): boolean {
  if (input.hardTurnStop) return true;
  if (input.userAcknowledgedComplete) return true;
  if (input.autoContinueBlocked) return true;
  if (input.bridgeStaleHandled) return true;
  if (input.pendingAutoContinue) return true;
  if (input.recoveryContinuePending) return true;
  const status = input.workingStatus;
  if (isBridgeStaleIdleStatus(status ?? null)) return true;
  if (input.isLoading && status?.statusKind === 'recovery_handling') return true;
  if (input.isLoading && isRecoveryPauseStatus(status ?? null)) return true;
  return false;
}
