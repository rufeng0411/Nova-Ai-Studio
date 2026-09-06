/**
 * PD-SAAS-FORK: default PPT export routing by user intent.
 * Business/report → native editable anth-pptx; aesthetic → Nova; md→ppt → export_document.
 * Missing page count → auto-pick 6–12 by topic (never block on questionnaire).
 */

import { goalHasPageCount } from "./deliverableSessionGoal.js";

export type PptExportRoute = "native_editable" | "nova_aesthetic" | "doc_export";

/** Inclusive bounds for auto page count when user omits 页数. */
export const PPT_DEFAULT_PAGE_MIN = 6;
export const PPT_DEFAULT_PAGE_MAX = 12;

export type PptExportIntent = {
  route: PptExportRoute;
  preferredSkill: string;
  reason: string;
};

const NOVA_SLUG_RE = /^nova-ppt-/i;

const NOVA_GOAL_RE =
  /nova\s*美学|美学幻灯|ai\s*配图幻灯|配图幻灯|杂志风|海报风幻灯|slide\s*deck.*png|png\s*图集|逐页生图/i;

const DOC_EXPORT_GOAL_RE =
  /(?:把|将).{0,40}(?:md|markdown|报告|文档|docx?).{0,20}(?:转成|导出|做成).{0,12}(?:ppt|pptx|幻灯|演示)|(?:转成|导出).{0,8}(?:ppt|pptx).{0,20}(?:报告|markdown|md)|export_document.{0,40}pptx/i;

const NATIVE_GOAL_RE =
  /(?:做|制作|生成|导出|交付).{0,16}(?:ppt|pptx|幻灯片|演示文稿|演示稿)|(?:ppt|pptx|幻灯片|演示文稿|路演ppt|汇报ppt|客户提案)|可编辑\s*(?:ppt|pptx|幻灯)|原生可编辑|\.pptx\b/i;

const BUSINESS_HINT_RE = /路演|汇报|方案|提案|商务|客户|融资|董事会|周会|季度|述职|培训课件/i;

const PPT_LIKE_GOAL_RE = /(?:ppt|PPT|pptx|幻灯|演示稿|演示文稿)/i;

/**
 * When the user does not specify page count, pick a single page count in [6,12]
 * from topic richness (sections / length / business hints). Agent decides layout
 * within that budget — never wait for a questionnaire answer.
 */
export function resolveDefaultPptPageCount(userGoal: string): number {
  const goal = String(userGoal ?? "").trim();
  if (!goal) return 8;
  // Inline /gi — avoid module-level lastIndex sticky matches.
  const sectionHits = (
    goal.match(
      /封面|议程|进展|数据|总结|行动|路演|融资|竞品|附录|章节|大纲|里程碑|OKR|KPI|复盘|计划/gi,
    ) || []
  ).length;
  const len = goal.length;
  let pages = 8;
  if (sectionHits >= 5 || len > 400 || /路演|融资|董事会|季度全案|商业计划/i.test(goal)) {
    pages = 12;
  } else if (sectionHits >= 3 || len > 180 || BUSINESS_HINT_RE.test(goal)) {
    pages = 10;
  } else if (len < 40 && sectionHits <= 1) {
    pages = 6;
  }
  return Math.min(PPT_DEFAULT_PAGE_MAX, Math.max(PPT_DEFAULT_PAGE_MIN, pages));
}

export function buildPptDefaultPageCountDirective(
  userGoal: string,
  language: "zh-CN" | "en" = "zh-CN",
): string | undefined {
  const goal = String(userGoal ?? "").trim();
  if (!goal || !PPT_LIKE_GOAL_RE.test(goal) || goalHasPageCount(goal)) {
    return undefined;
  }
  const pages = resolveDefaultPptPageCount(goal);
  if (language === "zh-CN") {
    return [
      `<ppt-default-page-count pages="${pages}" min="${PPT_DEFAULT_PAGE_MIN}" max="${PPT_DEFAULT_PAGE_MAX}">`,
      `用户未指定页数：按主题自动定为约 ${pages} 页（允许在 ${PPT_DEFAULT_PAGE_MIN}–${PPT_DEFAULT_PAGE_MAX} 页内微调）。`,
      "禁止再向用户询问页数或等待「直接开始做」；立即开工交付。",
      "</ppt-default-page-count>",
    ].join("\n");
  }
  return [
    `<ppt-default-page-count pages="${pages}" min="${PPT_DEFAULT_PAGE_MIN}" max="${PPT_DEFAULT_PAGE_MAX}">`,
    `No page count given: auto-target ~${pages} slides (fine-tune within ${PPT_DEFAULT_PAGE_MIN}–${PPT_DEFAULT_PAGE_MAX}).`,
    "Do not ask the user for page count; start delivering immediately.",
    "</ppt-default-page-count>",
  ].join("\n");
}

/** Hub slug already locks a PPT path — do not override skill choice. */
export function hubLocksPptRoute(capabilitySlug?: string): PptExportRoute | null {
  const slug = (capabilitySlug ?? "").trim().toLowerCase();
  if (!slug) return null;
  if (NOVA_SLUG_RE.test(slug) || slug === "nova-ppt-aesthetic-slides") return "nova_aesthetic";
  if (slug === "anth-pptx" || slug === "ppt-master") return "native_editable";
  if (slug === "html-ppt") return null; // Hub HTML deck: quality-only, no forced reroute
  if (slug === "df-ppt-generation") return "native_editable";
  if (slug === "tool-ocr-editable-pptx" || slug.includes("ocr-editable-pptx")) return null;
  return null;
}

export function detectPptExportIntent(
  userGoal: string,
  capabilitySlug?: string,
): PptExportIntent | null {
  const goal = String(userGoal ?? "").trim();
  const hubRoute = hubLocksPptRoute(capabilitySlug);
  if (hubRoute === "nova_aesthetic") {
    return {
      route: "nova_aesthetic",
      preferredSkill: "nova-ppt-aesthetic-slides",
      reason: "hub_nova",
    };
  }
  if (hubRoute === "native_editable") {
    return {
      route: "native_editable",
      preferredSkill: capabilitySlug === "ppt-master" ? "ppt-master" : "anth-pptx",
      reason: "hub_native",
    };
  }

  if (!goal) return null;

  if (NOVA_GOAL_RE.test(goal) || NOVA_SLUG_RE.test(capabilitySlug ?? "")) {
    return {
      route: "nova_aesthetic",
      preferredSkill: "nova-ppt-aesthetic-slides",
      reason: "goal_nova",
    };
  }

  if (DOC_EXPORT_GOAL_RE.test(goal) && !BUSINESS_HINT_RE.test(goal) && !/\.pptx|可编辑/i.test(goal)) {
    return {
      route: "doc_export",
      preferredSkill: "export_document",
      reason: "goal_doc_export",
    };
  }

  if (NATIVE_GOAL_RE.test(goal) || BUSINESS_HINT_RE.test(goal) && /ppt|pptx|幻灯|演示/i.test(goal)) {
    return {
      route: "native_editable",
      preferredSkill: "anth-pptx",
      reason: "goal_native",
    };
  }

  return null;
}

const QUALITY_FORCE_ZH = [
  "质量强制（风格/格式/图表/配图）：",
  "1) 统一母版、配色与字体层级（标题/正文/注释），默认 16:9，禁止白底堆字；",
  "2) 有对比/趋势/占比数据时必须做图表（原生图表或结构化图），无可靠数据须标注「示意/待核实」，禁止编造精确 KPI；",
  "3) 品牌/产品配图阶梯：官网或权威站真实图（resolve_session_visual_assets→bind）→ 降级位图占位（须可见标注「图源待补」）→ 其他装饰可用 generate_image；",
  "4) 禁止用 generate_image 冒充产品官图；禁止无标记 SVG/假完成当官图。",
].join("");

const QUALITY_FORCE_EN = [
  "Quality bar (style/layout/charts/imagery):",
  "1) Unified master, palette, and type hierarchy; default 16:9; no plain wall-of-text slides;",
  "2) Use charts for comparisons/trends when data exists; label speculative figures; never invent precise KPIs;",
  "3) Brand/product imagery ladder: official/authoritative sites (resolve_session_visual_assets→bind) → labeled bitmap placeholder → generate_image only for non-product decoration;",
  "4) Never use generate_image as fake official product photos; no unmarked SVG as done imagery.",
].join(" ");

function routeInstructionsZh(intent: PptExportIntent): string {
  switch (intent.route) {
    case "native_editable":
      return [
        `路由：原生可编辑 PPTX。必须先 read_skill skillName=\`${intent.preferredSkill}\`（首选 anth-pptx；必要时可用 ppt-master）。`,
        "交付真实可打开的 .pptx；禁止 presentation.html / slides.html / create_*.py / 空壳 presentation.pptx 充数。",
        QUALITY_FORCE_ZH,
      ].join("");
    case "nova_aesthetic":
      return [
        "路由：Nova 美学图集。必须先 read_skill skillName=`nova-ppt-aesthetic-slides`，交付 slide-NN.png + slide-manifest.json。",
        "告知用户预览后点「导出 PPT」走 MinerU 可编辑 PPTX；禁止改走 html-ppt 或仅 HTML。",
        QUALITY_FORCE_ZH,
      ].join("");
    case "doc_export":
      return [
        "路由：文档转 PPT。先写齐源 Markdown/报告，再用 export_document 导出同目录可读 .pptx（版式须专业可读）。",
        "若用户同时要求「可编辑/原生形状/路演级」，改走 anth-pptx 原生可编辑路径。",
        QUALITY_FORCE_ZH,
      ].join("");
    default: {
      const _exhaustive: never = intent.route;
      return _exhaustive;
    }
  }
}

function routeInstructionsEn(intent: PptExportIntent): string {
  switch (intent.route) {
    case "native_editable":
      return [
        `Route: native editable PPTX. read_skill \`${intent.preferredSkill}\` first (prefer anth-pptx; ppt-master as peer fallback).`,
        "Deliver a real openable .pptx; never ship HTML-only, create_*.py, or stub presentation.pptx.",
        QUALITY_FORCE_EN,
      ].join(" ");
    case "nova_aesthetic":
      return [
        "Route: Nova aesthetic deck. read_skill `nova-ppt-aesthetic-slides`; deliver slide-NN.png + slide-manifest.json.",
        "Tell the user to export editable PPTX via MinerU from the preview; do not fall back to html-ppt.",
        QUALITY_FORCE_EN,
      ].join(" ");
    case "doc_export":
      return [
        "Route: document→PPT. Finish the source Markdown/report, then export_document to a readable .pptx in the same folder.",
        "If the user also asks for native editable/pitch-grade slides, switch to anth-pptx.",
        QUALITY_FORCE_EN,
      ].join(" ");
    default: {
      const _exhaustive: never = intent.route;
      return _exhaustive;
    }
  }
}

/** Build system-prompt append when PPT export policy is enabled and goal matches. */
export function buildPptExportDefaultAppendPrompt(input: {
  userGoal: string;
  capabilitySlug?: string;
  language?: "zh-CN" | "en";
}): string | undefined {
  const language = input.language ?? "zh-CN";
  const pageDirective = buildPptDefaultPageCountDirective(input.userGoal, language);
  const intent = detectPptExportIntent(input.userGoal, input.capabilitySlug);
  if (!intent) {
    // Still inject page-count default for bare PPT goals that skip the route block.
    return pageDirective;
  }
  const body = language === "zh-CN"
    ? routeInstructionsZh(intent)
    : routeInstructionsEn(intent);
  return [
    "<ppt-export-default-policy>",
    `route=${intent.route}; skill=${intent.preferredSkill}; reason=${intent.reason}`,
    body,
    "</ppt-export-default-policy>",
    pageDirective,
  ].filter(Boolean).join("\n");
}

export function resolvePptExportDefaultAppendFromMessages(input: {
  messages: Array<{ role?: string; content?: unknown }>;
  capabilitySlug?: string;
  language?: "zh-CN" | "en";
  enabled: boolean;
}): string | undefined {
  const userText = input.messages
    .filter((message) => message.role === "user")
    .map((message) => messageTextContent(message))
    .join("\n");
  const language = input.language ?? "zh-CN";
  // PD-SAAS-FORK: page-count auto-default is always on for PPT-like goals (not flag-gated).
  const pageDirective = buildPptDefaultPageCountDirective(userText, language);
  if (!input.enabled) {
    return pageDirective;
  }
  const policy = buildPptExportDefaultAppendPrompt({
    userGoal: userText,
    capabilitySlug: input.capabilitySlug,
    language,
  });
  // buildPptExportDefaultAppendPrompt already embeds pageDirective; avoid duplicating.
  return policy || pageDirective;
}

function messageTextContent(message: { content?: unknown }): string {
  const content = message.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const record = block as Record<string, unknown>;
      return typeof record.text === "string" ? record.text : "";
    })
    .join("\n");
}
