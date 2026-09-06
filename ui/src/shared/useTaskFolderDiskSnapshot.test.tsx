import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as taskFolderSnapshotModule from './fetchTaskFolderSnapshot';
import type { SessionDeliverableSlotUi } from './resolveSessionDeliverableManifest';
import { useTaskFolderDiskSnapshot } from './useTaskFolderDiskSnapshot';

const fetchEnvelopeMock = vi.hoisted(() => vi.fn());

vi.mock('./fetchTaskFolderSnapshot', async (importOriginal) => {
  const actual = await importOriginal<typeof taskFolderSnapshotModule>();
  return {
    ...actual,
    fetchTaskFolderSnapshotEnvelope: (
      ...args: Parameters<typeof actual.fetchTaskFolderSnapshotEnvelope>
    ) => fetchEnvelopeMock(...args),
  };
});

function completeEnvelope(path: string): taskFolderSnapshotModule.TaskFolderSnapshotEnvelope {
  return {
    files: [{
      path,
      basename: path.split('/').pop() ?? path,
      inContract: true,
      slotId: 'report',
      unitId: 'report',
      snapshotState: 'verified',
    }],
    status: 'complete',
    snapshotVersion: 2,
    truncated: false,
    scannedCount: 1,
    excludedCount: 0,
    snapshotComplete: true,
    binding: {
      requiredCount: 1,
      matchedCount: 1,
      complete: true,
    },
    scopeDir: 'artifacts/task',
  };
}

afterEach(() => {
  cleanup();
  fetchEnvelopeMock.mockReset();
  vi.useRealTimers();
});

describe('useTaskFolderDiskSnapshot', () => {
  it('ignores a delayed old response after canonical contract identity changes', async () => {
    vi.useFakeTimers();
    let resolveOld: ((value: taskFolderSnapshotModule.TaskFolderSnapshotEnvelope) => void) | undefined;
    let resolveNew: ((value: taskFolderSnapshotModule.TaskFolderSnapshotEnvelope) => void) | undefined;
    fetchEnvelopeMock
      .mockReturnValueOnce(new Promise<taskFolderSnapshotModule.TaskFolderSnapshotEnvelope>((resolve) => {
        resolveOld = resolve;
      }))
      .mockReturnValueOnce(new Promise<taskFolderSnapshotModule.TaskFolderSnapshotEnvelope>((resolve) => {
        resolveNew = resolve;
      }));

    const baseSlot: SessionDeliverableSlotUi = {
      id: 'report',
      label: '旧报告',
      kind: 'markdown',
      count: 1,
      required: true,
      status: 'active',
      pathHint: 'report.md',
      pathHints: ['report.md'],
    };
    const { result, rerender } = renderHook(
      ({ slot }) => useTaskFolderDiskSnapshot({
        projectName: 'general',
        scopeDir: 'artifacts/task',
        slots: [slot],
        enabled: true,
        goalVersion: 1,
      }),
      { initialProps: { slot: baseSlot } },
    );

    await act(async () => {
      vi.advanceTimersByTime(120);
    });
    expect(fetchEnvelopeMock).toHaveBeenCalledTimes(1);

    rerender({ slot: { ...baseSlot, label: '新报告' } });
    await act(async () => {
      vi.advanceTimersByTime(120);
    });
    expect(fetchEnvelopeMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolveNew?.(completeEnvelope('artifacts/task/new-report.md'));
      await Promise.resolve();
    });
    expect(result.current.files[0]?.path).toBe('artifacts/task/new-report.md');

    await act(async () => {
      resolveOld?.(completeEnvelope('artifacts/task/old-report.md'));
      await Promise.resolve();
    });
    expect(result.current.files[0]?.path).toBe('artifacts/task/new-report.md');
  });
});
