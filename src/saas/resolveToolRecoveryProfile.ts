// PD-SAAS-FORK: slug-aware tool recovery profile resolution

import { isChatFirstCapability, userRequestsBrainstormDeliverable } from "./chatFirstCapabilities.js";
import { resolveProfile, type RecoveryKind } from "./deliverableCapabilityProfiles.js";
import { userGoalImpliesDeliverable } from "../agent/errors/userFacingErrors.js";

export type ToolRecoveryProfile = {
  researchReport: boolean;
  contentFlywheel: boolean;
  chatFirst: boolean;
  pptDeliverable: boolean;
  brainstormEscalated: boolean;
  geoAudit: boolean;
  recoveryKind: RecoveryKind;
};

const RESEARCH_SLUG_HINT = /research|geo|pd-geo|market|competitive|report/i;
const CONTENT_SLUG_HINT = /mkt-|content-|social-|yixiaoer/i;

export function resolveToolRecoveryProfile(input: {
  slug?: string;
  majorCategory?: string | null;
  userGoal?: string;
  messagesResearchMode?: boolean;
  messagesContentMode?: boolean;
}): ToolRecoveryProfile {
  const slug = input.slug ?? "";
  const userGoal = input.userGoal ?? "";
  const profile = resolveProfile(slug, input.majorCategory, userGoal);

  const brainstormEscalated = isChatFirstCapability(slug, input.majorCategory)
    && userRequestsBrainstormDeliverable(userGoal);

  const chatFirst = isChatFirstCapability(slug, input.majorCategory) && !brainstormEscalated;

  const pptDeliverable = profile.recoveryKind === "ppt"
    || (userGoalImpliesDeliverable(userGoal) && /(?:ppt|PPT|pptx|幻灯)/i.test(userGoal));

  const geoAudit = !pptDeliverable && (
    profile.id === "geo_visibility_audit"
    || profile.id === "geo_competitor"
    || (profile.recoveryKind === "geo" && /(?:ai\s*搜索|geo\s*audit|aeo\s*audit|审计|audit-checklist|ai-search-audit)/i.test(userGoal))
  );

  const researchReport = !pptDeliverable && !geoAudit && (
    profile.recoveryKind === "research"
    || input.messagesResearchMode === true
    || (RESEARCH_SLUG_HINT.test(slug) && profile.recoveryKind !== "geo")
  );

  const contentFlywheel = !pptDeliverable && !researchReport && !geoAudit && (
    profile.recoveryKind === "content"
    || input.messagesContentMode === true
    || CONTENT_SLUG_HINT.test(slug)
  );

  return {
    researchReport,
    contentFlywheel,
    chatFirst,
    pptDeliverable,
    brainstormEscalated,
    geoAudit,
    recoveryKind: profile.recoveryKind,
  };
}

export function toToolRecoveryOptions(profile: ToolRecoveryProfile): {
  researchReport?: boolean;
  contentFlywheel?: boolean;
  chatFirst?: boolean;
  pptDeliverable?: boolean;
  geoAudit?: boolean;
} {
  if (profile.brainstormEscalated && profile.pptDeliverable) {
    return { pptDeliverable: true };
  }
  if (profile.brainstormEscalated) {
    return {
      researchReport: profile.researchReport,
      contentFlywheel: profile.contentFlywheel,
      geoAudit: profile.geoAudit,
    };
  }
  if (profile.chatFirst) {
    return { chatFirst: true };
  }
  if (profile.pptDeliverable) {
    return { pptDeliverable: true };
  }
  if (profile.geoAudit) {
    return { geoAudit: true };
  }
  if (profile.researchReport) {
    return { researchReport: true };
  }
  if (profile.contentFlywheel) {
    return { contentFlywheel: true };
  }
  return {};
}
