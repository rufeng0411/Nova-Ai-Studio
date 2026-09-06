// PD-SAAS-FORK: expensive intent fuse — named files vs imperative slides, ask once then fail-open.
import {
  isContinuationOnlyUserText,
  userGoalRequestsDirectStart,
} from "../../agent/errors/userFacingErrors.js";
import {
  isAmbiguousFollowUpText,
  isShortClarificationAnswerText,
} from "../deliverableSessionGoal.js";
import {
  parseMustDeliverClause,
  stripLaunchContextAndAttachmentBlocks,
  stripNegatedDeliverableMentions,
} from "../deliverables/deliverableChecklistAuthority.js";
import { isPureGreetingUserText } from "./resolveCurrentIntent.js";
import type { StabilityTriStateMode } from "../resilience/stabilityFlags.js";
import { classifyElicitationKind } from "../taskState/taskLifecycle.js";

export const EXPENSIVE_INTENT_PPT_VS_FILES = "expensive_intent:ppt_vs_named_files";

export type ExpensiveIntentChosen = "keep_must_deliver" | "switch_to_ppt";

export type ExpensiveIntentFallbackReason =
  | "mode_not_enforce"
  | "no_conflict"
  | "unsafe_context"
  | "already_handled"
  | "direct_start"
  | "skip_list"
  | "admission_copy_invalid"
  | "payload_invalid"
  | "unparsed_reply";

export type ExpensiveIntentConflict = {
  fingerprint: typeof EXPENSIVE_INTENT_PPT_VS_FILES;
  mustDeliverNonPpt: boolean;
  imperativePpt: boolean;
};

export type ExpensiveIntentUserCopy = {
  title: string;
  reason: string;
  optionKeep: string;
  optionSwitch: string;
  hint: string;
};

export type ExpensiveIntentAskDecision =
  | { action: "ask"; fingerprint: typeof EXPENSIVE_INTENT_PPT_VS_FILES; copy: ExpensiveIntentUserCopy }
  | { action: "fallback_keep"; reason: ExpensiveIntentFallbackReason; conflict: ExpensiveIntentConflict | null }
  | { action: "no_op"; reason: ExpensiveIntentFallbackReason };

const IMPERATIVE_PPT_RE =
  /(?:另外|同时|再|并且)?(?:做成|做一份|来一份|导出|制作|生成)\s*(?:一份|一个)?\s*(?:PPT|pptx|幻灯片?|演示文稿)/i;

const PPTISH_PATH_RE = /\.pptx?$/i;

/** Mirror of taskLifecycle DEFAULT_CONTINUE_PATTERNS — options must never match these. */
const FORBIDDEN_OPTION_COPY_RE = [
  /默认/,
  /推荐/,
  /继续/,
  /常用/,
  /先开始/,
  /start/i,
  /continue/i,
  /default/i,
];

const EXPLICIT_SWITCH_RE =
  /^(?:2|２)$|现在改做演示稿|改做\s*PPT|改做\s*pptx|Switch to slides now/i;

function isClarificationGateEnvEnabled(): boolean {
  const raw = String(process.env.PILOTDECK_CLARIFICATION_GATE ?? "1").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

function slotPathHints(slot: { pathHint?: string; pathHints?: string[] }): string[] {
  return [
    slot.pathHint ?? "",
    ...(Array.isArray(slot.pathHints) ? slot.pathHints : []),
  ].map((hint) => String(hint)).filter(Boolean);
}

function isPptishSlot(slot: { kind?: string; pathHint?: string; pathHints?: string[] }): boolean {
  const hints = slotPathHints(slot);
  if (hints.some((hint) => PPTISH_PATH_RE.test(hint))) return true;
  if (hints.some((hint) => /\.(md|markdown|html?|docx?|pdf)$/i.test(hint))) return false;
  return String(slot.kind ?? "").toLowerCase() === "pptx";
}

function optionCopyLooksForbidden(label: string): boolean {
  const text = String(label ?? "").trim();
  if (!text) return true;
  return FORBIDDEN_OPTION_COPY_RE.some((pattern) => pattern.test(text));
}

function isLatestUserTooShortToOpenAsk(latestUserRaw: string): boolean {
  const text = String(latestUserRaw ?? "").trim();
  if (!text) return true;
  if (isContinuationOnlyUserText(text)) return true;
  if (isAmbiguousFollowUpText(text)) return true;
  if (isShortClarificationAnswerText(text)) return true;
  return /^(?:好|嗯|哦|啊|呃|行|可以|ok|okay|啊？|好的)[？?!.。…]*$/i.test(text);
}

export function expensiveIntentUserCopy(lang: "zh-CN" | "en"): ExpensiveIntentUserCopy {
  if (lang === "en") {
    return {
      title: "Need a quick choice",
      reason: "You named specific files and also asked for slides. The wrong pick wastes a lot of work.",
      optionKeep: "Make the files you named (topics and longform) first — skip slides for now",
      optionSwitch: "Switch to slides now",
      hint: "Reply 1 or 2. Saying \"continue\" uses option 1.",
    };
  }
  return {
    title: "需要你选一下",
    reason: "你点名要做的文件，同时又说要做演示稿。选错一种会浪费不少时间。",
    optionKeep: "按你点名的文件做（选题和长文），先不做演示稿",
    optionSwitch: "现在改做演示稿",
    hint: "直接回复 1 或 2。回复「继续」按第 1 项。",
  };
}

export function detectExpensiveIntentConflict(goal: string): ExpensiveIntentConflict | null {
  const launched = stripLaunchContextAndAttachmentBlocks(String(goal ?? ""));
  const stripped = stripNegatedDeliverableMentions(launched);
  if (!stripped) return null;
  // parseMustDeliver on newline-collapsed text can glue「另外做成一份PPT」onto the last md label
  // and infer kind=pptx. Prefer the pre-collapse clause so named .md/.html stay non-ppt.
  const mustFromLaunched = parseMustDeliverClause(launched);
  const must = mustFromLaunched.length > 0 ? mustFromLaunched : parseMustDeliverClause(stripped);
  const mustNonPpt = must.some((slot) => !isPptishSlot(slot));
  const mustHasPpt = must.some((slot) => isPptishSlot(slot));
  const imperativePpt = IMPERATIVE_PPT_RE.test(stripped) && !mustHasPpt;
  if (!mustNonPpt || !imperativePpt) return null;
  return {
    fingerprint: EXPENSIVE_INTENT_PPT_VS_FILES,
    mustDeliverNonPpt: true,
    imperativePpt: true,
  };
}

export function stripImperativePptFromGoal(goal: string): string {
  return String(goal ?? "")
    .replace(IMPERATIVE_PPT_RE, " ")
    .replace(/[，,]\s*[，,]/g, "，")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function resolveExpensiveIntentCompileGoal(input: {
  userGoal: string;
  mode: StabilityTriStateMode;
  chosen?: ExpensiveIntentChosen | null;
}): { compileGoal: string; conflict: ExpensiveIntentConflict | null; stripped: boolean } {
  const userGoal = String(input.userGoal ?? "");
  const conflict = detectExpensiveIntentConflict(userGoal);
  if (input.mode !== "enforce" || !conflict || input.chosen === "switch_to_ppt") {
    return { compileGoal: userGoal, conflict, stripped: false };
  }
  return {
    compileGoal: stripImperativePptFromGoal(userGoal),
    conflict,
    stripped: true,
  };
}

export function assertExpensiveIntentAskPayload(input: {
  kind?: string;
  hasDefaultOption?: boolean;
  fingerprint?: string;
  question?: string;
  optionKeep?: string;
  optionSwitch?: string;
}): boolean {
  if (input.kind !== "required") return false;
  if (input.hasDefaultOption !== false) return false;
  if (input.fingerprint !== EXPENSIVE_INTENT_PPT_VS_FILES) return false;
  if (!String(input.question ?? "").trim()) return false;
  const keep = String(input.optionKeep ?? "").trim();
  const sw = String(input.optionSwitch ?? "").trim();
  if (!keep || !sw) return false;
  if (optionCopyLooksForbidden(keep) || optionCopyLooksForbidden(sw)) return false;
  const question = String(input.question);
  if (!question.includes(keep) || !question.includes(sw)) return false;
  return true;
}

export function admitExpensiveIntentAsk(input: {
  userGoal: string;
  mode: StabilityTriStateMode;
  loopIteration: number;
  latestUserRaw: string;
  alreadyAskedFingerprint?: string | null;
  fuseAlreadyHandled?: boolean;
  skipUnsafeContext?: boolean;
  capabilitySlug?: string;
  promptLanguage?: "zh-CN" | "en";
}): ExpensiveIntentAskDecision {
  const userGoal = String(input.userGoal ?? "");
  const latestUserRaw = String(input.latestUserRaw ?? "");
  const conflict = detectExpensiveIntentConflict(userGoal);
  if (input.mode !== "enforce") {
    return { action: "fallback_keep", reason: "mode_not_enforce", conflict };
  }
  if (!conflict) {
    return { action: "no_op", reason: "no_conflict" };
  }
  if (input.loopIteration !== 1) {
    return { action: "fallback_keep", reason: "unsafe_context", conflict };
  }
  if (
    input.skipUnsafeContext
    || /<task-resume\b/i.test(latestUserRaw)
    || /<task-resume\b/i.test(userGoal)
  ) {
    return { action: "fallback_keep", reason: "unsafe_context", conflict };
  }
  const asked = String(input.alreadyAskedFingerprint ?? "").trim();
  if (input.fuseAlreadyHandled || asked === EXPENSIVE_INTENT_PPT_VS_FILES) {
    return { action: "fallback_keep", reason: "already_handled", conflict };
  }
  if (userGoalRequestsDirectStart(latestUserRaw) || userGoalRequestsDirectStart(userGoal)) {
    return { action: "fallback_keep", reason: "direct_start", conflict };
  }
  const slug = String(input.capabilitySlug ?? "").trim().toLowerCase();
  if (isPureGreetingUserText(latestUserRaw)) {
    return { action: "fallback_keep", reason: "skip_list", conflict };
  }
  if (
    slug.includes("content-flywheel")
    || slug.includes("content-ip")
    || slug === "mkt-content-flywheel"
  ) {
    return { action: "fallback_keep", reason: "skip_list", conflict };
  }
  if (!isClarificationGateEnvEnabled()) {
    return { action: "fallback_keep", reason: "unsafe_context", conflict };
  }
  const launched = stripLaunchContextAndAttachmentBlocks(userGoal);
  const cheapSlots = parseMustDeliverClause(launched);
  const cheapFallback = cheapSlots.length > 0
    ? cheapSlots
    : parseMustDeliverClause(
      stripImperativePptFromGoal(stripNegatedDeliverableMentions(launched)),
    );
  if (!cheapFallback.some((slot) => !isPptishSlot(slot))) {
    return { action: "no_op", reason: "no_conflict" };
  }
  if (isLatestUserTooShortToOpenAsk(latestUserRaw)) {
    return { action: "fallback_keep", reason: "unsafe_context", conflict };
  }
  const lang = input.promptLanguage === "en" ? "en" : "zh-CN";
  const copy = expensiveIntentUserCopy(lang);
  if (optionCopyLooksForbidden(copy.optionKeep) || optionCopyLooksForbidden(copy.optionSwitch)) {
    return { action: "fallback_keep", reason: "admission_copy_invalid", conflict };
  }
  const question = [
    copy.reason,
    `1. ${copy.optionKeep}`,
    `2. ${copy.optionSwitch}`,
    copy.hint,
  ].join("\n");
  const kind = classifyElicitationKind({
    question,
    requiredReason: "expensive_intent_conflict",
    hasDefaultOption: false,
  });
  if (kind !== "required") {
    return { action: "fallback_keep", reason: "admission_copy_invalid", conflict };
  }
  if (!assertExpensiveIntentAskPayload({
    kind,
    hasDefaultOption: false,
    fingerprint: EXPENSIVE_INTENT_PPT_VS_FILES,
    question,
    optionKeep: copy.optionKeep,
    optionSwitch: copy.optionSwitch,
  })) {
    return { action: "fallback_keep", reason: "payload_invalid", conflict };
  }
  return {
    action: "ask",
    fingerprint: EXPENSIVE_INTENT_PPT_VS_FILES,
    copy,
  };
}

export function resolveExpensiveIntentConflictReply(
  userText: string,
  pendingFingerprint: string | null,
): { handled: boolean; chosen: ExpensiveIntentChosen | null; fallbackReason?: ExpensiveIntentFallbackReason } {
  const pending = String(pendingFingerprint ?? "").trim();
  if (!pending) {
    return { handled: false, chosen: null };
  }
  const text = String(userText ?? "").trim();
  const copyZh = expensiveIntentUserCopy("zh-CN");
  const copyEn = expensiveIntentUserCopy("en");
  if (
    EXPLICIT_SWITCH_RE.test(text)
    || text === copyZh.optionSwitch
    || text === copyEn.optionSwitch
  ) {
    return { handled: true, chosen: "switch_to_ppt" };
  }
  const explicitKeep = text === "1" || text === "１"
    || text === copyZh.optionKeep
    || text === copyEn.optionKeep;
  return {
    handled: true,
    chosen: "keep_must_deliver",
    ...(explicitKeep || isContinuationOnlyUserText(text) ? {} : { fallbackReason: "unparsed_reply" as const }),
  };
}

export function scanExpensiveIntentFuseFromMessages(messages: Array<{
  role?: string;
  type?: string;
  metadata?: {
    expensiveIntentFingerprint?: string;
    expensiveIntentHandled?: boolean;
    synthetic?: boolean;
  };
}> | undefined): { alreadyAskedFingerprint: string | null; fuseAlreadyHandled: boolean } {
  let alreadyAskedFingerprint: string | null = null;
  let fuseAlreadyHandled = false;
  if (!Array.isArray(messages)) {
    return { alreadyAskedFingerprint, fuseAlreadyHandled };
  }
  for (const message of messages) {
    const fingerprint = String(message?.metadata?.expensiveIntentFingerprint ?? "").trim();
    if (fingerprint === EXPENSIVE_INTENT_PPT_VS_FILES) {
      alreadyAskedFingerprint = EXPENSIVE_INTENT_PPT_VS_FILES;
    }
    if (message?.metadata?.expensiveIntentHandled) {
      fuseAlreadyHandled = true;
    }
  }
  return { alreadyAskedFingerprint, fuseAlreadyHandled };
}

export function buildExpensiveIntentQuestion(copy: ExpensiveIntentUserCopy): string {
  return [copy.reason, `1. ${copy.optionKeep}`, `2. ${copy.optionSwitch}`, copy.hint].join("\n");
}

export function isExpensiveIntentKeepShortReply(userText: string): boolean {
  const text = String(userText ?? "").trim();
  if (!text) return true;
  if (isContinuationOnlyUserText(text)) return true;
  if (isAmbiguousFollowUpText(text)) return true;
  if (isShortClarificationAnswerText(text) && !EXPLICIT_SWITCH_RE.test(text)) return true;
  return text.length <= 24 && !/\.md\b|\.html?\b|须交付/i.test(text);
}
