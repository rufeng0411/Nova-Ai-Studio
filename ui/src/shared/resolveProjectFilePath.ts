import type { ResolvedProjectFile, ResolveProjectFileOptions } from './resolveProjectFilePath';
import { expandAmbiguousDeliverablePath, normalizeArtifactPath } from './artifactPaths';
import { sanitizeDeliverableLookupPath } from '../../shared/deliverablePathResolve.mjs';
import { api } from '../utils/api';

/** PD-SAAS-FORK: file/resolve must not hang the sidebar when Bridge is wedged. */
export const RESOLVE_PROJECT_FILE_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error('resolve_timeout')), ms);
    }),
  ]);
}

/**
 * Expand shortened deliverable paths client-side, then ask the server to locate the real file.
 */
export async function resolveProjectFilePath(
  projectName: string,
  filePath: string,
  projectRoot?: string,
  options?: ResolveProjectFileOptions,
): Promise<ResolvedProjectFile | null> {
  if (options?.skipResolve) {
    const cleaned = sanitizeDeliverableLookupPath(filePath);
    const expanded = expandAmbiguousDeliverablePath(normalizeArtifactPath(cleaned, projectRoot), {
      hintDir: options?.hintDir,
    });
    return { relativePath: expanded || cleaned };
  }

  const cleaned = sanitizeDeliverableLookupPath(filePath);
  const normalized = normalizeArtifactPath(cleaned, projectRoot);
  const expanded = expandAmbiguousDeliverablePath(normalized, { hintDir: options?.hintDir });
  const candidates = [normalized, expanded].filter(
    (value, index, list) => value && list.indexOf(value) === index,
  );

  for (const candidate of candidates) {
    try {
      const response = await withTimeout(
        api.resolveProjectFile(projectName, candidate, options?.hintDir),
        RESOLVE_PROJECT_FILE_TIMEOUT_MS,
      );
      const data = await response.json();
      if (response.status === 409 && data?.code === 'ambiguous_deliverable') {
        return {
          relativePath: candidate,
          ambiguous: true,
          candidates: Array.isArray(data.candidates) ? data.candidates : [],
        };
      }
      if (response.ok && data?.ok && typeof data.relativePath === 'string' && data.relativePath) {
        return {
          relativePath: data.relativePath,
          absolutePath: typeof data.absolutePath === 'string' ? data.absolutePath : undefined,
        };
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

export type { ResolvedProjectFile, ResolveProjectFileOptions };
