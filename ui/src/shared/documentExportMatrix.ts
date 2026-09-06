// PD-SAAS-FORK: map export scope → UI capabilities (formats + engines)
import type { ExportScopeId, ExportScopeResult } from './resolveExportScope';
import { isSlideDeckBundlePath } from './resolveExportScope';

export type ExportFormat = 'pdf' | 'docx' | 'pptx' | 'xlsx';

export type ExportEngine = 'export_document' | 'compose_images' | 'ocr_editable_pptx' | 'hf_render';

export type ExportCapability = {
  format: ExportFormat;
  engine: ExportEngine;
  scopeId: ExportScopeId;
  bundle: boolean;
  pageCount?: number;
  recommended: boolean;
  enabled: boolean;
  reasonKey?: string;
  labelKey: string;
  hintKey: string;
  accent: 'rose' | 'blue' | 'amber' | 'emerald';
};

export type ExportAvailabilityHints = {
  ocrReady?: boolean;
  playwrightReady?: boolean;
};

/** PDF/DOCX/PPTX via export_document or compose_images — no MinerU gate in UI. */
export function isLocalExportEngine(engine: ExportEngine): boolean {
  return engine === 'export_document' || engine === 'compose_images' || engine === 'hf_render';
}

export function isCloudOcrExportEngine(engine: ExportEngine): boolean {
  return engine === 'ocr_editable_pptx';
}

/** Server may omit `enabled`; never block local engines on capabilities polling. */
export function normalizeServerExportCapabilities(
  capabilities: ExportCapability[],
): ExportCapability[] {
  return capabilities.map((cap) => {
    if (!isCloudOcrExportEngine(cap.engine)) {
      return { ...cap, enabled: true, reasonKey: undefined };
    }
    return cap;
  });
}

export function isExportCapClickable(
  cap: ExportCapability,
  options: { capsLoaded: boolean; busy: boolean; running: boolean },
): boolean {
  if (options.busy && !options.running) return false;
  if (isLocalExportEngine(cap.engine)) return true;
  if (!options.capsLoaded) return false;
  return cap.enabled !== false;
}

export function exportCapDisabledReason(
  cap: ExportCapability,
  options: { capsLoaded: boolean; enabled: boolean },
): string | undefined {
  if (isLocalExportEngine(cap.engine)) return undefined;
  if (!options.capsLoaded) return 'export.reason.checking';
  if (!options.enabled && cap.reasonKey) return cap.reasonKey;
  return undefined;
}

function cap(
  partial: Omit<ExportCapability, 'enabled'> & { enabled?: boolean },
): ExportCapability {
  return { enabled: true, ...partial };
}

/**
 * Build export actions for UI from resolved scope.
 * `availability` gates OCR / cloud providers without hiding recommended compose/export paths.
 */
export function buildExportCapabilities(
  scope: ExportScopeResult,
  filePath: string,
  availability: ExportAvailabilityHints = {},
): ExportCapability[] {
  const { scopeId } = scope;
  const ocrEnabled = availability.ocrReady !== false;

  switch (scopeId) {
    case 'report_markdown':
      return [
        cap({ format: 'pdf', engine: 'export_document', scopeId, bundle: false, recommended: true, labelKey: 'export.actions.pdf', hintKey: 'export.hint.reportToPdf', accent: 'rose' }),
        cap({ format: 'docx', engine: 'export_document', scopeId, bundle: false, recommended: true, labelKey: 'export.actions.docx', hintKey: 'export.hint.reportToDocx', accent: 'blue' }),
        cap({ format: 'pptx', engine: 'export_document', scopeId, bundle: false, recommended: true, labelKey: 'export.actions.pptx', hintKey: 'export.hint.reportToPptx', accent: 'amber' }),
        cap({ format: 'xlsx', engine: 'export_document', scopeId, bundle: false, recommended: false, labelKey: 'export.actions.xlsx', hintKey: 'export.hint.reportToXlsx', accent: 'emerald' }),
      ];

    case 'bento_deck':
      return [];

    case 'report_html':
    case 'slide_deck_html': {
      const pdfCap = cap({
        format: 'pdf',
        engine: 'export_document',
        scopeId,
        bundle: false,
        recommended: true,
        labelKey: 'export.actions.pdf',
        hintKey: scopeId === 'slide_deck_html' ? 'export.hint.slidesHtmlToPdf' : 'export.hint.htmlToPdf',
        accent: 'rose',
      });
      if (ocrEnabled) {
        return [
          pdfCap,
          {
            format: 'pptx',
            engine: 'ocr_editable_pptx',
            scopeId,
            bundle: false,
            recommended: true,
            enabled: true,
            labelKey: 'export.actions.deckPptxOcr',
            hintKey: scopeId === 'slide_deck_html'
              ? 'export.hint.slidesHtmlEditablePptx'
              : 'export.hint.htmlEditablePptx',
            accent: 'amber',
          },
          cap({
            format: 'pptx',
            engine: 'export_document',
            scopeId,
            bundle: false,
            recommended: false,
            labelKey: 'export.actions.deckPptxImages',
            hintKey: scopeId === 'slide_deck_html'
              ? 'export.hint.slidesHtmlToPptxImages'
              : 'export.hint.htmlToPptxImages',
            accent: 'amber',
          }),
        ];
      }
      return [
        pdfCap,
        cap({
          format: 'pptx',
          engine: 'export_document',
          scopeId,
          bundle: false,
          recommended: true,
          labelKey: scopeId === 'slide_deck_html' ? 'export.actions.deckPptx' : 'export.actions.pptx',
          hintKey: scopeId === 'slide_deck_html' ? 'export.hint.slidesHtmlToPptx' : 'export.hint.htmlToPptx',
          accent: 'amber',
        }),
      ];
    }

    case 'geo_bundle':
      return [
        cap({ format: 'pdf', engine: 'export_document', scopeId, bundle: false, recommended: true, labelKey: 'export.actions.pdf', hintKey: 'export.hint.geoToPdf', accent: 'rose' }),
        cap({ format: 'docx', engine: 'export_document', scopeId, bundle: false, recommended: false, labelKey: 'export.actions.docx', hintKey: 'export.hint.geoToDocx', accent: 'blue' }),
      ];

    case 'slide_deck_png': {
      const n = scope.pageCount ?? scope.bundleImagePaths?.length ?? 0;
      const inSlidesDir = isSlideDeckBundlePath(filePath);
      const bundle = scope.bundle || n > 1 || inSlidesDir;
      const pdfCap = cap({
        format: 'pdf',
        engine: 'compose_images',
        scopeId,
        bundle,
        pageCount: n || undefined,
        recommended: true,
        labelKey: bundle ? 'export.actions.deckPdf' : 'export.actions.pdf',
        hintKey: 'export.hint.slideDeckPdf',
        accent: 'rose',
      });
      if (ocrEnabled) {
        return [
          pdfCap,
          {
            format: 'pptx',
            engine: 'ocr_editable_pptx',
            scopeId,
            bundle,
            pageCount: n || undefined,
            recommended: true,
            enabled: true,
            labelKey: bundle ? 'export.actions.deckPptx' : 'export.actions.pptx',
            hintKey: 'export.hint.slideDeckEditablePptx',
            accent: 'amber',
          },
          cap({
            format: 'pptx',
            engine: 'compose_images',
            scopeId,
            bundle,
            pageCount: n || undefined,
            recommended: false,
            labelKey: 'export.actions.deckPptxImages',
            hintKey: 'export.hint.slideDeckPptx',
            accent: 'amber',
          }),
        ];
      }
      return [
        pdfCap,
        cap({
          format: 'pptx',
          engine: 'compose_images',
          scopeId,
          bundle,
          pageCount: n || undefined,
          recommended: true,
          labelKey: bundle ? 'export.actions.deckPptx' : 'export.actions.pptx',
          hintKey: 'export.hint.slideDeckPptx',
          accent: 'amber',
        }),
      ];
    }

    case 'image_album':
      return [
        cap({
          format: 'pdf',
          engine: 'compose_images',
          scopeId,
          bundle: true,
          pageCount: scope.pageCount,
          recommended: true,
          labelKey: 'export.actions.albumPdf',
          hintKey: 'export.hint.albumPdf',
          accent: 'rose',
        }),
        {
          format: 'pptx',
          engine: 'ocr_editable_pptx',
          scopeId,
          bundle: true,
          pageCount: scope.pageCount,
          recommended: true,
          enabled: ocrEnabled,
          reasonKey: ocrEnabled ? undefined : 'export.reason.needsOcrConfig',
          labelKey: 'export.actions.albumPptx',
          hintKey: 'export.hint.albumEditablePptx',
          accent: 'amber',
        },
      ];

    case 'slide_native_pptx':
      // PD-SAAS-FORK: already a native PPTX — preview/download only; OCR re-export needs slide PNGs.
      return [];

    case 'spreadsheet':
      return [
        cap({ format: 'xlsx', engine: 'export_document', scopeId, bundle: false, recommended: true, labelKey: 'export.actions.xlsx', hintKey: 'export.hint.spreadsheetXlsx', accent: 'emerald' }),
        cap({ format: 'pdf', engine: 'export_document', scopeId, bundle: false, recommended: true, labelKey: 'export.actions.pdf', hintKey: 'export.hint.spreadsheetPdf', accent: 'rose' }),
      ];

    case 'scan_pdf_image':
      return [
        {
          format: 'pptx',
          engine: 'ocr_editable_pptx',
          scopeId,
          bundle: false,
          recommended: true,
          enabled: ocrEnabled,
          reasonKey: ocrEnabled ? undefined : 'export.reason.needsOcrConfig',
          labelKey: 'export.actions.pptx',
          hintKey: 'export.hint.scanToEditablePptx',
          accent: 'amber',
        },
      ];

    case 'existing_docx':
    case 'video_media':
    case 'hyperframes_project':
      return [
        cap({
          format: 'pdf',
          engine: 'hf_render',
          scopeId: 'hyperframes_project',
          bundle: false,
          recommended: true,
          labelKey: 'hfStudio.export.draftRender',
          hintKey: 'hfStudio.export.draftRenderHint',
          accent: 'blue',
        }),
        cap({
          format: 'pptx',
          engine: 'hf_render',
          scopeId: 'hyperframes_project',
          bundle: false,
          recommended: false,
          labelKey: 'hfStudio.export.highRender',
          hintKey: 'hfStudio.export.highRenderHint',
          accent: 'amber',
        }),
      ];
    case 'archive_code':
    case 'design_canvas_board':
    case 'none':
      return [];

    default: {
      const _exhaustive: never = scopeId;
      void _exhaustive;
      return [];
    }
  }
}

/** Whether UI should show any export chrome for this file */
export function hasExportCapabilities(filePath: string, scope: ExportScopeResult): boolean {
  if (
    scope.scopeId === 'none'
    || scope.scopeId === 'video_media'
    || scope.scopeId === 'archive_code'
    || scope.scopeId === 'design_canvas_board'
  ) {
    return false;
  }
  if (scope.scopeId === 'hyperframes_project') {
    return true;
  }
  if (scope.scopeId === 'existing_docx') {
    return false;
  }
  return buildExportCapabilities(scope, filePath).some((c) => c.enabled);
}
