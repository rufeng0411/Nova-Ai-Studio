import os from 'node:os';
import path from 'path';
import { existsSync, readdirSync, statSync } from 'node:fs';
import {
  deliverableBasenamesMatch,
  deliverablePathCandidates,
  deliverableRelativePathMatches,
  hasExplicitSlideDeckPath,
  isBareDeliverableFilename,
  isDeliverableHintDirEnabled,
  isGenericClashProneBasename,
  isPartialScopedAssetPath,
  isNonUserDeliverablePath,
  isSlideDeckClashProneBasename,
  normalizeHintDir,
  normalizeRelativeDeliverablePath,
  pathUnderHintDir,
  sanitizeDeliverableLookupPath,
} from '../../shared/deliverablePathResolve.mjs';

/**
 * True when `candidate` resolves inside `root` (case-insensitive on Windows).
 */
export function isPathWithinProjectRoot(candidate, root) {
  const resolved = path.resolve(candidate);
  const projectRoot = path.resolve(root);
  if (process.platform === 'win32') {
    const lower = resolved.toLowerCase();
    const rootLower = projectRoot.toLowerCase();
    return lower === rootLower || lower.startsWith(`${rootLower}${path.sep}`);
  }
  return resolved === projectRoot || resolved.startsWith(`${projectRoot}${path.sep}`);
}

/**
 * Resolve a project-relative or absolute path under `projectRoot`.
 */
/**
 * When `\r` in `\rog`, `\rufen`, etc. is parsed as carriage return, restore `/r`.
 */
export function repairEatenBackslashRSegments(raw) {
  let s = String(raw || '');
  s = s.replace(/\r(?=[a-zA-Z])/g, '/r');
  s = s.replace(/(\.pilotdeck)\s+og([\w.-]+)/gi, '$1/rog$2');
  s = s.replace(/([/\\])\s+og([\w./\\-]+)/gi, '$1rog$2');
  s = s.replace(/([/\\])\s+(e(lease|ferences|sources|adme|po|port|sults))([\w./\\-]*)/gi, '$1r$2$4');
  return s;
}

export function repairCorruptedWindowsPath(raw) {
  let s = repairEatenBackslashRSegments(String(raw || ''));
  s = s.replace(/Users\\?\r(?=ufen)/gi, 'Users/r');
  s = s.replace(/Users\/+\r(?=ufen)/gi, 'Users/r');
  s = s.replace(/Users\s+(?=ufen)/gi, 'Users/r');
  return expandTruncatedWindowsProfilePath(s);
}

/**
 * Paths like `Users/rufen/.pilotdeck/index.html` (drive letter lost after `\r` corruption).
 */
export function expandTruncatedWindowsProfilePath(raw) {
  let s = String(raw || '');
  if (process.platform !== 'win32' || /^[A-Za-z]:[\\/]/.test(s)) {
    return s;
  }
  const tail = s.match(/^Users[\\/]r?ufen[\\/](.+)$/i);
  if (tail) {
    return path.join(os.homedir(), tail[1]);
  }
  return s;
}

export function findProjectRootContaining(absolutePath, projectRoots) {
  const resolved = path.resolve(absolutePath);
  let bestRoot = null;
  let bestLength = -1;
  for (const root of projectRoots) {
    const normalizedRoot = path.resolve(root);
    if (!isPathWithinProjectRoot(resolved, normalizedRoot)) continue;
    if (normalizedRoot.length > bestLength) {
      bestLength = normalizedRoot.length;
      bestRoot = normalizedRoot;
    }
  }
  return bestRoot;
}

/**
 * Resolve a preview target under the requested project, or any known project root
 * when the path is absolute / corrupted / outside the requested project.
 */
export function resolvePreviewPath(requestedProjectRoot, targetPath, knownProjectRoots = []) {
  const normalizedRoot = path.resolve(requestedProjectRoot);
  const expanded = expandTruncatedWindowsProfilePath(repairCorruptedWindowsPath(targetPath));

  const direct = resolvePathInProject(normalizedRoot, expanded);
  if (direct.valid) {
    return direct;
  }

  const absoluteCandidate = path.isAbsolute(expanded)
    ? path.resolve(expanded)
    : null;

  if (absoluteCandidate && knownProjectRoots.length > 0) {
    const owningRoot = findProjectRootContaining(absoluteCandidate, knownProjectRoots);
    if (owningRoot) {
      return resolvePathInProject(owningRoot, absoluteCandidate);
    }
  }

  return direct;
}

/** @deprecated Use deliverablePathCandidates from shared module */
export function artifactPathCandidates(targetPath) {
  const repaired = expandTruncatedWindowsProfilePath(repairCorruptedWindowsPath(targetPath));
  return deliverablePathCandidates(repaired);
}

const ARTIFACT_SEARCH_MAX_DEPTH = 8;
const ARTIFACT_SEARCH_MAX_ENTRIES = 1200;
const ARTIFACT_SKIP_DIRS = new Set(['node_modules', '.git', '.svn', 'dist', 'build']);

/**
 * Collect all artifact matches for a lookup path.
 * @returns {Array<{ relative: string, mtime: number }>}
 */
export function findArtifactFileMatches(projectRoot, lookupPath, options = {}) {
  const artifactsDir = path.join(projectRoot, 'artifacts');
  if (!existsSync(artifactsDir)) {
    return [];
  }

  const sanitized = sanitizeDeliverableLookupPath(lookupPath);
  if (!sanitized) {
    return [];
  }

  const hintDir = options.hintDir ? normalizeHintDir(options.hintDir) : '';

  if (isSlideDeckClashProneBasename(sanitized) && !hasExplicitSlideDeckPath(sanitized) && !hintDir) {
    return [];
  }
  const targetBase = path.posix.basename(sanitized.replace(/\\/g, '/'));
  const hasDir = sanitized.includes('/');

  const matches = [];
  let scanned = 0;

  const consider = (full) => {
    const relative = path.relative(projectRoot, full).split(path.sep).join('/');
    if (hintDir && !pathUnderHintDir(relative, hintDir)) {
      return;
    }
    let mtime = 0;
    try {
      mtime = statSync(full).mtimeMs;
    } catch {
      mtime = 0;
    }
    matches.push({ relative, mtime });
  };

  const walk = (dir, depth) => {
    if (depth > ARTIFACT_SEARCH_MAX_DEPTH || scanned >= ARTIFACT_SEARCH_MAX_ENTRIES) {
      return;
    }
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (scanned >= ARTIFACT_SEARCH_MAX_ENTRIES) {
        return;
      }
      scanned += 1;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (ARTIFACT_SKIP_DIRS.has(entry.name)) {
          continue;
        }
        walk(full, depth + 1);
      } else if (entry.isFile()) {
        const relative = path.relative(projectRoot, full).split(path.sep).join('/');
        if (hasDir) {
          if (deliverableRelativePathMatches(relative, sanitized)) {
            consider(full);
          }
          continue;
        }
        if (deliverableBasenamesMatch(entry.name, targetBase)) {
          consider(full);
        }
      }
    }
  };

  // PD-SAAS-FORK: hintDir given → scoped walk only; never scan full artifacts tree.
  if (hintDir) {
    const scopedRoot = path.join(projectRoot, ...hintDir.split('/'));
    if (existsSync(scopedRoot)) {
      walk(scopedRoot, 0);
      return matches;
    }
    return [];
  }

  walk(artifactsDir, 0);
  return matches;
}

/**
 * Async variant — yields event loop between readdir batches when async resolve enabled.
 * @returns {Promise<Array<{ relative: string, mtime: number }>>}
 */
export async function findArtifactFileMatchesAsync(projectRoot, lookupPath, options = {}) {
  if (process.env.PILOTDECK_DELIVERABLE_ASYNC_RESOLVE !== '1') {
    return findArtifactFileMatches(projectRoot, lookupPath, options);
  }

  const fs = await import('node:fs/promises');
  const artifactsDir = path.join(projectRoot, 'artifacts');
  try {
    await fs.access(artifactsDir);
  } catch {
    return [];
  }

  const sanitized = sanitizeDeliverableLookupPath(lookupPath);
  if (!sanitized) return [];

  const hintDir = options.hintDir ? normalizeHintDir(options.hintDir) : '';
  if (isSlideDeckClashProneBasename(sanitized) && !hasExplicitSlideDeckPath(sanitized) && !hintDir) {
    return [];
  }

  const targetBase = path.posix.basename(sanitized.replace(/\\/g, '/'));
  const hasDir = sanitized.includes('/');
  const matches = [];
  let scanned = 0;

  const consider = async (full) => {
    const relative = path.relative(projectRoot, full).split(path.sep).join('/');
    if (hintDir && !pathUnderHintDir(relative, hintDir)) return;
    let mtime = 0;
    try {
      const st = await fs.stat(full);
      mtime = st.mtimeMs;
    } catch {
      mtime = 0;
    }
    matches.push({ relative, mtime });
  };

  const walk = async (dir, depth) => {
    if (depth > ARTIFACT_SEARCH_MAX_DEPTH || scanned >= ARTIFACT_SEARCH_MAX_ENTRIES) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (scanned >= ARTIFACT_SEARCH_MAX_ENTRIES) return;
      scanned += 1;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (ARTIFACT_SKIP_DIRS.has(entry.name)) continue;
        await walk(full, depth + 1);
      } else if (entry.isFile()) {
        const relative = path.relative(projectRoot, full).split(path.sep).join('/');
        if (hasDir) {
          if (deliverableRelativePathMatches(relative, sanitized)) {
            await consider(full);
          }
          continue;
        }
        if (deliverableBasenamesMatch(entry.name, targetBase)) {
          await consider(full);
        }
      }
      if (scanned % 32 === 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }
  };

  const startDir = hintDir
    ? path.join(projectRoot, ...hintDir.split('/'))
    : artifactsDir;

  try {
    await fs.access(startDir);
  } catch {
    return hintDir ? [] : [];
  }

  await walk(startDir, 0);
  return matches;
}

/**
 * Find a deliverable under `<projectRoot>/artifacts/` by basename or path suffix.
 * Handles `[6] 全案总结报告.md` → `06-全案总结报告.md`, `drafts/03a-….md` → geo campaign folder.
 * @returns {string|null} project-relative path using forward slashes
 */
export function findArtifactFileByBasename(projectRoot, lookupPath, options = {}) {
  const hintDir = options.hintDir ? normalizeHintDir(options.hintDir) : '';
  const hintEnabled = isDeliverableHintDirEnabled();
  const allowMtimeFallback = options.allowMtimeFallback ?? !hintEnabled;
  const sanitized = sanitizeDeliverableLookupPath(lookupPath);
  const hasDir = sanitized.includes('/');
  const bareFilename = !hasDir && isBareDeliverableFilename(sanitized);

  const matches = findArtifactFileMatches(projectRoot, lookupPath, { hintDir });
  if (matches.length === 0) {
    return null;
  }
  if (matches.length === 1) {
    return matches[0].relative;
  }

  const legacyPathMode = options.legacyPathMode ?? 'legacy';
  const rejectHintDirMtime = legacyPathMode === 'strict' && hintDir;

  if (hintDir) {
    if (rejectHintDirMtime && matches.length > 1) {
      return null;
    }
    const best = matches.reduce((a, b) => (a.mtime > b.mtime ? a : b));
    return best.relative;
  }

  if (bareFilename && hintEnabled && !allowMtimeFallback) {
    return null;
  }

  // PD-SAAS-FORK: suffix paths like assets/raw/img-*.jpg match every task dir — never mtime-guess.
  if (hasDir && hintEnabled && !hintDir && matches.length > 1) {
    if (isPartialScopedAssetPath(sanitized) || !sanitized.startsWith('artifacts/')) {
      return null;
    }
  }

  const best = matches.reduce((a, b) => (a.mtime > b.mtime ? a : b));
  return best.relative;
}

function tryResolveExistingUnderRoot(projectRoot, targetPath, knownProjectRoots, options = {}) {
  const repaired = expandTruncatedWindowsProfilePath(repairCorruptedWindowsPath(targetPath));
  let normalized = sanitizeDeliverableLookupPath(repaired);
  if (normalized && isNonUserDeliverablePath(normalized)) {
    return null;
  }
  const hintDir = options.hintDir ? normalizeHintDir(options.hintDir) : '';
  const hintEnabled = isDeliverableHintDirEnabled();

  if (hintDir && normalized.includes('/')) {
    const rel = normalizeRelativeDeliverablePath(normalized);
    if (!pathUnderHintDir(rel, hintDir)) {
      if (isPartialScopedAssetPath(rel)) {
        normalized = `${hintDir}/${rel}`.replace(/\/+/g, '/');
      } else {
        return null;
      }
    }
  }

  // PD-SAAS-FORK: bare index.html / slides.html must not bind to stale project-root files
  if (
    normalized &&
    isBareDeliverableFilename(normalized) &&
    isGenericClashProneBasename(normalized)
  ) {
    const matches = findArtifactFileMatches(projectRoot, normalized, { hintDir });
    if (hintEnabled && !hintDir && matches.length > 1) {
      return null;
    }
    const artifactMatch = findArtifactFileByBasename(projectRoot, normalized, { hintDir, ...options });
    if (artifactMatch) {
      const result = resolvePreviewPath(projectRoot, artifactMatch, knownProjectRoots);
      if (result.valid && existsSync(result.resolved)) {
        return result;
      }
    }
    if (hintDir) {
      return null;
    }
  }

  for (const candidate of deliverablePathCandidates(normalized)) {
    if (hintDir && !pathUnderHintDir(normalizeRelativeDeliverablePath(candidate), hintDir)) {
      if (!isPartialScopedAssetPath(candidate)) {
        continue;
      }
    }
    const result = resolvePreviewPath(projectRoot, candidate, knownProjectRoots);
    if (result.valid && existsSync(result.resolved)) {
      return result;
    }
  }

  // PD-SAAS-FORK: explicit slide-deck paths must not fall back to another deck's manifest/png
  if ((hasExplicitSlideDeckPath(normalized) || isSlideDeckClashProneBasename(normalized)) && !hintDir) {
    return null;
  }

  const matches = findArtifactFileMatches(projectRoot, normalized, { hintDir });
  if (hintEnabled && !hintDir && matches.length > 1 && isGenericClashProneBasename(normalized)) {
    return null;
  }

  const relative = findArtifactFileByBasename(projectRoot, normalized, { hintDir, ...options });
  if (relative) {
    const result = resolvePreviewPath(projectRoot, relative, knownProjectRoots);
    if (result.valid && existsSync(result.resolved)) {
      return result;
    }
  }

  // PD-SAAS-FORK: agent cited nested path (e.g. assets/dashboard.html) but wrote the file at workspace root.
  if (normalized.includes('/')) {
    const base = path.posix.basename(normalized.replace(/\\/g, '/'));
    if (!isGenericClashProneBasename(base)) {
      const rootResult = resolvePreviewPath(projectRoot, base, knownProjectRoots);
      if (rootResult.valid && existsSync(rootResult.resolved)) {
        return rootResult;
      }
    }
  }

  return null;
}

/**
 * Resolve a project file path and verify it exists on disk, trying common artifact
 * directory prefixes when agents cite shortened paths in chat.
 */
export function resolveExistingProjectFilePath(projectRoot, targetPath, knownProjectRoots = [], options = {}) {
  const resolvedOptions = withInferredTaskHintDir(targetPath, options);
  const direct = tryResolveExistingUnderRoot(projectRoot, targetPath, knownProjectRoots, resolvedOptions);
  if (direct) {
    return direct;
  }

  const rootsToSearch = [projectRoot, ...knownProjectRoots.filter((r) => path.resolve(r) !== path.resolve(projectRoot))];
  for (const root of rootsToSearch) {
    const found = tryResolveExistingUnderRoot(root, targetPath, knownProjectRoots, resolvedOptions);
    if (found) {
      return found;
    }
  }

  const fallback = resolvePreviewPath(projectRoot, targetPath, knownProjectRoots);
  if (fallback.valid && existsSync(fallback.resolved)) {
    return fallback;
  }
  return { valid: false, error: 'File not found' };
}

function withInferredTaskHintDir(targetPath, options = {}) {
  if (options.hintDir) return options;
  const normalized = sanitizeDeliverableLookupPath(targetPath);
  const match = normalized.match(/^(artifacts\/task-[^/]+)/i);
  if (!match) return options;
  return { ...options, hintDir: normalizeHintDir(match[1]) };
}

/**
 * Resolve a deliverable path to an on-disk file under `projectRoot`.
 * @returns {{ ok: true, relativePath: string, absolutePath: string } | { ok: false, error?: string, code?: string, candidates?: string[] }}
 */
export function resolveProjectDeliverableFile(projectRoot, targetPath, knownProjectRoots = [], options = {}) {
  const sanitized = sanitizeDeliverableLookupPath(targetPath);
  const hintDir = options.hintDir ? normalizeHintDir(options.hintDir) : '';
  const hintEnabled = isDeliverableHintDirEnabled();
  const hasDir = sanitized.includes('/');
  const bareFilename = !hasDir && isBareDeliverableFilename(sanitized);

  const exact = resolvePreviewPath(projectRoot, sanitized, knownProjectRoots);
  if (exact.valid && existsSync(exact.resolved)) {
    const owningRoot =
      findProjectRootContaining(exact.resolved, [projectRoot, ...knownProjectRoots]) ?? path.resolve(projectRoot);
    const exactRelativePath = path.relative(owningRoot, exact.resolved).split(path.sep).join('/');
    if (!hintDir || pathUnderHintDir(exactRelativePath, hintDir)) {
      return {
        ok: true,
        relativePath: exactRelativePath,
        absolutePath: exact.resolved,
        projectRoot: owningRoot,
      };
    }
  }

  if (hintEnabled && bareFilename && !hintDir) {
    const matches = findArtifactFileMatches(projectRoot, sanitized, {});
    if (matches.length > 1) {
      return {
        ok: false,
        code: 'ambiguous_deliverable',
        error: 'Multiple deliverables match this filename; provide hintDir',
        candidates: matches
          .sort((a, b) => b.mtime - a.mtime)
          .slice(0, 5)
          .map((m) => m.relative),
      };
    }
  }

  if (hintEnabled && hasDir && !hintDir && (isPartialScopedAssetPath(sanitized) || !sanitized.startsWith('artifacts/'))) {
    const matches = findArtifactFileMatches(projectRoot, sanitized, {});
    if (matches.length > 1) {
      return {
        ok: false,
        code: 'ambiguous_deliverable',
        error: 'Multiple deliverables match this path suffix; provide hintDir',
        candidates: matches
          .sort((a, b) => b.mtime - a.mtime)
          .slice(0, 5)
          .map((m) => m.relative),
      };
    }
  }

  const result = resolveExistingProjectFilePath(projectRoot, targetPath, knownProjectRoots, options);
  if (!result.valid) {
    return { ok: false, error: result.error || 'Invalid path' };
  }
  if (!existsSync(result.resolved)) {
    return { ok: false, error: 'File not found' };
  }
  const searchRoots = [projectRoot, ...knownProjectRoots];
  const owningRoot =
    findProjectRootContaining(result.resolved, searchRoots) ?? path.resolve(projectRoot);
  const relativePath = path.relative(owningRoot, result.resolved).split(path.sep).join('/');

  if (hintDir && !pathUnderHintDir(relativePath, hintDir)) {
    return { ok: false, error: 'Resolved path outside turn artifact directory' };
  }

  return {
    ok: true,
    relativePath,
    absolutePath: result.resolved,
    projectRoot: owningRoot,
  };
}

/**
 * PD-SAAS-FORK: async resolve — uses non-blocking artifact scan when PILOTDECK_DELIVERABLE_ASYNC_RESOLVE=1.
 */
export async function resolveProjectDeliverableFileAsync(projectRoot, targetPath, knownProjectRoots = [], options = {}) {
  if (process.env.PILOTDECK_DELIVERABLE_ASYNC_RESOLVE !== '1') {
    return resolveProjectDeliverableFile(projectRoot, targetPath, knownProjectRoots, options);
  }

  const sanitized = sanitizeDeliverableLookupPath(targetPath);
  const hintDir = options.hintDir ? normalizeHintDir(options.hintDir) : '';
  const hintEnabled = isDeliverableHintDirEnabled();
  const hasDir = sanitized.includes('/');
  const bareFilename = !hasDir && isBareDeliverableFilename(sanitized);

  const exact = resolvePreviewPath(projectRoot, sanitized, knownProjectRoots);
  if (exact.valid && existsSync(exact.resolved)) {
    const owningRoot =
      findProjectRootContaining(exact.resolved, [projectRoot, ...knownProjectRoots]) ?? path.resolve(projectRoot);
    const exactRelativePath = path.relative(owningRoot, exact.resolved).split(path.sep).join('/');
    if (!hintDir || pathUnderHintDir(exactRelativePath, hintDir)) {
      return {
        ok: true,
        relativePath: exactRelativePath,
        absolutePath: exact.resolved,
        projectRoot: owningRoot,
      };
    }
  }

  if (hintEnabled && bareFilename && !hintDir) {
    const matches = await findArtifactFileMatchesAsync(projectRoot, sanitized, {});
    if (matches.length > 1) {
      return {
        ok: false,
        code: 'ambiguous_deliverable',
        error: 'Multiple deliverables match this filename; provide hintDir',
        candidates: matches
          .sort((a, b) => b.mtime - a.mtime)
          .slice(0, 5)
          .map((m) => m.relative),
      };
    }
  }

  if (hintEnabled && hasDir && !hintDir && (isPartialScopedAssetPath(sanitized) || !sanitized.startsWith('artifacts/'))) {
    const matches = await findArtifactFileMatchesAsync(projectRoot, sanitized, {});
    if (matches.length > 1) {
      return {
        ok: false,
        code: 'ambiguous_deliverable',
        error: 'Multiple deliverables match this path suffix; provide hintDir',
        candidates: matches
          .sort((a, b) => b.mtime - a.mtime)
          .slice(0, 5)
          .map((m) => m.relative),
      };
    }
  }

  await new Promise((resolve) => setImmediate(resolve));
  const result = resolveExistingProjectFilePath(projectRoot, targetPath, knownProjectRoots, options);
  if (!result.valid) {
    return { ok: false, error: result.error || 'Invalid path' };
  }
  if (!existsSync(result.resolved)) {
    return { ok: false, error: 'File not found' };
  }
  const searchRoots = [projectRoot, ...knownProjectRoots];
  const owningRoot =
    findProjectRootContaining(result.resolved, searchRoots) ?? path.resolve(projectRoot);
  const relativePath = path.relative(owningRoot, result.resolved).split(path.sep).join('/');

  if (hintDir && !pathUnderHintDir(relativePath, hintDir)) {
    return { ok: false, error: 'Resolved path outside turn artifact directory' };
  }

  return {
    ok: true,
    relativePath,
    absolutePath: result.resolved,
    projectRoot: owningRoot,
  };
}

export function resolvePathInProject(projectRoot, targetPath = '') {
  const normalizedRoot = path.resolve(projectRoot);
  const raw = repairCorruptedWindowsPath(String(targetPath || '').trim());
  if (!raw) {
    return { valid: false, error: 'Empty path' };
  }

  let resolved = path.isAbsolute(raw)
    ? path.resolve(raw)
    : path.resolve(normalizedRoot, raw);

  if (!isPathWithinProjectRoot(resolved, normalizedRoot)) {
    const fallback = path.resolve(normalizedRoot, raw.replace(/^[\\/]+/, ''));
    if (isPathWithinProjectRoot(fallback, normalizedRoot)) {
      resolved = fallback;
    } else {
      return { valid: false, error: 'Path must be under project root' };
    }
  }

  return { valid: true, resolved };
}
