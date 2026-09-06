// PD-SAAS-FORK P0-7: deterministic checks for the independent goal-quality contract.
import type {
  ExactQuantityAssertion,
  SessionGoalQualityContract,
} from "../constraints/goalQualityContract.js";
import type { AcceptanceCandidate } from "../deliverables/acceptanceChecks.js";
import type { CompositeSlotQualityAssessment } from "../deliverables/compositeSlotQuality.js";
import {
  detectQualityDefects,
} from "./qualityChecks.js";
import type { ProductResearchTier } from "../research/productResearchQualityPolicy.js";
import {
  validateProductResearchContent,
} from "../research/productResearchQualityPolicy.js";
import type { ResearchSourceLedger } from "../research/researchSourceLedger.js";
import {
  resolveProductResearchTier,
} from "../research/productResearchQualityPolicy.js";

export type DeliverableQualityCompletion =
  | "not_applicable"
  | "passed"
  | "needs_repair"
  | "degraded_acceptable"
  | "blocked";

export type DeliverableQualityFailureDomain =
  | "content"
  | "official_media"
  | "tool_policy"
  | "composite";

export type DeliverableQualityFailure = {
  checkId: string;
  domain: DeliverableQualityFailureDomain;
  reason: string;
  repairable: boolean;
  path?: string;
  slotId?: string;
  expected?: number | string;
  actual?: number | string;
};

export type DeliverableQualityCheckInput = {
  candidates: readonly AcceptanceCandidate[];
  contract?: SessionGoalQualityContract | null;
  compositeSlotQuality?: readonly CompositeSlotQualityAssessment[] | null;
  toolPolicyViolations?: readonly string[];
  productResearch?: {
    tier: ProductResearchTier;
    ledger: ResearchSourceLedger;
    enforceSources?: boolean;
  } | null;
};

const MAX_CHECK_TEXT_CHARS = 512 * 1024;

function normalizeText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, "").toLowerCase();
}

function candidateText(candidate: AcceptanceCandidate): string {
  return String(candidate.textPreview ?? "").slice(0, MAX_CHECK_TEXT_CHARS);
}

function combinedCandidateText(
  candidates: readonly AcceptanceCandidate[],
): string {
  return candidates
    .filter((candidate) => candidate.exists)
    .map(candidateText)
    .join("\n")
    .slice(0, MAX_CHECK_TEXT_CHARS);
}

function countMatches(text: string, pattern: RegExp): number {
  return Array.from(text.matchAll(pattern)).length;
}

function countJsonPages(text: string): number {
  try {
    const parsed = JSON.parse(text) as { pages?: unknown };
    return Array.isArray(parsed.pages) ? parsed.pages.length : 0;
  } catch {
    return 0;
  }
}

function measuredQuantityForCandidate(
  candidate: AcceptanceCandidate,
  assertion: ExactQuantityAssertion,
): number | null {
  if (assertion.unit === "second") {
    return Number.isFinite(candidate.durationSeconds)
      ? Math.max(0, Math.round(candidate.durationSeconds ?? 0))
      : null;
  }
  if (assertion.unit === "page" && Number.isSafeInteger(candidate.pageCount)) {
    return Math.max(0, candidate.pageCount ?? 0);
  }

  const text = candidateText(candidate);
  if (!text) return null;
  switch (assertion.unit) {
    case "page": {
      const structural = Math.max(
        countMatches(text, /<section\b/giu),
        countMatches(text, /\bdata-(?:slide|page)(?:-index)?\s*=/giu),
        countMatches(text, /<!--\s*(?:slide|page)(?:\s+\d+)?\s*-->/giu),
        countJsonPages(text),
      );
      return structural > 0 ? structural : null;
    }
    case "item": {
      const structural = Math.max(
        countMatches(text, /<li\b/giu),
        countMatches(text, /^\s*(?:[-*+]|\d+[.)、])\s+\S+/gmu),
      );
      return structural > 0 ? structural : null;
    }
    case "chapter": {
      const structural = Math.max(
        countMatches(text, /<h1\b/giu),
        countMatches(text, /^\s*#\s+\S+/gmu),
        countMatches(text, /(?:第[一二三四五六七八九十百\d]+章)/gu),
      );
      return structural > 0 ? structural : null;
    }
    case "section": {
      const structural = Math.max(
        countMatches(text, /<section\b/giu),
        countMatches(text, /<h[1-3]\b/giu),
        countMatches(text, /^\s*#{1,3}\s+\S+/gmu),
      );
      return structural > 0 ? structural : null;
    }
    default: {
      const exhaustive: never = assertion.unit;
      return exhaustive;
    }
  }
}

function measuredQuantity(
  candidates: readonly AcceptanceCandidate[],
  assertion: ExactQuantityAssertion,
): number | null {
  const measured = candidates
    .filter((candidate) => candidate.exists)
    .map((candidate) => measuredQuantityForCandidate(candidate, assertion))
    .filter((value): value is number => value !== null);
  return measured.length > 0 ? Math.max(...measured) : null;
}

function subjectFailures(
  candidates: readonly AcceptanceCandidate[],
  contract: SessionGoalQualityContract,
): DeliverableQualityFailure[] {
  const subject = String(contract.subjectAnchor ?? "").trim();
  if (!subject) return [];
  const haystack = normalizeText(combinedCandidateText(candidates));
  const anchors = [subject, ...contract.subjectAliases]
    .map(normalizeText)
    .filter(Boolean);
  if (anchors.some((anchor) => haystack.includes(anchor))) return [];
  return [{
    checkId: "content.subject_anchor",
    domain: "content",
    reason: "subject_anchor_missing",
    repairable: true,
    expected: subject,
  }];
}

function quantityFailures(
  candidates: readonly AcceptanceCandidate[],
  contract: SessionGoalQualityContract,
): DeliverableQualityFailure[] {
  const failures: DeliverableQualityFailure[] = [];
  for (const assertion of contract.exactQuantityAssertions) {
    const actual = measuredQuantity(candidates, assertion);
    if (actual === assertion.exact) continue;
    failures.push({
      checkId: `content.exact_quantity.${assertion.unit}`,
      domain: "content",
      reason: actual === null
        ? "exact_quantity_unmeasurable"
        : "exact_quantity_mismatch",
      repairable: true,
      expected: assertion.exact,
      ...(actual !== null ? { actual } : {}),
    });
  }
  return failures;
}

function softContentFailures(
  candidates: readonly AcceptanceCandidate[],
): DeliverableQualityFailure[] {
  const failures: DeliverableQualityFailure[] = [];
  for (const candidate of candidates) {
    const verdict = detectQualityDefects(
      candidateText(candidate),
      String(candidate.kind ?? "file"),
    );
    if (!verdict.defect || !verdict.reason) continue;
    failures.push({
      checkId: `content.soft.${verdict.reason}`,
      domain: "content",
      reason: verdict.reason,
      repairable: true,
      path: candidate.path,
    });
  }
  return failures;
}

function compositeFailures(
  assessments: readonly CompositeSlotQualityAssessment[] | null | undefined,
): DeliverableQualityFailure[] {
  if (!assessments) return [];
  return assessments.filter((assessment) => !assessment.complete).map((assessment) => ({
    checkId: `composite.${assessment.reason ?? "incomplete"}`,
    domain: "composite" as const,
    reason: assessment.reason ?? "composite_directory_incomplete",
    repairable: true,
    slotId: assessment.slotId,
    ...(assessment.observedPaths[0]
      ? { path: assessment.observedPaths[0] }
      : {}),
  }));
}

export function runDeliverableQualityChecks(
  input: DeliverableQualityCheckInput,
): DeliverableQualityFailure[] {
  const failures: DeliverableQualityFailure[] = [];
  if (input.contract) {
    failures.push(
      ...subjectFailures(input.candidates, input.contract),
      ...quantityFailures(input.candidates, input.contract),
    );
  }
  if (input.productResearch) {
    const combined = combinedCandidateText(input.candidates);
    failures.push(
      ...validateProductResearchContent({
        text: combined,
        tier: input.productResearch.tier,
        ledger: input.productResearch.ledger,
        enforceSources: input.productResearch.enforceSources,
      }),
    );
  }
  failures.push(
    ...softContentFailures(input.candidates),
    ...compositeFailures(input.compositeSlotQuality),
  );
  for (const _violation of input.toolPolicyViolations ?? []) {
    failures.push({
      checkId: "tool_policy.violation",
      domain: "tool_policy",
      reason: "tool_policy_violation",
      repairable: false,
    });
  }
  return failures;
}
