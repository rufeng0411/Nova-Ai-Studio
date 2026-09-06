// PD-SAAS-FORK: per-turn recovery event tracing (fire-and-forget persistence).

import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { stringifySanitizedForPersistence } from "../saas/security/urlRedaction.js";

export type RecoveryTimingReason =
  | "auto_continue"
  | "tool_recovery"
  | "soft_fetch_recovery"
  | "model_error"
  | "ui_auto_continue"
  | "acceptance_repair";

export type RecoveryTimingEvent = {
  recordedAtMs: number;
  runId: string;
  sessionId: string;
  turnId: string;
  reason: RecoveryTimingReason | string;
  attempt: number;
  maxAttempts: number;
  budgetRemaining: number;
  loopIteration?: number;
  failedTools?: string[];
  errorCodes?: string[];
  category?: string;
};

function resolveRecoveryLogPath(): string | undefined {
  const fromEnv = process.env.PILOTDECK_RECOVERY_LOG?.trim();
  if (fromEnv) return fromEnv;
  const dataRoot = process.env.PILOTDECK_DATA_ROOT?.trim() || process.env.DATA_ROOT?.trim();
  if (dataRoot) return resolve(dataRoot, "telemetry", "recovery-events.jsonl");
  return resolve(process.cwd(), ".saas-dev-data", "telemetry", "recovery-events.jsonl");
}

let logPathCache: string | undefined;

export function getRecoveryLogPath(): string {
  if (!logPathCache) logPathCache = resolveRecoveryLogPath();
  return logPathCache!;
}

/** Append-only; never throws to caller. */
export function recordRecoveryEvent(event: RecoveryTimingEvent): void {
  // PD-SAAS-FORK P0-3: telemetry persistence shares the URL redaction boundary.
  const line = `${stringifySanitizedForPersistence(event)}\n`;
  const logPath = getRecoveryLogPath();
  void (async () => {
    try {
      await mkdir(dirname(logPath), { recursive: true });
      await appendFile(logPath, line, "utf8");
    } catch {
      // telemetry must not affect turn execution
    }
  })();
}

export async function loadRecoveryEventsFromLog(
  logPath = getRecoveryLogPath(),
): Promise<RecoveryTimingEvent[]> {
  try {
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(logPath, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as RecoveryTimingEvent);
  } catch {
    return [];
  }
}

export function summarizeRecoveryByReason(
  events: RecoveryTimingEvent[],
): Record<string, { count: number; avgBudgetRemaining: number }> {
  const buckets: Record<string, { count: number; budgetSum: number }> = {};
  for (const event of events) {
    const key = String(event.reason || "unknown");
    const bucket = buckets[key] ?? { count: 0, budgetSum: 0 };
    bucket.count += 1;
    bucket.budgetSum += event.budgetRemaining ?? 0;
    buckets[key] = bucket;
  }
  const out: Record<string, { count: number; avgBudgetRemaining: number }> = {};
  for (const [key, bucket] of Object.entries(buckets)) {
    out[key] = {
      count: bucket.count,
      avgBudgetRemaining: bucket.count > 0 ? Math.round(bucket.budgetSum / bucket.count) : 0,
    };
  }
  return out;
}
