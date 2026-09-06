/**
 * PD-SAAS-FORK: shared mount predicate for deliverable summary tables — used by
 * MessageRowV2 and selectLatestDeliverableSummaryTurn to avoid drift (C2).
 */
import type { ChatMessage } from '../components/chat/types/types';
import {
  collectDeliverablesFromAssistantText,
  turnHasSuccessfulDeliverableTools,
  type DeliverableItem,
} from './collectDeliverables';
import { userGoalImpliesDeliverable } from './userFacingErrors';
import { extractTurnAcceptanceMeta } from './turnAcceptanceMeta';
import type { ExpectedManifestEntry } from './buildDeliverableSummaryRows';
import type { SlideManifestPage } from './buildDeliverableSummaryRows';
import {
  isElicitationOnlyTurn,
  isUserActionRequiredTurn,
} from './deliverableSummaryTurnKind';
import {
  resolveCurrentSessionManifest,
  sessionManifestToExpectedEntries,
  type SessionDeliverableManifestUi,
} from './resolveSessionDeliverableManifest';

function isDeliverableSummaryForceEnabled(): boolean {
  const raw = import.meta.env?.VITE_PILOTDECK_DELIVERABLE_SUMMARY_FORCE;
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  return true;
}

function shouldForceDeliverableSummary(ctx: DeliverableSummaryMountContext): boolean {
  if (!isDeliverableSummaryForceEnabled()) return false;
  const meta = extractTurnAcceptanceMeta(ctx.message);
  return (meta?.verifiedPaths?.length ?? 0) > 0
    && userGoalImpliesDeliverable(ctx.turnUserGoalText);
}

export type DeliverableSummaryMountContext = {
  message: ChatMessage;
  isFinalAssistantReply: boolean;
  formattedContent: string;
  turnDeliverables: DeliverableItem[];
  acceptanceRowCount: number;
  turnUserGoalText: string;
  turnMessages: ChatMessage[];
  turnArtifactDir?: string;
  expectedManifest?: ExpectedManifestEntry[] | null;
  slideManifestPages?: SlideManifestPage[];
  /** Session-level SDM — prefer over per-turn scan when provided. */
  sessionManifest?: SessionDeliverableManifestUi;
};

export type DeliverableSummaryLiveContext = {
  isLatestAssistantInSession: boolean;
  sessionRepairActive: boolean;
};

function hasDeliverableMeta(ctx: DeliverableSummaryMountContext): boolean {
  return ctx.acceptanceRowCount > 0 || (ctx.expectedManifest?.length ?? 0) > 0;
}

function resolveSessionManifest(ctx: DeliverableSummaryMountContext): SessionDeliverableManifestUi | undefined {
  if (ctx.sessionManifest?.slots?.length) return ctx.sessionManifest;
  return resolveCurrentSessionManifest(ctx.turnMessages);
}

function hasSessionManifest(ctx: DeliverableSummaryMountContext): boolean {
  const fromTurn = sessionManifestToExpectedEntries(resolveSessionManifest(ctx));
  return (fromTurn?.length ?? 0) > 0;
}

function hasEngineVerifiedMeta(message: ChatMessage): boolean {
  const meta = extractTurnAcceptanceMeta(message);
  return (meta?.verifiedPaths?.length ?? 0) > 0;
}

function hasDeliverableSignal(ctx: DeliverableSummaryMountContext): boolean {
  if (hasSessionManifest(ctx)) return true;
  if (hasDeliverableMeta(ctx)) return true;
  if (ctx.slideManifestPages?.length) return true;
  if (
    ctx.turnMessages.length > 0
    && turnHasSuccessfulDeliverableTools(ctx.turnMessages)
    && userGoalImpliesDeliverable(ctx.turnUserGoalText)
  ) {
    return true;
  }
  if (ctx.turnDeliverables.length > 0 && (hasDeliverableMeta(ctx) || hasEngineVerifiedMeta(ctx.message))) {
    return true;
  }
  // PD-SAAS-FORK (ROG Phase 6 F5): research/design single-file tasks without SDM —
  // require tool writes or engine verified meta, not text-only path mentions.
  if (
    ctx.isFinalAssistantReply
    && userGoalImpliesDeliverable(ctx.turnUserGoalText)
    && (hasEngineVerifiedMeta(ctx.message) || turnHasSuccessfulDeliverableTools(ctx.turnMessages))
  ) {
    return true;
  }
  return false;
}

/**
 * Whether this turn is a deliverable-summary candidate (used for latest-turn selection).
 * Does not apply live streaming hide — repair/partial delivery still qualify.
 */
export function isDeliverableSummaryTurnCandidate(ctx: DeliverableSummaryMountContext): boolean {
  const { message } = ctx;
  if (message.type !== 'assistant') {
    return false;
  }
  if (shouldForceDeliverableSummary(ctx)) {
    if (isUserActionRequiredTurn(message, ctx.turnMessages)) return false;
    if (isElicitationOnlyTurn(ctx.turnMessages)) return false;
    return true;
  }
  if (!ctx.isFinalAssistantReply) {
    return false;
  }
  const sessionManifest = resolveSessionManifest(ctx);
  if (!userGoalImpliesDeliverable(ctx.turnUserGoalText) && !sessionManifest?.slots?.length) return false;
  if (isUserActionRequiredTurn(message, ctx.turnMessages)) return false;
  if (isElicitationOnlyTurn(ctx.turnMessages)) return false;
  return hasDeliverableSignal(ctx);
}

/** Whether to render the footer summary table on this assistant bubble. */
export function shouldMountDeliverableSummary(
  ctx: DeliverableSummaryMountContext,
  live?: DeliverableSummaryLiveContext,
): boolean {
  if (shouldForceDeliverableSummary(ctx)) {
    if (ctx.message.isStreaming && live?.isLatestAssistantInSession) return false;
    if (isUserActionRequiredTurn(ctx.message, ctx.turnMessages)) return false;
    if (isElicitationOnlyTurn(ctx.turnMessages)) return false;
    return true;
  }
  if (!isDeliverableSummaryTurnCandidate(ctx)) return false;
  if (ctx.message.isStreaming && live?.isLatestAssistantInSession) {
    return false;
  }
  return true;
}

export function isFinalAssistantReplyForMessage(
  message: ChatMessage,
  nextMessage: ChatMessage | undefined,
): boolean {
  return !nextMessage || nextMessage.type === 'user' || nextMessage.type === 'error';
}

export function extractManifestHintsFromMessage(
  message: ChatMessage,
  paths: string[],
  turnArtifactDir?: string,
): { expectedManifest?: ExpectedManifestEntry[]; slideManifestPages?: SlideManifestPage[] } {
  const meta = extractTurnAcceptanceMeta(message);
  return {
    expectedManifest: meta?.expectedManifest,
    slideManifestPages: undefined,
  };
}

export function countAcceptanceRowsForMessage(message: ChatMessage): number {
  const meta = extractTurnAcceptanceMeta(message);
  if (!meta) return 0;
  const missing = meta.missingPaths?.length ?? 0;
  const verified = meta.verifiedPaths?.length ?? 0;
  return missing + verified;
}

export function deliverablesFromAssistantMessage(
  formattedContent: string,
  projectRoot: string,
): DeliverableItem[] {
  return collectDeliverablesFromAssistantText(formattedContent, projectRoot)
    .filter((item) => item.kind !== 'url');
}
