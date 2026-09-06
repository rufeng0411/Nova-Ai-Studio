import { describe, expect, it } from 'vitest';
import {
  buildOptimisticTaskFolderTarget,
  resolveEffectiveTaskFolderNavigationTarget,
} from './resolveTaskFolderNavigation';

describe('resolveEffectiveTaskFolderNavigationTarget', () => {
  it('prefers explicit navigation target', () => {
    const explicit = {
      id: 1,
      filePath: 'artifacts/task-a/report.md',
      folderPath: 'artifacts/task-a',
      hintDir: 'artifacts/task-a',
    };
    expect(resolveEffectiveTaskFolderNavigationTarget({
      explicitTarget: explicit,
      dockState: {
        sessionId: 's1',
        folderPath: 'artifacts/task-b',
      },
      selectedSessionId: 's1',
    })).toBe(explicit);
  });

  it('derives scope from the active session dock when explicit nav is absent', () => {
    const dockState = {
      sessionId: 's1',
      folderPath: 'artifacts/task-20260731-abc',
      turnArtifactDir: 'artifacts/task-20260731-abc',
      folderItems: [],
    };
    const resolved = resolveEffectiveTaskFolderNavigationTarget({
      explicitTarget: null,
      dockState,
      selectedSessionId: 's1',
      navId: 2,
    });
    expect(resolved?.folderPath).toBe('artifacts/task-20260731-abc');
    expect(resolved?.hintDir).toBe('artifacts/task-20260731-abc');
  });

  it('returns null when dock belongs to another session', () => {
    expect(resolveEffectiveTaskFolderNavigationTarget({
      explicitTarget: null,
      dockState: {
        sessionId: 's-old',
        folderPath: 'artifacts/task-old',
        folderItems: [],
      },
      selectedSessionId: 's-new',
    })).toBeNull();
  });

  it('buildOptimisticTaskFolderTarget uses dock folderPath without deliverable items', () => {
    const target = buildOptimisticTaskFolderTarget([], {
      folderPath: 'artifacts/task-empty',
      turnArtifactDir: 'artifacts/task-empty',
    }, 3);
    expect(target?.folderPath).toBe('artifacts/task-empty');
  });
});
