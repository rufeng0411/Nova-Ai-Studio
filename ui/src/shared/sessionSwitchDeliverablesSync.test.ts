import { describe, expect, it } from 'vitest';
import {
  createSessionSwitchDockPlaceholder,
  resolveDeferredDeliverableMessageBundle,
  resolveEffectiveIsLoadingOnSelectionChange,
  resolveRailDeliverablesDockState,
  resolveSessionFrozenPipelineBundle,
  shouldClearFrozenPipelineOnSessionChange,
  SESSION_SWITCH_DOCK_SUBTITLE_KEY,
} from './sessionSwitchDeliverablesSync';
import type { SessionDeliverablePipelineBundle } from './sessionDeliverablePipeline';

function stubBundle(sessionLabel: string): SessionDeliverablePipelineBundle {
  return {
    fingerprint: sessionLabel,
    scopeDir: `artifacts/task-${sessionLabel}`,
    sessionItems: [],
    verifiedPaths: [],
    contract: { profileId: null, slots: [], goalVersion: 1 },
    latest: { messageId: null, provisional: false },
    unifiedView: {
      rows: [],
      contractHash: null,
      certificateObservation: null,
    },
    dockState: {
      rows: [],
      folderItems: [],
      folderPath: `artifacts/task-${sessionLabel}`,
      turnArtifactDir: `artifacts/task-${sessionLabel}`,
      progress: { done: 1, total: 3 },
      showComposerChrome: true,
      isInProgress: true,
      isRepairActive: false,
      contractHash: null,
    },
    validationSession: {
      currentManifest: undefined,
      expectedEntries: [],
      sdmSlotPaths: [],
      latestAcceptanceMeta: undefined,
    },
    processRailProgress: null,
  } as SessionDeliverablePipelineBundle;
}

describe('resolveEffectiveIsLoadingOnSelectionChange', () => {
  it('drops stale loading when the selected session changes', () => {
    expect(resolveEffectiveIsLoadingOnSelectionChange({
      selectedSessionId: 'B',
      previousSelectedSessionId: 'A',
      isLoading: true,
    })).toBe(false);
  });

  it('keeps loading for the same selected session', () => {
    expect(resolveEffectiveIsLoadingOnSelectionChange({
      selectedSessionId: 'A',
      previousSelectedSessionId: 'A',
      isLoading: true,
    })).toBe(true);
  });
});

describe('resolveSessionFrozenPipelineBundle', () => {
  it('never reuses a frozen bundle from another session', () => {
    const bundleA = stubBundle('A');
    expect(resolveSessionFrozenPipelineBundle({
      currentSessionId: 'B',
      frozenSessionId: 'A',
      frozenBundle: bundleA,
      deferWhileStreaming: true,
      runDeliverablesPipeline: false,
      computedBundle: null,
    })).toBeNull();
  });

  it('reuses a frozen bundle only for the same session during defer', () => {
    const bundleB = stubBundle('B');
    expect(resolveSessionFrozenPipelineBundle({
      currentSessionId: 'B',
      frozenSessionId: 'B',
      frozenBundle: bundleB,
      deferWhileStreaming: true,
      runDeliverablesPipeline: false,
      computedBundle: null,
    })).toBe(bundleB);
  });

  it('prefers a freshly computed bundle', () => {
    const bundleA = stubBundle('A');
    const bundleB = stubBundle('B');
    expect(resolveSessionFrozenPipelineBundle({
      currentSessionId: 'B',
      frozenSessionId: 'A',
      frozenBundle: bundleA,
      deferWhileStreaming: true,
      runDeliverablesPipeline: false,
      computedBundle: bundleB,
    })).toBe(bundleB);
  });
});

describe('shouldClearFrozenPipelineOnSessionChange', () => {
  it('clears when session ids differ', () => {
    expect(shouldClearFrozenPipelineOnSessionChange({
      currentSessionId: 'B',
      frozenSessionId: 'A',
    })).toBe(true);
  });

  it('keeps when session ids match', () => {
    expect(shouldClearFrozenPipelineOnSessionChange({
      currentSessionId: 'A',
      frozenSessionId: 'A',
    })).toBe(false);
  });
});

describe('resolveDeferredDeliverableMessageBundle', () => {
  it('drops deferred messages when bundle session differs from active session', () => {
    const result = resolveDeferredDeliverableMessageBundle({
      currentSessionId: 'B',
      chatMessages: [{ id: 'b1', type: 'user', content: 'B' } as never],
      deferredBundle: {
        sessionId: 'A',
        messages: [{ id: 'a1', type: 'user', content: 'A' } as never],
      },
    });
    expect(result.aligned).toBe(false);
    expect(result.messages).toEqual([]);
  });

  it('keeps deferred messages when sessions match', () => {
    const messages = [{ id: 'b1', type: 'user', content: 'B' } as never];
    const result = resolveDeferredDeliverableMessageBundle({
      currentSessionId: 'B',
      chatMessages: messages,
      deferredBundle: { sessionId: 'B', messages },
    });
    expect(result.aligned).toBe(true);
    expect(result.messages).toBe(messages);
  });
});

describe('resolveRailDeliverablesDockState', () => {
  it('returns loading placeholder when dock belongs to another session', () => {
    const resolved = resolveRailDeliverablesDockState({
      selectedSessionId: 'B',
      dockState: {
        sessionId: 'A',
        rows: [{ id: 'row-a' } as never],
        progress: { done: 1, total: 1 },
        folderPath: 'artifacts/task-A',
        folderItems: [],
        turnDeliverables: [],
        showComposerChrome: true,
        isInProgress: false,
        isRepairActive: false,
        hasSessionManifest: false,
        latestMessageId: null,
      },
    });
    expect(resolved.sessionId).toBe('B');
    expect(resolved.rows).toEqual([]);
    expect(resolved.statusSubtitleKey).toBe(SESSION_SWITCH_DOCK_SUBTITLE_KEY);
  });
});

describe('createSessionSwitchDockPlaceholder', () => {
  it('marks in-progress loading without rows', () => {
    const placeholder = createSessionSwitchDockPlaceholder('session-1');
    expect(placeholder.sessionId).toBe('session-1');
    expect(placeholder.rows).toEqual([]);
    expect(placeholder.isInProgress).toBe(true);
    expect(placeholder.statusSubtitleKey).toBe(SESSION_SWITCH_DOCK_SUBTITLE_KEY);
  });
});
