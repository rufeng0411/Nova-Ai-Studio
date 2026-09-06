// PD-SAAS-FORK: factory for document format adapters
import type { DocumentAdapter, DocumentFormat } from '../types';
import { DocxDocumentAdapter } from './docxDocumentAdapter';
import { PdfDocumentAdapter } from './pdfDocumentAdapter';
import { PptxDocumentAdapter } from './pptxDocumentAdapter';

export function createDocumentAdapter(format: DocumentFormat): DocumentAdapter {
  switch (format) {
    case 'pdf':
      return new PdfDocumentAdapter();
    case 'docx':
      return new DocxDocumentAdapter();
    case 'pptx':
      return new PptxDocumentAdapter();
    default: {
      const neverFormat: never = format;
      throw new Error(`Unsupported document format: ${neverFormat}`);
    }
  }
}
