// PD-SAAS-FORK: workbench yield — high-confidence capabilityContext inference (free text).
// Hub bindings (source: hub) are never overridden. Fail-open on low confidence.

import { isContinuationOnlyUserText } from "../../agent/errors/userFacingErrors.js";
import { isPureGreetingUserText } from "../intent/resolveCurrentIntent.js";
import {
  inferCapabilityContextMode,
  type StabilityTriStateMode,
} from "../resilience/stabilityFlags.js";
import { recordStabilityEvent } from "../../telemetry/stabilityEvents.js";
import { BRIEF_CONTRACT_SLUG_DELIVERABLES } from "./deliverableBriefContract.js";

export type CapabilityBindingSource = "hub" | "inferred";

export type InferredCapabilityContext = {
  slug: string;
  displayName: string;
  majorCategory?: string;
  source: "inferred";
  confidence: "high";
};

type InferPattern = {
  pattern: RegExp;
  slug: string;
  displayName: string;
  majorCategory?: string;
};

/** Only whitelist high-confidence patterns (R3). */
const HIGH_CONFIDENCE_PATTERNS: InferPattern[] = [
  {
    pattern: /(?:使用能力|选用技能|skill)\s*[「"']?官网落地页|od-saas-landing|获客官网单页|官网落地页/i,
    slug: "od-saas-landing",
    displayName: "官网落地页",
    majorCategory: "creation",
  },
  {
    pattern: /od-mobile-app|手机界面示意|scaffold_mobile_mockup/i,
    slug: "od-mobile-app",
    displayName: "手机界面示意",
    majorCategory: "creation",
  },
  {
    pattern: /od-data-report|数据报告页/i,
    slug: "od-data-report",
    displayName: "数据报告页",
    majorCategory: "creation",
  },
  {
    pattern: /nova-bento-slides|Nova可编辑演示稿|Bento\s*演示稿/i,
    slug: "nova-bento-slides",
    displayName: "Nova可编辑演示稿",
    majorCategory: "office",
  },
  {
    pattern: /nova-ppt-aesthetic-slides|Nova美学幻灯|美学幻灯片/i,
    slug: "nova-ppt-aesthetic-slides",
    displayName: "Nova美学幻灯",
    majorCategory: "creation",
  },
  {
    pattern: /\banth-pptx\b|PPT幻灯/i,
    slug: "anth-pptx",
    displayName: "PPT幻灯",
    majorCategory: "office",
  },
  {
    pattern: /social-creative-matrix|社媒创意矩阵/i,
    slug: "social-creative-matrix",
    displayName: "社媒创意矩阵",
    majorCategory: "marketing",
  },
  {
    pattern: /geo-keyword-research|GEO\s*关键词研究|使用能力[「"']?GEO关键词/i,
    slug: "geo-keyword-research",
    displayName: "GEO关键词研究",
    majorCategory: "geo",
  },
  {
    pattern: /geo-competitor-analysis|GEO\s*竞品/i,
    slug: "geo-competitor-analysis",
    displayName: "GEO竞品分析",
    majorCategory: "geo",
  },
  {
    pattern: /hf-website-to-video|hf-product-launch-video|hf-hyperframes|render_hyperframes/i,
    slug: "hf-hyperframes",
    displayName: "HyperFrames",
    majorCategory: "creation",
  },
  {
    pattern: /须交付\s*[:：]\s*index\.html/i,
    slug: "od-saas-landing",
    displayName: "官网落地页",
    majorCategory: "creation",
  },
];

const TASK_RESUME_MARK = /<task-resume[\s>]/i;

export function shouldSkipCapabilityInference(userText: string): boolean {
  const text = String(userText ?? "").trim();
  if (!text) return true;
  if (TASK_RESUME_MARK.test(text)) return true;
  if (isPureGreetingUserText(text)) return true;
  if (isContinuationOnlyUserText(text)) return true;
  return false;
}

export function inferCapabilityContextFromUserText(
  userText: string,
): InferredCapabilityContext | null {
  if (shouldSkipCapabilityInference(userText)) return null;
  const text = String(userText ?? "").trim();

  for (const entry of HIGH_CONFIDENCE_PATTERNS) {
    if (!entry.pattern.test(text)) continue;
    if (!BRIEF_CONTRACT_SLUG_DELIVERABLES[entry.slug]) continue;
    return {
      slug: entry.slug,
      displayName: entry.displayName,
      ...(entry.majorCategory ? { majorCategory: entry.majorCategory } : {}),
      source: "inferred",
      confidence: "high",
    };
  }
  return null;
}

export function resolveInferredCapabilityForTurn(input: {
  userText: string;
  existingSlug?: string;
  existingSource?: CapabilityBindingSource | string;
  mode?: StabilityTriStateMode;
}): {
  inferred: InferredCapabilityContext | null;
  apply: boolean;
  mode: StabilityTriStateMode;
} {
  const mode = input.mode ?? inferCapabilityContextMode();
  const inferred = inferCapabilityContextFromUserText(input.userText);

  if (mode === "off" || !inferred) {
    return { inferred, apply: false, mode };
  }

  // Hub binding (explicit source or legacy persist without source) never overridden
  if (input.existingSource === "hub") {
    return { inferred, apply: false, mode };
  }
  if (input.existingSlug?.trim() && input.existingSource !== "inferred") {
    return { inferred, apply: false, mode };
  }

  if (mode === "shadow") {
    return { inferred, apply: false, mode };
  }

  return { inferred, apply: true, mode };
}

export function recordCapabilityContextInferredTelemetry(input: {
  sessionId?: string;
  turnId?: string;
  inferred: InferredCapabilityContext | null;
  mode: StabilityTriStateMode;
  applied: boolean;
}): void {
  if (input.mode === "off" || !input.inferred) return;
  try {
    recordStabilityEvent({
      event: "capability_context_inferred",
      sessionId: input.sessionId,
      turnId: input.turnId,
      reason: input.inferred.slug,
      detail: {
        mode: input.mode,
        applied: input.applied,
        confidence: input.inferred.confidence,
        slug: input.inferred.slug,
      },
    });
  } catch {
    // best-effort
  }
}
