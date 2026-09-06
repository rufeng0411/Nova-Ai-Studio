// PD-SAAS-FORK: pre-turn clarification gate for irreplaceable missing input (X1)
import { isExplicitContentFlywheelContractGoal } from "./deliverableCapabilityProfiles.js";
import { stripLaunchContextAndAttachmentBlocks } from "./deliverables/deliverableChecklistAuthority.js";
import { goalHasPageCount } from "./deliverableSessionGoal.js";
import { isDeliverableQualityReworkGoal } from "./taskState/detectGoalMutation.js";
import type { SessionDeliverableManifest } from "./taskState/sessionDeliverableManifest.js";
import { classifyElicitationKind } from "./taskState/taskLifecycle.js";
import { isExpensiveIntentClarifyMode } from "./resilience/stabilityFlags.js";
import { recordStabilityEvent } from "../telemetry/stabilityEvents.js";
import {
  EXPENSIVE_INTENT_PPT_VS_FILES,
  admitExpensiveIntentAsk,
  assertExpensiveIntentAskPayload,
  buildExpensiveIntentQuestion,
  detectExpensiveIntentConflict,
  expensiveIntentUserCopy,
} from "./intent/expensiveIntentConflict.js";

export type ClarificationNeed = {
  needed: boolean;
  question?: string;
  reason?: string;
  fingerprint?: string;
  kind?: "preference" | "required";
  hasDefaultOption?: boolean;
};

/** PD-SAAS-FORK 1bde3fb1: also accept 直接执行 / 禁止空转 (flywheel users never say「直接开始做」). */
const DIRECT_START_PATTERN =
  /直接开始做|直接执行|直接开做|开始执行|禁止空转|做完告诉我|不用问|别问|just start|don't ask/i;

/** PD-SAAS-FORK full-chain-speed: md/html office pack (report.md + pdf/docx/pptx) skips page-count prefs. */
export function isOfficeDeliverablePackGoal(userGoal: string): boolean {
  const goal = String(userGoal ?? "").trim();
  if (!goal) return false;
  if (/(?:四格式交付包|md-html-office-pack|report\.md[\s\S]*export_document)/i.test(goal)) {
    return true;
  }
  return (
    /\breport\.md\b/i.test(goal)
    && /(?:\.pdf\b|\.docx\b|\.pptx?\b|\bpdf\b|\bdocx\b|\bpptx?\b|\bword\b)/i.test(goal)
    && /(?:须交付|标准成果清单|四种格式|export_document|一键导出)/i.test(goal)
  );
}

/** PD-SAAS-FORK: env gate for pre-turn clarification (10b). Default on unless explicitly 0/false. */
export function isClarificationGateEnabled(): boolean {
  const raw = String(process.env.PILOTDECK_CLARIFICATION_GATE ?? "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

const ATTACHMENT_MARKUP_RE = /<attachment\b|\[Files attached/i;

function contentBlockLooksLikeAttachment(block: unknown): boolean {
  if (typeof block === "string") {
    return ATTACHMENT_MARKUP_RE.test(block);
  }
  if (!block || typeof block !== "object") return false;
  const typed = block as { type?: string; text?: string };
  const type = String(typed.type ?? "").toLowerCase();
  if (type === "file" || type === "image" || type === "attachment" || type === "pdf") {
    return true;
  }
  if (type === "text" && ATTACHMENT_MARKUP_RE.test(String(typed.text ?? ""))) {
    return true;
  }
  return false;
}

export function userMessageHasAttachments(messages: Array<{ role?: string; content?: unknown }>): boolean {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg?.role !== "user") continue;
    const content = msg.content;
    if (typeof content === "string") {
      return ATTACHMENT_MARKUP_RE.test(content);
    }
    if (!Array.isArray(content)) return false;
    return content.some((block) => contentBlockLooksLikeAttachment(block));
  }
  return false;
}

const HARNESS_CASE_TAG = /^\[[A-Za-z0-9_.:-]{1,48}\]\s*/;

export function stripHarnessCaseTag(userGoal: string): string {
  return String(userGoal ?? "").replace(HARNESS_CASE_TAG, "").trim();
}

export function hasConcreteTopic(userGoal: string): boolean {
  const goal = stripHarnessCaseTag(userGoal);
  if (goal.length < 8) return false;
  if (/^(帮我|请|做|生成|制作|写|来).{0,6}(ppt|pptx|幻灯|docx|word|文档)/i.test(goal) && goal.length < 24) {
    return false;
  }
  return true;
}

const SHORT_PPT_REWORK_GOAL =
  /^(?:做|生成|制作|导出|来)(?:成|个|一份|下)?\s*(?:ppt|pptx|幻灯片?)$/i;

/** Short PPT follow-up when SDM already anchors report/pptx/html deliverables (ES9 RCA). */
export function isFollowUpPptFromExistingDeliverables(
  userGoal: string,
  manifest?: SessionDeliverableManifest,
): boolean {
  const goal = String(userGoal ?? "").trim();
  if (!goal || !/(?:ppt|PPT|pptx|幻灯)/i.test(goal)) return false;
  if (!manifest?.slots?.length) return false;

  const hasDeliverableContext = manifest.slots.some((slot) => {
    const kind = String(slot.kind ?? "").toLowerCase();
    const hasPath = Boolean(slot.resolvedPath || slot.pathHint);
    const isContentSlot = kind === "markdown" || kind === "pptx" || kind === "html" || kind === "pdf" || kind === "docx";
    return isContentSlot && (slot.status === "done" || hasPath);
  });
  const hasSessionAnchor = (manifest.sessionGoalAnchor?.trim().length ?? 0) >= 24;

  if (!hasDeliverableContext && !hasSessionAnchor) return false;

  return SHORT_PPT_REWORK_GOAL.test(goal) || !hasConcreteTopic(goal);
}

export function detectClarificationNeeded(input: {
  userGoal?: string;
  hasAttachments?: boolean;
  capabilitySlug?: string;
  missingTopic?: boolean;
  missingPageCount?: boolean;
  sessionManifest?: SessionDeliverableManifest;
  latestUserRaw?: string;
  alreadyAskedFingerprint?: string | null;
  fuseAlreadyHandled?: boolean;
  skipUnsafeContext?: boolean;
  promptLanguage?: "zh-CN" | "en";
}): ClarificationNeed {
  // PD-SAAS-FORK 1bde3fb1: never score PPT/页数 prefs against inlined attachment HTML.
  const rawGoal = String(input.userGoal ?? "");
  const goalHasAttachmentMarkup = ATTACHMENT_MARKUP_RE.test(rawGoal);
  const goal = stripHarnessCaseTag(stripLaunchContextAndAttachmentBlocks(rawGoal)).trim();
  const hasAttachments = Boolean(input.hasAttachments) || goalHasAttachmentMarkup;
  if (!goal || DIRECT_START_PATTERN.test(goal)) {
    return { needed: false };
  }

  if (isDeliverableQualityReworkGoal(goal, input.sessionManifest)) {
    return { needed: false };
  }

  if (isFollowUpPptFromExistingDeliverables(goal, input.sessionManifest)) {
    return { needed: false };
  }

  if (isOfficeDeliverablePackGoal(goal)) {
    return { needed: false };
  }

  // Content flywheel / 选题→长文→社媒 is md pipeline — never ask slide page count.
  // Named-files vs imperative slides still proceeds to the expensive-intent fuse.
  if (isExplicitContentFlywheelContractGoal(goal) && !detectExpensiveIntentConflict(goal)) {
    return { needed: false };
  }
  const slugEarly = String(input.capabilitySlug ?? "").trim().toLowerCase();
  if (
    (
      slugEarly.includes("content-flywheel")
      || slugEarly.includes("content-ip")
      || slugEarly === "mkt-content-flywheel"
    )
    && !detectExpensiveIntentConflict(goal)
  ) {
    return { needed: false };
  }

  const latestUserRaw = String(input.latestUserRaw ?? goal);
  const expensiveMode = isExpensiveIntentClarifyMode();
  const expensiveAdmit = admitExpensiveIntentAsk({
    userGoal: goal,
    mode: expensiveMode,
    loopIteration: 1,
    latestUserRaw,
    alreadyAskedFingerprint: input.alreadyAskedFingerprint,
    fuseAlreadyHandled: input.fuseAlreadyHandled,
    skipUnsafeContext: input.skipUnsafeContext,
    capabilitySlug: input.capabilitySlug,
    promptLanguage: input.promptLanguage,
  });
  if (expensiveAdmit.action === "ask") {
    const copy = expensiveAdmit.copy;
    const question = buildExpensiveIntentQuestion(copy);
    const kind = classifyElicitationKind({
      question,
      requiredReason: "expensive_intent_conflict",
      hasDefaultOption: false,
    });
    const payloadOk = kind === "required" && assertExpensiveIntentAskPayload({
      kind,
      hasDefaultOption: false,
      fingerprint: EXPENSIVE_INTENT_PPT_VS_FILES,
      question,
      optionKeep: copy.optionKeep,
      optionSwitch: copy.optionSwitch,
    });
    if (payloadOk) {
      return {
        needed: true,
        question,
        reason: "expensive_intent_conflict",
        fingerprint: EXPENSIVE_INTENT_PPT_VS_FILES,
        kind: "required",
        hasDefaultOption: false,
      };
    }
    recordStabilityEvent({
      event: "expensive_intent_conflict_fallback",
      detail: {
        fingerprint: EXPENSIVE_INTENT_PPT_VS_FILES,
        mode: expensiveMode,
        ask: false,
        fallbackReason: "payload_invalid",
      },
    });
    return { needed: false };
  }
  if (expensiveMode === "shadow" && detectExpensiveIntentConflict(goal)) {
    recordStabilityEvent({
      event: "expensive_intent_conflict_shadow",
      detail: {
        fingerprint: EXPENSIVE_INTENT_PPT_VS_FILES,
        mode: "shadow",
        ask: false,
        stripped: false,
      },
    });
  } else if (
    expensiveMode === "enforce"
    && expensiveAdmit.action === "fallback_keep"
    && expensiveAdmit.conflict
  ) {
    recordStabilityEvent({
      event: "expensive_intent_conflict_fallback",
      detail: {
        fingerprint: EXPENSIVE_INTENT_PPT_VS_FILES,
        mode: expensiveMode,
        ask: false,
        fallbackReason: expensiveAdmit.reason,
      },
    });
  }

  const wantsPpt = /(?:ppt|PPT|pptx|幻灯)/i.test(goal);
  const wantsDoc = /(?:docx|word|文档)/i.test(goal);
  const slug = String(input.capabilitySlug ?? "").trim().toLowerCase();
  const htmlSlideSlug = /(?:html-ppt|frontend-slides|html-slides|nova-ppt|anth-pptx|ppt-master|df-ppt-generation)/.test(slug);
  const pptDirectStartGoal = /(?:原生可编辑\s*PPT|PPT\s*幻灯|【页数】|直接开始做)/i.test(goal);
  const isPptMaster = slug === "ppt-master" || /(?:原生可编辑\s*PPT|ppt-master)/i.test(goal);
  const isDfPptPptxRoute = slug === "df-ppt-generation"
    && /(?:演示稿|页数|\.pptx|可编辑|原生可编辑)/i.test(goal);

  // PD-SAAS-FORK (ROG Phase 6 F3 / Phase 7 G2): ppt-master & df-ppt pptx route skip page count.
  if (isPptMaster || isDfPptPptxRoute) {
    return { needed: false };
  }

  if (htmlSlideSlug || pptDirectStartGoal) {
    if (input.missingPageCount && !goalHasPageCount(goal)) {
      return { needed: false };
    }
    if (input.missingTopic && pptDirectStartGoal) {
      return { needed: false };
    }
  }

  if ((wantsPpt || wantsDoc) && !hasAttachments && input.missingTopic) {
    const question = "请补充主题或上传源文件（docx/pdf），或回复「直接开始做」让我按默认继续。";
    // PD-SAAS-FORK: classify through the shared elicitation classifier (the same
    // one the ask_user / lifecycle path uses) instead of hardcoding "preference".
    // A prompt with a default "直接开始做" option stays a preference (auto-continue);
    // a future required-style prompt without a default escalates to "required" (stop).
    const kind = classifyElicitationKind({ question, hasDefaultOption: true });
    return {
      needed: true,
      question,
      reason: "missing_attachment_or_topic",
      fingerprint: "missing_input:clarification",
      kind: kind === "none" ? "preference" : kind,
      hasDefaultOption: true,
    };
  }

  const htmlDemoGoal = /(?:页动画演示|HTML\s*演示|html\s*slide|frontend-slides|html-ppt)/i.test(goal);
  const hubTryDirectStart = DIRECT_START_PATTERN.test(goal) || /【页数】/.test(goal) || pptDirectStartGoal;

  if ((htmlSlideSlug || htmlDemoGoal || pptDirectStartGoal) && (hubTryDirectStart || goalHasPageCount(goal))) {
    return { needed: false };
  }

  if (slug.includes("nova-ppt") && goalHasPageCount(goal)) {
    return { needed: false };
  }

  if ((htmlSlideSlug || pptDirectStartGoal) && input.missingPageCount) {
    return { needed: false };
  }

  // PD-SAAS-FORK: PPT page count is a system default (6–12 by topic via
  // pptExportDefaultPolicy.resolveDefaultPptPageCount) — never questionnaire-block.
  if ((wantsPpt || htmlDemoGoal) && input.missingPageCount && !goalHasPageCount(goal)) {
    return { needed: false };
  }

  return { needed: false };
}
