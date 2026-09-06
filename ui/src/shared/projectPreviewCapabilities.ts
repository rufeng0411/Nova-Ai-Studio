// PD-SAAS-FORK: unified preview capability matrix for overlay and sidebar.
// All surfaces (右栏 / 成果弹窗 DeliverablePreviewOverlay / 文件树) must render via
// ProjectFilePreview → DocumentCanvasPreview with the same previewUrl + fallbackPreviewUrl.
import {
  isAudioFile,
  isDocxFile,
  isImageFile,
  isPdfFile,
  isPptxFile,
  isVideoFile,
} from '../components/code-editor/utils/binaryFile';
import {
  isMarkdownEditorFile,
  isPreviewableEditorFile,
  isTextPreviewFile,
} from '../components/code-editor/utils/previewableFile';
import { isDocumentCanvasFile } from '../components/document-canvas/utils/documentPreviewRouting';
import { supportsInlineSpreadsheetPreview } from '../components/shared/previewKindForExt';
import { isCodePreviewFile } from '../components/super-preview/superPreviewRouting';
import type { DeliverableKind } from './artifactPaths';
import { classifyDeliverablePath } from './artifactPaths';

/**
 * Preview routing always trusts the filename extension first so a stale
 * deliverable `kind` (e.g. `file` on `slide-01.png`) cannot disable overlay preview.
 */
export function resolvePreviewKind(fileName: string, kind?: DeliverableKind): DeliverableKind {
  if (kind === 'url') return 'url';
  const fromName = classifyDeliverablePath(fileName);
  if (!kind || kind === 'file' || kind === 'code' || kind === 'archive') return fromName;
  if (kind === 'document' && (fromName === 'image' || fromName === 'video' || fromName === 'pdf')) {
    return fromName;
  }
  return kind;
}

/** Alias: overlay, sidebar, and binary editor must share the same allow-list. */
export function supportsUnifiedFilePreview(fileName: string, kind?: DeliverableKind): boolean {
  return supportsOverlayPreview(fileName, kind);
}

/** Whether the file uses the DocumentCanvas preview pipeline (pdf/docx/pptx). */
export function usesDocumentCanvas(fileName: string): boolean {
  return isDocumentCanvasFile(fileName);
}

/** Whether the deliverable overlay / inline preview can render this file. */
export function supportsOverlayPreview(fileName: string, kind?: DeliverableKind): boolean {
  const resolvedKind = resolvePreviewKind(fileName, kind);
  if (resolvedKind === 'url') return true;
  if (isMarkdownEditorFile(fileName)) return true;
  if (isTextPreviewFile(fileName)) return true;
  if (usesDocumentCanvas(fileName)) return true;
  if (isCodePreviewFile(fileName, resolvedKind)) return true;
  if (
    resolvedKind === 'html'
    || resolvedKind === 'image'
    || resolvedKind === 'video'
    || resolvedKind === 'pdf'
    || isImageFile(fileName)
    || isPdfFile(fileName)
    || isVideoFile(fileName)
    || isAudioFile(fileName)
  ) {
    return true;
  }
  if (resolvedKind === 'spreadsheet' || supportsInlineSpreadsheetPreview(fileName)) return true;
  return isPreviewableEditorFile(fileName);
}

/** Whether preview should use GET /preview/* (HTML iframe with relative assets). */
export function needsProjectPreviewUrl(fileName: string, kind?: DeliverableKind): boolean {
  const resolvedKind = resolvePreviewKind(fileName, kind);
  if (resolvedKind === 'url') return false;
  if (isMarkdownEditorFile(fileName)) return false;
  if (isTextPreviewFile(fileName)) return false;
  if (usesDocumentCanvas(fileName)) return false;
  if (resolvedKind === 'spreadsheet' || supportsInlineSpreadsheetPreview(fileName)) return false;
  return resolvedKind === 'html' || /\.(html?|htm)$/i.test(fileName);
}

/** Layout: full-bleed frame (html/pdf/spreadsheet/document/markdown) vs centered media. */
export function isFramePreviewLayout(fileName: string, kind?: DeliverableKind): boolean {
  if (isMarkdownEditorFile(fileName)) return true;
  if (isTextPreviewFile(fileName)) return true;
  if (usesDocumentCanvas(fileName)) return true;
  const resolvedKind = resolvePreviewKind(fileName, kind);
  if (isCodePreviewFile(fileName, resolvedKind)) return true;
  return resolvedKind === 'html' || resolvedKind === 'pdf' || resolvedKind === 'spreadsheet' || resolvedKind === 'image';
}

export function supportsBrowserNewTabForFile(fileName: string, kind?: DeliverableKind): boolean {
  const resolvedKind = resolvePreviewKind(fileName, kind);
  if (resolvedKind === 'url') return true;
  if (isDocxFile(fileName) || isPptxFile(fileName)) return false;
  if (isPdfFile(fileName)) return true;
  if (isAudioFile(fileName)) return false;
  return (
    resolvedKind === 'html'
    || resolvedKind === 'image'
    || resolvedKind === 'video'
    || resolvedKind === 'pdf'
    || isImageFile(fileName)
    || isPdfFile(fileName)
    || isVideoFile(fileName)
  );
}

/**
 * Must render via readFile + React (ProjectMarkdownPreview / SuperPreview).
 * Never open raw /files/content or iframe — browsers and OSS signed URLs cannot
 * display markdown/text/code inline (Edge: "无法显示这种文件类型").
 */
export function requiresInAppPreviewRenderer(fileName: string, kind?: DeliverableKind): boolean {
  return supportsOverlayPreview(fileName, kind) && !supportsBrowserNewTabForFile(fileName, kind);
}

/** Whether previewUrl is safe to embed in iframe or window.open (browser-native viewers). */
export function supportsBrowserInlinePreviewUrl(fileName: string, kind?: DeliverableKind): boolean {
  return supportsBrowserNewTabForFile(fileName, kind);
}
