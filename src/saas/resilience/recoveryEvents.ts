// PD-SAAS-FORK: helpers to build recovery events from RecoveryBudget

import type { RecoveryConsumeResult } from "./recoveryBudget.js";

export type RecoveryEventCategory = "network" | "tool" | "model" | "stuck";

export type RecoveryAttemptDetail = {
  reason: string;
  attempt: number;
  maxAttempts: number;
  category: RecoveryEventCategory;
  budgetRemaining: number;
  layer: "loop";
};

export type RecoveryExhaustedDetail = RecoveryAttemptDetail;

export function hintKeyToRecoveryCategory(
  hintKey: "network" | "model" | "gateway" | "rate_limit" | "config" | "unknown",
): RecoveryEventCategory {
  switch (hintKey) {
    case "network":
    case "gateway":
    case "rate_limit":
      return "network";
    case "model":
    case "config":
    case "unknown":
      return "model";
    default: {
      const _exhaustive: never = hintKey;
      return _exhaustive;
    }
  }
}

export function recoveryAttemptDetail(
  consumed: RecoveryConsumeResult,
  category: RecoveryEventCategory,
): RecoveryAttemptDetail {
  return {
    reason: consumed.reason,
    attempt: consumed.attempt,
    maxAttempts: consumed.maxAttempts,
    category,
    budgetRemaining: consumed.budgetRemaining,
    layer: "loop",
  };
}

export function recoveryExhaustedDetail(
  budgetMax: number,
  budgetUsed: number,
  reason: string,
  category: RecoveryEventCategory,
): RecoveryExhaustedDetail {
  return {
    reason,
    attempt: budgetUsed,
    maxAttempts: budgetMax,
    category,
    budgetRemaining: 0,
    layer: "loop",
  };
}
