import { describe, expect, it, vi } from 'vitest';
import { resolveDeliverablePath } from './resolveDeliverablePath';
import * as resolveModule from './resolveProjectFilePath';

describe('resolveDeliverablePath', () => {
  it('passes hintDir for bare filenames', async () => {
    const spy = vi.spyOn(resolveModule, 'resolveProjectFilePath').mockResolvedValue({
      relativePath: 'artifacts/task-b/index.html',
    });
    await resolveDeliverablePath({
      projectName: 'general',
      path: 'index.html',
      turnArtifactDir: 'artifacts/task-b',
    });
    expect(spy).toHaveBeenCalledWith('general', 'artifacts/task-b/index.html', undefined, {
      hintDir: 'artifacts/task-b',
      skipResolve: undefined,
    });
    spy.mockRestore();
  });

  it('always resolves via server with hintDir when turn scope is known', async () => {
    const spy = vi.spyOn(resolveModule, 'resolveProjectFilePath').mockResolvedValue({
      relativePath: 'artifacts/task-b/index.html',
    });
    await resolveDeliverablePath({
      projectName: 'general',
      path: 'artifacts/task-b/index.html',
      turnArtifactDir: 'artifacts/task-b',
    });
    expect(spy).toHaveBeenCalledWith('general', 'artifacts/task-b/index.html', undefined, {
      hintDir: 'artifacts/task-b',
      skipResolve: undefined,
    });
    spy.mockRestore();
  });

  it('honours explicit skipResolve', async () => {
    const spy = vi.spyOn(resolveModule, 'resolveProjectFilePath').mockResolvedValue({
      relativePath: 'artifacts/task-b/index.html',
    });
    await resolveDeliverablePath({
      projectName: 'general',
      path: 'artifacts/task-b/index.html',
      skipResolve: true,
    });
    expect(spy).toHaveBeenCalledWith('general', 'artifacts/task-b/index.html', undefined, {
      hintDir: undefined,
      skipResolve: true,
    });
    spy.mockRestore();
  });

  it('re-scopes corrupted cross-task pathHint before resolve (Razer/FIFA RCA)', async () => {
    const spy = vi.spyOn(resolveModule, 'resolveProjectFilePath').mockResolvedValue({
      relativePath: 'artifacts/task-20260728-a1b2c3d4/deck.bento.html',
    });
    await resolveDeliverablePath({
      projectName: 'general',
      path: 'artifacts/task-20260728-41dd1371/deck.bento.html',
      turnArtifactDir: 'artifacts/task-20260728-a1b2c3d4',
    });
    expect(spy).toHaveBeenCalledWith(
      'general',
      'artifacts/task-20260728-a1b2c3d4/deck.bento.html',
      undefined,
      {
        hintDir: 'artifacts/task-20260728-a1b2c3d4',
        skipResolve: undefined,
      },
    );
    spy.mockRestore();
  });
});
