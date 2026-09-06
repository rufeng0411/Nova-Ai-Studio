// PD-SAAS-FORK: unified continuation arbitration (conflict matrix v1)

import type { PromptLanguage } from "../context/prompt/resolvePromptLanguage.js";
import {
  isBareTransientNetworkErrorBody,
  shouldAutoContinueAfterIncompleteDeliverableStop,
  shouldAutoContinueAfterAssistantText,
  userGoalImpliesDeliverable,
  userGoalRequestsDirectStart,
} from "../agent/errors/userFacingErrors.js";
import { userRequestsBrainstormDeliverable, isChatFirstCapability } from "./chatFirstCapabilities.js";
import {
  isBrandGeoFullCaseGoal,
  isNovaResearchCapabilitySlug,
  isScriptDraftGoal,
  isSocialMatrixGoal,
  isVideoMp4FilmGoal,
  resolveProfile,
} from "./deliverableCapabilityProfiles.js";
import { isSessionDeliverableManifestEnabled, isHfKeyOptionalDegradeEnabled, isRepairAliasShortCircuitEnabled } from "./resilience/stabilityFlags.js";
import { isHyperframesVideoSlug } from "./media/hyperframesEngineFlags.js";
import {
  classifyUserActionBlocker,
  type UserActionBlocker,
} from "./userActionBlocker.js";
import {
  USER_ACTION_BLOCKER_CONFIRM_THRESHOLD,
} from "./userActionBlockerStreakTracker.js";
import {
  classifyElicitationKind,
  type ElicitationKind,
} from "./taskState/taskLifecycle.js";
import {
  reduceTaskExecutionState,
  type TaskExecutionDecision,
} from "./taskState/taskExecutionStateMachine.js";
import { classifyAutoRecoverySideEffectRisk } from "./autoRecoverySideEffectPolicy.js";
import type { SessionDeliverableManifest } from "./taskState/sessionDeliverableManifest.js";
import { hasSdmIncompleteSlots } from "./taskState/sessionDeliverableManifest.js";
import {
  filterNonDeliverableGapPaths,
} from "./deliverables/reconcileDeliverableFacts.js";
import { shouldTreatSdmAsComplete } from "./deliverables/deliverableGroundTruth.js";
import {
  isAcceptanceSatisfied,
  shouldStopAutomaticContinuation,
  type DeliverableCompletionState,
} from "./deliverables/deliverableCompletionState.js";
import {
  detectBrandCampaignFullTurn,
  detectContentFlywheelTurn,
  detectContentMatrixTurn,
  detectResearchReportTurn,
  detectSocialMatrixTurn,
} from "./processTemplateExecutionPrompt.js";
import type { CapabilityCompletionMode } from "./intent/capabilityCompletionMode.js";
import type { TurnInteractionMode } from "./intent/turnInteractionMode.js";
import { isPureGreetingUserText } from "./intent/resolveCurrentIntent.js";
import { shouldSuppressExecuteContinuation } from "./intent/turnInteractionMode.js";
import { isDeliverableQualityReworkGoal } from "./taskState/detectGoalMutation.js";
import {
  filterAcceptancePathsForScope,
} from "./deliverables/filterAcceptancePathsForScope.js";
import { slotSatisfiedByValidation } from "./deliverables/sdmSlotMatching.js";

export type ContinuationAction =
  | "user_action_required"
  | "retry_alternate"
  | "auto_continue_engine"
  | "deliverable_repair"
  | "stop"
  | "none";

export type DeliverableValidationResult = {
  verified: string[];
  missing: string[];
  broken: string[];
  /** PD-SAAS-FORK (Train-0B): engine acceptance — passed must hard-block repair triggers. */
  acceptance?: "passed" | "needs_repair" | "user_action_required" | "failed" | "not_applicable";
  /** PD-SAAS-FORK P0-7: terminal certificate state overrides stale gap heuristics. */
  completionState?: DeliverableCompletionState;
  /** PD-SAAS-FORK VAP P0-B: visual binding audit snapshot for repair gating. */
  bindingAudit?: import("./media/visualAssetPlatform/deliverableVisualBindingAudit.js").VisualBindingAuditResult | null;
};

export type ContinuationPolicyContext = {
  userGoal?: string;
  assistantText?: string;
  toolErrorMessage?: string;
  toolErrorCode?: string;
  blockerStreak?: number;
  blocker?: UserActionBlocker | null;
  validationResult?: DeliverableValidationResult | null;
  hadRecentToolSuccess?: boolean;
  planningOrSetupStop?: boolean;
  autoRecoveryContinueEnabled?: boolean;
  directStartRequested?: boolean;
  missingIrreplaceableInput?: boolean;
  capabilitySlug?: string;
  majorCategory?: string | null;
  sessionManifest?: SessionDeliverableManifest;
  /** PD-SAAS-FORK: P0-1 exact capability file-completion mode. */
  completionMode?: CapabilityCompletionMode;
  /** PD-SAAS-FORK: binary intent gate — dialogue/clarify must not auto-continue. */
  turnInteractionMode?: TurnInteractionMode;
  /** PD-SAAS-FORK: synthetic/repair streak budget exhausted (sessionSyntheticTurnBudget). */
  syntheticBudgetExhausted?: boolean;
  /** PD-SAAS-FORK: N2 Bot steward — skip deliverable_repair only when kind is n2_bot. */
  sessionKind?: string | null;
};

export type ContinuationDecision = TaskExecutionDecision & {
  action: ContinuationAction;
};

export type UserActionRequiredNotice = {
  title: string;
  reason: string;
  steps: string[];
  settingsDeepLink?: string;
  confirmedAttempts: number;
  locale: PromptLanguage;
};

export type AskUserQuestionPolicy = {
  kind: Exclude<ElicitationKind, "none">;
  hasDefaultOption: boolean;
};

export function profileRequiresDeliverableForGoal(
  userGoal: string,
  capabilitySlug?: string,
  majorCategory?: string | null,
): boolean {
  const profile = resolveProfile(capabilitySlug, majorCategory, userGoal);
  return profile.id !== "default";
}

/** PD-SAAS-FORK: process-template execution contract or profile executionContract. */
export function hasProcessTemplateExecutionContract(
  userGoal: string,
  capabilitySlug?: string,
  majorCategory?: string | null,
): boolean {
  const profile = resolveProfile(capabilitySlug, majorCategory, userGoal);
  if (profile.executionContract) return true;
  return detectResearchReportTurn(userGoal)
    || detectContentFlywheelTurn(userGoal)
    || detectContentMatrixTurn(userGoal)
    || detectBrandCampaignFullTurn(userGoal)
    || detectSocialMatrixTurn(userGoal);
}

const TEMPLATE_PLANNING_STOP_RE =
  /(?:todo|待办|任务清单|exit_plan_mode|计划模式|Planning complete|I'll start with|接下来我会)/i;

function isTemplatePlanningOrSetupStop(ctx: ContinuationPolicyContext): boolean {
  if (ctx.planningOrSetupStop) return true;
  const userGoal = ctx.userGoal ?? "";
  if (!hasProcessTemplateExecutionContract(userGoal, ctx.capabilitySlug, ctx.majorCategory)) {
    return false;
  }
  const assistantText = ctx.assistantText ?? "";
  if (!assistantText.trim()) return false;
  return TEMPLATE_PLANNING_STOP_RE.test(assistantText)
    || shouldAutoContinueAfterIncompleteDeliverableStop(assistantText, {
      hadRecentToolSuccess: ctx.hadRecentToolSuccess,
      userGoalText: userGoal,
    });
}

/** Unified repair trigger — profile+goal, SDM slots, or partial delivery (verified>0 + gaps). */
export function shouldTriggerDeliverableRepair(ctx: ContinuationPolicyContext): boolean {
  // PD-SAAS-FORK: N2 Bot steward never enters deliverable_repair.
  if (ctx.sessionKind === "n2_bot") return false;
  const userGoal = ctx.userGoal ?? "";
  const qualityRework = isDeliverableQualityReworkGoal(userGoal, ctx.sessionManifest);
  const bindingFailures = ctx.validationResult?.bindingAudit?.failures?.length ?? 0;
  const bindingBlocksPassed =
    bindingFailures > 0
    && ctx.validationResult?.bindingAudit?.shadowOnly !== true;
  if (
    !bindingBlocksPassed
    && !qualityRework
    && (
      ctx.validationResult?.acceptance === "passed"
      || isAcceptanceSatisfied(ctx.validationResult?.completionState)
      || shouldStopAutomaticContinuation(ctx.validationResult?.completionState)
    )
  ) {
    return false;
  }
  if (ctx.sessionManifest?.repairCircuit?.tripped) {
    return false;
  }
  if (
    isChatFirstCapability(ctx.capabilitySlug ?? "", ctx.majorCategory)
    && !userRequestsBrainstormDeliverable(userGoal)
  ) {
    return false;
  }

  const validation = ctx.validationResult;
  const scopeDir = ctx.sessionManifest?.taskArtifactDir ?? null;
  const scopedMissing = validation
    ? filterNonDeliverableGapPaths(
      filterAcceptancePathsForScope(validation.missing, scopeDir),
      ctx.sessionManifest,
    )
    : [];
  const scopedBroken = validation
    ? filterNonDeliverableGapPaths(
      filterAcceptancePathsForScope(validation.broken, scopeDir),
      ctx.sessionManifest,
    )
    : [];
  const sdmIncomplete = hasSdmIncompleteSlots(ctx.sessionManifest, validation, {
    userGoal: ctx.userGoal,
    capabilitySlug: ctx.capabilitySlug,
    majorCategory: ctx.majorCategory,
  });
  const groundTruthPassed = validation
    ? shouldTreatSdmAsComplete({
        userGoal: ctx.userGoal ?? ctx.sessionManifest?.sessionGoalAnchor ?? "",
        verified: validation.verified,
        missing: scopedMissing,
        broken: scopedBroken,
        sessionManifest: ctx.sessionManifest,
        capabilitySlug: ctx.capabilitySlug,
        majorCategory: ctx.majorCategory,
        profileId: ctx.sessionManifest?.profileId,
      })
    : false;
  const hasGaps = bindingBlocksPassed
    || scopedMissing.length > 0
    || scopedBroken.length > 0
    || validation?.acceptance === "needs_repair"
    || (sdmIncomplete && !groundTruthPassed);
  if (!hasGaps) return false;

  if (
    (ctx.sessionManifest?.profileId === "script-md" || isScriptDraftGoal(userGoal))
    && !isVideoMp4FilmGoal(userGoal)
    && (validation?.verified ?? []).some((path) => /\.md$/i.test(path))
  ) {
    const leftover = [...scopedMissing, ...scopedBroken].filter((path) => !/\.mp4$/i.test(path));
    if (leftover.length === 0) return false;
  }

  if (
    isRepairAliasShortCircuitEnabled()
    && ctx.sessionManifest?.slots?.length
    && validation
    && validation.verified.length > 0
  ) {
    const activeSlots = ctx.sessionManifest.slots.filter((slot) => slot.status !== "removed");
    const allAliasSatisfied = activeSlots.length > 0
      && activeSlots.every((slot) => slotSatisfiedByValidation(slot, validation.verified, {
        taskArtifactDir: scopeDir ?? undefined,
      }));
    if (allAliasSatisfied && !bindingBlocksPassed && scopedBroken.length === 0) {
      return false;
    }
  }

  const goalImplies = userGoalImpliesDeliverable(userGoal)
    || Boolean(ctx.sessionManifest?.slots?.length);

  const profileIdHint = String(ctx.sessionManifest?.profileId ?? "").trim();
  const profileGate = goalImplies && (
    profileIdHint
      ? profileIdHint !== "default"
      : profileRequiresDeliverableForGoal(userGoal, ctx.capabilitySlug, ctx.majorCategory)
  );
  const sdmGate = Boolean(ctx.sessionManifest?.slots?.length)
    && isSessionDeliverableManifestEnabled();
  const partialGate = Boolean(
    validation
    && validation.verified.length > 0
    && (scopedMissing.length > 0 || scopedBroken.length > 0 || (sdmIncomplete && !groundTruthPassed)),
  );

  if (qualityRework && goalImplies) {
    return true;
  }

  return profileGate
    || sdmGate
    || partialGate
    || validation?.acceptance === "needs_repair"
    || (goalImplies && Boolean(validation));
}

export function resolveContinuationAction(ctx: ContinuationPolicyContext): ContinuationAction {
  if (ctx.completionMode === "consultation") {
    return "none";
  }
  if (shouldSuppressExecuteContinuation(ctx.turnInteractionMode)) {
    return "none";
  }
  const userGoal = ctx.userGoal ?? "";
  if (isPureGreetingUserText(userGoal)) {
    return "none";
  }
  if (shouldStopAutomaticContinuation(ctx.validationResult?.completionState)) {
    return "none";
  }
  const assistantText = ctx.assistantText ?? "";

  if (
    isBareTransientNetworkErrorBody(assistantText)
    && userGoalImpliesDeliverable(userGoal)
  ) {
    if (ctx.autoRecoveryContinueEnabled === false) {
      return "stop";
    }
    return "auto_continue_engine";
  }

  const blocker = ctx.blocker ?? classifyUserActionBlocker({
    assistantText: ctx.assistantText,
    toolErrorMessage: ctx.toolErrorMessage,
    toolErrorCode: ctx.toolErrorCode,
  });

  if (blocker) {
    const slug = String(ctx.capabilitySlug ?? "").trim();
    if (
      blocker.type === "missing_key"
      && (isHyperframesVideoSlug(slug) || /hyperframes|render_hyperframes|hf-website-to-video/i.test(ctx.toolErrorMessage ?? ""))
      && !isHfKeyOptionalDegradeEnabled()
    ) {
      return "user_action_required";
    }
    if (
      blocker.type === "missing_key"
      && isHfKeyOptionalDegradeEnabled()
      && (isHyperframesVideoSlug(slug) || /hyperframes|render_hyperframes|hf-website-to-video/i.test(ctx.toolErrorMessage ?? ""))
    ) {
      return "retry_alternate";
    }
    if (shouldBypassOptionalMissingKeyBlocker(blocker, {
      userGoal: ctx.userGoal,
      assistantText: ctx.assistantText,
      toolErrorMessage: ctx.toolErrorMessage,
      capabilitySlug: ctx.capabilitySlug,
      majorCategory: ctx.majorCategory,
    })) {
      return "retry_alternate";
    }
    if (blocker.unambiguous) {
      return "user_action_required";
    }
    const streak = ctx.blockerStreak ?? 0;
    if (streak >= USER_ACTION_BLOCKER_CONFIRM_THRESHOLD) {
      return "user_action_required";
    }
    if (streak >= 1) {
      return "retry_alternate";
    }
  }

  if (ctx.missingIrreplaceableInput) {
    const streak = ctx.blockerStreak ?? 0;
    if (streak >= USER_ACTION_BLOCKER_CONFIRM_THRESHOLD) {
      return "user_action_required";
    }
    if (streak >= 1) {
      return "retry_alternate";
    }
  }

  const validation = ctx.validationResult;
  if (validation?.acceptance === "user_action_required") {
    return "user_action_required";
  }
  if (ctx.syntheticBudgetExhausted) {
    return "user_action_required";
  }
  // PD-SAAS-FORK: irreversible side effects with any validation gap must not fall through to "none"
  // (phantom/non-artifact gaps may suppress deliverable_repair but still block auto-recovery).
  if (sideEffectRequiresConfirmation(ctx)) {
    const validation = ctx.validationResult;
    const rawMissing = validation?.missing?.length ?? 0;
    const rawBroken = validation?.broken?.length ?? 0;
    if (rawMissing > 0 || rawBroken > 0 || shouldTriggerDeliverableRepair(ctx)) {
      return "user_action_required";
    }
  }
  if (shouldTriggerDeliverableRepair(ctx)) {
    if (sideEffectRequiresConfirmation(ctx)) {
      return "user_action_required";
    }
    if (ctx.autoRecoveryContinueEnabled === false) {
      return "stop";
    }
    return "deliverable_repair";
  }

  if (
    isTemplatePlanningOrSetupStop(ctx)
    || shouldAutoContinueAfterIncompleteDeliverableStop(ctx.assistantText ?? "", {
      hadRecentToolSuccess: ctx.hadRecentToolSuccess,
      userGoalText: userGoal,
    })
    || shouldAutoContinueAfterAssistantText(ctx.assistantText ?? "", {
      hadRecentToolSuccess: ctx.hadRecentToolSuccess,
      latestUserText: userGoal,
      userGoalText: userGoal,
    })
  ) {
    if (sideEffectRequiresConfirmation(ctx)) {
      return "user_action_required";
    }
    if (ctx.autoRecoveryContinueEnabled === false) {
      return "stop";
    }
    return "auto_continue_engine";
  }

  return "none";
}

export function resolveContinuationDecision(ctx: ContinuationPolicyContext): ContinuationDecision {
  const action = resolveContinuationAction(ctx);
  switch (action) {
    case "user_action_required": {
      const decision = reduceTaskExecutionState({
        state: "executing",
        event: "needsUserInput",
      });
      return { action, ...decision };
    }
    case "deliverable_repair": {
      const decision = reduceTaskExecutionState({
        state: "validating",
        event: "acceptanceFailed",
        missingPaths: ctx.validationResult?.missing,
        brokenPaths: ctx.validationResult?.broken,
      });
      return { action, ...decision };
    }
    case "auto_continue_engine":
    case "retry_alternate": {
      const decision = reduceTaskExecutionState({
        state: "executing",
        event: "recoverableFailed",
      });
      return { action, ...decision };
    }
    case "stop":
      return { action, state: "failed_unrecoverable", owner: "none", reason: "auto_recovery_disabled" };
    case "none":
      return { action, state: "executing", owner: "none", reason: "no_continuation_needed" };
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

export function shouldBypassOptionalMissingKeyBlocker(
  blocker: UserActionBlocker,
  ctx: {
    userGoal?: string;
    assistantText?: string;
    toolErrorMessage?: string;
    capabilitySlug?: string;
    majorCategory?: string | null;
  },
): boolean {
  if (blocker.type !== "missing_key") return false;
  const goal = String(ctx.userGoal ?? "");
  if (!goal) return false;

  const hasExplicitDegradeInstruction = /(?:降级|不可用.*仍交付|不要中断|mock|自检|占位)/i.test(goal);
  const directStart = userGoalRequestsDirectStart(goal);
  const serviceId = blocker.serviceId ?? "";
  const fingerprint = blocker.fingerprint;

  // GEO full case: optional Xiaohongshu draft via Yixiaoer must not hard-stop the pack.
  if (serviceId === "yixiaoer" || fingerprint.includes("yixiaoer")) {
    if (
      isBrandGeoFullCaseGoal(goal)
      && (
        hasExplicitDegradeInstruction
        || /(?:可选|optional)/i.test(goal)
      )
      && !/(?:必须.*(?:草稿|推送|发布)|non-optional)/i.test(goal)
    ) {
      return true;
    }
    return false;
  }

  const profile = resolveProfile(ctx.capabilitySlug, ctx.majorCategory, goal);
  if (
    profile.executionContract?.optionalMissingKeyServices.includes(serviceId)
    || profile.executionContract?.optionalMissingKeyServices.some((service) => fingerprint.includes(service))
  ) {
    return true;
  }

  const isOptionalGeoValidation =
    isBrandGeoFullCaseGoal(goal)
    && /(?:mineru|documentocr|document_ocr|api|export)/i.test(fingerprint);
  if (hasExplicitDegradeInstruction && isOptionalGeoValidation) {
    return true;
  }

  const isOptionalForDeliverableTask =
    serviceId === "image"
    || serviceId === "video"
    || serviceId === "export"
    || serviceId === "api"
    || serviceId === "mineru"
    || /missing_key:(?:api|export|mineru|image|video)/.test(fingerprint);

  // Social matrix: optional export/OCR/image must never hard-stop the whole pack.
  if (isSocialMatrixGoal(goal) && isOptionalForDeliverableTask) {
    return true;
  }

  if (directStart && userGoalImpliesDeliverable(goal) && isOptionalForDeliverableTask) {
    return true;
  }

  return false;
}

type MissingKeyNoticeCopy = {
  serviceLabel: string;
  failureAction: string;
  settingsStep: string;
};

function resolveMissingKeyNoticeCopy(
  blocker: UserActionBlocker,
  userGoal: string | undefined,
  zh: boolean,
): MissingKeyNoticeCopy {
  const serviceId = blocker.serviceId ?? "api";

  switch (serviceId) {
    case "mineru":
      return {
        serviceLabel: zh ? "MinerU 文档 OCR" : "MinerU document OCR",
        failureAction: zh ? "无法继续 OCR/导出" : "cannot continue OCR/export",
        settingsStep: zh
          ? "打开 设置 → 能力接入 → 文档 OCR"
          : "Open Settings → Providers → Document OCR",
      };
    case "yixiaoer":
      return {
        serviceLabel: zh ? "蚁小二" : "Yixiaoer",
        failureAction: zh ? "无法推送社媒草稿" : "cannot push social drafts",
        settingsStep: zh
          ? "打开 设置 → 能力接入 → 蚁小二（国内社媒发布）"
          : "Open Settings → Providers → Yixiaoer",
      };
    case "image":
      return {
        serviceLabel: zh ? "生图 API" : "image generation API",
        failureAction: zh ? "无法继续生成配图" : "cannot continue image generation",
        settingsStep: zh
          ? "打开 设置 → 模型池 → 图片生成（或能力接入 → 图片）"
          : "Open Settings → Model pool → Image generation",
      };
    case "video":
      return {
        serviceLabel: zh ? "生视频 API" : "video generation API",
        failureAction: zh ? "无法继续生成视频" : "cannot continue video generation",
        settingsStep: zh
          ? "打开 设置 → 模型池 → 视频生成（或能力接入 → 视频）"
          : "Open Settings → Model pool → Video generation",
      };
    case "bocha":
      return {
        serviceLabel: zh ? "博查联网搜索" : "Bocha web search",
        failureAction: zh ? "无法继续联网搜索" : "cannot continue web search",
        settingsStep: zh
          ? "打开 设置 → 能力接入 → 联网搜索"
          : "Open Settings → Providers → Web search",
      };
    case "export":
      return {
        serviceLabel: zh ? "文档导出" : "document export",
        failureAction: zh ? "无法继续导出文档" : "cannot continue document export",
        settingsStep: zh
          ? "打开 设置 → 能力接入 → 文档导出（或对应模型池）"
          : "Open Settings → Providers → Document export",
      };
    default: {
      if (isSocialMatrixGoal(userGoal ?? "") && /(?:草稿|蚁小二|yixiaoer)/i.test(userGoal ?? "")) {
        return {
          serviceLabel: zh ? "蚁小二" : "Yixiaoer",
          failureAction: zh ? "无法推送社媒草稿" : "cannot push social drafts",
          settingsStep: zh
            ? "打开 设置 → 能力接入 → 蚁小二（国内社媒发布）"
            : "Open Settings → Providers → Yixiaoer",
        };
      }
      return {
        serviceLabel: zh ? "相关 API" : "required API",
        failureAction: zh ? "无法继续当前步骤" : "cannot continue the current step",
        settingsStep: zh
          ? "打开 设置 → 能力接入（或对应模型池）"
          : "Open Settings → Providers (or model pool)",
      };
    }
  }
}

function sideEffectRequiresConfirmation(ctx: ContinuationPolicyContext): boolean {
  const goal = ctx.userGoal ?? "";
  const publishMode = /(?:草稿|不公开发布|draft\s*only|仅保存草稿)/i.test(goal) ? "draft" : undefined;
  return classifyAutoRecoverySideEffectRisk({
    userGoal: ctx.userGoal,
    assistantText: ctx.assistantText,
    publishMode,
  }).requiresUserConfirmation;
}

export function buildUserActionRequiredNotice(input: {
  blocker: UserActionBlocker;
  confirmedAttempts?: number;
  locale?: PromptLanguage;
  userGoal?: string;
  capabilitySlug?: string;
}): UserActionRequiredNotice {
  const locale = input.locale ?? "zh-CN";
  const attempts = input.confirmedAttempts ?? USER_ACTION_BLOCKER_CONFIRM_THRESHOLD;
  const zh = locale === "zh-CN";

  switch (input.blocker.type) {
    case "missing_key": {
      const slug = String(input.capabilitySlug ?? "").trim();
      const hfContext = isHyperframesVideoSlug(slug)
        || /hyperframes|render_hyperframes|hf-website-to-video/i.test(input.blocker.fingerprint ?? "");
      if (hfContext && !isHfKeyOptionalDegradeEnabled()) {
        return {
          title: zh ? "HyperFrames 视频渲染需要配置" : "HyperFrames render requires configuration",
          reason: zh
            ? "网站一键成片需要 HyperFrames 渲染凭据，当前未配置，任务已暂停。"
            : "Website-to-video requires HyperFrames credentials; the task is paused until configured.",
          steps: zh
            ? [
              "打开 设置 → 能力接入 → HyperFrames / 视频渲染",
              "填入有效的 API Key 或按说明配置 render_hyperframes",
              "在本对话回复「已配置，继续」",
            ]
            : [
              "Open Settings → Providers → HyperFrames / video render",
              "Enter a valid API key or configure render_hyperframes",
              "Reply \"configured, continue\" in this chat",
            ],
          settingsDeepLink: "settings:providers",
          confirmedAttempts: attempts,
          locale,
        };
      }
      const copy = resolveMissingKeyNoticeCopy(input.blocker, input.userGoal, zh);
      return {
        title: zh ? "需要您完成一项配置" : "Configuration required",
        reason: zh
          ? `已尝试 ${attempts} 种方式，仍缺少 ${copy.serviceLabel} 的 API Key，${copy.failureAction}。`
          : `After ${attempts} attempts, the ${copy.serviceLabel} API key is still missing; ${copy.failureAction}.`,
        steps: zh
          ? [
            copy.settingsStep,
            "填入有效的 API Key / Token 并保存",
            "在本对话回复「已配置，继续」",
          ]
          : [
            copy.settingsStep,
            "Save a valid API key or token",
            "Reply \"configured, continue\" in this chat",
          ],
        settingsDeepLink: "settings:providers",
        confirmedAttempts: attempts,
        locale,
      };
    }
    case "missing_attachment":
      return {
        title: zh ? "需要您提供附件" : "Attachment required",
        reason: zh
          ? `已尝试 ${attempts} 种方式，仍缺少完成任务所需的附件。`
          : `After ${attempts} attempts, a required attachment is still missing.`,
        steps: zh
          ? [
            "点击输入框旁的附件按钮，上传源文件（如 docx/pdf）",
            "确认文件出现在输入框上方的附件标签中",
            "发送消息或回复「已上传，继续」",
          ]
          : [
            "Use the attachment button above the input to upload the source file",
            "Confirm the file tag appears",
            "Send or reply \"uploaded, continue\"",
          ],
        confirmedAttempts: attempts,
        locale,
      };
    case "billing":
      return {
        title: zh ? "账户或用量问题" : "Billing issue",
        reason: zh ? "模型或 API 账户欠费/额度不足，系统无法继续调用。" : "The model account has billing or quota issues.",
        steps: zh
          ? ["检查模型池对应供应商账户余额", "更换可用模型或 API Key", "完成后回复「已配置，继续」"]
          : ["Check provider billing", "Switch model or API key", "Reply when ready"],
        settingsDeepLink: "settings:providers",
        confirmedAttempts: attempts,
        locale,
      };
    case "auth":
      return {
        title: zh ? "API 认证失败" : "Authentication failed",
        reason: zh ? "API Key 无效或已过期，无法继续。" : "The API key is invalid or expired.",
        steps: zh
          ? ["打开 设置 → 模型池，检查 Key 是否正确", "保存后回复「已配置，继续」"]
          : ["Open Settings → Model pool and verify the key", "Reply when updated"],
        settingsDeepLink: "settings:providers",
        confirmedAttempts: attempts,
        locale,
      };
    case "permission":
      return {
        title: zh ? "需要确认权限" : "Permission needed",
        reason: zh ? "执行下一步需要您授权工具权限。" : "Tool permission is required to continue.",
        steps: zh
          ? ["在弹出的权限提示中选择允许", "或到 设置 → 权限 中调整默认权限"]
          : ["Approve the permission prompt", "Or adjust defaults in Settings → Permissions"],
        settingsDeepLink: "settings:permissions",
        confirmedAttempts: attempts,
        locale,
      };
    case "missing_input":
    default:
      return {
        title: zh ? "需要补充信息" : "More information needed",
        reason: zh
          ? `已尝试 ${attempts} 次，仍缺少无法推断的关键信息。`
          : `After ${attempts} attempts, critical input is still missing.`,
        steps: zh
          ? ["补充主题、页数或参考附件", "或说明「直接开始做」让系统按默认继续"]
          : ["Provide topic, page count, or attachments", "Or say \"just start\" to proceed with defaults"],
        confirmedAttempts: attempts,
        locale,
      };
  }
}

export type PreferenceAskUserBypassReason = "direct_start" | "research_deliverable";

function isResearchDeliverableTurn(
  userGoal: string,
  capabilitySlug?: string,
  majorCategory?: string | null,
): boolean {
  const profile = resolveProfile(capabilitySlug, majorCategory, userGoal);
  const researchContext =
    profile.id === "research"
    || isNovaResearchCapabilitySlug(capabilitySlug)
    || detectResearchReportTurn(userGoal);
  if (!researchContext) return false;
  return userGoalImpliesDeliverable(userGoal)
    || profileRequiresDeliverableForGoal(userGoal, capabilitySlug, majorCategory)
    || detectResearchReportTurn(userGoal);
}

/** PD-SAAS-FORK: preference ask_user 在同 turn 自动绕过（Nova 调研 / directStart 交付）。 */
export function resolvePreferenceAskUserBypass(input: {
  userGoal: string;
  capabilitySlug?: string;
  majorCategory?: string | null;
  askUserPolicy: AskUserQuestionPolicy;
}): PreferenceAskUserBypassReason | null {
  if (input.askUserPolicy.kind !== "preference") return null;
  if (
    userGoalImpliesDeliverable(input.userGoal)
    && userGoalRequestsDirectStart(input.userGoal)
  ) {
    return "direct_start";
  }
  if (isResearchDeliverableTurn(input.userGoal, input.capabilitySlug, input.majorCategory)) {
    return "research_deliverable";
  }
  return null;
}

export function shouldAutoBypassPreferenceAskUser(input: {
  userGoal: string;
  capabilitySlug?: string;
  majorCategory?: string | null;
  askUserPolicy: AskUserQuestionPolicy;
}): boolean {
  return resolvePreferenceAskUserBypass(input) !== null;
}

export function classifyAskUserQuestionPolicy(input: {
  question?: string;
  options?: string[];
  requiredReason?: string;
  hasDefaultOption?: boolean;
}): AskUserQuestionPolicy {
  const kind = classifyElicitationKind(input);
  const hasDefaultOption = input.hasDefaultOption === true
    || (input.options ?? []).some((option) => /默认|推荐|继续|常用|先开始|default|recommended|continue/i.test(option));
  if (kind === "required") {
    return { kind: "required", hasDefaultOption };
  }
  return { kind: "preference", hasDefaultOption };
}

export function buildRetryAlternateWeakHint(input: {
  streak: number;
  locale?: PromptLanguage;
}): string {
  const locale = input.locale ?? "zh-CN";
  const n = Math.min(input.streak, USER_ACTION_BLOCKER_CONFIRM_THRESHOLD);
  if (locale === "zh-CN") {
    return `仍在尝试其他方式（${n}/${USER_ACTION_BLOCKER_CONFIRM_THRESHOLD}）…`;
  }
  return `Trying another approach (${n}/${USER_ACTION_BLOCKER_CONFIRM_THRESHOLD})…`;
}

export function shouldBrainstormEscalateToDeliverable(userGoal: string): boolean {
  return userRequestsBrainstormDeliverable(userGoal);
}
