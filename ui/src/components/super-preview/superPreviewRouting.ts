import type { DeliverableKind } from '../../shared/artifactPaths';
import { isBentoDeckFile } from '../../shared/bentoStudioSupport';
import {
  isAudioFile,
  isDocxFile,
  isImageFile,
  isPdfFile,
  isPptxFile,
  isVideoFile,
} from '../code-editor/utils/binaryFile';
import {
  isMarkdownEditorFile,
  isTextPreviewFile,
} from '../code-editor/utils/previewableFile';
import { supportsInlineSpreadsheetPreview } from '../shared/previewKindForExt';

const CODE_EXTENSIONS = new Set([
  'json',
  'jsonl',
  'ndjson',
  'jsonld',
  'xml',
  'yaml',
  'yml',
  'ts',
  'tsx',
  'js',
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
  'mjs',
  'cjs',
]);

export function extension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

export function isHtmlPreviewFile(fileName: string): boolean {
  const ext = extension(fileName);
  return ext === 'html' || ext === 'htm';
}

export function isCodePreviewFile(fileName: string, kind?: DeliverableKind): boolean {
  return kind === 'code' || CODE_EXTENSIONS.has(extension(fileName));
}

export function shouldUseSuperPreview(fileName: string, kind?: DeliverableKind): boolean {
  return (
    isBentoDeckFile(fileName)
    || isMarkdownEditorFile(fileName)
    || isTextPreviewFile(fileName)
    || isCodePreviewFile(fileName, kind)
    || isHtmlPreviewFile(fileName)
    || isImageFile(fileName)
    || isVideoFile(fileName)
    || isAudioFile(fileName)
    || isPdfFile(fileName)
    || isDocxFile(fileName)
    || isPptxFile(fileName)
    || supportsInlineSpreadsheetPreview(fileName)
  );
}
