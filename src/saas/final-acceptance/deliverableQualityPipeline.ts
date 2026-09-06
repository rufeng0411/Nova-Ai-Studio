// PD-SAAS-FORK P0-7: single quality/provenance pipeline for final acceptance.
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

import type { SessionGoalQualityContract } from "../constraints/goalQualityContract.js";
import type { AcceptanceCandidate } from "../deliverables/acceptanceChecks.js";
import type { CompositeSlotQualityAssessment } from "../deliverables/compositeSlotQuality.js";
import {
  readAssetProvenanceLedger,
  type AssetProvenanceEntry,
} from "../media/assetProvenanceLedger.js";
import type { OfficialMediaBudgetSnapshot } from "../media/officialMediaFallbackStateMachine.js";
import {
  isOfficialMediaPlaceholderContent,
  looksLikeVisualPlaceholder,
} from "../media/officialMediaPlaceholder.js";
import { extractVisualReferences } from "../media/visualAssetPlatform/deliverableVisualBindingAudit.js";
import {
  contentQualityV2Mode,
  officialMediaV2Mode,
  type StabilityTriStateMode,
} from "../resilience/stabilityFlags.js";
import {
  runDeliverableQualityChecks,
  type DeliverableQualityCompletion,
  type DeliverableQualityFailure,
} from "./deliverableQualityChecks.js";
import type { ResearchSourceLedger } from "../research/researchSourceLedger.js";
import {
  resolveProductResearchTier,
} from "../research/productResearchQualityPolicy.js";

export const QUALITY_EVIDENCE_HASH_VERSION = 1 as const;

export type AssetProvenanceSummary = {
  totalEntries: number;
  validEntries: number;
  officialEntries: number;
  invalidEntries: number;
  placeholderCount: number;
  sourceLevelCounts: Partial<Record<"L0" | "L1" | "L2" | "L3", number>>;
  sourceTierCounts: Partial<
    Record<
      | "brand_official"
      | "authorized_partner_official"
      | "platform_verified_official",
      number
    >
  >;
  ledgerEvidenceHash?: string;
};

export type DeliverableQualityPipelineInput = {
  cwd: string;
  scopeDir: string;
  verifiedPaths: readonly string[];
  candidates: readonly AcceptanceCandidate[];
  qualityContract?: SessionGoalQualityContract | null;
  qualityContractHash?: string;
  compositeSlotQuality?: readonly CompositeSlotQualityAssessment[] | null;
  toolPolicyViolations?: readonly string[];
  officialMediaAttemptState?: OfficialMediaBudgetSnapshot | null;
  capabilitySlug?: string | null;
  contentQualityEnforce?: boolean;
  researchSourceLedger?: ResearchSourceLedger | null;
  userGoal?: string;
};

export type DeliverableQualityPipelineResult = {
  mode: StabilityTriStateMode;
  qualityCompletion: DeliverableQualityCompletion;
  enforcedQualityCompletion: DeliverableQualityCompletion;
  qualityContractHash?: string;
  qualityEvidenceHashVersion: typeof QUALITY_EVIDENCE_HASH_VERSION;
  qualityEvidenceHash: string;
  qualityFailures: DeliverableQualityFailure[];
  assetProvenanceSummary: AssetProvenanceSummary;
};

type ProvenanceEvaluation = {
  summary: AssetProvenanceSummary;
  failures: DeliverableQualityFailure[];
  completion: DeliverableQualityCompletion;
  stableEvidence: unknown;
};

function normalizeRelative(value: string): string {
  return String(value ?? "").trim().replace(/\\/gu, "/").replace(/^\.\/+/u, "");
}

function isPathWithin(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === ""
    || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${stableSerialize(record[key])}`
    ).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function fileEvidence(
  cwd: string,
  verifiedPaths: readonly string[],
): Promise<Array<{ path: string; sha256: string | null }>> {
  const workspaceRoot = path.resolve(cwd);
  const output: Array<{ path: string; sha256: string | null }> = [];
  for (const rawPath of [...new Set(verifiedPaths.map(normalizeRelative))].sort()) {
    const absolutePath = path.resolve(workspaceRoot, rawPath);
    if (!rawPath || !isPathWithin(workspaceRoot, absolutePath)) {
      output.push({ path: rawPath, sha256: null });
      continue;
    }
    const digest = await readFile(absolutePath)
      .then((buffer) => sha256(buffer))
      .catch(() => null);
    output.push({ path: rawPath, sha256: digest });
  }
  return output;
}

async function validateProvenanceEntry(input: {
  cwd: string;
  taskRoot: string;
  entry: AssetProvenanceEntry;
}): Promise<boolean> {
  const localPath = normalizeRelative(input.entry.localPath);
  const absolutePath = path.resolve(input.cwd, localPath);
  if (
    !localPath
    || !isPathWithin(input.taskRoot, absolutePath)
    || input.entry.sourceLevel === "L3"
  ) {
    return false;
  }
  const [taskRootReal, fileReal] = await Promise.all([
    realpath(input.taskRoot).catch(() => null),
    realpath(absolutePath).catch(() => null),
  ]);
  if (!taskRootReal || !fileReal || !isPathWithin(taskRootReal, fileReal)) {
    return false;
  }
  const digest = await readFile(absolutePath)
    .then((buffer) => sha256(buffer))
    .catch(() => null);
  return digest === input.entry.sha256;
}

function increment<T extends string>(
  target: Partial<Record<T, number>>,
  key: T | undefined,
): void {
  if (!key) return;
  target[key] = (target[key] ?? 0) + 1;
}

/** PD-SAAS-FORK ES9: count lingering external http(s) visual refs in deliverable previews. */
export function countUnlocalizedExternalVisualRefs(
  candidates: readonly AcceptanceCandidate[],
): number {
  let count = 0;
  for (const candidate of candidates) {
    const preview = String(candidate.textPreview ?? "");
    if (!preview.trim()) continue;
    const ext = path.extname(String(candidate.path ?? "")).toLowerCase();
    if (!/\.(?:md|markdown|html?)$/iu.test(ext)) continue;
    for (const ref of extractVisualReferences(preview)) {
      const trimmed = ref.trim();
      if (/^https?:\/\//iu.test(trimmed)) count += 1;
    }
  }
  return count;
}

async function evaluateProvenance(
  input: DeliverableQualityPipelineInput,
): Promise<ProvenanceEvaluation> {
  const placeholderCount = input.candidates.filter((candidate) =>
    looksLikeVisualPlaceholder({
      path: candidate.path,
      textPreview: candidate.textPreview,
    })
    || isOfficialMediaPlaceholderContent(candidate.textPreview)
  ).length + countUnlocalizedExternalVisualRefs(input.candidates);
  const emptySummary: AssetProvenanceSummary = {
    totalEntries: 0,
    validEntries: 0,
    officialEntries: 0,
    invalidEntries: 0,
    placeholderCount,
    sourceLevelCounts: {},
    sourceTierCounts: {},
  };
  const contract = input.qualityContract;
  if (!contract || contract.officialMediaPolicy === "none") {
    return {
      summary: emptySummary,
      failures: [],
      completion: "not_applicable",
      stableEvidence: [],
    };
  }

  const taskRoot = path.resolve(input.cwd, input.scopeDir);
  const ledger = await readAssetProvenanceLedger(taskRoot).catch(() => ({
    ledgerPath: "",
    entries: [] as AssetProvenanceEntry[],
  }));
  const validEntries: AssetProvenanceEntry[] = [];
  for (const entry of ledger.entries) {
    if (await validateProvenanceEntry({
      cwd: input.cwd,
      taskRoot,
      entry,
    })) {
      validEntries.push(entry);
    }
  }

  const sourceLevelCounts: AssetProvenanceSummary["sourceLevelCounts"] = {};
  const sourceTierCounts: AssetProvenanceSummary["sourceTierCounts"] = {};
  for (const entry of validEntries) {
    increment(sourceLevelCounts, entry.sourceLevel);
    increment(sourceTierCounts, entry.sourceTier);
  }
  const allowedTiers = new Set(contract.allowedSourceTiers);
  const officialEntries = validEntries.filter((entry) =>
    entry.sourceLevel !== "L3"
    && (allowedTiers.size === 0
      || (entry.sourceLevel === "L0" && entry.sourceTier === undefined)
      || (entry.sourceTier !== undefined && allowedTiers.has(entry.sourceTier)))
  );
  const stableEntries = validEntries.map((entry) => ({
    localPath: normalizeRelative(entry.localPath),
    sha256: entry.sha256,
    sourceLevel: entry.sourceLevel,
    sourceTier: entry.sourceTier ?? null,
  })).sort((left, right) => left.localPath.localeCompare(right.localPath));
  const ledgerEvidenceHash = `ape1:${sha256(stableSerialize(stableEntries))}`;
  const summary: AssetProvenanceSummary = {
    totalEntries: ledger.entries.length,
    validEntries: validEntries.length,
    officialEntries: officialEntries.length,
    invalidEntries: ledger.entries.length - validEntries.length,
    placeholderCount,
    sourceLevelCounts,
    sourceTierCounts,
    ledgerEvidenceHash,
  };

  if (officialEntries.length > 0) {
    const externalRefCount = countUnlocalizedExternalVisualRefs(input.candidates);
    if (
      contract.officialMediaPolicy === "official_only"
      && externalRefCount > 0
    ) {
      return {
        summary,
        failures: [{
          checkId: "official_media.unlocalized_external_refs",
          domain: "official_media",
          reason: "official_media_unlocalized_refs",
          repairable: true,
        }],
        completion: "needs_repair",
        stableEvidence: stableEntries,
      };
    }
    return {
      summary,
      failures: [],
      completion: "passed",
      stableEvidence: stableEntries,
    };
  }
  const state = input.officialMediaAttemptState?.state;
  const placeholderReady = state === "placeholder_ready" || placeholderCount > 0;
  if (contract.allowPlaceholders && placeholderReady) {
    return {
      summary,
      failures: [],
      completion: "degraded_acceptable",
      stableEvidence: stableEntries,
    };
  }
  const blocked = state === "blocked";
  return {
    summary,
    failures: [{
      checkId: "official_media.provenance",
      domain: "official_media",
      reason: blocked
        ? "official_media_unavailable"
        : "official_media_provenance_missing",
      repairable: !blocked,
    }],
    completion: blocked ? "blocked" : "needs_repair",
    stableEvidence: stableEntries,
  };
}

function mergeQualityCompletion(
  contentFailures: readonly DeliverableQualityFailure[],
  provenance: DeliverableQualityCompletion,
): DeliverableQualityCompletion {
  if (
    provenance === "blocked"
    || contentFailures.some((failure) => !failure.repairable)
  ) {
    return "blocked";
  }
  if (contentFailures.length > 0 || provenance === "needs_repair") {
    return "needs_repair";
  }
  if (provenance === "degraded_acceptable") return "degraded_acceptable";
  return "passed";
}

export async function runDeliverableQualityPipeline(
  input: DeliverableQualityPipelineInput,
): Promise<DeliverableQualityPipelineResult> {
  const mode = contentQualityV2Mode();
  const officialMode = officialMediaV2Mode();
  const capabilitySlug = String(input.capabilitySlug ?? "").trim().toLowerCase();
  const productResearch = capabilitySlug === "nova-research-product-user"
    ? {
        tier: resolveProductResearchTier({ userGoal: input.userGoal ?? "" }),
        ledger: input.researchSourceLedger ?? { version: 1 as const, entries: [] },
        enforceSources: input.contentQualityEnforce === true,
      }
    : null;
  const contentFailures = mode === "off"
    ? []
    : runDeliverableQualityChecks({
        candidates: input.candidates,
        contract: input.qualityContract,
        compositeSlotQuality: input.compositeSlotQuality,
        toolPolicyViolations: input.toolPolicyViolations,
        productResearch,
      });
  const provenance = officialMode === "off"
    ? {
        summary: {
          totalEntries: 0,
          validEntries: 0,
          officialEntries: 0,
          invalidEntries: 0,
          placeholderCount: 0,
          sourceLevelCounts: {},
          sourceTierCounts: {},
        },
        failures: [],
        completion: "not_applicable" as const,
        stableEvidence: [],
      }
    : await evaluateProvenance(input);
  const qualityFailures = [...contentFailures, ...provenance.failures];
  const qualityCompletion = mode === "off" && officialMode === "off"
    ? "not_applicable"
    : mergeQualityCompletion(contentFailures, provenance.completion);
  const contentEnforce = mode === "enforce" && input.contentQualityEnforce === true;
  const hasEnforcedChecks = contentEnforce || officialMode === "enforce";
  const enforcedQualityCompletion = !hasEnforcedChecks
    ? "not_applicable"
    : mergeQualityCompletion(
        contentEnforce ? contentFailures : [],
        officialMode === "enforce"
          ? provenance.completion
          : "not_applicable",
      );
  const fileDigests = await fileEvidence(input.cwd, input.verifiedPaths);
  const qualityEvidenceHash =
    `qev${QUALITY_EVIDENCE_HASH_VERSION}:${sha256(stableSerialize({
      qualityContractHash: input.qualityContractHash ?? null,
      fileDigests,
      provenance: provenance.stableEvidence,
      qualityFailures,
      qualityCompletion,
    }))}`;

  return {
    mode,
    qualityCompletion,
    enforcedQualityCompletion,
    ...(input.qualityContractHash
      ? { qualityContractHash: input.qualityContractHash }
      : {}),
    qualityEvidenceHashVersion: QUALITY_EVIDENCE_HASH_VERSION,
    qualityEvidenceHash,
    qualityFailures,
    assetProvenanceSummary: provenance.summary,
  };
}
