/**
 * PD-SAAS-FORK: per-turn deliverable view for historical conversation footer + export inline (WYSIWYG).
 * Rebuildable from transcript + frozen SDM — no folder merge / no turnMeta row expansion when baseline exists.
 */
import type { ChatMessage } from '../components/chat/types/types';
import type { DeliverableAcceptanceRow } from '../components/chat/deliverables/DeliverableSummaryTable';
import { dedupeSlotsByBasename } from '../../../src/saas/deliverables/sdmSlotMatching';
import {
  buildDeliverableDockRows,
  type DeliverableDockRow,
} from './buildDeliverableDockRows';
import {
  collectTurnAllArtifacts,
  turnHasSuccessfulDeliverableTools,
  type DeliverableItem,
} from './collectDeliverables';
import { collectTurnFinalDeliverables } from './collectFinalDeliverables';
import { dedupeDeliverableRowsByBasename } from './dedupeDeliverableRowsByBasename';
import { assertDeliverableContextInvariants } from './deliverableContextInvariants';
import { isNonUserDeliverablePath } from './nonDeliverablePaths';
import { normalizeConversationSummaryProgress } from './normalizeConversationSummaryProgress';
import { resolveContractScopeDir } from './resolveContractScopeDir';
import {
  resolveCurrentSessionTaskDirectory,
} from './resolveSessionTaskDirectory';
import {
  resolveFrozenSessionManifest,
  sessionManifestToExpectedEntries,
  type SessionDeliverableManifestUi,
} from './resolveSessionDeliverableManifest';
import { resolvePrimarySessionTaskDirectory } from './resolvePrimaryTaskArtifactDir';
import {
  expandExpectedManifestSlideCount,
  inferNovaSlidePagesFromPaths,
} from './slideManifestExpand';
import {
  isDocumentDeliverableProfile,
  isSlideDeliverableProfile,
} from './slideDeliverableProfile';
import {
  buildSanitizedAcceptanceRowsFromMessage,
  extractTurnAcceptanceMeta,
} from './turnAcceptanceMeta';
import {
  extractUserGoalFromSessionMessages,
  extractUserGoalFromTurnMessages,
} from './deliverableDisplayPolicy';
import { inferTurnArtifactDirectory } from './reconcileTurnDeliverables';
import type { DeliverableValidationStatus, ValidatedDeliverable } from './validateDeliverables';

export type TurnDeliverablePresentationMode = 'turn_snapshot';

export type TurnDeliverableView = {
  rows: DeliverableDockRow[];
  progress: { done: number; total: number };
  presentationMode: TurnDeliverablePresentationMode;
  scopeDir: string | null;
  contractHash?: string | null;
};

function turnMessagesForAssistant(
  chatMessages: ChatMessage[],
  assistantMessage: ChatMessage,
): ChatMessage[] {
  const assistantIndex = chatMessages.findIndex((msg) => msg.id === assistantMessage.id);
  if (assistantIndex < 0) return [assistantMessage];

  let start = assistantIndex;
  for (let i = assistantIndex; i >= 0; i -= 1) {
    const msg = chatMessages[i];
    if (msg?.type === 'user') {
      start = i + 1;
      break;
    }
    if (i === 0) start = 0;
  }

  return chatMessages.slice(start, assistantIndex + 1);
}

function mapValidatedItems(
  items: DeliverableItem[],
  verifiedPaths: string[],
): ValidatedDeliverable[] {
  const verifiedSet = new Set(verifiedPaths.map((p) => p.replace(/\\/g, '/').toLowerCase()));
  return items.map((item) => {
    const path = (item.resolvedPath || item.apiPath || item.path || '').replace(/\\/g, '/');
    const pathLower = path.toLowerCase();
    const engineVerified = verifiedSet.has(pathLower)
      || [...verifiedSet].some((v) => v.endsWith(`/${pathLower}`) || pathLower.endsWith(`/${v}`));
    const inheritedStatus = (
      item as DeliverableItem & { validationStatus?: DeliverableValidationStatus }
    ).validationStatus;
    return {
      ...item,
      validationStatus: engineVerified ? 'verified' as const : inheritedStatus ?? 'pending',
    };
  });
}

function filterConversationDeliverableRows(rows: DeliverableDockRow[]): DeliverableDockRow[] {
  return rows.filter((row) => {
    const path = row.resolvedPath || row.apiPath || row.path || '';
    return !path || !isNonUserDeliverablePath(path);
  });
}

function resolveTurnScopeDir(input: {
  messages: ChatMessage[];
  sessionManifest?: SessionDeliverableManifestUi;
  turnArtifactDir?: string;
}): string | null {
  const sessionTaskDirectory = resolveCurrentSessionTaskDirectory(input.messages);
  return resolveContractScopeDir({
    messages: input.messages,
    sessionTaskDirectory,
    sessionManifest: input.sessionManifest,
    turnArtifactDir: input.turnArtifactDir,
  })
    ?? sessionTaskDirectory?.taskArtifactDir
    ?? input.turnArtifactDir
    ?? null;
}

export function buildTurnDeliverableView(input: {
  sessionMessages: ChatMessage[];
  turnEndMessage: ChatMessage;
  projectRoot?: string;
}): TurnDeliverableView | null {
  const { sessionMessages, turnEndMessage, projectRoot = '' } = input;
  if (turnEndMessage.type !== 'assistant') return null;

  const turnEndIndex = sessionMessages.findIndex((msg) => msg.id === turnEndMessage.id);
  if (turnEndIndex < 0) return null;

  const truncatedMessages = sessionMessages.slice(0, turnEndIndex + 1);
  const turnMessages = turnMessagesForAssistant(sessionMessages, turnEndMessage);
  const formattedContent = String(turnEndMessage.content ?? '');
  const turnUserGoalText = extractUserGoalFromTurnMessages(turnMessages)
    || extractUserGoalFromSessionMessages(truncatedMessages);
  const frozenManifest = resolveFrozenSessionManifest(truncatedMessages);
  const expectedManifestRaw = sessionManifestToExpectedEntries(frozenManifest);
  const expectedManifest = expectedManifestRaw?.length
    ? dedupeSlotsByBasename(
      expectedManifestRaw.map((entry, idx) => ({
        id: entry.id ?? `slot-${idx}`,
        label: entry.label,
        path: entry.path,
        pathHints: entry.pathHints,
      })),
    ).map((entry, idx) => ({
      ...expectedManifestRaw.find((raw) => raw.id === entry.id) ?? expectedManifestRaw[idx],
      id: entry.id,
      label: entry.label ?? expectedManifestRaw[idx]?.label,
      path: entry.path ?? expectedManifestRaw[idx]?.path,
      pathHints: entry.pathHints ?? expectedManifestRaw[idx]?.pathHints,
    }))
    : undefined;

  let turnDeliverables = collectTurnFinalDeliverables({
    assistantText: formattedContent,
    toolMessages: turnMessages,
    sessionToolMessages: truncatedMessages,
    projectRoot,
    userGoalText: turnUserGoalText,
  });
  if (turnDeliverables.length === 0 && turnHasSuccessfulDeliverableTools(turnMessages)) {
    turnDeliverables = collectTurnAllArtifacts({
      assistantText: formattedContent,
      toolMessages: turnMessages,
      projectRoot,
      userGoalText: turnUserGoalText,
    }).filter((item) => item.kind !== 'url');
  }

  const turnMeta = extractTurnAcceptanceMeta(turnEndMessage);
  const primaryTaskDir = resolvePrimarySessionTaskDirectory({
    messages: truncatedMessages,
    manifest: frozenManifest,
  })?.taskArtifactDir;
  const turnArtifactDir = primaryTaskDir
    ?? (typeof turnEndMessage.turnArtifactDir === 'string'
      ? turnEndMessage.turnArtifactDir
      : undefined)
    ?? inferTurnArtifactDirectory(turnDeliverables)
    ?? undefined;
  const acceptanceRows = buildSanitizedAcceptanceRowsFromMessage(turnEndMessage, {
    turnArtifactDir,
    knownVerifiedPaths: turnDeliverables.map((item) => item.resolvedPath || item.apiPath || item.path),
  }) as DeliverableAcceptanceRow[];
  const scopeDir = resolveTurnScopeDir({
    messages: truncatedMessages,
    sessionManifest: frozenManifest,
    turnArtifactDir,
  });

  const slideProfile = isSlideDeliverableProfile(frozenManifest?.profileId)
    && !isDocumentDeliverableProfile(frozenManifest?.profileId);
  const verifiedPaths = [
    ...(turnMeta?.verifiedPaths ?? []),
    ...acceptanceRows
      .filter((row) => row.status === 'delivered')
      .map((row) => row.path)
      .filter(Boolean),
  ] as string[];

  let slideManifestPages: ReturnType<typeof inferNovaSlidePagesFromPaths> = [];
  if (slideProfile && turnArtifactDir) {
    const paths = turnDeliverables.map((item) => item.resolvedPath || item.apiPath || item.path);
    slideManifestPages = inferNovaSlidePagesFromPaths(turnArtifactDir, paths);
    if (slideManifestPages.length === 0 && expectedManifest) {
      slideManifestPages = expandExpectedManifestSlideCount(expectedManifest, turnArtifactDir);
    }
  }

  const validatedItems = mapValidatedItems(turnDeliverables, verifiedPaths);
  const validationSettled = !turnEndMessage.isStreaming;

  let rows = buildDeliverableDockRows({
    expectedManifest,
    slideManifestPages: slideManifestPages.length > 0 ? slideManifestPages : undefined,
    acceptanceRows,
    validatedItems,
    verifiedPaths,
    resolvedPathMap: turnMeta?.resolvedPathMap,
    turnArtifactDir,
    scopeDir,
    validationSettled,
    manifestSlots: frozenManifest?.slots,
  });

  rows = filterConversationDeliverableRows(rows);
  rows = dedupeDeliverableRowsByBasename(rows);

  if (rows.length === 0 && !expectedManifest?.length && acceptanceRows.length === 0) {
    return null;
  }

  const progress = normalizeConversationSummaryProgress(rows);
  assertDeliverableContextInvariants(rows, 'turn_snapshot', {
    expectedSlotCount: expectedManifest?.length,
    contextLabel: `turn:${turnEndMessage.id}`,
  });

  return {
    rows,
    progress,
    presentationMode: 'turn_snapshot',
    scopeDir,
    contractHash: turnMeta?.acceptanceCertificate?.contractHash ?? null,
  };
}
