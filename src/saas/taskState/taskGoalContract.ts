import { extractRequestedCount } from "../deliverables/acceptanceRequestCount.js";
import type { AcceptanceArtifactKind } from "../deliverables/acceptanceArtifactKind.js";
import {
  isNovaResearchCapabilitySlug,
  isOpenIndustryGeoResearchGoal,
  isScriptDraftGoal,
  isCodeScriptGoal,
  isVideoMp4FilmGoal,
  listDeliverableProfiles,
} from "../deliverableCapabilityProfiles.js";
import { stripLaunchContextAndAttachmentBlocks } from "../deliverables/deliverableChecklistAuthority.js";
import type { CapabilityCompletionMode } from "../intent/capabilityCompletionMode.js";
import { isVideoApiReady } from "../media/mediaRuntimeProbe.js";
import { detectResearchReportTurn, detectContentMatrixTurn } from "../processTemplateExecutionPrompt.js";
import { isCapabilityScopeV2EnforcedForSlug, isKindMentionSanitizeMode } from "../resilience/stabilityFlags.js";
import { recordStabilityEvent } from "../../telemetry/stabilityEvents.js";
import {
  gateOfficeKindsByImperative,
  sanitizeGoalForKindInference,
  serializeArtifactKinds,
} from "../deliverables/goalKindSanitize.js";
import { isHyperframesVideoSlug } from "../media/hyperframesEngineFlags.js";

export type TaskGoalQualityCheck =
  | "exists"
  | "valid_binary"
  | "non_empty"
  | "not_placeholder"
  | "formal_html";

export type TaskGoalContract = {
  goalVersion: number;
  sourceGoal: string;
  expectedKinds: AcceptanceArtifactKind[];
  requiredFiles: string[];
  minCount?: number;
  /** Per-kind minimum counts for multi-kind tasks (e.g. html 8 screens, video 1). */
  kindCounts?: TaskGoalKindCount[];
  qualityChecks: TaskGoalQualityCheck[];
  capabilitySlug?: string;
  profileId?: string;
  /** PD-SAAS-FORK: optional user-stated turn budget ("N 轮内停"). Clamped when parsed. */
  maxTurnsHint?: number;
  /** PD-SAAS-FORK: optional explicit completion assertions from the user goal. */
  completionAssertions?: string[];
  supersedes?: Pick<TaskGoalContract, "goalVersion" | "expectedKinds" | "requiredFiles" | "minCount">;
};

export type TaskGoalKindCount = {
  kind: AcceptanceArtifactKind;
  min: number;
};

export type BuildTaskGoalContractInput = {
  userGoal: string;
  previousContract?: TaskGoalContract;
  capabilitySlug?: string;
  majorCategory?: string;
  profileId?: string;
  /** PD-SAAS-FORK: P0-1 exact capability file-completion mode. */
  completionMode?: CapabilityCompletionMode;
};

const PAGE_UNIT_COUNT_KINDS: AcceptanceArtifactKind[] = ["html", "pptx", "pdf"];

/** Upper bound for parsed maxTurnsHint — prevents absurd regex matches. */
const MAX_TURNS_HINT_CEILING = 50;

const MAX_TURNS_HINT_PATTERNS: RegExp[] = [
  /(?:^|[\s，,。；;])(\d{1,3})\s*(?:轮|步|turns?)\s*(?:内|以内|之内|最多|停|完成|搞定)/i,
  /(?:within|in)\s+(\d{1,3})\s+turns?\b/i,
  /(?:最多|不超过|至多)\s*(\d{1,3})\s*(?:轮|步)/i,
];

const COMPLETION_ASSERTION_LINE =
  /(?:^|\n)\s*(?:完成条件|要求|确保|must\s*[:：]|ensure\s*[:：])\s*[:：]?\s*(.+)/gi;

const COMPLETION_ASSERTION_MAX = 3;
const COMPLETION_ASSERTION_MAX_LEN = 200;

// PD-SAAS-FORK: required deliverable files are compiled from the capability
// profile registry so the contract stays the single source of truth and never
// diverges from the skill-authoritative basenames.
function compileProfileRequiredFiles(profileId: string | undefined): string[] {
  if (!profileId) return [];
  const profile = listDeliverableProfiles().find((entry) => entry.id === profileId);
  if (!profile) return [];
  const files: string[] = [];
  const groups = profile.requiredBasenameGroups?.length
    ? profile.requiredBasenameGroups
    : (profile.requiredArtifacts ?? profile.requiredBasenames ?? []).map((basename) => [basename]);
  for (const group of groups) {
    const representative = group[0];
    if (representative && !files.includes(representative)) files.push(representative);
  }
  if (profile.requiredPlatformDrafts) {
    files.push(`platform-drafts>=${profile.requiredPlatformDrafts.count}`);
  }
  return files;
}

// PD-SAAS-FORK: bind the requested count to the page-based kind for multi-kind
// tasks so e.g. "8 screens + 1 video" verifies html=8 instead of a global count
// that any single kind could satisfy.
function buildKindCounts(
  kinds: AcceptanceArtifactKind[],
  count: number | undefined,
): TaskGoalKindCount[] | undefined {
  if (!count || kinds.length < 2) return undefined;
  const primary = PAGE_UNIT_COUNT_KINDS.find((kind) => kinds.includes(kind));
  if (!primary) return undefined;
  return [{ kind: primary, min: count }];
}

export function buildTaskGoalContract(input: BuildTaskGoalContractInput): TaskGoalContract {
  const goal = stripLaunchContextAndAttachmentBlocks(String(input.userGoal ?? "")).trim();
  const isGeoFullCase = isBrandGeoFullCaseGoal(goal, input);
  const isNovaImageSlideDeck = isNovaImageSlideDeckGoal(goal, input.capabilitySlug);
  let profileId = input.profileId ?? inferProfileId(input.capabilitySlug, goal);
  let expectedKinds = inferExpectedKinds(goal, input);
  // PD-SAAS-FORK: Nova 调研/报告类 goal 须验收 markdown，否则 web_search 后 turn 会误判「已完成」。
  if (
    profileId === "research"
    || isNovaResearchCapabilitySlug(input.capabilitySlug)
    || detectResearchReportTurn(goal)
  ) {
    if (!expectedKinds.includes("markdown")) {
      expectedKinds = ["markdown", ...expectedKinds];
    }
  }
  const minCount = isGeoFullCase ? undefined : extractRequestedCount(goal);
  if (isNovaImageSlideDeck) {
    profileId = "nova-slide-deck";
  }
  const requiredFiles = [
    ...(isGeoFullCase
      ? compileProfileRequiredFiles("geo")
      : isNovaImageSlideDeck
        ? compileProfileRequiredFiles("nova-slide-deck")
        : shouldRequireStoryboardPack(goal, profileId) ? compileProfileRequiredFiles("storyboard") : []),
    ...inferRequiredFilesFromGoal(goal, input.capabilitySlug),
  ];
  if (
    input.completionMode === "report"
    && String(input.capabilitySlug ?? "").trim().toLowerCase() === "ala-strategy-advisor"
  ) {
    const explicitBasenames = extractExplicitBasenames(goal);
    requiredFiles.push(...(explicitBasenames.length > 0 ? explicitBasenames : ["strategy-report.md"]));
  }
  const qualityChecks = inferQualityChecks(expectedKinds);
  const kindCounts = buildKindCounts(expectedKinds, minCount);
  const parsedMaxTurns = parseMaxTurnsHint(goal);
  // PD-SAAS-FORK workbench yield P1: profile-level maxTurnsHint when goal omits explicit budget
  const profileMaxTurns = resolveProfileMaxTurnsHint(profileId, input.capabilitySlug);
  const maxTurnsHint = parsedMaxTurns ?? profileMaxTurns;
  const completionAssertions = parseCompletionAssertions(goal);
  const previous = input.previousContract;

  return {
    goalVersion: previous ? previous.goalVersion + 1 : 1,
    sourceGoal: goal,
    expectedKinds,
    requiredFiles,
    minCount,
    ...(kindCounts ? { kindCounts } : {}),
    qualityChecks,
    capabilitySlug: input.capabilitySlug,
    profileId,
    ...(maxTurnsHint != null ? { maxTurnsHint } : {}),
    ...(completionAssertions.length > 0 ? { completionAssertions } : {}),
    ...(previous
      ? {
        supersedes: {
          goalVersion: previous.goalVersion,
          expectedKinds: previous.expectedKinds,
          requiredFiles: previous.requiredFiles,
          minCount: previous.minCount,
        },
      }
      : {}),
  };
}

function inferExpectedKinds(goal: string, input: BuildTaskGoalContractInput): AcceptanceArtifactKind[] {
  const legacy = inferExpectedKindsLegacy(goal, input);
  const mode = isKindMentionSanitizeMode();
  if (mode === "off") return legacy;

  const sanitized = sanitizeGoalForKindInference(goal);
  const next = inferExpectedKindsLegacy(sanitized, input);
  const gated = gateOfficeKindsByImperative(next, sanitized, input.capabilitySlug);
  if (serializeArtifactKinds(legacy) !== serializeArtifactKinds(gated)) {
    recordStabilityEvent({
      event: "kind_mention_sanitize_diff",
      detail: {
        mode,
        from: serializeArtifactKinds(legacy),
        to: serializeArtifactKinds(gated),
      },
    });
  }
  if (mode === "shadow") return legacy;
  return gated;
}

function inferExpectedKindsLegacy(goal: string, input: BuildTaskGoalContractInput): AcceptanceArtifactKind[] {
  if (isBrandGeoFullCaseGoal(goal, input)) {
    return [];
  }
  if (isNovaImageSlideDeckGoal(goal, input.capabilitySlug)) {
    return [];
  }
  if (isCodeScriptGoal(goal)) {
    return [];
  }
  if (isScriptDraftGoal(goal) && !isVideoMp4FilmGoal(goal)) {
    return ["markdown"];
  }
  if (isVideoTemplateGoal(goal, input.capabilitySlug) && !explicitlyRequestsRenderedVideo(goal)) {
    if (isVideoApiReady() && isVideoMp4FilmGoal(goal)) {
      return ["video"];
    }
    return [];
  }
  const explicitKinds = inferExplicitOutputKinds(goal, input.capabilitySlug);
  if (explicitKinds.length > 0) {
    return explicitKinds;
  }
  if (isVideoMp4FilmGoal(goal) || /(?:渲染成|render_html_video|HTML\s*代码做视频)/i.test(goal)) {
    return ["video"];
  }
  const negatesPpt = /(?:不要|不用|不需要|改成|换成).{0,12}(?:PPT|ppt|pptx|幻灯)/.test(goal)
    || /(?:不要|不用|不需要).{0,12}(?:PPT|ppt|pptx|幻灯)/.test(goal);
  // PD-SAAS-FORK: 不再因泛词「文档/报告」强推 docx。多数「报告 / 线索表格报告 / 调研报告」
  // 类任务交 .md/.html/.pdf 即满足用户诉求；硬性要求 docx 会让验收永远缺 docx、引擎反复
  // 续跑去补一个用户没要的 Word 文件，造成死循环与垃圾重复成果。明确的 docx/word 信号已由
  // inferExplicitOutputKinds 捕获并作为并列 required kind 返回，无需在此用泛词兜底。
  if (!negatesPpt && (/(?:pptx|PPTX|ppt|PPT|幻灯|演示文稿|演示PPT)/.test(goal) || /ppt/i.test(input.capabilitySlug ?? ""))) {
    return ["pptx"];
  }
  if (/(?:pdf|PDF)/.test(goal)) {
    return ["pdf"];
  }
  if (/(?:html|HTML|网页|落地页|官网|页面)/.test(goal)) {
    return ["html"];
  }
  if (/(?:md|markdown|简报|调研|调查(?:报告)?|研究报告|行业报告)/i.test(goal)) {
    return ["markdown"];
  }
  return [];
}

function inferExplicitOutputKinds(goal: string, capabilitySlug: string | undefined): AcceptanceArtifactKind[] {
  const text = `${goal}\n${capabilitySlug ?? ""}`;
  const kinds: AcceptanceArtifactKind[] = [];
  const wantsVideo = isVideoMp4FilmGoal(goal)
    || explicitlyRequestsRenderedVideo(goal)
    || (!isVideoTemplateGoal(goal, capabilitySlug)
      && !isScriptDraftGoal(goal)
      && /(?:成片|render_html_video|html-video|html\s*video)/i.test(text));
  const wantsMarkdown = /(?:写|生成|输出|制作|创建|保存|存).{0,40}(?:结构化)?(?:大纲|brief|创意锚点|分镜脚本|视频脚本|口播脚本|脚本方案|调研报告|研究报告|市场报告|行业报告|对标报告)|markdown|Markdown/i.test(goal)
    || (isScriptDraftGoal(goal) && !isVideoMp4FilmGoal(goal));
  if (wantsMarkdown) kinds.push("markdown");
  if (wantsVideo) kinds.push("video");
  const htmlAsFinalDeliverable = /(?:网页|页面|落地页|官网|演示页|展示页|互动网页|3D网页|HTML\s*(?:文件|页面|网页|版本|版|报告)?|\bhtml\b)/i.test(text)
    && !(wantsVideo && /HTML\s*代码做视频/i.test(text) && !/(?:网页|页面|演示页|展示页|互动网页|3D网页)/i.test(goal));
  if (htmlAsFinalDeliverable) kinds.push("html");
  if (/(?:docx|word|Word)/i.test(text)) kinds.push("docx");
  if (/(?:pdf|PDF)/.test(text)) kinds.push("pdf");
  if (/(?:pptx|PPTX|ppt|PPT|幻灯|演示文稿|演示PPT)/.test(text) && !/(?:不要|不用|不需要|改成|换成).{0,12}(?:PPT|ppt|pptx|幻灯)/.test(text)) {
    kinds.push("pptx");
  }
  return kinds;
}

function isVideoTemplateGoal(goal: string, capabilitySlug: string | undefined): boolean {
  return /(?:remotion-video-template|video-template)/i.test(String(capabilitySlug ?? ""))
    || /(?:程序化视频模板|视频模板|批量渲染模板|React\s*程序化视频)/i.test(goal);
}

function explicitlyRequestsRenderedVideo(goal: string): boolean {
  return /(?:mp4|MP4|成片|渲染成|导出.{0,12}视频|生成.{0,12}视频文件|render_html_video|html-video|html\s*video)/i.test(goal);
}

function isNovaImageSlideDeckGoal(goal: string, capabilitySlug: string | undefined): boolean {
  return /nova-ppt-aesthetic-slides/i.test(String(capabilitySlug ?? ""))
    || /(?:Nova-?美学幻灯|PNG\s*幻灯|配图\s*PNG|slide-manifest\.json)/i.test(goal);
}

function isBrandGeoFullCaseGoal(goal: string, input: BuildTaskGoalContractInput): boolean {
  const profileOrSlug = `${input.profileId ?? ""}\n${input.capabilitySlug ?? ""}`;
  return /(?:^|\n)geo\b|pd-geo|geo-aeo|geo-content/i.test(profileOrSlug)
    && /(?:GEO|AEO|geo|aeo|引用评分|visibility-report|schema\.jsonld|optimized\.md)/i.test(goal)
    && /(?:全案|按阶段|至少\s*3\s*个平台|平台成稿|知乎|小红书|微信)/i.test(goal);
}

function inferProfileId(capabilitySlug: string | undefined, goal: string): string | undefined {
  const slug = String(capabilitySlug ?? "").trim().toLowerCase();
  if (isScriptDraftGoal(goal) && !isVideoMp4FilmGoal(goal) && !/create-vid-storyboard|storyboard-pack/.test(slug)) {
    return "script-md";
  }
  if (slug === "hf-slideshow") return "hyperframes-slideshow";
  if (isHyperframesVideoSlug(slug)) return "hyperframes";
  // PD-SAAS-FORK: viral-article-generator 禁回落 matrix/flywheel。
  if (slug === "viral-article-generator") return "viral_article_pack";
  // PD-SAAS-FORK ES9: saas-growth-full numbered checklist must not infer geo profile.
  if (/saas-growth-full|mkt-growth/.test(slug)) return undefined;
  if (/增长全案|SaaS\s*增长全案/.test(goal) && /market-research\.md/.test(goal)) return undefined;
  if (/nova-ppt-aesthetic/i.test(slug)) return "nova-slide-deck";
  if (/storyboard|分镜|seedance|即梦/i.test(`${slug}\n${goal}`)) return "storyboard";
  if (
    slug === "geo-serp-analysis"
    || slug === "geo-keyword-research"
    || slug === "geo-competitor-analysis"
    || slug === "mkt-ai-seo"
  ) {
    return undefined;
  }
  if (/^pd-geo|^geo-aeo|^geo-content-optimizer/.test(slug)) return "geo";
  if (/geo|aeo|引用评分|visibility/i.test(`${slug}\n${goal}`) && !/^geo-(serp|keyword|competitor)/.test(slug)) {
    if (isOpenIndustryGeoResearchGoal(goal)) return undefined;
    return "geo";
  }
  return undefined;
}

function extractDeliverableClauseSection(goal: string): string {
  const text = String(goal ?? "");
  const match = text.match(/(?:须交付：|标准成果清单：)([\s\S]*)/i);
  return match?.[1]?.trim() ?? text;
}

function isMatrixOrHumanizeDeliverableGoal(goal: string): boolean {
  const text = String(goal ?? "").trim();
  if (!text) return false;
  return detectContentMatrixTurn(text)
    || /(?:humanize|五平台|master\.md)/i.test(text);
}

function inferRequiredFilesFromGoal(goal: string, capabilitySlug?: string): string[] {
  const required = new Set<string>();
  if (/\bmp4\b|MP4/.test(goal)) {
    required.add("*.mp4");
  }
  // PD-SAAS-FORK: P0-1 enforce makes last30days lightweight. The legacy
  // three-file contract remains available when the rollout switch is off,
  // and under enforce only applies to explicit content-flywheel requests.
  const legacyLast30days = /last30days/i.test(goal)
    && !isCapabilityScopeV2EnforcedForSlug(capabilitySlug);
  if (legacyLast30days || /(?:content[-\s]?flywheel|内容飞轮)/i.test(goal)) {
    required.add("01-topics.md");
    required.add("02-longform.md");
    required.add("03-social-slices.md");
  } else if (!isMatrixOrHumanizeDeliverableGoal(goal)) {
    const clauseSection = extractDeliverableClauseSection(goal);
    for (const basename of ["01-topics.md", "02-longform.md", "03-social-slices.md"]) {
      if (clauseSection.toLowerCase().includes(basename.toLowerCase())) required.add(basename);
    }
  }
  return [...required];
}

function extractExplicitBasenames(goal: string): string[] {
  const text = String(goal ?? "").trim();
  const basenameOnly = text.match(
    /^(?:[\w\u3400-\u9fff.-]+[\\/])*([\w\u3400-\u9fff-]+\.(?:md|html?|pdf|docx?|pptx?|xlsx?))$/i,
  );
  if (basenameOnly?.[1]) return [basenameOnly[1]];
  const matches = text.matchAll(
    /(?:须交付|生成|输出|产出|导出|交付|保存(?:为)?|写(?:入|成)?|命名(?:为)?|文件名(?:为)?|deliver|save\s+as|write(?:\s+to)?)[^。\n]{0,50}?(?:[\w\u3400-\u9fff.-]+[\\/])*([\w\u3400-\u9fff-]+\.(?:md|html?|pdf|docx?|pptx?|xlsx?))(?=$|[\s，,。；;：:）)\]】」』"'`])/gi,
  );
  return [...new Set(
    [...matches]
      .filter((match) => !/(?:参考|读取|附件|基于|\bfrom\b|\binput\b)/i.test(match[0]))
      .map((match) => match[1])
      .filter((value): value is string => Boolean(value)),
  )];
}

function shouldRequireStoryboardPack(goal: string, profileId: string | undefined): boolean {
  return profileId === "storyboard"
    && /(?:连续性分镜包|continuity\s*分镜|分镜包|bible|镜头卡|交接矩阵|handoff)/i.test(goal);
}

/** PD-SAAS-FORK workbench yield P1: heavier deliverable profiles get a higher turn ceiling. */
const PROFILE_MAX_TURNS_HINT: Record<string, number> = {
  campaign: 40,
  geo: 36,
  "one-article-matrix": 28,
  "nova-slide-deck": 32,
  research: 24,
  "content_flywheel": 28,
  "social_matrix": 24,
};

const HEAVY_CAPABILITY_MAX_TURNS: Array<{ test: RegExp; turns: number }> = [
  { test: /^hf-/i, turns: 30 },
  { test: /nova-ppt-aesthetic|nova-bento/i, turns: 32 },
  { test: /social-creative-matrix|brand-campaign/i, turns: 28 },
];

export function resolveProfileMaxTurnsHint(
  profileId: string | undefined,
  capabilitySlug?: string,
): number | undefined {
  if (profileId && PROFILE_MAX_TURNS_HINT[profileId] != null) {
    return PROFILE_MAX_TURNS_HINT[profileId];
  }
  const slug = String(capabilitySlug ?? "").trim();
  for (const entry of HEAVY_CAPABILITY_MAX_TURNS) {
    if (entry.test.test(slug)) return entry.turns;
  }
  return undefined;
}

/** PD-SAAS-FORK: conservative parse of user-stated turn budget from natural language. */
export function parseMaxTurnsHint(goal: string): number | undefined {
  const text = String(goal ?? "").trim();
  if (!text) return undefined;
  for (const pattern of MAX_TURNS_HINT_PATTERNS) {
    const match = pattern.exec(text);
    if (!match?.[1]) continue;
    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isFinite(parsed) || parsed < 1) continue;
    return Math.min(parsed, MAX_TURNS_HINT_CEILING);
  }
  return undefined;
}

/** PD-SAAS-FORK: extract explicit completion assertions from labeled lines in the goal. */
export function parseCompletionAssertions(goal: string): string[] {
  const text = String(goal ?? "").trim();
  if (!text) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(COMPLETION_ASSERTION_LINE)) {
    const line = String(match[1] ?? "").trim().slice(0, COMPLETION_ASSERTION_MAX_LEN);
    if (!line || seen.has(line)) continue;
    seen.add(line);
    out.push(line);
    if (out.length >= COMPLETION_ASSERTION_MAX) break;
  }
  return out;
}

function inferQualityChecks(kinds: AcceptanceArtifactKind[]): TaskGoalQualityCheck[] {
  const checks = new Set<TaskGoalQualityCheck>(["exists", "non_empty"]);
  if (kinds.some((kind) => kind === "pptx" || kind === "docx" || kind === "pdf" || kind === "image" || kind === "video")) {
    checks.add("valid_binary");
  }
  if (kinds.includes("html")) checks.add("formal_html");
  if (kinds.includes("markdown")) checks.add("not_placeholder");
  return [...checks];
}
