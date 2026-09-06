/**
 * PD-SAAS-FORK: refactor deriveDeliverablesDockState to UDC kernel.
 */
import type { ChatMessage } from '../components/chat/types/types';
import type { DeliverableItem } from './collectDeliverables';
import { shouldShowDeliverableComposerChrome } from './deliverableDockPolicy';
import type { DeliverableDockRow } from './buildDeliverableDockRows';
import { buildUnifiedDeliverableView, type TaskFolderSnapshotFile, type UnifiedDeliverableView } from './buildUnifiedDeliverableView';
import { extractUserGoalFromSessionMessages } from './deliverableDisplayPolicy';
import { userGoalImpliesDeliverable } from './userFacingErrors';
import { selectLatestDeliverableSummaryTurn, type LatestDeliverableSummarySelection } from './selectLatestDeliverableSummaryTurn';
import { isFinalAssistantReplyForMessage } from './deliverableSummaryMountPolicy';
import { resolveCurrentSessionManifest, resolveFrozenSessionManifest, type SessionDeliverableManifestUi } from './resolveSessionDeliverableManifest';
import { resolveCurrentSessionTaskDirectory } from './resolveSessionTaskDirectory';
import { resolveContractScopeDir, type SessionTaskDirectoryUi } from './resolveContractScopeDir';
import type { ExpectedManifestEntry } from './buildDeliverableSummaryRows';
import { collectTurnFinalDeliverables } from './collectFinalDeliverables';
import { extractUserGoalFromTurnMessages } from './deliverableDisplayPolicy';
import { extractTurnAcceptanceMeta } from './turnAcceptanceMeta';
import { inferTurnArtifactDirectory } from './reconcileTurnDeliverables';
import { collectTurnAllArtifacts } from './collectDeliverables';

export type DeliverablesDockProgress = {
  done: number;
  total: number;
  currentLabel?: string;
  currentStageId?: string;
};

export type DeliverablesDockState = {
  /** PD-SAAS-FORK: owning session — rail must reject stale dock from another session. */
  sessionId?: string | null;
  rows: DeliverableDockRow[];
  progress: DeliverablesDockProgress;
  folderPath: string | null;
  folderItems: DeliverableItem[];
  turnDeliverables: DeliverableItem[];
  turnArtifactDir?: string;
  showComposerChrome: boolean;
  isInProgress: boolean;
  isRepairActive: boolean;
  hasSessionManifest: boolean;
  latestMessageId: string | null;
  expectedManifest?: ExpectedManifestEntry[];
  contractHash?: string;
  qualityStatus?: UnifiedDeliverableView['qualityStatus'];
  processFilePaths?: string[];
  /** PD-SAAS-FORK (P1-B5): tail pagination may hide older deliverable rows. */
  hasMoreMessages?: boolean;
  /** PD-SAAS-FORK P0-D: USN live dock subtitle (Composer/Dock/live status unified). */
  statusSubtitleKey?: string | null;
  statusSubtitleValues?: Record<string, string | number>;
};

export type DeriveDeliverablesDockStateInput = {
  messages: ChatMessage[];
  projectRoot: string;
  hasMoreMessages: boolean;
  sessionRepairActive: boolean;
  isAssistantWorking: boolean;
  sessionManifest?: SessionDeliverableManifestUi;
  /** PD-SAAS-FORK STDA: envelope fallback when tail messages omit session_task_directory. */
  sessionTaskDirectory?: SessionTaskDirectoryUi | null;
  validationSettled?: boolean;
  diskSnapshot?: TaskFolderSnapshotFile[];
  diskSnapshotVersion?: number;
  /** PD-SAAS-FORK: global task-folder scan completeness, not per-file evidence. */
  diskSnapshotComplete?: boolean;
  /** PD-SAAS-FORK: pipeline precomputed — skips buildUnified + duplicate latest scan. */
  prebuiltView?: UnifiedDeliverableView;
  prebuiltLatest?: LatestDeliverableSummarySelection;
  prebuiltScopeDir?: string | null;
};

function turnMessagesForIndex(messages: ChatMessage[], index: number): ChatMessage[] {
  const message = messages[index];
  if (!message || message.type !== 'assistant') return [];
  const turnId = message.turnId ?? message.id;
  const start = messages.findIndex((m) => m.id === turnId || m.turnId === turnId);
  const from = start >= 0 ? start : index;
  const slice: ChatMessage[] = [];
  for (let i = from; i <= index; i += 1) {
    slice.push(messages[i]);
  }
  return slice;
}

export function deriveDeliverablesDockState(input: DeriveDeliverablesDockStateInput): DeliverablesDockState {
  const {
    messages,
    projectRoot,
    hasMoreMessages,
    sessionRepairActive,
    isAssistantWorking,
    validationSettled = true,
    diskSnapshot,
    diskSnapshotVersion,
    diskSnapshotComplete,
  } = input;

  const sessionGoal = extractUserGoalFromSessionMessages(messages);
  const sessionManifest = input.sessionManifest ?? resolveCurrentSessionManifest(messages);
  const frozenManifest = resolveFrozenSessionManifest(messages) ?? sessionManifest;
  const sessionTaskDirectory = input.sessionTaskDirectory ?? resolveCurrentSessionTaskDirectory(messages);
  const scopeDir = input.prebuiltScopeDir ?? resolveContractScopeDir({
    messages,
    sessionTaskDirectory,
    sessionManifest: frozenManifest ?? sessionManifest,
    pathHints: frozenManifest?.slots?.map((slot) => slot.pathHint).filter(Boolean) as string[] | undefined,
  });
  const latest = input.prebuiltLatest ?? selectLatestDeliverableSummaryTurn({ messages, projectRoot, hasMoreMessages });

  let turnDeliverables: DeliverableItem[] = [];
  let turnArtifactDir: string | undefined;
  let verifiedPaths: string[] = [];

  if (latest.messageId) {
    const index = messages.findIndex((m) => m.id === latest.messageId);
    if (index >= 0) {
      const message = messages[index];
      const turnMessages = turnMessagesForIndex(messages, index);
      const turnGoal = extractUserGoalFromTurnMessages(turnMessages) || sessionGoal;
      const formattedContent = String(message.content ?? '');
      turnArtifactDir = typeof message.turnArtifactDir === 'string'
        ? message.turnArtifactDir
        : scopeDir
          ?? inferTurnArtifactDirectory(collectTurnAllArtifacts({
            assistantText: formattedContent,
            toolMessages: turnMessages,
            projectRoot,
            userGoalText: turnGoal,
          })) ?? undefined;

      turnDeliverables = collectTurnFinalDeliverables({
        assistantText: formattedContent,
        toolMessages: turnMessages,
        // PD-SAAS-FORK: frozen SDM prevents turn-dir scans from adding Dock rows.
        sessionToolMessages: messages,
        projectRoot,
        userGoalText: turnGoal,
        turnArtifactDirOverride: turnArtifactDir,
        verifiedPathsOverride: Array.isArray(message.verifiedDeliverablePaths)
          ? message.verifiedDeliverablePaths.filter((p): p is string => typeof p === 'string')
          : undefined,
      });

      const meta = extractTurnAcceptanceMeta(message);
      verifiedPaths = meta?.verifiedPaths ?? [];
    }
  }

  const view = input.prebuiltView ?? buildUnifiedDeliverableView({
    messages,
    projectRoot,
    sessionManifest,
    sessionTaskDirectory,
    diskSnapshot,
    diskSnapshotVersion,
    diskSnapshotComplete,
    validationSettled,
    turnDeliverables,
    turnArtifactDir: scopeDir ?? turnArtifactDir ?? null,
    verifiedPathsOverride: verifiedPaths,
    scopeDir,
  });

  const hasSessionManifest = Boolean(frozenManifest?.slots?.length ?? sessionManifest?.slots?.length);
  const isDeliverableTask = userGoalImpliesDeliverable(sessionGoal);
  const showComposerChrome = shouldShowDeliverableComposerChrome({
    rowCount: view.totalSlots > 0 ? view.totalSlots : view.rows.length,
    hasSessionManifest,
    hasFolderPath: Boolean(view.folderPath),
    isDeliverableTask,
  });

  return {
    rows: view.rows,
    progress: view.progress,
    folderPath: view.folderPath,
    folderItems: view.folderItems,
    turnDeliverables,
    turnArtifactDir: scopeDir ?? turnArtifactDir,
    showComposerChrome,
    isInProgress: isAssistantWorking || sessionRepairActive,
    isRepairActive: sessionRepairActive,
    hasSessionManifest,
    latestMessageId: latest.messageId,
    expectedManifest: view.expectedManifest.length > 0 ? view.expectedManifest : undefined,
    contractHash: view.contractHash,
    ...(view.qualityStatus ? { qualityStatus: view.qualityStatus } : {}),
    processFilePaths: diskSnapshot?.filter((file) => file.isProcessFile).map((file) => file.path),
    hasMoreMessages,
  };
}

/** Shallow compare for rail sync — avoids setState loops when dock objects are recreated each render. */
export function areDeliverablesDockStatesEqual(
  a: DeliverablesDockState | null | undefined,
  b: DeliverablesDockState | null | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (
    a.sessionId !== b.sessionId
    || a.contractHash !== b.contractHash
    || a.showComposerChrome !== b.showComposerChrome
    || a.isInProgress !== b.isInProgress
    || a.isRepairActive !== b.isRepairActive
    || a.turnArtifactDir !== b.turnArtifactDir
    || a.folderPath !== b.folderPath
    || a.latestMessageId !== b.latestMessageId
    || a.hasMoreMessages !== b.hasMoreMessages
    || a.statusSubtitleKey !== b.statusSubtitleKey
  ) {
    return false;
  }
  const pa = a.progress;
  const pb = b.progress;
  if (
    pa.done !== pb.done
    || pa.total !== pb.total
    || pa.currentStageId !== pb.currentStageId
    || pa.currentLabel !== pb.currentLabel
  ) {
    return false;
  }
  if (a.rows.length !== b.rows.length || a.folderItems.length !== b.folderItems.length) {
    return false;
  }
  for (let i = 0; i < a.rows.length; i += 1) {
    if (a.rows[i].id !== b.rows[i].id) return false;
  }
  return true;
}

export function findLatestAssistantIndex(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].type === 'assistant') return i;
  }
  return -1;
}

export function isLatestAssistantFinal(messages: ChatMessage[]): boolean {
  const index = findLatestAssistantIndex(messages);
  if (index < 0) return false;
  return isFinalAssistantReplyForMessage(messages[index], messages[index + 1]);
}
