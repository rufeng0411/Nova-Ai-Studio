// PD-SAAS-FORK (P0-2): server-anchored cold-resume guard.
//
// Pure decision logic. The persistent attempt / last-fired state is supplied by the caller (the
// control plane), so this module stays unit-testable and degrades harmlessly when there is no
// control plane (single-machine OSS -> caller passes priorAttempts=0/lastFiredAtMs=null, and the
// endpoint is gated OFF anyway). It NEVER reads env or touches IO.
//
// A cold resume only fires when ALL hold:
//   - there is a genuinely-interrupted last turn (no turn_result),
//   - it is not blocked awaiting user action (Key / attachment / permission),
//   - it was interrupted recently (recency window: avoid auto-running long-abandoned sessions),
//   - the per-(session,turn) crash-loop budget is not exhausted,
//   - no cold resume was just fired (dedup window: multi-tab / refresh / double-load).

export type ColdResumeGuardConfig = {
  /** Only resume if the turn was interrupted within this window (ms). Guards against old sessions. */
  recencyWindowMs: number;
  /** Max cold-resume fires per (session, turn). Guards against crash loops re-firing forever. */
  maxAttempts: number;
  /** Suppress a re-fire within this window (ms). Guards against multi-tab / refresh double-fire. */
  dedupWindowMs: number;
};

export const DEFAULT_COLD_RESUME_CONFIG: ColdResumeGuardConfig = {
  recencyWindowMs: 30 * 60 * 1000,
  maxAttempts: 3,
  dedupWindowMs: 90 * 1000,
};

export type ColdResumeIncompleteInput = {
  turnId: string;
  blockedOn?: "permission" | "infra" | "unknown";
};

export type ColdResumeGuardInput = {
  /** Incomplete-turn summary from detectIncompleteTurn, or null if the last turn completed. */
  incomplete: ColdResumeIncompleteInput | null;
  /** Epoch ms of the incomplete turn's last activity (recency source: IncompleteTurnSummary.lastActivityAt). */
  lastActivityMs: number | null;
  nowMs: number;
  /** Persistent count of cold-resume fires already recorded for this (session, turn). */
  priorAttempts: number;
  /** Epoch ms of the most recent cold-resume fire for this (session, turn), or null. */
  lastFiredAtMs: number | null;
  /** True when the interrupted turn is awaiting user action (Key / attachment / permission). */
  userBlocked?: boolean;
  config?: Partial<ColdResumeGuardConfig>;
};

export type ColdResumeReason =
  | "allowed"
  | "disabled"
  | "no_control_plane"
  | "no_incomplete_turn"
  | "user_blocked"
  | "missing_timestamp"
  | "stale_outside_recency"
  | "budget_exhausted"
  | "recently_fired";

export type ColdResumeDecision = {
  allowed: boolean;
  reason: ColdResumeReason;
};

export function resolveColdResumeConfig(
  env: Record<string, string | undefined> = process.env,
): ColdResumeGuardConfig {
  return {
    recencyWindowMs: positiveIntFromEnv(
      env.PILOTDECK_COLD_RESUME_RECENCY_MS,
      DEFAULT_COLD_RESUME_CONFIG.recencyWindowMs,
    ),
    maxAttempts: positiveIntFromEnv(
      env.PILOTDECK_COLD_RESUME_MAX_ATTEMPTS,
      DEFAULT_COLD_RESUME_CONFIG.maxAttempts,
    ),
    dedupWindowMs: positiveIntFromEnv(
      env.PILOTDECK_COLD_RESUME_DEDUP_MS,
      DEFAULT_COLD_RESUME_CONFIG.dedupWindowMs,
    ),
  };
}

export function parseActivityMs(lastActivityAt: string | number | null | undefined): number | null {
  if (lastActivityAt == null) return null;
  if (typeof lastActivityAt === "number") {
    return Number.isFinite(lastActivityAt) ? lastActivityAt : null;
  }
  const parsed = Date.parse(lastActivityAt);
  return Number.isNaN(parsed) ? null : parsed;
}

export function decideColdResume(input: ColdResumeGuardInput): ColdResumeDecision {
  const cfg = { ...DEFAULT_COLD_RESUME_CONFIG, ...(input.config ?? {}) };

  if (!input.incomplete) {
    return { allowed: false, reason: "no_incomplete_turn" };
  }
  if (input.userBlocked || input.incomplete.blockedOn === "permission") {
    return { allowed: false, reason: "user_blocked" };
  }
  if (input.lastActivityMs == null || !Number.isFinite(input.lastActivityMs)) {
    return { allowed: false, reason: "missing_timestamp" };
  }
  if (input.nowMs - input.lastActivityMs > cfg.recencyWindowMs) {
    return { allowed: false, reason: "stale_outside_recency" };
  }
  if (input.priorAttempts >= cfg.maxAttempts) {
    return { allowed: false, reason: "budget_exhausted" };
  }
  if (input.lastFiredAtMs != null && input.nowMs - input.lastFiredAtMs < cfg.dedupWindowMs) {
    return { allowed: false, reason: "recently_fired" };
  }
  return { allowed: true, reason: "allowed" };
}

function positiveIntFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
