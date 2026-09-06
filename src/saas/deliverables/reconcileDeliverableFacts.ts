// PD-SAAS-FORK (ROG Phase 7): single pipeline for deliverable fact reconciliation.
import fs from "node:fs/promises";
import path from "node:path";
import type { DeliverableProfile } from "../deliverableCapabilityProfiles.js";
import type { AcceptanceFailure } from "./acceptanceChecks.js";
import { extractRequestedCount } from "./acceptanceChecks.js";
import type { SessionDeliverableManifest } from "../taskState/sessionDeliverableManifest.js";
import { parseNumberedDeliverableList } from "../taskState/sessionDeliverableManifest.js";
import {
  filterGhostBrokenPaths,
  isMissingReanchorEnabled,
  reconcileMissingPaths,
  stripCampaignPngMissingWhenHtmlVerified,
  stripPptxVerifiedSlidePngMissing,
} from "./reconcileMissingPaths.js";
import {
  filterRepairEligiblePaths,
  isRepairEligiblePath,
  type RepairPathAllowOptions,
} from "./repairEligiblePath.js";
import { basenameLower, normalizeRepairPath } from "../../../ui/shared/repairEligiblePath.mjs";
import { isRealPptxPath } from "./pptxAliasPolicy.js";
import { slotSatisfiedByValidation, sdmBasename, type SdmSlotLike } from "./sdmSlotMatching.js";
import { isSdmGeoKeywordAliasEnabled } from "../resilience/stabilityFlags.js";
import type { SessionDeliverableSlot } from "../taskState/sessionDeliverableManifest.js";
import {
  isCampaignFullCaseGoal,
  resolveCampaignSdmSlots,
} from "./campaignDeliverableCompleteness.js";

export type ReconcileDeliverableFactsInput = {
  cwd: string;
  verified: string[];
  missing: string[];
  broken: string[];
  failures: AcceptanceFailure[];
  userGoal: string;
  capabilitySlug?: string;
  sessionManifest?: SessionDeliverableManifest;
  profile: DeliverableProfile;
};

export type ReconcileDeliverableFactsOutput = ReconcileDeliverableFactsInput;

function envFlagEnabled(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null) return fallback;
  const value = raw.trim().toLowerCase();
  if (value === "0" || value === "false" || value === "off") return false;
  if (value === "1" || value === "true" || value === "on") return true;
  return fallback;
}

export function isPptxBasenameAliasEnabled(): boolean {
  return envFlagEnabled("PILOTDECK_PPTX_BASENAME_ALIAS", true);
}

export function isNovaSvgDegradeEnabled(): boolean {
  return envFlagEnabled("PILOTDECK_NOVA_SVG_DEGRADE", true);
}

const NON_DELIVERABLE_GAP_RE =
  /须交付|写入系统分配|HTML 综合报告|【硬性约束】|DeepSeek|灌篮高手|render_hyperframes|Gateway/i;

/** PD-SAAS-FORK Razer RCA P0-C: phantom/constraint gaps must not trigger repair. */
export function isNonDeliverableSlotGap(
  slot: SessionDeliverableSlot | undefined,
  gapPath?: string,
): boolean {
  const text = [
    slot?.label ?? "",
    slot?.pathHint ?? "",
    ...(slot?.pathHints ?? []),
    gapPath ?? "",
  ].join(" ");
  if (NON_DELIVERABLE_GAP_RE.test(text)) return true;
  if (gapPath && !/\.(md|markdown|html?|pdf|docx?|pptx?|mp4|png|jpe?g|json(?:ld)?|svg|csv|xlsx?)$/i.test(gapPath)) {
    return true;
  }
  if (slot && !slot.pathHint && !(slot.pathHints?.length) && /^(?:HTML|综合|报告)/i.test(slot.label ?? "")) {
    return true;
  }
  return false;
}

function findSlotForGapPath(
  manifest: SessionDeliverableManifest | undefined,
  gapPath: string,
): SessionDeliverableSlot | undefined {
  if (!manifest?.slots?.length) return undefined;
  const base = sdmBasename(gapPath).toLowerCase();
  return manifest.slots.find((slot) => {
    const hints = [slot.pathHint, ...(slot.pathHints ?? [])].filter(Boolean) as string[];
    return hints.some((hint) => sdmBasename(hint).toLowerCase() === base);
  });
}

export function filterNonDeliverableGapPaths(
  paths: string[],
  manifest?: SessionDeliverableManifest,
): string[] {
  return paths.filter((gapPath) => !isNonDeliverableSlotGap(findSlotForGapPath(manifest, gapPath), gapPath));
}

function isNovaSlideDeckGoal(userGoal: string, capabilitySlug?: string): boolean {
  return /nova-ppt-aesthetic-slides/i.test(String(capabilitySlug ?? ""))
    || /(?:Nova-?美学幻灯|PNG\s*幻灯|配图\s*PNG|slide-manifest\.json)/i.test(userGoal);
}

function normalizeRel(p: string): string {
  return normalizeRepairPath(p).replace(/\\/g, "/");
}

function pathKey(p: string): string {
  return normalizeRel(p).toLowerCase();
}

function dirnameOf(p: string): string {
  return path.dirname(normalizeRel(p)).replace(/\\/g, "/");
}

/** Same directory has a non-stub .pptx → drop presentation.pptx missing slots. */
export function satisfyPresentationPptxAlias(input: {
  missing: string[];
  verified: string[];
}): string[] {
  if (!isPptxBasenameAliasEnabled()) return input.missing;

  const pptxPaths = input.verified.filter((p) => /\.pptx$/i.test(p));
  const realPptx = pptxPaths.filter((p) => isRealPptxPath(p, pptxPaths));
  if (realPptx.length === 0) return input.missing;

  const realDirs = new Set(realPptx.map((p) => dirnameOf(p)));

  return input.missing.filter((raw) => {
    const norm = normalizeRel(raw);
    const base = basenameLower(norm);
    if (base !== "presentation.pptx" && !/\/presentation\.pptx$/i.test(norm)) {
      return true;
    }
    if (/artifacts\/\*\*\/presentation\.pptx/i.test(norm)) {
      return realPptx.length === 0;
    }
    const dir = dirnameOf(norm);
    if (dir === "." || dir === "") {
      return !realPptx.some((p) => basenameLower(p) !== "presentation.pptx");
    }
    return !realDirs.has(dir);
  });
}

/** G0: structural alias gap should not increment repair circuit. */
export function shouldSkipRepairGapForPptxAlias(input: {
  missing: string[];
  verified: string[];
}): boolean {
  if (!isPptxBasenameAliasEnabled()) return false;
  const after = satisfyPresentationPptxAlias(input);
  return after.length === 0 && input.missing.length > 0;
}

/** PD-SAAS-FORK: GEO keyword Chinese basename gap — verified alias satisfies slot. */
export function shouldSkipRepairGapForGeoKeywordAlias(input: {
  missing: string[];
  verified: string[];
  sessionManifest?: { slots?: Array<{ pathHint?: string; pathHints?: string[]; status?: string; kind?: string }> } | null;
}): boolean {
  if (!isSdmGeoKeywordAliasEnabled()) return false;
  if (!input.missing.length || !input.verified.length) return false;
  const slots = (input.sessionManifest?.slots ?? []).filter((s) => s.status !== "removed");
  if (slots.length === 0) return false;
  return input.missing.every((missingPath) => {
    const basename = missingPath.includes("/")
      ? missingPath.split("/").pop() ?? missingPath
      : missingPath;
    const matched = slots.find((s) => {
      const hint = s.pathHint ?? "";
      return hint.toLowerCase() === basename.toLowerCase()
        || (s.pathHints ?? []).some((h) => h.toLowerCase() === basename.toLowerCase());
    });
    const slot: SdmSlotLike = {
      id: "alias_gap",
      pathHint: matched?.pathHint ?? basename,
      pathHints: matched?.pathHints,
      kind: matched?.kind,
    };
    return slotSatisfiedByValidation(slot, input.verified);
  });
}

/** Remove paths present in both verified and broken when verified file exists on disk. */
export async function dedupeVerifiedBrokenOverlap(input: {
  cwd: string;
  verified: string[];
  broken: string[];
}): Promise<string[]> {
  if (!isNovaSvgDegradeEnabled()) return input.broken;

  const verifiedKeys = new Set(input.verified.map(pathKey));
  const kept: string[] = [];

  for (const raw of input.broken) {
    const key = pathKey(raw);
    if (!verifiedKeys.has(key)) {
      kept.push(raw);
      continue;
    }
    const rel = normalizeRel(raw);
    const abs = path.isAbsolute(rel) ? rel : path.join(input.cwd, rel);
    try {
      const stat = await fs.stat(abs);
      if (stat.size <= 0) {
        kept.push(raw);
      }
    } catch {
      kept.push(raw);
    }
  }
  return kept;
}

async function statOk(cwd: string, rel: string): Promise<boolean> {
  const normalized = normalizeRel(rel);
  const abs = path.isAbsolute(normalized) ? normalized : path.join(cwd, normalized);
  try {
    const stat = await fs.stat(abs);
    return stat.size > 0;
  } catch {
    return false;
  }
}

async function resolveNovaPageCarrier(cwd: string, deckDir: string, imagePath: string): Promise<string | null> {
  const raw = String(imagePath ?? "").trim().replace(/^\.\/+/, "");
  const rel = raw.startsWith("artifacts/")
    ? raw
    : `${deckDir}/${raw}`.replace(/\/+/g, "/");
  if (await statOk(cwd, rel)) return rel;
  if (/\.png$/i.test(rel) && isNovaSvgDegradeEnabled()) {
    const svg = rel.replace(/\.png$/i, ".svg");
    if (await statOk(cwd, svg)) return svg;
  }
  return null;
}

/** Nova deck complete → clear deck-scoped gaps. */
export async function novaDeckCompletePass(input: {
  cwd: string;
  userGoal: string;
  capabilitySlug?: string;
  verified: string[];
  missing: string[];
  broken: string[];
}): Promise<{ missing: string[]; broken: string[]; failuresDropped: boolean }> {
  if (!isNovaSvgDegradeEnabled() || !isNovaSlideDeckGoal(input.userGoal, input.capabilitySlug)) {
    return { missing: input.missing, broken: input.broken, failuresDropped: false };
  }

  const expectedCount = extractRequestedCount(input.userGoal);
  const manifests = input.verified.filter((p) => /(?:^|\/)slide-manifest\.json$/i.test(p));
  if (manifests.length === 0) {
    return { missing: input.missing, broken: input.broken, failuresDropped: false };
  }

  for (const manifestPath of manifests) {
    const manifestAbs = path.isAbsolute(manifestPath)
      ? manifestPath
      : path.join(input.cwd, manifestPath);
    const deckDir = dirnameOf(manifestPath);
    let manifest: Record<string, unknown>;
    try {
      const content = await fs.readFile(manifestAbs, "utf8");
      manifest = JSON.parse(content) as Record<string, unknown>;
    } catch {
      continue;
    }

    const pages = Array.isArray(manifest.pages) ? manifest.pages : [];
    if (pages.length === 0) continue;
    if (expectedCount && pages.length < expectedCount) continue;

    const preferredPng = manifest.preferred_carrier === "png";
    let allPagesOk = true;
    for (const page of pages) {
      const pageRecord = page && typeof page === "object" && !Array.isArray(page)
        ? page as Record<string, unknown>
        : null;
      const imagePath = typeof pageRecord?.image_path === "string" ? pageRecord.image_path : "";
      if (!imagePath) {
        allPagesOk = false;
        break;
      }
      if (preferredPng && !/\.png$/i.test(imagePath)) {
        allPagesOk = false;
        break;
      }
      const resolved = await resolveNovaPageCarrier(input.cwd, deckDir, imagePath);
      if (!resolved) {
        allPagesOk = false;
        break;
      }
    }

    if (!allPagesOk) continue;

    const inDeck = (p: string) => {
      const norm = normalizeRel(p);
      return norm === deckDir || norm.startsWith(`${deckDir}/`);
    };

    return {
      missing: input.missing.filter((p) => !inDeck(p)),
      broken: input.broken.filter((p) => !inDeck(p)),
      failuresDropped: true,
    };
  }

  return { missing: input.missing, broken: input.broken, failuresDropped: false };
}

function stripSyntheticVerifierGaps(missing: string[], broken: string[]): {
  missing: string[];
  broken: string[];
} {
  if (!envFlagEnabled("PILOTDECK_RESEARCH_PASSED_GT", true)) {
    return { missing, broken };
  }
  const filter = (paths: string[]) =>
    paths.filter((p) => !/^__verifier_needs_repair__$/i.test(String(p ?? "").trim()));
  return { missing: filter(missing), broken: filter(broken) };
}

/** PD-SAAS-FORK (ROG Phase 8 PR-C2): drop malformed repair paths (backticks, no artifacts/). */
export function sanitizeMalformedRepairPaths(paths: string[]): string[] {
  if (!envFlagEnabled("PILOTDECK_MALFORMED_PATH_SANITIZE", true)) return paths;
  return paths.filter((raw) => {
    const norm = String(raw ?? "").trim();
    if (!norm || norm.length > 512) return false;
    if (/[`「」【】]/.test(norm)) return false;
    if (/^[^a-zA-Z0-9_./\\-]+$/.test(norm)) return false;
    if (!/(?:^|\/)artifacts\//i.test(norm.replace(/\\/g, "/"))) {
      if (!/\.(?:md|html?|docx|pptx|pdf|png|jpe?g|json|mp4)$/i.test(norm)) return false;
      if (!norm.includes("/")) return false;
    }
    return true;
  });
}

function isPptIntermediatePath(p: string): boolean {
  const norm = normalizeRel(p);
  const base = basenameLower(norm);
  if (/^slide-\d+/i.test(base) && /\.png$/i.test(base)) return true;
  if (/^page-\d+/i.test(base) && /\.png$/i.test(base)) return true;
  if (/^s0(?:\d+|[-_])/i.test(base) && /\.png$/i.test(base)) return true;
  if (/\/slides-[^/]+\/slide-/i.test(norm)) return true;
  if (/\/slide-\d+\//i.test(norm) && /\.png$/i.test(base)) return true;
  if (/\/slides\/[^/]+\//i.test(norm) && /\.png$/i.test(base) && !/\.pptx$/i.test(base)) return true;
  return false;
}

/** PD-SAAS-FORK (ROG Phase 8 PR-C3): PPT canonical .pptx verified → drop intermediate PNG broken. */
export function filterPptIntermediateBroken(input: {
  broken: string[];
  verified: string[];
  profileId?: string;
  capabilitySlug?: string;
  userGoal?: string;
}): string[] {
  if (!envFlagEnabled("PILOTDECK_PPT_INTERMEDIATE_FILTER", true)) return input.broken;

  const slug = String(input.capabilitySlug ?? "").trim().toLowerCase();
  const goal = String(input.userGoal ?? "");
  const profileId = String(input.profileId ?? "");
  const isPptProfile = profileId === "ppt-master"
    || profileId === "presentation-pptx"
    || profileId === "ppt"
    || slug === "ppt-master"
    || slug === "anth-pptx"
    || /(?:原生可编辑\s*PPT|PPT\s*生成|ppt-master)/i.test(goal);
  if (!isPptProfile) return input.broken;

  const pptxPaths = input.verified.filter((p) => /\.pptx$/i.test(p));
  const realPptx = pptxPaths.filter((p) => isRealPptxPath(p, pptxPaths));
  if (realPptx.length === 0) return input.broken;

  return input.broken.filter((p) => !isPptIntermediatePath(p));
}

function stageArtifactSatisfied(stageId: string, verified: string[]): boolean {
  const norm = verified.map((p) => normalizeRel(p).toLowerCase());
  switch (stageId) {
    case "research":
      return norm.some((p) => /\.(?:md|docx|pdf)$/i.test(p) && /(?:research|01-|调研)/i.test(p));
    case "plan":
      return norm.some((p) => /\.html?$/i.test(p) && /(?:plan|02-|策划)/i.test(p));
    case "brief":
      return norm.some((p) => /brief\.md$/i.test(p) || /(?:03-|brief)/i.test(p));
    case "visual":
      return norm.some((p) =>
        (/\.(?:png|html?|svg)$/i.test(p) && /(?:visual|kv|poster|主视觉|04-)/i.test(p)));
    case "website":
      return norm.some((p) => /index\.html$/i.test(p) || /(?:website|05-|官网)/i.test(p));
    case "platform":
      return norm.some((p) => /\.md$/i.test(p) && /(?:platform|06-|多平台)/i.test(p));
    case "draft":
      return norm.some((p) => /(?:draft|草稿|07-)/i.test(p));
    case "monitoring":
      return norm.some((p) => /(?:monitor|监测|08-|复盘)/i.test(p));
    default:
      return false;
  }
}

function campaignArtifactDir(verified: string[]): string | null {
  for (const raw of verified) {
    const norm = normalizeRel(raw);
    if (!/(?:^|\/)artifacts\/campaign/i.test(norm)) continue;
    const dir = dirnameOf(norm);
    if (dir && dir !== ".") return dir;
  }
  return null;
}

/** PD-SAAS-FORK (PR-T-SDM): re-anchor bare campaign slot paths to verified campaign dir. */
export function reanchorCampaignSlotPaths(input: {
  missing: string[];
  verified: string[];
  userGoal: string;
  sessionManifest?: SessionDeliverableManifest;
}): string[] {
  if (!isCampaignFullCaseGoal(input.userGoal)) return input.missing;
  const baseDir = campaignArtifactDir(input.verified);
  if (!baseDir) return input.missing;

  const hints = (input.sessionManifest?.slots ?? [])
    .map((slot) => slot.pathHint)
    .filter((hint): hint is string => Boolean(hint?.trim()));

  return input.missing.map((raw) => {
    const norm = normalizeRel(raw);
    if (/(?:^|\/)artifacts\//i.test(norm)) return norm;
    const baseName = basenameLower(norm);
    const hintMatch = hints.find((hint) => basenameLower(hint) === baseName);
    if (hintMatch) {
      return `${baseDir}/${basenameLower(hintMatch)}`.replace(/\/+/g, "/");
    }
    return `${baseDir}/${norm.replace(/^\/+/, "")}`.replace(/\/+/g, "/");
  });
}

/** PD-SAAS-FORK (PR-T-SDM): mark satisfied campaign stages and clear stage-scoped gaps. */
export function markCampaignStageSatisfied(input: {
  userGoal: string;
  verified: string[];
  missing: string[];
  broken: string[];
}): { missing: string[]; broken: string[] } {
  if (!isCampaignFullCaseGoal(input.userGoal)) {
    return { missing: input.missing, broken: input.broken };
  }

  const slots = resolveCampaignSdmSlots({
    userGoal: input.userGoal,
    parseNumberedList: parseNumberedDeliverableList,
  });
  const satisfiedStages = new Set(
    slots
      .filter((slot) => slot.stageId && stageArtifactSatisfied(slot.stageId, input.verified))
      .map((slot) => slot.stageId!),
  );

  if (satisfiedStages.size === 0) {
    return { missing: input.missing, broken: input.broken };
  }

  const gapInSatisfiedStage = (p: string): boolean => {
    const norm = normalizeRel(p).toLowerCase();
    for (const slot of slots) {
      if (!slot.stageId || !satisfiedStages.has(slot.stageId)) continue;
      switch (slot.stageId) {
        case "research":
          if (/\.(?:md|docx|pdf)$/i.test(norm) && /(?:research|01-|调研)/i.test(norm)) return true;
          break;
        case "plan":
          if (/\.html?$/i.test(norm) && /(?:plan|02-|策划)/i.test(norm)) return true;
          break;
        case "brief":
          if (/brief/i.test(norm)) return true;
          break;
        case "visual":
          if (/\.(?:png|html?|svg)$/i.test(norm) && /(?:visual|kv|poster|主视觉|04-)/i.test(norm)) return true;
          break;
        case "website":
          if (/index\.html$/i.test(norm) || /(?:website|05-|官网)/i.test(norm)) return true;
          break;
        case "platform":
          if (/\.md$/i.test(norm) && /(?:platform|06-|多平台)/i.test(norm)) return true;
          break;
        case "draft":
          if (/(?:draft|草稿|07-)/i.test(norm)) return true;
          break;
        case "monitoring":
          if (/(?:monitor|监测|08-|复盘)/i.test(norm)) return true;
          break;
        default:
          break;
      }
    }
    return false;
  };

  return {
    missing: input.missing.filter((p) => !gapInSatisfiedStage(p)),
    broken: input.broken.filter((p) => !gapInSatisfiedStage(p)),
  };
}

/** PD-SAAS-FORK (ROG Phase 8 PR-T2): PNG→HTML degrade only — 禁止「≥4 阶段有文件」清空其它槽位 gap。 */
export function campaignPhaseCompletePass(input: {
  userGoal: string;
  verified: string[];
  missing: string[];
  broken: string[];
}): { missing: string[]; broken: string[]; degraded: boolean } {
  if (!envFlagEnabled("PILOTDECK_CAMPAIGN_PHASE_PASS", true)) {
    return { missing: input.missing, broken: input.broken, degraded: false };
  }
  if (!isCampaignFullCaseGoal(input.userGoal)) {
    return { missing: input.missing, broken: input.broken, degraded: false };
  }

  let degraded = false;
  const missing = input.missing.filter((p) => {
    const norm = normalizeRel(p).toLowerCase();
    if (/\.png$/i.test(norm) && /(?:visual|kv|poster|主视觉|social)/i.test(norm)) {
      const hasHtmlSibling = input.verified.some((v) =>
        /\.html?$/i.test(v) && dirnameOf(v) === dirnameOf(p));
      if (hasHtmlSibling) {
        degraded = true;
        return false;
      }
    }
    return true;
  });

  const broken = input.broken.filter((p) => {
    const norm = normalizeRel(p).toLowerCase();
    if (/\.png$/i.test(norm)) {
      const hasHtmlSibling = input.verified.some((v) =>
        /\.html?$/i.test(v) && dirnameOf(v) === dirnameOf(p));
      if (hasHtmlSibling) {
        degraded = true;
        return false;
      }
    }
    return true;
  });

  return { missing, broken, degraded };
}

function buildRepairAllow(
  profile: DeliverableProfile,
  sessionManifest?: SessionDeliverableManifest,
): RepairPathAllowOptions {
  return {
    slots: sessionManifest?.slots,
    allowPathHints: sessionManifest?.slots
      ?.map((slot) => slot.pathHint)
      .filter((hint): hint is string => Boolean(hint)),
    allowBasenames: [
      ...(profile.requiredBasenames ?? []),
      ...(profile.requiredBasenameGroups?.flat() ?? []),
    ],
  };
}

export async function reconcileDeliverableFacts(
  input: ReconcileDeliverableFactsInput,
): Promise<ReconcileDeliverableFactsOutput> {
  let { verified, missing, broken, failures } = input;

  missing = sanitizeMalformedRepairPaths(missing);
  broken = sanitizeMalformedRepairPaths(broken);

  if (isMissingReanchorEnabled()) {
    const pathHints = input.sessionManifest?.slots
      ?.map((slot) => slot.pathHint)
      .filter((hint): hint is string => Boolean(hint));
    missing = reconcileMissingPaths({ missing, verified, pathHints });
    missing = reanchorCampaignSlotPaths({
      missing,
      verified,
      userGoal: input.userGoal,
      sessionManifest: input.sessionManifest,
    });
    missing = satisfyPresentationPptxAlias({ missing, verified });
    missing = stripPptxVerifiedSlidePngMissing({
      missing,
      verified,
      capabilitySlug: input.capabilitySlug,
      userGoal: input.userGoal,
    });
    missing = stripCampaignPngMissingWhenHtmlVerified({ missing, verified });
    broken = await dedupeVerifiedBrokenOverlap({ cwd: input.cwd, verified, broken });
    const novaPass = await novaDeckCompletePass({
      cwd: input.cwd,
      userGoal: input.userGoal,
      capabilitySlug: input.capabilitySlug,
      verified,
      missing,
      broken,
    });
    missing = novaPass.missing;
    broken = novaPass.broken;
    broken = await filterGhostBrokenPaths({ cwd: input.cwd, broken });
    const campaignPass = campaignPhaseCompletePass({
      userGoal: input.userGoal,
      verified,
      missing,
      broken,
    });
    missing = campaignPass.missing;
    broken = campaignPass.broken;
    const stagePass = markCampaignStageSatisfied({
      userGoal: input.userGoal,
      verified,
      missing,
      broken,
    });
    missing = stagePass.missing;
    broken = stagePass.broken;
    broken = filterPptIntermediateBroken({
      broken,
      verified,
      profileId: input.profile.id,
      capabilitySlug: input.capabilitySlug,
      userGoal: input.userGoal,
    });
    const synthetic = stripSyntheticVerifierGaps(missing, broken);
    missing = synthetic.missing;
    broken = synthetic.broken;
    failures = failures.filter((failure) => {
      if (!failure.path) return true;
      if (failure.reason !== "broken") return true;
      return broken.includes(failure.path);
    });
  }

  const repairAllow = buildRepairAllow(input.profile, input.sessionManifest);
  missing = filterRepairEligiblePaths(missing, repairAllow);
  broken = filterRepairEligiblePaths(broken, repairAllow);
  missing = filterNonDeliverableGapPaths(missing, input.sessionManifest);
  broken = filterNonDeliverableGapPaths(broken, input.sessionManifest);
  failures = failures.filter(
    (failure) => !failure.path || isRepairEligiblePath(failure.path, repairAllow),
  );

  return {
    ...input,
    verified,
    missing,
    broken,
    failures,
  };
}
