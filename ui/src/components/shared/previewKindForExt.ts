import type { DeliverableKind } from '../../shared/artifactPaths';
import { classifyDeliverablePath } from '../../shared/artifactPaths';
import { supportsBrowserNewTabForFile } from '../../shared/projectPreviewCapabilities';

export function previewKindForFileName(fileName: string): DeliverableKind {
  return classifyDeliverablePath(fileName);
}

export function supportsBrowserNewTabPreview(fileName: string, kind?: DeliverableKind): boolean {
  return supportsBrowserNewTabForFile(fileName, kind);
}

export function supportsInlineSpreadsheetPreview(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.xlsx') || lower.endsWith('.xls');
}
