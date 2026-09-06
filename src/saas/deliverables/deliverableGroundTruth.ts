// PD-SAAS-FORK (ROG Phase 5): disk-fact reconciliation overrides SDM-only false incomplete.
import { resolveProfile, listDeliverableProfiles, isTier0LockedProfileId } from "../deliverableCapabilityProfiles.js";
import {
  computeSdmProgress,
  filterMissingPathsAgainstManifest,
  parseNumberedDeliverableList,
  sanitizeSessionGoalAnchor,
  shouldLockSessionDeliverableBaseline,
  type SessionDeliverableManifest,
} from "../taskState/sessionDeliverableManifest.js";
import { CAMPAIGN_SLOT_PATTERNS, slotSatisfiedByValidation, sdmBasename } from "./sdmSlotMatching.js";
import {
  filterRepairEligiblePaths,
  isRepairEligiblePath,
  type RepairPathAllowOptions,
} from "./repairEligiblePath.js";
import { isCampaignFullCaseGoal } from "./campaignDeliverableCompleteness.js";
import { isRepairCircuitStrictEnabled } from "./sessionRepairCircuitBreaker.js";
import { isResearchPassedGtStrictHtmlEnabled, isMatrixCoreGtPassEnabled } from "../resilience/stabilityFlags.js";
import { detectContentMatrixTurn } from "../processTemplateExecutionPrompt.js";
import { detectChecklistAuthorityTemplateId } from "./deliverableChecklistAuthority.js";
import { normalizeSdmPath } from "./sdmSlotMatching.js";
import type { EngineDeliverableValidation } from "../../agent/deliverables/validateDeliverablesEngine.js";

export type GroundTruthInput = {
  userGoal: string;
  verified: string[];
  missing: string[];
  broken: string[];
  sessionManifest?: SessionDeliverableManifest;
  profileId?: string;
  capabilitySlug?: string;
  majorCategory?: string | null;
};

export type GroundTruthResult = {
  reconciled: boolean;
  acceptance: "passed" | "needs_repair";
  sdmWarnings: string[];
  satisfiedSlotIds: string[];
};

function envFlagEnabled(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null) return fallback;
  const value = raw.trim().toLowerCase();
  if (value === "0" || value === "false" || value === "off") return false;
  if (value === "1" || value === "true" || value === "on") return true;
  return fallback;
}

/** PD-SAAS-FORK: default ON in dev/pack when unset. */
export function isGroundTruthReconcileEnabled(): boolean {
  return envFlagEnabled("PILOTDECK_GROUND_TRUTH_RECONCILE", true);
}

export function isSdmPivotGuardEnabled(): boolean {
  return envFlagEnabled("PILOTDECK_SDM_PIVOT_GUARD", true);
}

export function isDeliverableSummaryForceEnabled(): boolean {
  return envFlagEnabled("PILOTDECK_DELIVERABLE_SUMMARY_FORCE", true);
}

export function isCampaignPngDegradeEnabled(): boolean {
  return envFlagEnabled("PILOTDECK_CAMPAIGN_PNG_DEGRADE", true);
}

function buildRepairAllow(input: GroundTruthInput): RepairPathAllowOptions {
  const profile = resolveProfile(
    input.capabilitySlug,
    input.majorCategory,
    input.userGoal,
  );
  return {
    slots: input.sessionManifest?.slots,
    allowPathHints: input.sessionManifest?.slots
      ?.map((slot) => slot.pathHint)
      .filter((hint): hint is string => Boolean(hint)),
    allowBasenames: [
      ...(profile.requiredBasenames ?? []),
      ...(profile.requiredBasenameGroups?.flat() ?? []),
    ],
  };
}

function resolveGoalText(input: GroundTruthInput): string {
  const anchor = input.sessionManifest?.sessionGoalAnchor?.trim();
  if (anchor) {
    const sanitized = sanitizeSessionGoalAnchor(anchor);
    if (sanitized) return sanitized;
  }
  return String(input.userGoal ?? "").trim();
}

function isResearchPassedGtEnabled(): boolean {
  return envFlagEnabled("PILOTDECK_RESEARCH_PASSED_GT", true);
}

function isResearchLikeGoal(input: GroundTruthInput): boolean {
  const profileId = input.profileId ?? input.sessionManifest?.profileId;
  const profile = profileId
    ? listDeliverableProfiles().find((entry) => entry.id === profileId)
    : resolveProfile(input.capabilitySlug, input.majorCategory, input.userGoal);
  if (profile?.id === "research") return true;
  const slug = String(input.capabilitySlug ?? "");
  return /竞品|competitive|benchmark|竞品对标|nova-竞品|正式调研|深度调研|调研报告/i.test(`${slug}\n${input.userGoal}`);
}

function hasResearchReportArtifact(verified: string[]): boolean {
  return verified.some((p) => /\.(?:md|html|docx|pdf)$/i.test(p));
}

function hasPendingRequiredHtmlSlots(
  manifest: SessionDeliverableManifest | undefined,
  verified: string[],
): boolean {
  if (!manifest?.slots?.length) return false;
  const activeHtml = manifest.slots.filter(
    (slot) => slot.kind === "html" && slot.status !== "removed" && slot.required !== false,
  );
  const validationOptions = {
    htmlSlotCount: activeHtml.length > 0 ? activeHtml.length : undefined,
    taskArtifactDir: manifest.taskArtifactDir,
  };
  return activeHtml.some(
    (slot) => !slotSatisfiedByValidation(slot, verified, validationOptions),
  );
}

function numberedSlotsSatisfied(
  userGoal: string,
  verified: string[],
): { allSatisfied: boolean; satisfiedSlotIds: string[] } {
  const slots = parseNumberedDeliverableList(userGoal);
  if (slots.length === 0) {
    return { allSatisfied: false, satisfiedSlotIds: [] };
  }
  const satisfiedSlotIds: string[] = [];
  for (const slot of slots) {
    if (slotSatisfiedByValidation(slot, verified)) {
      satisfiedSlotIds.push(slot.id);
    }
  }
  return {
    allSatisfied: satisfiedSlotIds.length === slots.length,
    satisfiedSlotIds,
  };
}

const MATRIX_MASTER_BASENAMES = new Set([
  "article.md",
  "深度长文.md",
  "master.md",
]);

/** PD-SAAS-FORK three-case RCA P1-A: core matrix files verified → treat SDM complete. */
export function matrixCoreSlotsSatisfied(userGoal: string, verified: string[]): boolean {
  if (!isMatrixCoreGtPassEnabled()) return false;
  const goal = String(userGoal ?? "").trim();
  if (!goal) return false;

  const authorityTemplate = detectChecklistAuthorityTemplateId(goal);
  if (authorityTemplate === "one-article-matrix") {
    const profile = listDeliverableProfiles().find((entry) => entry.id === "one-article-matrix");
    const groups = profile?.requiredBasenameGroups ?? [];
    if (groups.length === 0) return false;
    const verifiedLower = verified.map((p) => sdmBasename(p).toLowerCase());
    return groups.every((group) =>
      group.some((basename) => {
        const base = basename.toLowerCase();
        return verifiedLower.some((v) => v === base || v.endsWith(`/${base}`));
      }),
    );
  }

  if (!detectContentMatrixTurn(goal)) return false;
  const normalized = verified.map((p) => normalizeSdmPath(p)).filter(Boolean);
  const hasMaster = normalized.some((p) => {
    const base = sdmBasename(p).toLowerCase();
    return MATRIX_MASTER_BASENAMES.has(base);
  });
  if (!hasMaster) return false;
  let platformCount = 0;
  for (const p of normalized) {
    const base = sdmBasename(p).toLowerCase();
    if (/zhihu|xiaohongshu|wechat|douyin|bilibili/.test(base)) platformCount += 1;
  }
  return platformCount >= 4;
}

function profileBasenamesSatisfied(input: GroundTruthInput, verified: string[]): boolean {
  const profileId = input.profileId ?? input.sessionManifest?.profileId;
  let profile = profileId
    ? listDeliverableProfiles().find((entry) => entry.id === profileId)
    : undefined;
  if (!profile) {
    profile = resolveProfile(input.capabilitySlug, input.majorCategory, input.userGoal);
  }
  const groups = profile.requiredBasenameGroups?.length
    ? profile.requiredBasenameGroups
    : (profile.requiredBasenames ?? []).map((basename) => [basename]);
  if (groups.length === 0) return false;

  const verifiedLower = verified.map((p) => sdmBasename(p).toLowerCase());
  return groups.every((group) =>
    group.some((basename) => {
      const base = basename.toLowerCase();
      return verifiedLower.some((v) => v === base || v.endsWith(`/${base}`))
        || verified.some((p) => p.toLowerCase().includes(base));
    }),
  );
}

function isBaselineStrictGtForceOff(): boolean {
  const raw = process.env.PILOTDECK_SDM_BASELINE_STRICT_GT?.trim().toLowerCase();
  return raw === "0" || raw === "false" || raw === "off";
}

function isBaselineStrictGtForceOn(): boolean {
  const raw = process.env.PILOTDECK_SDM_BASELINE_STRICT_GT?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on";
}

/**
 * Auto strict GT for authoritative SDM baselines (UDC R11).
 * Default: ON when baselineLocked + Tier-0 profile or merged pathHints — no manual prod toggle.
 * Override: PILOTDECK_SDM_BASELINE_STRICT_GT=0 force off (rollback only).
 */
export function shouldApplyBaselineStrictGt(
  manifest: SessionDeliverableManifest | undefined,
): boolean {
  if (!manifest?.slots?.length) return false;
  if (isBaselineStrictGtForceOff()) return false;

  const baselineLocked = Boolean(
    manifest.baselineLocked || shouldLockSessionDeliverableBaseline(manifest),
  );
  if (!baselineLocked) return false;
  if (isBaselineStrictGtForceOn()) return true;

  if (isTier0LockedProfileId(manifest.profileId)) return true;

  const requiredSlots = manifest.slots.filter(
    (slot) => slot.status !== "removed" && slot.required !== false,
  );
  if (requiredSlots.length < 2) return false;

  const withHints = requiredSlots.filter(
    (slot) => Boolean(slot.pathHint) || (slot.pathHints?.length ?? 0) > 0,
  );
  return withHints.length >= Math.ceil(requiredSlots.length * 0.5);
}

function baselineLockedSdmPassed(
  manifest: SessionDeliverableManifest,
  verified: string[],
): { passed: boolean; satisfiedSlotIds: string[] } {
  const progress = computeSdmProgress(manifest, verified);
  const satisfiedSlotIds = manifest.slots
    .filter((slot) => slot.status !== "removed" && slot.required !== false)
    .filter((slot) => slotSatisfiedByValidation(slot, verified))
    .map((slot) => slot.id);
  return {
    passed: progress.total > 0 && progress.done >= progress.total,
    satisfiedSlotIds,
  };
}

function collectSdmPivotWarnings(manifest?: SessionDeliverableManifest): string[] {
  if (!manifest) return [];
  return manifest.slots
    .filter((slot) => slot.status !== "removed" && slot.id.startsWith("pivot_"))
    .map((slot) => `SDM pivot slot ignored: ${slot.id}`);
}

function campaignPhaseCompletePass(
  manifest: SessionDeliverableManifest | undefined,
  verified: string[],
): boolean {
  if (!manifest?.slots?.length) return false;
  const campaignSlots = manifest.slots.filter(
    (slot) => slot.status !== "removed" && CAMPAIGN_SLOT_PATTERNS[slot.id],
  );
  if (campaignSlots.length === 0) return false;
  const progress = computeSdmProgress(
    { ...manifest, slots: campaignSlots },
    verified,
  );
  return progress.total > 0 && progress.done >= progress.total;
}

/** Whether disk facts satisfy the user goal contract despite SDM-only gaps. */
export function reconcileDeliverableGroundTruth(input: GroundTruthInput): GroundTruthResult {
  const needsRepair: GroundTruthResult = {
    reconciled: false,
    acceptance: "needs_repair",
    sdmWarnings: [],
    satisfiedSlotIds: [],
  };

  if (!isGroundTruthReconcileEnabled()) {
    return needsRepair;
  }

  if (input.sessionManifest?.repairCircuit?.tripped) {
    if (isRepairCircuitStrictEnabled()) {
      return {
        reconciled: false,
        acceptance: "needs_repair",
        sdmWarnings: [
          ...collectSdmPivotWarnings(input.sessionManifest),
          "repair circuit tripped (strict mode)",
        ],
        satisfiedSlotIds: [],
      };
    }
    return {
      reconciled: true,
      acceptance: "passed",
      sdmWarnings: collectSdmPivotWarnings(input.sessionManifest),
      satisfiedSlotIds: [],
    };
  }

  const repairAllow = buildRepairAllow(input);
  const manifestFilteredMissing = input.sessionManifest
    ? filterMissingPathsAgainstManifest(input.sessionManifest, input.missing)
    : input.missing;
  const eligibleMissing = filterRepairEligiblePaths(manifestFilteredMissing, repairAllow);
  const eligibleBroken = filterRepairEligiblePaths(input.broken, repairAllow);

  if (eligibleMissing.length > 0 || eligibleBroken.length > 0) {
    return needsRepair;
  }

  if (input.verified.length === 0) {
    return needsRepair;
  }

  const goalText = resolveGoalText(input);
  const numbered = numberedSlotsSatisfied(goalText, input.verified);
  if (numbered.allSatisfied) {
    return {
      reconciled: true,
      acceptance: "passed",
      sdmWarnings: collectSdmPivotWarnings(input.sessionManifest),
      satisfiedSlotIds: numbered.satisfiedSlotIds,
    };
  }

  if (matrixCoreSlotsSatisfied(goalText, input.verified)) {
    return {
      reconciled: true,
      acceptance: "passed",
      sdmWarnings: [
        ...collectSdmPivotWarnings(input.sessionManifest),
        "matrix core slots satisfied (GT pass)",
      ],
      satisfiedSlotIds: [],
    };
  }

  if (
    isResearchPassedGtEnabled()
    && isResearchLikeGoal(input)
    && hasResearchReportArtifact(input.verified)
  ) {
    if (
      isResearchPassedGtStrictHtmlEnabled()
      && hasPendingRequiredHtmlSlots(input.sessionManifest, input.verified)
    ) {
      return needsRepair;
    }
    return {
      reconciled: true,
      acceptance: "passed",
      sdmWarnings: collectSdmPivotWarnings(input.sessionManifest),
      satisfiedSlotIds: [],
    };
  }

  const manifest = input.sessionManifest;
  const applyStrictGt = shouldApplyBaselineStrictGt(manifest);
  if (applyStrictGt && manifest) {
    const strict = baselineLockedSdmPassed(manifest, input.verified);
    if (strict.passed) {
      return {
        reconciled: true,
        acceptance: "passed",
        sdmWarnings: collectSdmPivotWarnings(manifest),
        satisfiedSlotIds: strict.satisfiedSlotIds,
      };
    }
    return needsRepair;
  }

  if (
    !applyStrictGt
    && profileBasenamesSatisfied(input, input.verified)
  ) {
    return {
      reconciled: true,
      acceptance: "passed",
      sdmWarnings: collectSdmPivotWarnings(input.sessionManifest),
      satisfiedSlotIds: [],
    };
  }

  if (isCampaignFullCaseGoal(goalText) && eligibleMissing.length === 0 && eligibleBroken.length === 0) {
    if (isRepairCircuitStrictEnabled() || process.env.PILOTDECK_CAMPAIGN_SLOT_GT === "1") {
      if (campaignPhaseCompletePass(input.sessionManifest, input.verified)) {
        return {
          reconciled: true,
          acceptance: "passed",
          sdmWarnings: collectSdmPivotWarnings(input.sessionManifest),
          satisfiedSlotIds: [],
        };
      }
    } else {
      const campaignVerified = input.verified.filter((p) => /artifacts\//i.test(p));
      if (campaignVerified.length >= 6) {
        return {
          reconciled: true,
          acceptance: "passed",
          sdmWarnings: collectSdmPivotWarnings(input.sessionManifest),
          satisfiedSlotIds: [],
        };
      }
    }
  }

  if (manifest?.slots?.length && eligibleMissing.length === 0 && eligibleBroken.length === 0) {
    const progress = computeSdmProgress(manifest, input.verified);
    if (progress.total > 0 && progress.done >= progress.total) {
      const satisfiedSlotIds = manifest.slots
        .filter((slot) => slot.status !== "removed" && slot.required !== false)
        .filter((slot) => slotSatisfiedByValidation(slot, input.verified))
        .map((slot) => slot.id);
      return {
        reconciled: true,
        acceptance: "passed",
        sdmWarnings: collectSdmPivotWarnings(manifest),
        satisfiedSlotIds,
      };
    }
  }

  return needsRepair;
}

/** Apply reconcile to engine validation output (validateEngine + AgentLoop meta). */
export function applyGroundTruthToValidation(
  validation: EngineDeliverableValidation,
  input: Omit<GroundTruthInput, "verified" | "missing" | "broken">,
): EngineDeliverableValidation {
  const result = reconcileDeliverableGroundTruth({
    ...input,
    verified: validation.verified,
    missing: validation.missing,
    broken: validation.broken,
  });
  if (!result.reconciled) return validation;

  const repairAllow = buildRepairAllow({
    ...input,
    verified: validation.verified,
    missing: validation.missing,
    broken: validation.broken,
  });

  return {
    ...validation,
    acceptance: "passed",
    missing: [],
    broken: filterRepairEligiblePaths(validation.broken, repairAllow),
    failures: validation.failures.filter(
      (failure) => failure.path && isRepairEligiblePath(failure.path, repairAllow),
    ),
    continuePrompt: undefined,
  };
}

export function shouldTreatSdmAsComplete(input: GroundTruthInput): boolean {
  return reconcileDeliverableGroundTruth(input).reconciled;
}
