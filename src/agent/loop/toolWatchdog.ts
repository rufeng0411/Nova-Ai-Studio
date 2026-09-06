// PD-SAAS-FORK (P1-F, flag-gated): single-tool watchdog.
//
// Assigns each tool a soft deadline so a single hung tool surfaces as a telemetry signal (and a
// future swap-to-alternate / skip) instead of silently stalling the whole turn. Pure & deterministic.
//
// NON-DESTRUCTIVE integration: the loop uses this only to OBSERVE batch overruns and record a
// timeout event — it never kills an in-flight tool (aborting mid-write could corrupt a deliverable).
// `withDeadline` is provided as a reusable building block for a future opt-in per-tool wrap, and is
// itself safe (it resolves with a sentinel and never rejects).

export type WatchdogVerdict = "ok" | "warn" | "timeout";

export type ToolWatchdogConfig = {
  /** Fallback deadline for tools without a specific entry. */
  defaultDeadlineMs: number;
  /** Category deadlines, matched by substring against the (lower-cased) tool name, longest-first. */
  categoryDeadlinesMs: Array<{ match: string[]; deadlineMs: number }>;
  /** elapsed > deadline * hardMultiplier => "timeout"; elapsed > deadline => "warn". */
  hardMultiplier: number;
};

export const DEFAULT_TOOL_WATCHDOG_CONFIG: ToolWatchdogConfig = {
  defaultDeadlineMs: 60_000,
  // Order matters: the first matching category wins, so list the more specific / longer ones first.
  categoryDeadlinesMs: [
    { match: ["render_hyperframes"], deadlineMs: 900_000 },
    { match: ["render_html_video", "generate_video"], deadlineMs: 240_000 },
    // PD-SAAS-FORK: `agent` tool name does not include "subagent"/"fork" — align with fork budget.
    { match: ["subagent", "fork", "agent"], deadlineMs: 600_000 },
    // PD-SAAS-FORK P0-5: Chromium screenshot shares the document-render budget.
    { match: ["render_local_html_to_image", "generate_image", "compose_images", "ocr_", "export_document"], deadlineMs: 180_000 },
    { match: ["web_fetch", "web_search", "fetch_page_images", "fetch_media_asset", "browser", "geo_api"], deadlineMs: 90_000 },
    { match: ["bash", "shell", "exec"], deadlineMs: 120_000 },
    { match: ["read_file", "write_file", "edit_file", "str_replace", "grep", "glob", "list_dir", "read_skill"], deadlineMs: 30_000 },
  ],
  hardMultiplier: 2,
};

export function resolveToolWatchdogConfig(
  env: Record<string, string | undefined> = process.env,
): ToolWatchdogConfig {
  const defaultDeadlineMs = positiveInt(env.PILOTDECK_TOOL_DEADLINE_MS, DEFAULT_TOOL_WATCHDOG_CONFIG.defaultDeadlineMs);
  const hardMultiplier = positiveNumber(env.PILOTDECK_TOOL_HARD_MULTIPLIER, DEFAULT_TOOL_WATCHDOG_CONFIG.hardMultiplier);
  return {
    ...DEFAULT_TOOL_WATCHDOG_CONFIG,
    defaultDeadlineMs,
    hardMultiplier,
  };
}

export function resolveToolDeadlineMs(
  toolName: string,
  config: ToolWatchdogConfig = DEFAULT_TOOL_WATCHDOG_CONFIG,
  toolInput?: Record<string, unknown>,
): number {
  const name = String(toolName ?? "").toLowerCase();
  let deadline = config.defaultDeadlineMs;
  for (const entry of config.categoryDeadlinesMs) {
    if (entry.match.some((token) => name.includes(token))) {
      deadline = entry.deadlineMs;
      break;
    }
  }
  if (name.includes("write_file") && toolInput) {
    const content = String(toolInput.content ?? toolInput.text ?? "");
    if (content.length > 200_000) deadline = Math.max(deadline, 120_000);
    else if (content.length > 50_000) deadline = Math.max(deadline, 60_000);
  }
  return deadline;
}

export type ToolCallDeadlineInput = {
  name: string;
  input?: Record<string, unknown>;
};

/** Largest per-tool deadline across a batch — the point past which the batch is "overdue". */
export function maxBatchDeadlineMs(
  toolNames: readonly string[],
  config: ToolWatchdogConfig = DEFAULT_TOOL_WATCHDOG_CONFIG,
): number {
  if (toolNames.length === 0) return config.defaultDeadlineMs;
  return Math.max(...toolNames.map((name) => resolveToolDeadlineMs(name, config)));
}

export function maxBatchDeadlineMsForToolCalls(
  toolCalls: readonly ToolCallDeadlineInput[],
  config: ToolWatchdogConfig = DEFAULT_TOOL_WATCHDOG_CONFIG,
): number {
  if (toolCalls.length === 0) return config.defaultDeadlineMs;
  return Math.max(
    ...toolCalls.map((call) => resolveToolDeadlineMs(call.name, config, call.input)),
  );
}

export function decideWatchdogVerdict(
  elapsedMs: number,
  deadlineMs: number,
  config: ToolWatchdogConfig = DEFAULT_TOOL_WATCHDOG_CONFIG,
): WatchdogVerdict {
  if (elapsedMs > deadlineMs * config.hardMultiplier) return "timeout";
  if (elapsedMs > deadlineMs) return "warn";
  return "ok";
}

export type DeadlineOutcome<T> = { timedOut: false; value: T } | { timedOut: true };

/**
 * Race a promise against a deadline. Resolves with a sentinel instead of rejecting, so callers never
 * crash a turn on a timeout. The losing promise is NOT cancelled (the caller decides what to do).
 */
export function withDeadline<T>(
  promise: Promise<T>,
  deadlineMs: number,
  scheduler: { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout } = globalThis,
): Promise<DeadlineOutcome<T>> {
  return new Promise<DeadlineOutcome<T>>((resolveOutcome) => {
    let settled = false;
    const timer = scheduler.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolveOutcome({ timedOut: true });
    }, deadlineMs);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        scheduler.clearTimeout(timer);
        resolveOutcome({ timedOut: false, value });
      },
      () => {
        if (settled) return;
        settled = true;
        scheduler.clearTimeout(timer);
        // Treat a rejection as "completed" (not a watchdog timeout); the tool layer reports the error.
        resolveOutcome({ timedOut: true });
      },
    );
  });
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
