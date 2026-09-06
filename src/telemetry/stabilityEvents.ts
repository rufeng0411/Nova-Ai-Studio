// PD-SAAS-FORK: fire-and-forget telemetry for the Codex-grade stability work.
//
// Mirrors recoveryTiming.ts: append-only JSONL, never throws to the caller, and is production-aware
// via DATA_ROOT (prod container -> /data/saas/telemetry; dev -> .saas-dev-data/telemetry). Used to
// observe how often the new safety paths fire BEFORE thresholds are tightened (observe, then tune).
//
// Browser-safe: no top-level node:fs / node:path imports (UI pulls sdmSlotMatching → this module).
// Node-only write uses dynamic import inside the async path.

import { stringifySanitizedForPersistence } from "../saas/security/urlRedaction.js";

export type StabilityEventName =
  | "transient_invisible_retry"
  | "cold_resume_fired"
  | "cold_resume_suppressed"
  | "degeneration_detected"
  | "degeneration_repaired"
  | "no_progress_nudge"
  | "no_progress_terminal"
  | "completion_gate_continue"
  | "plan_ledger_step"
  | "quality_defect_detected"
  | "tool_watchdog_timeout"
  | "stream_degeneration_truncated"
  | "tool_result_compacted"
  | "verification_pass_run"
  | "verification_llm_verdict"
  | "goal_stop_condition_applied"
  | "verification_repair_triggered"
  | "deliverable_validate_cache_hit"
  | "session_synthetic_budget_exhausted"
  | "binary_intent_gate_shadow"
  | "binary_intent_gate_applied"
  | "capability_scope_shadow"
  | "factual_premise_assessed"
  | "progress_false_pass"
  | "sequential_gate_blocked"
  | "assistant_completion_gate"
  | "tool_timing"
  | "sdm_heal_research_lite"
  | "research_docx_fuzzy_hit"
  | "distill_sdm_compiled"
  | "silent_add_blocked"
  | "open_html_min_sdm_observed"
  | "brief_contract_compiled"
  | "capability_context_inferred"
  | "sequential_gate_shadow"
  | "task_stage_overrun"
  | "task_stage_retry_hot"
  | "expensive_intent_conflict_shadow"
  | "expensive_intent_conflict_asked"
  | "expensive_intent_conflict_resolved"
  | "expensive_intent_conflict_fallback"
  | "kind_mention_sanitize_diff"
  | "read_skill_builtin_redirect";

export type StabilityEvent = {
  recordedAtMs: number;
  event: StabilityEventName;
  sessionId?: string;
  turnId?: string;
  /** Short reason / sub-classification, e.g. "fetch_failed", "stale_session", "table_repeat". */
  reason?: string;
  /** Optional small numeric/string context (counts, budgets). Keep free of file paths. */
  detail?: Record<string, string | number | boolean>;
};

function isNodeRuntime(): boolean {
  try {
    return typeof process !== "undefined"
      && typeof process.versions === "object"
      && typeof process.versions?.node === "string";
  } catch {
    return false;
  }
}

/** Browser-safe path join (mirrors node:path.join enough for telemetry log paths). */
function joinPath(...parts: string[]): string {
  const joined = parts
    .filter((p) => p != null && String(p).length > 0)
    .map((p, i) => {
      let s = String(p).replace(/\\/g, "/");
      if (i > 0) s = s.replace(/^\/+/, "");
      s = s.replace(/\/+$/, "");
      return s;
    })
    .join("/");
  const normalized = joined.replace(/\/+/g, "/");
  if (typeof process !== "undefined" && process.platform === "win32") {
    return normalized.replace(/\//g, "\\");
  }
  return normalized;
}

export function resolveStabilityLogPath(): string {
  if (!isNodeRuntime()) return "";
  const fromEnv = process.env.PILOTDECK_STABILITY_LOG?.trim();
  if (fromEnv) return fromEnv;
  const dataRoot = process.env.PILOTDECK_DATA_ROOT?.trim() || process.env.DATA_ROOT?.trim();
  if (dataRoot) {
    return joinPath(dataRoot, "telemetry", "stability-events.jsonl");
  }
  const cwd = typeof process.cwd === "function" ? process.cwd() : ".";
  return joinPath(cwd, ".saas-dev-data", "telemetry", "stability-events.jsonl");
}

/** Append-only; never throws to the caller (telemetry must not affect turn execution). */
export function recordStabilityEvent(
  event: Omit<StabilityEvent, "recordedAtMs"> & { recordedAtMs?: number },
): void {
  // PD-SAAS-FORK: UI / Vite client imports this via sdmSlotMatching — hard noop in browser.
  if (!isNodeRuntime()) return;

  const full: StabilityEvent = {
    recordedAtMs: event.recordedAtMs ?? Date.now(),
    event: event.event,
    ...(event.sessionId ? { sessionId: event.sessionId } : {}),
    ...(event.turnId ? { turnId: event.turnId } : {}),
    ...(event.reason ? { reason: event.reason } : {}),
    ...(event.detail ? { detail: event.detail } : {}),
  };
  // PD-SAAS-FORK P0-3: telemetry must not persist signed URLs or credentials.
  const line = `${stringifySanitizedForPersistence(full)}\n`;
  const logPath = resolveStabilityLogPath();
  if (!logPath) return;
  void (async () => {
    try {
      const { appendFile, mkdir } = await import("node:fs/promises");
      const { dirname, resolve } = await import("node:path");
      const abs = resolve(logPath);
      await mkdir(dirname(abs), { recursive: true });
      await appendFile(abs, line, "utf8");
    } catch {
      // swallow: telemetry must never break a turn
    }
  })();
}

/** PD-SAAS-FORK full-chain-speed P2-1: tool-level timing (also mirrored to turn-timing consumers). */
export function recordToolTimingEvent(input: {
  sessionId?: string;
  turnId?: string;
  toolName: string;
  durationMs: number;
  phase?: string;
}): void {
  recordStabilityEvent({
    event: "tool_timing",
    sessionId: input.sessionId,
    turnId: input.turnId,
    reason: input.toolName,
    detail: {
      tool_name: input.toolName,
      duration_ms: input.durationMs,
      ...(input.phase ? { phase: input.phase } : {}),
    },
  });
}

export async function loadStabilityEvents(
  logPath = resolveStabilityLogPath(),
): Promise<StabilityEvent[]> {
  if (!isNodeRuntime() || !logPath) return [];
  try {
    const { readFile } = await import("node:fs/promises");
    const { resolve } = await import("node:path");
    const raw = await readFile(resolve(logPath), "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as StabilityEvent);
  } catch {
    return [];
  }
}

export function summarizeStabilityByEvent(
  events: StabilityEvent[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const event of events) {
    const key = String(event.event || "unknown");
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}
