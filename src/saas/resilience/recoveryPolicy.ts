// PD-SAAS-FORK: tiered recovery limits — hard failures vs recoverable work
import { needsUserCredentialOrAttachment } from "../userActionBlocker.js";
import { USER_ACTION_BLOCKER_CONFIRM_THRESHOLD } from "../userActionBlockerStreakTracker.js";
import type { ErrorClassification } from "./errorClassifier.js";
import { classifyErrorMessage, shouldFastFailClassification } from "./errorClassifier.js";
import type { RecoveryConsumeReason } from "./recoveryBudget.js";

export type RecoveryTier = "hard_fail" | "recoverable";

/** Auth/billing/gateway: confirm ≤3 times then stop (do not burn long-task budget). */
export const DEFAULT_HARD_FAIL_MAX_PER_TURN = 3;

/** Transient/tool/strategy switches: higher ceiling for multi-step deliverables. */
export const DEFAULT_RECOVERABLE_MAX_PER_TURN = 12;

export function tierForErrorClassification(
  classification: ErrorClassification,
): RecoveryTier {
  return shouldFastFailClassification(classification) ? "hard_fail" : "recoverable";
}

export function tierForRecoveryReason(reason: RecoveryConsumeReason): RecoveryTier {
  switch (reason) {
    case "model_error":
      return "recoverable";
    case "tool_recovery":
    case "soft_fetch_recovery":
    case "visual_media_degrade":
    case "auto_continue":
    case "acceptance_repair":
    case "ui_auto_continue":
      return "recoverable";
    default: {
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
}

export type TieredRecoveryLimits = {
  hardFailMax: number;
  recoverableMax: number;
};

export function hardFailThresholdForClassification(classification: ErrorClassification): number {
  switch (classification) {
    case "model_auth":
    case "model_billing":
      return 1;
    case "config":
      // PD-SAAS-FORK: Key/attachment config errors align with三确同错 (P1-2)
      return USER_ACTION_BLOCKER_CONFIRM_THRESHOLD;
    case "gateway_unreachable":
      return DEFAULT_HARD_FAIL_MAX_PER_TURN;
    case "user_abort":
      return 1;
    case "transient":
    case "rate_limit":
    case "unknown":
      return DEFAULT_HARD_FAIL_MAX_PER_TURN;
    default: {
      const _exhaustive: never = classification;
      return _exhaustive;
    }
  }
}

export function worstHardFailFromToolResults(
  results: Array<{ type: string; error?: { message?: string; code?: string } }>,
): ErrorClassification | null {
  let worst: ErrorClassification | null = null;
  for (const result of results) {
    if (result.type !== "error" || !result.error) continue;
    const { classification } = classifyErrorMessage(
      result.error.message ?? "",
      result.error.code,
    );
    if (!shouldFastFailClassification(classification)) continue;
    const threshold = hardFailThresholdForToolError(
      result.error.message ?? "",
      result.error.code,
    );
    if (threshold === 1) {
      return classification;
    }
    worst = classification;
  }
  return worst;
}

/** PD-SAAS-FORK: credential/attachment tool errors use三确 threshold before hard-fail. */
export function hardFailThresholdForToolError(message: string, code?: string): number {
  const { classification } = classifyErrorMessage(message, code);
  if (classification === "model_auth" || classification === "model_billing" || classification === "user_abort") {
    return hardFailThresholdForClassification(classification);
  }
  if (needsUserCredentialOrAttachment(message)) {
    return USER_ACTION_BLOCKER_CONFIRM_THRESHOLD;
  }
  return hardFailThresholdForClassification(classification);
}

export function resolveTieredRecoveryLimits(config: {
  maxRecoveryBudgetPerTurn?: number;
  hardFailMaxPerTurn?: number;
  recoverableMaxPerTurn?: number;
}): TieredRecoveryLimits {
  const recoverableMax = Math.max(
    1,
    config.recoverableMaxPerTurn ?? config.maxRecoveryBudgetPerTurn ?? DEFAULT_RECOVERABLE_MAX_PER_TURN,
  );
  const hardFailMax = Math.max(
    1,
    Math.min(config.hardFailMaxPerTurn ?? DEFAULT_HARD_FAIL_MAX_PER_TURN, recoverableMax),
  );
  return { hardFailMax, recoverableMax };
}
