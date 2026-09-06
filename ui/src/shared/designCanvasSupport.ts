// PD-SAAS-FORK: which SuperPreview files support design canvas view/edit toggle
import { classifyDeliverablePath, normalizeArtifactPath } from './artifactPaths';
import type { ArtifactContract } from './artifactContract';
import { isDesignCanvasEnabled } from './designCanvasGate';
import { canvasBoardDirFromPath, isCanvasManifestPath } from './designCanvasManifest';
import { isImageFile } from '../components/code-editor/utils/binaryFile';

const SLIDES_DIR_RE = /(?:^|\/)artifacts\/slides-[^/]+(?:\/|$)/i;
const EXCALIDRAW_RE = /\.excalidraw$/i;
const DIAGRAM_HTML_RE = /diagram.*\.html$/i;

export type DesignCanvasPreviewSurface = 'overlay' | 'sidebar';

export function supportsDesignCanvasEdit(fileName: string, apiPath?: string): boolean {
  if (!isDesignCanvasEnabled()) return false;
  const path = normalizeArtifactPath(apiPath || fileName);
  const name = fileName || path.split('/').pop() || '';
  if (SLIDES_DIR_RE.test(path)) return false;
  if (isCanvasManifestPath(path)) return true;
  if (canvasBoardDirFromPath(path)) return true;
  if (isImageFile(name)) return true;
  if (EXCALIDRAW_RE.test(name)) return true;
  if (DIAGRAM_HTML_RE.test(name)) return true;
  const kind = classifyDeliverablePath(path);
  if (kind === 'image') return true;
  return false;
}

export function supportsDesignCanvasEditContract(contract: ArtifactContract, fileName: string): boolean {
  if (!isDesignCanvasEnabled()) return false;
  if (contract.carrierScope === 'design_canvas_board') return true;
  if (contract.artifactSemanticKind === 'design_canvas') return true;
  if (contract.artifactSemanticKind === 'image_collection') return true;
  return supportsDesignCanvasEdit(fileName, contract.primaryPaths?.[0]);
}

/** Edit mode only allowed in sidebar — overlay uses dock protocol. */
export function canEnterDesignCanvasEditMode(surface: DesignCanvasPreviewSurface): boolean {
  return surface === 'sidebar';
}
