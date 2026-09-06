import { describe, expect, it } from 'vitest';
import type { DeliverableDockRow } from './buildDeliverableDockRows';
import type { DeliverablesDockState } from './deriveDeliverablesDockState';
import {
  buildEnvelopePlaceholderRows,
  pickStickySummaryRows,
  resolvePersistedDeliverablesDockState,
  shouldAcceptFrozenPipelineUpdate,
  resolveRetainedSnapshotEnvelope,
  shouldRefreshTaskFolderSnapshot,
  shouldRetainTaskFolderSnapshot,
  shouldShowStickyDeliverableBar,
} from './stickyDeliverableBarPersist';

function row(id: string): DeliverableDockRow {
  return {
    id,
    label: id,
    path: `${id}.md`,
    status: 'checking',
    previewable: false,
    linkable: false,
  };
}

function dock(partial: Partial<DeliverablesDockState> = {}): DeliverablesDockState {
  return {
    sessionId: 's1',
    rows: [],
    progress: { done: 0, total: 0 },
    folderPath: null,
    folderItems: [],
    turnDeliverables: [],
    showComposerChrome: false,
    isInProgress: true,
    isRepairActive: true,
    hasSessionManifest: false,
    latestMessageId: null,
    ...partial,
  };
}

describe('shouldShowStickyDeliverableBar', () => {
  it('hides pure greeting chat', () => {
    expect(shouldShowStickyDeliverableBar({
      persistEnabled: true,
      stickySummaryEnabled: true,
      showComposerChrome: false,
      rowCount: 0,
      progressTotal: 0,
      hasSessionManifest: false,
      hasStdaDir: false,
      isDeliverableTask: false,
      lifecycleInFlight: false,
    })).toBe(false);
  });

  it('stays visible for deliverable tasks even with empty rows', () => {
    expect(shouldShowStickyDeliverableBar({
      persistEnabled: true,
      stickySummaryEnabled: true,
      showComposerChrome: false,
      rowCount: 0,
      progressTotal: 0,
      hasSessionManifest: true,
      hasStdaDir: false,
      isDeliverableTask: true,
      lifecycleInFlight: true,
    })).toBe(true);
  });
});

describe('resolvePersistedDeliverablesDockState', () => {
  it('keeps frozen rows while repair-owned pipeline is off', () => {
    const frozen = dock({
      sessionId: 's1',
      rows: [row('a'), row('b'), row('c')],
      progress: { done: 1, total: 3 },
    });
    const next = resolvePersistedDeliverablesDockState({
      live: dock({ sessionId: 's1', rows: [] }),
      frozen,
      sessionId: 's1',
      pipelineRunning: false,
      inFlight: true,
    });
    expect(next.rows).toHaveLength(3);
  });

  it('synthesizes checking placeholders from SDM when freeze is missing', () => {
    const next = resolvePersistedDeliverablesDockState({
      live: dock({ rows: [] }),
      frozen: null,
      envelopeManifest: {
        slots: [
          { id: 's1', label: 'A', pathHint: 'a.md', status: 'active' },
          { id: 's2', label: 'B', pathHint: 'b.md', status: 'active' },
          { id: 's3', label: 'C', pathHint: 'c.md', status: 'active' },
        ],
      },
      envelopeTaskDir: 'artifacts/task-x',
      sessionId: 's1',
      pipelineRunning: false,
      inFlight: true,
    });
    expect(next.rows).toHaveLength(3);
    expect(next.rows.every((item) => item.status === 'checking')).toBe(true);
    expect(next.rows.every((item) => item.linkable === false)).toBe(true);
    expect(next.showComposerChrome).toBe(true);
  });

  it('rejects foreign-session freeze', () => {
    const next = resolvePersistedDeliverablesDockState({
      live: dock({ sessionId: 's2', rows: [] }),
      frozen: dock({ sessionId: 's1', rows: [row('a')] }),
      sessionId: 's2',
      pipelineRunning: false,
      inFlight: true,
    });
    expect(next.rows).toHaveLength(0);
  });
});

describe('shouldAcceptFrozenPipelineUpdate', () => {
  it('rejects empty next while in-flight if previous freeze has rows', () => {
    expect(shouldAcceptFrozenPipelineUpdate({
      prev: { dockState: dock({ rows: [row('a')] }) } as never,
      next: { dockState: dock({ rows: [] }) } as never,
      inFlight: true,
    })).toBe(false);
  });

  it('accepts empty next when not in-flight', () => {
    expect(shouldAcceptFrozenPipelineUpdate({
      prev: { dockState: dock({ rows: [row('a')] }) } as never,
      next: { dockState: dock({ rows: [] }) } as never,
      inFlight: false,
    })).toBe(true);
  });
});

describe('pickStickySummaryRows', () => {
  it('keeps live rows when deferred is empty while assistant is working', () => {
    expect(pickStickySummaryRows({
      live: [row('a')],
      deferred: [],
      assistantWorking: true,
    })).toHaveLength(1);
  });
});

describe('snapshot helpers', () => {
  it('refreshes snapshot when pipeline is ready and scope exists', () => {
    expect(shouldRefreshTaskFolderSnapshot({ pipelineReady: true, hasScopeDir: true })).toBe(true);
    expect(shouldRefreshTaskFolderSnapshot({ pipelineReady: false, hasScopeDir: true })).toBe(false);
    expect(shouldRefreshTaskFolderSnapshot({
      pipelineReady: false,
      hasScopeDir: true,
      isAssistantWorking: true,
    })).toBe(true);
  });

  it('retains snapshot only for same session and scope', () => {
    expect(shouldRetainTaskFolderSnapshot({
      applicable: false,
      sessionId: 's1',
      scopeDir: 'artifacts/task-a',
      previousSessionId: 's1',
      previousScopeDir: 'artifacts/task-a',
    })).toBe(true);
    expect(shouldRetainTaskFolderSnapshot({
      applicable: false,
      sessionId: 's2',
      scopeDir: 'artifacts/task-a',
      previousSessionId: 's1',
      previousScopeDir: 'artifacts/task-a',
    })).toBe(false);
  });

  it('keeps the previous envelope when enabled flips off for the same key', () => {
    const previous = { files: [{ path: 'artifacts/task-a/report.html' }] };
    expect(resolveRetainedSnapshotEnvelope({
      applicable: false,
      sessionId: 's1',
      scopeDir: 'artifacts/task-a',
      previousSessionId: 's1',
      previousScopeDir: 'artifacts/task-a',
      previousEnvelope: previous,
    })).toBe(previous);
    expect(resolveRetainedSnapshotEnvelope({
      applicable: false,
      sessionId: 's2',
      scopeDir: 'artifacts/task-a',
      previousSessionId: 's1',
      previousScopeDir: 'artifacts/task-a',
      previousEnvelope: previous,
    })).toBeNull();
  });
});

describe('buildEnvelopePlaceholderRows', () => {
  it('skips removed slots', () => {
    const rows = buildEnvelopePlaceholderRows({
      slots: [
        { id: 'keep', label: 'Keep', status: 'active' },
        { id: 'gone', label: 'Gone', status: 'removed' },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('keep');
  });
});
