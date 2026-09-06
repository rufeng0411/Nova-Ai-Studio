/** PD-SAAS-FORK: conversation deliverable context consistency — feature flags (default ON, set `0` to rollback). */

function envEnabled(key: string, defaultOn = true): boolean {
  const raw = import.meta.env[key];
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  if (raw === '1' || raw === 'true' || raw === 'on') return true;
  return defaultOn;
}

/** P0-A: latest conversation footer reads Dock pipeline rows only. */
export function isConversationDeliverableSyncEnabled(): boolean {
  return envEnabled('VITE_PILOTDECK_CONVERSATION_DELIVERABLE_SYNC', true);
}

/** P0-B: per-turn snapshot kernel rebuilds historical footer/export inline rows. */
export function isTurnSnapshotKernelEnabled(): boolean {
  return envEnabled('VITE_PILOTDECK_TURN_SNAPSHOT_KERNEL', true);
}

/** P0-C: terminal presentation gate for conversation/export (no checking at task end). */
export function isTerminalDeliverablePresentationEnabled(): boolean {
  return envEnabled('VITE_PILOTDECK_TERMINAL_DELIVERABLE_PRESENTATION', true);
}

/** P0-B Razer RCA: session-level sticky deliverable summary bar. */
export function isStickyDeliverableSummaryEnabled(): boolean {
  return envEnabled('VITE_PILOTDECK_STICKY_DELIVERABLE_SUMMARY', true);
}

/** PD-SAAS-FORK: keep sticky bar mounted during self-check / pipeline defer. `0` rolls back. */
export function isStickyDeliverableBarPersistEnabled(): boolean {
  return envEnabled('VITE_STICKY_DELIVERABLE_BAR_PERSIST', true);
}

/** P0-B Razer RCA: presentation-layer status monotonic lock. */
export function isDeliverableStatusLockEnabled(): boolean {
  return envEnabled('VITE_PILOTDECK_DELIVERABLE_STATUS_LOCK', true);
}

/** P1: warn-only invariant checks when conversation flags are partially disabled. */
export function isDeliverableContextInvariantWarnOnly(): boolean {
  return !isConversationDeliverableSyncEnabled()
    || !isTurnSnapshotKernelEnabled()
    || !isTerminalDeliverablePresentationEnabled();
}
