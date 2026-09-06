import { describe, expect, it } from "vitest";
import {
  buildVerificationDirective,
  decideVerificationPass,
  type VerificationDecisionInput,
} from "./verificationPass.js";

function baseInput(overrides: Partial<VerificationDecisionInput> = {}): VerificationDecisionInput {
  return {
    flagEnabled: true,
    goalImpliesDeliverable: true,
    profileRequiresDeliverable: true,
    acceptancePassed: true,
    hasRequiredFiles: true,
    hasCountExpectations: true,
    budgetRemaining: 5,
    ...overrides,
  };
}

describe("decideVerificationPass", () => {
  it("is inert when the flag is off", () => {
    expect(decideVerificationPass(baseInput({ flagEnabled: false }))).toEqual({
      shouldVerify: false,
      reason: "flag_off",
      checks: [],
    });
  });

  it("skips non-deliverable tasks", () => {
    expect(decideVerificationPass(baseInput({ goalImpliesDeliverable: false })).reason).toBe("not_deliverable_task");
    expect(decideVerificationPass(baseInput({ profileRequiresDeliverable: false })).reason).toBe("not_deliverable_task");
  });

  it("skips when the contract has nothing concrete to verify", () => {
    expect(
      decideVerificationPass(baseInput({
        hasRequiredFiles: false,
        hasCountExpectations: false,
        hasCompletionAssertions: false,
      })).reason,
    ).toBe("no_verifiable_contract");
  });

  it("treats natural-language completion assertions as a verifiable signal", () => {
    const plan = decideVerificationPass(baseInput({
      hasRequiredFiles: false,
      hasCountExpectations: false,
      hasCompletionAssertions: true,
    }));
    expect(plan.shouldVerify).toBe(true);
    expect(plan.reason).toBe("verify_recommended");
    expect(plan.checks).toEqual(["content_quality"]);
  });

  it("does NOT run when acceptance already failed (repair path owns it)", () => {
    expect(decideVerificationPass(baseInput({ acceptancePassed: false })).reason).toBe("acceptance_not_passed");
  });

  it("does NOT run when the budget is exhausted", () => {
    expect(decideVerificationPass(baseInput({ budgetRemaining: 0 })).reason).toBe("budget_exhausted");
  });

  it("recommends verification with the right checks for a passed deliverable task", () => {
    const plan = decideVerificationPass(baseInput());
    expect(plan.shouldVerify).toBe(true);
    expect(plan.reason).toBe("verify_recommended");
    expect(plan.checks).toEqual(["deliverable_presence", "content_quality", "count_match"]);
  });

  it("tailors checks to the contract shape", () => {
    const filesOnly = decideVerificationPass(baseInput({ hasCountExpectations: false }));
    expect(filesOnly.checks).toEqual(["deliverable_presence", "content_quality"]);
    const countsOnly = decideVerificationPass(baseInput({ hasRequiredFiles: false }));
    expect(countsOnly.checks).toEqual(["content_quality", "count_match"]);
  });
});

describe("buildVerificationDirective", () => {
  it("returns empty string when verification is not recommended", () => {
    expect(buildVerificationDirective(decideVerificationPass(baseInput({ flagEnabled: false })), "目标")).toBe("");
  });

  it("includes the goal and numbered checks", () => {
    const plan = decideVerificationPass(baseInput());
    const directive = buildVerificationDirective(plan, "做一个 8 页的 PPT");
    expect(directive).toContain("做一个 8 页的 PPT");
    expect(directive).toContain("1.");
    expect(directive).toContain("校验通过");
  });

  it("appends explicit completion assertions when provided", () => {
    const plan = decideVerificationPass(baseInput());
    const directive = buildVerificationDirective(plan, "做一份报告", [
      "必须包含三家竞品对比",
      "结论不超过 500 字",
    ]);
    expect(directive).toContain("用户明确的完成条件");
    expect(directive).toContain("必须包含三家竞品对比");
    expect(directive).toContain("结论不超过 500 字");
  });

  it("omits the assertion block when no assertions are given", () => {
    const plan = decideVerificationPass(baseInput());
    const directive = buildVerificationDirective(plan, "做一份报告");
    expect(directive).not.toContain("用户明确的完成条件");
  });
});
