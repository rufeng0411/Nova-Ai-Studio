// PD-SAAS-FORK: bounded, text-free P0-1 shadow comparison on the existing stability pipeline.
import { isContinuationOnlyUserText } from "../../agent/errors/userFacingErrors.js";
import { recordStabilityEvent } from "../../telemetry/stabilityEvents.js";
import {
  resolveCapabilityScopeV2ProposedProfile,
  resolveProfile,
} from "../deliverableCapabilityProfiles.js";
import { isCapabilityScopeV2ShadowedForSlug } from "../resilience/stabilityFlags.js";
import {
  compileSessionDeliverableManifest,
  type SessionDeliverableManifest,
} from "../taskState/sessionDeliverableManifest.js";
import {
  CAPABILITY_SCOPE_EXACT_SLUGS,
  isCapabilityCompletionTaskResumeInput,
  preserveCapabilityCompletionModeForContinuation,
  resolveCapabilityCompletionMode,
} from "./capabilityCompletionMode.js";

const EXACT_SLUGS = new Set<string>(CAPABILITY_SCOPE_EXACT_SLUGS);
const MAX_RECORDED_SLOT_COUNT = 100;

function normalizedToken(value: string | undefined, fallback = "unset"): string {
  const token = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .slice(0, 64);
  return token || fallback;
}

function boundedSlotCount(manifest: SessionDeliverableManifest | null | undefined): number {
  const count = manifest?.slots.filter((slot) => slot.status !== "removed").length ?? 0;
  return Math.min(MAX_RECORDED_SLOT_COUNT, Math.max(0, count));
}

export function recordCapabilityScopeShadowTelemetry(input: {
  sessionId: string;
  turnId: string;
  capabilitySlug?: string;
  majorCategory?: string | null;
  userText: string;
  previousManifest?: SessionDeliverableManifest;
}): void {
  const slug = normalizedToken(input.capabilitySlug, "");
  if (!EXACT_SLUGS.has(slug) || !isCapabilityScopeV2ShadowedForSlug(slug)) return;

  try {
    const continuationOnly = isContinuationOnlyUserText(input.userText)
      || isCapabilityCompletionTaskResumeInput(input.userText);
    const proposedCurrentMode = resolveCapabilityCompletionMode({
      capabilityContext: { slug },
      userText: input.userText,
    });
    const proposedCompletionMode = preserveCapabilityCompletionModeForContinuation({
      currentMode: proposedCurrentMode,
      currentSlug: slug,
      continuationOnly,
      previousState: input.previousManifest,
    });
    const sameSessionContinuation = continuationOnly
      && String(input.previousManifest?.capabilitySlug ?? "").trim().toLowerCase() === slug;

    const legacyProfile = sameSessionContinuation && input.previousManifest?.profileId
      ? resolveProfile(slug, input.majorCategory, input.previousManifest.sessionGoalAnchor)
      : resolveProfile(slug, input.majorCategory, input.userText);
    const proposedProfile = sameSessionContinuation && input.previousManifest?.profileId
      ? legacyProfile
      : resolveCapabilityScopeV2ProposedProfile(slug, input.majorCategory, input.userText);
    const legacyManifest = sameSessionContinuation
      ? input.previousManifest
      : compileSessionDeliverableManifest({
          userGoal: input.userText,
          capabilitySlug: slug,
          majorCategory: input.majorCategory ?? undefined,
          profileId: legacyProfile.id,
        });
    const proposedManifest = sameSessionContinuation
      ? input.previousManifest
      : compileSessionDeliverableManifest({
          userGoal: input.userText,
          capabilitySlug: slug,
          majorCategory: input.majorCategory ?? undefined,
          profileId: proposedProfile.id,
          completionMode: proposedCompletionMode,
        });

    const legacyCompletionMode = "unset";
    const proposedModeToken = normalizedToken(proposedCompletionMode);
    const legacyProfileId = normalizedToken(
      sameSessionContinuation ? input.previousManifest?.profileId : legacyProfile.id,
    );
    const proposedProfileId = normalizedToken(
      sameSessionContinuation ? input.previousManifest?.profileId : proposedProfile.id,
    );
    const legacySlotCount = boundedSlotCount(legacyManifest);
    const proposedSlotCount = boundedSlotCount(proposedManifest);

    recordStabilityEvent({
      event: "capability_scope_shadow",
      sessionId: input.sessionId,
      turnId: input.turnId,
      reason: slug,
      detail: {
        slug,
        legacyCompletionMode,
        proposedCompletionMode: proposedModeToken,
        legacyProfileId,
        proposedProfileId,
        legacySlotCount,
        proposedSlotCount,
        completionModeChanged: legacyCompletionMode !== proposedModeToken,
        profileChanged: legacyProfileId !== proposedProfileId,
        slotCountChanged: legacySlotCount !== proposedSlotCount,
      },
    });
  } catch {
    // Shadow observation is best-effort and must never affect legacy execution.
  }
}
