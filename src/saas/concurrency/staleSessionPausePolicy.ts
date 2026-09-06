// PD-SAAS-FORK: auto-pause stale incomplete sessions + block UI auto-continue until user acts.

export const DEFAULT_STALE_SESSION_PAUSE_MS = 24 * 60 * 60 * 1000;

export const STALE_AUTO_PAUSE_REASON = "auto_stale_24h";

export type SessionExecutionStatus = "idle" | "queued" | "running" | "paused" | string;

export function resolveStaleSessionPauseMs(
  env: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {},
): number {
  const raw = env.PILOTDECK_STALE_SESSION_PAUSE_MS
    ?? env.VITE_PILOTDECK_STALE_SESSION_PAUSE_MS;
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_STALE_SESSION_PAUSE_MS;
}

export function parseSessionLastActivityMs(
  value: string | number | null | undefined,
): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function isSessionStale(
  lastActivityMs: number | null,
  nowMs: number,
  pauseMs: number = DEFAULT_STALE_SESSION_PAUSE_MS,
): boolean {
  if (lastActivityMs == null || !Number.isFinite(lastActivityMs)) return false;
  return nowMs - lastActivityMs >= pauseMs;
}

export function isExecutionStatusActive(status: SessionExecutionStatus | undefined): boolean {
  return status === "queued" || status === "running";
}

export type StaleCatalogRowLike = {
  executionStatus?: SessionExecutionStatus;
  lastActivityAt?: string | number | null;
  pausedReason?: string | null;
};

/** Server: queued/running rows older than the pause window should be auto-paused. */
export function shouldAutoPauseStaleCatalogRow(
  row: StaleCatalogRowLike,
  nowMs: number,
  pauseMs: number = DEFAULT_STALE_SESSION_PAUSE_MS,
): boolean {
  if (row.executionStatus === "paused") return false;
  if (!isExecutionStatusActive(row.executionStatus)) return false;
  const lastMs = parseSessionLastActivityMs(row.lastActivityAt ?? null);
  return isSessionStale(lastMs, nowMs, pauseMs);
}

export type UiAutoContinueGateInput = {
  executionStatus?: SessionExecutionStatus;
  lastActivityMs?: number | null;
  userAcknowledgedComplete?: boolean;
  /** True only while a user-composed turn is being submitted (not synthetic auto-continue). */
  userInitiatedTurnPending?: boolean;
  /** When true, queued status blocks UI auto-continue (recovery/incomplete paths pass false). */
  syntheticAutoContinue?: boolean;
  nowMs?: number;
  pauseMs?: number;
};

/**
 * UI/engine-initiated auto-continue (recovery, cold resume, stale fallback) must not fire
 * when the user paused the session or when the task is older than the stale window.
 */
export function shouldBlockUiAutoContinue(input: UiAutoContinueGateInput): boolean {
  if (input.userInitiatedTurnPending) return false;
  if (input.userAcknowledgedComplete) return true;
  if (input.executionStatus === "paused") return true;
  // Queued: only block synthetic auto-continue — user-initiated turns bypass via userInitiatedTurnPending.
  if (input.executionStatus === "queued" && input.syntheticAutoContinue !== false) {
    return true;
  }
  const nowMs = input.nowMs ?? Date.now();
  const pauseMs = input.pauseMs ?? DEFAULT_STALE_SESSION_PAUSE_MS;
  if (isSessionStale(input.lastActivityMs ?? null, nowMs, pauseMs)) {
    return true;
  }
  return false;
}
