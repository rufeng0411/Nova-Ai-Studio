// PD-SAAS-FORK: workspace-relative export output paths (must stay under artifacts/)
import path from 'node:path';

/** @param {string} value */
export function toPosixPath(value) {
  return String(value || '').replace(/\\/g, '/');
}

/**
 * Pick a writable export directory under the workspace file root.
 * @param {string} workspaceRelativePath - path relative to workspace hub (not tenant root)
 * @param {string | undefined} bundleDir
 */
export function resolveExportOutputDir(workspaceRelativePath, bundleDir) {
  if (bundleDir) {
    return toPosixPath(bundleDir).replace(/\/+$/, '');
  }
  const normalized = toPosixPath(workspaceRelativePath);
  const dir = toPosixPath(path.dirname(normalized));
  if (!dir || dir === '.') {
    return 'artifacts/documents';
  }
  if (dir === 'artifacts' || dir.startsWith('artifacts/')) {
    return dir;
  }
  return 'artifacts/documents';
}

/**
 * @param {string} workspaceRelativePath
 * @param {string | undefined} bundleDir
 * @param {string} baseName
 * @param {string} ext - includes leading dot
 */
export function buildExportOutputRelativePath(workspaceRelativePath, bundleDir, baseName, ext) {
  const outDir = resolveExportOutputDir(workspaceRelativePath, bundleDir);
  const safeBase = String(baseName || 'export').replace(/[^\w\u4e00-\u9fff-]+/g, '-').slice(0, 48) || 'export';
  return `${outDir}/${safeBase}-export${ext}`;
}

/** @param {string} relativePath */
export function isExportOutputAllowed(relativePath) {
  const normalized = toPosixPath(relativePath);
  return normalized.startsWith('artifacts/');
}
