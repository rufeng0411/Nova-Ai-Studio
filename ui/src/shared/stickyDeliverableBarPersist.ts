/**
 * PD-SAAS-FORK: persist sticky deliverable bar during pipeline defer / self-check.
 * Decision-only — no React state. Do not import node:fs.
 */
import type { DeliverableDockRow } from './buildDeliverableDockRows';
import type { DeliverablesDockState } from './deriveDeliverablesDockState';
import type { SessionDeliverablePipelineBundle } from './sessionDeliverablePipeline';
import type { SessionDeliverableManifestUi } from './resolveSessionDeliverableManifest';
import { isStickyDeliverableBarPersistEnabled } from './conversationDeliverableFeatureFlags';

export { isStickyDeliverableBarPersistEnabled };

export type StickyDeliverableBarVisibilityInput = {
  persistEnabled?: boolean;
  stickySummaryEnabled: boolean;
  showComposerChrome: boolean;
  turnArtifactDir?: string | null;
  folderPath?: string | null;
  rowCount: number;
  progressTotal: number;
  hasSessionManifest: boolean;
  hasStdaDir: boolean;
  isDeliverableTask: boolean;
  lifecycleInFlight: boolean;
};

export function shouldShowStickyDeliverableBar(input: StickyDeliverableBarVisibilityInput): boolean {
  if (!input.stickySummaryEnabled) return false;
  const persist = input.persistEnabled !== false && isStickyDeliverableBarPersistEnabled();
  const legacyVisible = input.showComposerChrome
    || Boolean(input.turnArtifactDir)
    || Boolean(input.folderPath)
    || input.progressTotal > 0
    || input.rowCount > 0;
  if (!persist) return legacyVisible;
  if (legacyVisible) return true;
  if (input.hasSessionManifest || input.hasStdaDir || input.isDeliverableTask) return true;
  if (input.lifecycleInFlight && (input.hasSessionManifest || input.hasStdaDir || input.isDeliverableTask)) {
    return true;
  }
  return false;
}

export function buildEnvelopePlaceholderRows(
  manifest?: Pick<SessionDeliverableManifestUi, 'slots'> | null,
): DeliverableDockRow[] {
  const slots = (manifest?.slots ?? []).filter((slot) => slot.status !== 'removed');
  return slots.map((slot) => ({
    id: slot.id,
    label: slot.label || slot.id,
    path: slot.pathHint ?? '',
    status: 'checking',
    previewable: false,
    linkable: false,
  }));
}

export function resolvePersistedDeliverablesDockState(input: {
  live: DeliverablesDockState;
  frozen: DeliverablesDockState | null;
  envelopeManifest?: Pick<SessionDeliverableManifestUi, 'slots'> | null;
  envelopeTaskDir?: string | null;
  sessionId: string | null;
  pipelineRunning: boolean;
  inFlight: boolean;
}): DeliverablesDockState {
  const live = input.live;
  if (input.pipelineRunning && live.rows.length > 0) return live;

  const frozen = input.frozen;
  const frozenUsable = Boolean(
    frozen
    && input.sessionId
    && frozen.sessionId === input.sessionId
    && frozen.rows.length > 0,
  );
  if ((!input.pipelineRunning || (input.inFlight && live.rows.length === 0)) && frozenUsable && frozen) {
    return {
      ...frozen,
      sessionId: input.sessionId,
      isInProgress: live.isInProgress,
      isRepairActive: live.isRepairActive,
    };
  }

  if (live.rows.length === 0) {
    const placeholders = buildEnvelopePlaceholderRows(input.envelopeManifest);
    if (placeholders.length > 0) {
      return {
        ...live,
        sessionId: input.sessionId,
        rows: placeholders,
        showComposerChrome: true,
        hasSessionManifest: true,
        turnArtifactDir: input.envelopeTaskDir ?? live.turnArtifactDir,
        folderPath: live.folderPath ?? input.envelopeTaskDir ?? null,
        progress: {
          done: 0,
          total: placeholders.length,
        },
      };
    }
  }

  return live;
}

export function shouldAcceptFrozenPipelineUpdate(input: {
  prev: SessionDeliverablePipelineBundle | null;
  next: SessionDeliverablePipelineBundle | null;
  inFlight: boolean;
}): boolean {
  if (!input.next) return false;
  const prevRows = input.prev?.dockState.rows.length ?? 0;
  const nextRows = input.next.dockState.rows.length;
  if (input.inFlight && prevRows > 0 && nextRows === 0) return false;
  return true;
}

export function pickStickySummaryRows<T>(input: {
  live: T[];
  deferred: T[];
  assistantWorking: boolean;
}): T[] {
  if (input.assistantWorking && input.deferred.length === 0 && input.live.length > 0) {
    return input.live;
  }
  if (input.assistantWorking && input.deferred.length > 0) return input.deferred;
  return input.live;
}

export function shouldRefreshTaskFolderSnapshot(input: {
  pipelineReady: boolean;
  hasScopeDir: boolean;
  isAssistantWorking?: boolean;
}): boolean {
  if (!input.hasScopeDir) return false;
  return Boolean(input.pipelineReady || input.isAssistantWorking);
}

export function resolveRetainedSnapshotEnvelope<T>(input: {
  applicable: boolean;
  sessionId: string | null;
  scopeDir: string;
  previousSessionId: string | null;
  previousScopeDir: string;
  previousEnvelope: T | null;
}): T | null {
  if (!shouldRetainTaskFolderSnapshot(input)) return null;
  return input.previousEnvelope;
}

export function shouldRetainTaskFolderSnapshot(input: {
  applicable: boolean;
  sessionId: string | null;
  scopeDir: string;
  previousSessionId: string | null;
  previousScopeDir: string;
}): boolean {
  if (input.applicable) return false;
  if (!input.sessionId || !input.previousSessionId) return false;
  if (input.sessionId !== input.previousSessionId) return false;
  if (!input.scopeDir || input.scopeDir !== input.previousScopeDir) return false;
  return input.scopeDir === 'artifacts' || input.scopeDir.startsWith('artifacts/');
}
