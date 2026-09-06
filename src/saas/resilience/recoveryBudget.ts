// PD-SAAS-FORK: tiered per-turn recovery budget (recoverable vs hard-fail lanes)

import type { RecoveryTier } from "./recoveryPolicy.js";

export type RecoveryConsumeReason =
  | "model_error"
  | "tool_recovery"
  | "soft_fetch_recovery"
  | "visual_media_degrade"
  | "auto_continue"
  | "ui_auto_continue"
  | "acceptance_repair";

export type RecoveryConsumeResult = {
  attempt: number;
  maxAttempts: number;
  budgetRemaining: number;
  reason: RecoveryConsumeReason;
  tier?: RecoveryTier;
};

export function parseAcceptanceRepairReservedMin(
  envValue: string | undefined = process.env.PILOTDECK_ACCEPTANCE_REPAIR_RESERVED,
): number {
  if (envValue === undefined || envValue === "") return 4;
  const parsed = Number(envValue);
  if (!Number.isFinite(parsed) || parsed < 0) return 4;
  return Math.floor(parsed);
}

export class RecoveryBudget {
  private recoverableUsed = 0;
  private hardFailUsed = 0;

  constructor(
    private readonly recoverableMax: number,
    private readonly hardFailMax: number = 3,
    private readonly acceptanceRepairReservedMin: number = parseAcceptanceRepairReservedMin(),
  ) {
    if (!Number.isFinite(recoverableMax) || recoverableMax < 1) {
      throw new Error(`RecoveryBudget recoverableMax must be >= 1, got ${recoverableMax}`);
    }
    if (!Number.isFinite(hardFailMax) || hardFailMax < 1) {
      throw new Error(`RecoveryBudget hardFailMax must be >= 1, got ${hardFailMax}`);
    }
    const reserved = Math.min(
      this.acceptanceRepairReservedMin,
      Math.max(0, recoverableMax - 1),
    );
    this.acceptanceRepairReservedMin = reserved;
  }

  /** @deprecated use recoverableMax — kept for telemetry callers */
  maxCount(): number {
    return this.recoverableMax;
  }

  recoverableMaxCount(): number {
    return this.recoverableMax;
  }

  hardFailMaxCount(): number {
    return this.hardFailMax;
  }

  acceptanceRepairReservedCount(): number {
    return this.acceptanceRepairReservedMin;
  }

  generalRecoverableCap(): number {
    return Math.max(1, this.recoverableMax - this.acceptanceRepairReservedMin);
  }

  tryConsume(
    reason: RecoveryConsumeReason,
    options?: { tier?: RecoveryTier },
  ): RecoveryConsumeResult | null {
    const tier = options?.tier ?? "recoverable";
    if (tier === "hard_fail") {
      if (this.hardFailUsed >= this.hardFailMax) return null;
      this.hardFailUsed += 1;
      return {
        attempt: this.hardFailUsed,
        maxAttempts: this.hardFailMax,
        budgetRemaining: this.remaining(),
        reason,
        tier,
      };
    }

    // PD-SAAS-FORK: Goal-Loop — reserve last N recoverable slots for acceptance_repair only.
    const generalCap = this.generalRecoverableCap();
    if (reason === "acceptance_repair") {
      if (this.recoverableUsed >= this.recoverableMax) return null;
    } else if (this.recoverableUsed >= generalCap) {
      return null;
    }

    this.recoverableUsed += 1;
    return {
      attempt: this.recoverableUsed,
      maxAttempts: this.recoverableMax,
      budgetRemaining: this.remaining(),
      reason,
      tier,
    };
  }

  remaining(): number {
    return Math.max(0, this.recoverableMax - this.recoverableUsed);
  }

  usedCount(): number {
    return this.recoverableUsed + this.hardFailUsed;
  }

  isExhausted(): boolean {
    return this.recoverableUsed >= this.recoverableMax;
  }

  isHardFailExhausted(): boolean {
    return this.hardFailUsed >= this.hardFailMax;
  }

  isRecoverableExhausted(): boolean {
    return this.recoverableUsed >= this.recoverableMax;
  }
}
