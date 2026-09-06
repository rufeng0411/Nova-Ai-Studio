// PD-SAAS-FORK P0-9: product user research tier thresholds and structure checks.

import type { DeliverableQualityFailure } from "../final-acceptance/deliverableQualityChecks.js";
import type { ResearchSourceLedger } from "./researchSourceLedger.js";
import {
  summarizeResearchSources,
  validateChapterSourceCitations,
} from "./researchSourceLedger.js";

export type ProductResearchTier = "quick" | "standard" | "deep";

export type ProductResearchTierSpec = {
  tier: ProductResearchTier;
  chapterCount: number;
  includeAppendix: boolean;
  minTotalVisibleChars: number;
  minChapterVisibleChars: number;
  evidenceRequiredSections: string[];
  minDistinctSources: number;
  minSubjectSourceHits: number;
};

const FIXED_EIGHT_CHAPTER = /固定\s*八章|八段式|八章骨架/iu;
const EXPLICIT_DEEP = /\bdeep\b|深度版|详尽版/iu;
const EXPLICIT_QUICK = /\bquick\b|快速版|简版/iu;

export function resolveProductResearchTier(input: {
  userGoal: string;
  launchContext?: string | Record<string, unknown> | null;
}): ProductResearchTier {
  const text = [
    input.userGoal,
    typeof input.launchContext === "string"
      ? input.launchContext
      : input.launchContext
        ? JSON.stringify(input.launchContext)
        : "",
  ].join("\n");
  if (EXPLICIT_DEEP.test(text)) return "deep";
  if (EXPLICIT_QUICK.test(text)) return "quick";
  if (FIXED_EIGHT_CHAPTER.test(text)) return "standard";
  return "standard";
}

export function productResearchTierSpec(
  tier: ProductResearchTier,
): ProductResearchTierSpec {
  switch (tier) {
    case "quick":
      return {
        tier,
        chapterCount: 8,
        includeAppendix: false,
        minTotalVisibleChars: 2800,
        minChapterVisibleChars: 180,
        evidenceRequiredSections: [
          "用户画像",
          "使用场景",
          "痛点",
        ],
        minDistinctSources: 3,
        minSubjectSourceHits: 2,
      };
    case "deep":
      return {
        tier,
        chapterCount: 10,
        includeAppendix: true,
        minTotalVisibleChars: 7500,
        minChapterVisibleChars: 400,
        evidenceRequiredSections: [
          "用户画像",
          "使用场景",
          "痛点",
          "决策因素",
          "附录",
        ],
        minDistinctSources: 3,
        minSubjectSourceHits: 2,
      };
    case "standard":
    default:
      return {
        tier: "standard",
        chapterCount: 8,
        includeAppendix: false,
        minTotalVisibleChars: 4500,
        minChapterVisibleChars: 300,
        evidenceRequiredSections: [
          "用户画像",
          "使用场景",
          "痛点",
          "决策因素",
        ],
        minDistinctSources: 3,
        minSubjectSourceHits: 2,
      };
  }
}

function visibleCharCount(text: string): number {
  return Array.from(String(text ?? "").replace(/\s+/gu, "")).length;
}

function countMarkdownChapters(text: string): number {
  return Array.from(text.matchAll(/^\s*#{1,2}\s+\S+/gmu)).length;
}

function chapterBodies(text: string): string[] {
  const parts = text.split(/^\s*#{1,2}\s+/gmu).slice(1);
  return parts.map((part) => part.trim()).filter(Boolean);
}

function containsPlaceholder(text: string): boolean {
  return /(?:TODO|待补|示例内容|lorem ipsum)/iu.test(text);
}

function extractSectionCitations(text: string): Array<{ sectionId: string; sourceIds: readonly string[] }> {
  const sections: Array<{ sectionId: string; sourceIds: readonly string[] }> = [];
  const headingMatches = [...text.matchAll(/^\s*#{1,2}\s+(.+)$/gmu)];
  for (let index = 0; index < headingMatches.length; index += 1) {
    const match = headingMatches[index];
    const title = String(match?.[1] ?? "").trim();
    const start = (match?.index ?? 0) + (match?.[0]?.length ?? 0);
    const end = headingMatches[index + 1]?.index ?? text.length;
    const body = text.slice(start, end);
    const sourceIds = [...body.matchAll(/\[(?:来源|引用)\s*:\s*(src_[a-z0-9]+)\]/giu)]
      .map((entry) => entry[1] ?? "")
      .filter(Boolean);
    sections.push({ sectionId: title || `section-${index + 1}`, sourceIds });
  }
  return sections;
}

export function validateProductResearchContent(input: {
  text: string;
  tier: ProductResearchTier;
  ledger: ResearchSourceLedger;
  enforceSources?: boolean;
}): DeliverableQualityFailure[] {
  const spec = productResearchTierSpec(input.tier);
  const failures: DeliverableQualityFailure[] = [];
  const text = String(input.text ?? "");

  if (containsPlaceholder(text)) {
    failures.push({
      checkId: "content.product_research.placeholder",
      domain: "content",
      reason: "placeholder_content",
      repairable: true,
    });
  }

  const chapters = chapterBodies(text);
  const chapterCount = Math.max(countMarkdownChapters(text), chapters.length);
  if (chapterCount !== spec.chapterCount) {
    failures.push({
      checkId: "content.product_research.chapter_count",
      domain: "content",
      reason: "chapter_count_mismatch",
      repairable: true,
      expected: spec.chapterCount,
      actual: chapterCount,
    });
  }

  const totalVisible = visibleCharCount(text);
  if (totalVisible < spec.minTotalVisibleChars) {
    failures.push({
      checkId: "content.product_research.total_length",
      domain: "content",
      reason: "total_length_insufficient",
      repairable: true,
      expected: spec.minTotalVisibleChars,
      actual: totalVisible,
    });
  }

  for (const [index, chapter] of chapters.entries()) {
    const visible = visibleCharCount(chapter);
    if (visible < spec.minChapterVisibleChars) {
      failures.push({
        checkId: `content.product_research.chapter_${index + 1}_length`,
        domain: "content",
        reason: "chapter_length_insufficient",
        repairable: true,
        expected: spec.minChapterVisibleChars,
        actual: visible,
      });
    }
  }

  if (spec.includeAppendix && !/附录\s*A|appendix\s*a/iu.test(text)) {
    failures.push({
      checkId: "content.product_research.appendix",
      domain: "content",
      reason: "appendix_missing",
      repairable: true,
      expected: "appendix A",
    });
  }

  if (input.enforceSources !== false) {
    const summary = summarizeResearchSources(input.ledger);
    if (summary.acceptedCount < spec.minDistinctSources) {
      failures.push({
        checkId: "content.product_research.sources",
        domain: "content",
        reason: "insufficient_accepted_sources",
        repairable: true,
        expected: spec.minDistinctSources,
        actual: summary.acceptedCount,
      });
    }
    const citationFailures = validateChapterSourceCitations({
      ledger: input.ledger,
      sectionCitations: extractSectionCitations(text),
      minDistinctAccepted: spec.minDistinctSources,
      minSubjectHits: spec.minSubjectSourceHits,
    });
    for (const failure of citationFailures) {
      failures.push({
        checkId: `content.product_research.citation.${failure.sectionId}`,
        domain: "content",
        reason: failure.reason,
        repairable: true,
        ...(failure.sourceId ? { path: failure.sourceId } : {}),
      });
    }
  }

  return failures;
}

export function resolveExplicitDeliverableBasename(userGoal: string): string | undefined {
  const htmlMatch = userGoal.match(/product[-\w]*\.html/iu);
  if (htmlMatch?.[0]) return htmlMatch[0].toLowerCase();
  if (/product[-\w]*\.html/iu.test(userGoal)) {
    return userGoal.match(/product[-\w]*\.html/iu)?.[0]?.toLowerCase();
  }
  if (/\.html/iu.test(userGoal) && /product/iu.test(userGoal)) {
    return userGoal.match(/[\w-]+\.html/iu)?.[0]?.toLowerCase();
  }
  if (/product-user-research\.md/iu.test(userGoal)) {
    return "product-user-research.md";
  }
  return "product-user-research.md";
}
