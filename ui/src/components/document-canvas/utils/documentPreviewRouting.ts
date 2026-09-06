// PD-SAAS-FORK: route pdf/docx/pptx to DocumentCanvas
import {
  isDocxFile,
  isPdfFile,
  isPptxFile,
} from '../../code-editor/utils/binaryFile';
import type { DocumentFormat } from '../types';

export function getDocumentCanvasFormat(fileName: string): DocumentFormat | null {
  const lower = fileName.toLowerCase();
  if (isPdfFile(lower)) return 'pdf';
  if (isDocxFile(lower)) return 'docx';
  if (isPptxFile(lower)) return 'pptx';
  return null;
}

export function isDocumentCanvasFile(fileName: string): boolean {
  return getDocumentCanvasFormat(fileName) !== null;
}
