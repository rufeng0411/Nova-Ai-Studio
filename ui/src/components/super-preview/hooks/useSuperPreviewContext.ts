import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../utils/api';
import { getArtifactDirectory, normalizeArtifactPath } from '../../../shared/artifactPaths';
import { resolveSuperPreviewAdapter } from '../../../shared/artifactContract';
import { resolveExportScope } from '../../../shared/resolveExportScope';
import { resolveArtifactScope } from '../../../shared/artifactScope';
import { loadProjectTextContent } from '../../../shared/loadProjectTextContent';
import { isDesignCanvasEnabled } from '../../../shared/designCanvasGate';
import { buildSuperPreviewContextSync } from '../../../shared/buildSuperPreviewContextSync';
import {
  loadSuperPreviewSiblingsCached,
  readSuperPreviewSiblingCache,
} from '../../../shared/superPreviewSiblingCache';
import type { SuperPreviewContext } from '../types';

type UseSuperPreviewContextInput = {
  projectName: string;
  apiPath: string;
  fileName: string;
  projectRoot?: string;
};

type FolderEntry = {
  type?: string;
  relativePath?: string;
};

function isFolderEntry(value: unknown): value is FolderEntry {
  return Boolean(value && typeof value === 'object');
}

function canvasManifestPathFromSiblings(siblings: string[]): string | undefined {
  return siblings.find((path) => /(?:^|\/)canvas-manifest\.json$/i.test(path));
}

function manifestPathFromSiblings(siblings: string[]): string | undefined {
  return siblings.find((path) => /(?:^|\/)slide-manifest\.json$/i.test(path));
}

async function listSiblings(projectName: string, apiPath: string): Promise<string[]> {
  const dir = getArtifactDirectory(apiPath);
  if (!dir) return [apiPath];
  return loadSuperPreviewSiblingsCached(projectName, apiPath, async () => {
    const response = await api.listProjectFolder(projectName, dir);
    if (!response.ok) return [apiPath];
    const data: unknown = await response.json();
    const entries: unknown[] = data && typeof data === 'object' && Array.isArray((data as { entries?: unknown }).entries)
      ? (data as { entries: unknown[] }).entries
      : [];
    const paths = entries
      .filter(isFolderEntry)
      .filter((entry) => entry.type === 'file' && typeof entry.relativePath === 'string')
      .map((entry) => normalizeArtifactPath(entry.relativePath ?? ''))
      .filter(Boolean);
    return paths.length > 0 ? paths : [apiPath];
  });
}

function initialContextState(input: {
  projectName: string;
  apiPath: string;
  fileName: string;
}): SuperPreviewContext {
  const cachedSiblings = readSuperPreviewSiblingCache(input.projectName, input.apiPath);
  if (cachedSiblings?.length) {
    return buildSuperPreviewContextSync({
      apiPath: input.apiPath,
      fileName: input.fileName,
      siblings: cachedSiblings,
    });
  }
  const contract = buildSuperPreviewContextSync({
    apiPath: input.apiPath,
    fileName: input.fileName,
    siblings: [input.apiPath],
  }).contract;
  return {
    contract,
    artifactScope: resolveArtifactScope({ activePath: input.apiPath || input.fileName }),
    adapter: resolveSuperPreviewAdapter(contract),
    siblings: [],
    loading: true,
  };
}

export function useSuperPreviewContext({
  projectName,
  apiPath,
  fileName,
  projectRoot,
}: UseSuperPreviewContextInput): SuperPreviewContext {
  const [context, setContext] = useState<SuperPreviewContext>(() => initialContextState({
    projectName,
    apiPath,
    fileName,
  }));

  useEffect(() => {
    let cancelled = false;
    setContext(initialContextState({ projectName, apiPath, fileName }));

    async function load() {
      try {
        const artifactDir = getArtifactDirectory(apiPath);
        const guessedManifestPath = artifactDir ? `${artifactDir}/slide-manifest.json` : null;
        const guessedCanvasPath = artifactDir && isDesignCanvasEnabled()
          ? `${artifactDir}/canvas-manifest.json`
          : null;

        const [siblings, earlyManifestRaw, earlyCanvasRaw] = await Promise.all([
          listSiblings(projectName, apiPath),
          guessedManifestPath
            ? loadProjectTextContent(projectName, guessedManifestPath, projectRoot, { skipResolve: true }).catch(() => null)
            : Promise.resolve(null),
          guessedCanvasPath
            ? loadProjectTextContent(projectName, guessedCanvasPath, projectRoot, { skipResolve: true }).catch(() => null)
            : Promise.resolve(null),
        ]);

        const canvasManifestPath = isDesignCanvasEnabled()
          ? canvasManifestPathFromSiblings(siblings) ?? guessedCanvasPath ?? undefined
          : undefined;
        const manifestPath = manifestPathFromSiblings(siblings) ?? guessedManifestPath ?? undefined;
        let manifestJson: unknown;
        let canvasManifestJson: unknown;

        if (earlyCanvasRaw) {
          try {
            canvasManifestJson = JSON.parse(earlyCanvasRaw) as unknown;
          } catch {
            // optional
          }
        }
        if (earlyManifestRaw && !canvasManifestJson && !manifestJson) {
          try {
            manifestJson = JSON.parse(earlyManifestRaw) as unknown;
          } catch {
            // optional
          }
        }

        if (canvasManifestPath && !canvasManifestJson) {
          try {
            const raw = await loadProjectTextContent(projectName, canvasManifestPath, projectRoot, { skipResolve: true });
            canvasManifestJson = JSON.parse(raw) as unknown;
          } catch {
            // optional
          }
        } else if (manifestPath && !manifestJson) {
          try {
            const raw = await loadProjectTextContent(projectName, manifestPath, projectRoot, { skipResolve: true });
            manifestJson = JSON.parse(raw) as unknown;
          } catch {
            // optional
          }
        }
        if (cancelled) return;
        setContext(buildSuperPreviewContextSync({
          apiPath,
          fileName,
          siblings,
          manifestJson,
          canvasManifestJson,
        }));
      } catch (error) {
        if (cancelled) return;
        const fallbackSiblings = await listSiblings(projectName, apiPath).catch(() => [apiPath]);
        const fallback = buildSuperPreviewContextSync({
          apiPath,
          fileName,
          siblings: fallbackSiblings,
        });
        setContext({
          ...fallback,
          error: fallback.contract.pages.length > 0
            ? undefined
            : (error instanceof Error ? error.message : 'super_preview_context_failed'),
        });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [apiPath, fileName, projectName, projectRoot]);

  return context;
}
