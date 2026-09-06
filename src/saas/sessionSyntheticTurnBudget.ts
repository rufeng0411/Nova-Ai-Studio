// PD-SAAS-FORK: session-level synthetic/repair turn budget (orphan/zombie bleed stop)

import type { DeliverableValidationResult } from "./taskContinuationPolicy.js";

export const DEFAULT_SESSION_SYNTHETIC_BUDGET = 8;

function flagEnabled(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null) return fallback;
  const value = raw.trim().toLowerCase();
  if (value === "0" || value === "false" || value === "off") return false;
  if (value === "1" || value === "true" || value === "on") return true;
  return fallback;
}

export function isSessionSyntheticBudgetEnabled(): boolean {
  return flagEnabled("PILOTDECK_SESSION_SYNTHETIC_BUDGET", false);
}

export function resolveSessionSyntheticBudgetLimit(): number {
  const raw = process.env.PILOTDECK_SESSION_SYNTHETIC_BUDGET_LIMIT;
  const parsed = raw != null ? Number.parseInt(raw, 10) : DEFAULT_SESSION_SYNTHETIC_BUDGET;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SESSION_SYNTHETIC_BUDGET;
}

function isSyntheticUserMessage(message: unknown): boolean {
  if (!message || typeof message !== "object") return false;
  const m = message as { role?: string; metadata?: Record<string, unknown>; content?: unknown };
  if (m.role !== "user") return false;
  const meta = m.metadata;
  if (meta?.synthetic) return true;
  const purpose = meta?.purpose;
  if (purpose === "auto_continue" || purpose === "tool_recovery" || purpose === "deliverable_repair") {
    return true;
  }
  const text = extractTextContent(m.content);
  return /task-resume|<task-resume>/i.test(text);
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b): b is { type?: string; text?: string } => Boolean(b && typeof b === "object"))
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n");
}

/** Count consecutive synthetic user messages since the last real user message. */
export function countSyntheticStreakSinceLastRealUser(messages: readonly unknown[]): number {
  let streak = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (!msg || typeof msg !== "object") continue;
    if ((msg as { role?: string }).role !== "user") continue;
    if (isSyntheticUserMessage(msg)) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

/** Best-effort verified path count from the latest acceptance metadata in history. */
export function extractLatestVerifiedCount(messages: readonly unknown[]): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (!msg || typeof msg !== "object") continue;
    const meta = (msg as { metadata?: Record<string, unknown> }).metadata;
    const verified = meta?.verifiedPaths;
    if (Array.isArray(verified)) return verified.length;
    const acceptance = meta?.acceptance as { verifiedPaths?: string[] } | undefined;
    if (acceptance?.verifiedPaths) return acceptance.verifiedPaths.length;
  }
  return 0;
}

export type SyntheticBudgetEvaluation = {
  enabled: boolean;
  streak: number;
  limit: number;
  exhausted: boolean;
  currentVerified: number;
  baselineVerified: number;
};

/** Best-effort missing path count from the latest acceptance metadata in history. */
export function extractLatestMissingCount(messages: readonly unknown[]): number | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (!msg || typeof msg !== "object") continue;
    const meta = (msg as { metadata?: Record<string, unknown> }).metadata;
    const missing = meta?.missingPaths;
    if (Array.isArray(missing)) return missing.length;
    const acceptance = meta?.acceptance as { missingPaths?: string[] } | undefined;
    if (acceptance?.missingPaths) return acceptance.missingPaths.length;
  }
  return undefined;
}

export function evaluateSessionSyntheticBudget(
  messages: readonly unknown[],
  validation: DeliverableValidationResult | null | undefined,
): SyntheticBudgetEvaluation {
  const enabled = isSessionSyntheticBudgetEnabled();
  const limit = resolveSessionSyntheticBudgetLimit();
  const streak = countSyntheticStreakSinceLastRealUser(messages);
  const currentVerified = validation?.verified?.length ?? 0;
  const baselineVerified = extractLatestVerifiedCount(messages);
  const baselineMissing = extractLatestMissingCount(messages);
  const currentMissing = validation?.missing?.length ?? 0;
  const missingShrunk = baselineMissing != null && currentMissing < baselineMissing;
  const noVerifiedProgress = currentVerified <= baselineVerified;
  const exhausted = enabled && streak >= limit && noVerifiedProgress && !missingShrunk;
  return { enabled, streak, limit, exhausted, currentVerified, baselineVerified };
}

export function shouldBlockSyntheticContinuation(
  messages: readonly unknown[],
  validation: DeliverableValidationResult | null | undefined,
): boolean {
  return evaluateSessionSyntheticBudget(messages, validation).exhausted;
}
