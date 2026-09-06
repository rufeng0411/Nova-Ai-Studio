// PD-SAAS-FORK (P2, flag-gated, OPTIONAL): verification-pass decision layer.
//
// This is the decision core of an (opt-in) planner -> executor -> verifier loop. Its job is narrow
// and safe: decide WHETHER an independent verification pass is warranted before the engine declares
// a deliverable task done, and WHAT that pass should check. The actual verifier orchestration (a
// sub-agent that re-opens the deliverables and confirms they meet the goal) is intentionally left as
// a documented scaffold — this module is what gates it.
//
// Key insight: a verification pass is only valuable when acceptance ALREADY SAYS PASSED (a failed
// acceptance is handled by the existing repair path). It's an independent "second look" guarding
// against false-positive completions. Pure & deterministic so it can be unit-tested and the trigger
// rate tuned by telemetry before any sub-agent is wired in. Default OFF => never runs.

export type VerificationCheckKind = "deliverable_presence" | "content_quality" | "count_match";

export type VerificationDecisionReason =
  | "flag_off"
  | "not_deliverable_task"
  | "no_verifiable_contract"
  | "acceptance_not_passed"
  | "budget_exhausted"
  | "verify_recommended";

export type VerificationDecisionInput = {
  flagEnabled: boolean;
  goalImpliesDeliverable: boolean;
  profileRequiresDeliverable: boolean;
  /** Acceptance verdict: did the normal gate already declare PASSED? */
  acceptancePassed: boolean;
  /** Contract carries something concrete to verify (required files / kinds / counts). */
  hasRequiredFiles: boolean;
  hasCountExpectations: boolean;
  /**
   * PD-SAAS-FORK (/goal Feature 1x2 bridge): the user gave explicit natural-language completion
   * assertions (TaskGoalContract.completionAssertions). This is a third "verifiable" signal so a
   * goal with only NL conditions (no file/count contract) can still warrant a second look.
   */
  hasCompletionAssertions?: boolean;
  /** Remaining recovery budget; a verification pass consumes one unit if it runs. */
  budgetRemaining: number;
};

export type VerificationPlan = {
  shouldVerify: boolean;
  reason: VerificationDecisionReason;
  checks: VerificationCheckKind[];
};

export function decideVerificationPass(input: VerificationDecisionInput): VerificationPlan {
  if (!input.flagEnabled) return { shouldVerify: false, reason: "flag_off", checks: [] };
  if (!input.goalImpliesDeliverable || !input.profileRequiresDeliverable) {
    return { shouldVerify: false, reason: "not_deliverable_task", checks: [] };
  }
  if (!input.hasRequiredFiles && !input.hasCountExpectations && !input.hasCompletionAssertions) {
    return { shouldVerify: false, reason: "no_verifiable_contract", checks: [] };
  }
  // Only a "passed" verdict warrants an independent second look; a failure already triggers repair.
  if (!input.acceptancePassed) {
    return { shouldVerify: false, reason: "acceptance_not_passed", checks: [] };
  }
  if (input.budgetRemaining <= 0) {
    return { shouldVerify: false, reason: "budget_exhausted", checks: [] };
  }
  const checks: VerificationCheckKind[] = ["content_quality"];
  if (input.hasRequiredFiles) checks.unshift("deliverable_presence");
  if (input.hasCountExpectations) checks.push("count_match");
  return { shouldVerify: true, reason: "verify_recommended", checks };
}

/** A compact directive a (future) verifier sub-agent would receive. Pure string builder. */
export function buildVerificationDirective(
  plan: VerificationPlan,
  userGoal: string,
  completionAssertions?: string[],
): string {
  if (!plan.shouldVerify) return "";
  const checkLabels: Record<VerificationCheckKind, string> = {
    deliverable_presence: "确认所有要求的成果文件确实存在且可打开",
    content_quality: "抽查正文是否真实、完整、无占位/重复退化",
    count_match: "核对页数/数量是否达到用户要求",
  };
  const items = plan.checks.map((check, index) => `${index + 1}. ${checkLabels[check]}`).join("\n");
  const assertions = (completionAssertions ?? [])
    .map((line) => String(line ?? "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 3);
  const assertionBlock = assertions.length > 0
    ? ["用户明确的完成条件（逐条核对）：", ...assertions.map((line, index) => `- (${index + 1}) ${line}`)].join("\n")
    : "";
  return [
    "请作为独立校验者，对照原始目标复核已交付成果（不要信任此前的“已完成”结论）：",
    `原始目标：${String(userGoal ?? "").slice(0, 400)}`,
    items,
    assertionBlock,
    "若发现任何不符，请明确指出缺失/错误的文件与原因；若全部满足，请回复“校验通过”。",
  ].filter((line) => line.length > 0).join("\n");
}
