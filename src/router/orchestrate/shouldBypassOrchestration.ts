// PD-SAAS-FORK: capabilities needing write tools bypass orchestrator-only mode.
import { goalExplicitlyWantsHyperframes, isHyperframesVideoSlug } from "../../saas/media/hyperframesEngineFlags.js";
import { isOfficeDeliverablePackGoal } from "../../saas/clarificationGate.js";
import { isCampaignFullCaseGoal } from "../../saas/deliverables/campaignDeliverableCompleteness.js";
import { userGoalImpliesDeliverable } from "../../agent/errors/userFacingErrors.js";
import {
  isBrandGeoFullCaseGoal,
  shouldBypassOrchestrationForProfile,
} from "../../saas/deliverableCapabilityProfiles.js";
import { detectContentMatrixTurn } from "../../saas/processTemplateExecutionPrompt.js";
import { isOrchBypassMatrixGeoEnabled } from "../../saas/resilience/stabilityFlags.js";
import type { CanonicalMessage, CanonicalTextBlock } from "../../model/protocol/canonical.js";

const LEGACY_DESIGN_PREFIXES = ["od-", "open-design", "frontend-slides", "df-frontend-design"];

export function extractLatestUserGoalText(messages: CanonicalMessage[] | undefined): string {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "user") continue;
    const text = message.content
      .filter((block): block is CanonicalTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (text) return text;
  }
  return "";
}

/** PD-SAAS-FORK: direct STDA write goals bypass orchestrator when deliverable intent is clear. */
export function isDirectDeliverableWriteGoal(
  userGoal: string,
  majorCategory?: string | null,
): boolean {
  if (String(majorCategory ?? "").trim().toLowerCase() === "brainstorming") {
    return false;
  }
  const goal = String(userGoal ?? "").trim();
  if (!/(?:写入系统分配任务目录|taskArtifactDir|直接开始做)/i.test(goal)) {
    return false;
  }
  return userGoalImpliesDeliverable(goal);
}

function shouldBypassMatrixGeoGoals(
  userGoal: string,
  majorCategory?: string | null,
): boolean {
  if (!isOrchBypassMatrixGeoEnabled()) return false;
  const goal = String(userGoal ?? "").trim();
  if (!goal) return false;
  if (detectContentMatrixTurn(goal)) return true;
  if (isDirectDeliverableWriteGoal(goal, majorCategory)) return true;
  if (isBrandGeoFullCaseGoal(goal)) return true;
  return false;
}

export function shouldBypassOrchestrationForCapability(
  capabilitySlug: string | undefined,
  majorCategory?: string | null,
  userGoal?: string,
): boolean {
  const goal = String(userGoal ?? "").trim();
  if (isOfficeDeliverablePackGoal(goal)) {
    return true;
  }
  if (
    userGoalImpliesDeliverable(goal)
    && /(?:export_document|标准成果清单|须交付：)/i.test(goal)
  ) {
    return true;
  }
  if (shouldBypassMatrixGeoGoals(goal, majorCategory)) {
    return true;
  }
  if (isCampaignFullCaseGoal(goal)) {
    return true;
  }
  const slug = String(capabilitySlug || "").trim().toLowerCase();
  if (slug && shouldBypassOrchestrationForProfile(slug, majorCategory)) {
    return true;
  }
  if (slug && isHyperframesVideoSlug(slug)) {
    return true;
  }
  if (goalExplicitlyWantsHyperframes(String(userGoal ?? ""))) {
    return true;
  }
  if (!slug) return false;
  return LEGACY_DESIGN_PREFIXES.some((prefix) => slug === prefix || slug.startsWith(prefix));
}
