// PD-SAAS-FORK: canonical design canvas board directory under artifacts/canvas-{id}/
import { normalizeArtifactPath } from './artifactPaths';
import {
  boardManifestPath,
  canvasBoardDirFromPath,
  isCanvasBoardDir,
  isSlidesArtifactPath,
  proposeCanvasBoardDir,
  toBoardRelativeAssetPath,
  CANVAS_MANIFEST_FILENAME,
} from './designCanvasManifest';

export type CanvasBoardEditContext = {
  boardDir: string;
  manifestPath: string;
  /** Path of active asset relative to board root (e.g. assets/hero.png). */
  activeAssetRelative: string;
  /** When true, UI should copy active file into board assets/ before seeding. */
  needsAssetCopy: boolean;
};

export function resolveCanvasBoardEditContext(options: {
  activePath: string;
  hintDir?: string;
  contractManifestPath?: string;
}): CanvasBoardEditContext | null {
  const activePath = normalizeArtifactPath(options.activePath);
  if (!activePath || isSlidesArtifactPath(activePath)) return null;

  const fromContract = options.contractManifestPath
    ? normalizeArtifactPath(options.contractManifestPath)
    : '';
  const boardFromContract = fromContract ? canvasBoardDirFromPath(fromContract) : '';
  const boardDir = (
    boardFromContract && isCanvasBoardDir(boardFromContract)
      ? boardFromContract
      : proposeCanvasBoardDir({ turnArtifactDir: options.hintDir, activePath })
  ).replace(/\/+$/, '');

  const manifestPath = boardManifestPath(boardDir);
  const activeInBoard = activePath.startsWith(`${boardDir}/`);
  const activeAssetRelative = activeInBoard
    ? activePath.slice(boardDir.length + 1)
    : toBoardRelativeAssetPath(boardDir, activePath);
  const needsAssetCopy = !activeInBoard && !activePath.endsWith(CANVAS_MANIFEST_FILENAME);

  return {
    boardDir,
    manifestPath,
    activeAssetRelative,
    needsAssetCopy,
  };
}
