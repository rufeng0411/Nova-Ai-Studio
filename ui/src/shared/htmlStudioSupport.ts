// PD-SAAS-FORK: HTML Studio edit surface resolution + gate helpers
import { normalizeArtifactPath } from './artifactPaths';
import type { ArtifactContract } from './artifactContract';
import { canvasBoardDirFromPath, isCanvasManifestPath } from './designCanvasManifest';
import { isDesignCanvasEnabled } from './designCanvasGate';
import {
  supportsDesignCanvasEdit,
  supportsDesignCanvasEditContract,
  type DesignCanvasPreviewSurface,
} from './designCanvasSupport';
import { isHtmlPreviewFile } from '../components/super-preview/superPreviewRouting';
import { isHtmlStudioEnabled } from './htmlStudioGate';

const SLIDES_DIR_RE = /(?:^|\/)artifacts\/slides-[^/]+(?:\/|$)/i;
const CANVAS_BOARD_RE = /(?:^|\/)artifacts\/canvas-[^/]+(?:\/|$)/i;
const CANVAS_DIAGRAMS_RE = /(?:^|\/)artifacts\/canvas-[^/]+\/diagrams\//i;
const ARTIFACTS_HTML_RE = /(?:^|\/)artifacts\/.+\.html?$/i;

export type HtmlEditSurface = 'designCanvas' | 'htmlStudio' | 'none';

export type HtmlStudioPreviewSurface = DesignCanvasPreviewSurface;

export function isMobilePreviewSurface(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(max-width: 768px)').matches;
}

export function supportsHtmlStudioEdit(
  fileName: string,
  apiPath?: string,
  pagesCount = 0,
): boolean {
  if (!isHtmlStudioEnabled()) return false;
  if (isMobilePreviewSurface()) return false;
  if (!isHtmlPreviewFile(fileName)) return false;
  const path = normalizeArtifactPath(apiPath || fileName);
  // PD-SAAS-FORK: Bento decks use BentoDeckAdapter, not HTML Studio
  if (/\.bento\.html$/i.test(path)) return false;
  // PD-SAAS-FORK: hf-project is owned by HyperFrames Studio, not HTML Studio
  if (/(?:^|\/)artifacts\/task-[^/]+\/hf-project(?:\/|$)/i.test(path)) return false;
  if (!ARTIFACTS_HTML_RE.test(path)) return false;
  if (CANVAS_BOARD_RE.test(path) && !/(?:^|\/)artifacts\/canvas-[^/]+\/diagrams\//i.test(path)) {
    // canvas board non-diagram html still goes to design canvas when supported
    if (supportsDesignCanvasEdit(fileName, apiPath)) return false;
  }
  if (SLIDES_DIR_RE.test(path) && pagesCount > 0) return false;
  if (isCanvasManifestPath(path)) return false;
  return true;
}

export function supportsHtmlStudioEditContract(
  contract: ArtifactContract,
  fileName: string,
  apiPath?: string,
): boolean {
  if (!isHtmlStudioEnabled()) return false;
  if (contract.carrierScope === 'slide_deck_png' && contract.pages.length > 0) return false;
  return supportsHtmlStudioEdit(fileName, apiPath, contract.pages.length);
}

/** Which edit adapter owns this file — designCanvas and htmlStudio are mutually exclusive. */
export function resolveHtmlEditAdapter(
  contract: ArtifactContract,
  fileName: string,
  apiPath?: string,
): HtmlEditSurface {
  const path = normalizeArtifactPath(apiPath || fileName);

  if (isDesignCanvasEnabled() && supportsDesignCanvasEditContract(contract, fileName)) {
    if (CANVAS_DIAGRAMS_RE.test(path) || canvasBoardDirFromPath(path)) {
      return 'designCanvas';
    }
    if (supportsDesignCanvasEdit(fileName, apiPath) && CANVAS_BOARD_RE.test(path)) {
      return 'designCanvas';
    }
    if (supportsDesignCanvasEdit(fileName, apiPath) && !isHtmlPreviewFile(fileName)) {
      return 'designCanvas';
    }
  }

  if (supportsHtmlStudioEditContract(contract, fileName, apiPath)) {
    return 'htmlStudio';
  }

  return 'none';
}

export function canEnterHtmlStudioEditMode(surface: HtmlStudioPreviewSurface): boolean {
  return surface === 'sidebar' && !isMobilePreviewSurface();
}

export function isNgrsReportHtml(html: string): boolean {
  return /id=["']report-data["']/i.test(html) || /data-ngrs-title/i.test(html);
}

export function detectHtmlStudioProfile(
  contract: ArtifactContract,
  fileName: string,
  html: string,
): 'ngrs' | 'generic' | 'slide' {
  if (contract.carrierScope === 'slide_deck_html') return 'slide';
  if (isNgrsReportHtml(html)) return 'ngrs';
  return 'generic';
}
