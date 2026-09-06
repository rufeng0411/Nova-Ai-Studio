// PD-SAAS-FORK P0-9: exact capability bindings for SessionGoalQualityContract.

import type { GoalQualityPolicyInput } from "./goalQualityContract.js";
import {
  extractCanonicalSubject,
} from "../research/subjectGroundingPolicy.js";
import {
  productResearchTierSpec,
  resolveProductResearchTier,
} from "../research/productResearchQualityPolicy.js";

function extractSlidePageCount(userGoal: string): number | undefined {
  let found: number | undefined;
  for (const match of String(userGoal ?? "").matchAll(/(\d{1,3})\s*(?:页|张|个|slides?|pages?)/giu)) {
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0) found = value;
  }
  return found;
}

export function resolveExactCapabilityGoalQualityPolicy(input: {
  capabilitySlug?: string | null;
  userGoal: string;
  launchContext?: string | Record<string, unknown> | null;
}): GoalQualityPolicyInput | null {
  const slug = String(input.capabilitySlug ?? "").trim().toLowerCase();
  const subject = extractCanonicalSubject({
    userGoal: input.userGoal,
    launchContext: input.launchContext,
  });

  if (slug === "nova-ppt-aesthetic-slides") {
    const exactPages = extractSlidePageCount(input.userGoal);
    return {
      ...(subject?.subject ? { subjectAnchor: subject.subject } : {}),
      ...(subject?.aliases.length ? { subjectAliases: subject.aliases } : {}),
      ...(exactPages
        ? { exactQuantityAssertions: [{ unit: "page", exact: exactPages }] }
        : {}),
      officialMediaPolicy: "official_only",
      forbidGenerateImage: true,
      allowPlaceholders: false,
      toolPolicy: {
        deny: ["generate_image"],
      },
    };
  }

  if (slug === "df-image-generation") {
    return {
      ...(subject?.subject ? { subjectAnchor: subject.subject } : {}),
      ...(subject?.aliases.length ? { subjectAliases: subject.aliases } : {}),
      officialMediaPolicy: /官图|官方(?:渠道|素材|图片)|官网/iu.test(input.userGoal)
        ? "official_preferred"
        : "none",
      allowPlaceholders: false,
      toolPolicy: {
        allow: ["generate_image", "resolve_session_visual_assets"],
      },
    };
  }

  if (slug === "html-ppt" || slug === "html-ppt-skill") {
    const exactPages = extractSlidePageCount(input.userGoal);
    return {
      ...(subject?.subject ? { subjectAnchor: subject.subject } : {}),
      ...(exactPages
        ? { exactQuantityAssertions: [{ unit: "page", exact: exactPages }] }
        : {}),
      officialMediaPolicy: /官图|官方|官网/iu.test(input.userGoal)
        ? "official_only"
        : "official_preferred",
      forbidGenerateImage: /官图|官方|官网/iu.test(input.userGoal),
      allowPlaceholders: false,
    };
  }

  if (slug === "nova-research-product-user") {
    const tier = resolveProductResearchTier({
      userGoal: input.userGoal,
      launchContext: input.launchContext,
    });
    const spec = productResearchTierSpec(tier);
    return {
      ...(subject?.subject ? { subjectAnchor: subject.subject } : {}),
      ...(subject?.aliases.length ? { subjectAliases: subject.aliases } : {}),
      exactQuantityAssertions: [{
        unit: "chapter",
        exact: spec.chapterCount,
      }],
      officialMediaPolicy: "none",
      allowPlaceholders: false,
      forbidGenerateImage: false,
    };
  }

  if (slug === "mkt-last30days" || slug === "ala-strategy-advisor") {
    return subject?.subject
      ? {
          subjectAnchor: subject.subject,
          subjectAliases: subject.aliases,
        }
      : null;
  }

  return null;
}
