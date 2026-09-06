// PD-SAAS-FORK VAP: two-phase Visual Asset Orchestrator.

import { compileOfficialMediaRequirement } from "../../constraints/officialMediaRequirement.js";
import { extractCanonicalSubject } from "../../research/subjectGroundingPolicy.js";
import {
  visualAssetPlatformMode,
  isAutoResolveVisualAssetsEnabled,
} from "../../resilience/stabilityFlags.js";
import { isCreativePreferGenActive } from "../creativeGenerateImageIntent.js";
import {
  runDiscoveryPipeline,
  discoverySatisfied,
} from "./discoveryPipeline.js";
import {
  buildManifestHintForModel,
  loadVisualAssetManifest,
  saveVisualAssetManifest,
} from "./manifestStore.js";
import { preparePendingAssets } from "./preparePipeline.js";
import {
  bindAssetsToSlots,
  type ImageSlotHint,
} from "./slotBinder.js";
import type { VisualAssetManifest, VisualAssetPlan } from "./types.js";
import { extractSourceUrlsFromGoal } from "./urlSanitize.js";

export { extractSourceUrlsFromGoal, sanitizeUrlFromText } from "./urlSanitize.js";

export type OrchestratorPhase = "phase_a" | "phase_b";

export type RunVisualAssetOrchestratorInput = {
  workspaceRoot: string;
  sessionId: string;
  taskArtifactDir: string;
  userGoal: string;
  goalVersion?: number;
  capabilitySlug?: string;
  phase: OrchestratorPhase;
  imageSlots?: ImageSlotHint[];
  sourceUrls?: string[];
  authorityHints?: string[];
  language?: "zh-CN" | "en";
};

const EXPLICIT_VISUAL_INTENT_PATTERN =
  /(?:图|配图|图片|素材|海报|主视觉|官图|官网图|official|hero|visual)/iu;

/** PD-SAAS-FORK: research deliverables default to text — skip VAP unless visuals are explicit. */
function isResearchVisualCapability(slug: string): boolean {
  return /^nova-research(?:-|$)/.test(slug) || slug === "research";
}

/** PD-SAAS-FORK: product launch full case — text/docx/html first; skip VAP unless official visuals requested. */
function isProductLaunchTextFirstGoal(goal: string): boolean {
  return /(?:上市全案|新品上市|product[-\s]launch(?:\s+full)?)/iu.test(goal);
}

export function shouldAutoResolveVisualAssets(input: {
  userGoal: string;
  capabilitySlug?: string;
  imageSlots?: ImageSlotHint[];
}): boolean {
  if (visualAssetPlatformMode() === "off") return false;
  if (!isAutoResolveVisualAssetsEnabled()) return false;
  const goal = String(input.userGoal ?? "");
  const hasImageSlots = (input.imageSlots?.length ?? 0) > 0;
  const slug = String(input.capabilitySlug ?? "").toLowerCase();
  const official = compileOfficialMediaRequirement(goal);
  const explicitVisual = EXPLICIT_VISUAL_INTENT_PATTERN.test(goal);

  // PD-SAAS-FORK: creative prefer-generate — bypass auto-VAP when no official imagery.
  if (
    official.officialMediaPolicy === "none"
    && isCreativePreferGenActive({ goal, slug })
  ) {
    return false;
  }

  // Fix-1: nova-research-* / research — allow phase_a when HTML/配图 intent or image slots.
  if (isResearchVisualCapability(slug)) {
    if (official.officialMediaPolicy !== "none") return true;
    if (hasImageSlots && explicitVisual) return true;
    // PD-SAAS-FORK VAP: research + HTML/配图 deliverable → auto-resolve (0802 paddleboard).
    if (
      hasImageSlots
      || /(?:html|配图|图片|官网|landing|报告页|可视化)/iu.test(goal)
      || input.imageSlots?.some((slot) =>
        /html|image|png|jpg|visual/iu.test(
          `${slot.kind ?? ""} ${slot.pathHint ?? ""} ${slot.label ?? ""}`,
        )
      )
    ) {
      return true;
    }
    return false;
  }

  // Fix-2: product-launch-full — no VAP clutter unless user explicitly wants official/product imagery.
  if (isProductLaunchTextFirstGoal(goal)) {
    if (official.officialMediaPolicy !== "none") return true;
    if (hasImageSlots && explicitVisual) return true;
    return false;
  }

  const mediaIntent =
    /(?:图|配图|图片|素材|资料|海报|主视觉|幻灯|官网|landing|hero|visual)/iu
      .test(goal);
  const visualCapability =
    /nova-ppt|campaign|html|landing|website|aesthetic|brand-campaign/u
      .test(slug);
  return (
    mediaIntent
    || hasImageSlots
    || visualCapability
    || official.officialMediaPolicy !== "none"
  );
}

export async function runVisualAssetOrchestrator(
  input: RunVisualAssetOrchestratorInput,
): Promise<VisualAssetPlan> {
  const mode = visualAssetPlatformMode();
  if (mode === "off") {
    const empty = await loadVisualAssetManifest({
      workspaceRoot: input.workspaceRoot,
      taskArtifactDir: input.taskArtifactDir,
      sessionId: input.sessionId,
      goalVersion: input.goalVersion,
    });
    return {
      manifest: empty,
      hintForModel: "",
    };
  }

  const subjectInfo = extractCanonicalSubject({
    userGoal: input.userGoal,
  });
  const sourceUrls = [
    ...extractSourceUrlsFromGoal(input.userGoal),
    ...(input.sourceUrls ?? []),
  ];
  let manifest = await loadVisualAssetManifest({
    workspaceRoot: input.workspaceRoot,
    taskArtifactDir: input.taskArtifactDir,
    sessionId: input.sessionId,
    goalVersion: input.goalVersion,
    subject: subjectInfo?.subject,
    sourceUrls,
  });

  if (input.phase === "phase_a" || !discoverySatisfied(manifest, 1)) {
    const discovery = await runDiscoveryPipeline({
      workspaceRoot: input.workspaceRoot,
      manifest: {
        ...manifest,
        phase: "phase_a",
        subject: subjectInfo?.subject ?? manifest.subject,
        sourceUrls,
      },
      subject: subjectInfo?.subject,
      userGoal: input.userGoal,
      sourceUrls,
      authorityHints: input.authorityHints,
      capabilitySlug: input.capabilitySlug,
      minCandidates: input.imageSlots?.length ?? 1,
      localizeTop: Math.max(8, input.imageSlots?.length ?? 0, 5),
    });
    manifest = discovery.manifest;
    // Prepare only when tier requires it (none stays skipped).
    manifest = await preparePendingAssets({
      workspaceRoot: input.workspaceRoot,
      manifest,
    });
  }

  if (input.phase === "phase_b" && (input.imageSlots?.length ?? 0) > 0) {
    const bound = bindAssetsToSlots(manifest, input.imageSlots ?? []);
    manifest = bound.manifest;
    manifest = await preparePendingAssets({
      workspaceRoot: input.workspaceRoot,
      manifest,
    });
    // Re-bind after prepare so preparedPath is preferred.
    const rebound = bindAssetsToSlots(manifest, input.imageSlots ?? []);
    manifest = rebound.manifest;
  }

  await saveVisualAssetManifest({
    workspaceRoot: input.workspaceRoot,
    manifest,
  });

  return {
    manifest,
    hintForModel: buildManifestHintForModel(
      manifest,
      input.language ?? "zh-CN",
    ),
  };
}

export function verifiedPathsFromManifest(
  manifest: VisualAssetManifest,
): string[] {
  return manifest.assets
    .map((asset) => asset.preparedPath ?? asset.rawPath)
    .filter(Boolean);
}
