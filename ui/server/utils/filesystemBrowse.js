// PD-SAAS-FORK: server-side folder browse roots, drives, and ensure-path helpers
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const BROWSE_ROOTS_TOKEN = '@roots';

const WINDOWS_DRIVE_PATTERN = /^[A-Za-z]:\\?$/;

/**
 * @param {string | undefined | null} inputPath
 * @param {string} workspacesRoot
 */
export function expandWorkspacePath(inputPath, workspacesRoot) {
  if (!inputPath) return inputPath;
  if (inputPath === '~') {
    return workspacesRoot;
  }
  if (inputPath.startsWith('~/') || inputPath.startsWith('~\\')) {
    return path.join(workspacesRoot, inputPath.slice(2));
  }
  return inputPath;
}

/**
 * @param {string} letter
 * @param {typeof fsPromises.access} [accessFn]
 */
export async function isDriveAccessible(letter, accessFn = fsPromises.access) {
  const drivePath = `${letter}:\\`;
  try {
    await accessFn(drivePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {typeof fsPromises.access} [accessFn]
 */
export async function listWindowsDrives(accessFn = fsPromises.access) {
  const drives = [];
  for (let code = 65; code <= 90; code += 1) {
    const letter = String.fromCharCode(code);
    if (await isDriveAccessible(letter, accessFn)) {
      drives.push({
        path: `${letter}:\\`,
        name: `${letter}:`,
        type: 'directory',
        kind: 'drive',
      });
    }
  }
  return drives;
}

/**
 * @param {string} dirPath
 * @param {typeof fsPromises.access} [accessFn]
 */
async function pathExists(dirPath, accessFn = fsPromises.access) {
  try {
    await accessFn(dirPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} dirPath
 * @param {typeof fsPromises.readdir} [readdirFn]
 */
async function listMountEntries(dirPath, readdirFn = fsPromises.readdir) {
  if (!(await pathExists(dirPath))) {
    return [];
  }
  try {
    const entries = await readdirFn(dirPath, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const entryPath = path.join(dirPath, entry.name);
      results.push({
        path: entryPath,
        name: entry.name,
        type: 'directory',
        kind: 'volume',
      });
    }
    return results.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/**
 * @param {string} workspacesRoot
 * @param {{ platform?: NodeJS.Platform; homedir?: string; accessFn?: typeof fsPromises.access; readdirFn?: typeof fsPromises.readdir }} [options]
 */
export async function listQuickRoots(workspacesRoot, options = {}) {
  const platform = options.platform ?? process.platform;
  const homedir = options.homedir ?? os.homedir();
  const accessFn = options.accessFn ?? fsPromises.access;
  const readdirFn = options.readdirFn ?? fsPromises.readdir;

  const roots = [];

  if (platform === 'win32') {
    roots.push({
      path: BROWSE_ROOTS_TOKEN,
      name: 'This PC',
      type: 'directory',
      kind: 'group',
      group: 'this-pc',
    });
    const drives = await listWindowsDrives(accessFn);
    roots.push(...drives);
  }

  roots.push({
    path: homedir,
    name: 'Home',
    type: 'directory',
    kind: 'home',
  });

  const desktop = path.join(homedir, 'Desktop');
  if (await pathExists(desktop, accessFn)) {
    roots.push({
      path: desktop,
      name: 'Desktop',
      type: 'directory',
      kind: 'desktop',
    });
  }

  const documents = path.join(homedir, 'Documents');
  if (await pathExists(documents, accessFn)) {
    roots.push({
      path: documents,
      name: 'Documents',
      type: 'directory',
      kind: 'documents',
    });
  }

  if (platform === 'darwin') {
    const volumes = await listMountEntries('/Volumes', readdirFn);
    roots.push(...volumes);
  } else if (platform !== 'win32') {
    const media = await listMountEntries('/media', readdirFn);
    const mnt = await listMountEntries('/mnt', readdirFn);
    roots.push(...media, ...mnt);
    if (await pathExists('/', accessFn)) {
      roots.push({
        path: '/',
        name: '/',
        type: 'directory',
        kind: 'root',
      });
    }
  }

  if (workspacesRoot && workspacesRoot !== homedir) {
    if (await pathExists(workspacesRoot, accessFn)) {
      roots.push({
        path: workspacesRoot,
        name: 'Workspaces',
        type: 'directory',
        kind: 'workspaces',
      });
    }
  }

  return roots;
}

/**
 * @param {string} resolvedPath
 */
export function getBrowseParentPath(resolvedPath) {
  if (!resolvedPath) return null;
  if (resolvedPath === '/' || WINDOWS_DRIVE_PATTERN.test(resolvedPath)) {
    return BROWSE_ROOTS_TOKEN;
  }

  const parent = path.dirname(resolvedPath);
  if (parent === resolvedPath) {
    return BROWSE_ROOTS_TOKEN;
  }
  if (WINDOWS_DRIVE_PATTERN.test(parent)) {
    return parent.endsWith('\\') ? parent : `${parent}\\`;
  }
  return parent;
}

/**
 * @param {string} dirPath
 * @param {string} workspacesRoot
 */
export function resolveBrowseQueryPath(dirPath, workspacesRoot) {
  const trimmed = String(dirPath || '').trim();
  if (!trimmed || trimmed === BROWSE_ROOTS_TOKEN) {
    return { kind: 'roots', targetPath: BROWSE_ROOTS_TOKEN };
  }
  const expanded = expandWorkspacePath(trimmed, workspacesRoot);
  return { kind: 'directory', targetPath: path.resolve(expanded) };
}

/**
 * @param {string} resolvedPath
 * @param {(dirPath: string, maxDepth: number, currentDepth: number, showHidden: boolean) => Promise<Array<{ path: string; name: string; type: string }>>} getFileTree
 * @param {string} workspacesRoot
 */
export async function listBrowseDirectory(resolvedPath, getFileTree, workspacesRoot) {
  const fileTree = await getFileTree(resolvedPath, 1, 0, false);
  const directories = fileTree
    .filter((item) => item.type === 'directory')
    .map((item) => ({
      path: item.path,
      name: item.name,
      type: 'directory',
    }))
    .sort((a, b) => {
      const aHidden = a.name.startsWith('.');
      const bHidden = b.name.startsWith('.');
      if (aHidden && !bHidden) return 1;
      if (!aHidden && bHidden) return -1;
      return a.name.localeCompare(b.name);
    });

  let resolvedWorkspaceRoot = workspacesRoot;
  try {
    resolvedWorkspaceRoot = await fsPromises.realpath(workspacesRoot);
  } catch {
    // keep default
  }

  if (resolvedPath === resolvedWorkspaceRoot) {
    const commonDirs = ['Desktop', 'Documents', 'Projects', 'Development', 'Dev', 'Code', 'workspace'];
    const existingCommon = directories.filter((dir) => commonDirs.includes(dir.name));
    const otherDirs = directories.filter((dir) => !commonDirs.includes(dir.name));
    return [...existingCommon, ...otherDirs];
  }

  return directories;
}

/**
 * @param {string} folderPath
 * @param {boolean} createMissing
 * @param {string} workspacesRoot
 * @param {(requestedPath: string) => Promise<{ valid: boolean; resolvedPath?: string; error?: string }>} validateWorkspacePath
 */
export async function ensureFilesystemPath(folderPath, createMissing, workspacesRoot, validateWorkspacePath) {
  if (!folderPath || typeof folderPath !== 'string') {
    return { ok: false, status: 400, error: 'Path is required' };
  }

  const expandedPath = expandWorkspacePath(folderPath.trim(), workspacesRoot);
  const resolvedInput = path.resolve(expandedPath);
  const validation = await validateWorkspacePath(resolvedInput);
  if (!validation.valid) {
    return { ok: false, status: 403, error: validation.error || 'Invalid workspace path' };
  }

  const targetPath = validation.resolvedPath || resolvedInput;

  let existed = false;
  try {
    await fsPromises.access(targetPath);
    const stats = await fsPromises.stat(targetPath);
    if (!stats.isDirectory()) {
      return { ok: false, status: 400, error: 'Path is not a directory' };
    }
    existed = true;
    return { ok: true, status: 200, path: targetPath, existed, created: false };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
      return { ok: false, status: 404, error: 'Directory not accessible' };
    }
  }

  if (!createMissing) {
    return { ok: false, status: 404, error: 'Directory does not exist' };
  }

  try {
    await fsPromises.mkdir(targetPath, { recursive: true });
    return { ok: true, status: 200, path: targetPath, existed: false, created: true };
  } catch (mkdirError) {
    return {
      ok: false,
      status: 500,
      error: mkdirError instanceof Error ? mkdirError.message : 'Failed to create directory',
    };
  }
}

/**
 * @param {string} dirPath
 * @param {string} fileName
 * @param {string} content
 * @param {string} workspacesRoot
 * @param {(requestedPath: string) => Promise<{ valid: boolean; resolvedPath?: string; error?: string }>} validateWorkspacePath
 */
export async function createFileInDirectory(
  dirPath,
  fileName,
  content,
  workspacesRoot,
  validateWorkspacePath,
) {
  const safeName = String(fileName || '').trim();
  if (!safeName || safeName.includes('/') || safeName.includes('\\') || safeName.includes('..')) {
    return { ok: false, status: 400, error: 'Invalid file name' };
  }

  const expandedDir = expandWorkspacePath(String(dirPath || '').trim(), workspacesRoot);
  const resolvedDir = path.resolve(expandedDir);
  const validation = await validateWorkspacePath(resolvedDir);
  if (!validation.valid) {
    return { ok: false, status: 403, error: validation.error || 'Invalid directory path' };
  }

  const directory = validation.resolvedPath || resolvedDir;
  try {
    const stats = await fsPromises.stat(directory);
    if (!stats.isDirectory()) {
      return { ok: false, status: 400, error: 'Path is not a directory' };
    }
  } catch {
    return { ok: false, status: 404, error: 'Directory does not exist' };
  }

  const targetFile = path.join(directory, safeName);
  const fileValidation = await validateWorkspacePath(targetFile);
  if (!fileValidation.valid) {
    return { ok: false, status: 403, error: fileValidation.error || 'Invalid file path' };
  }

  try {
    await fsPromises.access(targetFile);
    return { ok: false, status: 409, error: 'File already exists' };
  } catch {
    // create
  }

  const payload = typeof content === 'string' ? content : '';
  if (Buffer.byteLength(payload, 'utf8') > 1024 * 1024) {
    return { ok: false, status: 400, error: 'File content too large' };
  }

  try {
    await fsPromises.writeFile(targetFile, payload, 'utf8');
    return { ok: true, status: 200, path: targetFile };
  } catch (writeError) {
    return {
      ok: false,
      status: 500,
      error: writeError instanceof Error ? writeError.message : 'Failed to create file',
    };
  }
}
