// PD-SAAS-FORK: global placeholder degrade for HTML/docx/PDF tasks when image gen/search/fetch fails repeatedly

import type { PromptLanguage } from "../../context/prompt/resolvePromptLanguage.js";
import type { CanonicalMessage } from "../../model/index.js";
import type { PilotDeckToolResult } from "../../tool/index.js";
import { isSoftFailedToolResult } from "../../agent/loop/toolFailureRecovery.js";
import {
  compileOfficialMediaRequirement,
  type OfficialMediaPolicy,
} from "../constraints/officialMediaRequirement.js";
import { classifyErrorMessage } from "../resilience/errorClassifier.js";
import { officialMediaV2Mode } from "../resilience/stabilityFlags.js";
import { isCreativePreferGenActive } from "./creativeGenerateImageIntent.js";
import { buildAcquisitionStrategyBlock } from "./visualAssetPlatform/visualAcquisitionLadder.js";

export const VISUAL_MEDIA_ACQUISITION_TOOLS = new Set([
  "generate_image",
  "fetch_page_images",
  // PD-SAAS-FORK P0-4: candidate localization is part of acquisition.
  "fetch_media_asset",
  // PD-SAAS-FORK VAP
  "resolve_session_visual_assets",
  "discover_visual_assets",
  "prepare_visual_asset",
  "web_fetch",
  "web_search",
]);

const DEFAULT_MEDIA_DEGRADE_THRESHOLD = 2;
const DEFAULT_MEDIA_DEGRADE_TOTAL_THRESHOLD = 4;

const DOCUMENT_VISUAL_GOAL_PATTERN = [
  /\bhtml\b/i,
  /\bdocx?\b/i,
  /\bpdf\b/i,
  /\bpptx?\b/i,
  /\blanding\s*page\b/i,
  /\bwebsite\b/i,
  /官网/,
  /落地页/,
  /海报/,
  /幻灯/,
  /ppt/i,
  /全案/,
  /campaign/i,
  /poster/i,
  /brochure/i,
  /宣传/,
  /物料/,
  /社媒/,
  /配图/,
  /封面/,
  /banner/i,
  /visibility-report/i,
  /open-design/i,
  /设计稿/,
  /网页/,
  /报告.*html/i,
  /docx/i,
  /word/i,
  /文档/,
  /导出/,
];

export function getMediaDegradeThreshold(): number {
  const raw = process.env.PILOTDECK_MEDIA_DEGRADE_AFTER?.trim();
  if (!raw) return DEFAULT_MEDIA_DEGRADE_THRESHOLD;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_MEDIA_DEGRADE_THRESHOLD;
  return parsed;
}

export function getMediaDegradeTotalThreshold(): number {
  const perTool = getMediaDegradeThreshold();
  return Math.max(DEFAULT_MEDIA_DEGRADE_TOTAL_THRESHOLD, perTool * 2);
}

export function isVisualMediaAcquisitionTool(toolName: string): boolean {
  return VISUAL_MEDIA_ACQUISITION_TOOLS.has(toolName.trim().toLowerCase());
}

export function isDocumentStyleVisualGoal(userGoal: string): boolean {
  const goal = String(userGoal ?? "").trim();
  if (!goal) return false;
  return DOCUMENT_VISUAL_GOAL_PATTERN.some((pattern) => pattern.test(goal));
}

export function toolNameFromRepeatKey(repeatKey: string | null | undefined): string | null {
  if (!repeatKey) return null;
  const colon = repeatKey.indexOf(":");
  if (colon <= 0) return repeatKey.trim().toLowerCase() || null;
  return repeatKey.slice(0, colon).trim().toLowerCase() || null;
}

export type VisualMediaFailureStat = {
  perToolCount: number;
  totalCount: number;
  shouldForcePlaceholder: boolean;
};

export class VisualMediaAttemptTracker {
  private readonly perTool = new Map<string, number>();
  private total = 0;

  recordFailure(toolName: string): VisualMediaFailureStat {
    const normalized = toolName.trim().toLowerCase();
    const perToolCount = (this.perTool.get(normalized) ?? 0) + 1;
    this.perTool.set(normalized, perToolCount);
    this.total += 1;
    const threshold = getMediaDegradeThreshold();
    const totalThreshold = getMediaDegradeTotalThreshold();
    const shouldForcePlaceholder = perToolCount >= threshold || this.total >= totalThreshold;
    return { perToolCount, totalCount: this.total, shouldForcePlaceholder };
  }

  shouldForcePlaceholderDegrade(): boolean {
    const threshold = getMediaDegradeThreshold();
    const totalThreshold = getMediaDegradeTotalThreshold();
    if (this.total >= totalThreshold) return true;
    for (const count of this.perTool.values()) {
      if (count >= threshold) return true;
    }
    return false;
  }

  resetSession(): void {
    this.perTool.clear();
    this.total = 0;
  }
}

const sessionTrackers = new Map<string, VisualMediaAttemptTracker>();

export function getVisualMediaAttemptTracker(sessionId: string): VisualMediaAttemptTracker {
  const key = sessionId.trim();
  if (!key) return new VisualMediaAttemptTracker();
  let tracker = sessionTrackers.get(key);
  if (!tracker) {
    tracker = new VisualMediaAttemptTracker();
    sessionTrackers.set(key, tracker);
  }
  return tracker;
}

/** @internal */
export function _clearVisualMediaAttemptTrackersForTests(): void {
  sessionTrackers.clear();
}

export function recordVisualMediaFailuresForSession(
  sessionId: string | undefined,
  userGoal: string,
  results: PilotDeckToolResult[],
  options: { officialMediaPolicy?: OfficialMediaPolicy } = {},
): VisualMediaFailureStat | null {
  if (
    shouldBypassLegacyVisualMediaDegrade(
      userGoal,
      options.officialMediaPolicy,
    )
  ) {
    return null;
  }
  if (!sessionId || !isDocumentStyleVisualGoal(userGoal)) return null;
  const tracker = getVisualMediaAttemptTracker(sessionId);
  let last: VisualMediaFailureStat | null = null;
  for (const result of results) {
    const failed = result.type === "error" || isSoftFailedToolResult(result);
    if (!failed || !isVisualMediaAcquisitionTool(result.toolName)) continue;
    last = tracker.recordFailure(result.toolName);
  }
  return last;
}

export function hasVisualMediaFailureInResults(results: PilotDeckToolResult[]): boolean {
  return results.some((result) => (
    (result.type === "error" || isSoftFailedToolResult(result))
    && isVisualMediaAcquisitionTool(result.toolName)
  ));
}

export function shouldUseVisualPlaceholderDegrade(params: {
  userGoal: string;
  repeatKey?: string | null;
  forceFromTracker?: boolean;
  officialMediaPolicy?: OfficialMediaPolicy;
}): boolean {
  if (
    shouldBypassLegacyVisualMediaDegrade(
      params.userGoal,
      params.officialMediaPolicy,
    )
  ) {
    return false;
  }
  if (!isDocumentStyleVisualGoal(params.userGoal)) return false;
  if (params.forceFromTracker) return true;
  const tool = toolNameFromRepeatKey(params.repeatKey ?? null);
  return Boolean(tool && isVisualMediaAcquisitionTool(tool));
}

/**
 * PD-SAAS-FORK VAP P0-C0: in enforce mode, official goals bypass legacy SVG degrade.
 * Explicit session contract (`officialMediaPolicy`) always bypasses.
 * In shadow/off, compiled official_only still allows legacy degrade for telemetry only.
 */
export function shouldBypassLegacyVisualMediaDegrade(
  userGoal: string,
  officialMediaPolicy?: OfficialMediaPolicy,
): boolean {
  if (officialMediaPolicy === "official_only") return true;
  if (officialMediaV2Mode() !== "enforce") return false;
  const policy = officialMediaPolicy
    ?? compileOfficialMediaRequirement(userGoal).officialMediaPolicy;
  return policy === "official_only" || policy === "official_preferred";
}

const VISUAL_MEDIA_DEGRADE_STRATEGY_ZH = `<visual-media-degrade>
HTML/docx/PDF/PPT/官网/海报/社媒等需要配图的任务：优先一次调用 resolve_session_visual_assets，系统自动按序尝试——官网 URL → 品牌根域 → 行业权威站 → 综合门户 → **网页搜索引擎（博查/Bing）** → **图片搜索引擎（Bing Images）** → HTML 候选提取 → 视口截图。**全部渠道安全尝试仍失败**才可降级或向用户说明「多次尝试仍无法获取配图」。生图/搜图/抓取**同一资源最多尝试 2 次**（PILOTDECK_MEDIA_DEGRADE_AFTER）。**非官方强制任务**仍失败才可降级：write_file SVG/CSS 占位并在正文说明。若用户要求「图来自官网/官方」：禁止用 SVG 冒充交付完成，须跑满多源阶梯后诚实 needs_repair；禁止 generate_image 冒充产品官图。
</visual-media-degrade>`;

const VISUAL_MEDIA_DEGRADE_STRATEGY_EN = `<visual-media-degrade>
For visual deliverables: prefer resolve_session_visual_assets once — it runs official URL → brand roots → authority sites → portals → HTML extract → bounded page screenshot. Only after ALL tiers fail may you degrade or tell the user acquisition failed. Cap generate_image/web_search/fetch at **2** attempts per asset. For non-official goals only, degrade to SVG/CSS placeholders after that. When the user requires official/website images: never treat SVG placeholders as success; exhaust the ladder first — do not fake product photos with generate_image.
</visual-media-degrade>`;

const OFFICIAL_ONLY_DEGRADE_STRATEGY_ZH = `<visual-media-degrade official_only="1">
本任务要求官方/官网配图：必须先 resolve_session_visual_assets（六层阶梯自动跑满：官网直链→根域→权威站→门户→HTML 提取→视口截图）。禁止 generate_image 充产品图；禁止首轮 fetch 失败就写 SVG 占位当完成。仅当 manifest 显示 ladderExhausted=true 且 assetCount=0 时，才可在成果中披露「已尝试多种渠道仍无法获取配图」并保持 needs_repair。
</visual-media-degrade>`;

const OFFICIAL_ONLY_DEGRADE_STRATEGY_EN = `<visual-media-degrade official_only="1">
Official/website images required: call resolve_session_visual_assets first (six-tier ladder: direct → roots → authority → portal → HTML extract → screenshot). Never use generate_image as product photos; never SVG placeholders after the first fetch failure. Only when ladderExhausted=true and assetCount=0 may you disclose acquisition failure and keep needs_repair.
</visual-media-degrade>`;

const CREATIVE_PREFER_GEN_STRATEGY_ZH = `<visual-media-degrade creative_prefer_gen="1">
创意海报/封面/主视觉/杂志配图/落地页 Hero/活动长图等：图片 API 已配置时，**主视觉优先 generate_image**（海报/落地页 Hero≈1 次，杂志配图≤3；showcase 次卡可用 CSS）。禁止首轮 CSS/SVG 渐变冒充主视觉；禁止先跑 resolve_session_visual_assets 搜官图（用户明确要官图除外）。先落盘 PNG 再 write_file HTML 引用。鉴权/欠费须停止并说明配置问题，禁止无标注假绿占位。仅瞬时失败达 2 次后才可标注占位并继续。
</visual-media-degrade>`;

const CREATIVE_PREFER_GEN_STRATEGY_EN = `<visual-media-degrade creative_prefer_gen="1">
Creative poster/cover/hero/magazine art/landing Hero: when the image API is ready, prefer generate_image for the primary visual (≈1 for poster/Hero, ≤3 for magazine; secondary cards may use CSS). Do not lead with CSS/SVG fakes; do not run resolve_session_visual_assets first unless official imagery is required. Write PNG then reference it from HTML. Auth/billing failures must stop with a clear config notice — never unlabeled fake-green placeholders. Only after 2 transient failures may you use a labeled placeholder.
</visual-media-degrade>`;

export function buildVisualMediaDegradeStrategyBlock(
  language: PromptLanguage = "en",
  options: {
    officialMediaPolicy?: OfficialMediaPolicy;
    userGoal?: string;
    capabilitySlug?: string;
  } = {},
): string {
  const policy = options.officialMediaPolicy
    ?? (options.userGoal
      ? compileOfficialMediaRequirement(options.userGoal).officialMediaPolicy
      : "none");
  if (policy === "official_only") {
    return [
      language === "zh-CN"
        ? OFFICIAL_ONLY_DEGRADE_STRATEGY_ZH
        : OFFICIAL_ONLY_DEGRADE_STRATEGY_EN,
      buildAcquisitionStrategyBlock(language),
    ].join("\n");
  }
  // PD-SAAS-FORK: creative prefer-generate track — replace VAP-first copy (needs userGoal).
  if (
    options.userGoal
    && isCreativePreferGenActive({
      goal: options.userGoal,
      slug: options.capabilitySlug,
    })
  ) {
    return language === "zh-CN"
      ? CREATIVE_PREFER_GEN_STRATEGY_ZH
      : CREATIVE_PREFER_GEN_STRATEGY_EN;
  }
  return [
    language === "zh-CN" ? VISUAL_MEDIA_DEGRADE_STRATEGY_ZH : VISUAL_MEDIA_DEGRADE_STRATEGY_EN,
    buildAcquisitionStrategyBlock(language),
  ].join("\n");
}

const PLACEHOLDER_RECOVERY_ZH =
  "配图/生图/搜图/抓取已连续失败。请停止对同一资源的 generate_image、web_search、fetch_page_images、web_fetch 重试。"
  + "立即 write_file 在当前 task 目录写入 SVG 或 CSS 渐变占位图（如 assets/placeholder.svg），"
  + "在 HTML/docx 版式中引用占位图，manifest 可标注 placeholder=true；"
  + "正文简短说明哪些配图已降级，然后继续完成剩余交付物，不要空转。";

const PLACEHOLDER_RECOVERY_EN =
  "Image generation/search/fetch failed repeatedly. Stop retrying generate_image, web_search, fetch_page_images, and web_fetch for the same asset. "
  + "write_file an SVG or CSS-gradient placeholder under the task directory (e.g. assets/placeholder.svg), embed it in HTML/docx layout, "
  + "mark placeholder=true in manifest when applicable, note which images were degraded, and finish the remaining deliverables — do not spin on one image.";

const CREATIVE_PLACEHOLDER_RECOVERY_ZH =
  "创意主视觉生图已连续失败。停止对同一槽位重复 generate_image。"
  + "使用带明确标注的占位图（manifest placeholder=true），禁止无说明的 CSS/SVG 假绿冒充完成；"
  + "正文说明主视觉降级原因，继续完成版式与其余交付。";

const CREATIVE_PLACEHOLDER_RECOVERY_EN =
  "Creative hero generate_image failed repeatedly. Stop retrying the same slot. "
  + "Use a clearly labeled placeholder (placeholder=true); do not finish with unlabeled CSS/SVG fakes. "
  + "Note the degrade in the reply and finish layout/remaining deliverables.";

export function toolResultFailureText(result: PilotDeckToolResult): string {
  if (result.type === "error") {
    return String(result.error?.message ?? "");
  }
  return result.content.map((c) => ("text" in c ? String(c.text ?? "") : "")).join("\n");
}

/** Auth/billing hard-fail on generate_image — never SVG-degrade. */
export function hasGenerateImageHardFail(results: PilotDeckToolResult[]): boolean {
  return results.some((result) => {
    if (result.toolName.trim().toLowerCase() !== "generate_image") return false;
    if (result.type !== "error" && !isSoftFailedToolResult(result)) return false;
    const classification = classifyErrorMessage(toolResultFailureText(result)).classification;
    return classification === "model_billing" || classification === "model_auth";
  });
}

/**
 * Creative track + generate_image auth/billing: do not consume visual_media_degrade.
 */
export function shouldSkipCreativeVisualPlaceholderDegrade(params: {
  userGoal: string;
  capabilitySlug?: string;
  results: PilotDeckToolResult[];
}): boolean {
  if (!isCreativePreferGenActive({
    goal: params.userGoal,
    slug: params.capabilitySlug,
  })) {
    return false;
  }
  return hasGenerateImageHardFail(params.results);
}

export function buildVisualMediaPlaceholderRecoveryMessage(
  language: PromptLanguage = "en",
  failedTools: string[] = [],
  options?: {
    officialMediaPolicy?: OfficialMediaPolicy;
    userGoal?: string;
    capabilitySlug?: string;
  },
): CanonicalMessage | null {
  if (
    options?.officialMediaPolicy === "official_only"
    || options?.officialMediaPolicy === "official_preferred"
  ) {
    const text = language === "zh-CN"
      ? "Recovery: 官方配图任务禁止 SVG 占位继续交付。请调用 resolve_session_visual_assets (phase_a) 耗尽配图阶梯；若仍失败，保持 needs_repair 并披露缺口，勿 write_file placeholder.svg。"
      : "Recovery: official imagery required — do not write SVG placeholders. Exhaust resolve_session_visual_assets (phase_a) first; if acquisition fails, disclose gaps and stay in needs_repair.";
    return {
      role: "user",
      content: [{ type: "text", text }],
      metadata: { synthetic: true, purpose: "visual_media_official_recovery" },
    };
  }
  const creative = Boolean(
    options?.userGoal
    && isCreativePreferGenActive({
      goal: options.userGoal,
      slug: options.capabilitySlug,
    }),
  );
  const base = creative
    ? (language === "zh-CN" ? CREATIVE_PLACEHOLDER_RECOVERY_ZH : CREATIVE_PLACEHOLDER_RECOVERY_EN)
    : (language === "zh-CN" ? PLACEHOLDER_RECOVERY_ZH : PLACEHOLDER_RECOVERY_EN);
  const detail = failedTools.length > 0
    ? (language === "zh-CN"
      ? ` 涉及工具：${[...new Set(failedTools)].join("、")}。`
      : ` Tools: ${[...new Set(failedTools)].join(", ")}.`)
    : "";
  return {
    role: "user",
    content: [{ type: "text", text: `${base}${detail}` }],
    metadata: { synthetic: true, purpose: "visual_media_placeholder_degrade" },
  };
}

export const GENERATE_IMAGE_RECOVERY =
  "Recovery: generate_image failed. Try fetch_page_images on one official URL at most once, then write_file an inline SVG placeholder under the task directory and continue HTML/docx/PDF delivery. Do not retry generate_image more than twice for the same slot.";

export const GENERATE_IMAGE_FORCE_PLACEHOLDER_RECOVERY =
  "Recovery: STOP retrying generate_image for this asset. write_file an SVG/CSS placeholder (e.g. assets/placeholder.svg), embed in the layout, and finish the deliverable.";

export const GENERATE_IMAGE_HARD_FAIL_RECOVERY =
  "Recovery: generate_image failed due to authentication or billing/quota. Do NOT write SVG/CSS placeholders as success. Stop visual acquisition and surface a calm configuration notice (UserActionRequired) so the user can check the image API key or quota.";

export const GENERATE_IMAGE_CREATIVE_ENFORCE_RECOVERY =
  "Recovery: generate_image failed on a creative hero slot. Retry once if transient. Do NOT lead with CSS/SVG as the main visual. After 2 failures, use a clearly labeled placeholder and continue — prefer a real PNG when possible.";

export const VISUAL_MEDIA_FORCE_PLACEHOLDER_HINT =
  "Recovery: image search/fetch/generation failed repeatedly. Use write_file SVG/CSS placeholders under the task directory and finish HTML/docx/PDF — do not retry the same visual acquisition call.";
