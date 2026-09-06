/**
 * PD-SAAS-FORK: server-authoritative deliverable validation (batch stat + resolve).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  resolveProjectDeliverableFile,
  resolveProjectDeliverableFileAsync,
} from '../utils/pathInProject.js';
import {
  deliverableBasenamesMatch,
  deliverableResolveMatchesRequest,
  isBareDeliverableFilename,
  isNonUserDeliverablePath,
  isPhantomDeliverablePath,
  sanitizeDeliverableLookupPath,
} from '../../shared/deliverablePathResolve.mjs';
import {
  getDeliverableSearchRootsForProject,
  extractProjectDirectory,
  warmProjectDirectoryForDeliverables,
} from '../projects.js';
import { isLikelyRenderableHtmlDeliverable } from './htmlDeliverableValidation.js';
import {
  isUndersizedBinaryDeliverable,
  isValidBinaryDeliverableHeader,
} from '../../shared/deliverableBinaryRules.mjs';
import {
  hasBrokenChartHtml,
  hasIndefiniteLoadingHtml,
} from '../../shared/htmlDeliverableRules.mjs';

const MAX_PATHS = 80;
const PENDING_RETRY_MS = 800;
/** PD-SAAS-FORK fd7c166c: hintDir scoped paths — shorter retry, less UI「校验中」stall. */
const PENDING_RETRY_HINT_MS = 200;
/** PD-SAAS-FORK: never block Bridge longer than client fetch timeout. */
const VALIDATE_BATCH_TIMEOUT_MS = 10_000;
const VALIDATE_PARALLEL_MAX = 6;

function parseValidateParallelLimit() {
  const raw = process.env.PILOTDECK_VALIDATE_PARALLEL ?? '3';
  const parsed = Number.parseInt(raw, 10);
  if (raw === '0' || !Number.isFinite(parsed) || parsed <= 1) return 1;
  return Math.min(VALIDATE_PARALLEL_MAX, parsed);
}

/**
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<R>} fn
 * @returns {Promise<R[]>}
 */
async function mapWithConcurrency(items, limit, fn) {
  if (items.length === 0) return [];
  const effectiveLimit = Math.max(1, Math.min(limit, items.length));
  if (effectiveLimit <= 1) {
    const sequential = [];
    for (let index = 0; index < items.length; index += 1) {
      sequential.push(await fn(items[index], index));
    }
    return sequential;
  }
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: effectiveLimit }, () => worker()));
  return results;
}

/**
 * @param {string} projectName
 * @param {string[]} paths
 * @param {{ getProjects?: () => Promise<unknown> }} [deps]
 * @param {{ hintDir?: string }} [options]
 */
export async function validateDeliverablesForProject(projectName, paths, deps = {}, options = {}) {
  const unique = [...new Set((paths ?? []).map((p) => String(p).trim()).filter(Boolean))].slice(0, MAX_PATHS);
  if (unique.length === 0) {
    return { items: [] };
  }

  let timedOut = false;
  const timeout = new Promise((resolve) => {
    setTimeout(() => {
      timedOut = true;
      resolve({
        items: unique.map((p) => ({ path: p, status: 'pending' })),
      });
    }, VALIDATE_BATCH_TIMEOUT_MS);
  });

  const work = validateDeliverablesForProjectInner(projectName, unique, options);
  const result = await Promise.race([work, timeout]);
  if (timedOut) {
    return result;
  }
  return result;
}

async function validateDeliverablesForProjectInner(projectName, unique, options = {}) {
  // PD-SAAS-FORK: never warm via full getProjects() — it blocks the event loop on wedged stacks.
  await warmProjectDirectoryForDeliverables(projectName);

  const projectRoot = await extractProjectDirectory(projectName).catch(() => null);
  if (!projectRoot) {
    return {
      items: unique.map((p) => ({ path: p, status: 'broken' })),
    };
  }

  let knownRoots = await getDeliverableSearchRootsForProject(projectName);
  if (knownRoots.length === 0) {
    await warmProjectDirectoryForDeliverables(projectName);
    knownRoots = await getDeliverableSearchRootsForProject(projectName);
  }

  const hintDir = options.hintDir ? String(options.hintDir).trim() : undefined;
  const parallelLimit = parseValidateParallelLimit();
  const items = await mapWithConcurrency(
    unique,
    parallelLimit,
    (filePath) => validateOneDeliverable(projectRoot, filePath, knownRoots, hintDir),
  );
  return { items };
}

/**
 * @param {string} projectRoot
 * @param {string} filePath
 * @param {string[]} knownRoots
 * @param {string | undefined} hintDir
 */
/**
 * PD-SAAS-FORK fd7c166c: when STDA hintDir is known, stat taskDir/basename first —
 * skip multi-root mtime search that dominates validate latency for OD/index.html.
 * @returns {{ ok: true, absolutePath: string, relativePath: string } | null}
 */
async function tryHintDirFastResolve(projectRoot, filePath, hintDir) {
  if (!hintDir || !projectRoot) return null;
  const normalizedHint = String(hintDir).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalizedHint) return null;
  const base = path.basename(String(filePath || '').replace(/\\/g, '/'));
  if (!base || base === '.' || base === '..') return null;
  const candidates = [
    path.join(projectRoot, normalizedHint, base),
  ];
  const asRel = String(filePath || '').replace(/\\/g, '/').replace(/^\.?\//, '');
  if (asRel.includes('/')) {
    candidates.push(path.join(projectRoot, asRel));
  }
  for (const abs of candidates) {
    try {
      const st = await fs.stat(abs);
      if (!st.isFile() || st.size <= 0) continue;
      const rel = path.relative(projectRoot, abs).replace(/\\/g, '/');
      if (isNonUserDeliverablePath(rel)) continue;
      return { ok: true, absolutePath: abs, relativePath: rel };
    } catch {
      // try next candidate
    }
  }
  return null;
}

async function validateOneDeliverable(projectRoot, filePath, knownRoots, hintDir) {
  if (shouldRejectUnhintedDeliverablePath(filePath, hintDir)) {
    return { path: filePath, status: 'broken' };
  }
  if (isPhantomDeliverablePath(filePath)) {
    return { path: filePath, status: 'phantom' };
  }
  if (isNonUserDeliverablePath(filePath)) {
    return { path: filePath, status: 'broken' };
  }

  const fast = await tryHintDirFastResolve(projectRoot, filePath, hintDir);
  const resolveOptions = hintDir ? { hintDir } : {};
  const resolved = fast ?? (
    process.env.PILOTDECK_DELIVERABLE_ASYNC_RESOLVE === '1'
      ? await resolveProjectDeliverableFileAsync(projectRoot, filePath, knownRoots, resolveOptions)
      : resolveProjectDeliverableFile(projectRoot, filePath, knownRoots, resolveOptions)
  );
  if (!resolved.ok) {
    return { path: filePath, status: 'broken' };
  }

  const stat = await statWithRetry(resolved.absolutePath, Boolean(hintDir));
  if (!stat) {
    return { path: filePath, status: 'broken', resolvedPath: resolved.relativePath };
  }
  if (stat.size === 0) {
    return {
      path: filePath,
      status: 'pending',
      resolvedPath: resolved.relativePath,
      sizeBytes: 0,
    };
  }

  if (!deliverableResolveMatchesRequest(filePath, resolved.relativePath)) {
    const reqBase = path.basename(filePath);
    const resBase = path.basename(resolved.relativePath);
    if (!deliverableBasenamesMatch(resBase, reqBase)) {
      return {
        path: filePath,
        status: 'broken',
        resolvedPath: resolved.relativePath,
        mismatch: true,
      };
    }
    // Basename resolve via hintDir/artifacts — OK for UI preview (engine gate stays strict).
  }

  if (isNonUserDeliverablePath(resolved.relativePath)) {
    return {
      path: filePath,
      status: 'broken',
      resolvedPath: resolved.relativePath,
      mismatch: true,
    };
  }

  const previewKind = inferPreviewKind(resolved.relativePath);
  if (previewKind === 'html') {
    const html = await fs.readFile(resolved.absolutePath, 'utf8').catch(() => '');
    if (
      !isLikelyRenderableHtmlDeliverable(html)
      || hasBrokenChartHtml(html)
      || hasIndefiniteLoadingHtml(html)
    ) {
      return {
        path: filePath,
        status: 'pending',
        resolvedPath: resolved.relativePath,
        previewKind,
        sizeBytes: stat.size,
        reason: 'invalid_html',
      };
    }
  }
  if (['document', 'pdf', 'image', 'video'].includes(previewKind)) {
    const header = await readBinaryHeader(resolved.absolutePath);
    if (!isValidBinaryDeliverableHeader(resolved.relativePath, header)) {
      return {
        path: filePath,
        status: 'broken',
        resolvedPath: resolved.relativePath,
        previewKind,
        sizeBytes: stat.size,
        reason: 'invalid_binary_header',
      };
    }
    if (isUndersizedBinaryDeliverable(resolved.relativePath, stat.size)) {
      return {
        path: filePath,
        status: 'broken',
        resolvedPath: resolved.relativePath,
        previewKind,
        sizeBytes: stat.size,
        reason: 'undersized_binary',
      };
    }
  }

  return {
    path: filePath,
    status: 'verified',
    resolvedPath: resolved.relativePath,
    previewKind,
    sizeBytes: stat.size,
  };
}

export function shouldRejectUnhintedDeliverablePath(filePath, hintDir) {
  const raw = String(filePath || '').trim();
  const sanitized = sanitizeDeliverableLookupPath(raw);
  if (/^\/[^/\\]+\.[a-z0-9]+$/i.test(raw)) return true;
  return isBareDeliverableFilename(sanitized) && !hintDir;
}

/**
 * @param {string} absPath
 */
async function readBinaryHeader(absPath) {
  const handle = await fs.open(absPath, 'r').catch(() => null);
  if (!handle) return '';
  try {
    const buffer = Buffer.alloc(12);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).toString('latin1');
  } finally {
    await handle.close().catch(() => null);
  }
}

/**
 * @param {string} absPath
 */
async function statWithRetry(absPath, preferFastRetry = false) {
  const retryMs = preferFastRetry ? PENDING_RETRY_HINT_MS : PENDING_RETRY_MS;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fs.stat(absPath);
    } catch (error) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, retryMs));
        continue;
      }
      return null;
    }
  }
  return null;
}

/**
 * @param {string} relPath
 */
function inferPreviewKind(relPath) {
  const ext = path.extname(relPath).toLowerCase();
  if (ext === '.md') return 'markdown';
  if (ext === '.pdf') return 'pdf';
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) return 'image';
  if (['.mp4', '.webm'].includes(ext)) return 'video';
  if (ext === '.html') return 'html';
  if (['.pptx', '.docx', '.xlsx', '.csv'].includes(ext)) return 'document';
  return 'file';
}
