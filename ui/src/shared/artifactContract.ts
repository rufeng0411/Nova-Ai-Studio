import type { ExportScopeId } from './resolveExportScope';
import { detectSlideDeckFromDirectory } from './resolveExportScope';
import {
  parseCanvasManifest,
  type DesignCanvasNode,
} from './designCanvasManifest';

export type ArtifactSemanticKind =
  | 'presentation'
  | 'pdf_document'
  | 'word_document'
  | 'generic_document'
  | 'spreadsheet'
  | 'media'
  | 'web_page'
  | 'code'
  | 'image_collection'
  | 'design_canvas'
  | 'unknown';

export type SuperPreviewAdapter =
  | 'ppt'
  | 'pdf'
  | 'word'
  | 'web'
  | 'markdownText'
  | 'codeText'
  | 'image'
  | 'media'
  | 'spreadsheet'
  | 'collection'
  | 'designCanvas'
  | 'htmlStudio'
  | 'hyperframesStudio'
  | 'bentoDeck'
  | 'fallback';

export type ArtifactSourceIntent = {
  skillSlug?: string;
  processTemplateId?: string;
  declaredOutput?: string;
  confidence?: number;
  evidence?: string[];
};

export type ArtifactPage = {
  pageId: string;
  index: number;
  title?: string;
  points: string[];
  description?: string;
  previewPath?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'unknown';
  error?: string;
};

export type ArtifactContract = {
  schemaId: string;
  artifactId: string;
  title: string;
  artifactSemanticKind: ArtifactSemanticKind;
  carrierScope: ExportScopeId;
  primaryPaths: string[];
  sourcePaths: string[];
  sourceIntent?: ArtifactSourceIntent;
  pages: ArtifactPage[];
  exportHints: {
    aspectRatio?: string;
    pageCount?: number;
    bundleImagePaths?: string[];
    editableTarget?: string;
  };
  deliverableRole: 'final' | 'process' | 'draft';
};

type SlideManifestPage = {
  page_index?: unknown;
  title?: unknown;
  points?: unknown;
  page_description?: unknown;
  image_path?: unknown;
  imagePath?: unknown;
  status?: unknown;
  error?: unknown;
};

type SlideManifest = {
  deck_title?: unknown;
  title?: unknown;
  aspect_ratio?: unknown;
  page_count?: unknown;
  pages?: unknown;
};

export type ArtifactContractFromManifestInput = {
  manifestPath: string;
  manifest: unknown;
};

export type InferArtifactContractInput = {
  filePath: string;
  carrierScope: ExportScopeId;
  sourceIntent?: ArtifactSourceIntent;
};

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+/g, '/').trim();
}

function dirname(filePath: string): string {
  const normalized = normalizePath(filePath);
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(0, index) : '';
}

function basename(filePath: string): string {
  const normalized = normalizePath(filePath);
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(index + 1) : normalized;
}

function withoutExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function stringArrayValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function statusValue(value: unknown): ArtifactPage['status'] {
  if (value === 'pending' || value === 'completed' || value === 'failed') return value;
  if (value === 'running' || value === 'generating') return 'running';
  return 'unknown';
}

function normalizeManifestImagePath(imagePath: unknown, manifestDir: string): string | undefined {
  const raw = stringValue(imagePath);
  if (!raw) return undefined;
  const normalized = normalizePath(raw);
  if (normalized.startsWith('artifacts/')) return normalized;
  const base = basename(normalized);
  return manifestDir ? `${manifestDir}/${base}` : base;
}

function isSlideManifest(value: unknown): value is SlideManifest {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as SlideManifest).pages));
}

function semanticKindFromIntent(sourceIntent?: ArtifactSourceIntent): ArtifactSemanticKind | undefined {
  const parts = [
    sourceIntent?.declaredOutput,
    sourceIntent?.skillSlug,
    sourceIntent?.processTemplateId,
    ...(sourceIntent?.evidence ?? []),
  ]
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .toLowerCase();

  if (!parts) return undefined;
  if (/(ppt|pptx|presentation|slide|幻灯|演示)/i.test(parts)) return 'presentation';
  if (/(word|docx|doc|文档)/i.test(parts)) return 'word_document';
  if (/(pdf|扫描)/i.test(parts)) return 'pdf_document';
  return undefined;
}

const SLIDE_IMAGE_BASENAME_RE = /^slide-(\d+)\.(png|jpe?g|webp)$/i;

function slideIndexFromPath(filePath: string): number {
  const match = basename(filePath).match(SLIDE_IMAGE_BASENAME_RE);
  return match ? Number.parseInt(match[1], 10) : 0;
}

/** Build a deck contract from ordered slide-NN.png paths (manifest optional). */
export function artifactContractFromSlideImagePaths(
  deckDir: string,
  slidePaths: string[],
  manifestPath?: string,
): ArtifactContract | null {
  const normalizedDir = normalizePath(deckDir);
  if (!normalizedDir || slidePaths.length === 0) return null;

  const ordered = [...slidePaths]
    .map((path) => normalizePath(path))
    .filter((path) => SLIDE_IMAGE_BASENAME_RE.test(basename(path)))
    .sort((left, right) => slideIndexFromPath(left) - slideIndexFromPath(right));

  if (ordered.length === 0) return null;

  const pages: ArtifactPage[] = ordered.map((previewPath) => {
    const index = slideIndexFromPath(previewPath) || 1;
    return {
      pageId: `page-${index}`,
      index,
      title: `第 ${index} 页`,
      points: [],
      previewPath,
      status: 'completed',
    };
  });

  const sourcePaths = manifestPath ? [manifestPath] : ordered;

  return {
    schemaId: 'novapage/slide-deck-siblings@1',
    artifactId: normalizedDir,
    title: withoutExtension(basename(normalizedDir)),
    artifactSemanticKind: 'presentation',
    carrierScope: 'slide_deck_png',
    primaryPaths: ordered,
    sourcePaths,
    pages,
    exportHints: {
      pageCount: pages.length,
      bundleImagePaths: ordered,
      editableTarget: 'ocr_editable_pptx',
    },
    deliverableRole: 'final',
  };
}

/** Build a deck contract from sibling slide-NN.png files when manifest is missing or unreadable. */
export function artifactContractFromSlideSiblings(
  activePath: string,
  siblings: string[],
): ArtifactContract | null {
  const deckDir = dirname(activePath);
  if (!deckDir || !detectSlideDeckFromDirectory(deckDir, siblings)) {
    return null;
  }

  const slidePaths = siblings
    .map((path) => normalizePath(path))
    .filter((path) => {
      if (!SLIDE_IMAGE_BASENAME_RE.test(basename(path))) return false;
      return dirname(path) === deckDir;
    })
    .sort((left, right) => slideIndexFromPath(left) - slideIndexFromPath(right));

  return artifactContractFromSlideImagePaths(deckDir, slidePaths, manifestPathFromSiblings(siblings, deckDir));
}

function manifestPathFromSiblings(siblings: string[], deckDir: string): string | undefined {
  return siblings
    .map((path) => normalizePath(path))
    .find((path) => dirname(path) === deckDir && /(?:^|\/)slide-manifest\.json$/i.test(path));
}

function nodePreviewPath(node: DesignCanvasNode, manifestDir: string): string | undefined {
  if (!node.path) return undefined;
  const normalized = normalizePath(node.path);
  if (normalized.startsWith('artifacts/')) return normalized;
  return manifestDir ? `${manifestDir}/${normalized}` : normalized;
}

/** Build design canvas contract from canvas-manifest.json */
export function artifactContractFromCanvasManifest({
  manifestPath,
  manifest,
}: ArtifactContractFromManifestInput): ArtifactContract | null {
  const parsed = parseCanvasManifest(manifest);
  if (!parsed) return null;
  const manifestDir = dirname(manifestPath);
  const pages: ArtifactPage[] = parsed.nodes.map((node, arrayIndex): ArtifactPage => {
    const index = arrayIndex + 1;
    return {
      pageId: node.id || `node-${index}`,
      index,
      title: node.text || node.type,
      points: [],
      previewPath: nodePreviewPath(node, manifestDir),
      status: 'completed',
    };
  });
  const bundleImagePaths = pages
    .map((page) => page.previewPath)
    .filter((path): path is string => Boolean(path));
  return {
    schemaId: 'novapage/design-canvas@1',
    artifactId: manifestDir || parsed.board_id,
    title: parsed.title || parsed.board_id,
    artifactSemanticKind: 'design_canvas',
    carrierScope: 'design_canvas_board',
    primaryPaths: bundleImagePaths.length > 0 ? bundleImagePaths : [manifestPath],
    sourcePaths: [manifestPath],
    pages,
    exportHints: {
      pageCount: pages.length,
      bundleImagePaths,
      editableTarget: 'design_canvas',
    },
    deliverableRole: 'final',
  };
}

export function artifactContractFromManifest({
  manifestPath,
  manifest,
}: ArtifactContractFromManifestInput): ArtifactContract | null {
  if (!isSlideManifest(manifest)) return null;
  const manifestDir = dirname(manifestPath);
  const pages = [...(manifest.pages as SlideManifestPage[])]
    .sort((left, right) => (numberValue(left.page_index) ?? 0) - (numberValue(right.page_index) ?? 0))
    .map((page, arrayIndex): ArtifactPage => {
      const index = numberValue(page.page_index) ?? arrayIndex + 1;
      const previewPath = normalizeManifestImagePath(page.image_path ?? page.imagePath, manifestDir);
      return {
        pageId: `page-${index}`,
        index,
        title: stringValue(page.title) || undefined,
        points: stringArrayValue(page.points),
        description: stringValue(page.page_description) || undefined,
        previewPath,
        status: statusValue(page.status),
        error: stringValue(page.error) || undefined,
      };
    });
  const bundleImagePaths = pages
    .map((page) => page.previewPath)
    .filter((path): path is string => Boolean(path));
  const title = stringValue(manifest.deck_title) || stringValue(manifest.title) || withoutExtension(basename(manifestDir));
  const pageCount = numberValue(manifest.page_count) ?? pages.length;
  return {
    schemaId: 'novapage/slide-deck@1',
    artifactId: manifestDir || withoutExtension(basename(manifestPath)),
    title,
    artifactSemanticKind: 'presentation',
    carrierScope: 'slide_deck_png',
    primaryPaths: bundleImagePaths.length > 0 ? bundleImagePaths : [manifestPath],
    sourcePaths: [manifestPath],
    pages,
    exportHints: {
      aspectRatio: stringValue(manifest.aspect_ratio) || undefined,
      pageCount,
      bundleImagePaths,
      editableTarget: 'ocr_editable_pptx',
    },
    deliverableRole: 'final',
  };
}

export function inferArtifactContract({
  filePath,
  carrierScope,
  sourceIntent,
}: InferArtifactContractInput): ArtifactContract {
  const intentKind = semanticKindFromIntent(sourceIntent);
  const semanticKind = intentKind ?? semanticKindFromScope(carrierScope);
  const normalized = normalizePath(filePath);
  const title = withoutExtension(basename(normalized)) || normalized || 'Preview';
  return {
    schemaId: 'novapage/inferred-artifact@1',
    artifactId: normalized,
    title,
    artifactSemanticKind: semanticKind,
    carrierScope,
    primaryPaths: normalized ? [normalized] : [],
    sourcePaths: normalized ? [normalized] : [],
    sourceIntent,
    pages: [],
    exportHints: {},
    deliverableRole: 'final',
  };
}

function semanticKindFromScope(scope: ExportScopeId): ArtifactSemanticKind {
  switch (scope) {
    case 'slide_deck_png':
    case 'slide_deck_html':
    case 'slide_native_pptx':
    case 'bento_deck':
      return 'presentation';
    case 'scan_pdf_image':
      return 'pdf_document';
    case 'existing_docx':
      return 'word_document';
    case 'report_markdown':
    case 'report_html':
    case 'geo_bundle':
      return 'generic_document';
    case 'spreadsheet':
      return 'spreadsheet';
    case 'video_media':
    case 'hyperframes_project':
      return 'media';
    case 'image_album':
      return 'image_collection';
    case 'design_canvas_board':
      return 'design_canvas';
    case 'archive_code':
    case 'none':
      return 'unknown';
    default: {
      const exhaustive: never = scope;
      return exhaustive;
    }
  }
}

export function resolveSuperPreviewAdapter(contract: ArtifactContract): SuperPreviewAdapter {
  if (contract.carrierScope === 'bento_deck') {
    return 'bentoDeck';
  }
  switch (contract.artifactSemanticKind) {
    case 'presentation':
      return 'ppt';
    case 'pdf_document':
      return 'pdf';
    case 'word_document':
      return 'word';
    case 'spreadsheet':
      return 'spreadsheet';
    case 'media':
      return 'media';
    case 'web_page':
      return 'web';
    case 'code':
      return 'codeText';
    case 'image_collection':
      return 'collection';
    case 'design_canvas':
      return 'designCanvas';
    case 'generic_document': {
      const previewPath = contract.primaryPaths[0] ?? contract.sourcePaths[0] ?? '';
      if (/\.html?$/i.test(previewPath)) return 'web';
      return contract.carrierScope === 'report_html' ? 'web' : 'markdownText';
    }
    case 'unknown':
      return 'fallback';
    default: {
      const exhaustive: never = contract.artifactSemanticKind;
      return exhaustive;
    }
  }
}
