import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import {
  BROWSE_ROOTS_TOKEN,
  createFileInDirectory,
  ensureFilesystemPath,
  expandWorkspacePath,
  getBrowseParentPath,
  isDriveAccessible,
  listQuickRoots,
  listWindowsDrives,
  resolveBrowseQueryPath,
} from './filesystemBrowse.js';

describe('filesystemBrowse', () => {
  it('expands tilde against workspaces root', () => {
    const root = '/tmp/workspaces';
    expect(expandWorkspacePath('~', root)).toBe(root);
    expect(expandWorkspacePath('~/projects', root)).toBe(path.join(root, 'projects'));
    expect(expandWorkspacePath('C:\\foo', root)).toBe('C:\\foo');
  });

  it('resolves @roots browse token', () => {
    const result = resolveBrowseQueryPath('@roots', os.homedir());
    expect(result.kind).toBe('roots');
    expect(result.targetPath).toBe(BROWSE_ROOTS_TOKEN);
  });

  it('computes parent path for windows drive root', () => {
    expect(getBrowseParentPath('C:\\')).toBe(BROWSE_ROOTS_TOKEN);
    expect(getBrowseParentPath('C:\\Users')).toBe('C:\\');
  });

  it('lists windows drives with mocked access', async () => {
    const accessFn = vi.fn(async (drivePath) => {
      if (drivePath === 'C:\\' || drivePath === 'D:\\') return;
      throw new Error('missing');
    });
    const drives = await listWindowsDrives(accessFn);
    expect(drives.map((d) => d.path)).toEqual(['C:\\', 'D:\\']);
  });

  it('includes home in quick roots', async () => {
    const homedir = '/home/tester';
    const accessFn = vi.fn(async () => undefined);
    const roots = await listQuickRoots(homedir, {
      platform: 'linux',
      homedir,
      accessFn,
      readdirFn: vi.fn(async () => []),
    });
    expect(roots.some((r) => r.path === homedir && r.kind === 'home')).toBe(true);
  });

  it('checks drive accessibility', async () => {
    const accessFn = vi.fn(async () => undefined);
    await expect(isDriveAccessible('C', accessFn)).resolves.toBe(true);
    expect(accessFn).toHaveBeenCalledWith('C:\\');
  });

  it('ensureFilesystemPath creates nested directories', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pd-ensure-'));
    const target = path.join(root, 'a', 'b', 'c');
    const validate = async (requestedPath) => ({ valid: true, resolvedPath: requestedPath });

    const result = await ensureFilesystemPath(target, true, root, validate);
    expect(result.ok).toBe(true);
    expect(result.created).toBe(true);
    expect(result.existed).toBe(false);

    const stats = await fs.stat(target);
    expect(stats.isDirectory()).toBe(true);
  });

  it('ensureFilesystemPath rejects when missing and createMissing is false', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pd-ensure-'));
    const target = path.join(root, 'missing');
    const validate = async (requestedPath) => ({ valid: true, resolvedPath: requestedPath });

    const result = await ensureFilesystemPath(target, false, root, validate);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it('ensureFilesystemPath honors validateWorkspacePath', async () => {
    const validate = async () => ({ valid: false, error: 'Forbidden workspace path' });
    const result = await ensureFilesystemPath('C:\\Windows\\System32', true, os.tmpdir(), validate);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
  });

  it('createFileInDirectory writes empty file in validated dir', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pd-file-'));
    const validate = async (requestedPath) => ({ valid: true, resolvedPath: requestedPath });
    const result = await createFileInDirectory(root, 'notes.md', '', root, validate);
    expect(result.ok).toBe(true);
    const content = await fs.readFile(path.join(root, 'notes.md'), 'utf8');
    expect(content).toBe('');
  });
});
