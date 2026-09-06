import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useEditorSidebar } from './useEditorSidebar';
import * as resolveModule from '../../../shared/resolveProjectFilePath';
import type { Project } from '../../../types/app';

const project = { name: 'general', fullPath: '', path: '' } as unknown as Project;

describe('useEditorSidebar handleFileOpen', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens scoped artifact paths without Bridge file/resolve', async () => {
    const spy = vi.spyOn(resolveModule, 'resolveProjectFilePath');

    const { result } = renderHook(() =>
      useEditorSidebar({ selectedProject: project, isMobile: false }),
    );

    await act(async () => {
      result.current.handleFileOpen('artifacts/task-b/index.html', { initialPreview: true });
    });

    expect(spy).not.toHaveBeenCalled();
    expect(result.current.editingFile?.path).toBe('artifacts/task-b/index.html');
    expect(result.current.editingFile?.skipResolve).toBe(true);
  });

  it('opens bare basename with hintDir via client-side skipResolve', async () => {
    const spy = vi.spyOn(resolveModule, 'resolveProjectFilePath');

    const { result } = renderHook(() =>
      useEditorSidebar({ selectedProject: project, isMobile: false }),
    );

    await act(async () => {
      result.current.handleFileOpen('index.html', { hintDir: 'artifacts/task-b', initialPreview: true });
    });

    expect(spy).not.toHaveBeenCalled();
    expect(result.current.editingFile?.path).toBe('artifacts/task-b/index.html');
    expect(result.current.editingFile?.skipResolve).toBe(true);
    expect(result.current.editingFile?.hintDir).toBe('artifacts/task-b');
  });

  it('re-scopes cross-task deck.bento.html before opening sidebar preview', async () => {
    const spy = vi.spyOn(resolveModule, 'resolveProjectFilePath');

    const { result } = renderHook(() =>
      useEditorSidebar({ selectedProject: project, isMobile: false }),
    );

    await act(async () => {
      result.current.handleFileOpen('artifacts/task-20260728-41dd1371/deck.bento.html', {
        hintDir: 'artifacts/task-20260728-a1b2c3d4',
        initialPreview: true,
        bentoStudioMode: 'edit',
      });
    });

    expect(spy).not.toHaveBeenCalled();
    expect(result.current.editingFile?.path).toBe('artifacts/task-20260728-a1b2c3d4/deck.bento.html');
    expect(result.current.editingFile?.hintDir).toBe('artifacts/task-20260728-a1b2c3d4');
    expect(result.current.editingFile?.bentoStudioMode).toBe('edit');
  });

  it('defaults bentoStudioMode to view for deck.bento.html without explicit options', async () => {
    const spy = vi.spyOn(resolveModule, 'resolveProjectFilePath');

    const { result } = renderHook(() =>
      useEditorSidebar({ selectedProject: project, isMobile: false }),
    );

    await act(async () => {
      result.current.handleFileOpen('artifacts/task-b/deck.bento.html', { initialPreview: true });
    });

    expect(spy).not.toHaveBeenCalled();
    expect(result.current.editingFile?.bentoStudioMode).toBe('view');
  });

  it('still resolves ambiguous bare basename without hintDir', async () => {
    const spy = vi
      .spyOn(resolveModule, 'resolveProjectFilePath')
      .mockResolvedValue({ relativePath: 'artifacts/task-b/index.html' });

    const { result } = renderHook(() =>
      useEditorSidebar({ selectedProject: project, isMobile: false }),
    );

    await act(async () => {
      result.current.handleFileOpen('index.html');
      await Promise.resolve();
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.current.editingFile?.skipResolve).toBe(true);
  });
});
