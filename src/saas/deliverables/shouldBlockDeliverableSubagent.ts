// PD-SAAS-FORK P0′-3: hard block subagent delegation on deliverable-class tasks.
import { userGoalImpliesDeliverable } from "../../agent/errors/userFacingErrors.js";
import { resolveProfile } from "../deliverableCapabilityProfiles.js";
import { isCampaignFullCaseGoal } from "./campaignDeliverableCompleteness.js";
import { detectChecklistAuthorityTemplateId } from "./deliverableChecklistAuthority.js";
import { detectContentMatrixTurn } from "../processTemplateExecutionPrompt.js";
import { isBlockDeliverableSubagentEnabled } from "../resilience/stabilityFlags.js";
import type { SessionDeliverableManifest } from "../taskState/sessionDeliverableManifest.js";

const DELIVERABLE_SUBAGENT_TOOL_PATTERN =
  /^(?:agent|task|launch[_-]?agent|spawn[_-]?agent)$/i;

const DELIVERABLE_PROFILE_IDS = new Set([
  "campaign",
  "viral_article_pack",
  "one-article-matrix",
  "social_matrix",
  "content_flywheel",
  "geo",
  "ppt",
  "video-mp4",
  "nova-slide-deck",
]);

export function isDeliverableSubagentToolName(toolName: string): boolean {
  return DELIVERABLE_SUBAGENT_TOOL_PATTERN.test(String(toolName ?? "").trim());
}

export type DeliverableSubagentBlockInput = {
  userGoal?: string;
  capabilitySlug?: string;
  majorCategory?: string | null;
  sessionManifest?: SessionDeliverableManifest | null;
};

export function shouldBlockDeliverableSubagent(input: DeliverableSubagentBlockInput): boolean {
  if (!isBlockDeliverableSubagentEnabled()) return false;
  if (String(input.majorCategory ?? "").trim().toLowerCase() === "brainstorming") {
    return false;
  }

  const goal = String(input.userGoal ?? "").trim();
  const activeSlots = (input.sessionManifest?.slots ?? []).filter(
    (slot) => slot.status !== "removed" && slot.required !== false,
  );

  if (activeSlots.length > 0) return true;
  if (goal && userGoalImpliesDeliverable(goal)) return true;
  if (goal && (detectContentMatrixTurn(goal) || isCampaignFullCaseGoal(goal))) return true;

  const authorityTemplate = goal
    ? detectChecklistAuthorityTemplateId(goal, input.capabilitySlug)
    : undefined;
  if (
    authorityTemplate === "viral-article-pack"
    || authorityTemplate === "one-article-matrix"
    || authorityTemplate === "brand-campaign-full"
    || authorityTemplate === "product-launch-full"
  ) {
    return true;
  }

  const profileId =
    input.sessionManifest?.profileId
    ?? resolveProfile(input.capabilitySlug, input.majorCategory, goal).id;
  return DELIVERABLE_PROFILE_IDS.has(profileId);
}

export function deliverableSubagentBlockedMessage(language: "zh-CN" | "en" = "zh-CN"): string {
  return language === "zh-CN"
    ? "交付类任务须主线程 write_file 落盘，禁止 subagent/agent 委派。"
    : "Deliverable tasks must write files in the main thread; subagent delegation is not allowed.";
}
