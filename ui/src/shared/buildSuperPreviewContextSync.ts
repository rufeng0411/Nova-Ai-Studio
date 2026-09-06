/**
 * PD-SAAS-FORK: synchronous Super Preview context from known siblings (no Bridge).
 */
import { getArtifactDirectory } from './artifactPaths';
import {
  artifactContractFromCanvasManifest,
  artifactContractFromManifest,
  artifactContractFromSlideImagePaths,
  artifactContractFromSlideSiblings,
  inferArtifactContract,
  resolveSuperPreviewAdapter,
} from './artifactContract';
import { collectSlideDeckImagePaths, resolveExportScope } from './resolveExportScope';
import { resolveArtifactScope } from './artifactScope';
import { isDesignCanvasEnabled } from './designCanvasGate';
import type { SuperPreviewContext } from '../components/super-preview/types';

function canvasManifestPathFromSiblings(siblings: string[]): string | undefined {
  return siblings.find((path) => /(?:^|\/)canvas-manifest\.json$/i.test(path));
}

function manifestPathFromSiblings(siblings: string[]): string | undefined {
  return siblings.find((path) => /(?:^|\/)slide-manifest\.json$/i.test(path));
}

export function buildSuperPreviewContextSync(input: {
  apiPath: string;
  fileName: string;
  siblings: string[];
  manifestJson?: unknown;
  canvasManifestJson?: unknown;
}): SuperPreviewContext {
  const { apiPath, fileName, siblings } = input;
  const scope = resolveExportScope({ filePath: apiPath || fileName, siblings });
  const artifactScope = resolveArtifactScope({ activePath: apiPath || fileName, siblings });
  const manifestPath = manifestPathFromSiblings(siblings);
  const canvasManifestPath = isDesignCanvasEnabled()
    ? canvasManifestPathFromSiblings(siblings)
    : undefined;

  let contract = inferArtifactContract({ filePath: apiPath || fileName, carrierScope: scope.scopeId });
  if (canvasManifestPath && input.canvasManifestJson) {
    contract = artifactContractFromCanvasManifest({
      manifestPath: canvasManifestPath,
      manifest: input.canvasManifestJson,
    }) ?? contract;
  } else if (manifestPath && input.manifestJson) {
    contract = artifactContractFromManifest({
      manifestPath,
      manifest: input.manifestJson,
    }) ?? contract;
  }

  if (contract.pages.length === 0) {
    const fromSiblings = artifactContractFromSlideSiblings(apiPath || fileName, siblings);
    if (fromSiblings) {
      contract = fromSiblings;
    } else if (scope.scopeId === 'slide_deck_png') {
      const deckDir = getArtifactDirectory(apiPath || fileName);
      const slidePaths = scope.bundleImagePaths?.length
        ? scope.bundleImagePaths
        : collectSlideDeckImagePaths(deckDir, siblings, apiPath || fileName);
      const fromBundle = artifactContractFromSlideImagePaths(deckDir, slidePaths, manifestPath);
      if (fromBundle) {
        contract = fromBundle;
      }
    }
  }

  return {
    contract,
    artifactScope,
    adapter: resolveSuperPreviewAdapter(contract),
    siblings,
    loading: false,
  };
}
