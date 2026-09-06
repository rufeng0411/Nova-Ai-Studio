// PD-SAAS-FORK: workbench yield — shared deliverable brief contract (Hub try + SDM compile).
// Synthetic「须交付」is compile/model-side only; never rewrite user bubble or sessionGoalAnchor.

import { isContinuationOnlyUserText } from "../../agent/errors/userFacingErrors.js";
import { isPureGreetingUserText } from "../intent/resolveCurrentIntent.js";
import {
  deliverableBriefContractMode,
  type StabilityTriStateMode,
} from "../resilience/stabilityFlags.js";
import { recordStabilityEvent } from "../../telemetry/stabilityEvents.js";
import { parseMustDeliverClause } from "./deliverableChecklistAuthority.js";

export type BriefContractConfidence = "high" | "medium" | "low" | "none";

export type DeliverableBriefContractSlot = {
  pathHint: string;
  pathHints: string[];
  label: string;
};

export type DeliverableBriefContract = {
  confidence: BriefContractConfidence;
  /** e.g. "须交付：index.html。" — for compileGoal / model append only */
  mustDeliverText?: string;
  bans: string[];
  slots: DeliverableBriefContractSlot[];
  capabilitySlugHint?: string;
  reason: string;
  /** True when user text already contains 须交付 — never synthesize over it */
  userMustDeliverPresent: boolean;
};

/** P0 whitelist: showcase-overlap + high-traffic Hub slugs (keep small; R6). */
export const BRIEF_CONTRACT_SLUG_DELIVERABLES: Record<string, string[]> = {
  "od-saas-landing": ["index.html"],
  "od-mobile-app": ["index.html", "screen-1.html", "screen-2.html", "screen-3.html"],
  "od-data-report": ["report.html", "index.html"],
  "od-image-gen": ["01-cover.png", "02-poster.png"],
  "od-social-carousel": ["kv-portrait.png", "card-1x1.png", "card-16x9.png", "card-9x16.png"],
  "od-poster-hero": ["index.html", "hero.png"],
  "open-design": ["index.html"],
  "nova-ppt-aesthetic-slides": ["slide-01.png", "slide-manifest.json"],
  "nova-bento-slides": ["deck.bento.html"],
  "anth-pptx": ["presentation.pptx"],
  "html-ppt": ["index.html"],
  "social-creative-matrix": [
    "brief.md",
    "creative-anchors.md",
    "copywriting.md",
    "manifest.json",
  ],
  "geo-keyword-research": ["keywords.md"],
  "geo-competitor-analysis": ["geo-competitor-report.md", "competitor-visibility.md"],
  "geo-serp-analysis": ["serp-analysis.md"],
  "mkt-ai-seo": ["audit-checklist.md", "competitor-visibility.md"],
  "hf-website-to-video": ["promo.mp4"],
  "hf-product-launch-video": ["promo.mp4"],
  "hf-hyperframes": ["promo.mp4"],
  "nova-research-industry-market": ["industry-market-report.md"],
  "nova-research-competitor": ["competitor-benchmark-report.md"],
  "one-article-matrix": ["01-topics.md", "02-longform.md", "03-social-slices.md"],
};

const SLUG_BANS: Record<string, string[]> = {
  "od-saas-landing": [
    "禁止首轮 CSS 渐变冒充 Hero",
    "禁止 placeholder.svg / generate_image 冒充官图",
    "禁止 artifacts/design/ 非 STDA 目录",
  ],
  "od-mobile-app": ["禁止 read_file skills/", "禁止在对话贴整页 html"],
  "nova-ppt-aesthetic-slides": [
    "禁止 HTML 幻灯或项目根 index.html 替代 PNG 包",
    "禁止 generate_image 冒充产品官图",
  ],
  "nova-bento-slides": [
    "禁止静态 HTML/CSS 冒充 *.bento.html",
    "禁止 index.html / pptx / PNG 包替代终态",
  ],
  "anth-pptx": [
    "禁止 presentation.html / 空壳 presentation.pptx 充数",
    "禁止白板无风格幻灯",
  ],
  "social-creative-matrix": ["禁止 content_flywheel 幻影三槽扩写"],
  "hf-website-to-video": ["禁止 generate_video 冒充 HyperFrames 成片", "禁止 HTML 录屏假视频"],
  "hf-product-launch-video": ["禁止 generate_video 冒充 HyperFrames 成片"],
  "hf-hyperframes": ["禁止 generate_video 冒充 render_hyperframes"],
};

const TEMPLATE_NAME_TO_SLUG: Array<{ pattern: RegExp; slug: string }> = [
  { pattern: /一稿多平台|一稿五平台|one-article-matrix/i, slug: "one-article-matrix" },
  { pattern: /社媒创意矩阵|social-creative-matrix/i, slug: "social-creative-matrix" },
  { pattern: /官网落地页|获客官网|od-saas-landing/i, slug: "od-saas-landing" },
  { pattern: /手机封面|手机界面示意|od-mobile-app/i, slug: "od-mobile-app" },
  { pattern: /数据报告页|od-data-report/i, slug: "od-data-report" },
  { pattern: /Nova可编辑演示稿|nova-bento-slides|Bento\s*演示/i, slug: "nova-bento-slides" },
  { pattern: /Nova美学幻灯|nova-ppt-aesthetic|美学幻灯/i, slug: "nova-ppt-aesthetic-slides" },
  { pattern: /\banth-pptx\b|PPT幻灯|可编辑\s*\.pptx/i, slug: "anth-pptx" },
  { pattern: /HyperFrames|hf-website-to-video|hf-product-launch|render_hyperframes/i, slug: "hf-hyperframes" },
];

const TASK_RESUME_MARK = /<task-resume[\s>]/i;
const MAX_MUST_DELIVER_CHARS = 280;

export function userGoalHasMustDeliver(userGoal: string): boolean {
  return /须交付\s*[:：]/.test(String(userGoal ?? ""));
}

export function shouldSkipBriefContractSynthesis(userGoal: string): boolean {
  const text = String(userGoal ?? "").trim();
  if (!text) return true;
  if (TASK_RESUME_MARK.test(text)) return true;
  if (isPureGreetingUserText(text)) return true;
  if (isContinuationOnlyUserText(text)) return true;
  return false;
}

function slotsFromBasenames(basenames: string[]): DeliverableBriefContractSlot[] {
  return basenames.map((name) => ({
    pathHint: name,
    pathHints: [name],
    label: name,
  }));
}

function buildMustDeliverText(basenames: string[]): string {
  const joined = basenames.join("、");
  const text = `须交付：${joined}。`;
  if (text.length <= MAX_MUST_DELIVER_CHARS) return text;
  const truncated = basenames.slice(0, 6).join("、");
  return `须交付：${truncated}。`;
}

function resolveSlugHint(
  userGoal: string,
  capabilitySlug?: string,
): { slug?: string; confidence: BriefContractConfidence; reason: string } {
  const slug = String(capabilitySlug ?? "").trim();
  if (slug && BRIEF_CONTRACT_SLUG_DELIVERABLES[slug]) {
    return { slug, confidence: "high", reason: "capability_slug" };
  }
  for (const entry of TEMPLATE_NAME_TO_SLUG) {
    if (entry.pattern.test(userGoal)) {
      if (BRIEF_CONTRACT_SLUG_DELIVERABLES[entry.slug]) {
        return { slug: entry.slug, confidence: "high", reason: "whitelist_pattern" };
      }
    }
  }
  // Explicit basename list without Hub (still high if 须交付 already present — handled elsewhere)
  if (/\bindex\.html\b/i.test(userGoal) && /官网|落地页|landing/i.test(userGoal)) {
    return { slug: "od-saas-landing", confidence: "high", reason: "landing_basename" };
  }
  return { confidence: "none", reason: "no_match" };
}

/**
 * Compile a brief contract from user goal + optional Hub slug.
 * Does not mutate the goal; callers overlay mustDeliverText onto compileGoal only.
 */
export function compileDeliverableBriefContract(input: {
  userGoal: string;
  capabilitySlug?: string;
  majorCategory?: string;
}): DeliverableBriefContract {
  void input.majorCategory;
  const userGoal = String(input.userGoal ?? "").trim();
  const userMustDeliverPresent = userGoalHasMustDeliver(userGoal);

  if (!userGoal || shouldSkipBriefContractSynthesis(userGoal)) {
    return {
      confidence: "none",
      bans: [],
      slots: [],
      reason: "skip_greeting_continue_or_resume",
      userMustDeliverPresent,
    };
  }

  if (userMustDeliverPresent) {
    const parsed = parseMustDeliverClause(userGoal);
    return {
      confidence: "high",
      bans: [],
      slots: parsed.map((slot) => ({
        pathHint: slot.pathHint ?? slot.label,
        pathHints: slot.pathHints ?? (slot.pathHint ? [slot.pathHint] : [slot.label]),
        label: slot.label,
      })),
      capabilitySlugHint: input.capabilitySlug?.trim() || undefined,
      reason: "user_must_deliver",
      userMustDeliverPresent: true,
      mustDeliverText: undefined,
    };
  }

  const hint = resolveSlugHint(userGoal, input.capabilitySlug);
  if (!hint.slug || hint.confidence === "none") {
    return {
      confidence: "none",
      bans: [],
      slots: [],
      reason: hint.reason,
      userMustDeliverPresent: false,
    };
  }

  const basenames = BRIEF_CONTRACT_SLUG_DELIVERABLES[hint.slug] ?? [];
  if (basenames.length === 0) {
    return {
      confidence: "none",
      bans: [],
      slots: [],
      reason: "empty_slug_map",
      userMustDeliverPresent: false,
    };
  }

  // GEO lite / single-file: keep slot count small (anti R1 inflation)
  const slots = slotsFromBasenames(basenames);
  return {
    confidence: hint.confidence,
    mustDeliverText: buildMustDeliverText(basenames),
    bans: SLUG_BANS[hint.slug] ?? [],
    slots,
    capabilitySlugHint: hint.slug,
    reason: hint.reason,
    userMustDeliverPresent: false,
  };
}

export function resolveEffectiveCompileGoal(input: {
  userAnchor: string;
  capabilitySlug?: string;
  majorCategory?: string;
  mode?: StabilityTriStateMode;
}): {
  compileGoal: string;
  contract: DeliverableBriefContract;
  applied: boolean;
  mode: StabilityTriStateMode;
} {
  const mode = input.mode ?? deliverableBriefContractMode();
  const anchor = String(input.userAnchor ?? "").trim();
  const contract = compileDeliverableBriefContract({
    userGoal: anchor,
    capabilitySlug: input.capabilitySlug,
    majorCategory: input.majorCategory,
  });

  if (mode === "off") {
    return { compileGoal: anchor, contract, applied: false, mode };
  }

  const canSynthesize =
    !contract.userMustDeliverPresent
    && contract.confidence === "high"
    && Boolean(contract.mustDeliverText);

  if (mode === "shadow") {
    return { compileGoal: anchor, contract, applied: false, mode };
  }

  // enforce
  if (!canSynthesize || !contract.mustDeliverText) {
    return { compileGoal: anchor, contract, applied: false, mode };
  }

  return {
    compileGoal: `${anchor}\n${contract.mustDeliverText}`,
    contract,
    applied: true,
    mode,
  };
}

export function buildBriefContractAppendPrompt(contract: DeliverableBriefContract): string | undefined {
  if (contract.confidence === "none") return undefined;
  if (contract.userMustDeliverPresent && !contract.mustDeliverText) {
    // User already stated must-deliver; still surface bans if any
    if (contract.bans.length === 0) return undefined;
  }
  const lines: string[] = ["<deliverable-brief-contract>"];
  if (contract.capabilitySlugHint) {
    lines.push(`能力提示：${contract.capabilitySlugHint}`);
  }
  if (contract.mustDeliverText) {
    lines.push(contract.mustDeliverText);
  }
  if (contract.slots.length > 0) {
    lines.push(`槽位 basename：${contract.slots.map((s) => s.pathHint).join("、")}`);
  }
  lines.push("全部写入系统分配任务目录（artifacts/task-*）。");
  for (const ban of contract.bans.slice(0, 4)) {
    lines.push(ban);
  }
  lines.push("</deliverable-brief-contract>");
  return lines.join("");
}

export function recordBriefContractTelemetry(input: {
  sessionId?: string;
  turnId?: string;
  contract: DeliverableBriefContract;
  mode: StabilityTriStateMode;
  applied: boolean;
  slotCount?: number;
}): void {
  if (input.mode === "off") return;
  if (input.contract.confidence === "none" && input.contract.reason === "skip_greeting_continue_or_resume") {
    return;
  }
  try {
    recordStabilityEvent({
      event: "brief_contract_compiled",
      sessionId: input.sessionId,
      turnId: input.turnId,
      reason: input.contract.reason,
      detail: {
        mode: input.mode,
        applied: input.applied,
        confidence: input.contract.confidence,
        slug: input.contract.capabilitySlugHint ?? "none",
        slotCount: input.slotCount
          ?? input.contract.slots.length,
        userMustDeliver: input.contract.userMustDeliverPresent,
      },
    });
  } catch {
    // best-effort
  }
}
