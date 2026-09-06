// PD-SAAS-FORK: P0-1 exact capability completion mode, independent from dialogue/execute intent.

export type CapabilityCompletionMode = "consultation" | "report";

export type CapabilityCompletionModeContext = {
  slug?: string;
};

export type PriorCapabilityCompletionState = {
  capabilitySlug?: string;
  completionMode?: CapabilityCompletionMode;
  slots?: Array<{
    required?: boolean;
    status?: string;
  }>;
};

const STRATEGY_ADVISOR_SLUG = "ala-strategy-advisor";
const LAST_30_DAYS_SLUG = "mkt-last30days";
/** PD-SAAS-FORK Fix-7: exact-slug report/consultation split (mirrors strategy-advisor). */
const EXACT_REPORT_MODE_SLUGS = new Set([
  "ala-fact-checker",
  "ala-decision-helper",
]);
const OUTPUT_FILE_INTENT_RE = /(?:(?:须交付|生成|输出|产出|写(?:一份|成|入)?|制作|创建|保存|导出|整理成|形成|交付|(?:给我|需要|要)(?:一份|一个)).{0,24}(?:报告|文件|文档|\breport\b|\bfile\b|\bdocument\b)|(?:report|file|document).{0,16}(?:generate|create|save|export|write))/i;
const OUTPUT_BASENAME_RE = /(?:须交付|生成|输出|产出|导出|交付|保存(?:为)?|写(?:入|成)?|命名(?:为)?|文件名(?:为)?|deliver|save\s+as|write(?:\s+to)?)[^。\n]{0,50}?(?:[\w\u3400-\u9fff.-]+[\\/])*[\w\u3400-\u9fff-]+\.(?:md|html?|pdf|docx?|pptx?|xlsx?)(?=$|[\s，,。；;：:）)\]】」』"'`])/i;
const BASENAME_ONLY_RE = /^\s*(?:[\w\u3400-\u9fff.-]+[\\/])*[\w\u3400-\u9fff-]+\.(?:md|html?|pdf|docx?|pptx?|xlsx?)\s*$/i;
const TASK_RESUME_ENVELOPE_RE = /<task-resume[\s>]/i;

function normalizeSlug(slug: string | undefined): string {
  return String(slug ?? "").trim().toLowerCase();
}

export function hasExplicitFileCompletionIntent(userText: string): boolean {
  const text = String(userText ?? "").trim();
  return OUTPUT_FILE_INTENT_RE.test(text)
    || OUTPUT_BASENAME_RE.test(text)
    || BASENAME_ONLY_RE.test(text);
}

export function resolveCapabilityCompletionMode(input: {
  capabilityContext?: CapabilityCompletionModeContext;
  userText: string;
}): CapabilityCompletionMode | undefined {
  const slug = normalizeSlug(input.capabilityContext?.slug);
  if (slug === LAST_30_DAYS_SLUG) return "report";
  if (TASK_RESUME_ENVELOPE_RE.test(input.userText)) return "consultation";
  if (EXACT_REPORT_MODE_SLUGS.has(slug)) {
    return hasExplicitFileCompletionIntent(input.userText) ? "report" : "consultation";
  }
  if (slug !== STRATEGY_ADVISOR_SLUG) return undefined;
  return hasExplicitFileCompletionIntent(input.userText) ? "report" : "consultation";
}

export function isCapabilityCompletionTaskResumeInput(userText: string): boolean {
  return TASK_RESUME_ENVELOPE_RE.test(String(userText ?? ""));
}

export function preserveCapabilityCompletionModeForContinuation(input: {
  currentMode: CapabilityCompletionMode | undefined;
  currentSlug?: string;
  continuationOnly: boolean;
  previousState?: PriorCapabilityCompletionState;
}): CapabilityCompletionMode | undefined {
  if (input.currentMode !== "consultation" || !input.continuationOnly) {
    return input.currentMode;
  }
  const currentSlug = normalizeSlug(input.currentSlug);
  const previousSlug = normalizeSlug(input.previousState?.capabilitySlug);
  if (currentSlug !== STRATEGY_ADVISOR_SLUG || previousSlug !== currentSlug) {
    return input.currentMode;
  }
  const priorWasReport = input.previousState?.completionMode === "report"
    || Boolean(input.previousState?.slots?.length);
  const hasIncompleteRequiredSlot = input.previousState?.slots?.some(
    (slot) => slot.required !== false && slot.status !== "done" && slot.status !== "removed",
  ) === true;
  return priorWasReport && hasIncompleteRequiredSlot ? "report" : input.currentMode;
}

const CONSULTATION_MUTATION_TOOL_RE = /(?:^|_)(?:write|edit|patch|delete|remove|move|copy|create|update|add|publish|send|upload|generate|render|export|compose|ocr|execute|run|install|click|type|fill|select|press|drag)(?:_|$)/i;
const CONSULTATION_EXPLICITLY_BLOCKED_TOOLS = new Set([
  "bash",
  "shell",
  "canvas_create_board",
  "canvas_update_board",
  "canvas_add_asset",
  "canvas_remove_asset",
]);

export function isToolAllowedForCapabilityCompletionMode(
  toolName: string,
  mode: CapabilityCompletionMode | undefined,
): boolean {
  if (mode !== "consultation") return true;
  const normalized = String(toolName ?? "").trim().toLowerCase();
  if (!normalized) return false;
  if (CONSULTATION_EXPLICITLY_BLOCKED_TOOLS.has(normalized)) return false;
  return !CONSULTATION_MUTATION_TOOL_RE.test(normalized);
}

export const CAPABILITY_SCOPE_EXACT_SLUGS = [
  LAST_30_DAYS_SLUG,
  STRATEGY_ADVISOR_SLUG,
  "ala-fact-checker",
  "ala-decision-helper",
] as const;
