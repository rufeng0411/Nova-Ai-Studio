// PD-SAAS-FORK: design canvas board manifest schema + helpers
import { normalizeArtifactPath } from './artifactPaths';

export const CANVAS_MANIFEST_FILENAME = 'canvas-manifest.json';

export const SLIDES_DIR_RE = /(?:^|\/)artifacts\/slides-[^/]+(?:\/|$)/i;
export const CANVAS_BOARD_DIR_RE = /(?:^|\/)artifacts\/canvas-[^/]+(?:\/|$)/i;

export function isSlidesArtifactPath(filePath: string): boolean {
  return SLIDES_DIR_RE.test(normalizeArtifactPath(filePath));
}

export function isCanvasBoardDir(dir: string): boolean {
  const normalized = normalizeArtifactPath(dir).replace(/\/+$/, '');
  return CANVAS_BOARD_DIR_RE.test(`${normalized}/`);
}

/** Propose canonical board directory under artifacts/canvas-{id}/ */
export function proposeCanvasBoardDir(options: { turnArtifactDir?: string; activePath?: string }): string {
  const active = normalizeArtifactPath(options.activePath || '');
  const fromActive = canvasBoardDirFromPath(active);
  if (fromActive && isCanvasBoardDir(fromActive)) return fromActive.replace(/\/+$/, '');

  const turn = normalizeArtifactPath(options.turnArtifactDir || '');
  const boardFromTurn = turn.match(/^(artifacts\/canvas-[^/]+)/i);
  if (boardFromTurn) return boardFromTurn[1];

  return `artifacts/canvas-${Date.now()}`;
}

/** Store paths relative to board root (e.g. assets/foo.png). */
export function toBoardRelativeAssetPath(boardDir: string, absoluteOrRelative: string): string {
  const abs = normalizeArtifactPath(absoluteOrRelative);
  const board = normalizeArtifactPath(boardDir).replace(/\/+$/, '');
  if (board && (abs === board || abs.startsWith(`${board}/`))) {
    return abs.slice(board.length + 1);
  }
  const fileName = abs.split('/').pop() || 'asset';
  return `assets/${fileName}`;
}

export function boardManifestPath(boardDir: string): string {
  const board = normalizeArtifactPath(boardDir).replace(/\/+$/, '');
  return board ? `${board}/${CANVAS_MANIFEST_FILENAME}` : CANVAS_MANIFEST_FILENAME;
}

export type DesignCanvasNodeType =
  | 'image'
  | 'diagram_excalidraw'
  | 'diagram_svg'
  | 'diagram_mermaid'
  | 'note'
  | 'group';

export type DesignCanvasBoardMode = 'image' | 'diagram' | 'mixed';

export type DesignCanvasNode = {
  id: string;
  type: DesignCanvasNodeType;
  path?: string;
  text?: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  meta?: Record<string, unknown>;
  parent_id?: string | null;
};

export type DesignCanvasManifest = {
  schema_version: number;
  board_id: string;
  title: string;
  board_mode?: DesignCanvasBoardMode;
  viewport?: { x: number; y: number; zoom: number };
  nodes: DesignCanvasNode[];
  tldraw_snapshot?: Record<string, unknown>;
  updated_at?: string;
};

export function isCanvasManifestPath(filePath: string): boolean {
  return /(?:^|\/)canvas-manifest\.json$/i.test(normalizeArtifactPath(filePath));
}

export function canvasBoardDirFromPath(filePath: string): string {
  const normalized = normalizeArtifactPath(filePath);
  if (isCanvasManifestPath(normalized)) {
    const index = normalized.lastIndexOf('/');
    return index >= 0 ? normalized.slice(0, index) : '';
  }
  const boardMatch = normalized.match(/^(artifacts\/canvas-[^/]+)/i);
  if (boardMatch) return boardMatch[1];
  return '';
}

export function createEmptyCanvasManifest(boardId: string, title: string): DesignCanvasManifest {
  return {
    schema_version: 1,
    board_id: boardId,
    title,
    board_mode: 'image',
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    tldraw_snapshot: {},
    updated_at: new Date().toISOString(),
  };
}

export function parseCanvasManifest(raw: unknown): DesignCanvasManifest | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const boardId = typeof record.board_id === 'string' ? record.board_id.trim() : '';
  if (!boardId) return null;
  const nodesRaw = Array.isArray(record.nodes) ? record.nodes : [];
  const nodes: DesignCanvasNode[] = nodesRaw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const node = item as Record<string, unknown>;
      const id = typeof node.id === 'string' ? node.id : `n${index + 1}`;
      const type = typeof node.type === 'string' ? node.type : 'image';
      if (!['image', 'diagram_excalidraw', 'diagram_svg', 'diagram_mermaid', 'note', 'group'].includes(type)) {
        return null;
      }
      return {
        id,
        type: type as DesignCanvasNodeType,
        path: typeof node.path === 'string' ? node.path : undefined,
        text: typeof node.text === 'string' ? node.text : undefined,
        x: typeof node.x === 'number' ? node.x : 0,
        y: typeof node.y === 'number' ? node.y : 0,
        w: typeof node.w === 'number' ? node.w : undefined,
        h: typeof node.h === 'number' ? node.h : undefined,
        meta: node.meta && typeof node.meta === 'object' ? (node.meta as Record<string, unknown>) : undefined,
        parent_id: typeof node.parent_id === 'string' ? node.parent_id : null,
      };
    })
    .filter((node): node is DesignCanvasNode => node !== null);

  const viewportRaw = record.viewport;
  const viewport =
    viewportRaw && typeof viewportRaw === 'object'
      ? {
          x: typeof (viewportRaw as Record<string, unknown>).x === 'number' ? (viewportRaw as Record<string, unknown>).x as number : 0,
          y: typeof (viewportRaw as Record<string, unknown>).y === 'number' ? (viewportRaw as Record<string, unknown>).y as number : 0,
          zoom: typeof (viewportRaw as Record<string, unknown>).zoom === 'number' ? (viewportRaw as Record<string, unknown>).zoom as number : 1,
        }
      : { x: 0, y: 0, zoom: 1 };

  return {
    schema_version: typeof record.schema_version === 'number' ? record.schema_version : 1,
    board_id: boardId,
    title: typeof record.title === 'string' ? record.title : boardId,
    board_mode:
      record.board_mode === 'diagram' || record.board_mode === 'mixed' || record.board_mode === 'image'
        ? record.board_mode
        : 'image',
    viewport,
    nodes,
    tldraw_snapshot:
      record.tldraw_snapshot && typeof record.tldraw_snapshot === 'object'
        ? (record.tldraw_snapshot as Record<string, unknown>)
        : {},
    updated_at: typeof record.updated_at === 'string' ? record.updated_at : undefined,
  };
}

export function serializeCanvasManifest(manifest: DesignCanvasManifest): string {
  return JSON.stringify(
    {
      ...manifest,
      updated_at: new Date().toISOString(),
    },
    null,
    2,
  );
}

export function ensureImageNodeForAsset(
  manifest: DesignCanvasManifest,
  assetPath: string,
  size: { w: number; h: number },
): DesignCanvasManifest {
  return seedActiveAssetOnCanvas(manifest, assetPath, '', { defaultSize: size }).manifest;
}

/** Resolve node.path to absolute artifact path for comparison. */
export function resolveCanvasNodePath(boardDir: string, nodePath: string | undefined): string {
  if (!nodePath) return '';
  const normalized = normalizeArtifactPath(nodePath);
  if (normalized.startsWith('artifacts/')) return normalized;
  return boardDir ? normalizeArtifactPath(`${boardDir}/${normalized}`) : normalized;
}

export type SeedActiveAssetOptions = {
  defaultSize?: { w: number; h: number };
  title?: string;
  /** When true, re-focus viewport on the active node even if it already exists. */
  focusViewport?: boolean;
};

/** Ensure the file the user opened for edit appears on the canvas (Figma/tldraw: selection → canvas). */
export function seedActiveAssetOnCanvas(
  manifest: DesignCanvasManifest,
  activePath: string,
  boardDir: string,
  options?: SeedActiveAssetOptions,
): { manifest: DesignCanvasManifest; seededNodeId: string | null; didSeed: boolean } {
  const normalizedActive = normalizeArtifactPath(activePath);
  if (!normalizedActive) {
    return { manifest, seededNodeId: null, didSeed: false };
  }

  if (isSlidesArtifactPath(normalizedActive)) {
    return { manifest, seededNodeId: null, didSeed: false };
  }

  const existing = manifest.nodes.find(
    (node) => resolveCanvasNodePath(boardDir, node.path) === normalizedActive,
  );
  if (existing) {
    const nextViewport = options?.focusViewport
      ? viewportCenteredOnNode(existing, { w: 720, h: 480 })
      : manifest.viewport;
    return {
      manifest: { ...manifest, viewport: nextViewport ?? manifest.viewport },
      seededNodeId: existing.id,
      didSeed: false,
    };
  }

  const size = options?.defaultSize ?? { w: 640, h: 480 };
  const fileName = normalizedActive.split('/').pop() || 'image';
  const relativePath = toBoardRelativeAssetPath(boardDir, normalizedActive);
  const node: DesignCanvasNode = {
    id: `n-${Date.now()}`,
    type: 'image',
    path: relativePath,
    text: options?.title ?? fileName,
    x: 160,
    y: 120,
    w: size.w,
    h: size.h,
    meta: { source: 'active_asset', seeded_at: new Date().toISOString(), absolutePath: normalizedActive },
    parent_id: null,
  };
  const nextManifest: DesignCanvasManifest = {
    ...manifest,
    board_mode: manifest.board_mode ?? 'image',
    title: manifest.title || options?.title || fileName,
    nodes: [...manifest.nodes, node],
    viewport: viewportCenteredOnNode(node, size),
  };
  return { manifest: nextManifest, seededNodeId: node.id, didSeed: true };
}

/** Rough centering for sidebar canvas — node placed near origin with pan offset. */
export function viewportCenteredOnNode(
  node: DesignCanvasNode,
  canvasSize?: { w: number; h: number },
): { x: number; y: number; zoom: number } {
  const panelW = canvasSize?.w ?? 720;
  const panelH = canvasSize?.h ?? 480;
  const nodeW = node.w ?? 320;
  const nodeH = node.h ?? 240;
  const zoom = Math.min(1.5, Math.max(0.35, Math.min(panelW / (nodeW + 120), panelH / (nodeH + 120))));
  const cx = node.x + nodeW / 2;
  const cy = node.y + nodeH / 2;
  return {
    x: panelW / 2 - cx * zoom,
    y: panelH / 2 - cy * zoom,
    zoom,
  };
}
