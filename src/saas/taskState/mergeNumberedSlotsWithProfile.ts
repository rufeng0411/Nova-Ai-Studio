// PD-SAAS-FORK: merge numbered SDM slots with profile pathHints (Tier-0 GEO/Campaign)
import mergeConfigJson from "../../../config/sdm-slot-profile-merge.json" with { type: "json" };
import {
  isOpenIndustryGeoResearchGoal,
  isTier0LockedProfileId,
  listDeliverableProfiles,
} from "../deliverableCapabilityProfiles.js";
import {
  isSaasGrowthFullGoal,
  shouldBindGeoProfileForDeliverableIntent,
} from "./deliverableIntent.js";
import type { SessionDeliverableSlot } from "./sessionDeliverableManifest.js";

type MergeConfig = {
  slotKeywords?: string[][];
  numberedPrefixAliases?: string[];
};

let cachedConfig: Record<string, MergeConfig> | null = null;

function loadMergeConfig(): Record<string, MergeConfig> {
  if (cachedConfig) return cachedConfig;
  cachedConfig = mergeConfigJson as Record<string, MergeConfig>;
  return cachedConfig;
}

function uniqueHints(hints: string[]): string[] {
  const out: string[] = [];
  for (const raw of hints) {
    const normalized = raw.trim();
    if (!normalized) continue;
    if (!out.some((h) => h.toLowerCase() === normalized.toLowerCase())) {
      out.push(normalized);
    }
  }
  return out;
}

function labelMatchesKeywords(label: string, keywords: string[]): boolean {
  const text = label.toLowerCase();
  return keywords.some((kw) => text.includes(kw.toLowerCase()));
}

function profileGroupsForId(profileId: string): string[][] {
  const profile = listDeliverableProfiles().find((entry) => entry.id === profileId);
  if (!profile) return [];
  if (profile.requiredBasenameGroups?.length) {
    return profile.requiredBasenameGroups;
  }
  return (profile.requiredBasenames ?? profile.requiredArtifacts ?? []).map((b) => [b]);
}

function platformDraftHints(profileId: string): string[] {
  if (profileId !== "geo") return [];
  const profile = listDeliverableProfiles().find((entry) => entry.id === profileId);
  return profile?.requiredPlatformDrafts?.basenames ?? [];
}

const OPTIONAL_LINE = /^\s*可选[：:]/;

export function parseOptionalSlotFromLabel(label: string): { label: string; required: boolean } {
  if (OPTIONAL_LINE.test(label)) {
    return {
      label: label.replace(OPTIONAL_LINE, "").trim(),
      required: false,
    };
  }
  if (/可选/.test(label) && /小红书|草稿|存稿/.test(label)) {
    return { label, required: false };
  }
  return { label, required: true };
}

export function mergeNumberedSlotsWithProfile(
  slots: SessionDeliverableSlot[],
  profileId: string | undefined,
  userGoal: string,
): SessionDeliverableSlot[] {
  if (!profileId || slots.length === 0) return slots;
  if (!isTier0LockedProfileId(profileId) && profileId !== "geo") {
    const config = loadMergeConfig();
    if (!config[profileId] && profileId !== "geo") return slots;
  }

  const groups = profileGroupsForId(profileId);
  const config = loadMergeConfig()[profileId] ?? loadMergeConfig().geo ?? {};
  const platformHints = platformDraftHints(profileId);

  return slots.map((slot, index) => {
    const optionalParsed = parseOptionalSlotFromLabel(slot.label);
    const hints: string[] = [];
    if (slot.pathHint) hints.push(slot.pathHint);
    if (slot.pathHints?.length) hints.push(...slot.pathHints);

    const group = groups[index];
    if (group?.length) hints.push(...group);

    const keywords = config.slotKeywords?.[index];
    if (keywords && labelMatchesKeywords(slot.label, keywords) && group?.length) {
      hints.push(...group);
    }

    const numberedAlias = config.numberedPrefixAliases?.[index];
    if (numberedAlias) hints.push(numberedAlias);

    if (
      profileId === "geo"
      && (slot.label.includes("平台") || slot.label.includes("成稿") || slot.label.includes("pd-geo"))
      && platformHints.length > 0
    ) {
      hints.push(...platformHints);
      return {
        ...slot,
        label: optionalParsed.label,
        required: optionalParsed.required,
        pathHints: uniqueHints(hints),
        pathHint: slot.pathHint ?? group?.[0] ?? hints[0],
        count: slot.count ?? 3,
      };
    }

    const mergedHints = uniqueHints(hints);
    return {
      ...slot,
      label: optionalParsed.label,
      required: optionalParsed.required,
      ...(mergedHints.length > 0
        ? {
          pathHints: mergedHints,
          pathHint: slot.pathHint ?? mergedHints[0],
        }
        : {}),
    };
  });
}

export function shouldBindGeoProfileForGoal(
  userGoal: string,
  capabilitySlug?: string,
): boolean {
  const slug = String(capabilitySlug ?? "").trim().toLowerCase();
  // PD-SAAS-FORK ES9: growth full-case wins over workflow pd-geo step text.
  if (isSaasGrowthFullGoal(userGoal, capabilitySlug)) return false;

  if (!shouldBindGeoProfileForDeliverableIntent(userGoal, capabilitySlug)) {
    if (slug === "pd-geo" || slug.startsWith("pd-geo-")) return true;
    if (slug.startsWith("geo-") && slug !== "geo-keyword-research") return true;
    return false;
  }
  if (slug.startsWith("pd-geo") || slug.startsWith("geo-aeo") || slug.startsWith("geo-content")) {
    return true;
  }
  if (
    slug === "geo-serp-analysis"
    || slug === "geo-keyword-research"
    || slug === "geo-competitor-analysis"
    || slug === "mkt-ai-seo"
  ) {
    return false;
  }
  const goal = userGoal.toLowerCase();
  if (/增长全案|付费投放|邮件培育|程序化\s*seo|saas-growth-full|market-research\.md/.test(goal)) {
    return false;
  }
  if (/geo\s*全案|geo-aeo|aeo-audit|品牌\s*geo/.test(goal)) return true;
  if (/read_skill\s+pd-geo|^pd-geo\b/.test(goal) && !/品牌\s*geo|geo\s*全案/.test(goal)) {
    return false;
  }
  if (isOpenIndustryGeoResearchGoal(userGoal)) return false;
  return false;
}
