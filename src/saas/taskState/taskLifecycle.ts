export type TaskLifecycleStatus =
  | "executing"
  | "validating"
  | "repairable"
  | "preference_elicitation"
  | "user_action_required"
  | "done"
  | "failed_unrecoverable";

export type RecoveryOwner =
  | "infra_interrupt"
  | "deliverable_repair"
  | "engine_auto_continue"
  | "ui_incomplete_deliverable"
  | "stale_turn"
  | "none";

export type ElicitationKind = "preference" | "required" | "none";

export type RequiredBlockerReason =
  | "missing_key"
  | "missing_attachment"
  | "permission_required"
  | "billing_required"
  | "authentication_required"
  | "captcha_required"
  | "unknown";

export interface TaskCompletionEvidence {
  verified: string[];
  missing: string[];
  broken: string[];
  processOnly?: string[];
}

export interface TaskLifecycleInput {
  userGoal?: string;
  assistantText?: string;
  completion?: TaskCompletionEvidence;
  elicitation?: {
    kind?: ElicitationKind;
    hasDefaultOption?: boolean;
  };
  blocker?: {
    kind: "required" | "hard_fail" | "recoverable";
    reason?: RequiredBlockerReason | string;
  };
  turnOutcome?: {
    aborted?: boolean;
    userAborted?: boolean;
    stopReason?: string;
  };
  recoveryBudget?: {
    recoverableRemaining?: number;
    hardFailRemaining?: number;
  };
}

export interface TaskLifecycleDecision {
  status: TaskLifecycleStatus;
  owner: RecoveryOwner;
  reason: string;
}

export const taskLifecycleStatusLabels: Record<TaskLifecycleStatus, { zh: string; en: string }> = {
  executing: { zh: "任务执行中", en: "Executing" },
  validating: { zh: "正在校验成果", en: "Validating" },
  repairable: { zh: "正在自动修复", en: "Repairable" },
  preference_elicitation: { zh: "定制任务偏好", en: "Preference elicitation" },
  user_action_required: { zh: "需要您处理", en: "User action required" },
  done: { zh: "已完成", en: "Done" },
  failed_unrecoverable: { zh: "无法自动完成", en: "Failed unrecoverable" },
};

const RECOVERY_OWNER_PRIORITY: Record<RecoveryOwner, number> = {
  none: 0,
  stale_turn: 10,
  ui_incomplete_deliverable: 20,
  engine_auto_continue: 30,
  deliverable_repair: 40,
  infra_interrupt: 50,
};

const REQUIRED_QUESTION_PATTERNS = [
  /api\s*key/i,
  /key/i,
  /密钥/,
  /上传/,
  /附件/,
  /登录/,
  /授权/,
  /验证码/,
  /欠费/,
  /权限/,
];

const DEFAULT_CONTINUE_PATTERNS = [
  /默认/,
  /推荐/,
  /继续/,
  /常用/,
  /先开始/,
  /start/i,
  /continue/i,
];

export function chooseRecoveryOwner(candidates: RecoveryOwner[]): RecoveryOwner {
  let chosen: RecoveryOwner = "none";
  for (const candidate of candidates) {
    if (RECOVERY_OWNER_PRIORITY[candidate] > RECOVERY_OWNER_PRIORITY[chosen]) {
      chosen = candidate;
    }
  }
  return chosen;
}

export function classifyElicitationKind(input: {
  question?: string;
  options?: string[];
  requiredReason?: RequiredBlockerReason | string;
  hasDefaultOption?: boolean;
}): ElicitationKind {
  if (input.requiredReason) {
    return "required";
  }

  const text = [input.question ?? "", ...(input.options ?? [])].join("\n");
  const looksRequired = REQUIRED_QUESTION_PATTERNS.some((pattern) => pattern.test(text));
  if (looksRequired && !hasDefaultContinueOption(input.options, input.hasDefaultOption)) {
    return "required";
  }

  if (input.question || (input.options?.length ?? 0) > 0) {
    return "preference";
  }

  return "none";
}

export function resolveTaskLifecycleStatus(input: TaskLifecycleInput): TaskLifecycleDecision {
  if (input.blocker?.kind === "required") {
    return {
      status: "user_action_required",
      owner: "none",
      reason: input.blocker.reason ?? "required_input",
    };
  }

  if (input.blocker?.kind === "hard_fail" || isHardFailBudgetExhausted(input)) {
    return {
      status: "failed_unrecoverable",
      owner: "none",
      reason: input.blocker?.reason ?? "hard_fail_budget_exhausted",
    };
  }

  if (input.elicitation?.kind === "required") {
    return {
      status: "user_action_required",
      owner: "none",
      reason: "required_elicitation",
    };
  }

  if (input.elicitation?.kind === "preference") {
    return {
      status: "preference_elicitation",
      owner: "engine_auto_continue",
      reason: input.elicitation.hasDefaultOption ? "preference_with_default" : "preference_without_default",
    };
  }

  if (input.turnOutcome?.aborted && !input.turnOutcome.userAborted) {
    return {
      status: "repairable",
      owner: "engine_auto_continue",
      reason: input.turnOutcome.stopReason ?? "non_user_abort",
    };
  }

  const completion = input.completion;
  if (completion && (completion.missing.length > 0 || completion.broken.length > 0)) {
    return {
      status: "repairable",
      owner: "deliverable_repair",
      reason: "missing_or_broken_deliverables",
    };
  }

  if (completion && completion.verified.length > 0) {
    return {
      status: "done",
      owner: "none",
      reason: "verified_deliverables",
    };
  }

  if (completion) {
    return {
      status: "validating",
      owner: "none",
      reason: "no_deliverable_evidence_yet",
    };
  }

  return {
    status: "executing",
    owner: "none",
    reason: "no_terminal_evidence",
  };
}

function hasDefaultContinueOption(options?: string[], explicit?: boolean): boolean {
  if (explicit) {
    return true;
  }
  return (options ?? []).some((option) => DEFAULT_CONTINUE_PATTERNS.some((pattern) => pattern.test(option)));
}

function isHardFailBudgetExhausted(input: TaskLifecycleInput): boolean {
  return typeof input.recoveryBudget?.hardFailRemaining === "number" && input.recoveryBudget.hardFailRemaining <= 0;
}
