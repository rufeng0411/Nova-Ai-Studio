import { isDocumentCanvasFile } from '../components/document-canvas/utils/documentPreviewRouting';
import type { ArtifactSemanticKind } from './artifactContract';
import { getArtifactDirectory, normalizeArtifactPath } from './artifactPaths';
import { resolveExportScope, type ExportScopeId } from './resolveExportScope';

export type ArtifactScope = {
  activePath: string;
  scopeRoot: string;
  semanticKind: ArtifactSemanticKind;
  carrierScope: ExportScopeId;
  manifestPath?: string;
  bundleImagePaths?: string[];
  pageCount?: number;
  exportSourcePath: string;
  canBundleExport: boolean;
  canUseDocumentCanvas: boolean;
};

export type ResolveArtifactScopeInput = {
  activePath: string;
  siblings?: string[];
};

function semanticKindFromCarrier(carrierScope: ExportScopeId): ArtifactSemanticKind {
  switch (carrierScope) {
    case 'slide_deck_png':
    case 'slide_deck_html':
    case 'slide_native_pptx':
      return 'presentation';
    case 'scan_pdf_image':
      return 'pdf_document';
    case 'existing_docx':
      return 'word_document';
    case 'spreadsheet':
      return 'spreadsheet';
    case 'video_media':
      return 'media';
    case 'image_album':
      return 'image_collection';
    case 'design_canvas_board':
      return 'design_canvas';
    case 'report_html':
      return 'web_page';
    case 'report_markdown':
    case 'geo_bundle':
      return 'generic_document';
    case 'archive_code':
    case 'none':
      return 'unknown';
    default: {
      const exhaustive: never = carrierScope;
      return exhaustive;
    }
  }
}

function findCanvasManifestPath(siblings: string[] | undefined): string | undefined {
  return siblings?.find((path) => /(?:^|\/)canvas-manifest\.json$/i.test(path));
}

function findManifestPath(siblings: string[] | undefined): string | undefined {
  return siblings?.find((path) => /(?:^|\/)slide-manifest\.json$/i.test(path));
}

export function resolveArtifactScope({
  activePath,
  siblings,
}: ResolveArtifactScopeInput): ArtifactScope {
  const normalized = normalizeArtifactPath(activePath);
  const scope = resolveExportScope({ filePath: normalized, siblings });
  const scopeRoot = scope.bundleDir ?? getArtifactDirectory(normalized);
  const canUseDocumentCanvas = isDocumentCanvasFile(normalized);
  const bundleImagePaths = scope.bundleImagePaths;
  const canBundleExport = Boolean(
    (scope.scopeId === 'slide_deck_png' || scope.scopeId === 'image_album') &&
    (scope.bundle || (bundleImagePaths?.length ?? 0) > 1 || scope.scopeId === 'slide_deck_png'),
  );

  const canvasManifest = findCanvasManifestPath(siblings);
  const slideManifest = findManifestPath(siblings);

  return {
    activePath: normalized,
    scopeRoot,
    semanticKind: semanticKindFromCarrier(scope.scopeId),
    carrierScope: scope.scopeId,
    manifestPath: canvasManifest ?? slideManifest,
    bundleImagePaths,
    pageCount: scope.pageCount,
    exportSourcePath: normalized,
    canBundleExport,
    canUseDocumentCanvas,
  };
}
