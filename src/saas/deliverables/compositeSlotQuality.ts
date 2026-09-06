// PD-SAAS-FORK: tri-state quality gate for frozen directory-style composite slots (P1)

import { listDeliverableProfiles } from "../deliverableCapabilityProfiles.js";
import {
  compositeSlotQualityMode,
  type StabilityTriStateMode,
} from "../resilience/stabilityFlags.js";
import type { ContractBindingResult } from "./deliverableContractBinding.js";

export { compositeSlotQualityMode };
export type CompositeSlotQualityMode = StabilityTriStateMode;

export type CompositeSlotQualityAssessment = {
  profileId?: string;
  slotId: string;
  complete: boolean;
  reason?: "composite_directory_incomplete" | "composite_directory_degraded";
  observedPaths: string[];
  requiredBasenames: string[];
  missingBasenames: string[];
  degraded?: boolean;
  degradedReason?: string;
};

export type CompositeSlotDegradedHint = {
  slotId: string;
  reason: string;
};

type CompositeRequirement = {
  labels: string[];
  alternatives: string[][];
  minimumPlatformDrafts?: {
    count: number;
    basenames: string[];
  };
};

function normalizePath(value: string): string {
  return String(value ?? "")
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+/g, "/")
    .replace(/\/+$/, "")
    .trim();
}

function pathInScope(relativePath: string, scopeDir: string): boolean {
  const normalized = normalizePath(relativePath);
  return normalized === scopeDir || normalized.startsWith(`${scopeDir}/`);
}

function basenameOf(relativePath: string): string {
  return normalizePath(relativePath).split("/").pop()?.toLowerCase() ?? "";
}

function buildRequirement(profileId?: string): CompositeRequirement | null {
  if (!profileId) return null;
  const profile = listDeliverableProfiles().find((candidate) => candidate.id === profileId);
  if (!profile) return null;

  const alternatives = profile.requiredBasenameGroups?.length
    ? profile.requiredBasenameGroups
    : (profile.requiredBasenames ?? profile.requiredArtifacts ?? [])
        .map((basename) => [basename]);
  const labels = alternatives
    .map((group) => group.map((name) => name.toLowerCase()).join(" / "))
    .filter(Boolean);
  const minimumPlatformDrafts = profile.requiredPlatformDrafts
    ? {
        count: profile.requiredPlatformDrafts.count,
        basenames: profile.requiredPlatformDrafts.basenames.map((name) => name.toLowerCase()),
      }
    : undefined;
  if (labels.length === 0 && !minimumPlatformDrafts) return null;
  return {
    labels,
    alternatives: alternatives.map((group) => group.map((name) => name.toLowerCase())),
    minimumPlatformDrafts,
  };
}

function isDirectoryIndexSlot(
  summary: ContractBindingResult["slotSummaries"][number],
): boolean {
  return summary.resolvedPaths.some((filePath) => basenameOf(filePath) === "index.md")
    || /(?:目录|矩阵|合集|文件组|directory|matrix|bundle|pack)/i.test(summary.label ?? "");
}

function boundReason(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 160);
}

export function assessCompositeSlotQuality(input: {
  profileId?: string;
  binding: ContractBindingResult;
  evidencePaths?: string[];
  scopeDir?: string | null;
  degradedSlots?: CompositeSlotDegradedHint[];
}): CompositeSlotQualityAssessment[] {
  if (compositeSlotQualityMode() === "off") return [];

  const scopeDir = normalizePath(input.scopeDir ?? "");
  // Frozen scope is mandatory: never inspect a shared artifacts tree.
  if (!scopeDir || !scopeDir.startsWith("artifacts/")) return [];
  const requirement = buildRequirement(input.profileId);
  if (!requirement) return [];

  const scopedEvidence = [...new Set(
    (input.evidencePaths ?? input.binding.usedEvidencePaths ?? [])
      .map(normalizePath)
      .filter((filePath) => pathInScope(filePath, scopeDir)),
  )].slice(0, 40);
  const evidenceBasenames = new Set(scopedEvidence.map(basenameOf));
  const degradedBySlot = new Map(
    (input.degradedSlots ?? [])
      .map((hint) => [hint.slotId, boundReason(hint.reason)] as const)
      .filter(([, reason]) => Boolean(reason)),
  );

  const assessments: CompositeSlotQualityAssessment[] = [];
  for (const summary of input.binding.slotSummaries) {
    if (!summary.required || !isDirectoryIndexSlot(summary)) continue;
    const observedPaths = [...new Set([
      ...summary.resolvedPaths.map(normalizePath).filter((filePath) => pathInScope(filePath, scopeDir)),
      ...scopedEvidence,
    ])].slice(0, 40);
    const observedBasenames = new Set([
      ...evidenceBasenames,
      ...observedPaths.map(basenameOf),
    ]);
    const missingBasenames = requirement.alternatives
      .filter((group) => !group.some((basename) => observedBasenames.has(basename)))
      .map((group) => group.join(" / "));

    if (requirement.minimumPlatformDrafts) {
      const observedDraftCount = requirement.minimumPlatformDrafts.basenames
        .filter((basename) => observedBasenames.has(basename))
        .length;
      if (observedDraftCount < requirement.minimumPlatformDrafts.count) {
        missingBasenames.push(`platform-drafts>=${requirement.minimumPlatformDrafts.count}`);
      }
    }

    const degradedReason = degradedBySlot.get(summary.slotId);
    const degraded = Boolean(degradedReason);
    const complete = missingBasenames.length === 0 || degraded;
    assessments.push({
      profileId: input.profileId,
      slotId: summary.slotId,
      complete,
      reason: complete
        ? degraded
          ? "composite_directory_degraded"
          : undefined
        : "composite_directory_incomplete",
      observedPaths,
      requiredBasenames: requirement.labels.slice(0, 20),
      missingBasenames: complete ? [] : missingBasenames.slice(0, 20),
      ...(degradedReason
        ? {
            degraded: true,
            degradedReason,
          }
        : {}),
    });
  }
  return assessments;
}

export function compositeQualityShadowTelemetry(
  assessments: CompositeSlotQualityAssessment[],
): string | undefined {
  if (assessments.length === 0) return undefined;
  return `[shadow:composite_slot_quality] ${assessments
    .slice(0, 8)
    .map((row) => `${row.slotId}:${row.reason ?? "complete"}`)
    .join("; ")}`;
}
