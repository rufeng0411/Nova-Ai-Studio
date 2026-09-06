// PD-SAAS-FORK: authoritative deliverable checklist parsing — workflow steps ≠ SDM slots

import checklistAuthorityJson from "../../../config/deliverable-checklist-authority.json" with { type: "json" };
import type { SessionDeliverableSlot } from "../taskState/sessionDeliverableManifest.js";
import { isSaasGrowthFullGoal } from "../taskState/deliverableIntent.js";
import {
  isBrandCampaignFullCaseGoal,
  isCampaignFullCaseGoal,
  resolveCampaignSdmSlots,
} from "./campaignDeliverableGoal.js";
import { sanitizePollutedPathHints, stripDeliverableAnnotation } from "./deliverablePathHintSanitize.js";
import {
  isTier0LockedProfileId,
  listDeliverableProfiles,
  type DeliverableProfile,
} from "../deliverableCapabilityProfiles.js";
import { shouldBindGeoProfileForGoal } from "../taskState/mergeNumberedSlotsWithProfile.js";
import {
  distillSdmMode,
  isChecklistAuthorityTemplatesEnabled,
  openHtmlMinSdmMode,
} from "../resilience/stabilityFlags.js";
import { isHyperframesVideoSlug } from "../media/hyperframesEngineFlags.js";
import { detectResearchReportTurn, isProductUserResearchDeliverableGoal } from "../processTemplateExecutionPrompt.js";
import { recordStabilityEvent } from "../../telemetry/stabilityEvents.js";

export const STANDARD_DELIVERABLE_CHECKLIST_HEADER =
  /标准成果清单|standard\s+deliverables/i;

const NUMBERED_LINE =
  /^\s*(?:\d+[.、)]\s*|\(\d+\)\s*|第\s*\d+\s*[步段项点][:：]?\s*)(.+)$/;

/**
 * Basename with optional CJK letters — stops before CJK punctuation
 * (e.g. `file.md。使用 Open Design` → `file.md`).
 */
const PATH_IN_LABEL =
  /([A-Za-z0-9_\u4e00-\u9fff][A-Za-z0-9._\u4e00-\u9fff\-]*?\.(?:md|markdown|html?|pdf|docx?|pptx?|json(?:ld)?|png|jpe?g|csv|xlsx?|mp4|mp3|svg))/i;

/** PD-SAAS-FORK: 「不要做成视频 / 不要 PPT」不得当正交付意图。 */
const NEGATED_DELIVERABLE_SPAN =
  /不要(?:做成?)?(?:视频|成片|mp4|HTML\s*录屏|配图|调研包|Word(?:\s*[\/、]\s*PPT)?|PPT|pptx|幻灯片?|HTML)[^，。,\n]*/gi;

/** PD-SAAS-FORK: 「在 PPT 里没有展示」是质量投诉，不是要做 PPT。 */
const PPT_ABSENCE_COMPLAINT_SPAN =
  /(?:这[两几\d一二三四五六七八九十]*个)?(?:内容|文件|成果|材料)?(?:在|于)?\s*(?:PPT|pptx|幻灯片?|演示文稿)\s*(?:里|中|内|上|里面)?\s*(?:没有|未|没)\s*(?:展示|出现|体现|包含|呈现)[^，。,！!？?\n]*/gi;

export function stripNegatedDeliverableMentions(goal: string): string {
  return String(goal ?? "")
    .replace(NEGATED_DELIVERABLE_SPAN, " ")
    .replace(PPT_ABSENCE_COMPLAINT_SPAN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const LAUNCH_CONTEXT_BLOCK =
  /<launch-context\b[\s\S]*?<\/launch-context>/gi;

/** PD-SAAS-FORK 1bde3fb1: AttachmentResolver inlines full file bodies; strip before goal/profile/clarification. */
const ATTACHMENT_XML_BLOCK =
  /<attachment\b[^>]*>[\s\S]*?<\/attachment>/gi;

const ATTACHMENT_TAIL_BLOCK =
  /\[Files attached by user[\s\S]*$/i;

const BRAND_GEO_FULL_CASE_GOAL =
  /品牌\s*GEO\s*全案|geo-brand-full|AI\s*搜索可见度标准包|geo\/aeo|schema\.jsonld.*visibility-report/i;

const WORKFLOW_STEP_LINE =
  /read_skill|write_file|web_search|fetch_page|generate_|export_document|geo_api|yixiaoer|mkt-schema|geo-content|geo-citability|pd-geo|geo-aeo|od-data-report/i;

/** PD-SAAS-FORK Razer RCA: binding constraint / gateway template lines are not SDM slots. */
const BINDING_CONSTRAINT_LINE =
  /【硬性约束】|禁止|必须调用工具|render_hyperframes\s*\(|Gateway|DeepSeek|灌篮高手|下一代推理模型/i;

const POLLUTED_PATH_HINT_RE =
  /须交付|写入系统分配|\.md\.md|keywords\.html写入/i;

const MUST_DELIVER_CLAUSE =
  /须交付\s*[:：]\s*([\s\S]*?)(?:写入系统分配任务目录|写入系统|$)/i;

const SYSTEM_DIR_TAIL =
  /(?:[,，、]?\s*)?(?:写入系统分配任务目录|写入系统|存\s*artifacts)[^.。!！?？]*$/i;

const SLIDE_PAGE_COUNT_PATTERN =
  /(?:^|[\s，,、])(\d{1,2})\s*(?:页|张|p(?:age)?s?)\b|slide-NN|逐页|每页\s*slide/i;

const EXPLICIT_HTML_VIDEO_PATTERN =
  /(?:html|HTML|网页).{0,40}(?:视频|mp4|MP4|20\s*秒)|(?:视频|mp4|MP4|20\s*秒).{0,40}(?:html|HTML|网页)/i;

/** PD-SAAS-FORK ES9: nova product user research MD/HTML pair basenames. */
export const PRODUCT_USER_RESEARCH_MD = "product-user-research.md";
export const PRODUCT_USER_RESEARCH_HTML = "product-user-research.html";

const HTML_REPORT_INTENT_WITHOUT_BASENAME =
  /(?:带图表|HTML\s*报告|html\s*报告|可视化.*报告|网页版|HTML\s*网页)/i;

export { sanitizePollutedPathHints, stripDeliverableAnnotation } from "./deliverablePathHintSanitize.js";

function stripLabelTailNoise(label: string): string {
  return stripDeliverableAnnotation(
    String(label ?? "")
      .replace(SYSTEM_DIR_TAIL, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function extractPathHintFromLabel(label: string): string | undefined {
  const cleaned = stripLabelTailNoise(label);
  const pathMatch = cleaned.match(PATH_IN_LABEL);
  return normalizeAuthorityPathHint(pathMatch?.[1]);
}

function parseSlidePageCount(label: string, fullGoal?: string): number | undefined {
  const haystack = `${label} ${fullGoal ?? ""}`;
  const slideNn = /slide-NN/i.test(haystack);
  const match = haystack.match(/(\d{1,2})\s*(?:页|张)\b/);
  if (match?.[1]) {
    const count = Number.parseInt(match[1], 10);
    if (count >= 2 && count <= 40) return count;
  }
  if (slideNn) {
    const pagesMatch = haystack.match(/(\d{1,2})\s*(?:页|张)/);
    if (pagesMatch?.[1]) return Number.parseInt(pagesMatch[1], 10);
    return 10;
  }
  return undefined;
}

function slidePathHints(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const padded = String(index + 1).padStart(2, "0");
    return `slide-${padded}.png`;
  });
}

/** User explicitly enumerates HTML report + short video — two slots, not research default triple. */
export function parseExplicitHtmlVideoDeliverableSlots(userGoal: string): SessionDeliverableSlot[] {
  const text = stripNegatedDeliverableMentions(String(userGoal ?? "").trim());
  if (!text || !EXPLICIT_HTML_VIDEO_PATTERN.test(text)) return [];

  const slots: SessionDeliverableSlot[] = [];
  if (/(?:html|HTML|网页)/i.test(text)) {
    slots.push({
      id: "explicit_html_report",
      label: "HTML 报告",
      kind: "html",
      required: true,
      status: "active",
      stageOrder: 1,
    });
  }
  if (/(?:视频|mp4|MP4|20\s*秒)/i.test(text)) {
    slots.push({
      id: "explicit_video_clip",
      label: "视频成片",
      kind: "video",
      required: true,
      status: slots.length === 0 ? "active" : "pending",
      stageOrder: slots.length + 1,
    });
  }
  return slots;
}

/** Hub single-capability try prompts use「须交付：file1、file2」without numbered blocks. */
export function parseMustDeliverClause(userGoal: string): SessionDeliverableSlot[] {
  const text = String(userGoal ?? "").trim();
  if (!text) return [];
  const headerMatch = text.match(MUST_DELIVER_CLAUSE);
  if (!headerMatch?.[1]) return [];

  let clause = headerMatch[1].trim();
  clause = clause.split(/\n/)[0]?.trim() ?? clause;
  clause = clause.replace(/(?:不要|别做|禁止空转|直接开始做)[\s\S]*$/u, "").trim();
  const checklistIdx = clause.search(STANDARD_DELIVERABLE_CHECKLIST_HEADER);
  if (checklistIdx >= 0) {
    clause = clause.slice(0, checklistIdx).trim();
  }
  clause = clause.replace(/[。.!！?？]\s*$/, "").trim();
  if (!clause) return [];

  const parts = clause
    .split(/[、,，]/)
    .map((part) => part.trim())
    .filter(Boolean);

  const slots: SessionDeliverableSlot[] = [];
  for (const part of parts) {
    const cleanedPart = stripLabelTailNoise(part);
    let pathHint = extractPathHintFromLabel(cleanedPart);
    if (!pathHint && /(?:html|HTML|网页).*(?:报告|图表|风格)/i.test(cleanedPart)) {
      const mdPart = parts.find((entry) => /product-user-research\.md/i.test(entry));
      if (mdPart) {
        pathHint = PRODUCT_USER_RESEARCH_HTML;
      } else {
        const mdSlot = slots.find((slot) => slot.pathHint?.endsWith(".md"));
        pathHint = mdSlot?.pathHint?.replace(/\.md$/i, ".html") ?? PRODUCT_USER_RESEARCH_HTML;
      }
    }
    if (!pathHint && /(?:带图\s*HTML|HTML\s*版本|带图.*HTML|html.*版本)/i.test(cleanedPart)) {
      pathHint = PRODUCT_USER_RESEARCH_HTML;
    }
    if (!pathHint) continue;
    const label = cleanedPart.slice(0, 120);
    const kind = inferKindFromLabel(label);
    const id = `must_deliver_${slots.length + 1}_${slugifyId(pathHint)}`;
    slots.push({
      id,
      label: label || pathHint,
      required: true,
      status: slots.length === 0 ? "active" : "pending",
      stageOrder: slots.length + 1,
      kind,
      pathHint,
      pathHints: [pathHint],
    });
  }
  return slots;
}

function inferHtmlBasenameFromMd(mdBasename: string): string {
  if (/product-user-research\.md/i.test(mdBasename)) return PRODUCT_USER_RESEARCH_HTML;
  return mdBasename.replace(/\.md$/i, ".html");
}

function enrichProductResearchHtmlAliases(
  slots: SessionDeliverableSlot[],
): SessionDeliverableSlot[] {
  return slots.map((slot) => {
    const hint = slot.pathHint ?? "";
    if (!/product-user-research\.html/i.test(hint)) return slot;
    const hints = slot.pathHints ?? [hint];
    const merged = [
      hint,
      ...(["report.html", "product user research.html"] as const).filter(
        (alias) => !hints.some((h) => h.toLowerCase() === alias.toLowerCase()),
      ),
    ];
    return { ...slot, pathHints: merged };
  });
}

/** Add explicit HTML slot when goal promises MD+HTML but only MD was compiled. */
export function enrichHtmlPairDeliverableSlots(
  slots: SessionDeliverableSlot[],
  userGoal: string,
  capabilitySlug?: string,
): SessionDeliverableSlot[] {
  if (slots.length === 0) return slots;
  const goal = String(userGoal ?? "");
  const slug = String(capabilitySlug ?? "").trim().toLowerCase();
  const wantsHtml = HTML_REPORT_INTENT_WITHOUT_BASENAME.test(goal)
    || /product-user-research\.html/i.test(goal)
    || /nova-research-product-user|product-user-research/i.test(slug);

  let next = slots.map((slot, index) => {
    if (slot.kind === "html" && !slot.pathHint && /HTML|网页/.test(slot.label ?? "")) {
      const mdSlot = slots.find((entry) => entry.pathHint?.endsWith(".md"));
      const htmlHint = mdSlot?.pathHint
        ? inferHtmlBasenameFromMd(mdSlot.pathHint)
        : PRODUCT_USER_RESEARCH_HTML;
      return {
        ...slot,
        pathHint: htmlHint,
        pathHints: [htmlHint, "index.html", "report.html", "landing.html", "product user research.html"],
        stageOrder: slot.stageOrder ?? index + 1,
        stageId: slot.stageId ?? `stage_${index + 1}`,
      };
    }
    return slot;
  });

  const hasHtmlPath = next.some((slot) =>
    slot.pathHint?.endsWith(".html")
    || slot.pathHints?.some((hint) => hint.endsWith(".html")),
  );
  if (!wantsHtml || hasHtmlPath) {
    return enrichGeoKeywordAliasSlots(enrichProductResearchHtmlAliases(next), capabilitySlug);
  }

  const mdSlot = next.find((slot) =>
    slot.pathHint === PRODUCT_USER_RESEARCH_MD
    || slot.pathHints?.includes(PRODUCT_USER_RESEARCH_MD)
    || slot.pathHint?.endsWith(".md"),
  );
  const htmlBasename = mdSlot?.pathHint
    ? inferHtmlBasenameFromMd(mdSlot.pathHint)
    : PRODUCT_USER_RESEARCH_HTML;
  next = [
    ...next,
    {
      id: `html_pair_${next.length + 1}`,
      label: "带图表 HTML 报告",
      kind: "html",
      required: true,
      status: "pending",
      stageOrder: next.length + 1,
      stageId: `stage_${next.length + 1}`,
      pathHint: htmlBasename,
      pathHints: [
        htmlBasename,
        "index.html",
        "report.html",
        "landing.html",
        "product user research.html",
      ],
    },
  ];
  return enrichGeoKeywordAliasSlots(enrichProductResearchHtmlAliases(next), capabilitySlug);
}

/**
 * PD-SAAS-FORK 94a83d43: Preflight/Open Design launch-context re-embeds the full brief
 * (including a second「标准成果清单」). Strip before SDM numbered parse.
 */
export function stripLaunchContextAndAttachmentBlocks(userGoal: string): string {
  return String(userGoal ?? "")
    .replace(LAUNCH_CONTEXT_BLOCK, "")
    .replace(ATTACHMENT_XML_BLOCK, "")
    .replace(ATTACHMENT_TAIL_BLOCK, "")
    .trim();
}

/**
 * Extract text after first「标准成果清单」header.
 * Keep only the header + contiguous numbered lines (stop before attachments /
 * launch-context / a second checklist header / free-form prose).
 */
export function extractDeliverableChecklistSection(userGoal: string): string {
  const text = stripLaunchContextAndAttachmentBlocks(String(userGoal ?? ""));
  const idx = text.search(STANDARD_DELIVERABLE_CHECKLIST_HEADER);
  if (idx < 0) return text;
  const lines = text.slice(idx).split(/\r?\n/);
  const kept: string[] = [];
  let seenNumbered = false;
  let blankAfterNumbered = 0;
  for (const line of lines) {
    if (kept.length > 0 && STANDARD_DELIVERABLE_CHECKLIST_HEADER.test(line)) break;
    if (NUMBERED_LINE.test(line)) {
      seenNumbered = true;
      blankAfterNumbered = 0;
      kept.push(line);
      continue;
    }
    if (!seenNumbered) {
      kept.push(line);
      continue;
    }
    if (/^\s*$/.test(line)) {
      blankAfterNumbered += 1;
      if (blankAfterNumbered > 1) break;
      kept.push(line);
      continue;
    }
    break;
  }
  return kept.join("\n").trim();
}

/** True when goal has both workflow numbered steps and a separate checklist section. */
export function hasSeparateWorkflowAndChecklist(userGoal: string): boolean {
  const text = stripLaunchContextAndAttachmentBlocks(String(userGoal ?? ""));
  const headerIdx = text.search(STANDARD_DELIVERABLE_CHECKLIST_HEADER);
  if (headerIdx < 0) return false;
  const before = text.slice(0, headerIdx);
  return before.split(/\r?\n/).some((line) => NUMBERED_LINE.test(line));
}

/** Scope for numbered-list parsing: checklist section only when header exists. */
export function resolveNumberedParseScope(userGoal: string): string {
  const text = stripLaunchContextAndAttachmentBlocks(String(userGoal ?? "")).trim();
  if (!text) return text;
  if (STANDARD_DELIVERABLE_CHECKLIST_HEADER.test(text)) {
    return extractDeliverableChecklistSection(text);
  }
  return text;
}

/** Keep first slot per basename / normalized label (triplicate checklist RCA). */
export function dedupeSlotsByBasename(slots: SessionDeliverableSlot[]): SessionDeliverableSlot[] {
  const seen = new Set<string>();
  const out: SessionDeliverableSlot[] = [];
  for (const slot of slots) {
    const hint = String(slot.pathHint || slot.pathHints?.[0] || "").replace(/\\/g, "/");
    const fromHint = hint.split("/").pop()?.match(PATH_IN_LABEL)?.[1]?.toLowerCase();
    const fromLabel = String(slot.label ?? "").match(PATH_IN_LABEL)?.[1]?.toLowerCase();
    const key = fromHint || fromLabel
      || `label:${String(slot.label ?? "").replace(/[。．.！!？?]+$/g, "").trim().toLowerCase()}`;
    if (!key || key === "label:") continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(slot);
  }
  return out;
}

function isDeliverableBasename(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  return PATH_IN_LABEL.test(stripDeliverableAnnotation(value));
}

/** PD-SAAS-FORK: strip binding blocks before SDM compile (transcript unchanged). */
export function stripBindingConstraintBlockFromGoal(userGoal: string): string {
  const lines = String(userGoal ?? "").split(/\r?\n/);
  const kept: string[] = [];
  let inConstraintBlock = false;
  for (const line of lines) {
    if (/^【硬性约束】/.test(line.trim())) {
      inConstraintBlock = true;
      continue;
    }
    if (inConstraintBlock) {
      if (/^\s*$/.test(line) || STANDARD_DELIVERABLE_CHECKLIST_HEADER.test(line)) {
        inConstraintBlock = false;
        if (STANDARD_DELIVERABLE_CHECKLIST_HEADER.test(line)) kept.push(line);
      }
      continue;
    }
    if (BINDING_CONSTRAINT_LINE.test(line) && !PATH_IN_LABEL.test(line)) continue;
    kept.push(line);
  }
  return kept.join("\n").trim();
}

function inferKindFromLabel(label: string): SessionDeliverableSlot["kind"] {
  const lower = label.toLowerCase();
  if (/图表|mermaid|chart/i.test(label) && /图表|mermaid|chart|表格/i.test(label)) {
    return undefined;
  }
  if (/ppt|幻灯|pptx/.test(lower)) return "pptx";
  if (/word|docx/.test(lower)) return "docx";
  if (/pdf/.test(lower)) return "pdf";
  if (/html|网页|官网|落地页|visibility-report/.test(lower)) return "html";
  if (/jsonld|schema/.test(lower)) return "html";
  if (/markdown|\.md|调研|brief|报告|文案|社媒|多平台|草稿|监测|复盘|成稿|article|长文|支柱|pillar|newsletter/.test(lower)) {
    return "markdown";
  }
  if (/海报|主视觉|配图|png|jpg|生图|封面/.test(lower)) return "image";
  if (/视频|mp4/.test(lower)) return "video";
  if (/mp3|播客|audio/.test(lower)) return "video";
  return undefined;
}

function slugifyId(label: string): string {
  return label
    .replace(/[^\w\u4e00-\u9fff]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32)
    .toLowerCase() || "item";
}

function parseLongformArticleCount(label: string): number | undefined {
  if (!/长文|pillar|支柱|系列长文/i.test(label)) return undefined;
  return parsePlatformDraftCount(label);
}

function longformPathHints(count: number): string[] {
  const letters = ["A", "B", "C", "D", "E"];
  return Array.from({ length: count }, (_, i) => {
    const letter = letters[i] ?? String(i + 1);
    return `02-支柱长文${letter}`;
  });
}

function inferExtraPathHints(label: string, kind?: SessionDeliverableSlot["kind"]): string[] | undefined {
  if (/图表|mermaid|chart|表格/i.test(label)) {
    return ["02-charts-and-data", "02-charts", "charts-and-data"];
  }
  if (/调研/i.test(label) && (/\.md|markdown/i.test(label) || kind === "markdown")) {
    return ["01-sources-and-synthesis", "01-sources", "01-research"];
  }
  if (/export_document|导出.*docx/i.test(label)) {
    return ["04-report.docx", "report.docx"];
  }
  // PD-SAAS-FORK 0731-fail-C: strategy/social aliases include 内容策略.md + copywriting.md (+ English legacy).
  if (/策略|strategy/i.test(label) && (/\.md|markdown/i.test(label) || kind === "markdown")) {
    return [
      "01-strategy.md",
      "content-strategy.md",
      "strategy.md",
      "内容策略.md",
      "01-内容策略.md",
    ];
  }
  if (/newsletter/i.test(label)) {
    return ["04-newsletter.md", "newsletter.md"];
  }
  if (/复盘|retrospective|review/i.test(label)) {
    return ["05-review.md", "retrospective.md"];
  }
  if (/社媒|social|社媒包|copywriting/i.test(label)) {
    return [
      "03-social-slices.md",
      "03-social-matrix.md",
      "社媒包.md",
      "copywriting.md",
      "copy-matrix.md",
    ];
  }
  return undefined;
}

function parsePlatformDraftCount(label: string): number | undefined {
  const match = label.match(/(?:×|x|\*)\s*(\d+)/i);
  if (match?.[1]) return Number.parseInt(match[1], 10);
  if (/至少\s*(\d+)\s*个平台/.test(label)) {
    const m = label.match(/至少\s*(\d+)\s*个平台/);
    if (m?.[1]) return Number.parseInt(m[1], 10);
  }
  if (/平台成稿|多平台成稿|platform.draft/i.test(label)) return 3;
  return undefined;
}

/** Parse numbered lines from arbitrary text into SDM slots. */
export function parseNumberedLinesToSlots(text: string): SessionDeliverableSlot[] {
  const lines = String(text ?? "").split(/\r?\n/);
  const slots: SessionDeliverableSlot[] = [];
  for (const line of lines) {
    const match = line.match(NUMBERED_LINE);
    if (!match?.[1]) continue;
    let label = stripLabelTailNoise(match[1].trim().slice(0, 120));
    if (/^标准成果清单|^standard deliverables/i.test(label)) continue;

    const optional = /^\s*可选[：:]/.test(label);
    if (optional) label = label.replace(/^\s*可选[：:]\s*/, "").trim();

    const pathMatch = label.match(PATH_IN_LABEL);
    const pathHint = extractPathHintFromLabel(label) ?? normalizeAuthorityPathHint(pathMatch?.[1]);

    if (WORKFLOW_STEP_LINE.test(label) && !PATH_IN_LABEL.test(label)) {
      const kindPreview = inferKindFromLabel(label);
      const extraPreview = inferExtraPathHints(label, kindPreview);
      if (!pathHint && !extraPreview?.length) continue;
    }
    if (BINDING_CONSTRAINT_LINE.test(label) && !PATH_IN_LABEL.test(label)) {
      const kindPreview = inferKindFromLabel(label);
      const extraPreview = inferExtraPathHints(label, kindPreview);
      if (!pathHint && !extraPreview?.length) continue;
    }
    if (pathHint && (POLLUTED_PATH_HINT_RE.test(pathHint) || !isDeliverableBasename(pathHint))) continue;

    const kind = inferKindFromLabel(label);
    const platformCount = parsePlatformDraftCount(label);
    const longformCount = parseLongformArticleCount(label);
    const slideCount = parseSlidePageCount(label, text);
    const count = longformCount ?? slideCount ?? platformCount;
    const extraPathHints = longformCount && longformCount > 1
      ? longformPathHints(longformCount)
      : slideCount && slideCount > 1
        ? slidePathHints(slideCount)
        : inferExtraPathHints(label, kind);
    if (label.length < 2) continue;
    if (label.length < 4 && !kind && !pathHint && !extraPathHints?.length) continue;

    const id = `slot_${slots.length + 1}_${slugifyId(label)}`;
    slots.push({
      id,
      label,
      required: !optional && !/可选/.test(label),
      status: slots.length === 0 ? "active" : "pending",
      stageOrder: slots.length + 1,
      kind,
      ...(pathHint ? { pathHint } : {}),
      ...(extraPathHints ? { pathHints: extraPathHints } : {}),
      ...(count && count > 1 ? { count } : {}),
      ...(slideCount && slideCount > 1 ? { kind: "image" as const } : {}),
    });
  }
  if (slots.length >= 3) {
    for (let i = 0; i < slots.length; i += 1) {
      if (!slots[i].stageId) {
        slots[i] = { ...slots[i], stageId: `stage_${i + 1}` };
      }
    }
  }
  return slots;
}

function countBasenameSlots(slots: SessionDeliverableSlot[]): number {
  return slots.filter((slot) => Boolean(slot.pathHint || slot.pathHints?.length)).length;
}

type ChecklistAuthorityConfig = {
  version?: number;
  profiles?: Record<string, { checklistZh?: string[]; checklistEn?: string[] }>;
  templates?: Record<string, {
    profileId?: string;
    checklistZh?: string[];
    checklistEn?: string[];
    syncChecklist?: boolean;
  }>;
};

let cachedChecklistAuthority: ChecklistAuthorityConfig | null = null;

function loadChecklistAuthorityConfig(): ChecklistAuthorityConfig {
  if (cachedChecklistAuthority) return cachedChecklistAuthority;
  cachedChecklistAuthority = checklistAuthorityJson as ChecklistAuthorityConfig;
  return cachedChecklistAuthority;
}

/** Detect process-template id from goal/slug for authority.json checklist lookup. */
export function detectChecklistAuthorityTemplateId(
  userGoal: string,
  capabilitySlug?: string,
): string | undefined {
  if (!isChecklistAuthorityTemplatesEnabled()) {
    const slugOnly = String(capabilitySlug ?? "").trim().toLowerCase();
    if (slugOnly === "saas-growth-full") return "saas-growth-full";
    return undefined;
  }

  const goal = String(userGoal ?? "").trim();
  const slug = String(capabilitySlug ?? "").trim().toLowerCase();

  if (slug === "saas-growth-full") return "saas-growth-full";
  if (isSaasGrowthFullGoal(userGoal, capabilitySlug)) return "saas-growth-full";
  if (/saas-growth-full/i.test(goal)) return "saas-growth-full";

  if (slug === "product-launch-full" || /(?:上市全案|product-launch)/i.test(goal)) {
    return "product-launch-full";
  }

  if (
    slug === "content-ip-launch"
    || /(?:内容\s*IP\s*启动|content-ip-launch|支柱长文×2|支柱长文\s*[×x]\s*2)/i.test(goal)
  ) {
    return "content-ip-launch";
  }

  // PD-SAAS-FORK: viral-article-generator 须早于 matrix/flywheel，避免「长文」误绑七槽。
  if (
    slug === "viral-article-generator"
    || /viral-article-pack/i.test(goal)
    || /(?:爆款长文生成|爆款文章自动撰写|风格路由.*爆款)/i.test(goal)
  ) {
    return "viral-article-pack";
  }

  if (
    /(?:one-article-matrix|一文多发|humanize.*五平台|五平台.*humanize|深度长文.*五平台)/i.test(goal)
  ) {
    return "one-article-matrix";
  }

  if (
    slug === "social-creative-matrix"
    || /(?:社媒矩阵一条龙|social-matrix-pipeline|国内社媒矩阵)/i.test(goal)
    || (/(?:四套比例配图|visual-9x16|copywriting\.md|copy-matrix)/i.test(goal) && /brief\.md/i.test(goal))
  ) {
    return "social-matrix-pipeline";
  }

  if (slug === "geo-keyword-research" || /^geo-keyword/.test(slug)) {
    return undefined;
  }

  const isGeoSlug = slug === "mkt-ai-seo" || /^geo-/.test(slug);
  if (isGeoSlug && /(?:GEO\s*快检|geo-fast-check-hub)/i.test(goal)) {
    return "geo-fast-check-hub";
  }
  if (
    slug === "mkt-ai-seo"
    && /须交付：[\s\S]*audit-checklist\.md[\s\S]*keywords\.md[\s\S]*optimized\.md[\s\S]*report\.html/i.test(goal)
    && !/competitor-visibility|geo-competitor|serp-analysis/i.test(goal)
  ) {
    return "geo-fast-check-hub";
  }

  // PD-SAAS-FORK Razer RCA 案1: natural-language GEO 快检三件套 (no geo slug required)
  if (
    /(?:GEO\s*)?快检/.test(goal)
    && /关键词/.test(goal)
    && /优化/.test(goal)
    && !/competitor-visibility|geo-competitor|serp-analysis/i.test(goal)
  ) {
    return "geo-fast-check-hub";
  }

  if (
    !isProductUserResearchDeliverableGoal(goal, slug)
    && !hasExplicitLiteMustDeliverOverride(goal)
    && !isNovaResearchLiteCapability(goal, slug)
    && (
      detectResearchReportTurn(goal)
      || (
        /(?:三步|3\s*步|一口气)/.test(goal)
        && /(?:调研|检索|综述)/.test(goal)
        && /(?:图表|mermaid|表格)/i.test(goal)
        && /(?:word|docx|Word)/i.test(goal)
      )
    )
  ) {
    return "research-report";
  }

  if (isWritingStyleDistillGoal(goal)) {
    return "writing-style-distill";
  }

  return undefined;
}

/** Narrow distill signal — 主锚「深度蒸馏」；辅：同句「蒸馏」+「危机公关方法论」。 */
export function isWritingStyleDistillGoal(userGoal: string): boolean {
  const goal = String(userGoal ?? "").trim();
  if (!goal) return false;
  if (/深度蒸馏/.test(goal)) return true;
  return /蒸馏/.test(goal) && /危机公关方法论/.test(goal);
}

/** PD-SAAS-FORK 0731-fail-A: open HTML / PWA goals eligible for min-SDM observation (compile unchanged). */
export function isOpenHtmlMinSdmCandidateGoal(userGoal: string): boolean {
  const goal = String(userGoal ?? "").trim();
  if (!goal) return false;
  if (isCampaignFullCaseGoal(goal) || isBrandCampaignFullCaseGoal(goal)) return false;
  if (parseMustDeliverClause(goal).length > 0) return false;
  return /PWA|渐进式\s*Web|电商站|落地页|单页应用|SPA|官网|html\s*站点|做(?:一个|个)?网站|index\.html/i.test(goal);
}

function maybeObserveOpenHtmlMinSdm(userGoal: string): void {
  const mode = openHtmlMinSdmMode();
  if (mode === "off") return;
  if (!isOpenHtmlMinSdmCandidateGoal(userGoal)) return;
  // Shadow/enforce: telemetry only in this batch — do not alter slot compile return.
  recordStabilityEvent({
    event: "open_html_min_sdm_observed",
    reason: mode,
  });
}

/** Single-slot SDM for writing-style distill (main md + optional data-sources later). */
export function buildWritingStyleDistillSlots(userGoal: string): SessionDeliverableSlot[] {
  const goal = String(userGoal ?? "");
  const named = goal.match(
    /([A-Za-z0-9_\u4e00-\u9fff][A-Za-z0-9._\u4e00-\u9fff\-]*蒸馏[A-Za-z0-9._\u4e00-\u9fff\-]*\.md)/i,
  )?.[1];
  const subject = goal.match(/深度蒸馏【?([^】\n]{1,24})】?/)?.[1]?.trim();
  const subjectSlug = subject
    ? subject.replace(/\s+/g, "-").replace(/[^\w\u4e00-\u9fff\-]+/g, "").slice(0, 32)
    : "";
  // PD-SAAS-FORK 0731-fail-B: wuxiaobo legacy pathHint only when subject matches.
  const keepWuxiaoboLegacy = /吴晓波|wuxiaobo/i.test(subject ?? "")
    || /吴晓波|wuxiaobo/i.test(subjectSlug);
  const pathHint = named
    || (subjectSlug ? `${subjectSlug}-writing-os.md` : "writing-style-distill.md");
  return [{
    id: "authority_writing-style-distill_1",
    label: "深度蒸馏成稿",
    required: true,
    status: "active",
    stageOrder: 1,
    stageId: "stage_1",
    kind: "markdown",
    pathHint,
    pathHints: [
      pathHint,
      "writing-style-distill.md",
      "style-distill.md",
      "蒸馏笔记.md",
      "深度蒸馏.md",
      ...(keepWuxiaoboLegacy ? ["wuxiaobo-writing-os.md"] : []),
      ...(subjectSlug
        ? [
          `${subjectSlug}-writing-os.md`,
          `${subjectSlug}-distill.md`,
          `${subjectSlug}-methodology.md`,
        ]
        : []),
    ],
  }];
}

/**
 * PD-SAAS-FORK b665c75c: Hub「须交付：xxx.md」且未要 Word/三件套时，勿绑 research-report 权威包。
 * 用户已点名 basename 时严格按枚举交付（另可附 data-sources.md）。
 * 与 processTemplateExecutionPrompt.isLiteMustDeliverMdOnlyGoal 同构（须交付单 md、无 docx/三件套）。
 */
export function hasExplicitLiteMustDeliverOverride(userGoal: string): boolean {
  const must = parseMustDeliverClause(userGoal);
  if (must.length === 0 || countBasenameSlots(must) === 0) return false;
  const wantsOfficePack = must.some((slot) => /\.docx$/i.test(slot.pathHint ?? ""));
  const wantsResearchPackBasenames = must.some((slot) =>
    /(?:01-sources-and-synthesis|03-report-body)/i.test(slot.pathHint ?? ""),
  );
  const hasMd = must.some((slot) => /\.md$/i.test(slot.pathHint ?? ""));
  return hasMd && !wantsOfficePack && !wantsResearchPackBasenames;
}

/**
 * Hub lite research：须交付单 md +（nova-research-*|df-deep-research slug **或** 空 slug Hub 句式）。
 * 须交付含 .docx / 三件套 basename 时 hasExplicitLiteMustDeliverOverride=false → 仍可绑 research-report。
 */
export function isNovaResearchLiteCapability(
  userGoal: string,
  capabilitySlug?: string,
): boolean {
  if (!hasExplicitLiteMustDeliverOverride(userGoal)) return false;
  const slug = String(capabilitySlug ?? "").trim().toLowerCase();
  if (slug.startsWith("nova-research-") || slug === "df-deep-research") return true;
  if (slug) return false;
  return /用「Nova-(?:行业市场|通用调研|竞品对标|用户研究|产品用研|学术专业)」/i.test(userGoal);
}

/** Toxic research-report authority pack (01/03/docx) that should heal to lite must-deliver. */
export function isToxicResearchReportAuthorityPack(
  slots: Array<{ id?: string; pathHint?: string; status?: string }>,
): boolean {
  const active = slots.filter((s) => s.status !== "removed");
  const auth = active.filter((s) => /^authority_research-report_/i.test(String(s.id ?? "")));
  if (auth.length < 2) return false;
  return auth.some((s) => /01-sources-and-synthesis|03-report-body|\.docx$/i.test(String(s.pathHint ?? "")));
}

/** PD-SAAS-FORK ES9: enrich numbered slot_* rows with authority template pathHints without replacing ids. */
export function enrichNumberedSlotsFromAuthorityTemplate(
  slots: SessionDeliverableSlot[],
  templateId: string,
): SessionDeliverableSlot[] {
  const authoritySlots = resolveChecklistAuthoritySlots(templateId);
  if (authoritySlots.length === 0) return slots;

  return slots.map((slot, index) => {
    const auth = authoritySlots[index];
    if (!auth) return slot;

    const hintSet = new Set<string>();
    for (const raw of [
      ...(slot.pathHints ?? []),
      slot.pathHint,
      ...(auth.pathHints ?? []),
      auth.pathHint,
    ]) {
      const normalized = String(raw ?? "").trim();
      if (normalized) hintSet.add(normalized);
    }

    const pathHint = slot.pathHint ?? auth.pathHint;
    const pathHints = hintSet.size > 0 ? [...hintSet] : undefined;

    return {
      ...slot,
      ...(pathHint ? { pathHint } : {}),
      ...(pathHints ? { pathHints } : {}),
      kind: slot.kind ?? auth.kind,
    };
  });
}

function checklistLinesForTemplate(templateId: string, locale = "zh-CN"): string[] {
  const authority = loadChecklistAuthorityConfig();
  const spec = authority.templates?.[templateId];
  if (!spec) return [];
  if (locale.startsWith("zh") && spec.checklistZh?.length) return spec.checklistZh;
  if (spec.checklistEn?.length) return spec.checklistEn;
  if (spec.profileId) {
    const profile = authority.profiles?.[spec.profileId];
    if (locale.startsWith("zh") && profile?.checklistZh?.length) return profile.checklistZh;
    return profile?.checklistEn ?? profile?.checklistZh ?? [];
  }
  return spec.checklistZh ?? [];
}

function normalizeAuthorityPathHint(pathHint: string | undefined): string | undefined {
  if (!pathHint) return pathHint;
  const stripped = stripDeliverableAnnotation(pathHint);
  const match = stripped.match(PATH_IN_LABEL);
  const normalized = (match?.[1] ?? stripped.split(/[、,，]/)[0] ?? stripped)
    .replace(/\\/g, "/")
    .trim();
  if (/^social-matrix\/?$/i.test(normalized)) return "03-social-slices.md";
  return normalized || undefined;
}

/** PD-SAAS-FORK: geo-keyword-research — canonical English pathHints + Chinese display aliases. */
export function enrichGeoKeywordAliasSlots(
  slots: SessionDeliverableSlot[],
  capabilitySlug?: string,
): SessionDeliverableSlot[] {
  const slug = String(capabilitySlug ?? "").trim().toLowerCase();
  const isGeoKeyword = slug === "geo-keyword-research"
    || slots.some((slot) => /^keywords\.(?:md|html)$/i.test(slot.pathHint ?? ""));
  if (!isGeoKeyword || slots.length === 0) return slots;

  return slots.map((slot) => {
    const hint = (slot.pathHint ?? "").toLowerCase();
    if (hint === "keywords.md") {
      const merged = new Set([
        ...(slot.pathHints ?? []),
        "keywords.md",
        "keywords-research.md",
      ]);
      return { ...slot, pathHints: [...merged] };
    }
    if (/^《.+》geo关键词研究\.md$/i.test(slot.pathHint ?? "")) {
      const merged = new Set([...(slot.pathHints ?? []), "keywords.md", "keywords-research.md"]);
      return { ...slot, pathHints: [...merged] };
    }
    if (hint === "keywords.html") {
      const merged = new Set([
        ...(slot.pathHints ?? []),
        "keywords.html",
        "keywords-research.html",
      ]);
      return { ...slot, pathHints: [...merged].filter((h) => !/\.html\.html$/i.test(h)) };
    }
    return slot;
  });
}

/** PD-SAAS-FORK: geo-fast-check-hub — index.html alias scoped to this template only. */
export function enrichGeoFastCheckAliasSlots(
  slots: SessionDeliverableSlot[],
  authorityTemplateId?: string,
): SessionDeliverableSlot[] {
  const isFastCheck = authorityTemplateId === "geo-fast-check-hub"
    || slots.some((slot) => /audit-checklist\.md|optimized\.md|report\.html/i.test(slot.pathHint ?? ""));
  if (!isFastCheck || slots.length === 0) return slots;

  return slots.map((slot) => {
    const hint = (slot.pathHint ?? "").toLowerCase();
    if (hint === "audit-checklist.md") {
      return { ...slot, pathHints: [...new Set([...(slot.pathHints ?? []), "audit-checklist.md"])] };
    }
    if (hint === "optimized.md") {
      return { ...slot, pathHints: [...new Set([...(slot.pathHints ?? []), "optimized.md"])] };
    }
    if (hint === "report.html") {
      return {
        ...slot,
        pathHints: [...new Set([...(slot.pathHints ?? []), "report.html", "index.html"])],
      };
    }
    return slot;
  });
}

/** Build frozen SDM slots from deliverable-checklist-authority.json template entry. */
export function resolveChecklistAuthoritySlots(
  templateId: string,
  locale = "zh-CN",
): SessionDeliverableSlot[] {
  const lines = checklistLinesForTemplate(templateId, locale);
  if (lines.length === 0) return [];

  const slots: SessionDeliverableSlot[] = [];
  for (const rawLine of lines) {
    const line = String(rawLine ?? "").trim();
    if (!line) continue;
    const pathMatch = line.match(PATH_IN_LABEL);
    const pathHint = normalizeAuthorityPathHint(pathMatch?.[1]);
    const kind = inferKindFromLabel(line);
    const stageOrder = slots.length + 1;
    const stageId = `stage_${stageOrder}`;
    const pathHints = pathHint
      ? (line.includes("report.html")
        ? [pathHint, "index.html"]
        : [pathHint])
      : undefined;
    slots.push({
      id: `authority_${templateId}_${stageOrder}`,
      label: line.slice(0, 120),
      required: true,
      status: stageOrder === 1 ? "active" : "pending",
      stageOrder,
      stageId,
      kind,
      ...(pathHint
        ? { pathHint, pathHints }
        : {}),
    });
  }
  return enrichViralArticlePackAliasSlots(
    enrichResearchReportAuthoritySlots(
      enrichGeoFastCheckAliasSlots(slots, templateId),
      templateId,
    ),
    templateId,
  );
}

/** PD-SAAS-FORK: viral-article-pack 中文 basename 别名（与 deliverableFilenamePolicy 对齐）。 */
export function enrichViralArticlePackAliasSlots(
  slots: SessionDeliverableSlot[],
  templateId?: string,
): SessionDeliverableSlot[] {
  if (templateId !== "viral-article-pack") return slots;
  const aliasByPrimary: Record<string, string[]> = {
    "article-brief.md": ["article-brief.md", "选题简报.md"],
    "article.md": ["article.md", "爆款母稿.md"],
    "quotes.md": ["quotes.md", "金句.md"],
    "channel-plan.md": ["channel-plan.md", "渠道计划.md"],
  };
  return slots.map((slot) => {
    const primary = String(slot.pathHint ?? "").replace(/\\/g, "/").split("/").pop() ?? "";
    const aliases = aliasByPrimary[primary.toLowerCase()];
    if (!aliases) return slot;
    const pathHints = [...new Set([...(slot.pathHints ?? []), ...aliases])];
    return { ...slot, pathHints };
  });
}

const RESEARCH_SOURCES_HINTS = [
  "01-sources-and-synthesis.md",
  "01-sources-and-synthesis",
  "01-调研综述.md",
  "调研综述.md",
] as const;

const RESEARCH_BODY_HINTS = [
  "03-report-body.md",
  "03-report-body",
  "02-charts-and-data.md",
  "02-charts-and-data",
  "报告正文.md",
] as const;

const RESEARCH_DOCX_HINTS = [
  "report.docx",
  "document.docx",
  "04-report.docx",
] as const;

function researchReportSlotRole(
  slot: SessionDeliverableSlot,
): "sources" | "body" | "docx" | "other" {
  const hint = String(slot.pathHint ?? "").replace(/\\/g, "/");
  const id = String(slot.id ?? "");
  if (slot.kind === "docx" || /\.docx$/i.test(hint) || /_3$/i.test(id)) return "docx";
  if (/01-sources-and-synthesis/i.test(hint) || /_1$/i.test(id)) return "sources";
  if (/03-report-body|02-charts-and-data/i.test(hint) || /_2$/i.test(id)) return "body";
  if (slot.kind === "markdown") {
    // Prefer primary pathHint when kind is markdown but id/hint ambiguous.
    if (/sources|综述|synthesis/i.test(`${hint} ${slot.label ?? ""}`)) return "sources";
    return "body";
  }
  if (!slot.kind && /\.md$/i.test(hint)) {
    if (/01-sources|综述|synthesis/i.test(hint)) return "sources";
    return "body";
  }
  return "other";
}

/**
 * PD-SAAS-FORK a0676b9c: research-report pathHints must be mutually exclusive per slot.
 * Previously every markdown slot received 01+02+03 → dual-slot same path / false incomplete.
 */
export function enrichResearchReportAuthoritySlots(
  slots: SessionDeliverableSlot[],
  templateId?: string,
): SessionDeliverableSlot[] {
  if (templateId !== "research-report") return slots;
  return slots.map((slot) => {
    const role = researchReportSlotRole(slot);
    if (role === "docx") {
      const pathHints = [...new Set([
        ...RESEARCH_DOCX_HINTS,
        slot.pathHint,
        ...(slot.pathHints ?? []).filter((h) => /\.docx$/i.test(String(h))),
      ].filter(Boolean).map((h) => String(h)))];
      return { ...slot, kind: slot.kind ?? "docx", pathHints };
    }
    if (role === "sources") {
      return {
        ...slot,
        kind: slot.kind ?? "markdown",
        pathHint: slot.pathHint || "01-sources-and-synthesis.md",
        pathHints: [...RESEARCH_SOURCES_HINTS],
      };
    }
    if (role === "body") {
      return {
        ...slot,
        pathHint: slot.pathHint || "03-report-body.md",
        pathHints: [...RESEARCH_BODY_HINTS],
      };
    }
    return slot;
  });
}

export function isBrandGeoFullCaseGoal(
  userGoal: string,
  capabilitySlug?: string,
): boolean {
  const goal = String(userGoal ?? "").trim();
  if (!goal) return false;
  if (shouldBindGeoProfileForGoal(goal, capabilitySlug)) {
    if (BRAND_GEO_FULL_CASE_GOAL.test(goal)) return true;
    if (/(?:七|7)\s*步|全案|一次执行|一次规划|标准包/.test(goal)) return true;
    if (hasSeparateWorkflowAndChecklist(goal)) return true;
  }
  return BRAND_GEO_FULL_CASE_GOAL.test(goal);
}

export function shouldPreferProfileSdmSlots(input: {
  profileId?: string;
  capabilitySlug?: string;
  userGoal: string;
}): boolean {
  const { profileId, capabilitySlug, userGoal } = input;
  if (!profileId) return false;

  const compileGoal = stripBindingConstraintBlockFromGoal(userGoal);
  const scope = resolveNumberedParseScope(compileGoal);
  const numberedPreview = parseNumberedLinesToSlots(scope);
  const mustDeliver = parseMustDeliverClause(compileGoal);

  if (
    profileId === "hyperframes"
    || isHyperframesVideoSlug(capabilitySlug)
  ) {
    const rawScope = resolveNumberedParseScope(userGoal);
    const hasConstraintNoise = /【硬性约束】/.test(userGoal)
      || numberedPreview.some((slot) =>
        WORKFLOW_STEP_LINE.test(slot.label ?? "")
        || BINDING_CONSTRAINT_LINE.test(slot.label ?? ""),
      );
    if (hasConstraintNoise) return true;
    if (
      mustDeliver.length === 1
      && /\.mp4$/i.test(mustDeliver[0]?.pathHint ?? "")
    ) {
      return true;
    }
    if (countBasenameSlots(numberedPreview) === 0 && mustDeliver.length <= 1) return true;
  }

  if (countBasenameSlots(numberedPreview) >= 2) return false;

  const templateId = detectChecklistAuthorityTemplateId(userGoal, capabilitySlug);
  if (templateId && resolveChecklistAuthoritySlots(templateId).length >= 2) return false;

  if (profileId === "geo") {
    return shouldBindGeoProfileForGoal(userGoal, capabilitySlug)
      || isBrandGeoFullCaseGoal(userGoal, capabilitySlug);
  }
  if (profileId === "campaign" && isBrandCampaignFullCaseGoal(userGoal)) {
    return true;
  }
  if (!isTier0LockedProfileId(profileId)) return false;
  const profile = listDeliverableProfiles().find((entry) => entry.id === profileId);
  if (!profile?.requiredBasenameGroups?.length) return false;
  if (hasSeparateWorkflowAndChecklist(userGoal) && countBasenameSlots(numberedPreview) >= 2) {
    return false;
  }
  if (hasSeparateWorkflowAndChecklist(userGoal)) return true;
  const numbered = numberedPreview;
  const workflowLike = numbered.filter((slot) => WORKFLOW_STEP_LINE.test(slot.label));
  return workflowLike.length >= 2 && numbered.length > (profile.requiredBasenameGroups.length + 2);
}

function groupsForProfile(profile: DeliverableProfile): string[][] {
  if (profile.requiredBasenameGroups?.length) return profile.requiredBasenameGroups;
  return (profile.requiredBasenames ?? profile.requiredArtifacts ?? []).map((b) => [b]);
}

/** Build SDM slots from deliverable profile registry (authoritative for Tier-0). */
export function buildProfileAuthoritySdmSlots(profileId: string): SessionDeliverableSlot[] {
  const profile = listDeliverableProfiles().find((entry) => entry.id === profileId);
  if (!profile) return [];

  const groups = groupsForProfile(profile);
  const slots: SessionDeliverableSlot[] = [];

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index] ?? [];
    const hint = group[0] ?? `deliverable-${index + 1}`;
    const kind = inferKindFromLabel(hint);
    slots.push({
      id: `profile_${profileId}_${index + 1}`,
      label: hint,
      pathHint: hint,
      pathHints: group,
      required: true,
      status: index === 0 ? "active" : "pending",
      kind,
      stageOrder: index + 1,
    });
  }

  if (profileId === "geo" && profile.requiredPlatformDrafts) {
    const { count, basenames } = profile.requiredPlatformDrafts;
    const insertAt = slots.findIndex((slot) => /optimized/i.test(slot.pathHint ?? ""));
    const platformSlot: SessionDeliverableSlot = {
      id: "profile_geo_platform",
      label: "平台成稿",
      kind: "markdown",
      required: true,
      count,
      pathHints: basenames,
      pathHint: basenames[0],
      status: "pending",
      stageOrder: insertAt >= 0 ? insertAt : slots.length + 1,
    };
    if (insertAt >= 0) {
      slots.splice(insertAt, 0, platformSlot);
    } else {
      slots.push(platformSlot);
    }
    slots.forEach((slot, idx) => {
      slot.stageOrder = idx + 1;
    });
  }

  return slots;
}

export type ResolveAuthoritativeSdmInput = {
  userGoal: string;
  capabilitySlug?: string;
  profileId?: string;
  parseNumberedList: (goal: string) => SessionDeliverableSlot[];
  mergeWithProfile?: (
    slots: SessionDeliverableSlot[],
    profileId: string,
    userGoal: string,
  ) => SessionDeliverableSlot[];
};

/** Single resolver: workflow steps in prompt ≠ SDM; checklist section or profile wins. */
export function resolveAuthoritativeSdmSlots(input: ResolveAuthoritativeSdmInput): SessionDeliverableSlot[] {
  const userGoal = stripLaunchContextAndAttachmentBlocks(String(input.userGoal ?? "")).trim();
  if (!userGoal) return [];

  const compileGoal = stripBindingConstraintBlockFromGoal(userGoal);
  maybeObserveOpenHtmlMinSdm(compileGoal);
  const authorityTemplateId = detectChecklistAuthorityTemplateId(compileGoal, input.capabilitySlug);

  if (isCampaignFullCaseGoal(compileGoal)) {
    return sanitizePollutedPathHints(resolveCampaignSdmSlots({
      userGoal: compileGoal,
      parseNumberedList: input.parseNumberedList,
    }));
  }

  const mustDeliverEarly = parseMustDeliverClause(compileGoal);
  const explicitDual = parseExplicitHtmlVideoDeliverableSlots(compileGoal);
  if (
    explicitDual.length >= 2
    && !mustDeliverEarly.some((slot) => /\.mp4$/i.test(slot.pathHint ?? ""))
    && countBasenameSlots(mustDeliverEarly) === 0
  ) {
    return sanitizePollutedPathHints(explicitDual);
  }

  if (
    isProductUserResearchDeliverableGoal(compileGoal, input.capabilitySlug)
    && mustDeliverEarly.length >= 1
  ) {
    return sanitizePollutedPathHints(
      enrichHtmlPairDeliverableSlots(mustDeliverEarly, compileGoal, input.capabilitySlug),
    );
  }

  // PD-SAAS-FORK b665c75c/cba2558f: 「须交付：industry-market-report.md」等显式 basename
  // 优先于 research-report 权威三件套（01/03/docx），禁止擅自加 Word/拆分 md。
  if (mustDeliverEarly.length >= 1 && countBasenameSlots(mustDeliverEarly) >= 1) {
    return sanitizePollutedPathHints(
      enrichHtmlPairDeliverableSlots(mustDeliverEarly, compileGoal, input.capabilitySlug),
    );
  }

  // PD-SAAS-FORK 0731: 深度蒸馏单槽（PILOTDECK_DISTILL_SDM）；shadow/enforce 均 compile
  if (
    distillSdmMode() !== "off"
    && isWritingStyleDistillGoal(compileGoal)
    && !isNovaResearchLiteCapability(compileGoal, input.capabilitySlug)
  ) {
    recordStabilityEvent({
      event: "distill_sdm_compiled",
      reason: distillSdmMode(),
      detail: { slug: String(input.capabilitySlug ?? "") },
    });
    return sanitizePollutedPathHints(buildWritingStyleDistillSlots(compileGoal));
  }

  const scope = resolveNumberedParseScope(compileGoal);
  let numberedSlots = dedupeSlotsByBasename(parseNumberedLinesToSlots(scope));
  if (numberedSlots.length === 0) {
    numberedSlots = dedupeSlotsByBasename(input.parseNumberedList(compileGoal));
  }

  if (authorityTemplateId && isChecklistAuthorityTemplatesEnabled()) {
    const authoritySlots = resolveChecklistAuthoritySlots(authorityTemplateId);
    // PD-SAAS-FORK 94a83d43: polluted Open Design append / triplicate lists → prefer authority.
    const basenameCount = countBasenameSlots(numberedSlots);
    const pollutedGrowth =
      isSaasGrowthFullGoal(compileGoal, input.capabilitySlug)
      && authoritySlots.length >= 2
      && (basenameCount === 0 || basenameCount > authoritySlots.length);
    if (pollutedGrowth) {
      return sanitizePollutedPathHints(
        enrichResearchReportAuthoritySlots(authoritySlots, authorityTemplateId),
      );
    }
    if (numberedSlots.length >= 2 || basenameCount >= 2) {
      const enriched = enrichNumberedSlotsFromAuthorityTemplate(numberedSlots, authorityTemplateId);
      return sanitizePollutedPathHints(
        enrichResearchReportAuthoritySlots(
          enrichGeoFastCheckAliasSlots(
            enrichHtmlPairDeliverableSlots(
              dedupeSlotsByBasename(enriched),
              compileGoal,
              input.capabilitySlug,
            ),
            authorityTemplateId,
          ),
          authorityTemplateId,
        ),
      );
    }
    if (authoritySlots.length >= 2) {
      return sanitizePollutedPathHints(
        enrichResearchReportAuthoritySlots(authoritySlots, authorityTemplateId),
      );
    }
  }

  const profileId = input.profileId;
  if (profileId && shouldPreferProfileSdmSlots({
    profileId,
    capabilitySlug: input.capabilitySlug,
    userGoal: compileGoal,
  })) {
    return sanitizePollutedPathHints(buildProfileAuthoritySdmSlots(profileId));
  }

  let slots = numberedSlots;

  if (slots.length === 0) {
    slots = parseMustDeliverClause(compileGoal);
  }

  if (slots.length > 0 && profileId && input.mergeWithProfile) {
    slots = input.mergeWithProfile(slots, profileId, compileGoal);
  }

  if (slots.length === 0 && profileId) {
    const mayUseGeoProfile = profileId !== "geo"
      || shouldBindGeoProfileForGoal(compileGoal, input.capabilitySlug)
      || isBrandGeoFullCaseGoal(compileGoal, input.capabilitySlug);
    if (mayUseGeoProfile) {
      return sanitizePollutedPathHints(buildProfileAuthoritySdmSlots(profileId));
    }
  }

  return sanitizePollutedPathHints(
    enrichGeoFastCheckAliasSlots(
      enrichHtmlPairDeliverableSlots(slots, compileGoal, input.capabilitySlug),
      authorityTemplateId,
    ),
  );
}

/** @deprecated use extractDeliverableChecklistSection — campaign re-export */
export function extractStandardDeliverableChecklistSection(userGoal: string): string {
  return extractDeliverableChecklistSection(userGoal);
}
