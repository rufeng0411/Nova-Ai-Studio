// PD-SAAS-FORK: Composer ↔ design canvas bridge (prefill @ refs + canvas-context)
import { normalizeArtifactPath } from './artifactPaths';
import type { DesignCanvasManifest } from './designCanvasManifest';
import { isDesignCanvasEnabled } from './designCanvasGate';

const PREFILL_EVENT = 'pilotdeck:design-canvas-prefill';
const ASSET_ADDED_EVENT = 'pilotdeck:canvas-asset-added';

export type CanvasAssetAddedDetail = {
  boardPath: string;
  assetPath: string;
  boardDir?: string;
};

export type DesignCanvasPrefillDetail = {
  boardPath: string;
  nodePaths?: string[];
  prompt?: string;
  force?: boolean;
};

export function dispatchDesignCanvasPrefill(detail: DesignCanvasPrefillDetail): void {
  if (typeof window === 'undefined' || !isDesignCanvasEnabled()) return;
  window.dispatchEvent(new CustomEvent(PREFILL_EVENT, { detail }));
}

export function subscribeDesignCanvasPrefill(
  handler: (detail: DesignCanvasPrefillDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    const custom = event as CustomEvent<DesignCanvasPrefillDetail>;
    if (custom.detail?.boardPath) handler(custom.detail);
  };
  window.addEventListener(PREFILL_EVENT, listener);
  return () => window.removeEventListener(PREFILL_EVENT, listener);
}

export function buildCanvasContextSnippet(manifest: DesignCanvasManifest, boardDir: string): string {
  const nodes = manifest.nodes.slice(0, 12).map((node, index) => {
    const path = node.path ? normalizeArtifactPath(`${boardDir}/${node.path}`.replace(/\/+/g, '/')) : '';
    return `${index + 1}. [${node.type}] ${node.text ?? path ?? node.id}`;
  });
  return [
    '<canvas-context>',
    `board: ${normalizeArtifactPath(boardDir)}`,
    `title: ${manifest.title}`,
    `nodes: ${manifest.nodes.length}`,
    ...nodes,
    '</canvas-context>',
  ].join('\n');
}

export function buildCanvasEditPrompt(
  paths: string[],
  instruction: string,
  region?: string,
  maskPaintPath?: string,
): string {
  const refs = paths.map((path) => `@${normalizeArtifactPath(path)}`).join(' ');
  const regionAttr = region ? ` region="${region}"` : '';
  const maskAttr = maskPaintPath ? ` mask="${normalizeArtifactPath(maskPaintPath)}"` : '';
  return `${refs}\n<canvas-edit${regionAttr}${maskAttr}>${instruction}</canvas-edit>`;
}

export function dispatchCanvasAssetAdded(detail: CanvasAssetAddedDetail): void {
  if (typeof window === 'undefined' || !isDesignCanvasEnabled()) return;
  window.dispatchEvent(new CustomEvent(ASSET_ADDED_EVENT, { detail }));
}

export function subscribeCanvasAssetAdded(
  handler: (detail: CanvasAssetAddedDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    const custom = event as CustomEvent<CanvasAssetAddedDetail>;
    if (custom.detail?.boardPath && custom.detail?.assetPath) handler(custom.detail);
  };
  window.addEventListener(ASSET_ADDED_EVENT, listener);
  return () => window.removeEventListener(ASSET_ADDED_EVENT, listener);
}
