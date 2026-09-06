/**
 * PD-SAAS-FORK: keep composer deliverables / dock state bound to the active session.
 */
import type { ChatMessage } from '../components/chat/types/types';
import type { SessionDeliverablePipelineBundle } from './sessionDeliverablePipeline';
import type { DeliverablesDockState } from './deriveDeliverablesDockState';

export const SESSION_SWITCH_DOCK_SUBTITLE_KEY = 'deliverables.sessionSwitchLoading';

export function createSessionSwitchDockPlaceholder(sessionId: string | null): DeliverablesDockState {
  return {
    sessionId,
    rows: [],
    progress: { done: 0, total: 0 },
    folderPath: null,
    folderItems: [],
    turnDeliverables: [],
    showComposerChrome: false,
    isInProgress: true,
    isRepairActive: false,
    hasSessionManifest: false,
    latestMessageId: null,
    statusSubtitleKey: SESSION_SWITCH_DOCK_SUBTITLE_KEY,
  };
}

export type DeferredDeliverableMessageBundle = {
  sessionId: string | null;
  messages: ChatMessage[];
};

export function resolveDeferredDeliverableMessageBundle(input: {
  currentSessionId: string | null;
  chatMessages: ChatMessage[];
  deferredBundle: DeferredDeliverableMessageBundle;
}): { aligned: boolean; messages: ChatMessage[] } {
  const currentSessionId = input.currentSessionId;
  if (!currentSessionId) {
    return { aligned: true, messages: [] };
  }
  const aligned = input.deferredBundle.sessionId === currentSessionId;
  return {
    aligned,
    messages: aligned ? input.deferredBundle.messages : [],
  };
}

export function resolveRailDeliverablesDockState(input: {
  dockState: DeliverablesDockState | null;
  selectedSessionId: string | null | undefined;
}): DeliverablesDockState {
  const selectedSessionId = input.selectedSessionId ?? null;
  if (!selectedSessionId) {
    return createSessionSwitchDockPlaceholder(null);
  }
  const dockState = input.dockState;
  if (!dockState) {
    return createSessionSwitchDockPlaceholder(selectedSessionId);
  }
  if (dockState.sessionId != null && dockState.sessionId !== selectedSessionId) {
    return createSessionSwitchDockPlaceholder(selectedSessionId);
  }
  return dockState;
}

export function resolveEffectiveIsLoadingOnSelectionChange(input: {
  selectedSessionId: string | null;
  previousSelectedSessionId: string | null;
  isLoading: boolean;
}): boolean {
  if (input.selectedSessionId !== input.previousSelectedSessionId) {
    return false;
  }
  return input.isLoading;
}

export function resolveSessionFrozenPipelineBundle(input: {
  currentSessionId: string | null;
  frozenSessionId: string | null;
  frozenBundle: SessionDeliverablePipelineBundle | null;
  deferWhileStreaming: boolean;
  runDeliverablesPipeline: boolean;
  computedBundle: SessionDeliverablePipelineBundle | null;
}): SessionDeliverablePipelineBundle | null {
  if (input.computedBundle) return input.computedBundle;
  if (
    input.deferWhileStreaming
    && !input.runDeliverablesPipeline
    && input.frozenBundle
    && input.frozenSessionId
    && input.frozenSessionId === input.currentSessionId
  ) {
    return input.frozenBundle;
  }
  return null;
}

export function shouldClearFrozenPipelineOnSessionChange(input: {
  currentSessionId: string | null;
  frozenSessionId: string | null;
}): boolean {
  return input.frozenSessionId !== input.currentSessionId;
}
