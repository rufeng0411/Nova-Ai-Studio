// PD-SAAS-FORK: path sandbox for public share assets (md dir subtree only)
import path from 'node:path';

/**
 * @param {string} mdAbsolutePath
 * @param {string} candidateAbsolutePath
 */
export function isPathInsideMarkdownSubtree(mdAbsolutePath, candidateAbsolutePath) {
  const mdDir = path.resolve(path.dirname(mdAbsolutePath));
  const candidate = path.resolve(candidateAbsolutePath);
  const rel = path.relative(mdDir, candidate);
  if (!rel || rel === '') return true;
  if (rel.startsWith('..') || path.isAbsolute(rel)) return false;
  return true;
}

/**
 * Resolve a relative asset under the markdown file directory.
 * Rejects absolute paths and `..` escapes.
 * @param {string} mdAbsolutePath
 * @param {string} assetRelativePath
 * @returns {{ ok: true, absolutePath: string } | { ok: false, error: string }}
 */
export function resolveShareAssetPath(mdAbsolutePath, assetRelativePath) {
  const raw = String(assetRelativePath || '').replace(/\\/g, '/').trim();
  if (!raw || raw.startsWith('/') || /^[a-zA-Z]:/.test(raw)) {
    return { ok: false, error: 'Absolute paths are not allowed' };
  }
  if (raw.split('/').some((seg) => seg === '..')) {
    return { ok: false, error: 'Path traversal is not allowed' };
  }
  const mdDir = path.dirname(mdAbsolutePath);
  const absolutePath = path.resolve(mdDir, raw);
  if (!isPathInsideMarkdownSubtree(mdAbsolutePath, absolutePath)) {
    return { ok: false, error: 'Asset outside markdown subtree' };
  }
  return { ok: true, absolutePath };
}
