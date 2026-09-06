// PD-SAAS-FORK: Goal Loop Phase 3 — detect add/remove/replace slot mutations in user text.
import { isContinuationOnlyUserText } from "../../agent/errors/userFacingErrors.js";
import type { AcceptanceArtifactKind } from "../deliverables/acceptanceArtifactKind.js";
import { defaultAddLabelForKind } from "../deliverables/sdmSlotLabels.js";
import { defaultPathHintForKind } from "../deliverables/sdmSlotMatching.js";
import {
  compileExactQuantityAssertions,
} from "../constraints/goalQualityContract.js";
import {
  hasExplicitOfficialMediaSourceRequirement,
} from "../constraints/officialMediaRequirement.js";
import { blockSilentResearchAddMode } from "../resilience/stabilityFlags.js";
import { recordStabilityEvent } from "../../telemetry/stabilityEvents.js";
import type { SessionDeliverableManifest } from "./sessionDeliverableManifest.js";

export type GoalMutationAction = "add" | "remove" | "replace" | "prune";

export type GoalMutationResult = {
  mutated: boolean;
  action?: GoalMutationAction;
  /** PD-SAAS-FORK P0-2: bump the shared version while preserving frozen SDM slots. */
  qualityOnly?: boolean;
  targetKind?: AcceptanceArtifactKind;
  targetLabel?: string;
  /** PD-SAAS-FORK: remove a specific SDM slot by id (e.g. profile_geo_platform). */
  targetSlotId?: string;
  fromKind?: AcceptanceArtifactKind;
  toKind?: AcceptanceArtifactKind;
  toPathHint?: string;
  toLabel?: string;
  addKind?: AcceptanceArtifactKind;
  addLabel?: string;
  addPathHint?: string;
  addPathHints?: string[];
  addSlots?: Array<{
    addKind?: AcceptanceArtifactKind;
    addLabel?: string;
    addPathHint?: string;
    addPathHints?: string[];
  }>;
  /** PD-SAAS-FORK VAP P1-A: user corrected visuals only, not SDM slots. */
  visualCorrection?: boolean;
  /** PD-SAAS-FORK Fix-5: drop phantom accumulated/added slots from manifest. */
  pruneAccumulated?: boolean;
  /** PD-SAAS-FORK Fix-5: keep only these kinds when user narrows deliverables. */
  keepOnlyKinds?: AcceptanceArtifactKind[];
};

export type DetectGoalMutationInput = {
  userText: string;
  manifest?: SessionDeliverableManifest;
};

/** User explicitly wants to replace/converge deliverables — not accumulate. */
export const EXPLICIT_REPLACE_SIGNAL =
  /(?:只要|仅需|就行|即可|够了|就好)|(?:转成|导出为)|不要.{0,24}(?:只要|换成|改成)/i;

const CHANGE_TO_KIND_CAPTURE =
  /(?:改|换)(?:成|为).{0,20}(html|HTML|网页|落地页|pdf|PDF|docx|Word|word|pptx|PPT|幻灯|markdown|md|Markdown)/i;

const ONLY_KIND_CAPTURE =
  /只要.{0,16}(html|HTML|网页|落地页|pdf|PDF|docx|Word|word|pptx|PPT|幻灯|markdown|md|Markdown)/i;

const REMOVE_PATTERNS: Array<{ pattern: RegExp; label?: string; kind?: AcceptanceArtifactKind }> = [
  { pattern: /不要\s*(?:word|Word|docx)/i, kind: "docx", label: "Word" },
  { pattern: /(?:删|去掉|移除|取消).{0,8}(?:word|Word|docx)/i, kind: "docx" },
  { pattern: /不要\s*(?:html|HTML|网页|落地页)/i, kind: "html" },
  { pattern: /(?:删|去掉|移除).{0,8}(?:html|HTML|网页)/i, kind: "html" },
  { pattern: /不要\s*(?:pdf|PDF)/i, kind: "pdf" },
];

const PLATFORM_CANCEL_PATTERN =
  /(?:小红书|知乎|公众号|wechat|zhihu|xiaohongshu).{0,16}(?:不用|不做|取消|不要)|(?:不用|不做|取消|不要).{0,16}(?:小红书|知乎|公众号|wechat|zhihu|xiaohongshu)/i;

const OPERATION_MANUAL_ADD_PATTERN =
  /(?:增加|补充|编写|生成|创建|要).{0,24}(?:行业\s*)?(?:GEO\s*)?(?:操作手册|白皮书)|(?:操作手册|白皮书).{0,12}(?:GEO|geo)/i;

const MULTI_HTML_REPORT_PATTERN =
  /(?:三|3)(?:个|份).{0,12}(?:报告|文档).{0,40}(?:html|HTML|网页)|(?:html|HTML|网页|图表).{0,40}(?:三|3)(?:个|份).{0,12}(?:报告|文档)/i;

const QUALITY_ONLY_CHANGE_SIGNAL =
  /(?:改为|改成|调整为|调整成|设为|设置为|只用|仅用|必须|禁止|不得|不允许|允许|增加|补充|再加)/iu;
const QUALITY_ONLY_MEDIA_SIGNAL =
  /(?:AI|人工智能|模型)?(?:生图|生成图片|生成图像|绘图)|(?:占位|占位图|临时图)/iu;
const RECOVERY_ONLY_SIGNAL =
  /^(?:正在)?从上次(?:步骤|进度|中断处)(?:继续|恢复)|^(?:正在)?自动(?:继续|恢复)/iu;
const TASK_RESUME_MARKUP = /<task-resume\b[\s\S]*?<\/task-resume>/iu;
const PROJECT_MEMORY_MARKUP =
  /<project-memory\b[^>]*>[\s\S]*?<\/project-memory>/giu;

const VISUAL_CORRECTION_PATTERN =
  /(?:配图不对|图不对|图片不对|未使用官方|不是官图|(?:外观|内饰|外观图|内饰图).{0,8}不对|官图.{0,6}(?:不对|没用|未用))/iu;
const DELIVERABLE_QUALITY_COMPLAINT_PATTERN =
  /(?:无法显示|显示不出|不显示|白板|没有格式|没有配图|配图.{0,12}(?:无法|不能|没|无)|就是一个白板|也没(?:有)?图表)/iu;
const DELIVERABLE_QUALITY_CONTEXT_PATTERN =
  /(?:pdf|word|docx|ppt|pptx|报告|交付|word报告|幻灯)/iu;
const VISUAL_PARTIAL_OK_PATTERN =
  /(?:其他|别的|其余|文案|内容).{0,12}(?:没问题|可以|都行|OK|ok)|(?:没问题|可以).{0,12}(?:其他|别的|其余)/iu;

export function detectDeliverableQualityComplaintMutation(text: string): GoalMutationResult | null {
  const trimmed = String(text ?? "").trim();
  if (!trimmed || !DELIVERABLE_QUALITY_COMPLAINT_PATTERN.test(trimmed)) return null;
  if (!DELIVERABLE_QUALITY_CONTEXT_PATTERN.test(trimmed)) return null;
  return {
    mutated: true,
    action: "replace",
    qualityOnly: true,
    visualCorrection: true,
  };
}

/** Quality/visual rework on existing deliverables — bypass passed terminal locks and page-count elicitation. */
export function isDeliverableQualityReworkGoal(
  userText: string,
  manifest?: SessionDeliverableManifest,
): boolean {
  const trimmed = String(userText ?? "").trim();
  if (!trimmed) return false;
  if (detectDeliverableQualityComplaintMutation(trimmed)) return true;
  if (!manifest) return false;
  const mutation = detectGoalMutation({ userText: trimmed, manifest });
  return Boolean(mutation.mutated && (mutation.qualityOnly || mutation.visualCorrection));
}

export function detectVisualCorrectionMutation(text: string): GoalMutationResult | null {
  const trimmed = String(text ?? "").trim();
  if (!trimmed || !VISUAL_CORRECTION_PATTERN.test(trimmed)) return null;
  if (/已完成|没问题了|可以了|就这样/iu.test(trimmed) && !VISUAL_CORRECTION_PATTERN.test(trimmed)) {
    return null;
  }
  return {
    mutated: true,
    action: "replace",
    qualityOnly: true,
    visualCorrection: true,
    ...(VISUAL_PARTIAL_OK_PATTERN.test(trimmed)
      ? { targetLabel: "visual-only" }
      : {}),
  };
}

function detectQualityOnlyMutation(text: string): GoalMutationResult | null {
  if (!QUALITY_ONLY_CHANGE_SIGNAL.test(text)) return null;
  const hasExactQuantity = compileExactQuantityAssertions(text).length > 0;
  const hasOfficialMedia =
    hasExplicitOfficialMediaSourceRequirement(text);
  const hasMediaPolicy = QUALITY_ONLY_MEDIA_SIGNAL.test(text);
  if (!hasExactQuantity && !hasOfficialMedia && !hasMediaPolicy) return null;
  const action: GoalMutationAction =
    /(?:增加|补充|再加)/u.test(text) ? "add" : "replace";
  return {
    mutated: true,
    action,
    qualityOnly: true,
  };
}

type AddPatternRule = {
  pattern: RegExp;
  kind: AcceptanceArtifactKind;
  label: string;
  pathHint?: string;
  /** When true, skip if EXPLICIT_REPLACE_SIGNAL is present (handled as replace). */
  changeToAdd?: boolean;
};

const ADD_PATTERNS: AddPatternRule[] = [
  { pattern: /(?:再加|增加|补充|也要).{0,12}(?:html|HTML|网页|落地页)/i, kind: "html", label: "HTML 网页", pathHint: "index.html" },
  { pattern: /(?:再加|增加|补充).{0,12}(?:pdf|PDF)/i, kind: "pdf", label: "PDF 版", pathHint: "report.pdf" },
  { pattern: /(?:再加|增加|补充).{0,12}(?:ppt|PPT|pptx|幻灯)/i, kind: "pptx", label: "PPT 版", pathHint: "presentation.pptx" },
  { pattern: /(?:给我|帮我|请|想要|要做|做出|来一份).{0,24}(?:html|HTML|网页|落地页|仪表盘)/i, kind: "html", label: "HTML 网页", pathHint: "index.html" },
  // PD-SAAS-FORK: user follow-up formats after md deliverables (ES9 battlecard HTML report).
  {
    pattern: /(?:出|做|生成|制作|写|来).{0,16}(?:综合|整合|合并)?.{0,12}(?:html|HTML|网页).{0,16}(?:版|版本|报告)?/i,
    kind: "html",
    label: "HTML 综合报告",
    pathHint: "report.html",
  },
  {
    pattern: /(?:综合|整合|合并).{0,12}(?:html|HTML|网页).{0,12}(?:版|版本|报告)?/i,
    kind: "html",
    label: "HTML 综合报告",
    pathHint: "report.html",
  },
  {
    pattern: /(?:html|HTML|网页).{0,8}(?:版|版本).{0,8}(?:报告|综合)?/i,
    kind: "html",
    label: "HTML 版",
    pathHint: "report.html",
  },
  { pattern: /(?:配色|图表|dashboard|仪表盘).{0,20}(?:html|HTML)|(?:html|HTML).{0,20}(?:配色|图表|dashboard|仪表盘)/i, kind: "html", label: "HTML 网页", pathHint: "index.html" },
  {
    pattern: /(?:改|换)(?:成|为).{0,20}(?:html|HTML|网页|落地页)/i,
    kind: "html",
    label: "HTML 网页",
    pathHint: "index.html",
    changeToAdd: true,
  },
  {
    pattern: /(?:改|换)(?:成|为).{0,20}(?:pdf|PDF)/i,
    kind: "pdf",
    label: "PDF 版",
    pathHint: "report.pdf",
    changeToAdd: true,
  },
  {
    pattern: /(?:改|换)(?:成|为).{0,20}(?:word|Word|docx)/i,
    kind: "docx",
    label: "Word 版",
    pathHint: "report.docx",
    changeToAdd: true,
  },
  {
    pattern: /(?:改|换)(?:成|为).{0,20}(?:ppt|PPT|pptx|幻灯)/i,
    kind: "pptx",
    label: "PPT 版",
    pathHint: "presentation.pptx",
    changeToAdd: true,
  },
];

/** PD-SAAS-FORK (ROG Phase 5): explicit user add intent — pivot guard uses this. */
export function matchesExplicitAddPattern(text: string): boolean {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return false;
  if (ADD_PATTERNS.some((rule) => rule.pattern.test(trimmed))) return true;
  if (CHANGE_TO_KIND_CAPTURE.test(trimmed) && !EXPLICIT_REPLACE_SIGNAL.test(trimmed)) return true;
  return false;
}

const REPLACE_PATTERNS: Array<{
  pattern: RegExp;
  fromKind: AcceptanceArtifactKind;
  toKind: AcceptanceArtifactKind;
  toLabel: string;
  toPathHint?: string;
}> = [
  {
    pattern: /(?:markdown|md|Markdown).{0,16}(?:转|改成|换成|导出为).{0,8}(?:pdf|PDF)/i,
    fromKind: "markdown",
    toKind: "pdf",
    toLabel: "PDF 版",
    toPathHint: "report.pdf",
  },
  {
    pattern: /(?:markdown|md).{0,16}(?:转|改成|换成).{0,8}(?:word|Word|docx)/i,
    fromKind: "markdown",
    toKind: "docx",
    toLabel: "Word 版",
    toPathHint: "report.docx",
  },
  {
    pattern: /(?:word|Word|docx).{0,16}(?:转|改成|换成).{0,8}(?:pdf|PDF)/i,
    fromKind: "docx",
    toKind: "pdf",
    toLabel: "PDF 版",
    toPathHint: "report.pdf",
  },
];

function normalizeKindToken(raw: string): AcceptanceArtifactKind | undefined {
  const token = raw.trim().toLowerCase();
  if (["html", "网页", "落地页"].some((k) => token.includes(k))) return "html";
  if (token.includes("pdf")) return "pdf";
  if (["docx", "word"].some((k) => token.includes(k))) return "docx";
  if (["pptx", "ppt", "幻灯"].some((k) => token.includes(k))) return "pptx";
  if (["markdown", "md"].some((k) => token.includes(k))) return "markdown";
  return undefined;
}

function inferFromKindInText(text: string): AcceptanceArtifactKind | undefined {
  if (/(?:markdown|\.md\b)/i.test(text)) return "markdown";
  if (/(?:word|docx)/i.test(text)) return "docx";
  if (/(?:html|网页|落地页)/i.test(text) && /(?:不要|删掉|移除).{0,12}(?:html|网页)/i.test(text)) return "html";
  return undefined;
}

function defaultFromKindForReplace(
  manifest: SessionDeliverableManifest | undefined,
  toKind: AcceptanceArtifactKind,
): AcceptanceArtifactKind | undefined {
  const active = manifest?.slots.filter((s) => s.status !== "removed") ?? [];
  const kinds = active.map((s) => s.kind).filter(Boolean) as AcceptanceArtifactKind[];
  if (kinds.includes("markdown") && toKind !== "markdown") return "markdown";
  if (kinds.includes("docx") && toKind === "pdf") return "docx";
  if (kinds.includes("html") && toKind === "pdf") return "html";
  return kinds.find((k) => k !== toKind);
}

function detectExplicitReplaceMutation(
  text: string,
  manifest?: SessionDeliverableManifest,
): GoalMutationResult | null {
  if (!EXPLICIT_REPLACE_SIGNAL.test(text)) return null;

  let toKind: AcceptanceArtifactKind | undefined;
  const changeMatch = text.match(CHANGE_TO_KIND_CAPTURE);
  const onlyMatch = text.match(ONLY_KIND_CAPTURE);
  if (changeMatch?.[1]) toKind = normalizeKindToken(changeMatch[1]);
  else if (onlyMatch?.[1]) toKind = normalizeKindToken(onlyMatch[1]);
  if (!toKind) return null;

  let fromKind = inferFromKindInText(text);
  if (!fromKind || fromKind === toKind) {
    fromKind = defaultFromKindForReplace(manifest, toKind);
  }
  if (!fromKind || fromKind === toKind) return null;

  return {
    mutated: true,
    action: "replace",
    fromKind,
    toKind,
    toLabel: defaultAddLabelForKind(toKind),
    toPathHint: defaultPathHintForKind(toKind),
  };
}

function slugifyReportSegment(title: string): string {
  const trimmed = String(title ?? "").trim();
  if (!trimmed) return "report";
  const ascii = trimmed
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (ascii || "report").slice(0, 48);
}

function extractReportTitlesForHtml(text: string): string[] {
  const titles: string[] = [];
  const parts = text.split(/[、,，;；\n]+/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed.length < 4) continue;
    if (/^(?:以上|三个|三份|生成|专业|html|HTML|网页|图表)/i.test(trimmed)) continue;
    if (/(?:报告|白皮书|洞察|调查|手册)/i.test(trimmed)) {
      titles.push(trimmed.replace(/[、,，;；\s]+$/g, ""));
    }
  }
  return titles.slice(0, 6);
}

export function detectMultiHtmlDeliverableMutation(
  text: string,
  manifest?: SessionDeliverableManifest,
): GoalMutationResult | null {
  const trimmed = String(text ?? "").trim();
  if (!trimmed || !MULTI_HTML_REPORT_PATTERN.test(trimmed)) return null;
  if (manifest && shouldBlockWeakHtmlAddMutation(trimmed, manifest)) return null;
  const titles = extractReportTitlesForHtml(trimmed);
  const wantsThree = /(?:三|3)(?:个|份)/.test(trimmed);
  const defaultTitles = ["depth-report", "panorama", "operation-manual"];
  const count = wantsThree ? Math.max(3, titles.length) : (titles.length >= 2 ? titles.length : 3);
  let effectiveTitles = [...titles];
  if (effectiveTitles.length < count) {
    while (effectiveTitles.length < count) {
      effectiveTitles.push(defaultTitles[effectiveTitles.length] ?? `report-${effectiveTitles.length + 1}`);
    }
  } else if (effectiveTitles.length === 0) {
    effectiveTitles = defaultTitles.slice(0, count);
  }
  const addSlots = effectiveTitles.slice(0, count).map((title, index) => {
    const slug = slugifyReportSegment(title);
    return {
      addKind: "html" as AcceptanceArtifactKind,
      addLabel: title.length > 4 ? title.slice(0, 80) : `HTML 报告 ${index + 1}`,
      addPathHint: `report-${index + 1}-${slug}.html`,
    };
  });
  return { mutated: true, action: "add", addSlots };
}

function detectOperationManualAddMutation(text: string): GoalMutationResult | null {
  const trimmed = String(text ?? "").trim();
  if (!trimmed || /在哪|哪里|什么地方/i.test(trimmed)) return null;
  if (!OPERATION_MANUAL_ADD_PATTERN.test(trimmed)) return null;
  return {
    mutated: true,
    action: "add",
    addKind: "markdown",
    addLabel: "GEO 操作手册白皮书",
    addPathHint: "geo-operation-manual.md",
    addPathHints: ["geo-operation-manual.md", "gep-operation-manual.md"],
  };
}

const DELIVERABLE_LIST_PRUNE_PATTERN =
  /(?:串台|清单不对|清单.{0,8}不对|成果清单.{0,8}不对|多了|无关|混入|不是我要|不对的文件|错误文件|多余项|不该有)/iu;

function detectDeliverableListPruneMutation(text: string): GoalMutationResult | null {
  const trimmed = String(text ?? "").trim();
  if (!trimmed || !DELIVERABLE_LIST_PRUNE_PATTERN.test(trimmed)) return null;
  const keepOnly = detectExplicitReplaceMutation(trimmed)?.toKind
    ?? (ONLY_KIND_CAPTURE.test(trimmed)
      ? normalizeKindToken(trimmed.match(ONLY_KIND_CAPTURE)?.[1] ?? "")
      : undefined);
  return {
    mutated: true,
    action: "prune",
    pruneAccumulated: true,
    ...(keepOnly ? { keepOnlyKinds: [keepOnly] } : {}),
  };
}

function detectPlatformDraftCancelMutation(text: string): GoalMutationResult | null {
  if (!PLATFORM_CANCEL_PATTERN.test(String(text ?? "").trim())) return null;
  return {
    mutated: true,
    action: "remove",
    targetSlotId: "profile_geo_platform",
    targetLabel: "平台成稿",
  };
}

function manifestHasBaselineHtmlSlot(manifest: SessionDeliverableManifest): boolean {
  return manifest.slots.some(
    (slot) => slot.status !== "removed"
      && slot.kind === "html"
      && !slot.id.startsWith("added_"),
  );
}

export function anchorPromisesHtmlDeliverable(anchor: string): boolean {
  const text = String(anchor ?? "").trim();
  if (!text) return false;
  return /(?:html|HTML|网页|落地页)/i.test(text);
}

/** mkt-ads / mkt-last30days try-prompt: only marketing-deliverable.md, no HTML in anchor. */
export function isSingleMarkdownMktDeliverableAnchor(anchor: string): boolean {
  const text = String(anchor ?? "").trim();
  if (!/marketing-deliverable\.md/i.test(text)) return false;
  return !anchorPromisesHtmlDeliverable(text);
}

function manifestHasActiveAddedHtmlSlot(manifest: SessionDeliverableManifest): boolean {
  return manifest.slots.some(
    (slot) => slot.status !== "removed"
      && slot.kind === "html"
      && slot.id.startsWith("added_"),
  );
}

function shouldBlockWeakHtmlAddMutation(
  text: string,
  manifest: SessionDeliverableManifest,
): boolean {
  const anchor = String(manifest.sessionGoalAnchor ?? "").trim();
  if (isSingleMarkdownMktDeliverableAnchor(anchor) && !isExplicitDeliverableAddIntent(text)) {
    return true;
  }
  if (manifestHasActiveAddedHtmlSlot(manifest) && !isExplicitDeliverableAddIntent(text)) {
    return true;
  }
  return false;
}

function isExplicitDeliverableAddIntent(text: string): boolean {
  return /(?:给我|再要|另外|追加|还要|再交付|再加|增加|补充|也要)/i.test(text)
    || /再出(?:一个|一份)?.{0,12}(?:综合\s*)?(?:html|HTML|网页)/i.test(text)
    || /综合\s*(?:html|HTML|网页)\s*版/i.test(text);
}

/** Lite research session: 须交付单 md / nova-research — block silent html/pdf ADD. */
function isLiteResearchSessionForSilentAdd(manifest: SessionDeliverableManifest): boolean {
  const goal = String(manifest.sessionGoalAnchor ?? "");
  const slug = String(manifest.capabilitySlug ?? "").trim().toLowerCase();
  const liteGoal = /须交付\s*[:：]/i.test(goal)
    && /\.md\b/i.test(goal)
    && !/\.docx\b|01-sources-and-synthesis|03-report-body/i.test(goal);
  const liteSlug = slug.startsWith("nova-research-") || slug === "df-deep-research";
  if (!liteGoal && !liteSlug) return false;
  const active = manifest.slots.filter((s) => s.status !== "removed");
  const hasDocx = active.some((s) => s.kind === "docx" || /\.docx$/i.test(s.pathHint ?? ""));
  return !hasDocx;
}

function shouldBlockSilentResearchAdd(
  text: string,
  manifest: SessionDeliverableManifest,
  addKind: AcceptanceArtifactKind | undefined,
): boolean {
  const mode = blockSilentResearchAddMode();
  if (mode === "off") return false;
  if (addKind !== "html" && addKind !== "pdf") return false;
  if (!isLiteResearchSessionForSilentAdd(manifest)) return false;
  if (isExplicitDeliverableAddIntent(text)) return false;
  recordStabilityEvent({
    event: "silent_add_blocked",
    reason: mode,
    detail: { slug: String(manifest.capabilitySlug ?? "") },
  });
  // shadow: observe-only; enforce blocks
  return mode === "enforce";
}

function detectMultiFormatAddMutation(text: string): GoalMutationResult | null {
  const normalized = String(text ?? "").trim();
  if (detectDeliverableQualityComplaintMutation(normalized)) return null;
  if (!/(?:还有|以及|和|再要|另外|转为|转)/i.test(normalized)) return null;
  const wantsHtml = /(?:html|HTML|网页|图表)/i.test(normalized);
  const wantsPdf = /(?:pdf|PDF)/i.test(normalized);
  if (!wantsHtml && !wantsPdf) return null;
  const addSlots: NonNullable<GoalMutationResult["addSlots"]> = [];
  if (wantsHtml) {
    addSlots.push({ addKind: "html", addLabel: "HTML 版", addPathHint: "report.html" });
  }
  if (wantsPdf) {
    addSlots.push({ addKind: "pdf", addLabel: "PDF 版", addPathHint: "report.pdf" });
  }
  if (addSlots.length < 2) return null;
  return { mutated: true, action: "add", addSlots };
}

export function detectGoalMutation(input: DetectGoalMutationInput): GoalMutationResult {
  const rawText = String(input.userText ?? "").trim();
  if (!rawText || TASK_RESUME_MARKUP.test(rawText)) return { mutated: false };
  const text = rawText.replace(PROJECT_MEMORY_MARKUP, " ").trim();
  if (
    !text
    || isContinuationOnlyUserText(text)
    || RECOVERY_ONLY_SIGNAL.test(text)
  ) {
    return { mutated: false };
  }
  if (!input.manifest) return { mutated: false };

  const qualityComplaint = detectDeliverableQualityComplaintMutation(text);
  if (qualityComplaint) return qualityComplaint;

  const visualCorrection = detectVisualCorrectionMutation(text);
  if (visualCorrection) return visualCorrection;

  const multiFormat = detectMultiFormatAddMutation(text);
  if (multiFormat) return multiFormat;

  const platformCancel = detectPlatformDraftCancelMutation(text);
  if (platformCancel) return platformCancel;

  const listPrune = detectDeliverableListPruneMutation(text);
  if (listPrune) return listPrune;

  const multiHtml = detectMultiHtmlDeliverableMutation(text, input.manifest);
  if (multiHtml) return multiHtml;

  const manualAdd = detectOperationManualAddMutation(text);
  if (manualAdd) return manualAdd;

  for (const rule of REMOVE_PATTERNS) {
    if (rule.pattern.test(text)) {
      return {
        mutated: true,
        action: "remove",
        targetKind: rule.kind,
        targetLabel: rule.label,
      };
    }
  }

  for (const rule of REPLACE_PATTERNS) {
    if (rule.pattern.test(text)) {
      return {
        mutated: true,
        action: "replace",
        fromKind: rule.fromKind,
        toKind: rule.toKind,
        toLabel: rule.toLabel,
        toPathHint: rule.toPathHint,
      };
    }
  }

  const explicitReplace = detectExplicitReplaceMutation(text, input.manifest);
  if (explicitReplace) return explicitReplace;

  for (const rule of ADD_PATTERNS) {
    if (!rule.pattern.test(text)) continue;
    if (rule.changeToAdd && EXPLICIT_REPLACE_SIGNAL.test(text)) continue;
    if (rule.kind === "html") {
      if (manifestHasBaselineHtmlSlot(input.manifest) && !isExplicitDeliverableAddIntent(text)) {
        continue;
      }
      if (shouldBlockWeakHtmlAddMutation(text, input.manifest)) {
        continue;
      }
    }
    // PD-SAAS-FORK 0731: lite research — 盘内/弱信号 html/pdf 静默 ADD
    if (shouldBlockSilentResearchAdd(text, input.manifest, rule.kind)) {
      continue;
    }
    const explicitPath = text.match(/([^\s/\\]+\.html?)\b/i)?.[1];
    const addPathHint = rule.kind === "html"
      ? (explicitPath && !/^index\.html$/i.test(explicitPath) ? explicitPath : undefined)
      : rule.pathHint;
    // PD-SAAS-FORK Razer RCA: baseline locked — block weak goal-fragment adds without basename.
    if (
      input.manifest.baselineLocked
      && !addPathHint
      && !/(?:给我|再要|另外|追加|还要|再交付|ADD)/i.test(text)
      && !(rule.kind === "html" && /html/i.test(text))
      && !(rule.kind === "pdf" && /pdf/i.test(text))
      && !(rule.kind === "pptx" && /(?:ppt|pptx|幻灯)/i.test(text))
    ) {
      continue;
    }
    return {
      mutated: true,
      action: "add",
      addKind: rule.kind,
      addLabel: rule.label,
      ...(addPathHint ? { addPathHint } : {}),
    };
  }

  const qualityOnly = detectQualityOnlyMutation(text);
  if (qualityOnly) return qualityOnly;

  return { mutated: false };
}
