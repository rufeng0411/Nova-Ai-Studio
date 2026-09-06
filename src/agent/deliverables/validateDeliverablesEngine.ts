// PD-SAAS-FORK: engine-side deliverable path validation before turn success
import fs from "node:fs/promises";
import path from "node:path";
import type { CanonicalMessage } from "../../model/index.js";
import { userGoalImpliesDeliverable } from "../errors/userFacingErrors.js";
import { resolveProfile } from "../../saas/deliverableCapabilityProfiles.js";
import {
  checkProfileRequiredDeliverables,
  shouldEnforceProfileRequiredFiles,
} from "../../saas/deliverables/profileRequiredDeliverables.js";
import {
  inferAcceptanceKind,
  type AcceptanceCandidate,
  type AcceptanceFailure,
} from "../../saas/deliverables/acceptanceChecks.js";
import { runFinalAcceptance } from "../../saas/final-acceptance/finalAcceptance.js";
import type { FinalAcceptanceResult } from "../../saas/final-acceptance/finalAcceptanceState.js";
import {
  checkCampaignRequiredDeliverables,
  isCampaignFullCaseGoal,
  listCampaignFolderDeliverables,
  setCampaignOfficialMediaPolicyForDegrade,
} from "../../saas/deliverables/campaignDeliverableCompleteness.js";
import { buildTaskGoalContract } from "../../saas/taskState/taskGoalContract.js";
import {
  buildExpectedManifestFromSdm,
  buildTaskGoalContractFromManifest,
  computeSdmProgress,
  filterMissingPathsAgainstManifest,
  filterPhantomMissingAgainstBaseline,
  type SessionDeliverableManifest,
} from "../../saas/taskState/sessionDeliverableManifest.js";
import { resolvePrimaryTaskArtifactDir } from "../../saas/taskState/resolvePrimaryTaskArtifactDir.js";
import { slotSatisfiedByValidation, findBestVerifiedPathForSlot, sdmBasename, isClashProneDeliverableBasename } from "../../saas/deliverables/sdmSlotMatching.js";
import { recordStabilityEvent } from "../../telemetry/stabilityEvents.js";
import {
  contentQualityV2Mode,
  contractAuthorityV2Mode,
  deliverableCertificateV2Mode,
  isSessionDeliverableManifestEnabled,
  isSessionTaskDirectoryEnabled,
  officialMediaV2Mode,
  visualAssetPlatformMode,
} from "../../saas/resilience/stabilityFlags.js";
import { observeTaskStage } from "../../saas/resilience/taskStageBudget.js";
import {
  loadVisualAssetManifest,
} from "../../saas/media/visualAssetPlatform/manifestStore.js";
import {
  verifiedPathsFromManifest,
  shouldAutoResolveVisualAssets,
} from "../../saas/media/visualAssetPlatform/orchestrator.js";
import {
  applyVisualBindingAuditToAcceptance,
  runDeliverableVisualBindingAudit,
} from "../../saas/media/visualAssetPlatform/deliverableVisualBindingAudit.js";
import type { CapabilityCompletionMode } from "../../saas/intent/capabilityCompletionMode.js";
import { shouldAllocateSessionTaskDirectory } from "../../saas/taskState/sessionTaskDirectory.js";
import {
  filterVerifiedForContractBinding,
} from "../../saas/deliverables/filterVerifiedForContractBinding.js";
import {
  filterRepairEligiblePaths,
  isRepairEligiblePath,
} from "../../saas/deliverables/repairEligiblePath.js";
import { applyGroundTruthToValidation, matrixCoreSlotsSatisfied } from "../../saas/deliverables/deliverableGroundTruth.js";
import { reconcileDeliverableFacts } from "../../saas/deliverables/reconcileDeliverableFacts.js";
import {
  checkHyperframesDeliverableAcceptance,
} from "../../saas/deliverables/hyperframesAcceptance.js";
import {
  findLatestUserDeliverableAcknowledgment,
  isUserAcknowledgmentEnabled,
} from "../../saas/deliverables/userDeliverableAcknowledgment.js";
import {
  assessCompositeSlotQuality,
  compositeQualityShadowTelemetry,
  compositeSlotQualityMode,
  type CompositeSlotQualityAssessment,
} from "../../saas/deliverables/compositeSlotQuality.js";
import {
  bindContractUnitsStrict,
  type ContractBindingResult,
} from "../../saas/deliverables/deliverableContractBinding.js";
import {
  computeGoalQualityContractHash,
  type SessionGoalQualityContract,
} from "../../saas/constraints/goalQualityContract.js";
import {
  resolveContentQualityCanaryPolicy,
} from "../../saas/constraints/contentQualityCanaryPolicy.js";
import {
  readResearchSourceLedger,
} from "../../saas/research/researchSourceLedger.js";
import {
  syncDataSourcesMarkdown,
} from "../../saas/deliverables/dataSourcesDeliverable.js";
import type {
  OfficialMediaBudgetSnapshot,
} from "../../saas/media/officialMediaFallbackStateMachine.js";
import {
  runDeliverableQualityPipeline,
  type AssetProvenanceSummary,
} from "../../saas/final-acceptance/deliverableQualityPipeline.js";
import type {
  DeliverableQualityCompletion,
  DeliverableQualityFailure,
} from "../../saas/final-acceptance/deliverableQualityChecks.js";
import type {
  DeliverableCompletionState,
} from "../../saas/deliverables/deliverableCompletionState.js";

export type EngineDeliverableValidation = {
  verified: string[];
  missing: string[];
  broken: string[];
  failures: AcceptanceFailure[];
  expectedManifest?: FinalAcceptanceResult["expectedManifest"] | Array<Record<string, unknown>>;
  acceptance: "passed" | "needs_repair" | "user_action_required" | "not_applicable" | "failed";
  completionState?: DeliverableCompletionState;
  /** PD-SAAS-FORK (0717 P0-2): legacy engine acceptance before strict contract veto. */
  legacyAcceptance?: EngineDeliverableValidation["acceptance"];
  /** PD-SAAS-FORK (0717 P0-2): strict contract binding acceptance, independent of legacy passed. */
  strictAcceptanceStatus?: EngineDeliverableValidation["acceptance"];
  /** PD-SAAS-FORK P0-7: draft-only quality facts; certificate is built by the finalizer. */
  qualityContractHash?: string;
  qualityEvidenceHash?: string;
  qualityCompletion?: DeliverableQualityCompletion;
  enforcedQualityCompletion?: DeliverableQualityCompletion;
  qualityFailures?: DeliverableQualityFailure[];
  assetProvenanceSummary?: AssetProvenanceSummary;
  userAcknowledgedPartial?: boolean;
  /** PD-SAAS-FORK (0717 P1): bounded audit record for directory-style composite slots. */
  compositeSlotQuality?: CompositeSlotQualityAssessment[];
  compositeQualityShadow?: string;
  resolvedPathMap?: Record<string, string>;
  continuePrompt?: string;
  /** PD-SAAS-FORK VAP P0-B: deliverable visual binding audit snapshot. */
  bindingAudit?: import("../../saas/media/visualAssetPlatform/deliverableVisualBindingAudit.js").VisualBindingAuditResult;
};

// PD-SAAS-FORK: auto-sync universal data-sources.md into verified paths at turn end.
async function finalizeWithUniversalDataSources(
  input: {
    cwd: string;
    messages: CanonicalMessage[];
    sessionManifest?: SessionDeliverableManifest;
    userGoal?: string;
    completionMode?: CapabilityCompletionMode;
  },
  result: EngineDeliverableValidation,
): Promise<EngineDeliverableValidation> {
  const gated = applyTaskArtifactDirAcceptanceGate(input, result);
  const taskArtifactDir = input.sessionManifest?.taskArtifactDir;
  if (!taskArtifactDir) return gated;
  try {
    const synced = await syncDataSourcesMarkdown({
      cwd: input.cwd,
      messages: input.messages,
      taskArtifactDir,
      goalVersion: input.sessionManifest?.goalVersion,
    });
    const normalized = synced.relativePath.replace(/\\/g, "/");
    if (!normalized) return gated;
    const verified = gated.verified.some(
      (filePath) => filePath.replace(/\\/g, "/") === normalized,
    )
      ? gated.verified
      : [...gated.verified, normalized];
    const missing = gated.missing.filter(
      (filePath) => filePath.replace(/\\/g, "/") !== normalized,
    );
    return { ...gated, verified, missing };
  } catch {
    return gated;
  }
}

/** PD-SAAS-FORK Fix-7: deliverable tasks must not pass without allocated STDA. */
function applyTaskArtifactDirAcceptanceGate(
  input: {
    sessionManifest?: SessionDeliverableManifest;
    userGoal?: string;
    completionMode?: CapabilityCompletionMode;
  },
  result: EngineDeliverableValidation,
): EngineDeliverableValidation {
  if (result.acceptance !== "passed") return result;
  if (!isSessionTaskDirectoryEnabled()) return result;
  if (input.sessionManifest?.taskArtifactDir?.trim()) return result;

  const goal = input.sessionManifest?.sessionGoalAnchor?.trim()
    || String(input.userGoal ?? "").trim();
  const requiresTaskDir = input.completionMode === "report"
    || shouldAllocateSessionTaskDirectory(goal)
    || Boolean(input.sessionManifest?.slots?.length);
  if (!requiresTaskDir) return result;

  return {
    ...result,
    acceptance: "needs_repair",
    legacyAcceptance: result.legacyAcceptance ?? "passed",
    failures: [
      ...result.failures,
      {
        reason: "missing",
        message: "未分配系统任务目录（artifacts/task-*），成果须写入 taskArtifactDir。",
        path: "taskArtifactDir",
        expected: "artifacts/task-YYYYMMDD-id8/",
      },
    ],
  };
}

/** @internal exported for Fix-7 acceptance gate tests */
export const applyTaskArtifactDirAcceptanceGateForTest = applyTaskArtifactDirAcceptanceGate;

const ARTIFACT_SWEEP_MAX_DIRS = 8;
const ARTIFACT_SWEEP_MAX_FILES_PER_DIR = 50;

const DELIVERABLE_EXTENSION_PATTERN =
  "(?:jsonld|pptx|docx|pdf|html?|markdown|md|xlsx|csv|png|jpe?g|webp|gif|svg|json)";
// PD-SAAS-FORK (ROG M2): prefer artifacts/ paths; bare *.md third branch removed to stop phantom repair.
const PATH_PATTERN = new RegExp(
  `(?:artifacts/[^\\s"'<>]+\\.\\w+|(?:[^\\s"'<>/\\\\]+/)+[^\\s"'<>/\\\\]+\\.${DELIVERABLE_EXTENSION_PATTERN})`,
  "gi",
);
const BARE_DELIVERABLE_FILENAME = new RegExp(
  `(?<![/\\\\\\w])\\b([\\w][\\w\\-.]*\\.${DELIVERABLE_EXTENSION_PATTERN})\\b`,
  "gi",
);
const PATH_VALUE_KEYS = new Set([
  "apiPath",
  "filePath",
  "file_path",
  "outputPath",
  "output_path",
  "path",
  "resolvedPath",
  "writtenFilePath",
]);
const PROCESS_ONLY_EXTENSIONS = new Set([
  ".bat",
  ".cmd",
  ".js",
  ".mjs",
  ".ps1",
  ".py",
  ".sh",
  ".ts",
  ".tsx",
]);

export function extractCandidateDeliverablePaths(messages: CanonicalMessage[]): string[] {
  const paths = new Set<string>();
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    const text = msg.content
      .filter((block): block is { type: "text"; text: string } => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    for (const match of text.matchAll(PATH_PATTERN)) {
      addCandidatePath(paths, match[0]);
    }
    collectPathValues(msg.metadata, paths);
    for (const block of msg.content) {
      if (block.type === "tool_call") {
        collectPathValues(block.input, paths);
      }
      if (block.type === "tool_result") {
        collectPathValues(block, paths);
        for (const part of block.content ?? []) {
          if (part.type === "text") {
            collectPathsFromText(part.text, paths);
          }
        }
      } else if (block.type === "tool_result_reference") {
        addCandidatePath(paths, block.path);
        collectPathsFromText(block.preview, paths);
      }
      collectPathValues(block, paths);
    }
  }
  return [...paths];
}

// PD-SAAS-FORK: unified candidate index merges assistant prose paths, tool
// write paths and a bounded sweep of turn-scoped artifact dirs, so files a
// skill/script wrote without echoing the path in prose are still discovered.
export async function buildArtifactCandidateIndex(input: {
  cwd: string;
  messages: CanonicalMessage[];
  userGoal: string;
  /** PD-SAAS-FORK Fix-6: limit bare-basename disk resolve to this task root. */
  taskArtifactDir?: string | null;
}): Promise<Set<string>> {
  const candidatePaths = new Set(
    extractCandidateDeliverablePaths(input.messages)
      .filter((candidate) => !isProcessOnlyDeliverablePath(candidate)),
  );
  if (isCampaignFullCaseGoal(input.userGoal)) {
    for (const rel of await listCampaignFolderDeliverables({
      cwd: input.cwd,
      messages: input.messages,
    })) {
      if (!isProcessOnlyDeliverablePath(rel)) candidatePaths.add(rel);
    }
  }
  await resolveBareBasenamesOnArtifactDisk(
    input.cwd,
    candidatePaths,
    collectBareFilenameMentions(input.messages),
    input.taskArtifactDir,
  );
  for (const rel of await sweepTurnArtifactDirs(
    input.cwd,
    inferArtifactDirHints(candidatePaths, input.taskArtifactDir),
  )) {
    if (!isProcessOnlyDeliverablePath(rel)) candidatePaths.add(rel);
  }
  dropShadowedBareCandidates(candidatePaths);
  return candidatePaths;
}

// PD-SAAS-FORK: only sweep turn-scoped subdirectories (depth >= 2, e.g.
// artifacts/<slug>/) and never a shared root like artifacts/, so a previous
// turn's leftovers in the shared root cannot contaminate this turn.
async function sweepTurnArtifactDirs(cwd: string, hintDirs: string[]): Promise<string[]> {
  const turnDirs = hintDirs
    .map((dir) => dir.replace(/\\/g, "/"))
    .filter((dir) => dir.split("/").length >= 2 && dir.startsWith("artifacts/"))
    .slice(0, ARTIFACT_SWEEP_MAX_DIRS);
  const found: string[] = [];
  for (const dir of turnDirs) {
    await walkSweepDir(cwd, dir, found, 0);
  }
  return found;
}

async function walkSweepDir(
  cwd: string,
  relDir: string,
  found: string[],
  depth: number,
): Promise<void> {
  if (depth > 4 || found.length >= ARTIFACT_SWEEP_MAX_FILES_PER_DIR) return;
  let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>;
  try {
    entries = await fs.readdir(path.join(cwd, relDir), { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (found.length >= ARTIFACT_SWEEP_MAX_FILES_PER_DIR) break;
    const rel = `${relDir}/${entry.name}`.replace(/\\/g, "/");
    if (entry.isDirectory()) {
      await walkSweepDir(cwd, rel, found, depth + 1);
      continue;
    }
    if (!entry.isFile()) continue;
    if (isProcessOnlyDeliverablePath(rel) || !looksLikeDeliverablePath(rel)) continue;
    found.push(rel);
  }
}

type ArtifactDiskFile = { rel: string; base: string; slugDir: string };

async function walkArtifactDeliverableFiles(cwd: string): Promise<ArtifactDiskFile[]> {
  const out: ArtifactDiskFile[] = [];
  const root = path.join(cwd, "artifacts");
  async function visit(relDir: string, depth: number): Promise<void> {
    if (depth > 6 || out.length >= 500) return;
    let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>;
    try {
      entries = await fs.readdir(path.join(cwd, relDir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= 500) break;
      const rel = `${relDir}/${entry.name}`.replace(/\\/g, "/");
      if (entry.isDirectory()) {
        await visit(rel, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      if (isProcessOnlyDeliverablePath(rel) || !looksLikeDeliverablePath(rel)) continue;
      const parts = rel.split("/");
      const slugDir = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : rel;
      out.push({ rel, base: path.basename(rel).toLowerCase(), slugDir });
    }
  }
  try {
    await fs.access(root);
    await visit("artifacts", 0);
  } catch {
    // no artifacts root
  }
  return out;
}

/** Resolve prose bare basenames to scoped artifact paths when files exist on disk. */
async function resolveBareBasenamesOnArtifactDisk(
  cwd: string,
  paths: Set<string>,
  bareMentions: string[] = [],
  taskArtifactDir?: string | null,
): Promise<void> {
  const bareOriginal = [
    ...bareMentions,
    ...[...paths].filter((p) => !p.replace(/\\/g, "/").includes("/")),
    ...[...paths]
      .filter((p) => {
        const normalized = p.replace(/\\/g, "/");
        return normalized.includes("/") && !normalized.startsWith("artifacts/");
      })
      .map((p) => path.basename(p)),
  ];
  if (bareOriginal.length === 0) return;

  const bareLower = new Set(bareOriginal.map((p) => p.toLowerCase()));
  const diskFiles = await walkArtifactDeliverableFiles(cwd);
  if (diskFiles.length === 0) return;

  const scopeNorm = taskArtifactDir
    ? taskArtifactDir.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase()
    : null;

  const hintedDirs = new Set<string>();
  for (const candidate of [...paths, ...bareMentions]) {
    const normalized = String(candidate ?? "").replace(/\\/g, "/");
    if (!normalized.startsWith("artifacts/")) continue;
    const parts = normalized.split("/").filter(Boolean);
    if (parts.length >= 2) hintedDirs.add(`${parts[0]}/${parts[1]}`.toLowerCase());
  }

  const pathInScope = (rel: string): boolean => {
    const normalized = rel.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
    if (scopeNorm) {
      return normalized === scopeNorm || normalized.startsWith(`${scopeNorm}/`);
    }
    if (hintedDirs.size === 0) return false;
    const parts = normalized.split("/").filter(Boolean);
    if (parts.length < 2) return false;
    return hintedDirs.has(`${parts[0]}/${parts[1]}`.toLowerCase());
  };

  // PD-SAAS-FORK Fix-6: without task dir or in-session artifact hints, skip global basename guessing.
  if (!scopeNorm && hintedDirs.size === 0) return;

  const dirHits = new Map<string, number>();
  for (const file of diskFiles) {
    if (!bareLower.has(file.base)) continue;
    if (!pathInScope(file.rel)) continue;
    dirHits.set(file.slugDir, (dirHits.get(file.slugDir) ?? 0) + 1);
  }

  // PD-SAAS-FORK Fix-6: scoped task dir set but no in-scope basename — do not bind other sessions.
  if (scopeNorm && dirHits.size === 0) return;
  if (!scopeNorm && hintedDirs.size > 0 && dirHits.size === 0) return;

  let bestDir = "";
  let bestHits = 0;
  for (const [dir, hits] of dirHits) {
    if (hits > bestHits) {
      bestHits = hits;
      bestDir = dir;
    }
  }
  if (!bestDir || bestHits === 0) return;

  for (const file of diskFiles) {
    if (!pathInScope(file.rel)) continue;
    if (!file.rel.startsWith(`${bestDir}/`) && file.slugDir !== bestDir) continue;
    if (bareLower.has(file.base)) paths.add(file.rel);
  }
  for (const bare of bareOriginal) {
    const resolved = diskFiles.some(
      (file) => file.base === bare.toLowerCase() && file.rel.startsWith(`${bestDir}/`),
    );
    if (resolved) paths.delete(bare);
  }
  for (const candidate of [...paths]) {
    const normalized = candidate.replace(/\\/g, "/");
    if (normalized.startsWith("artifacts/")) continue;
    const base = path.basename(normalized).toLowerCase();
    const resolved = diskFiles.find(
      (file) => file.base === base && file.rel.startsWith(`${bestDir}/`),
    );
    if (resolved) {
      paths.delete(candidate);
      paths.add(resolved.rel);
    }
  }
}

// PD-SAAS-FORK: map both the full relative path and its basename to the real
// relative path so the UI can resolve a bare basename mention to the exact file.
function buildResolvedPathMap(verified: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const basenameCounts = new Map<string, number>();
  for (const rel of verified) {
    const normalized = String(rel ?? "").replace(/\\/g, "/").trim();
    if (!normalized) continue;
    const base = sdmBasename(normalized).toLowerCase();
    basenameCounts.set(base, (basenameCounts.get(base) ?? 0) + 1);
  }
  for (const rel of verified) {
    const normalized = String(rel ?? "").replace(/\\/g, "/").trim();
    if (!normalized) continue;
    map[normalized] = normalized;
    const base = sdmBasename(normalized);
    if (!base || base in map) continue;
    const baseKey = base.toLowerCase();
    const count = basenameCounts.get(baseKey) ?? 0;
    if (count > 1 && isClashProneDeliverableBasename(base)) continue;
    map[base] = normalized;
  }
  return map;
}

export async function validateEngineDeliverables(input: {
  cwd: string;
  messages: CanonicalMessage[];
  userGoal?: string;
  capabilitySlug?: string;
  majorCategory?: string;
  sessionManifest?: SessionDeliverableManifest;
  /** PD-SAAS-FORK: P0-1 exact capability file-completion mode. */
  completionMode?: CapabilityCompletionMode;
  /** PD-SAAS-FORK P0-7: independent frozen quality contract and bounded runtime evidence. */
  qualityContract?: SessionGoalQualityContract | null;
  qualityContractHash?: string;
  officialMediaAttemptState?: OfficialMediaBudgetSnapshot | null;
  toolPolicyViolations?: string[];
}): Promise<EngineDeliverableValidation | null> {
  const startedAt = Date.now();
  try {
    return await validateEngineDeliverablesCore(input);
  } finally {
    // PD-SAAS-FORK: taskStageBudget observe — shadow only, never veto acceptance.
    observeTaskStage({
      sessionId: input.sessionManifest?.sessionGoalAnchor ?? "",
      stage: "validate",
      elapsedMs: Date.now() - startedAt,
      retryCount: 0,
      verifiedNet: 0,
    });
  }
}

async function validateEngineDeliverablesCore(input: {
  cwd: string;
  messages: CanonicalMessage[];
  userGoal?: string;
  capabilitySlug?: string;
  majorCategory?: string;
  sessionManifest?: SessionDeliverableManifest;
  completionMode?: CapabilityCompletionMode;
  qualityContract?: SessionGoalQualityContract | null;
  qualityContractHash?: string;
  officialMediaAttemptState?: OfficialMediaBudgetSnapshot | null;
  toolPolicyViolations?: string[];
}): Promise<EngineDeliverableValidation | null> {
  if (input.completionMode === "consultation") return null;
  const userGoal = input.userGoal ?? "";
  const goalAnchor = input.sessionManifest?.sessionGoalAnchor?.trim() || userGoal;
  const sdmActive = isSessionDeliverableManifestEnabled() && Boolean(input.sessionManifest?.slots?.length);
  if (!sdmActive && !userGoalImpliesDeliverable(userGoal)) return null;

  const profile = resolveProfile(input.capabilitySlug, input.majorCategory, goalAnchor);
  const primaryTaskDir = resolvePrimaryTaskArtifactDir({
    manifest: input.sessionManifest,
    messages: input.messages,
  });
  const effectiveTaskArtifactDir = primaryTaskDir?.taskArtifactDir
    ?? input.sessionManifest?.taskArtifactDir
    ?? null;

  const candidatePaths = await buildArtifactCandidateIndex({
    cwd: input.cwd,
    messages: input.messages,
    userGoal,
    taskArtifactDir: effectiveTaskArtifactDir,
  });

  const candidatesForAcceptance: AcceptanceCandidate[] = [];
  for (const rel of candidatePaths) {
    const abs = path.isAbsolute(rel) ? rel : path.join(input.cwd, rel);
    try {
      const stat = await fs.stat(abs);
      candidatesForAcceptance.push({
        path: rel,
        kind: inferAcceptanceKind(rel),
        exists: true,
        sizeBytes: stat.size,
        textPreview: await readTextPreview(abs, rel),
        binaryHeader: await readBinaryHeader(abs, rel),
      });
    } catch {
      candidatesForAcceptance.push({
        path: rel,
        kind: inferAcceptanceKind(rel),
        exists: false,
        sizeBytes: 0,
      });
    }
  }

  const goalContract = input.sessionManifest
    ? buildTaskGoalContractFromManifest(input.sessionManifest)
    : buildTaskGoalContract({
      userGoal,
      capabilitySlug: input.capabilitySlug,
      majorCategory: input.majorCategory,
      profileId: profile.id,
      completionMode: input.completionMode,
    });

  const finalAcceptance = await runFinalAcceptance({
    userGoal,
    goalContract,
    candidates: candidatesForAcceptance,
  });

  let verified = [...finalAcceptance.verifiedPaths];
  let missing = [...finalAcceptance.missingPaths];
  let broken = [...finalAcceptance.brokenPaths];
  let failures = [...finalAcceptance.failures];
  let continuePrompt = finalAcceptance.continuePrompt;

  // PD-SAAS-FORK VAP Fix-3: merge prepared assets only when VAP was intentionally enabled.
  if (
    visualAssetPlatformMode() !== "off"
    && effectiveTaskArtifactDir
    && shouldAutoResolveVisualAssets({
      userGoal,
      capabilitySlug: input.capabilitySlug,
    })
  ) {
    try {
      const vapManifest = await loadVisualAssetManifest({
        workspaceRoot: input.cwd,
        taskArtifactDir: effectiveTaskArtifactDir,
        sessionId: "validate",
        goalVersion: input.sessionManifest?.goalVersion,
      });
      for (const vapPath of verifiedPathsFromManifest(vapManifest)) {
        if (!vapPath || isProcessOnlyDeliverablePath(vapPath)) continue;
        if (!verified.includes(vapPath)) verified.push(vapPath);
      }
    } catch {
      // ignore VAP bookkeeping failures
    }
  }

  verified = verified.filter((p) => !isProcessOnlyDeliverablePath(p));
  if (effectiveTaskArtifactDir) {
    verified = filterVerifiedForContractBinding(verified, {
      scopeDir: effectiveTaskArtifactDir,
    });
  }

  if (
    shouldEnforceProfileRequiredFiles(userGoal, profile)
    && !(sdmActive && (input.sessionManifest?.slots?.length ?? 0) > 0)
  ) {
    const requiredChecks = await checkProfileRequiredDeliverables({
      cwd: input.cwd,
      userGoal,
      capabilitySlug: input.capabilitySlug,
      majorCategory: input.majorCategory,
      artifactDirHints: inferArtifactDirHints(candidatePaths, effectiveTaskArtifactDir),
    });
    for (const check of requiredChecks) {
      if (check.exists && check.path && check.sizeBytes > 0) {
        if (!verified.includes(check.path)) verified.push(check.path);
        continue;
      }
      const placeholder = check.path ?? `artifacts/**/${check.basename}`;
      if (!missing.includes(placeholder)) missing.push(placeholder);
      failures.push({
        reason: "missing",
        message: `缺少必需成果 ${check.basename}。`,
        path: placeholder,
        expected: check.basename,
      });
    }
  }
  if (isCampaignFullCaseGoal(userGoal)) {
    // PD-SAAS-FORK VAP: gate campaign PNG→HTML degrade for official_only.
    setCampaignOfficialMediaPolicyForDegrade(
      input.qualityContract?.officialMediaPolicy,
    );
    const campaignChecks = await checkCampaignRequiredDeliverables({
      cwd: input.cwd,
      messages: input.messages,
      userGoal,
      artifactPathHints: [...candidatePaths, ...verified],
    });
    for (const check of campaignChecks) {
      if (check.exists && check.valid && check.path) {
        if (!verified.includes(check.path)) verified.push(check.path);
        continue;
      }
      const placeholder = check.path ?? `artifacts/campaign/**/${check.id}`;
      if (check.exists && check.path) {
        if (!broken.includes(check.path)) broken.push(check.path);
        failures.push({
          reason: "broken",
          message: `${check.label} 不符合交付要求。`,
          path: check.path,
          expected: check.label,
        });
        continue;
      }
      if (!missing.includes(placeholder)) missing.push(placeholder);
      failures.push({
        reason: "missing",
        message: `缺少 Campaign 必需成果：${check.label}。`,
        path: placeholder,
        expected: check.label,
      });
    }
  }
  if (isNovaImageSlideDeckGoal(userGoal, input.capabilitySlug)) {
    const slideDeckCheck = await checkNovaImageSlideDeck({
      cwd: input.cwd,
      candidatePaths,
      userGoal,
    });
    for (const filePath of slideDeckCheck.verified) {
      if (!verified.includes(filePath)) verified.push(filePath);
    }
    for (const filePath of slideDeckCheck.missing) {
      if (!missing.includes(filePath)) missing.push(filePath);
    }
    for (const filePath of slideDeckCheck.broken) {
      if (!broken.includes(filePath)) broken.push(filePath);
    }
    failures.push(...slideDeckCheck.failures);
  }

  const hyperframesCheck = checkHyperframesDeliverableAcceptance({
    capabilitySlug: input.capabilitySlug,
    verifiedPaths: verified,
    messages: input.messages,
  });
  failures.push(...hyperframesCheck.failures);

  const status = failures.length > 0 ? "needs_repair" as const : finalAcceptance.status;
  let acceptance = status;
  // PD-SAAS-FORK (Goal Loop P2 H4): reject empty-table false complete.
  if (
    acceptance === "passed"
    && userGoalImpliesDeliverable(userGoal)
    && verified.length === 0
    && (finalAcceptance.expectedManifest?.length ?? 0) > 0
  ) {
    acceptance = "needs_repair";
    failures.push({
      reason: "missing",
      message: "声称已交付但未找到可验收成果文件。",
      path: missing[0] ?? "artifacts/",
      expected: "deliverable file",
    });
  }

  const expectedManifest = input.sessionManifest
    ? buildExpectedManifestFromSdm(input.sessionManifest)
    : finalAcceptance.expectedManifest;

  const reconciled = await reconcileDeliverableFacts({
    cwd: input.cwd,
    verified,
    missing,
    broken,
    failures,
    userGoal: goalAnchor,
    capabilitySlug: input.capabilitySlug,
    sessionManifest: input.sessionManifest,
    profile,
  });
  verified = reconciled.verified;
  missing = reconciled.missing;
  broken = reconciled.broken;
  failures = reconciled.failures;

  if (input.sessionManifest) {
    missing = filterMissingPathsAgainstManifest(input.sessionManifest, missing);
    missing = filterPhantomMissingAgainstBaseline(input.sessionManifest, missing);
    failures = failures.filter((failure) => {
      if (!failure.path) return true;
      return filterMissingPathsAgainstManifest(input.sessionManifest!, [failure.path]).length > 0;
    });
  }

  const userAcknowledgedDeliverables = isUserAcknowledgmentEnabled()
    && findLatestUserDeliverableAcknowledgment(input.messages).acknowledged;
  const officialMediaRequired =
    input.qualityContract?.officialMediaPolicy === "official_only"
    || input.qualityContract?.officialMediaPolicy === "official_preferred";
  const bindingAudit = effectiveTaskArtifactDir
    ? await runDeliverableVisualBindingAudit({
        cwd: input.cwd,
        verifiedPaths: verified,
        taskArtifactDir: effectiveTaskArtifactDir,
        sessionId: "validate",
        goalVersion: input.sessionManifest?.goalVersion,
        officialMediaRequired,
      })
    : null;
  if (bindingAudit) {
    const audited = applyVisualBindingAuditToAcceptance({
      audit: bindingAudit,
      failures,
      acceptance,
    });
    acceptance = audited.acceptance;
    failures = audited.failures;
  }
  if (missing.length === 0 && broken.length === 0 && failures.length === 0 && verified.length > 0) {
    acceptance = "passed";
  } else if (missing.length > 0 || broken.length > 0 || failures.length > 0) {
    acceptance = "needs_repair";
  }

  // PD-SAAS-FORK (Goal Loop R9 B4): slot-level contract — passed requires all SDM required slots covered.
  if (acceptance === "passed" && input.sessionManifest) {
    const progress = computeSdmProgress(input.sessionManifest, verified);
    const goalText = input.userGoal
      ?? input.sessionManifest.sessionGoalAnchor
      ?? "";
    const matrixCorePass = matrixCoreSlotsSatisfied(goalText, verified);
    if (progress.total > 0 && progress.done < progress.total && !matrixCorePass) {
      acceptance = "needs_repair";
      const htmlSlotCount = input.sessionManifest.slots.filter(
        (s) => s.kind === "html" && s.status !== "removed" && s.required !== false,
      ).length;
      const validationOptions = {
        htmlSlotCount: htmlSlotCount > 0 ? htmlSlotCount : undefined,
        taskArtifactDir: effectiveTaskArtifactDir ?? input.sessionManifest.taskArtifactDir,
      };
      const incomplete = input.sessionManifest.slots
        .filter((slot) => slot.required && slot.status !== "removed")
        .filter((slot) => !slotSatisfiedByValidation(slot, verified, validationOptions));
      for (const slot of incomplete.slice(0, 5)) {
        failures.push({
          reason: "missing",
          message: `交付清单未完成：${slot.label}。`,
          path: slot.pathHint ?? slot.id,
          expected: slot.label,
        });
      }
    }
  } else if (acceptance === "needs_repair" && input.sessionManifest) {
    const progress = computeSdmProgress(input.sessionManifest, verified);
    // PD-SAAS-FORK ES9 P0-B′: progress.done/total alone must not upgrade needs_repair → passed.
    const htmlSlotCount = input.sessionManifest.slots.filter(
      (s) => s.kind === "html" && s.status !== "removed" && s.required !== false,
    ).length;
    const validationOptions = {
      htmlSlotCount: htmlSlotCount > 0 ? htmlSlotCount : undefined,
      taskArtifactDir: effectiveTaskArtifactDir ?? input.sessionManifest.taskArtifactDir,
    };
    const allRequiredSatisfied = input.sessionManifest.slots
      .filter((slot) => slot.required && slot.status !== "removed")
      .every((slot) => slotSatisfiedByValidation(slot, verified, validationOptions));
    if (
      progress.total > 0
      && progress.done >= progress.total
      && !allRequiredSatisfied
    ) {
      recordStabilityEvent({
        event: "progress_false_pass",
        reason: "sdm_slot_incomplete",
        detail: { progressDone: progress.done, progressTotal: progress.total },
      });
    }
    if (
      deliverableCertificateV2Mode() !== "enforce"
      && progress.total > 0
      && progress.done >= progress.total
      && allRequiredSatisfied
      && missing.length === 0
      && broken.length === 0
    ) {
      acceptance = "passed";
      missing = [];
      broken = [];
      failures = failures.filter((failure) => !failure.path);
    }
  }
  const legacyAcceptance = acceptance;
  let strictAcceptanceStatus: EngineDeliverableValidation["acceptance"] | undefined;
  let strictBinding: ContractBindingResult | undefined;

  const certificateMode = deliverableCertificateV2Mode();
  const contractAuthorityMode = contractAuthorityV2Mode();
  if (
    (certificateMode !== "off" || contractAuthorityMode !== "off")
    && input.sessionManifest
  ) {
    try {
      strictBinding = bindContractUnitsStrict({
        manifest: input.sessionManifest,
        scopeDir: effectiveTaskArtifactDir ?? input.sessionManifest.taskArtifactDir ?? null,
        verifiedPaths: verified,
        diskPaths: verified,
      });
      strictAcceptanceStatus =
        strictBinding.incompleteReason?.startsWith("contract_unit_budget_exceeded")
        || strictBinding.incompleteReason?.startsWith("evidence_budget_exceeded")
          ? "failed"
          : strictBinding.complete
            ? "passed"
            : "needs_repair";

      // PD-SAAS-FORK (0717 P0-2): shadow keeps legacy acceptance; enforce applies strict veto.
      if (
        contractAuthorityMode === "enforce"
        && strictAcceptanceStatus
      ) {
        if (legacyAcceptance === "passed" && strictAcceptanceStatus !== "passed") {
          acceptance = "needs_repair";
        } else if (strictAcceptanceStatus === "failed") {
          acceptance = "failed";
        }
      } else if (
        certificateMode === "enforce"
      ) {
        if (legacyAcceptance === "passed" && !strictBinding.complete) {
          acceptance = "needs_repair";
        }
      }
    } catch {
      if (
        contractAuthorityMode === "enforce" || certificateMode === "enforce"
      ) {
        acceptance = "needs_repair";
      }
    }
  }

  let resolvedPathMap = buildResolvedPathMap(verified);
  if (input.sessionManifest) {
    const scopeDir = effectiveTaskArtifactDir ?? input.sessionManifest.taskArtifactDir ?? null;
    const usedPaths = new Set<string>();
    for (const slot of input.sessionManifest.slots) {
      if (!slot.pathHint || slot.status === "removed") continue;
      const match = findBestVerifiedPathForSlot(slot, verified, usedPaths, scopeDir);
      if (!match) continue;
      usedPaths.add(match.toLowerCase());
      resolvedPathMap[slot.id] = match;
      resolvedPathMap[match] = match;
      const base = sdmBasename(match);
      if (base && !(base in resolvedPathMap)) {
        const sameBase = verified.filter(
          (p) => sdmBasename(p).toLowerCase() === base.toLowerCase(),
        );
        if (sameBase.length === 1 || !isClashProneDeliverableBasename(base)) {
          resolvedPathMap[base] = match;
        }
      }
    }
  }

  // PD-SAAS-FORK (ROG Phase 5): disk-fact reconciliation — SDM-only gaps cannot veto passed.
  const baseResult: EngineDeliverableValidation = {
    verified,
    missing,
    broken,
    failures,
    expectedManifest,
    acceptance,
    ...(strictAcceptanceStatus ? { strictAcceptanceStatus } : {}),
    ...(legacyAcceptance !== acceptance || strictAcceptanceStatus
      ? { legacyAcceptance }
      : {}),
    ...(userAcknowledgedDeliverables
      ? { userAcknowledgedPartial: true }
      : {}),
    resolvedPathMap,
    continuePrompt: acceptance === "needs_repair"
      ? mergeContinuePrompt(continuePrompt, missing, verified)
      : continuePrompt,
    ...(bindingAudit ? { bindingAudit } : {}),
  };

  let groundTruthResult = applyGroundTruthToValidation(baseResult, {
    userGoal,
    sessionManifest: input.sessionManifest,
    profileId: profile.id !== "default" ? profile.id : input.sessionManifest?.profileId,
    capabilitySlug: input.capabilitySlug,
    majorCategory: input.majorCategory,
  });
  // PD-SAAS-FORK (0717 P1-A): strict authority owns the repair decision. Preserve
  // its unresolved unit paths after ground-truth reconciliation so a 2/3 video
  // contract produces an actionable missing .mp4 instead of a pathless repair.
  if (
    contractAuthorityMode === "enforce"
    && strictBinding
    && strictAcceptanceStatus === "needs_repair"
  ) {
    const matchedUnitIds = new Set(
      strictBinding.bindings
        .filter((binding) => binding.matched)
        .map((binding) => binding.unitId),
    );
    const strictMissingPaths = strictBinding.units
      .filter((unit) => unit.required && !matchedUnitIds.has(unit.unitId))
      .map((unit) => unit.expectedPath)
      .filter(Boolean);
    const strictFailures: AcceptanceFailure[] = strictMissingPaths
      .filter((filePath) => !groundTruthResult.missing.includes(filePath))
      .map((filePath) => ({
        reason: "missing",
        message: `严格成果合同未完成：${filePath}。`,
        path: filePath,
        expected: filePath,
      }));
    groundTruthResult = {
      ...groundTruthResult,
      acceptance: "needs_repair",
      missing: [...new Set([...groundTruthResult.missing, ...strictMissingPaths])],
      failures: [...groundTruthResult.failures, ...strictFailures],
      continuePrompt: mergeContinuePrompt(
        groundTruthResult.continuePrompt,
        strictMissingPaths,
        groundTruthResult.verified,
      ),
    };
  }
  const compositeMode = compositeSlotQualityMode();
  let compositeResult = groundTruthResult;
  if (compositeMode !== "off" && effectiveTaskArtifactDir && input.sessionManifest) {
    try {
    const scopeDir = effectiveTaskArtifactDir;
    const binding = bindContractUnitsStrict({
      manifest: input.sessionManifest,
      verifiedPaths: groundTruthResult.verified,
      diskPaths: groundTruthResult.verified,
      scopeDir,
    });
    const degradedSlots = input.sessionManifest.slots.flatMap((slot) => {
      const allowDegraded = slot.allowDegraded === true
        || /(?:degraded placeholder|允许降级|降级占位)/i.test(slot.label);
      if (!allowDegraded) return [];
      const reason = slot.degradedReason?.trim()
        || "manifest_explicit_degraded_placeholder";
      return [{ slotId: slot.id, reason }];
    });
    const compositeSlotQuality = assessCompositeSlotQuality({
      profileId: input.sessionManifest.profileId
        ?? (profile.id !== "default" ? profile.id : undefined),
      binding,
      evidencePaths: groundTruthResult.verified,
      scopeDir,
      degradedSlots,
    });
      if (compositeSlotQuality.length > 0) {
        const compositeQualityShadow =
          compositeQualityShadowTelemetry(compositeSlotQuality);
        compositeResult = {
          ...groundTruthResult,
          compositeSlotQuality,
          ...(compositeQualityShadow ? { compositeQualityShadow } : {}),
        };

        if (compositeMode === "enforce") {
          const incomplete = compositeSlotQuality.filter(
            (assessment) => !assessment.complete,
          );
          if (incomplete.length > 0) {
            const missingCompositePaths = incomplete.flatMap((assessment) => (
              assessment.missingBasenames.map((basename) => (
                `${scopeDir}/${basename.split(" / ")[0] ?? basename}`
              ))
            ));
            const compositeFailures: AcceptanceFailure[] = incomplete.map(
              (assessment) => ({
                reason: "composite_quality",
                message: `组合成果不完整：${assessment.slotId}`,
                path: assessment.observedPaths[0] ?? scopeDir,
                expected: assessment.missingBasenames.join(", "),
              }),
            );
            compositeResult = {
              ...compositeResult,
              acceptance: "needs_repair",
              legacyAcceptance:
                compositeResult.legacyAcceptance ?? compositeResult.acceptance,
              missing: [
                ...new Set([
                  ...compositeResult.missing,
                  ...missingCompositePaths,
                ]),
              ],
              failures: [
                ...compositeResult.failures,
                ...compositeFailures,
              ],
              continuePrompt: mergeContinuePrompt(
                compositeResult.continuePrompt,
                missingCompositePaths,
                compositeResult.verified,
              ),
            };
          }
        }
      }
    } catch {
      if (compositeMode === "enforce") {
        compositeResult = {
          ...groundTruthResult,
          acceptance: "needs_repair",
          legacyAcceptance:
            groundTruthResult.legacyAcceptance ?? groundTruthResult.acceptance,
        };
      }
    }
  }

  // PD-SAAS-FORK P0-7: quality runs only after SDM veto and ground truth.
  if (
    contentQualityV2Mode() === "off"
    && officialMediaV2Mode() === "off"
  ) {
    return finalizeWithUniversalDataSources(input, compositeResult);
  }
  const scopeDir = input.sessionManifest?.taskArtifactDir
    ?? inferQualityScopeDir(compositeResult.verified);
  const qualityContractHash = input.qualityContractHash
    ?? (input.qualityContract
      ? computeGoalQualityContractHash(input.qualityContract)
      : undefined);
  try {
    const qualityCandidates = await hydrateQualityCandidates({
      cwd: input.cwd,
      verifiedPaths: compositeResult.verified,
      initialCandidates: candidatesForAcceptance,
    });
    const contentCanary = resolveContentQualityCanaryPolicy({
      capabilitySlug: input.capabilitySlug,
    });
    const taskRoot = path.resolve(input.cwd, scopeDir);
    const researchSourceLedger = await readResearchSourceLedger(taskRoot).catch(
      () => ({ version: 1 as const, entries: [] }),
    );
    const quality = await runDeliverableQualityPipeline({
      cwd: input.cwd,
      scopeDir,
      verifiedPaths: compositeResult.verified,
      candidates: qualityCandidates,
      qualityContract: input.qualityContract,
      qualityContractHash,
      compositeSlotQuality: compositeResult.compositeSlotQuality,
      toolPolicyViolations: input.toolPolicyViolations,
      officialMediaAttemptState: input.officialMediaAttemptState,
      capabilitySlug: input.capabilitySlug,
      contentQualityEnforce: contentCanary.selected
        && contentCanary.effectiveMode === "enforce",
      researchSourceLedger,
      userGoal,
    });
    const qualityDraft: EngineDeliverableValidation = {
      ...compositeResult,
      ...(qualityContractHash ? { qualityContractHash } : {}),
      qualityEvidenceHash: quality.qualityEvidenceHash,
      qualityCompletion: quality.qualityCompletion,
      enforcedQualityCompletion: quality.enforcedQualityCompletion,
      qualityFailures: quality.qualityFailures,
      assetProvenanceSummary: quality.assetProvenanceSummary,
    };
    if (
      quality.enforcedQualityCompletion !== "needs_repair"
      && quality.enforcedQualityCompletion !== "blocked"
    ) {
      return finalizeWithUniversalDataSources(input, qualityDraft);
    }
    const acceptanceFailures = quality.qualityFailures.map(
      (failure): AcceptanceFailure => ({
        reason: failure.domain === "composite"
          ? "composite_quality"
          : "low_quality",
        message: `质量验收未通过：${failure.reason}`,
        ...(failure.path ? { path: failure.path } : {}),
        ...(failure.expected !== undefined
          ? { expected: failure.expected }
          : {}),
        ...(failure.actual !== undefined ? { actual: failure.actual } : {}),
      }),
    );
    return finalizeWithUniversalDataSources(input, {
      ...qualityDraft,
      acceptance: quality.enforcedQualityCompletion === "blocked"
        ? "user_action_required"
        : "needs_repair",
      legacyAcceptance:
        qualityDraft.legacyAcceptance ?? qualityDraft.acceptance,
      failures: [...qualityDraft.failures, ...acceptanceFailures],
      continuePrompt: quality.enforcedQualityCompletion === "needs_repair"
        ? mergeContinuePrompt(
            qualityDraft.continuePrompt,
            quality.qualityFailures
              .map((failure) => failure.path)
              .filter((value): value is string => Boolean(value)),
            qualityDraft.verified,
          )
        : qualityDraft.continuePrompt,
    });
  } catch {
    const qualityFailure: DeliverableQualityFailure = {
      checkId: "quality.pipeline",
      domain: "content",
      reason: "quality_evidence_unavailable",
      repairable: true,
    };
    return finalizeWithUniversalDataSources(input, {
      ...compositeResult,
      acceptance: "needs_repair",
      legacyAcceptance:
        compositeResult.legacyAcceptance ?? compositeResult.acceptance,
      qualityContractHash,
      qualityCompletion: "needs_repair",
      enforcedQualityCompletion: "needs_repair",
      qualityFailures: [qualityFailure],
      failures: [
        ...compositeResult.failures,
        {
          reason: "low_quality",
          message: "质量验收证据暂不可用。",
        },
      ],
    });
  }
}

type NovaSlideDeckCheck = {
  verified: string[];
  missing: string[];
  broken: string[];
  failures: AcceptanceFailure[];
};

function isNovaImageSlideDeckGoal(userGoal: string, capabilitySlug?: string): boolean {
  return /nova-ppt-aesthetic-slides/i.test(String(capabilitySlug ?? ""))
    || /(?:Nova-?美学幻灯|PNG\s*幻灯|配图\s*PNG|slide-manifest\.json)/i.test(userGoal);
}

function extractRequestedSlideCount(userGoal: string): number | undefined {
  let found: number | undefined;
  for (const match of String(userGoal ?? "").matchAll(/(\d{1,3})\s*(?:页|张|个|slides?|pages?)/gi)) {
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0) found = value;
  }
  return found;
}

async function checkNovaImageSlideDeck(input: {
  cwd: string;
  candidatePaths: Set<string>;
  userGoal: string;
}): Promise<NovaSlideDeckCheck> {
  const expectedCount = extractRequestedSlideCount(input.userGoal);
  let manifests = [...input.candidatePaths]
    .filter((candidate) => /(?:^|\/)slide-manifest\.json$/i.test(candidate))
    .sort((a, b) => b.length - a.length);
  if (manifests.length === 0) {
    manifests = await discoverNovaSlideManifests(input.cwd);
  }

  if (manifests.length === 0) {
    return {
      verified: [],
      missing: ["artifacts/slides-*/slide-manifest.json"],
      broken: [],
      failures: [{
        reason: "missing",
        message: "Nova 美学幻灯必须交付 slide-manifest.json 和逐页 PNG，不能用 HTML/PDF/outline.json 替代。",
        path: "artifacts/slides-*/slide-manifest.json",
        expected: "slide-manifest.json",
      }],
    };
  }

  const failures: AcceptanceFailure[] = [];
  const missing: string[] = [];
  const broken: string[] = [];
  const verified: string[] = [];

  for (const manifestPath of manifests) {
    const manifestAbs = path.isAbsolute(manifestPath) ? manifestPath : path.join(input.cwd, manifestPath);
    const deckDir = path.dirname(manifestPath).replace(/\\/g, "/");
    const manifest = await readJsonObject(manifestAbs);
    if (!manifest) {
      broken.push(manifestPath);
      failures.push({
        reason: "broken",
        message: `${manifestPath} 不是可读取的 slide-manifest.json。`,
        path: manifestPath,
        expected: "valid slide-manifest.json",
      });
      continue;
    }

    const pages = Array.isArray(manifest.pages) ? manifest.pages : [];
    const pageCount = typeof manifest.page_count === "number" ? manifest.page_count : pages.length;
    const manifestFailures: AcceptanceFailure[] = [];
    if (pages.length === 0) {
      manifestFailures.push({
        reason: "broken",
        message: `${manifestPath} 没有 pages 页面清单。`,
        path: manifestPath,
        expected: "pages[]",
      });
    }
    if (pageCount !== pages.length) {
      manifestFailures.push({
        reason: "broken",
        message: `${manifestPath} 的 page_count 与 pages.length 不一致。`,
        path: manifestPath,
        expected: pages.length,
        actual: pageCount,
      });
    }
    if (expectedCount && pages.length !== expectedCount) {
      manifestFailures.push({
        reason: pages.length < expectedCount ? "count_insufficient" : "count_excess",
        message: pages.length < expectedCount
          ? `当前只有 ${pages.length} 页 PNG 幻灯，还缺 ${expectedCount - pages.length} 页。`
          : `当前有 ${pages.length} 页 PNG 幻灯，超过要求的 ${expectedCount} 页。`,
        path: manifestPath,
        expected: expectedCount,
        actual: pages.length,
      });
    }
    if (expectedCount && pageCount !== expectedCount) {
      manifestFailures.push({
        reason: "broken",
        message: `${manifestPath} 的 page_count 必须为 ${expectedCount}。`,
        path: manifestPath,
        expected: expectedCount,
        actual: pageCount,
      });
    }

    const pageImagePaths: string[] = [];
    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index];
      const pageRecord = page && typeof page === "object" && !Array.isArray(page)
        ? page as Record<string, unknown>
        : null;
      const rawImagePath = typeof pageRecord?.image_path === "string" ? pageRecord.image_path.trim() : "";
      if (!rawImagePath) {
        manifestFailures.push({
          reason: "missing",
          message: `${manifestPath} 第 ${index + 1} 页缺少 image_path。`,
          path: manifestPath,
          expected: `pages[${index}].image_path`,
        });
        continue;
      }
      if (!/\.png$/i.test(rawImagePath)) {
        manifestFailures.push({
          reason: "type_mismatch",
          message: `${rawImagePath} 不是 PNG 幻灯页图。`,
          path: rawImagePath,
          expected: "png",
        });
        continue;
      }
      const relImagePath = normalizeSlideImagePath(deckDir, rawImagePath);
      if (expectedCount) {
        const expectedBasename = `slide-${String(index + 1).padStart(2, "0")}.png`;
        const actualBasename = path.basename(relImagePath.replace(/\\/g, "/"));
        if (actualBasename.toLowerCase() !== expectedBasename.toLowerCase()) {
          manifestFailures.push({
            reason: "name_mismatch",
            message: `${relImagePath} 必须对应第 ${index + 1} 页 ${expectedBasename}。`,
            path: relImagePath,
            expected: expectedBasename,
            actual: actualBasename,
          });
        }
      }
      const absImagePath = path.join(input.cwd, relImagePath);
      try {
        const stat = await fs.stat(absImagePath);
        if (stat.size <= 0) {
          broken.push(relImagePath);
          manifestFailures.push({
            reason: "broken",
            message: `${relImagePath} 是空 PNG 文件。`,
            path: relImagePath,
          });
          continue;
        }
        pageImagePaths.push(relImagePath);
      } catch {
        missing.push(relImagePath);
        manifestFailures.push({
          reason: "missing",
          message: `${relImagePath} 不存在。`,
          path: relImagePath,
        });
      }
    }

    if (manifestFailures.length === 0) {
      return {
        verified: [manifestPath, ...pageImagePaths],
        missing: [],
        broken: [],
        failures: [],
      };
    }
    failures.push(...manifestFailures);
    broken.push(manifestPath);
  }

  return {
    verified,
    missing: [...new Set(missing)],
    broken: [...new Set(broken)],
    failures,
  };
}

/** PD-SAAS-FORK P0-9: test-only export for Nova slide exact-count regression. */
export const validateNovaImageSlideDeckForTest = checkNovaImageSlideDeck;

async function discoverNovaSlideManifests(cwd: string): Promise<string[]> {
  const artifactsDir = path.join(cwd, "artifacts");
  let entries: Array<{ name: string; isDirectory: () => boolean }>;
  try {
    entries = await fs.readdir(artifactsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const manifests: Array<{ rel: string; mtimeMs: number }> = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^slides-/i.test(entry.name)) continue;
    const abs = path.join(artifactsDir, entry.name, "slide-manifest.json");
    try {
      const stat = await fs.stat(abs);
      if (stat.size > 0) {
        manifests.push({
          rel: `artifacts/${entry.name}/slide-manifest.json`,
          mtimeMs: stat.mtimeMs,
        });
      }
    } catch {
      // Ignore incomplete slide folders.
    }
  }
  return manifests
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .map((item) => item.rel);
}

async function readJsonObject(absPath: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await fs.readFile(absPath, "utf8");
    const parsed = JSON.parse(content) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeSlideImagePath(deckDir: string, imagePath: string): string {
  const normalized = imagePath.replace(/\\/g, "/").replace(/^\.\/+/, "");
  if (normalized.startsWith("artifacts/")) return normalized;
  return `${deckDir}/${normalized}`.replace(/\/+/g, "/");
}

function dropShadowedBareCandidates(paths: Set<string>): void {
  const byBasename = new Map<string, string[]>();
  for (const candidate of paths) {
    const base = path.basename(candidate).toLowerCase();
    const bucket = byBasename.get(base) ?? [];
    bucket.push(candidate);
    byBasename.set(base, bucket);
  }
  for (const variants of byBasename.values()) {
    const qualified = variants.filter((candidate) => candidate.includes("/"));
    if (qualified.length === 0) continue;
    for (const candidate of variants) {
      if (!candidate.includes("/")) paths.delete(candidate);
    }
  }
}

function mergeContinuePrompt(
  base: string | undefined,
  missing: string[],
  verified: string[],
): string {
  const lines = [
    base?.trim() || "请基于本轮已有成果继续制作，不要重复已通过验收的文件。",
  ];
  if (verified.length > 0) {
    lines.push(`已完成：${verified.join("、")}。`);
  }
  if (missing.length > 0) {
    lines.push(`请补齐：${missing.join("、")}。`);
  }
  lines.push("用 edit_file 分段追加，单次不超过 60 行；禁止空参数 write_file/read_file。");
  return lines.join("\n");
}

function inferQualityScopeDir(verifiedPaths: readonly string[]): string {
  const first = verifiedPaths
    .map((value) => String(value ?? "").replace(/\\/gu, "/").trim())
    .find((value) => value.startsWith("artifacts/"));
  if (!first) return "artifacts";
  const parts = first.split("/");
  return parts.length >= 3 ? parts.slice(0, 2).join("/") : "artifacts";
}

async function hydrateQualityCandidates(input: {
  cwd: string;
  verifiedPaths: readonly string[];
  initialCandidates: readonly AcceptanceCandidate[];
}): Promise<AcceptanceCandidate[]> {
  const candidatesByPath = new Map(
    input.initialCandidates.map((candidate) => [
      candidate.path.replace(/\\/gu, "/"),
      candidate,
    ]),
  );
  for (const filePath of input.verifiedPaths) {
    const normalized = String(filePath ?? "").replace(/\\/gu, "/").trim();
    if (!normalized || candidatesByPath.has(normalized)) continue;
    const absolutePath = path.isAbsolute(normalized)
      ? normalized
      : path.join(input.cwd, normalized);
    try {
      const stats = await fs.stat(absolutePath);
      candidatesByPath.set(normalized, {
        path: normalized,
        kind: inferAcceptanceKind(normalized),
        exists: true,
        sizeBytes: stats.size,
        textPreview: await readTextPreview(absolutePath, normalized),
        binaryHeader: await readBinaryHeader(absolutePath, normalized),
      });
    } catch {
      candidatesByPath.set(normalized, {
        path: normalized,
        kind: inferAcceptanceKind(normalized),
        exists: false,
        sizeBytes: 0,
      });
    }
  }
  return [...candidatesByPath.values()];
}

function inferArtifactDirHints(paths: Set<string>, taskArtifactDir?: string | null): string[] {
  const dirs = new Set<string>();
  // PD-SAAS-FORK: allocated STDA must always be swept (even before first write_file echo).
  if (taskArtifactDir?.trim()) {
    dirs.add(taskArtifactDir.replace(/\\/g, "/").replace(/\/+$/, ""));
  }
  for (const rel of paths) {
    const normalized = rel.replace(/\\/g, "/");
    if (!normalized.includes("/")) continue;
    const top = normalized.split("/")[0]?.toLowerCase() ?? "";
    if (["node_modules", "skills", "src", "ui", "scripts", "tests", "test"].includes(top)) continue;
    const dir = path.posix.dirname(normalized);
    if (dir && dir !== ".") dirs.add(dir);
  }
  const sorted = [...dirs].sort((a, b) => b.length - a.length);
  if (!taskArtifactDir) return sorted;
  const scopeNorm = taskArtifactDir.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  const scoped = sorted.filter((dir) => {
    const normalized = dir.toLowerCase();
    return normalized === scopeNorm || normalized.startsWith(`${scopeNorm}/`);
  });
  return scoped.length > 0 ? scoped : [taskArtifactDir.replace(/\\/g, "/").replace(/\/+$/, "")];
}

function collectPathsFromText(text: string, paths: Set<string>): void {
  for (const match of String(text ?? "").matchAll(PATH_PATTERN)) {
    addCandidatePath(paths, match[0]);
  }
  const trimmed = String(text ?? "").trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return;
  try {
    collectPathValues(JSON.parse(trimmed) as unknown, paths);
  } catch {
    // Tool text is often prose; ignore parse failures.
  }
}

function collectPathValues(value: unknown, paths: Set<string>): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectPathValues(item, paths);
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (typeof nested === "string" && PATH_VALUE_KEYS.has(key)) {
      addCandidatePath(paths, nested);
      continue;
    }
    if (Array.isArray(nested) && (key === "paths" || key === "files" || key === "outputs")) {
      for (const item of nested) {
        if (typeof item === "string") addCandidatePath(paths, item);
        else collectPathValues(item, paths);
      }
      continue;
    }
    collectPathValues(nested, paths);
  }
}

function addCandidatePath(paths: Set<string>, raw: string): void {
  const normalized = normalizeCandidatePath(raw);
  if (!normalized || isProcessOnlyDeliverablePath(normalized)) return;
  if (!looksLikeDeliverablePath(normalized)) return;
  // PD-SAAS-FORK: prose like schema/schema.jsonld is not workspace-root-relative; resolve basename only.
  if (!normalized.startsWith("artifacts/")) {
    const parts = normalized.split("/").filter(Boolean);
    if (parts.length === 2 && !parts[0].includes("-")) {
      return;
    }
  }
  paths.add(normalized);
}

function normalizeCandidatePath(raw: string): string {
  let value = String(raw ?? "")
    .trim()
    .replace(/^['"`\[*_]+|['"`\]*_]+$/g, "")
    .replace(/\\/g, "/");
  value = value.replace(/^(?:报告)?文件路径[:：]\s*/i, "").replace(/^路径[:：]\s*/i, "");
  const artifactIndex = value.toLowerCase().indexOf("artifacts/");
  if (artifactIndex > 0) {
    value = value.slice(artifactIndex);
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return "";
  return value;
}

function looksLikeDeliverablePath(value: string): boolean {
  return isRepairEligiblePath(value);
}

function collectBareFilenameMentions(messages: CanonicalMessage[]): string[] {
  const mentions = new Set<string>();
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    for (const block of msg.content) {
      if (block.type !== "text") continue;
      const text = block.text;
      for (const match of text.matchAll(BARE_DELIVERABLE_FILENAME)) {
        const filename = (match[1] ?? match[0]).trim();
        const index = match.index ?? 0;
        if (!filename) continue;
        if (index > 0 && text[index - 1] === "/") {
          mentions.add(filename);
          continue;
        }
        const lineStart = text.lastIndexOf("\n", index - 1) + 1;
        const prefix = text.slice(lineStart, index);
        if (/\/[^\s]*$/.test(prefix)) continue;
        mentions.add(filename);
      }
    }
  }
  return [...mentions];
}

function isProcessOnlyDeliverablePath(value: string): boolean {
  const normalized = value.replace(/\\/g, "/").toLowerCase();
  if (!normalized) return true;
  if (normalized.includes("/skills/") || normalized.startsWith("skills/")) return true;
  if (normalized.endsWith("/skill.md") || normalized.endsWith("skill.md")) return true;
  if (/\/docs\/(?:execution-standard|troubleshooting-guide|api-guide)\.md$/i.test(normalized)) return true;
  if (/^artifacts\/geo\/docs\//i.test(normalized)) return true;
  if (normalized.includes("/node_modules/")) return true;
  if (/(?:^|\/)\.failed\./.test(normalized) || /\.failed\./.test(normalized)) return true;
  // PD-SAAS-FORK VAP Fix-2: prepared/raw/capture bookkeeping is not a user deliverable.
  const base = path.basename(normalized);
  if (base === "visual-asset-manifest.json") return true;
  if (base === "index-preview.png") return true;
  if (/-report_inline\.png$/i.test(base)) return true;
  if (/\/assets\/(?:prepared|_capture|raw)\//i.test(normalized)) return true;
  if (/^(?:tmp_workspace|tmp\/|temp\/)/.test(normalized)) return true;
  const ext = path.extname(normalized);
  return PROCESS_ONLY_EXTENSIONS.has(ext);
}

async function readTextPreview(absPath: string, relPath: string): Promise<string | undefined> {
  const ext = path.extname(relPath).toLowerCase();
  if (![".html", ".htm", ".md", ".markdown", ".json", ".jsonld", ".svg", ".txt"].includes(ext)) return undefined;
  try {
    const content = await fs.readFile(absPath, "utf8");
    return content.slice(0, 64_000);
  } catch {
    return undefined;
  }
}

async function readBinaryHeader(absPath: string, relPath: string): Promise<string | undefined> {
  const ext = path.extname(relPath).toLowerCase();
  if (![".pptx", ".docx", ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".webm", ".mov"].includes(ext)) return undefined;
  try {
    const file = await fs.open(absPath, "r");
    try {
      const buffer = Buffer.alloc(12);
      const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
      return buffer.subarray(0, bytesRead).toString("latin1");
    } finally {
      await file.close();
    }
  } catch {
    return undefined;
  }
}
