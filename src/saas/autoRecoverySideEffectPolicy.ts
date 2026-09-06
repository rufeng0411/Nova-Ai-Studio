// PD-SAAS-FORK: prevent auto-recovery from executing irreversible side effects.

export type AutoRecoverySideEffectKind =
  | "public_publish"
  | "delete"
  | "payment"
  | "external_send"
  | "none";

export type AutoRecoverySideEffectRisk = {
  kind: AutoRecoverySideEffectKind;
  requiresUserConfirmation: boolean;
  reason: string;
};

const PUBLIC_PUBLISH_PATTERN = /公开发布|正式发布|立即发布|publish(?:\s+publicly)?|post\s+now|上线发布/i;
const DRAFT_SAFE_PATTERN = /不公开发布|草稿|draft(?:\s+only)?|do not publish|不发送|仅保存/i;
const DELETE_IMPERATIVE_PATTERN =
  /(?:请|帮我|帮忙|需要|务必|立即|现在).{0,12}(?:删除|移除|清空)|(?:删除|移除|清空).{0,12}(?:云端|账号|项目|数据库|生产)/i;
const DELETE_COMPLETED_PATTERN = /已.{0,4}删除|按您要求删除|已从.{0,12}移除/i;
const WORKSPACE_DELETE_PATTERN = /artifacts\/|task-\d{8}|工作区|write_file|workspace/i;
const PAYMENT_PATTERN = /付费|购买|充值|扣款|升级套餐|pay|purchase|subscribe|charge/i;
const EXTERNAL_SEND_PATTERN = /群发|发送邮件|发送短信|发到群|send\s+(?:email|sms|message)|broadcast/i;

export function classifyAutoRecoverySideEffectRisk(input: {
  userGoal?: string;
  assistantText?: string;
  toolName?: string;
  publishMode?: "draft" | "public" | string;
}): AutoRecoverySideEffectRisk {
  const userGoal = String(input.userGoal ?? "").trim();
  const assistantText = String(input.assistantText ?? "").trim();
  const combined = [userGoal, input.toolName ?? ""].filter(Boolean).join("\n");
  if (!combined.trim() && !assistantText.trim()) {
    return safeRisk();
  }
  const draftOnly = DRAFT_SAFE_PATTERN.test(combined) || input.publishMode === "draft";

  if (userGoal && DELETE_IMPERATIVE_PATTERN.test(userGoal) && !WORKSPACE_DELETE_PATTERN.test(userGoal)) {
    return risk("delete", "delete_or_remove");
  }
  if (
    assistantText
    && DELETE_IMPERATIVE_PATTERN.test(assistantText)
    && !DELETE_COMPLETED_PATTERN.test(assistantText)
    && !WORKSPACE_DELETE_PATTERN.test(assistantText)
  ) {
    return risk("delete", "delete_or_remove");
  }

  if (PAYMENT_PATTERN.test(combined)) {
    return risk("payment", "payment_or_billing");
  }
  if (PUBLIC_PUBLISH_PATTERN.test(combined) && !draftOnly) {
    return risk("public_publish", "public_publish");
  }
  if (EXTERNAL_SEND_PATTERN.test(combined) && !draftOnly) {
    return risk("external_send", "external_send");
  }
  return safeRisk();
}

export function buildSideEffectConfirmationNotice(input: {
  reason: string;
  locale?: "zh-CN" | "en";
}) {
  const zh = (input.locale ?? "zh-CN") === "zh-CN";
  return {
    title: zh ? "需要您确认危险操作" : "Confirmation required",
    reason: zh
      ? "自动恢复不会代替您执行公开发布、删除、付费或外部发送等不可撤销操作。"
      : "Auto-recovery will not perform public publishing, deletion, payment, or external sending without confirmation.",
    steps: zh
      ? [
        "确认是否继续执行该操作",
        "如只需保存草稿，请说明「仅保存草稿，不公开发布」",
        "确认后再继续执行",
      ]
      : [
        "Confirm whether to proceed",
        "If drafts only, say \"draft only, do not publish\"",
        "Continue after confirmation",
      ],
    confirmedAttempts: 1,
    locale: input.locale ?? "zh-CN",
    sideEffectReason: input.reason,
  };
}

function risk(kind: AutoRecoverySideEffectKind, reason: string): AutoRecoverySideEffectRisk {
  return { kind, requiresUserConfirmation: true, reason };
}

function safeRisk(): AutoRecoverySideEffectRisk {
  return { kind: "none", requiresUserConfirmation: false, reason: "none" };
}
