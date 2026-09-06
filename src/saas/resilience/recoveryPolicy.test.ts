import { describe, expect, it } from "vitest";
import {
  hardFailThresholdForClassification,
  resolveTieredRecoveryLimits,
  worstHardFailFromToolResults,
} from "./recoveryPolicy.js";

describe("recoveryPolicy", () => {
  it("auth fails immediately", () => {
    expect(hardFailThresholdForClassification("model_auth")).toBe(1);
    expect(hardFailThresholdForClassification("model_billing")).toBe(1);
  });

  it("defaults recoverable to 12", () => {
    const limits = resolveTieredRecoveryLimits({});
    expect(limits.recoverableMax).toBe(12);
    expect(limits.hardFailMax).toBe(3);
  });

  it("honors legacy maxRecoveryBudgetPerTurn", () => {
    const limits = resolveTieredRecoveryLimits({ maxRecoveryBudgetPerTurn: 8 });
    expect(limits.recoverableMax).toBe(8);
  });

  it("detects immediate hard fail in tool results", () => {
    const cls = worstHardFailFromToolResults([
      { type: "error", error: { message: "401 Unauthorized invalid api key" } },
    ]);
    expect(cls).toBe("model_auth");
  });
});
