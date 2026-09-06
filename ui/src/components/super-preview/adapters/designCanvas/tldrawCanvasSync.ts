// PD-SAAS-FORK: manifest nodes ↔ tldraw store snapshot
import type { Editor, TLShapeId } from '@tldraw/tldraw';
import { AssetRecordType, createShapeId } from '@tldraw/tldraw';
import type { DesignCanvasManifest, DesignCanvasNode } from '../../../../shared/designCanvasManifest';
import { resolveCanvasNodePath } from '../../../../shared/designCanvasManifest';

export type ImageAssetResolver = (
  absolutePath: string,
  fallbacks?: string[],
) => Promise<{ src: string; w: number; h: number } | null>;

const NODE_SHAPE_PREFIX = 'canvas-node:';

type MaskRegion = { x: number; y: number; w: number; h: number };

export function parseMaskRegionFromMeta(value: unknown): MaskRegion | undefined {
  if (value && typeof value === 'object') {
    const region = value as Record<string, unknown>;
    if (
      typeof region.x === 'number' &&
      typeof region.y === 'number' &&
      typeof region.w === 'number' &&
      typeof region.h === 'number'
    ) {
      return { x: region.x, y: region.y, w: region.w, h: region.h };
    }
  }
  if (typeof value === 'string') {
    const parts = value.split(',').map((part) => Number(part.trim()));
    if (parts.length === 4 && parts.every((part) => Number.isFinite(part))) {
      return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
    }
  }
  return undefined;
}

function serializeMaskRegion(value: unknown): string | undefined {
  const region = parseMaskRegionFromMeta(value);
  if (!region) return undefined;
  return `${region.x},${region.y},${region.w},${region.h}`;
}

/** tldraw shape.meta values must be JSON primitives (no nested objects). */
export function toTldrawShapeMeta(node: DesignCanvasNode): Record<string, string | number | boolean> {
  const meta: Record<string, string | number | boolean> = {
    canvasNodeId: node.id,
    canvasPath: node.path ?? '',
  };
  const maskRegion = serializeMaskRegion(node.meta?.maskRegion);
  if (maskRegion) meta.maskRegion = maskRegion;
  const maskPaint = typeof node.meta?.maskPaint === 'string' ? node.meta.maskPaint.trim() : '';
  if (maskPaint) meta.maskPaint = maskPaint;
  return meta;
}

function isJsonSerializableMetaValue(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function sanitizeRecordMeta(entry: Record<string, unknown>): Record<string, unknown> {
  const metaRaw = entry.meta;
  if (!metaRaw || typeof metaRaw !== 'object') return entry;
  const nextMeta: Record<string, string | number | boolean> = {};
  let changed = false;
  for (const [key, value] of Object.entries(metaRaw as Record<string, unknown>)) {
    if (isJsonSerializableMetaValue(value)) {
      nextMeta[key] = value;
      continue;
    }
    if (key === 'maskRegion') {
      const serialized = serializeMaskRegion(value);
      if (serialized) nextMeta.maskRegion = serialized;
    }
    changed = true;
  }
  if (!changed) return entry;
  return { ...entry, meta: nextMeta };
}

/** tldraw rejects blob: URLs in asset.props.src — allow http(s) and data:image only. */
export function isValidTldrawAssetSrc(src: unknown): boolean {
  if (typeof src !== 'string' || !src.trim()) return false;
  if (src.startsWith('blob:')) return false;
  try {
    const url = new URL(src, 'http://127.0.0.1');
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'data:';
  } catch {
    return false;
  }
}

function recordHasBlobSrc(value: unknown): boolean {
  if (typeof value === 'string') return value.startsWith('blob:');
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(recordHasBlobSrc);
  return Object.values(value as Record<string, unknown>).some(recordHasBlobSrc);
}

export function snapshotContainsBlob(snapshot: unknown): boolean {
  if (!snapshot) return false;
  try {
    return JSON.stringify(snapshot).includes('blob:');
  } catch {
    return false;
  }
}

function shouldStripSnapshotRecord(entry: Record<string, unknown>): boolean {
  const typeName = entry.typeName;
  const type = entry.type;
  if (typeName === 'asset' && type === 'image') return true;
  if (typeName === 'shape' && type === 'image') return true;
  return recordHasBlobSrc(entry);
}

/** Remove image assets/shapes and any blob: URLs before loadSnapshot or persist. */
export function sanitizeTldrawSnapshot(snapshot: unknown): Record<string, unknown> | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const root = snapshot as Record<string, unknown>;
  const storeRaw = root.store;
  if (!storeRaw || typeof storeRaw !== 'object') {
    return snapshotContainsBlob(root) ? null : root;
  }

  const store = { ...(storeRaw as Record<string, unknown>) };
  let changed = false;
  for (const [id, record] of Object.entries(store)) {
    if (!record || typeof record !== 'object') continue;
    let entry = record as Record<string, unknown>;
    if (shouldStripSnapshotRecord(entry)) {
      delete store[id];
      changed = true;
      continue;
    }
    const sanitizedEntry = sanitizeRecordMeta(entry);
    if (sanitizedEntry !== entry) {
      store[id] = sanitizedEntry;
      changed = true;
    }
  }

  if (!changed && !snapshotContainsBlob(root)) return root;
  const result = { ...root, store };
  if (snapshotContainsBlob(result)) {
    return { ...root, store: {} };
  }
  return result;
}

export function nodeIdToShapeId(nodeId: string): TLShapeId {
  return createShapeId(`${NODE_SHAPE_PREFIX}${nodeId}`);
}

export function shapeIdToNodeId(shapeId: TLShapeId): string | null {
  const raw = String(shapeId);
  const prefix = `shape:${NODE_SHAPE_PREFIX}`;
  if (!raw.startsWith(prefix)) return null;
  return raw.slice(prefix.length);
}

function snapshotHasStoreRecords(snapshot: Record<string, unknown> | null): boolean {
  if (!snapshot) return false;
  const store = snapshot.store;
  if (!store || typeof store !== 'object') return false;
  return Object.keys(store as Record<string, unknown>).length > 0;
}

function nodeFallbackPaths(node: DesignCanvasNode, boardDir: string): string[] {
  const paths: string[] = [];
  const metaPath = node.meta?.absolutePath;
  if (typeof metaPath === 'string' && metaPath.trim()) paths.push(metaPath.trim());
  const resolved = resolveCanvasNodePath(boardDir, node.path);
  if (resolved) paths.push(resolved);
  return paths;
}

export async function syncManifestNodesToEditor(
  editor: Editor,
  manifest: DesignCanvasManifest,
  boardDir: string,
  resolveImageAsset: ImageAssetResolver,
): Promise<number> {
  const sanitizedSnapshot = sanitizeTldrawSnapshot(manifest.tldraw_snapshot);
  if (snapshotHasStoreRecords(sanitizedSnapshot)) {
    try {
      editor.loadSnapshot(sanitizedSnapshot as Parameters<Editor['loadSnapshot']>[0]);
    } catch {
      // manifest nodes remain authoritative for images
    }
  }

  const existingShapeIds = editor.getCurrentPageShapeIds();
  const hadCanvasNodes = [...existingShapeIds].some((shapeId) => String(shapeId).includes(NODE_SHAPE_PREFIX));
  for (const shapeId of existingShapeIds) {
    if (String(shapeId).includes(NODE_SHAPE_PREFIX)) {
      editor.deleteShape(shapeId);
    }
  }

  let placed = 0;
  const pageId = editor.getCurrentPageId();

  for (const node of manifest.nodes) {
    if (node.type !== 'image') continue;
    const fallbacks = nodeFallbackPaths(node, boardDir);
    const primaryPath = fallbacks[0] ?? resolveCanvasNodePath(boardDir, node.path);
    if (!primaryPath && fallbacks.length === 0) continue;

    let asset: { src: string; w: number; h: number } | null = null;
    try {
      asset = await resolveImageAsset(primaryPath, fallbacks.slice(1));
    } catch {
      asset = null;
    }
    if (!asset || !isValidTldrawAssetSrc(asset.src)) continue;

    const assetId = AssetRecordType.createId(`${node.id}-asset`);
    try {
      editor.createAssets([
        {
          id: assetId,
          type: 'image',
          typeName: 'asset',
          props: {
            name: node.path?.split('/').pop() || node.id,
            src: asset.src,
            w: asset.w,
            h: asset.h,
            mimeType: 'image/png',
            isAnimated: false,
          },
          meta: { canvasNodeId: node.id, canvasPath: node.path ?? '' },
        },
      ]);

      editor.createShape({
        id: nodeIdToShapeId(node.id),
        type: 'image',
        parentId: pageId,
        x: node.x,
        y: node.y,
        props: {
          assetId,
          w: node.w ?? asset.w,
          h: node.h ?? asset.h,
        },
        meta: toTldrawShapeMeta(node),
      });
      placed += 1;
    } catch {
      // skip nodes that tldraw rejects
    }
  }

  if (manifest.viewport && !hadCanvasNodes) {
    editor.setCamera({
      x: manifest.viewport.x,
      y: manifest.viewport.y,
      z: manifest.viewport.zoom,
    });
  } else if (placed > 0 && !hadCanvasNodes) {
    try {
      editor.zoomToFit({ animation: { duration: 0 } });
    } catch {
      // viewport fallback handled by manifest
    }
  }

  return placed;
}

export function extractManifestFromEditor(
  editor: Editor,
  base: DesignCanvasManifest,
  boardDir: string,
): DesignCanvasManifest {
  const nodes: DesignCanvasNode[] = [];
  for (const shapeId of editor.getCurrentPageShapeIds()) {
    const nodeId = shapeIdToNodeId(shapeId);
    if (!nodeId) continue;
    const shape = editor.getShape(shapeId);
    if (!shape || shape.type !== 'image') continue;
    const prev = base.nodes.find((item) => item.id === nodeId);
    const maskRegion =
      parseMaskRegionFromMeta(shape.meta?.maskRegion) ?? parseMaskRegionFromMeta(prev?.meta?.maskRegion);
    const maskPaint =
      (typeof shape.meta?.maskPaint === 'string' && shape.meta.maskPaint.trim()) ||
      (typeof prev?.meta?.maskPaint === 'string' && prev.meta.maskPaint.trim()) ||
      undefined;
    const meta = {
      ...(prev?.meta ?? {}),
      ...(maskRegion ? { maskRegion } : {}),
      ...(maskPaint ? { maskPaint } : {}),
    };
    nodes.push({
      id: nodeId,
      type: 'image',
      path: prev?.path ?? (typeof shape.meta?.canvasPath === 'string' ? shape.meta.canvasPath : undefined),
      text: prev?.text,
      x: shape.x,
      y: shape.y,
      w: typeof shape.props.w === 'number' ? shape.props.w : prev?.w,
      h: typeof shape.props.h === 'number' ? shape.props.h : prev?.h,
      meta,
      parent_id: prev?.parent_id ?? null,
    });
  }

  const nonImageNodes = base.nodes.filter((node) => node.type !== 'image');
  const rawSnapshot = editor.getSnapshot();
  const tldraw_snapshot =
    sanitizeTldrawSnapshot(rawSnapshot as unknown as Record<string, unknown>) ??
    ({} as Record<string, unknown>);

  return {
    ...base,
    nodes: [...nonImageNodes, ...nodes],
    tldraw_snapshot,
    viewport: {
      x: editor.getCamera().x,
      y: editor.getCamera().y,
      zoom: editor.getZoomLevel(),
    },
  };
}
