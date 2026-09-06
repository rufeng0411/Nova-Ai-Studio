// PD-SAAS-FORK: Goal Loop Phase 3 — Session Deliverable Manifest (SDM)
import type { AcceptanceArtifactKind } from "../deliverables/acceptanceArtifactKind.js";
import { buildTaskGoalContract, type TaskGoalContract } from "./taskGoalContract.js";
import { detectGoalPivot } from "./detectGoalPivot.js";
import { detectGoalMutation, isSingleMarkdownMktDeliverableAnchor, type GoalMutationResult } from "./detectGoalMutation.js";
import {
  resolveNumberedParseScope,
  parseNumberedLinesToSlots,
  resolveAuthoritativeSdmSlots,
  detectChecklistAuthorityTemplateId,
  sanitizePollutedPathHints,
  stripLaunchContextAndAttachmentBlocks,
  parseMustDeliverClause,
  hasExplicitLiteMustDeliverOverride,
  isNovaResearchLiteCapability,
  isToxicResearchReportAuthorityPack,
  enrichHtmlPairDeliverableSlots,
} from "../deliverables/deliverableChecklistAuthority.js";
import { isCampaignFullCaseGoal } from "../deliverables/campaignDeliverableGoal.js";
import { isProductUserResearchDeliverableGoal } from "../processTemplateExecutionPrompt.js";
import {
  defaultPathHintForKind,
  findBestVerifiedPathForSlot,
  joinArtifactPathHint,
  normalizeSdmPath,
  pathWithinPreferredScope,
  reanchorSdmPathToTaskDir,
  pathSatisfiesSdmSlot,
  sdmBasename,
  slotSatisfiedByValidation,
} from "../deliverables/sdmSlotMatching.js";
import {
  defaultAddLabelForKind,
  semanticSlotLabel,
} from "../deliverables/sdmSlotLabels.js";
import {
  applyDeliverableChineseFilenamePolicy,
  resolveSuggestedBasename,
} from "../deliverables/deliverableFilenamePolicy.js";
import { parseDisplayLabelFromUserGoal } from "./sessionTaskDirectoryCore.js";
import { shouldSkipDeliverableContract } from "../n2Bot/n2BotFlags.js";
import {
  isTier0LockedProfileId,
  isPptRouteLockedProfileId,
  isExplicitContentFlywheelContractGoal,
  isBrandGeoFullCaseGoal,
  listDeliverableProfiles,
  resolveProfile,
  resolvePptHubRouteProfileId,
} from "../deliverableCapabilityProfiles.js";
import type { CapabilityCompletionMode } from "../intent/capabilityCompletionMode.js";
import {
  isCapabilityScopeV2EnforcedForSlug,
  isParallelGeoStagesEnabled,
  isSequentialDeliverablesEnabled,
  isSequentialDeliverablesShadowEnabled,
  isSessionDeliverableManifestEnabled,
  isSdmGeoKeywordAliasEnabled,
  sequentialDeliverablesMode,
  sdmHealResearchLiteMode,
  isExpensiveIntentClarifyMode,
  type StabilityTriStateMode,
} from "../resilience/stabilityFlags.js";
import {
  resolveEffectiveCompileGoal,
  recordBriefContractTelemetry,
} from "../deliverables/deliverableBriefContract.js";
import { isOfficeDeliverablePackGoal } from "../clarificationGate.js";
import {
  EXPENSIVE_INTENT_PPT_VS_FILES,
  isExpensiveIntentKeepShortReply,
  resolveExpensiveIntentCompileGoal,
  resolveExpensiveIntentConflictReply,
} from "../intent/expensiveIntentConflict.js";
import { detectContentMatrixTurn } from "../processTemplateExecutionPrompt.js";
import { userGoalImpliesDeliverable } from "../../agent/errors/userFacingErrors.js";
import type { AgentTranscriptEntry } from "../../session/transcript/TranscriptEntry.js";
import {
  isSdmPivotGuardEnabled,
  shouldTreatSdmAsComplete,
} from "../deliverables/deliverableGroundTruth.js";
import { matchesExplicitAddPattern } from "./detectGoalMutation.js";
import {
  mergeNumberedSlotsWithProfile,
  shouldBindGeoProfileForGoal,
} from "./mergeNumberedSlotsWithProfile.js";
import { appendUniversalDataSourcesSlot } from "../deliverables/dataSourcesDeliverable.js";
import { recordStabilityEvent } from "../../telemetry/stabilityEvents.js";

export type SessionDeliverableSlotStatus = "pending" | "active" | "done" | "removed";

export type SessionDeliverableSlot = {
  id: string;
  label: string;
  kind?: AcceptanceArtifactKind;
  required: boolean;
  count?: number;
  pathHint?: string;
  /** Basename aliases from profile requiredBasenameGroups (all names match this slot). */
  pathHints?: string[];
  stageId?: string;
  stageOrder?: number;
  status?: SessionDeliverableSlotStatus;
  /** PD-SAAS-FORK UDC R11: engine/UI bound path after reconcile. */
  resolvedPath?: string;
  /** PD-SAAS-FORK (0717 P1): an explicit profile-approved degraded composite may pass. */
  allowDegraded?: boolean;
  /** Bounded user-visible reason persisted in acceptance metadata when degraded. */
  degradedReason?: string;
  /** PD-SAAS-FORK full-chain-speed P0-2: parallel write group (e.g. office-export). */
  parallelGroup?: string;
  /** Source file hint for parallel export slots (e.g. report.md). */
  sourcePathHint?: string;
  /** PD-SAAS-FORK Preflight Studio: slot requires visual preflight before write. */
  needsPreflight?: boolean;
  preflightProfileRef?: string;
  preflightStatus?: 'none' | 'awaiting' | 'resolved' | 'skipped';
  preflightResolved?: {
    catalogId: string;
    surface?: string;
    canvas?: string;
    mode?: string;
    style?: string;
    confirmedAt: string;
  };
};

export type SessionRepairCircuitState = {
  gapCounts: Record<string, number>;
  totalRepairs: number;
  tripped?: boolean;
  /** PD-SAAS-FORK 0731-fail-B: verified count at last distill gap record. */
  lastVerifiedCount?: number;
};

export type SessionDeliverableManifest = {
  manifestVersion: number;
  goalVersion: number;
  sessionGoalAnchor: string;
  slots: SessionDeliverableSlot[];
  profileId?: string;
  capabilitySlug?: string;
  /** PD-SAAS-FORK: exact capability output mode persisted for same-session continuation. */
  completionMode?: CapabilityCompletionMode;
  compiledAtTurnId?: string;
  currentStageId?: string;
  /** PD-SAAS-FORK (ROG Phase 7 G0): cross-turn repair circuit breaker state. */
  repairCircuit?: SessionRepairCircuitState;
  /** PD-SAAS-FORK UDC R11: frozen contract — no verified_* row expansion. */
  baselineLocked?: boolean;
  /** PD-SAAS-FORK STDA: authoritative task root for this goalVersion. */
  taskArtifactDir?: string;
  taskDirKey?: string;
  /** PD-SAAS-FORK 0731: heal toxic research-report pack ≤1/session. */
  healResearchLiteApplied?: boolean;
  /** PD-SAAS-FORK: expensive intent fuse — named files vs imperative slides. */
  expensiveIntentFingerprint?: string;
  expensiveIntentHandled?: boolean;
  expensiveIntentChosen?: "keep_must_deliver" | "switch_to_ppt";
  supersedes?: {
    manifestVersion: number;
    diff: "pivot" | "add" | "remove" | "replace" | "initial" | "prune";
  };
};

/**
 * PD-SAAS-FORK 0731: toxic authority_research-report_* + lite 须交付 → heal.
 * shadow=telemetry marker only; enforce=replace slots (keep universal_data_sources).
 */
export function maybeHealToxicResearchLiteManifest(
  manifest: SessionDeliverableManifest,
  verifiedPaths: string[],
): {
  manifest: SessionDeliverableManifest;
  changed: boolean;
  mode: StabilityTriStateMode;
  healed: boolean;
} {
  const mode = sdmHealResearchLiteMode();
  if (mode === "off" || manifest.healResearchLiteApplied) {
    return { manifest, changed: false, mode, healed: false };
  }
  const goal = String(manifest.sessionGoalAnchor ?? "").trim();
  if (
    !hasExplicitLiteMustDeliverOverride(goal)
    && !isNovaResearchLiteCapability(goal, manifest.capabilitySlug)
  ) {
    return { manifest, changed: false, mode, healed: false };
  }
  if (!isToxicResearchReportAuthorityPack(manifest.slots)) {
    return { manifest, changed: false, mode, healed: false };
  }
  const must = parseMustDeliverClause(goal);
  if (must.length === 0) {
    return { manifest, changed: false, mode, healed: false };
  }
  const liteBases = new Set(
    must.map((s) => sdmBasename(s.pathHint ?? "").toLowerCase()).filter(Boolean),
  );
  const verifiedHit = verifiedPaths.some((raw) => {
    const base = sdmBasename(raw).toLowerCase();
    return liteBases.has(base)
      || /industry-market-report\.md$/i.test(base)
      || /user-research-report\.md$/i.test(base);
  });
  if (!verifiedHit) {
    return { manifest, changed: false, mode, healed: false };
  }

  if (mode === "shadow") {
    recordStabilityEvent({
      event: "sdm_heal_research_lite",
      reason: "shadow",
      detail: { slug: String(manifest.capabilitySlug ?? "") },
    });
    return {
      manifest: { ...manifest, healResearchLiteApplied: true },
      changed: false,
      mode,
      healed: true,
    };
  }

  const dataSources = manifest.slots.filter(
    (s) => s.status !== "removed" && /universal_data_sources/i.test(String(s.id ?? "")),
  );
  const healedCore = enrichHtmlPairDeliverableSlots(must, goal, manifest.capabilitySlug);
  recordStabilityEvent({
    event: "sdm_heal_research_lite",
    reason: "enforce",
    detail: { slug: String(manifest.capabilitySlug ?? "") },
  });
  return {
    manifest: {
      ...manifest,
      manifestVersion: manifest.manifestVersion + 1,
      slots: [...healedCore, ...dataSources],
      healResearchLiteApplied: true,
      supersedes: { manifestVersion: manifest.manifestVersion, diff: "replace" },
    },
    changed: true,
    mode,
    healed: true,
  };
}

export type CompileSessionManifestInput = {
  userGoal: string;
  capabilitySlug?: string;
  majorCategory?: string;
  profileId?: string;
  turnId?: string;
  previousManifest?: SessionDeliverableManifest;
  previousContract?: TaskGoalContract;
  taskArtifactDir?: string;
  taskDirKey?: string;
  /** PD-SAAS-FORK: P0-1 exact capability file-completion mode. */
  completionMode?: CapabilityCompletionMode;
  /** PD-SAAS-FORK: expensive intent fuse choice for compile overlay. */
  expensiveIntentChosen?: "keep_must_deliver" | "switch_to_ppt";
  /** PD-SAAS-FORK: N2 Bot steward sessions skip SDM. Missing kind must still compile. */
  sessionKind?: string | null;
};

export type SdmProgress = {
  done: number;
  total: number;
  currentLabel?: string;
};

const NUMBERED_LINE =
  /^\s*(?:\d+[.、)]\s*|\(\d+\)\s*|第\s*\d+\s*[步段项点][:：]?\s*)(.+)$/;

const EXPLICIT_DELIVERABLE_FILE_HINT =
  /[\w\u4e00-\u9fff.-]+\.(?:md|markdown|html?|pdf|docx?|pptx?|json(?:ld)?|png|jpe?g|csv|xlsx?)\b/i;

/** Goals that cite a concrete filename can compile SDM even when deliverable heuristics miss short phrasing. */
const ANCHOR_META_QUESTION =
  /(?:这.{0,12}是本任务的吗|结果.{0,8}对吗|是不是.{0,8}文件|这两个.{0,8}对吗|对吗\？\？)/i;

/** PD-SAAS-FORK (ROG Phase 7 G4): drop meta/clarification follow-ups from SDM anchor. */
const ANCHOR_VIDEO_CORRECTION =
  /(?:不是\s*html|不要\s*html|别用\s*html|要用千问|要用\s*ai\s*视频|happyhorse|文生视频|generate_video|不是\s*录屏)/i;

/** PD-SAAS-FORK (0713): strip infra/task-resume injections from SDM anchor. */
const TASK_RESUME_ANCHOR = /<task-resume[\s>]/i;

export function extractUserGoalFromTaskResume(text: string): string | undefined {
  const trimmed = String(text ?? "").trim();
  if (!TASK_RESUME_ANCHOR.test(trimmed)) return undefined;
  const match = trimmed.match(/<user_goal>\s*([\s\S]*?)\s*<\/user_goal>/i);
  const extracted = match?.[1]?.trim();
  return extracted || undefined;
}

export function sanitizeSessionGoalAnchor(text: string): string {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return trimmed;
  if (!envFlagEnabled("PILOTDECK_ANCHOR_SANITIZE", true)) return trimmed.slice(0, 2000);
  const fromResume = extractUserGoalFromTaskResume(trimmed);
  if (fromResume) return fromResume.slice(0, 2000);
  if (TASK_RESUME_ANCHOR.test(trimmed)) return "";
  if (ANCHOR_META_QUESTION.test(trimmed)) return "";
  if (ANCHOR_VIDEO_CORRECTION.test(trimmed) && trimmed.length < 120) return "";
  return trimmed.slice(0, 2000);
}

function resolveCompileUserGoal(rawGoal: string): string {
  const trimmed = String(rawGoal ?? "").trim();
  if (!trimmed) return trimmed;
  const withoutLaunch = stripLaunchContextAndAttachmentBlocks(trimmed);
  const sanitized = sanitizeSessionGoalAnchor(withoutLaunch || trimmed);
  return sanitized || withoutLaunch || trimmed;
}

function envFlagEnabled(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null) return fallback;
  const value = raw.trim().toLowerCase();
  if (value === "0" || value === "false" || value === "off") return false;
  if (value === "1" || value === "true" || value === "on") return true;
  return fallback;
}

export function goalHasExplicitDeliverableFileHint(userGoal: string): boolean {
  return EXPLICIT_DELIVERABLE_FILE_HINT.test(String(userGoal ?? ""));
}

const PATH_IN_LABEL =
  /([^\s/\\]+\.(?:md|markdown|html?|docx|pptx|pdf|png|jpe?g|webp))/i;

export function parseNumberedDeliverableList(userGoal: string): SessionDeliverableSlot[] {
  return parseNumberedLinesToSlots(resolveNumberedParseScope(userGoal)).map((slot) => ({
    ...slot,
    label: semanticSlotLabel({
      label: slot.label,
      kind: slot.kind,
      pathHint: slot.pathHint,
    }),
  }));
}

function slugifyId(label: string): string {
  return label
    .replace(/[^\w\u4e00-\u9fff]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32)
    .toLowerCase() || "item";
}

function inferKindFromLabel(label: string): AcceptanceArtifactKind | undefined {
  const text = label.toLowerCase();
  if (/\.bento\.html$/i.test(text) || /\bdeck\.bento\b/.test(text)) return "html";
  if (/ppt|幻灯|pptx/.test(text)) return "pptx";
  if (/word|docx/.test(text)) return "docx";
  if (/pdf/.test(text)) return "pdf";
  if (/html|网页|官网|落地页/.test(text)) return "html";
  if (/脚本|口播|分镜|旁白|台词|讲稿/.test(text) && !/(?:成片|\.mp4\b|文生视频)/.test(text)) {
    return "markdown";
  }
  if (/markdown|\.md|调研|brief|报告|文案|社媒|多平台|草稿|监测|复盘/.test(text)) return "markdown";
  if (/海报|主视觉|配图|png|jpg|生图/.test(text)) return "image";
  if (/视频|mp4/.test(text)) return "video";
  return undefined;
}

function slotsFromProfile(profileId: string): SessionDeliverableSlot[] {
  const profile = listDeliverableProfiles().find((entry) => entry.id === profileId);
  if (!profile) return [];
  const groups = profile.requiredBasenameGroups?.length
    ? profile.requiredBasenameGroups
    : (profile.requiredArtifacts ?? profile.requiredBasenames ?? []).map((b) => [b]);
  return groups.map((group, index) => {
    const hint = group[0] ?? `deliverable-${index + 1}`;
    const kind = inferKindFromLabel(hint);
    const pathHints = group.map((name) => name.trim()).filter(Boolean);
    return {
      id: `profile_${profileId}_${index + 1}`,
      label: semanticSlotLabel({ label: hint, kind, pathHint: hint }),
      pathHint: hint,
      pathHints,
      required: true,
      status: index === 0 ? "active" : "pending",
      kind,
    } satisfies SessionDeliverableSlot;
  });
}

function resolveSdmCompileProfile(
  capabilitySlug: string | undefined,
  majorCategory: string | undefined | null,
  userGoal: string,
) {
  const normalized = String(capabilitySlug ?? "").trim().toLowerCase();
  if (
    normalized === "mkt-last30days"
    && isCapabilityScopeV2EnforcedForSlug(normalized)
  ) {
    return resolveProfile(capabilitySlug, majorCategory, userGoal);
  }
  if (normalized) {
    for (const profile of listDeliverableProfiles()) {
      if (!profile.requiredBasenameGroups?.length) continue;
      if (
        profile.id === "last30days"
        && !isCapabilityScopeV2EnforcedForSlug(normalized)
      ) {
        continue;
      }
      if (profile.exactSlugs?.some((slug) => slug.toLowerCase() === normalized)) {
        return profile;
      }
      if ((profile.slugPrefixes ?? []).some((prefix) => normalized === prefix || normalized.startsWith(prefix))) {
        return profile;
      }
    }
  }
  return resolveProfile(capabilitySlug, majorCategory, userGoal);
}

const FLYWHEEL_PHANTOM_SLOT_RE = /(?:01-topics|02-longform|03-social-slices)/i;
const GENERIC_PHANTOM_SLOT_LABEL_RE = /^(?:成果文件|deliverable|交付物)$/i;

/** PD-SAAS-FORK three-case RCA P0-C: drop flywheel phantom slots for matrix goals. */
export function stripFlywheelPhantomSlots(
  slots: SessionDeliverableSlot[],
): SessionDeliverableSlot[] {
  return slots.filter((slot) => {
    if (slot.status === "removed") return false;
    const text = `${slot.label} ${slot.pathHint ?? ""} ${(slot.pathHints ?? []).join(" ")}`;
    return !FLYWHEEL_PHANTOM_SLOT_RE.test(text);
  });
}

/** PD-SAAS-FORK three-case RCA P0-C C5: drop label-only phantom rows. */
export function stripGenericPhantomSlots(
  slots: SessionDeliverableSlot[],
): SessionDeliverableSlot[] {
  return slots.filter((slot) => {
    if (slot.status === "removed") return false;
    if (slot.pathHint?.trim()) return true;
    if (slot.pathHints?.some((hint) => hint.trim())) return true;
    const label = String(slot.label ?? "").trim();
    if (!label) return false;
    return !GENERIC_PHANTOM_SLOT_LABEL_RE.test(label);
  });
}

/** PD-SAAS-FORK Razer RCA: polluted pathHints + generic phantoms. */
export function stripPollutedPathHintSlots(
  slots: SessionDeliverableSlot[],
): SessionDeliverableSlot[] {
  return sanitizePollutedPathHints(stripGenericPhantomSlots(slots));
}

function applyMatrixManifestSanitize(
  slots: SessionDeliverableSlot[],
  userGoal: string,
  profileId?: string,
): { slots: SessionDeliverableSlot[]; profileId?: string } {
  let nextSlots = stripPollutedPathHintSlots(slots);
  const authorityTemplateId = detectChecklistAuthorityTemplateId(userGoal);
  if (authorityTemplateId === "one-article-matrix") {
    nextSlots = stripFlywheelPhantomSlots(nextSlots);
    return { slots: stripGenericPhantomSlots(nextSlots), profileId: "one-article-matrix" };
  }
  if (!detectContentMatrixTurn(userGoal) || isExplicitContentFlywheelContractGoal(userGoal)) {
    return { slots: nextSlots, profileId };
  }
  nextSlots = stripFlywheelPhantomSlots(nextSlots);
  nextSlots = stripGenericPhantomSlots(nextSlots);
  const nextProfileId = profileId === "content_flywheel" ? "social_matrix" : profileId;
  return { slots: nextSlots, profileId: nextProfileId };
}

export function compileSessionDeliverableManifest(
  input: CompileSessionManifestInput,
): SessionDeliverableManifest | null {
  // PD-SAAS-FORK: N2 Bot steward — skip SDM only when sessionKind is explicitly n2_bot.
  if (shouldSkipDeliverableContract(input.sessionKind)) return null;
  if (!isSessionDeliverableManifestEnabled()) return null;
  if (input.completionMode === "consultation") return null;
  const userGoal = resolveCompileUserGoal(String(input.userGoal ?? ""));
  if (!userGoal) return null;

  // PD-SAAS-FORK: expensive intent fuse — enforce strips imperative PPT from compileGoal only.
  // sessionGoalAnchor always stays the user/safe anchor (never rewritten by overlay).
  const fuse = resolveExpensiveIntentCompileGoal({
    userGoal,
    mode: isExpensiveIntentClarifyMode(),
    chosen: input.expensiveIntentChosen ?? input.previousManifest?.expensiveIntentChosen ?? null,
  });
  if (fuse.conflict && isExpensiveIntentClarifyMode() === "shadow") {
    recordStabilityEvent({
      event: "expensive_intent_conflict_shadow",
      detail: {
        fingerprint: EXPENSIVE_INTENT_PPT_VS_FILES,
        mode: "shadow",
        stripped: false,
        ask: false,
      },
    });
  }

  // PD-SAAS-FORK workbench yield: synthetic must-deliver overlays compile input only.
  // sessionGoalAnchor always stays the user/safe anchor (never rewritten by contract).
  const briefResolved = resolveEffectiveCompileGoal({
    userAnchor: fuse.compileGoal,
    capabilitySlug: input.capabilitySlug,
    majorCategory: input.majorCategory,
  });
  const compileGoal = briefResolved.compileGoal;
  recordBriefContractTelemetry({
    turnId: input.turnId,
    contract: briefResolved.contract,
    mode: briefResolved.mode,
    applied: briefResolved.applied,
  });

  const numberedPreview = parseNumberedDeliverableList(compileGoal);
  const impliesDeliverable = userGoalImpliesDeliverable(compileGoal)
    || userGoalImpliesDeliverable(userGoal);
  const profile = resolveSdmCompileProfile(
    input.capabilitySlug,
    input.majorCategory,
    compileGoal,
  );
  const profileHasBasenameGroups = Boolean(
    input.capabilitySlug
    && profile?.requiredBasenameGroups?.length,
  );
  const legacyLast30daysContract = /last30days/i.test(compileGoal)
    && !isCapabilityScopeV2EnforcedForSlug(input.capabilitySlug);
  if (
    !impliesDeliverable
    && numberedPreview.length === 0
    && !isCampaignFullCaseGoal(compileGoal)
    && !detectContentMatrixTurn(compileGoal)
    && !isBrandGeoFullCaseGoal(compileGoal)
    && !goalHasExplicitDeliverableFileHint(compileGoal)
    && !profileHasBasenameGroups
    && !legacyLast30daysContract
  ) {
    return null;
  }

  const lockedProfileId = input.previousManifest?.profileId;
  const pptRouteProfileId = resolvePptHubRouteProfileId(input.capabilitySlug, compileGoal);
  let profileId = isTier0LockedProfileId(lockedProfileId)
    ? lockedProfileId
    : isPptRouteLockedProfileId(lockedProfileId)
      ? lockedProfileId
      : (pptRouteProfileId ?? input.profileId ?? profile?.id);

  if (
    profileId === "geo"
    && numberedPreview.length > 0
    && !shouldBindGeoProfileForGoal(compileGoal, input.capabilitySlug)
  ) {
    profileId = input.profileId ?? resolveProfile(
      input.capabilitySlug,
      input.majorCategory,
      compileGoal,
    )?.id;
    if (profileId === "geo" && !shouldBindGeoProfileForGoal(compileGoal, input.capabilitySlug)) {
      profileId = undefined;
    }
  }

  const authorityTemplateId = detectChecklistAuthorityTemplateId(compileGoal, input.capabilitySlug);
  if (authorityTemplateId && profileId === "geo") {
    profileId = undefined;
  }
  if (authorityTemplateId === "viral-article-pack") {
    profileId = "viral_article_pack";
  } else if (authorityTemplateId === "one-article-matrix") {
    profileId = "one-article-matrix";
  } else if (authorityTemplateId === "brand-campaign-full" || authorityTemplateId === "product-launch-full") {
    profileId = "campaign";
  } else if (authorityTemplateId === "research-report") {
    profileId = "research";
  }

  // Prefer brief-contract slug hint only when enforce applied (shadow must not change slots).
  const effectiveCapabilitySlug = input.capabilitySlug
    ?? (briefResolved.applied ? briefResolved.contract.capabilitySlugHint : undefined);

  let slots: SessionDeliverableSlot[] = resolveAuthoritativeSdmSlots({
    userGoal: compileGoal,
    capabilitySlug: effectiveCapabilitySlug ?? input.capabilitySlug,
    profileId,
    parseNumberedList: parseNumberedDeliverableList,
    mergeWithProfile: mergeNumberedSlotsWithProfile,
  });

  if (slots.length === 0) {
    const contract = buildTaskGoalContract({
      userGoal,
      capabilitySlug: input.capabilitySlug,
      majorCategory: input.majorCategory,
      profileId,
      completionMode: input.completionMode,
    });
    slots = contract.requiredFiles.map((file, index) => {
      const kind = inferKindFromLabel(file);
      return {
        id: `required_file_${index + 1}`,
        label: semanticSlotLabel({ label: file, kind, pathHint: file }),
        pathHint: file,
        required: true,
        status: index === 0 ? "active" : "pending",
        kind,
      };
    });
    if (slots.length === 0 && contract.expectedKinds.length > 0) {
      slots = contract.expectedKinds.map((kind, index) => {
        const legacyHint = defaultPathHintForKind(kind);
        const suggested = resolveSuggestedBasename(
          { kind, pathHint: legacyHint },
          {
            userGoal: compileGoal,
            capabilitySlug: input.capabilitySlug,
            profileId,
          },
        );
        const pathHints = [...new Set([suggested, legacyHint].filter((hint): hint is string => Boolean(hint)))];
        const pathHint = suggested ?? legacyHint;
        return {
          id: `required_${kind}_${index + 1}`,
          label: semanticSlotLabel({ kind, pathHint }),
          kind,
          pathHint,
          ...(pathHints.length ? { pathHints } : {}),
          required: true,
          count: contract.minCount,
          status: index === 0 ? "active" : "pending",
        };
      });
    }
  }

  if (slots.length === 0) return null;

  const prev = input.previousManifest;
  const goalVersion = input.previousContract?.goalVersion ?? 1;

  const prevAnchorRaw = prev?.sessionGoalAnchor?.trim();
  const safePrevAnchor = prevAnchorRaw && !TASK_RESUME_ANCHOR.test(prevAnchorRaw)
    ? prevAnchorRaw
    : undefined;
  const sanitizedAnchor = sanitizeSessionGoalAnchor(userGoal);
  const anchorSource = safePrevAnchor ?? (sanitizedAnchor || userGoal.slice(0, 2000));

  const normalizedSlots = applyDeliverableChineseFilenamePolicy(
    slots.map((slot) => {
    const pathHint = slot.pathHint ? sdmBasename(normalizeSdmPath(slot.pathHint)) : slot.pathHint;
    const pathHints = slot.pathHints?.map((hint) => sdmBasename(normalizeSdmPath(hint)));
    return {
      ...slot,
      ...(pathHint ? { pathHint } : {}),
      ...(pathHints?.length ? { pathHints } : {}),
    };
    }),
    {
      displayLabel: parseDisplayLabelFromUserGoal(userGoal),
      profileId,
      capabilitySlug: input.capabilitySlug,
      userGoal,
      lockedBasenames: slots
        .filter((slot) => String(slot.id ?? "").startsWith("must_deliver_"))
        .map((slot) => sdmBasename(slot.pathHint ?? ""))
        .filter(Boolean),
    },
  );

  // PD-SAAS-FORK: every deliverable manifest includes machine-readable source trace.
  const slotsWithDataSources = appendUniversalDataSourcesSlot(
    normalizedSlots,
    input.taskArtifactDir,
  );

  const sanitized = applyMatrixManifestSanitize(
    slotsWithDataSources,
    userGoal,
    profileId,
  );
  profileId = sanitized.profileId;
  const finalSlots = sanitized.slots;

  const baseManifest: SessionDeliverableManifest = {
    manifestVersion: prev ? prev.manifestVersion + 1 : 1,
    goalVersion: prev ? (input.previousContract?.goalVersion ?? prev.goalVersion) : 1,
    sessionGoalAnchor: anchorSource,
    slots: finalSlots,
    profileId,
    capabilitySlug: input.capabilitySlug,
    ...(input.completionMode ? { completionMode: input.completionMode } : {}),
    compiledAtTurnId: input.turnId,
    currentStageId: normalizedSlots[0]?.stageId,
    repairCircuit: prev?.repairCircuit,
    baselineLocked: Boolean(
      prev?.baselineLocked
      || isTier0LockedProfileId(profileId)
      || normalizedSlots.length >= 2,
    ),
    ...(input.taskArtifactDir ? { taskArtifactDir: input.taskArtifactDir } : {}),
    ...(input.taskDirKey ? { taskDirKey: input.taskDirKey } : {}),
    ...(prev?.expensiveIntentHandled
      ? {
          expensiveIntentFingerprint: prev.expensiveIntentFingerprint,
          expensiveIntentHandled: prev.expensiveIntentHandled,
          expensiveIntentChosen: prev.expensiveIntentChosen,
        }
      : {}),
    supersedes: prev
      ? { manifestVersion: prev.manifestVersion, diff: "initial" }
      : undefined,
  };

  return applyParallelGroupHints(baseManifest, userGoal);
}

export function applyGoalMutationToManifest(
  manifest: SessionDeliverableManifest,
  mutation: GoalMutationResult,
  turnId?: string,
): SessionDeliverableManifest | null {
  if (!mutation.mutated) return null;
  const slots = manifest.slots.map((slot) => ({ ...slot }));

  // PD-SAAS-FORK P0-2: quality-only add/replace shares goalVersion but never
  // changes SDM slot identity, label, count, kind, or path hints.
  if (mutation.qualityOnly && mutation.action) {
    const nextRepairCircuit = mutation.visualCorrection && manifest.repairCircuit
      ? {
          ...manifest.repairCircuit,
          gapCounts: Object.fromEntries(
            Object.entries(manifest.repairCircuit.gapCounts).filter(
              ([gapKey]) => gapKey !== "visual_asset.unbound_in_deliverable",
            ),
          ),
          tripped: Object.values(
            Object.fromEntries(
              Object.entries(manifest.repairCircuit.gapCounts).filter(
                ([gapKey]) => gapKey !== "visual_asset.unbound_in_deliverable",
              ),
            ),
          ).some((count) => count >= 3)
            ? manifest.repairCircuit.tripped
            : false,
        }
      : manifest.repairCircuit;
    return {
      ...manifest,
      manifestVersion: manifest.manifestVersion + 1,
      goalVersion: manifest.goalVersion + 1,
      slots,
      repairCircuit: nextRepairCircuit,
      compiledAtTurnId: turnId ?? manifest.compiledAtTurnId,
      supersedes: {
        manifestVersion: manifest.manifestVersion,
        diff: mutation.action,
      },
    };
  }

  switch (mutation.action) {
    case "remove": {
      for (const slot of slots) {
        if (mutation.targetSlotId && slot.id === mutation.targetSlotId) {
          slot.status = "removed";
          continue;
        }
        if (mutation.targetSlotId === "profile_geo_platform") {
          const hints = slot.pathHints ?? (slot.pathHint ? [slot.pathHint] : []);
          const isPlatform = slot.id === "profile_geo_platform"
            || hints.some((hint) => /zhihu|xiaohongshu|wechat|platform/i.test(hint));
          if (isPlatform) {
            slot.status = "removed";
            continue;
          }
        }
        if (mutation.targetKind && slot.kind === mutation.targetKind) {
          slot.status = "removed";
        } else if (mutation.targetLabel && slot.label.includes(mutation.targetLabel)) {
          slot.status = "removed";
        }
      }
      break;
    }
    case "replace": {
      for (const slot of slots) {
        if (slot.status === "removed") continue;
        if (mutation.fromKind && slot.kind === mutation.fromKind) {
          slot.kind = mutation.toKind;
          if (mutation.toPathHint) slot.pathHint = mutation.toPathHint;
          if (mutation.toLabel) slot.label = mutation.toLabel;
        }
      }
      break;
    }
    case "add": {
      const additions = mutation.addSlots?.length
        ? mutation.addSlots
        : [{
            addKind: mutation.addKind,
            addLabel: mutation.addLabel,
            addPathHint: mutation.addPathHint,
            addPathHints: mutation.addPathHints,
          }];
      for (const [index, item] of additions.entries()) {
        const addKind = item.addKind;
        const pathHint = item.addPathHint ?? (addKind ? defaultPathHintForKind(addKind) : undefined);
        const pathHints = item.addPathHints?.length ? item.addPathHints : undefined;
        slots.push({
          id: `added_${manifest.manifestVersion + 1}_${Date.now()}_${index}`,
          label: semanticSlotLabel({
            label: item.addLabel ?? (addKind ? defaultAddLabelForKind(addKind) : undefined),
            kind: addKind,
            pathHint,
          }),
          kind: addKind,
          pathHint,
          ...(pathHints ? { pathHints } : {}),
          required: true,
          status: "active",
        });
      }
      break;
    }
    case "prune": {
      const keepOnly = new Set(mutation.keepOnlyKinds ?? []);
      for (const slot of slots) {
        if (slot.status === "removed") continue;
        if (mutation.pruneAccumulated && (slot.id.startsWith("accumulated-") || slot.id.startsWith("added_"))) {
          slot.status = "removed";
          continue;
        }
        if (keepOnly.size > 0 && slot.kind && !keepOnly.has(slot.kind)) {
          if (slot.id === "universal_data_sources") continue;
          slot.status = "removed";
        }
      }
      break;
    }
    default:
      return null;
  }

  return {
    ...manifest,
    manifestVersion: manifest.manifestVersion + 1,
    goalVersion: manifest.goalVersion + 1,
    slots,
    compiledAtTurnId: turnId ?? manifest.compiledAtTurnId,
    supersedes: { manifestVersion: manifest.manifestVersion, diff: mutation.action },
  };
}

export function updateSessionManifestOnUserMessage(input: {
  userText: string;
  previousManifest?: SessionDeliverableManifest;
  capabilitySlug?: string;
  majorCategory?: string;
  turnId?: string;
  completionMode?: CapabilityCompletionMode;
  pendingFingerprint?: string | null;
  sessionKind?: string | null;
}): SessionDeliverableManifest | null {
  if (shouldSkipDeliverableContract(input.sessionKind)) return null;
  if (!isSessionDeliverableManifestEnabled()) return null;
  if (input.completionMode === "consultation") return null;
  const text = String(input.userText ?? "").trim();
  if (!text) return null;

  const previousContract = input.previousManifest
    ? buildTaskGoalContractFromManifest(input.previousManifest)
    : undefined;

  const pendingFingerprint = input.pendingFingerprint
    ?? (input.previousManifest?.expensiveIntentFingerprint && !input.previousManifest.expensiveIntentHandled
      ? input.previousManifest.expensiveIntentFingerprint
      : null);
  const fuseReply = resolveExpensiveIntentConflictReply(text, pendingFingerprint ?? null);
  if (fuseReply.handled && input.previousManifest) {
    recordStabilityEvent({
      event: fuseReply.fallbackReason
        ? "expensive_intent_conflict_fallback"
        : "expensive_intent_conflict_resolved",
      detail: {
        fingerprint: EXPENSIVE_INTENT_PPT_VS_FILES,
        mode: isExpensiveIntentClarifyMode(),
        ...(fuseReply.chosen ? { chosen: fuseReply.chosen } : {}),
        ...(fuseReply.fallbackReason ? { fallbackReason: fuseReply.fallbackReason } : {}),
      },
    });
    if (fuseReply.chosen === "switch_to_ppt") {
      const added = applyGoalMutationToManifest(input.previousManifest, {
        mutated: true,
        action: "add",
        addKind: "pptx",
        addLabel: "演示稿",
        addPathHint: "presentation.pptx",
        addPathHints: ["presentation.pptx"],
      }, input.turnId);
      if (added) {
        return {
          ...added,
          sessionGoalAnchor: input.previousManifest.sessionGoalAnchor,
          expensiveIntentFingerprint: EXPENSIVE_INTENT_PPT_VS_FILES,
          expensiveIntentHandled: true,
          expensiveIntentChosen: "switch_to_ppt",
        };
      }
    }
    if (fuseReply.chosen === "keep_must_deliver" && isExpensiveIntentKeepShortReply(text)) {
      return {
        ...input.previousManifest,
        manifestVersion: input.previousManifest.manifestVersion + 1,
        expensiveIntentFingerprint: EXPENSIVE_INTENT_PPT_VS_FILES,
        expensiveIntentHandled: true,
        expensiveIntentChosen: "keep_must_deliver",
        compiledAtTurnId: input.turnId ?? input.previousManifest.compiledAtTurnId,
      };
    }
  }

  const mutation = detectGoalMutation({
    userText: text,
    manifest: input.previousManifest,
  });
  if (input.previousManifest && mutation.mutated) {
    const mutatedManifest = applyGoalMutationToManifest(input.previousManifest, mutation, input.turnId);
    if (mutatedManifest && fuseReply.handled) {
      return {
        ...mutatedManifest,
        expensiveIntentFingerprint: EXPENSIVE_INTENT_PPT_VS_FILES,
        expensiveIntentHandled: true,
        expensiveIntentChosen: fuseReply.chosen ?? "keep_must_deliver",
      };
    }
    return mutatedManifest;
  }

  const pivot = detectGoalPivot({
    previousContract,
    newUserText: text,
    capabilitySlug: input.capabilitySlug,
    majorCategory: input.majorCategory,
    profileId: input.previousManifest?.profileId,
  });

  if (pivot.pivot && pivot.nextContract && input.previousManifest) {
    // PD-SAAS-FORK (ROG Phase 5): pivot guard — no spurious kind-only slots on short follow-ups.
    if (isSdmPivotGuardEnabled()) {
      if (text.length < 40 && !matchesExplicitAddPattern(text)) {
        return null;
      }
      const originalSlots = input.previousManifest.slots.filter((s) => s.status !== "removed");
      const nonPivotSlots = originalSlots.filter((s) => !s.id.startsWith("pivot_"));
      if (
        nonPivotSlots.length > 0
        && nonPivotSlots.every((slot) => slot.status === "done")
      ) {
        return null;
      }
    }

    const newSlots = [...input.previousManifest.slots.filter((s) => s.status !== "removed")];
    for (const kind of pivot.nextContract.expectedKinds) {
      if (newSlots.some((s) => s.kind === kind && s.status !== "removed")) continue;
      const pathHint = pivot.nextContract.requiredFiles.find((file) =>
        inferKindFromLabel(file) === kind,
      );
      if (isSdmPivotGuardEnabled() && !pathHint && !matchesExplicitAddPattern(text)) {
        continue;
      }
      newSlots.push({
        id: `pivot_${kind}_${input.previousManifest.manifestVersion + 1}`,
        label: semanticSlotLabel({ kind, pathHint }),
        kind,
        required: true,
        status: "active",
        ...(pathHint ? { pathHint } : {}),
      });
    }
    for (const file of pivot.nextContract.requiredFiles) {
      if (newSlots.some((s) => s.pathHint === file)) continue;
      newSlots.push({
        id: `pivot_file_${file}`,
        label: semanticSlotLabel({ label: file, pathHint: file, kind: inferKindFromLabel(file) }),
        pathHint: file,
        required: true,
        status: "active",
        kind: inferKindFromLabel(file),
      });
    }
    return {
      ...input.previousManifest,
      manifestVersion: input.previousManifest.manifestVersion + 1,
      goalVersion: pivot.nextContract.goalVersion,
      slots: newSlots,
      compiledAtTurnId: input.turnId,
      // PD-SAAS-FORK STDA: pivot allocates a fresh task root on this turn.
      taskArtifactDir: undefined,
      taskDirKey: undefined,
      supersedes: { manifestVersion: input.previousManifest.manifestVersion, diff: "pivot" },
    };
  }

  if (!input.previousManifest) {
    return compileSessionDeliverableManifest({
      userGoal: text,
      capabilitySlug: input.capabilitySlug,
      majorCategory: input.majorCategory,
      turnId: input.turnId,
      completionMode: input.completionMode,
      sessionKind: input.sessionKind,
    });
  }

  return null;
}

export function buildTaskGoalContractFromManifest(
  manifest: SessionDeliverableManifest,
): TaskGoalContract {
  const activeSlots = manifest.slots.filter((s) => s.status !== "removed");
  const kinds = [...new Set(activeSlots.map((s) => s.kind).filter(Boolean))] as AcceptanceArtifactKind[];
  const requiredFiles = activeSlots
    .map((s) => s.pathHint)
    .filter((p): p is string => Boolean(p));
  const countSlot = activeSlots.find((s) => s.count && s.count > 0);
  return buildTaskGoalContract({
    userGoal: manifest.sessionGoalAnchor,
    previousContract: manifest.goalVersion > 1
      ? {
          goalVersion: manifest.goalVersion - 1,
          sourceGoal: manifest.sessionGoalAnchor,
          expectedKinds: kinds,
          requiredFiles,
          qualityChecks: ["exists"],
        }
      : undefined,
    capabilitySlug: manifest.capabilitySlug,
    profileId: manifest.profileId,
  });
}

export function buildExpectedManifestFromSdm(
  manifest: SessionDeliverableManifest,
): Array<Record<string, unknown>> {
  return manifest.slots
    .filter((slot) => slot.status !== "removed")
    .map((slot) => {
      const row: Record<string, unknown> = {
        id: slot.id,
        label: slot.label,
        required: slot.required,
      };
      if (slot.kind) row.kind = slot.kind;
      if (slot.count) row.count = slot.count;
      if (slot.pathHint) row.path = slot.pathHint;
      if (slot.pathHints?.length) row.pathHints = slot.pathHints;
      if (slot.resolvedPath) row.resolvedPath = slot.resolvedPath;
      if (slot.stageId) row.stageId = slot.stageId;
      return row;
    });
}

export function computeSdmProgress(
  manifest: SessionDeliverableManifest,
  verifiedPaths: string[] = [],
): SdmProgress {
  const active = manifest.slots.filter(
    (s) => s.status !== "removed" && s.required !== false,
  );
  const total = active.length;
  let done = 0;
  let currentLabel: string | undefined;
  const validationOptions = buildSdmSlotValidationOptions(manifest, active);
  for (const slot of active) {
    if (slotSatisfiedByValidation(slot, verifiedPaths, validationOptions)) {
      done += 1;
    } else if (!currentLabel) {
      currentLabel = slot.label;
    }
  }
  return { done, total, currentLabel };
}

function buildSdmSlotValidationOptions(
  manifest: SessionDeliverableManifest,
  slots: SessionDeliverableSlot[] = manifest.slots,
): { htmlSlotCount?: number; taskArtifactDir?: string } {
  const active = slots.filter((s) => s.status !== "removed" && s.required !== false);
  const htmlSlotCount = active.filter(
    (s) => s.kind === "html" && !s.id.startsWith("added_"),
  ).length;
  return {
    htmlSlotCount: htmlSlotCount > 0 ? htmlSlotCount : undefined,
    taskArtifactDir: manifest.taskArtifactDir,
  };
}

/** PD-SAAS-FORK: drop missing paths tied to removed SDM slots (e.g. cancelled platform drafts). */
export function filterMissingPathsAgainstManifest(
  manifest: SessionDeliverableManifest | undefined,
  missing: string[],
): string[] {
  if (!manifest?.slots?.length || missing.length === 0) return missing;
  const removedHints = new Set<string>();
  const removedBasenameFragments = new Set<string>();
  for (const slot of manifest.slots) {
    if (slot.status !== "removed") continue;
    if (slot.pathHint) removedHints.add(normalizeSdmPathForFilter(slot.pathHint));
    for (const hint of slot.pathHints ?? []) {
      removedHints.add(normalizeSdmPathForFilter(hint));
    }
    if (slot.id === "profile_geo_platform") {
      for (const fragment of ["zhihu", "xiaohongshu", "wechat", "platform", "公众号", "小红书", "知乎"]) {
        removedBasenameFragments.add(fragment.toLowerCase());
      }
    }
  }
  if (removedHints.size === 0 && removedBasenameFragments.size === 0) return missing;
  return missing.filter((raw) => {
    const norm = normalizeSdmPathForFilter(raw);
    const base = basenameForFilter(norm).toLowerCase();
    for (const hint of removedHints) {
      if (pathsEqualForFilter(norm, hint) || norm.includes(hint) || hint.includes(norm)) {
        return false;
      }
    }
    for (const fragment of removedBasenameFragments) {
      if (base.includes(fragment) || norm.toLowerCase().includes(fragment)) return false;
    }
    return true;
  });
}

/** PD-SAAS-FORK ES9 P1: drop baseline-locked phantom missing paths that match no SDM slot. */
export function filterPhantomMissingAgainstBaseline(
  manifest: SessionDeliverableManifest | undefined,
  missing: string[],
): string[] {
  if (!manifest?.baselineLocked || missing.length === 0) return missing;
  const active = manifest.slots.filter((slot) => slot.status !== "removed");
  if (active.length === 0) return missing;
  return missing.filter((raw) => {
    const norm = normalizeSdmPathForFilter(raw);
    return active.some((slot) => pathSatisfiesSdmSlot(norm, slot));
  });
}

function normalizeSdmPathForFilter(p: string): string {
  return String(p ?? "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function basenameForFilter(p: string): string {
  const norm = normalizeSdmPathForFilter(p);
  const idx = norm.lastIndexOf("/");
  return idx >= 0 ? norm.slice(idx + 1) : norm;
}

function pathsEqualForFilter(a: string, b: string): boolean {
  return normalizeSdmPathForFilter(a).toLowerCase() === normalizeSdmPathForFilter(b).toLowerCase();
}

export function resolveLatestSessionManifestFromEntries(
  entries: AgentTranscriptEntry[],
): SessionDeliverableManifest | undefined {
  let latest: SessionDeliverableManifest | undefined;
  for (const entry of entries) {
    if (entry.type !== "session_deliverable_manifest") continue;
    latest = entry.manifest;
  }
  return latest;
}

const TEMPLATE_SLOT_BASENAMES = new Set([
  "ad-copy-templates.md",
]);

const BODY_ARTIFACT_PATH =
  /(?:artifacts\/[^\s`"'<>[\]|]+|[^\s/\\]+\/artifacts\/[^\s`"'<>[\]|]+)/gi;

function isTemplateSkillSlot(slot: SessionDeliverableSlot): boolean {
  const hint = slot.pathHint ?? "";
  if (!hint) return false;
  const norm = normalizeSdmPath(hint).toLowerCase();
  if (/(^|\/)references\//.test(norm) || /(^|\/)skills\//.test(norm)) return true;
  return TEMPLATE_SLOT_BASENAMES.has(sdmBasename(norm).toLowerCase());
}

export function isRealArtifactDeliverablePath(path: string): boolean {
  const norm = normalizeSdmPath(path).toLowerCase();
  if (!norm.includes("artifacts/")) return false;
  if (/(^|\/)references\//.test(norm) || /(^|\/)skills\//.test(norm)) return false;
  return !TEMPLATE_SLOT_BASENAMES.has(sdmBasename(norm).toLowerCase());
}

/** Extract explicit artifact paths cited in assistant text (current turn body). */
export function extractBodyDeliverablePathsFromText(text: string): string[] {
  const matches = String(text ?? "").match(BODY_ARTIFACT_PATH) ?? [];
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const raw of matches) {
    const path = normalizeSdmPath(raw.replace(/^[`"'[(]+|[`"')\]]+$/g, "").trim());
    const key = path.toLowerCase();
    if (!path || seen.has(key)) continue;
    seen.add(key);
    paths.push(path);
  }
  return paths;
}

/** When true, turn-end reconcile must not add ad-hoc verified_* slots (baseline locked at task start). */
export function shouldLockSessionDeliverableBaseline(
  manifest: SessionDeliverableManifest,
): boolean {
  if (manifest.baselineLocked) return true;
  if (manifest.slots.some((slot) => slot.stageId)) return true;
  // PD-SAAS-FORK: 任意非空初始 manifest 即冻结，禁止 turn 末 verified_* 扩必交槽
  return manifest.slots.filter((slot) => slot.status !== "removed").length >= 1;
}

/**
 * PR-B (R9-2): sync SDM slots with engine-verified + body paths at turn end.
 * Template/reference slots are removed when real artifacts/ files are verified.
 */
function dropPollutedResearchReportDocxForProductUserResearch(
  manifest: SessionDeliverableManifest,
  verifiedPaths: string[],
  slots: SessionDeliverableSlot[],
): boolean {
  const anchor = String(manifest.sessionGoalAnchor ?? "");
  if (!isProductUserResearchDeliverableGoal(anchor, manifest.capabilitySlug)) return false;
  if (/(?:docx|word|Word)/i.test(anchor)) return false;
  const hasMd = verifiedPaths.some((p) => /product-user-research\.md|用户研究.*\.md/i.test(p));
  const hasHtml = verifiedPaths.some((p) => /\.html?$/i.test(p));
  if (!hasMd || !hasHtml) return false;
  let changed = false;
  for (const slot of slots) {
    if (slot.id === "authority_research-report_3" && slot.kind === "docx" && slot.status !== "removed") {
      slot.status = "removed";
      changed = true;
    }
  }
  return changed;
}

/** 37319c0a RCA: strip phantom added_ HTML slots when anchor only promises marketing-deliverable.md. */
function stripPhantomAddedHtmlForSingleMdMktGoal(
  manifest: SessionDeliverableManifest,
  verifiedPaths: string[],
  slots: SessionDeliverableSlot[],
): boolean {
  const anchor = String(manifest.sessionGoalAnchor ?? "");
  if (!isSingleMarkdownMktDeliverableAnchor(anchor)) return false;
  const mdVerified = verifiedPaths.some((p) => /marketing-deliverable\.md/i.test(p))
    || slots.some(
      (slot) => slot.status !== "removed"
        && /marketing-deliverable\.md/i.test(slot.pathHint ?? "")
        && slot.status === "done",
    );
  if (!mdVerified) return false;
  let changed = false;
  for (const slot of slots) {
    if (slot.status === "removed") continue;
    if (slot.kind === "html" && slot.id.startsWith("added_")) {
      slot.status = "removed";
      changed = true;
    }
  }
  return changed;
}

export function reconcileSlotsWithVerifiedPaths(
  manifest: SessionDeliverableManifest,
  verifiedPaths: string[],
  bodyPaths: string[] = [],
): { manifest: SessionDeliverableManifest; changed: boolean } {
  const healed = maybeHealToxicResearchLiteManifest(manifest, verifiedPaths);
  let working = healed.manifest;
  let changed = healed.changed;

  const allPaths = [...new Set(
    [...verifiedPaths, ...bodyPaths].map((p) => normalizeSdmPath(p)).filter(Boolean),
  )];
  const slots = working.slots.map((slot) => ({ ...slot }));
  if (dropPollutedResearchReportDocxForProductUserResearch(working, verifiedPaths, slots)) {
    changed = true;
  }
  if (stripPhantomAddedHtmlForSingleMdMktGoal(working, verifiedPaths, slots)) {
    changed = true;
  }
  const validationOptions = buildSdmSlotValidationOptions(working, slots);

  for (const slot of slots) {
    if (slot.status === "removed") continue;
    if (slotSatisfiedByValidation(slot, allPaths, validationOptions) && slot.status !== "done") {
      slot.status = "done";
      changed = true;
    }
  }

  for (const slot of slots) {
    if (slot.status === "removed") continue;
    if (!slot.id.startsWith("added_") || slot.kind !== "html") continue;
    const baselineHtmlSatisfied = slots.some(
      (s) => s.status !== "removed"
        && s.kind === "html"
        && !s.id.startsWith("added_")
        && s.id !== slot.id
        && slotSatisfiedByValidation(s, allPaths, validationOptions),
    );
    if (baselineHtmlSatisfied) {
      slot.status = "removed";
      changed = true;
    }
  }

  const realVerified = verifiedPaths.filter(isRealArtifactDeliverablePath);
  if (realVerified.length > 0) {
    for (const slot of slots) {
      if (slot.status === "removed" || !isTemplateSkillSlot(slot)) continue;
      if (!slotSatisfiedByValidation(slot, allPaths, validationOptions)) {
        slot.status = "removed";
        changed = true;
      }
    }
  }

  const usedPaths = new Set<string>();
  for (const slot of slots) {
    if (slot.status === "removed") continue;
    const match = findBestVerifiedPathForSlot(slot, allPaths, usedPaths, working.taskArtifactDir);
    if (match) {
      usedPaths.add(match.toLowerCase());
      if (slot.resolvedPath !== match) {
        slot.resolvedPath = match;
        changed = true;
      }
      if (slot.status !== "done") {
        slot.status = "done";
        changed = true;
      }
    }
  }

  for (const raw of verifiedPaths) {
    const path = normalizeSdmPath(raw);
    if (!path || !isRealArtifactDeliverablePath(path)) continue;
    // PD-SAAS-FORK: glob/read_file from another task-* dir must not overwrite this manifest's slots.
    if (working.taskArtifactDir && !pathWithinPreferredScope(path, working.taskArtifactDir)) {
      continue;
    }
    if (usedPaths.has(path.toLowerCase())) continue;
    const matchedSlot = slots.find(
      (slot) => slot.status !== "removed" && pathSatisfiesSdmSlot(path, slot),
    );
    if (matchedSlot) {
      if (matchedSlot.status !== "done") {
        matchedSlot.status = "done";
        changed = true;
      }
      if (!matchedSlot.pathHint || sdmBasename(matchedSlot.pathHint) !== sdmBasename(path)) {
        const keepCanonical = isSdmGeoKeywordAliasEnabled()
          && /^keywords\.(?:md|html)$/i.test(matchedSlot.pathHint ?? "");
        if (!keepCanonical) {
          matchedSlot.pathHint = path;
          changed = true;
        }
      }
      if (matchedSlot.resolvedPath !== path) {
        matchedSlot.resolvedPath = path;
        changed = true;
      }
      usedPaths.add(path.toLowerCase());
      continue;
    }
    if (slots.some((slot) => slot.status !== "removed" && pathSatisfiesSdmSlot(path, slot))) {
      usedPaths.add(path.toLowerCase());
      continue;
    }
    if (shouldLockSessionDeliverableBaseline(working)) {
      continue;
    }
    slots.push({
      id: `verified_${working.manifestVersion + 1}_${slugifyId(sdmBasename(path))}`,
      label: semanticSlotLabel({ pathHint: path, kind: inferKindFromLabel(path) }),
      kind: inferKindFromLabel(path),
      pathHint: path,
      required: true,
      status: "done",
    });
    usedPaths.add(path.toLowerCase());
    changed = true;
  }

  // Shadow heal only sets healResearchLiteApplied — still persist marker without slot rewrite.
  if (!changed) {
    if (healed.healed && working.healResearchLiteApplied && !manifest.healResearchLiteApplied) {
      return { manifest: working, changed: true };
    }
    return { manifest: working, changed: false };
  }

  return {
    manifest: {
      ...working,
      manifestVersion: working.manifestVersion + (healed.changed ? 0 : 1),
      slots,
    },
    changed: true,
  };
}

export function hasSdmIncompleteSlots(
  manifest: SessionDeliverableManifest | undefined,
  validation: { verified?: string[]; missing?: string[]; broken?: string[] } | null | undefined,
  options?: {
    userGoal?: string;
    capabilitySlug?: string;
    majorCategory?: string | null;
  },
): boolean {
  if (!manifest || !isSessionDeliverableManifestEnabled()) return false;
  const verified = validation?.verified ?? [];
  const missing = (validation?.missing ?? []).filter((gapPath) => {
    if (/须交付|写入系统分配|HTML 综合报告|【硬性约束】/i.test(gapPath)) return false;
    return true;
  });
  const broken = validation?.broken ?? [];
  if (missing.length > 0 || broken.length > 0) return true;

  const goalText = options?.userGoal ?? manifest.sessionGoalAnchor;
  if (
    shouldTreatSdmAsComplete({
      userGoal: goalText,
      verified,
      missing,
      broken,
      sessionManifest: manifest,
      capabilitySlug: options?.capabilitySlug ?? manifest.capabilitySlug,
      majorCategory: options?.majorCategory,
      profileId: manifest.profileId,
    })
  ) {
    return false;
  }

  const progress = computeSdmProgress(manifest, verified);
  return progress.done < progress.total;
}

export function slimSessionManifestForWire(manifest: SessionDeliverableManifest): {
  manifestVersion: number;
  goalVersion: number;
  sessionGoalAnchor: string;
  slots: Array<{
    id: string;
    label: string;
    kind?: string;
    pathHint?: string;
    pathHints?: string[];
    resolvedPath?: string;
    status?: string;
    required?: boolean;
    stageId?: string;
    count?: number;
    parallelGroup?: string;
    sourcePathHint?: string;
  }>;
  profileId?: string;
  capabilitySlug?: string;
  completionMode?: CapabilityCompletionMode;
  currentStageId?: string;
  baselineLocked?: boolean;
  repairCircuit?: SessionRepairCircuitState;
} {
  return {
    manifestVersion: manifest.manifestVersion,
    goalVersion: manifest.goalVersion,
    sessionGoalAnchor: manifest.sessionGoalAnchor,
    slots: manifest.slots.map((slot) => ({
      id: slot.id,
      label: slot.label,
      kind: slot.kind,
      pathHint: slot.pathHint,
      pathHints: slot.pathHints,
      resolvedPath: slot.resolvedPath,
      status: slot.status,
      required: slot.required,
      stageId: slot.stageId,
      count: slot.count,
      parallelGroup: slot.parallelGroup,
      sourcePathHint: slot.sourcePathHint,
    })),
    profileId: manifest.profileId,
    capabilitySlug: manifest.capabilitySlug,
    completionMode: manifest.completionMode,
    currentStageId: manifest.currentStageId,
    baselineLocked: manifest.baselineLocked,
    repairCircuit: manifest.repairCircuit,
  };
}

export function formatSdmPromptSection(manifest: SessionDeliverableManifest): string {
  const lines = ["【本会话交付清单 — 不得自行增删改】"];
  for (const slot of manifest.slots) {
    if (slot.status === "removed") continue;
    const status = slot.status ?? "pending";
    lines.push(`- ${slot.label}（${slot.id}）状态=${status}${slot.pathHint ? ` 期望=${slot.pathHint}` : ""}`);
  }
  return lines.join("\n");
}

export type SlotBindingRecord = {
  slotId: string;
  label?: string;
  resolvedPath?: string;
  status: "done" | "pending";
  required?: boolean;
};

export function buildSlotBindingsFromManifest(
  manifest: SessionDeliverableManifest,
): SlotBindingRecord[] {
  return manifest.slots
    .filter((slot) => slot.status !== "removed")
    .map((slot) => ({
      slotId: slot.id,
      label: slot.label,
      resolvedPath: slot.resolvedPath,
      status: slot.status === "done" ? "done" : "pending",
      required: slot.required !== false,
    }));
}

export function computeSlotBindingsHash(bindings: SlotBindingRecord[]): string {
  const payload = bindings
    .map((row) => `${row.slotId}|${row.status}|${row.resolvedPath ?? ""}`)
    .join(";");
  let hash = 5381;
  for (let i = 0; i < payload.length; i += 1) {
    hash = ((hash << 5) + hash) ^ payload.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

/** PD-SAAS-FORK STDA: bind allocated task root onto SDM after bootstrapSessionTaskDirectory. */
function anchorManifestSlotPathHints(
  manifest: SessionDeliverableManifest,
  taskArtifactDir: string,
): SessionDeliverableSlot[] {
  return manifest.slots.map((slot) => {
    if (slot.status === "removed") return slot;
    const anchorHint = (hint: string | undefined): string | undefined => {
      const trimmed = String(hint ?? "").trim();
      if (!trimmed) return undefined;
      return reanchorSdmPathToTaskDir(trimmed, taskArtifactDir);
    };
    const pathHint = anchorHint(slot.pathHint);
    const pathHints = slot.pathHints
      ?.map((hint) => anchorHint(hint))
      .filter((hint): hint is string => Boolean(hint));
    const resolvedPath = slot.resolvedPath
      ? reanchorSdmPathToTaskDir(slot.resolvedPath, taskArtifactDir)
      : undefined;
    if (
      pathHint === slot.pathHint
      && (!pathHints || pathHints.length === slot.pathHints?.length)
      && resolvedPath === slot.resolvedPath
    ) {
      return slot;
    }
    return {
      ...slot,
      ...(pathHint ? { pathHint } : {}),
      ...(pathHints?.length ? { pathHints } : {}),
      ...(resolvedPath ? { resolvedPath } : {}),
    };
  });
}

export function attachSessionTaskDirectoryToManifest(
  manifest: SessionDeliverableManifest,
  directory: Pick<SessionDeliverableManifest, "taskArtifactDir" | "taskDirKey"> & { goalVersion?: number },
): SessionDeliverableManifest | null {
  const taskArtifactDir = directory.taskArtifactDir?.trim();
  const taskDirKey = directory.taskDirKey?.trim();
  if (!taskArtifactDir || !taskDirKey) return null;
  if (
    manifest.taskArtifactDir === taskArtifactDir
    && manifest.taskDirKey === taskDirKey
    && (directory.goalVersion === undefined || manifest.goalVersion === directory.goalVersion)
  ) {
    return null;
  }
  return {
    ...manifest,
    taskArtifactDir,
    taskDirKey,
    slots: anchorManifestSlotPathHints(manifest, taskArtifactDir),
    ...(directory.goalVersion !== undefined ? { goalVersion: directory.goalVersion } : {}),
  };
}

export function buildContractSnapshotFromManifest(
  manifest: SessionDeliverableManifest,
): { rowsHash: string; totalSlots: number; doneSlots: number } {
  const bindings = buildSlotBindingsFromManifest(manifest);
  const requiredBindings = bindings.filter((row) => row.required !== false);
  const doneSlots = requiredBindings.filter((row) => row.status === "done").length;
  return {
    rowsHash: computeSlotBindingsHash(bindings),
    totalSlots: requiredBindings.length,
    doneSlots,
  };
}

const SEQUENTIAL_TEMPLATE_SLUGS =
  /(?:saas-growth-full|brand-campaign-full|mkt-growth|geo-brand-full)/iu;

const OFFICE_EXPORT_LABEL = /pdf|word|docx|ppt|pptx|word文档|幻灯/i;

function isOfficeExportSlot(slot: SessionDeliverableSlot): boolean {
  if (slot.kind === "pdf" || slot.kind === "docx" || slot.kind === "pptx") return true;
  const text = `${slot.label} ${slot.pathHint ?? ""}`;
  return OFFICE_EXPORT_LABEL.test(text);
}

/** PD-SAAS-FORK full-chain-speed P0-2: tag office export slots for parallelGroup. */
export function applyParallelGroupHints(
  manifest: SessionDeliverableManifest,
  userGoal: string,
): SessionDeliverableManifest {
  const templateId = detectChecklistAuthorityTemplateId(userGoal, manifest.capabilitySlug);
  if (templateId === "geo-fast-check-hub") return manifest;

  // PD-SAAS-FORK three-case RCA P2: matrix platform drafts parallel after article.md.
  if (templateId === "one-article-matrix") {
    const slots = manifest.slots.map((slot) => {
      if (slot.status === "removed") return slot;
      const text = `${slot.label} ${slot.pathHint ?? ""} ${(slot.pathHints ?? []).join(" ")}`.toLowerCase();
      if (/article\.md|deep_article/.test(text)) return slot;
      if (/zhihu|xiaohongshu|wechat|douyin|bilibili|data-sources/.test(text)) {
        return { ...slot, parallelGroup: "matrix-platform-drafts" };
      }
      return slot;
    });
    return { ...manifest, slots };
  }

  // PD-SAAS-FORK three-case RCA P1-B: independent GEO stages may run in parallel (shadow).
  if (templateId === "geo-brand-full" && isParallelGeoStagesEnabled()) {
    const slots = manifest.slots.map((slot) => {
      if (slot.status === "removed") return slot;
      const text = `${slot.label} ${slot.pathHint ?? ""} ${(slot.pathHints ?? []).join(" ")}`.toLowerCase();
      if (/audit|keywords/.test(text)) {
        return { ...slot, parallelGroup: "geo-audit-keywords" };
      }
      if (/zhihu|xiaohongshu|wechat|平台成稿|platform/.test(text)) {
        return { ...slot, parallelGroup: "geo-platform-drafts" };
      }
      return slot;
    });
    return { ...manifest, slots };
  }

  // PD-SAAS-FORK P0′-1: checklist full-case templates carry their own docx slots — no office-export phantom.
  if (
    isCampaignFullCaseGoal(userGoal)
    || templateId === "brand-campaign-full"
    || templateId === "product-launch-full"
    || (templateId && SEQUENTIAL_TEMPLATE_SLUGS.test(templateId))
  ) {
    return manifest;
  }
  if (manifest.capabilitySlug && SEQUENTIAL_TEMPLATE_SLUGS.test(manifest.capabilitySlug)) {
    return manifest;
  }

  const goalLower = userGoal.toLowerCase();
  const isOfficePack =
    templateId === "md-html-office-pack"
    || isOfficeDeliverablePackGoal(userGoal);

  if (!isOfficePack) return manifest;

  const mdSlot = manifest.slots.find(
    (slot) =>
      slot.status !== "removed"
      && (slot.pathHint?.endsWith(".md") || slot.kind === "markdown"),
  );
  const sourceHint = mdSlot?.pathHint ?? "report.md";
  const baseName = sourceHint.replace(/\.md$/i, "").replace(/^.*\//, "");

  const hasDistinctRequiredDocx = manifest.slots.some(
    (slot) =>
      slot.status !== "removed"
      && slot.required !== false
      && (slot.kind === "docx" || /\.docx$/i.test(slot.pathHint ?? ""))
      && slot.pathHint
      && slot.pathHint.replace(/\.docx$/i, "").replace(/^.*\//, "") !== baseName,
  );
  if (hasDistinctRequiredDocx && !isOfficeDeliverablePackGoal(userGoal)) {
    return manifest;
  }

  let slots = [...manifest.slots];
  const exportDefs: Array<{ key: RegExp; hint: string; kind: SessionDeliverableSlot["kind"]; label: string }> = [
    { key: /pdf/u, hint: `${baseName}.pdf`, kind: "pdf", label: "PDF" },
    { key: /word|docx/u, hint: `${baseName}.docx`, kind: "docx", label: "Word" },
    { key: /ppt|pptx|幻灯/u, hint: `${baseName}.pptx`, kind: "pptx", label: "PPT" },
  ];
  for (const def of exportDefs) {
    if (!def.key.test(goalLower)) continue;
    const exists = slots.some(
      (slot) =>
        slot.status !== "removed"
        && (slot.pathHint === def.hint || slot.pathHints?.includes(def.hint)),
    );
    if (!exists) {
      slots.push({
        id: `office_export_${def.kind}`,
        label: def.label,
        kind: def.kind,
        pathHint: def.hint,
        pathHints: [def.hint],
        required: true,
        status: "pending",
        stageId: "stage_office_export",
        stageOrder: 2,
        parallelGroup: "office-export",
        sourcePathHint: sourceHint,
      });
    }
  }

  slots = slots.map((slot) => {
    if (slot.status === "removed") return slot;
    if (isOfficeExportSlot(slot)) {
      const slotBase = (slot.pathHint ?? "")
        .replace(/\.(?:docx|pdf|pptx)$/i, "")
        .replace(/^.*\//, "");
      if (slotBase && baseName && slotBase !== baseName) {
        return slot;
      }
      return {
        ...slot,
        parallelGroup: "office-export",
        stageId: "stage_office_export",
        stageOrder: 2,
        sourcePathHint: sourceHint,
      };
    }
    if (slot.pathHint?.endsWith(".md") || slot.kind === "markdown") {
      return {
        ...slot,
        stageId: slot.stageId ?? "stage_report",
        stageOrder: slot.stageOrder ?? 1,
      };
    }
    return slot;
  });

  return {
    ...manifest,
    slots,
    currentStageId: manifest.currentStageId ?? "stage_report",
  };
}

function orderedManifestStageIds(slots: SessionDeliverableSlot[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const sorted = [...slots]
    .filter((slot) => slot.status !== "removed" && slot.stageId)
    .sort((left, right) => (left.stageOrder ?? 999) - (right.stageOrder ?? 999));
  for (const slot of sorted) {
    if (slot.stageId && !seen.has(slot.stageId)) {
      seen.add(slot.stageId);
      ordered.push(slot.stageId);
    }
  }
  return ordered;
}

/** True when sequential policy applies to this manifest (independent of off/shadow/enforce). */
export function shouldApplySequentialDeliverablePolicy(
  manifest: SessionDeliverableManifest | undefined,
): boolean {
  if (!manifest?.slots?.length) return false;
  if (
    !isSequentialDeliverablesEnabled()
    && !isSequentialDeliverablesShadowEnabled()
  ) {
    return false;
  }
  const active = manifest.slots.filter((slot) => slot.status !== "removed");
  const staged = active.filter((slot) => slot.stageId || slot.stageOrder != null);
  if (staged.length >= 3) return true;
  const slug = String(manifest.capabilitySlug ?? "").trim();
  if (SEQUENTIAL_TEMPLATE_SLUGS.test(slug)) return true;
  if (detectChecklistAuthorityTemplateId(manifest.sessionGoalAnchor)) return true;
  return manifest.completionMode === "report" && active.length >= 3;
}

/** PD-SAAS-FORK ES9 P0-F: gate linear 1→N deliverable writes for multi-stage manifests. */
export function shouldEnforceSequentialDeliverables(
  manifest: SessionDeliverableManifest | undefined,
): boolean {
  if (!isSequentialDeliverablesEnabled()) return false;
  return shouldApplySequentialDeliverablePolicy(manifest);
}

export function matchPathToCurrentStage(
  filePath: string,
  manifest: SessionDeliverableManifest,
): { allowed: boolean; reason?: string } {
  if (!shouldApplySequentialDeliverablePolicy(manifest)) {
    return { allowed: true };
  }
  const normalized = normalizeSdmPath(filePath);
  if (/data-sources\.md$/iu.test(normalized)) return { allowed: true };
  if (/visual-asset-manifest\.json$/iu.test(normalized)) return { allowed: true };
  const currentStageId = manifest.currentStageId
    ?? orderedManifestStageIds(manifest.slots)[0];
  if (!currentStageId) return { allowed: true };
  const currentSlots = manifest.slots.filter(
    (slot) => slot.status !== "removed" && slot.stageId === currentStageId,
  );
  if (currentSlots.length === 0) return { allowed: true };
  if (currentSlots.some((slot) => pathSatisfiesSdmSlot(normalized, slot))) {
    return { allowed: true };
  }
  const hints = currentSlots
    .flatMap((slot) => slot.pathHints ?? (slot.pathHint ? [slot.pathHint] : []))
    .slice(0, 4)
    .join(", ");
  const reason =
    `Sequential deliverable gate: current stage "${currentStageId}" expects ${hints || "listed deliverables"} before other files.`;
  const mode = sequentialDeliverablesMode();
  if (mode === "shadow") {
    try {
      recordStabilityEvent({
        event: "sequential_gate_shadow",
        reason: currentStageId,
        detail: {
          mode: "shadow",
          wouldBlock: true,
          stageId: currentStageId,
        },
      });
    } catch {
      // best-effort
    }
    return { allowed: true, reason };
  }
  try {
    recordStabilityEvent({
      event: "sequential_gate_blocked",
      reason: currentStageId,
      detail: { mode: "enforce", stageId: currentStageId },
    });
  } catch {
    // best-effort
  }
  return { allowed: false, reason };
}

export function advanceSessionStage(
  manifest: SessionDeliverableManifest,
  verifiedPaths: string[] = [],
): { manifest: SessionDeliverableManifest; changed: boolean } {
  if (!shouldEnforceSequentialDeliverables(manifest)) {
    return { manifest, changed: false };
  }
  const stageIds = orderedManifestStageIds(manifest.slots);
  if (stageIds.length <= 1) return { manifest, changed: false };

  const validationOptions = { taskArtifactDir: manifest.taskArtifactDir };
  const slots = manifest.slots.map((slot) => ({ ...slot }));
  let changed = false;
  let currentStageId = manifest.currentStageId ?? stageIds[0];

  for (const slot of slots) {
    if (slot.status === "removed") continue;
    if (
      slotSatisfiedByValidation(slot, verifiedPaths, validationOptions)
      && slot.status !== "done"
    ) {
      slot.status = "done";
      changed = true;
    }
  }

  const currentStageSlots = slots.filter(
    (slot) => slot.status !== "removed" && slot.stageId === currentStageId,
  );
  const parallelGroups = new Set(
    currentStageSlots.map((slot) => slot.parallelGroup).filter(Boolean),
  );
  const currentComplete = currentStageSlots.length > 0
    && currentStageSlots.every(
      (slot) => slot.status === "done"
        || slotSatisfiedByValidation(slot, verifiedPaths, validationOptions),
    )
    && [...parallelGroups].every((group) => {
      const groupSlots = currentStageSlots.filter((slot) => slot.parallelGroup === group);
      if (groupSlots.length === 0) return true;
      return groupSlots.every(
        (slot) => slot.status === "done"
          || slotSatisfiedByValidation(slot, verifiedPaths, validationOptions),
      );
    });
  if (!currentComplete) {
    if (!changed) return { manifest, changed: false };
    return {
      manifest: {
        ...manifest,
        manifestVersion: manifest.manifestVersion + 1,
        slots,
        currentStageId,
      },
      changed: true,
    };
  }

  const currentIndex = stageIds.indexOf(currentStageId);
  const nextStageId = currentIndex >= 0 && currentIndex < stageIds.length - 1
    ? stageIds[currentIndex + 1]
    : undefined;
  if (!nextStageId || nextStageId === currentStageId) {
    if (!changed) return { manifest, changed: false };
    return {
      manifest: {
        ...manifest,
        manifestVersion: manifest.manifestVersion + 1,
        slots,
        currentStageId,
      },
      changed: true,
    };
  }

  currentStageId = nextStageId;
  for (const slot of slots) {
    if (slot.status === "removed") continue;
    if (slot.stageId === nextStageId && slot.status === "pending") {
      slot.status = "active";
      changed = true;
    }
  }

  return {
    manifest: {
      ...manifest,
      manifestVersion: manifest.manifestVersion + 1,
      slots,
      currentStageId,
    },
    changed: true,
  };
}
