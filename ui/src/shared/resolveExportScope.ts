// PD-SAAS-FORK: workspace context → export scope for intelligent document export
import { classifyDeliverablePath, normalizeArtifactPath, type DeliverableKind } from './artifactPaths';

export type ExportScopeId =
  | 'report_markdown'
  | 'report_html'
  | 'geo_bundle'
  | 'slide_deck_png'
  | 'slide_deck_html'
  | 'slide_native_pptx'
  | 'spreadsheet'
  | 'scan_pdf_image'
  | 'image_album'
  | 'design_canvas_board'
  | 'existing_docx'
  | 'video_media'
  | 'hyperframes_project'
  | 'bento_deck'
  | 'archive_code'
  | 'none';

export type ExportScopeContext = {
  filePath: string;
  /** Workspace-relative paths in the same directory as filePath */
  siblings?: string[];
  kind?: DeliverableKind;
};

export type ExportScopeResult = {
  scopeId: ExportScopeId;
  bundle: boolean;
  /** Ordered workspace-relative image paths for compose / OCR bundle */
  bundleImagePaths?: string[];
  pageCount?: number;
  aspectRatio?: string;
  deckTitle?: string;
  /** Directory for bundle output (workspace-relative, trailing slash optional) */
  bundleDir?: string;
};

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i;
const SLIDE_IMAGE_RE = /^slide-(\d+)\.(png|jpe?g|webp)$/i;
const SLIDES_DIR_RE = /(?:^|\/)artifacts\/slides-[^/]+\/?$/i;
const CANVAS_BOARD_DIR_RE = /(?:^|\/)artifacts\/canvas-[^/]+\/?$/i;
const HF_PROJECT_DIR_RE = /(?:^|\/)artifacts\/task-[^/]+\/hf-project\/?$/i;
const CANVAS_MANIFEST_NAME = 'canvas-manifest.json';

function dirname(rel: string): string {
  const n = normalizeArtifactPath(rel);
  const i = n.lastIndexOf('/');
  return i >= 0 ? n.slice(0, i) : '';
}

function basename(rel: string): string {
  const n = normalizeArtifactPath(rel);
  const i = n.lastIndexOf('/');
  return i >= 0 ? n.slice(i + 1) : n;
}

/** Workspace-relative path is a raster slide/image suitable for compose/OCR export. */
export function isRasterImagePath(filePath: string): boolean {
  return IMAGE_EXT.test(filePath);
}

function siblingNames(siblings: string[] | undefined, dir: string): string[] {
  if (!siblings?.length) return [];
  const prefix = dir ? `${dir}/` : '';
  return siblings
    .map((s) => normalizeArtifactPath(s))
    .filter((s) => {
      if (dir) return s.startsWith(prefix) && s !== dir;
      return !s.includes('/');
    })
    .map((s) => (dir ? s.slice(prefix.length) : s));
}

function sortSlideImages(paths: string[]): string[] {
  return [...paths].sort((a, b) => {
    const ma = basename(a).match(SLIDE_IMAGE_RE);
    const mb = basename(b).match(SLIDE_IMAGE_RE);
    const na = ma ? Number.parseInt(ma[1], 10) : 0;
    const nb = mb ? Number.parseInt(mb[1], 10) : 0;
    return na - nb;
  });
}

export function collectSlideDeckImagePaths(
  dir: string,
  siblings: string[] | undefined,
  filePath: string,
): string[] {
  const names = siblingNames(siblings, dir);
  const slideFiles = names.filter((n) => SLIDE_IMAGE_RE.test(n));
  if (slideFiles.length === 0) {
    if (SLIDE_IMAGE_RE.test(basename(filePath))) {
      return [normalizeArtifactPath(filePath)];
    }
    return [];
  }
  const relPaths = slideFiles.map((n) => (dir ? `${dir}/${n}` : n));
  return sortSlideImages(relPaths);
}

function collectSlideDeckImages(dir: string, siblings: string[] | undefined, filePath: string): string[] {
  return collectSlideDeckImagePaths(dir, siblings, filePath);
}

export function isSlideDeckBundlePath(filePath: string): boolean {
  return /(?:^|\/)artifacts\/slides-[^/]+\//i.test(filePath);
}

export function resolveSlideDeckImagePaths(
  scope: ExportScopeResult,
  sourcePath: string,
  bundle: boolean,
): string[] | undefined {
  const rasterRe = /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i;
  const sourceIsRaster = rasterRe.test(sourcePath);
  if (!scope.bundleImagePaths?.length) {
    return sourceIsRaster ? [sourcePath] : undefined;
  }
  if (!sourceIsRaster || bundle || isSlideDeckBundlePath(sourcePath)) {
    return scope.bundleImagePaths;
  }
  return [sourcePath];
}

function isCanvasBoardDirectory(dir: string, siblings: string[] | undefined, filePath: string): boolean {
  if (/(?:^|\/)canvas-manifest\.json$/i.test(filePath)) return true;
  if (dir && CANVAS_BOARD_DIR_RE.test(`${dir}/`)) return true;
  const names = siblingNames(siblings, dir);
  if (names.includes(CANVAS_MANIFEST_NAME)) return true;
  return false;
}

/** True for artifacts/slides-* or any dir with slide-manifest + slide-NN.png (incl. artifacts/task-*). */
export function detectSlideDeckFromDirectory(dir: string, siblings?: string[]): boolean {
  if (SLIDES_DIR_RE.test(`${dir}/`)) return true;
  const names = siblingNames(siblings, dir);
  const hasManifest = names.some((n) => n === 'slide-manifest.json' || n === 'outline.json');
  const slideCount = names.filter((n) => SLIDE_IMAGE_RE.test(n)).length;
  return hasManifest && slideCount >= 1;
}

function isSlideDeckDirectory(dir: string, siblings: string[] | undefined): boolean {
  return detectSlideDeckFromDirectory(dir, siblings);
}

function countImagesInDir(siblings: string[] | undefined, dir: string): string[] {
  const names = siblingNames(siblings, dir).filter((n) => IMAGE_EXT.test(n));
  return names.map((n) => (dir ? `${dir}/${n}` : n));
}

/**
 * Infer export scope from file path and optional sibling listing.
 */
export function resolveExportScope(ctx: ExportScopeContext): ExportScopeResult {
  const filePath = normalizeArtifactPath(ctx.filePath);
  if (!filePath) {
    return { scopeId: 'none', bundle: false };
  }

  const kind = ctx.kind ?? classifyDeliverablePath(filePath);
  const dir = dirname(filePath);
  const ext = filePath.includes('.') ? filePath.slice(filePath.lastIndexOf('.')).toLowerCase() : '';

  if (kind === 'video') {
    const names = siblingNames(ctx.siblings, dir);
    const hasHfProject = names.some((n) => n === 'hf-project' || /^hf-project\//i.test(n))
      || /(?:^|\/)hf-project\//i.test(filePath)
      || (dir && names.includes('index.html') && /\/hf-project$/i.test(dir));
    if (
      hasHfProject
      || (ext === '.mp4' && /promo\.mp4$/i.test(basename(filePath)) && dir.includes('/task-'))
    ) {
      return { scopeId: 'hyperframes_project', bundle: false, bundleDir: dir || undefined };
    }
    return { scopeId: 'video_media', bundle: false };
  }

  if (HF_PROJECT_DIR_RE.test(`${dir}/`) || /(?:^|\/)hf-project\//i.test(filePath)) {
    return { scopeId: 'hyperframes_project', bundle: false, bundleDir: dirname(filePath) || dir || undefined };
  }

  if (ext === '.docx' || ext === '.doc') {
    return { scopeId: 'existing_docx', bundle: false };
  }

  if (isCanvasBoardDirectory(dir, ctx.siblings, filePath)) {
    const names = siblingNames(ctx.siblings, dir);
    const assetPaths = names
      .filter((n) => /\.(png|jpe?g|webp|gif|excalidraw|html|svg|mmd)$/i.test(n))
      .map((n) => (dir ? `${dir}/${n}` : n));
    return {
      scopeId: 'design_canvas_board',
      bundle: true,
      bundleImagePaths: assetPaths.length > 0 ? assetPaths : undefined,
      bundleDir: dir || undefined,
    };
  }

  if (kind === 'archive' || /\.(zip|tar|gz|7z|rar)$/i.test(ext)) {
    return { scopeId: 'archive_code', bundle: false };
  }
  if (kind === 'code' && !/\.(md|html?)$/i.test(ext)) {
    return { scopeId: 'archive_code', bundle: false };
  }

  if (filePath.includes('artifacts/geo/')) {
    if (kind === 'document' || kind === 'html' || kind === 'spreadsheet') {
      return { scopeId: 'geo_bundle', bundle: false };
    }
  }

  if (isSlideDeckDirectory(dir, ctx.siblings) || (kind === 'image' && SLIDES_DIR_RE.test(`${dir}/`))) {
    const images = collectSlideDeckImages(dir, ctx.siblings, filePath);
    return {
      scopeId: 'slide_deck_png',
      bundle: images.length > 1,
      bundleImagePaths: images.length > 0 ? images : undefined,
      pageCount: images.length || undefined,
      aspectRatio: '16:9',
      bundleDir: dir || undefined,
    };
  }

  if (kind === 'presentation' && (ext === '.pptx' || ext === '.ppt')) {
    return { scopeId: 'slide_native_pptx', bundle: false };
  }

  if (kind === 'spreadsheet' || /\.(csv|tsv|xlsx?)$/i.test(ext)) {
    return { scopeId: 'spreadsheet', bundle: false };
  }

  if (kind === 'document' && /\.(md|markdown|txt)$/i.test(ext)) {
    return { scopeId: 'report_markdown', bundle: false };
  }

  if (kind === 'html' || ext === '.html' || ext === '.htm') {
    // PD-SAAS-FORK: *.bento.html before generic deck.html → slide_deck_html misroute
    if (/\.bento\.html$/i.test(filePath)) {
      return { scopeId: 'bento_deck', bundle: false, aspectRatio: '16:9' };
    }
    const isDeckHtml = /slide|deck|presentation/i.test(basename(filePath)) || dir.includes('slides');
    return { scopeId: isDeckHtml ? 'slide_deck_html' : 'report_html', bundle: false };
  }

  if (kind === 'pdf') {
    return { scopeId: 'scan_pdf_image', bundle: false };
  }

  if (kind === 'image' && IMAGE_EXT.test(ext)) {
    const imagesInDir = countImagesInDir(ctx.siblings, dir);
    if (imagesInDir.length >= 2 && !isSlideDeckDirectory(dir, ctx.siblings)) {
      return {
        scopeId: 'image_album',
        bundle: true,
        bundleImagePaths: sortSlideImages(imagesInDir),
        pageCount: imagesInDir.length,
        bundleDir: dir || undefined,
      };
    }
    // PD-SAAS-FORK: single generate_image outputs — download only, no PDF/PPT export chrome.
    return { scopeId: 'none', bundle: false };
  }

  return { scopeId: 'none', bundle: false };
}
