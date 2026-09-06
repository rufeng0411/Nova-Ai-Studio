// PD-SAAS-FORK: shared SDM slot ↔ verified path matching (engine + UI single source)

import { deliverableBasenamesMatch } from "./normalizeDeliverableBasename.js";
import {
  isSdmHtmlReportAliasEnabled,
  isSdmHtmlSlotFuzzyEnabled,
  isSdmGeoKeywordAliasEnabled,
  isSdmGeoFastCheckAliasEnabled,
  researchDocxBasenameFuzzyMode,
} from "../resilience/stabilityFlags.js";
import { recordStabilityEvent } from "../../telemetry/stabilityEvents.js";
import { officeExtensionPathSatisfiesSlot } from "./officeExtensionStrictCore.js";

export type SdmSlotValidationOptions = {
  /** Active html slot count — enables index.html ↔ report-*.html fuzzy match. */
  htmlSlotCount?: number;
  taskArtifactDir?: string;
};

function legacyLandingHtmlSlotFuzzySatisfied(
  slot: SdmSlotLike,
  verifiedPaths: string[],
  options?: SdmSlotValidationOptions,
): boolean {
  if (!isSdmHtmlReportAliasEnabled() || slot.kind !== "html") return false;
  const hint = slotPathHint(slot).toLowerCase();
  if (!hint.endsWith("landing.html")) return false;
  const htmlSlotCount = options?.htmlSlotCount ?? 1;
  if (htmlSlotCount !== 1) return false;
  const taskPrefix = options?.taskArtifactDir
    ? normalizeSdmPath(options.taskArtifactDir).replace(/\/+$/, "").toLowerCase()
    : undefined;
  for (const raw of verifiedPaths) {
    const p = normalizeSdmPath(raw);
    const base = sdmBasename(p).toLowerCase();
    if (base !== "index.html") continue;
    if (taskPrefix && !p.toLowerCase().startsWith(`${taskPrefix}/`) && !p.toLowerCase().startsWith(taskPrefix)) {
      continue;
    }
    return true;
  }
  return false;
}

function legacyIndexHtmlSlotFuzzySatisfied(
  slot: SdmSlotLike,
  verifiedPaths: string[],
  options?: SdmSlotValidationOptions,
): boolean {
  if (!isSdmHtmlSlotFuzzyEnabled() && !isSdmHtmlReportAliasEnabled()) return false;
  if (slot.kind !== "html") return false;
  const hint = slotPathHint(slot).toLowerCase();
  if (!hint.endsWith("index.html") && !hint.endsWith("landing.html")) return false;
  if (hint.endsWith("landing.html")) {
    return legacyLandingHtmlSlotFuzzySatisfied(slot, verifiedPaths, options);
  }
  const expected = options?.htmlSlotCount ?? 1;
  return countReportHtmlFiles(verifiedPaths, options?.taskArtifactDir) >= expected;
}

export type SdmSlotLike = {
  id: string;
  label?: string;
  kind?: string;
  pathHint?: string;
  path?: string;
  /** Profile basename aliases — any match satisfies the slot (e.g. audit-checklist.md). */
  pathHints?: string[];
  status?: "pending" | "active" | "done" | "removed";
  count?: number;
};

export const CAMPAIGN_SLOT_PATTERNS: Record<string, RegExp> = {
  stage_research: /(?:research|market|调研|competitive|01-research).*\.(?:md|markdown|html?)$/i,
  stage_plan_html: /(?:strategy-deck|campaign-plan|02-plan|策划).*\.html?$/i,
  stage_brief: /(?:brief|传播).*\.(?:md|docx|markdown)$/i,
  stage_main_visual: /(?:visual|kv|main-visual|poster|hero|主视觉).*\.(?:png|jpe?g|webp|svg|html?)$/i,
  stage_website: /(?:index|website|landing|home|官网).*\.html?$/i,
  stage_platform: /(?:platform|content|wechat|xiaohongshu|zhihu|多平台).*\.(?:html?|md|markdown)$/i,
  stage_draft: /(?:draft|platform-draft|manifest).*\.(?:json|md|yaml|yml)$/i,
  stage_monitoring: /(?:monitor|monitoring|retrospective|复盘|监测).*\.(?:md|markdown|csv|xlsx|html?)$/i,
  brand_brief: /(?:brief|传播).*\.docx$/i,
  brand_research: /(?:research|调研|01-research).*\.(?:md|markdown)$/i,
  brand_visual: /(?:visual|kv|poster|key-visual|主视觉).*\.(?:png|jpe?g|webp|svg|html?)$/i,
  brand_platform: /(?:platform|social|copy-matrix|社媒|多平台).*\.(?:md|markdown)$/i,
  brand_draft: /(?:draft|草稿).*\.(?:json|md|yaml|yml)$/i,
  brand_monitoring: /(?:monitor|monitoring|监测|复盘).*\.(?:md|markdown)$/i,
};

/** PD-SAAS-FORK ES9: nova product user research basenames. */
export const PRODUCT_USER_RESEARCH_MD = "product-user-research.md";
export const PRODUCT_USER_RESEARCH_HTML = "product-user-research.html";

/** Known basename aliases for SDM slot matching (ES9 product research HTML). */
export const SDM_BASENAME_ALIASES: Record<string, string[]> = {
  [PRODUCT_USER_RESEARCH_HTML.toLowerCase()]: [
    "product user research.html",
    "product_user_research.html",
    "report.html",
  ],
  "index.html": ["report.html", "product-user-research.html", "Index.html"],
  "landing.html": ["index.html"],
  "report.html": ["index.html"],
  "article.md": ["deep_article.md"],
  "01-topics.md": ["01-选题规划.md", "01选题规划.md"],
  "02-longform.md": ["02-长文成稿.md", "02长文成稿.md"],
  "03-social-slices.md": ["03-社媒切片.md", "03社媒切片.md"],
  "keywords.md": ["keywords-research.md"],
  "keywords.html": ["keywords-research.html"],
  "user-research-report.md": ["用户研究.md", "user-research.md"],
  "用户研究.md": ["user-research-report.md", "user-research.md"],
  "product-user-research.md": ["用户研究.md", "product-user-research.md"],
};

export const LONGFORM_ARTICLE_PATH_PATTERN =
  /(?:支柱长文|pillar|长文|02-.*长文)/i;

/** Chart / Mermaid deliverables (e.g. 02-charts-and-data.md, chart-*.png). */
export const CHART_MERMAID_PATH_PATTERN =
  /(?:charts?[-_]|chart[-_]?(?:sales|revenue|data|competitor|industry|milestone)|charts-and-data|数据图表)/i;

/** Research synthesis markdown (e.g. 01-sources-and-synthesis.md). */
export const RESEARCH_SYNTHESIS_PATH_PATTERN =
  /(?:sources[-_]and[-_]synthesis|01[-_]sources|01[-_]research|信息源|调研综述)/i;

/** Universal machine trace markdown (data-sources.md). */
export const UNIVERSAL_DATA_SOURCES_PATH_PATTERN = /^data-sources\.md$/i;

export function isLongformArticlePath(filePath: string): boolean {
  const base = sdmBasename(filePath);
  return /\.(?:md|markdown)$/i.test(base) && LONGFORM_ARTICLE_PATH_PATTERN.test(base);
}

export function isChartMermaidSlot(slot: SdmSlotLike): boolean {
  const label = String(slot.label ?? "");
  const id = String(slot.id ?? "");
  return /图表|mermaid|chart|表格/i.test(label) || /图表|mermaid|chart/i.test(id);
}

export function isChartMermaidPath(filePath: string): boolean {
  const base = sdmBasename(filePath);
  if (/\.(?:png|jpe?g|webp|svg)$/i.test(base) && /chart/i.test(base)) return true;
  return /\.(?:md|markdown)$/i.test(base)
    && (CHART_MERMAID_PATH_PATTERN.test(base) || /charts-and-data/i.test(base));
}

export function isResearchSynthesisSlot(slot: SdmSlotLike): boolean {
  const label = String(slot.label ?? "").trim();
  if (/^调研\s*\.md|调研\s*\.md|信息源|sources/i.test(label)) return true;
  if (slot.kind === "markdown" && /^调研/.test(label) && !/图表|chart|mermaid/i.test(label)) return true;
  return /调研_md|slot_1_调研/i.test(String(slot.id ?? ""));
}

export function isResearchSynthesisPath(filePath: string): boolean {
  const base = sdmBasename(filePath);
  if (!/\.(?:md|markdown)$/i.test(base)) return false;
  if (UNIVERSAL_DATA_SOURCES_PATH_PATTERN.test(base)) return false;
  if (isChartMermaidPath(filePath) || isLongformArticlePath(filePath)) return false;
  return RESEARCH_SYNTHESIS_PATH_PATTERN.test(base)
    || /^01[-_]/.test(base)
    || /sources-and-synthesis/i.test(base);
}

export function isUniversalDataSourcesSlot(slot: SdmSlotLike): boolean {
  if (slot.id === "universal_data_sources") return true;
  return slotPathHints(slot).some(
    (hint) => UNIVERSAL_DATA_SOURCES_PATH_PATTERN.test(sdmBasename(hint)),
  );
}

export function isUniversalDataSourcesPath(filePath: string): boolean {
  return UNIVERSAL_DATA_SOURCES_PATH_PATTERN.test(sdmBasename(filePath));
}

export function isLongformCountSlot(slot: SdmSlotLike): boolean {
  const label = String(slot.label ?? "");
  const needed = typeof slot.count === "number" && slot.count > 1 ? slot.count : 0;
  if (needed < 2) return false;
  return /长文|pillar|支柱|系列长文/i.test(label) || /长文|pillar/i.test(slot.id);
}

function countMatchingVerifiedPaths(slot: SdmSlotLike, verifiedPaths: string[]): number {
  const used = new Set<string>();
  let matched = 0;
  for (const raw of verifiedPaths) {
    const p = normalizeSdmPath(raw);
    if (!p || used.has(p.toLowerCase())) continue;
    if (pathSatisfiesSdmSlot(p, slot)) {
      used.add(p.toLowerCase());
      matched += 1;
    }
  }
  return matched;
}

const DEFAULT_PATH_HINT_BY_KIND: Record<string, string> = {
  bento: "deck.bento.html",
  html: "index.html",
  markdown: "brief.md",
  md: "brief.md",
  pdf: "report.pdf",
  docx: "document.docx",
  pptx: "presentation.pptx",
  png: "output.png",
  image: "output.png",
};

export function defaultPathHintForKind(kind: string): string | undefined {
  return DEFAULT_PATH_HINT_BY_KIND[kind.toLowerCase()];
}

export function normalizeSdmPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\/+/, "");
}

export function sdmBasename(p: string): string {
  const n = normalizeSdmPath(p);
  const idx = n.lastIndexOf("/");
  return idx >= 0 ? n.slice(idx + 1) : n;
}

const CLASH_PRONE_DELIVERABLE_BASENAMES = new Set([
  "deck.bento.html",
  "index.html",
  "landing.html",
  "slides.html",
  "slide-manifest.json",
  "outline.json",
  "report.md",
  "report.html",
  "report.pdf",
  "report.docx",
  "report.pptx",
]);

/** Basenames that must not map globally when multiple task dirs exist in verified set. */
export function isClashProneDeliverableBasename(basename: string): boolean {
  const base = basename.toLowerCase();
  if (CLASH_PRONE_DELIVERABLE_BASENAMES.has(base)) return true;
  if (/^slide-\d+\.(png|jpe?g|webp|gif)$/i.test(base)) return true;
  return false;
}

export function artifactKindFromPath(filePath: string): string {
  const file = sdmBasename(filePath).toLowerCase();
  const ext = file.split(".").pop() ?? "";
  if (["md", "markdown"].includes(ext)) return "markdown";
  if (file.endsWith('.bento.html')) return 'bento';
  if (["html", "htm"].includes(ext)) return "html";
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) return "image";
  if (["mp4", "webm", "mov"].includes(ext)) return "video";
  if (ext === "pdf") return "pdf";
  if (["docx", "doc"].includes(ext)) return "docx";
  if (["pptx", "ppt"].includes(ext)) return "pptx";
  return ext || "file";
}

export function pathMatchesKind(filePath: string, kind: string): boolean {
  const k = kind.toLowerCase();
  return artifactKindFromPath(filePath) === k
    || (k === "bento" && /\.bento\.html$/i.test(filePath))
    || (k === "html" && /\.html?$/i.test(filePath))
    || (k === "markdown" && /\.(?:md|markdown)$/i.test(filePath))
    || (k === "docx" && /\.docx$/i.test(filePath));
}

function pathExtensionMatchesSlotKind(filePath: string, kind: string): boolean {
  const k = kind.toLowerCase();
  if (!k) return true;
  if (k === 'bento') return /\.bento\.html$/i.test(filePath);
  if (k === "html") return /\.html?$/i.test(filePath);
  if (k === "docx") return /\.docx$/i.test(filePath);
  if (k === "markdown" || k === "md") return /\.(?:md|markdown)$/i.test(filePath);
  if (k === "image" || k === "png") return /\.(?:png|jpe?g|webp|svg|gif)$/i.test(filePath);
  if (k === "pdf") return /\.pdf$/i.test(filePath);
  return true;
}

function slotPathHint(slot: SdmSlotLike): string {
  return normalizeSdmPath(slot.pathHint ?? slot.path ?? "");
}

function slotPathHints(slot: SdmSlotLike): string[] {
  const hints: string[] = [];
  if (Array.isArray(slot.pathHints)) {
    for (const raw of slot.pathHints) {
      const normalized = normalizeSdmPath(String(raw ?? ""));
      if (normalized && !hints.some((h) => pathsEqual(h, normalized))) {
        hints.push(normalized);
      }
    }
  }
  const primary = slotPathHint(slot);
  if (primary && !hints.some((h) => pathsEqual(h, primary))) {
    hints.unshift(primary);
  }
  const primaryBase = sdmBasename(primary).toLowerCase();
  const aliases = SDM_BASENAME_ALIASES[primaryBase];
  // PD-SAAS-FORK: allowlisted basename aliases always apply (zh↔en legacy).
  if (aliases?.length) {
    for (const alias of aliases) {
      const normalized = normalizeSdmPath(alias);
      if (normalized && !hints.some((h) => pathsEqual(h, normalized))) {
        hints.push(normalized);
      }
    }
  }
  return hints;
}

function countReportHtmlFiles(
  verifiedPaths: string[],
  taskArtifactDir?: string,
): number {
  const taskPrefix = taskArtifactDir
    ? normalizeSdmPath(taskArtifactDir).replace(/\/+$/, "").toLowerCase()
    : undefined;
  let count = 0;
  for (const raw of verifiedPaths) {
    const p = normalizeSdmPath(raw);
    const base = sdmBasename(p).toLowerCase();
    const isReportHtml = /^report-\d+.+\.html$/i.test(base)
      || (isSdmHtmlReportAliasEnabled() && base === "report.html");
    if (!p || !isReportHtml) continue;
    if (taskPrefix && !p.toLowerCase().startsWith(`${taskPrefix}/`) && !p.toLowerCase().startsWith(taskPrefix)) {
      continue;
    }
    count += 1;
  }
  return count;
}

function countScopedHtmlFiles(
  verifiedPaths: string[],
  taskArtifactDir?: string,
): string[] {
  const taskPrefix = taskArtifactDir
    ? normalizeSdmPath(taskArtifactDir).replace(/\/+$/, "").toLowerCase()
    : undefined;
  const htmlPaths: string[] = [];
  for (const raw of verifiedPaths) {
    const p = normalizeSdmPath(raw);
    if (!p || !/\.html?$/i.test(p)) continue;
    if (taskPrefix) {
      const dir = p.replace(/\/[^/]+$/, "").toLowerCase();
      if (dir !== taskPrefix && !dir.startsWith(`${taskPrefix}/`)) continue;
    }
    htmlPaths.push(p);
  }
  return htmlPaths;
}

function isSemanticHtmlDeliverableSlot(slot: SdmSlotLike): boolean {
  if (slot.kind !== "html") return false;
  const slotId = String(slot.id ?? "");
  if (slotId.startsWith("html_pair_")) return true;
  if (slotId.startsWith("must_deliver_") && /\.html?$/i.test(slotPathHint(slot))) return true;
  const label = String(slot.label ?? "");
  return /HTML|html|报告|网页|图表|网页版/i.test(label);
}

/** Single scoped HTML (index/report/md-paired) satisfies semantic html_pair slots. */
function semanticHtmlDeliverableAliasSatisfied(
  slot: SdmSlotLike,
  verifiedPaths: string[],
  options?: SdmSlotValidationOptions,
): boolean {
  if (!isSdmHtmlSlotFuzzyEnabled() && !isSdmHtmlReportAliasEnabled()) return false;
  if (!isSemanticHtmlDeliverableSlot(slot)) return false;

  const scopedHtml = countScopedHtmlFiles(verifiedPaths, options?.taskArtifactDir);
  if (scopedHtml.length === 0) return false;

  const expectedHtmlSlots = options?.htmlSlotCount ?? 1;
  // ≥2 html slots: hint/basename only — never claim an arbitrary sibling html.
  if (expectedHtmlSlots > 1) {
    for (const path of scopedHtml) {
      const base = sdmBasename(path).toLowerCase();
      for (const hint of slotPathHints(slot)) {
        const hintBase = sdmBasename(hint).toLowerCase();
        if (hintBase.endsWith(".html") && base === hintBase) return true;
        if (hintBase.endsWith(".md")) {
          const paired = hintBase.replace(/\.md$/i, ".html");
          if (base === paired) return true;
        }
      }
    }
    return false;
  }

  const canonical = new Set(["index.html", "report.html", "landing.html"]);
  for (const path of scopedHtml) {
    const base = sdmBasename(path).toLowerCase();
    if (canonical.has(base)) return true;
    for (const hint of slotPathHints(slot)) {
      const hintBase = sdmBasename(hint).toLowerCase();
      if (hintBase.endsWith(".html") && base === hintBase) return true;
      if (hintBase.endsWith(".md")) {
        const paired = hintBase.replace(/\.md$/i, ".html");
        if (base === paired) return true;
      }
    }
  }

  if (scopedHtml.length === 1 && expectedHtmlSlots <= 1) {
    return true;
  }
  return false;
}

/** I2: kind-only matching is allowed only when the slot has no pathHint and no campaign pattern. */
export function kindMatchAllowed(slot: SdmSlotLike): boolean {
  const hint = slotPathHint(slot);
  if (hint) return false;
  if (slotPathHints(slot).length > 0) return false;
  if (/^slot_\d+_/i.test(String(slot.id ?? ""))) return false;
  if (CAMPAIGN_SLOT_PATTERNS[slot.id]) return false;
  if (isChartMermaidSlot(slot)) return false;
  if (isResearchSynthesisSlot(slot)) return false;
  if (isLongformCountSlot(slot)) return false;
  return true;
}

export function slotMatchPatterns(slot: SdmSlotLike): RegExp[] {
  const patterns: RegExp[] = [];
  for (const hint of slotPathHints(slot)) {
    const base = sdmBasename(hint);
    if (base && !base.includes("*")) {
      const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!patterns.some((pattern) => pattern.source === escaped)) {
        patterns.push(new RegExp(escaped, "i"));
      }
    }
  }
  const campaign = CAMPAIGN_SLOT_PATTERNS[slot.id];
  if (campaign) patterns.push(campaign);
  return patterns;
}

function pathsEqual(a: string, b: string): boolean {
  return normalizeSdmPath(a).toLowerCase() === normalizeSdmPath(b).toLowerCase();
}

function geoKeywordAliasSatisfied(verifiedPath: string, slot: SdmSlotLike): boolean {
  if (!isSdmGeoKeywordAliasEnabled()) return false;
  const hint = slotPathHint(slot).toLowerCase();
  const base = sdmBasename(verifiedPath);
  if (!base) return false;
  if (hint === "keywords.md" && /\.(?:md|markdown)$/i.test(base)) {
    return /关键词|keyword|挖词|GEO/i.test(base);
  }
  if (hint === "keywords.html" && /\.html?$/i.test(base)) {
    return /关键词|keyword|挖词|GEO/i.test(base);
  }
  return false;
}

function geoFastCheckAliasSatisfied(verifiedPath: string, slot: SdmSlotLike): boolean {
  if (!isSdmGeoFastCheckAliasEnabled()) return false;
  const hint = slotPathHint(slot).toLowerCase();
  const base = sdmBasename(verifiedPath);
  if (!base) return false;
  if (hint === "audit-checklist.md" && /\.(?:md|markdown)$/i.test(base)) {
    return /快检|审计|audit/i.test(base);
  }
  if (hint === "optimized.md" && /\.(?:md|markdown)$/i.test(base)) {
    return /优化清单|优化/i.test(base);
  }
  if (hint === "report.html" && /\.html?$/i.test(base)) {
    return base.toLowerCase() === "index.html" || /report|快检|GEO/i.test(base);
  }
  if (geoKeywordAliasSatisfied(verifiedPath, slot)) return true;
  return false;
}

/** PD-SAAS-FORK: legacy brief.md/document.docx slots vs research-report workflow files. */
function researchReportLegacyAliasSatisfied(verifiedPath: string, slot: SdmSlotLike): boolean {
  const hint = slotPathHint(slot).toLowerCase();
  const base = sdmBasename(verifiedPath);
  if (!base) return false;
  const slotId = String(slot.id ?? "");
  const isSkillsPath = hint.includes("skills/") || hint.includes("references/");
  if (isSkillsPath) return false;

  if (
    slot.kind === "docx"
    && (hint === "document.docx" || (hint === "" && /^required_docx/i.test(slotId)))
  ) {
    return /^report(?:-\d+)?\.docx$/i.test(base) || /^04-report\.docx$/i.test(base);
  }
  if (slot.kind !== "markdown") return false;
  const isGenericMarkdownSlot = hint === "brief.md"
    || (hint === "" && /^required_markdown/i.test(slotId))
    || (
      /^required_markdown/i.test(slotId)
      && hint.endsWith(".md")
      && !hint.startsWith("audit-")
      && !hint.startsWith("optimized")
    );
  if (!isGenericMarkdownSlot) return false;
  return isResearchSynthesisPath(verifiedPath) || /03-report-body/i.test(base);
}

/** 3a785077 / 0731 RCA: lite Hub md mis-bound to research-report authority slots. */
function productUserResearchPollutedResearchReportAlias(
  verifiedPath: string,
  slot: SdmSlotLike,
): boolean {
  const slotId = String(slot.id ?? "");
  const base = sdmBasename(verifiedPath);
  if (!base) return false;
  const isPollutedMarkdown = slot.kind === "markdown"
    && /^authority_research-report_[12]$/i.test(slotId);
  const isPollutedHtml = slot.kind === "html"
    && (
      /^authority_research-report_/i.test(slotId)
      || (slotId.startsWith("added_") && /index\.html$/i.test(slotPathHint(slot)))
    );
  if (isPollutedMarkdown) {
    return /product-user-research\.md$/i.test(base)
      || /user-research-report\.md$/i.test(base)
      || /industry-market-report\.md$/i.test(base)
      || /用户研究.*\.md$/i.test(base)
      || /行业市场.*\.md$/i.test(base);
  }
  if (isPollutedHtml) {
    return /\.html?$/i.test(base)
      && (
        /product-user-research\.html$/i.test(base)
        || /用户研究.*\.html$/i.test(base)
        || /report\.html$/i.test(base)
      );
  }
  return false;
}

/**
 * PD-SAAS-FORK 0731: research-report docx slot — report-like basename only.
 * press-release.docx / arbitrary unique docx must NOT satisfy.
 */
/** PD-SAAS-FORK 0731: writing-style-distill slot accepts style/distill md basenames. */
export function writingStyleDistillAliasSatisfied(
  verifiedPath: string,
  slot: SdmSlotLike,
): boolean {
  const slotId = String(slot.id ?? "");
  // Distill-only: methodology / writing-os aliases must not satisfy non-distill slots.
  if (!/writing-style-distill|authority_writing-style-distill/i.test(slotId)) {
    return false;
  }
  const base = sdmBasename(verifiedPath);
  if (!base || !/\.(?:md|markdown)$/i.test(base)) return false;
  // PD-SAAS-FORK 0731-fail-B: English methodology basename (e.g. xiaomi-*-methodology.md).
  return /蒸馏|distill|writing|write-?dna|writing-os|语感|风格|方法论|methodology/i.test(base);
}

export function researchReportDocxFuzzySatisfied(
  verifiedPath: string,
  slot: SdmSlotLike,
): boolean {
  const mode = researchDocxBasenameFuzzyMode();
  if (mode === "off") return false;
  if (slot.kind !== "docx" && !/\.docx$/i.test(slotPathHint(slot))) return false;
  const slotId = String(slot.id ?? "");
  const isResearchDocxSlot = /^authority_research-report_3$/i.test(slotId)
    || /report\.docx|document\.docx|04-report\.docx/i.test(slotPathHint(slot));
  if (!isResearchDocxSlot) return false;
  const base = sdmBasename(verifiedPath);
  if (!base || !/\.docx$/i.test(base)) return false;
  // Ban non-report office docs
  if (/(?:press-release|news-release|invoice|合同|协议|报价)/i.test(base)) return false;
  const hit = /(?:报告|调研|research|report).*\.docx$/i.test(base)
    || /^report(?:-\d+)?\.docx$/i.test(base)
    || /^04-report\.docx$/i.test(base)
    || /^document\.docx$/i.test(base);
  if (hit) {
    recordStabilityEvent({
      event: "research_docx_fuzzy_hit",
      reason: mode,
    });
  }
  return hit;
}

export function isPollutedProductUserResearchResearchReportSlot(slot: SdmSlotLike): boolean {
  const slotId = String(slot.id ?? "");
  return /^authority_research-report_/i.test(slotId);
}

export function allowProductUserResearchPathReuseForSlot(slot: SdmSlotLike): boolean {
  return /^authority_research-report_[12]$/i.test(String(slot.id ?? ""));
}
export function pathSatisfiesSdmSlot(
  verifiedPath: string,
  slot: SdmSlotLike,
): boolean {
  const p = normalizeSdmPath(verifiedPath);
  if (!p) return false;
  if (productUserResearchPollutedResearchReportAlias(p, slot)) return true;
  if (writingStyleDistillAliasSatisfied(p, slot)) return true;
  if (researchReportDocxFuzzySatisfied(p, slot)) return true;
  if (researchReportLegacyAliasSatisfied(p, slot)) return true;
  if (geoFastCheckAliasSatisfied(p, slot)) return true;
  if (geoKeywordAliasSatisfied(p, slot)) return true;
  if (!officeExtensionPathSatisfiesSlot(p, slot)) return false;
  if (slot.kind && !pathExtensionMatchesSlotKind(p, slot.kind)) {
    let patternMatch = false;
    for (const pattern of slotMatchPatterns(slot)) {
      if (pattern.test(p) || pattern.test(sdmBasename(p))) {
        patternMatch = true;
        break;
      }
    }
    if (!patternMatch) return false;
  }
  for (const hint of slotPathHints(slot)) {
    const hintBase = sdmBasename(hint);
    const pathBase = sdmBasename(p);
    if (pathsEqual(p, hint) || pathBase.toLowerCase() === hintBase.toLowerCase()) {
      return true;
    }
    if (deliverableBasenamesMatch(pathBase, hintBase, { tier0Profile: true })) {
      return true;
    }
    if (
      /operation-manual|操作手册|白皮书/i.test(pathBase)
      && /(?:geo|gep)-operation-manual/i.test(`${pathBase} ${hintBase}`)
    ) {
      return true;
    }
    if (p.replace(/\\/g, "/").includes(hint.replace(/\\/g, "/"))) {
      return true;
    }
  }
  for (const pattern of slotMatchPatterns(slot)) {
    if (pattern.test(p) || pattern.test(sdmBasename(p))) return true;
  }
  if (isLongformCountSlot(slot) && isLongformArticlePath(p)) return true;
  if (isChartMermaidSlot(slot) && isChartMermaidPath(p)) return true;
  if (isResearchSynthesisSlot(slot) && isResearchSynthesisPath(p)) return true;
  if (isUniversalDataSourcesSlot(slot) && isUniversalDataSourcesPath(p)) return true;
  const primaryHint = slotPathHint(slot);
  if (!primaryHint && slot.kind && kindMatchAllowed(slot) && pathMatchesKind(p, slot.kind)) return true;
  const label = String(slot.label ?? "").trim();
  if (label.length >= 3 && kindMatchAllowed(slot)) {
    const labelNorm = label.replace(/\s+/g, "").toLowerCase();
    const baseNorm = sdmBasename(p).replace(/[-_.]/g, "").toLowerCase();
    if (baseNorm.includes(labelNorm.slice(0, Math.min(6, labelNorm.length)))) return true;
  }
  return false;
}

export function slotSatisfiedByValidation(
  slot: SdmSlotLike,
  verifiedPaths: string[],
  options?: SdmSlotValidationOptions,
): boolean {
  if (slot.status === "done") return true;
  if (slot.status === "removed") return true;
  if (semanticHtmlDeliverableAliasSatisfied(slot, verifiedPaths, options)) return true;
  if (legacyIndexHtmlSlotFuzzySatisfied(slot, verifiedPaths, options)) return true;
  if (legacyLandingHtmlSlotFuzzySatisfied(slot, verifiedPaths, options)) return true;
  const needed = typeof slot.count === "number" && slot.count > 1 ? slot.count : 1;
  if (needed > 1) {
    return countMatchingVerifiedPaths(slot, verifiedPaths) >= needed;
  }
  return verifiedPaths.some((raw) => pathSatisfiesSdmSlot(raw, slot));
}

/** PD-SAAS-FORK: task/slide scope guard — verified paths must stay under preferredScopeDir when set. */
export function pathWithinPreferredScope(
  verifiedPath: string,
  preferredScopeDir?: string | null,
): boolean {
  if (!preferredScopeDir) return true;
  const scopeNorm = normalizeSdmPath(preferredScopeDir).replace(/\/+$/, "").toLowerCase();
  const p = normalizeSdmPath(verifiedPath);
  if (!p) return false;
  const dir = p.replace(/\/[^/]+$/, "").toLowerCase();
  return dir === scopeNorm || dir.startsWith(`${scopeNorm}/`);
}

const TASK_ARTIFACT_DIR_IN_PATH_RE = /artifacts\/task-\d{8}-[a-f0-9]{8}/i;

/** Re-anchor slot path hints / resolved paths onto the allocated task root. */
export function reanchorSdmPathToTaskDir(filePath: string, taskArtifactDir: string): string {
  const hint = normalizeSdmPath(filePath);
  const dir = normalizeSdmPath(taskArtifactDir).replace(/\/+$/, "");
  if (!hint) return dir;
  const base = sdmBasename(hint);
  const hintTask = hint.match(TASK_ARTIFACT_DIR_IN_PATH_RE)?.[0]?.toLowerCase();
  const scopeTask = dir.match(TASK_ARTIFACT_DIR_IN_PATH_RE)?.[0]?.toLowerCase()
    ?? (dir.startsWith("artifacts/task-") ? dir.toLowerCase() : null);
  if (hintTask && scopeTask && hintTask !== scopeTask) {
    return dir ? `${dir}/${base}` : base;
  }
  if (!hint.includes("/")) {
    return dir ? `${dir}/${hint}` : hint;
  }
  return hint;
}

export function findBestVerifiedPathForSlot(
  slot: SdmSlotLike,
  verifiedPaths: string[],
  usedPaths: Set<string> = new Set(),
  preferredScopeDir?: string | null,
): string | undefined {
  const scopeNorm = preferredScopeDir
    ? normalizeSdmPath(preferredScopeDir).replace(/\/+$/, "").toLowerCase()
    : null;
  let best: string | undefined;
  let bestScore = -1;

  for (const raw of verifiedPaths) {
    const p = normalizeSdmPath(raw);
    if (!p) continue;
    if (usedPaths.has(p.toLowerCase()) && !allowProductUserResearchPathReuseForSlot(slot)) continue;
    if (!pathSatisfiesSdmSlot(p, slot)) continue;

    if (scopeNorm && !pathWithinPreferredScope(p, preferredScopeDir)) continue;

    let score = 0;
    if (scopeNorm) {
      const dir = p.replace(/\/[^/]+$/, "").toLowerCase();
      if (dir === scopeNorm || dir.startsWith(`${scopeNorm}/`)) score += 10;
      for (const hint of slotPathHints(slot)) {
        if (pathsEqual(p, hint)) score += 20;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }

  if (best) {
    usedPaths.add(best.toLowerCase());
  }
  return best;
}

export function inferPathHintForKindOnlySlot(kind: string, index = 0): string {
  const base = defaultPathHintForKind(kind) ?? `deliverable-${index + 1}.${kind}`;
  return base;
}

/** Node path join helper for engine compile (browser-safe callers pass pre-built hints). */
export function joinArtifactPathHint(artifactDir: string, hint: string): string {
  const normDir = normalizeSdmPath(artifactDir).replace(/\/+$/, "");
  const normHint = normalizeSdmPath(hint);
  if (normHint.includes("/")) return normHint;
  return normDir ? `${normDir}/${normHint}` : normHint;
}

export function toManifestSlotShape(slot: SdmSlotLike): {
  id: string;
  label: string;
  path: string;
  kind?: string;
} {
  const hint = slotPathHint(slot);
  return {
    id: slot.id,
    label: slot.label ?? sdmBasename(hint) ?? slot.id,
    path: hint,
    kind: slot.kind,
  };
}

/** Re-export for UI row builder — same basename logic without node:path. */
export function posixBasename(p: string): string {
  return sdmBasename(p);
}

/** PD-SAAS-FORK: drop duplicate SDM slots that share the same basename hint (turn snapshot / summary only). */
export function dedupeSlotsByBasename<T extends {
  id: string;
  path?: string;
  pathHint?: string;
  pathHints?: string[];
  label?: string;
}>(slots: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const slot of slots) {
    const hint = slotPathHint(slot) || slot.path || slot.pathHints?.[0] || '';
    const base = sdmBasename(hint).toLowerCase();
    if (base && seen.has(base)) continue;
    if (base) seen.add(base);
    out.push(slot);
  }
  return out;
}

export function posixDirname(p: string): string {
  const n = normalizeSdmPath(p);
  const idx = n.lastIndexOf("/");
  return idx >= 0 ? n.slice(0, idx) : "";
}

export function posixJoin(...parts: string[]): string {
  return parts
    .map((part, i) => (i === 0 ? normalizeSdmPath(part) : normalizeSdmPath(part).replace(/^\/+/, "")))
    .filter(Boolean)
    .join("/")
    .replace(/\/+/g, "/");
}
