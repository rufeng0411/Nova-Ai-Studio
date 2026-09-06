import { classifyDeliverablePath, getArtifactFileName } from '../../../../shared/artifactPaths';
import { isNonUserDeliverablePath } from '../../../../shared/nonDeliverablePaths';
import { extension } from '../../superPreviewRouting';

/** Extensions that are never shown in the deliverable collection matrix. */
const HIDDEN_COLLECTION_EXTENSIONS = new Set([
  'json',
  'jsonld',
  'js',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'jsx',
  'py',
  'css',
  'scss',
  'less',
  'vue',
  'svelte',
  'sql',
  'sh',
  'bat',
  'ps1',
  'yaml',
  'yml',
  'xml',
  'toml',
  'ini',
  'env',
  'map',
  'lock',
]);

function isInternalManifestOrConfig(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  if (/manifest\.json$/i.test(lower)) return true;
  if (/^_.*\.json$/i.test(lower)) return true;
  if (lower === 'outline.json' || lower === 'package.json' || lower === 'tsconfig.json') return true;
  return HIDDEN_COLLECTION_EXTENSIONS.has(extension(fileName));
}

/** Whether a sibling path belongs in the user-facing collection preview matrix. */
export function shouldIncludeInCollectionPreview(path: string): boolean {
  const normalized = String(path || '').trim();
  if (!normalized) return false;
  if (isNonUserDeliverablePath(normalized)) return false;

  const fileName = getArtifactFileName(normalized);
  if (isInternalManifestOrConfig(fileName)) return false;

  const kind = classifyDeliverablePath(normalized);
  if (kind === 'code') return false;

  return true;
}

export function filterCollectionPreviewPaths(paths: string[]): string[] {
  return paths.filter(shouldIncludeInCollectionPreview);
}
