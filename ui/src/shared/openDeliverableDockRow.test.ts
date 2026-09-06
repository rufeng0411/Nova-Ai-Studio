import { describe, expect, it } from 'vitest';
import {
  buildDockRowOpenOptions,
  canOpenDeliverableDockRow,
  resolveDockRowOpenPath,
} from './openDeliverableDockRow';
import type { DeliverableDockRow } from './buildDeliverableDockRows';

describe('openDeliverableDockRow', () => {
  it('opens checking rows that already have a resolved path', () => {
    const row: DeliverableDockRow = {
      id: 's-check',
      label: '报告',
      path: 'report.html',
      resolvedPath: 'artifacts/task-x/report.html',
      status: 'checking',
      previewable: true,
      linkable: true,
    };
    expect(canOpenDeliverableDockRow(row)).toBe(true);
  });

  it('does not open checking rows without a path', () => {
    const row: DeliverableDockRow = {
      id: 's-empty',
      label: '报告',
      path: '',
      status: 'checking',
      previewable: false,
      linkable: false,
    };
    expect(canOpenDeliverableDockRow(row)).toBe(false);
  });

  it('opens delivered rows even when linkable flag is false', () => {
    const row: DeliverableDockRow = {
      id: 's1',
      label: '报告',
      path: 'artifacts/task/report.md',
      status: 'delivered',
      previewable: true,
      linkable: false,
    };
    expect(canOpenDeliverableDockRow(row)).toBe(true);
    expect(resolveDockRowOpenPath(row)).toBe('artifacts/task/report.md');
  });

  it('passes turnArtifactDir as hintDir for preview open', () => {
    const row: DeliverableDockRow = {
      id: 's1',
      label: '首页',
      path: 'index.html',
      status: 'delivered',
      previewable: true,
      linkable: true,
    };
    expect(buildDockRowOpenOptions(row, 'artifacts/task-a')).toEqual({
      initialPreview: true,
      hintDir: 'artifacts/task-a',
      skipResolve: true,
    });
  });

  it('sets skipResolve when row already has resolvedPath', () => {
    const row: DeliverableDockRow = {
      id: 's2',
      label: '报告',
      path: 'report.md',
      resolvedPath: 'artifacts/task-b/report.md',
      status: 'delivered',
      previewable: true,
      linkable: true,
    };
    expect(buildDockRowOpenOptions(row)).toEqual({
      initialPreview: true,
      skipResolve: true,
    });
  });

  it('re-scopes cross-task deck.bento.html to turnArtifactDir (Razer/FIFA RCA)', () => {
    const row: DeliverableDockRow = {
      id: 'bento',
      label: '演示稿',
      path: 'deck.bento.html',
      resolvedPath: 'artifacts/task-20260728-41dd1371/deck.bento.html',
      status: 'delivered',
      previewable: true,
      linkable: true,
    };
    const turnDir = 'artifacts/task-20260728-a1b2c3d4';
    expect(resolveDockRowOpenPath(row, turnDir)).toBe(`${turnDir}/deck.bento.html`);
    expect(buildDockRowOpenOptions(row, turnDir)).toMatchObject({
      initialPreview: true,
      hintDir: turnDir,
      skipResolve: true,
    });
  });
});
