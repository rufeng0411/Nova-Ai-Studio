// PD-SAAS-FORK: map super-preview artifact scope → chat @-reference paths
import type { ArtifactScope } from './artifactScope';
import { isValidReferencePath, normalizeReferencePath } from './fileReferenceComposer';

/** Matches composer reference chip limit (useChatComposerState). */
export const MAX_ARTIFACT_REFERENCE_PATHS = 6;

function uniqueValidReferencePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const raw of paths) {
    const path = normalizeReferencePath(raw);
    if (!isValidReferencePath(path)) continue;
    const key = path.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(path);
  }
  return ordered;
}

export type ResolveArtifactReferencePathsOptions = {
  siblings?: string[];
  maxPaths?: number;
};

/**
 * Resolve workspace paths to attach in the chat composer.
 * Slide/image bundles prefer manifest + ordered pages (same scope as export).
 */
export function resolveArtifactReferencePaths(
  scope: ArtifactScope,
  options: ResolveArtifactReferencePathsOptions = {},
): string[] {
  const maxPaths = options.maxPaths ?? MAX_ARTIFACT_REFERENCE_PATHS;
  const candidates: string[] = [];

  if (scope.manifestPath) {
    candidates.push(scope.manifestPath);
  }
  if (scope.bundleImagePaths?.length) {
    candidates.push(...scope.bundleImagePaths);
  }

  if (candidates.length === 0) {
    candidates.push(scope.exportSourcePath || scope.activePath);
  }

  if (options.siblings?.length) {
    const root = scope.scopeRoot;
    const rootLower = root.toLowerCase();
    const prefix = root ? `${root}/`.toLowerCase() : '';
    for (const raw of options.siblings) {
      const path = normalizeReferencePath(raw);
      if (!isValidReferencePath(path)) continue;
      const lower = path.toLowerCase();
      if (root && lower !== rootLower && !lower.startsWith(prefix)) continue;
      candidates.push(path);
    }
  }

  return uniqueValidReferencePaths(candidates).slice(0, maxPaths);
}
