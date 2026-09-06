import { describe, expect, it } from 'vitest';
import {
  isValidTldrawAssetSrc,
  parseMaskRegionFromMeta,
  sanitizeTldrawSnapshot,
  snapshotContainsBlob,
  toTldrawShapeMeta,
} from './tldrawCanvasSync';

describe('tldrawCanvasSync', () => {
  it('rejects blob URLs for tldraw assets', () => {
    expect(isValidTldrawAssetSrc('blob:http://127.0.0.1:5173/abc')).toBe(false);
    expect(isValidTldrawAssetSrc('http://127.0.0.1:5173/api/files/content?path=a.png')).toBe(true);
    expect(isValidTldrawAssetSrc('data:image/png;base64,abc')).toBe(true);
  });

  it('serializes maskRegion and maskPaint for tldraw shape meta', () => {
    const meta = toTldrawShapeMeta({
      id: 'n-1',
      type: 'image',
      x: 0,
      y: 0,
      meta: { maskRegion: { x: 1, y: 2, w: 3, h: 4 }, maskPaint: 'assets/mask-n1.png' },
    });
    expect(meta.maskRegion).toBe('1,2,3,4');
    expect(meta.maskPaint).toBe('assets/mask-n1.png');
    expect(parseMaskRegionFromMeta(meta.maskRegion)).toEqual({ x: 1, y: 2, w: 3, h: 4 });
  });

  it('strips blob and all image records from snapshot', () => {
    const snapshot = {
      store: {
        'asset:1': {
          typeName: 'asset',
          type: 'image',
          props: { src: 'blob:http://127.0.0.1:5173/dead' },
        },
        'asset:2': {
          typeName: 'asset',
          type: 'image',
          props: { src: 'http://127.0.0.1:5173/ok.png' },
        },
        'shape:img1': {
          typeName: 'shape',
          type: 'image',
          props: { assetId: 'asset:2' },
        },
        'shape:arrow1': {
          typeName: 'shape',
          type: 'arrow',
          props: {},
          meta: { maskRegion: { x: 1, y: 2, w: 3, h: 4 } },
        },
      },
    };
    expect(snapshotContainsBlob(snapshot)).toBe(true);
    const sanitized = sanitizeTldrawSnapshot(snapshot);
    const store = sanitized!.store as Record<string, unknown>;
    expect(store['asset:1']).toBeUndefined();
    expect(store['asset:2']).toBeUndefined();
    expect(store['shape:img1']).toBeUndefined();
    expect(store['shape:arrow1']).toBeDefined();
    expect((store['shape:arrow1'] as { meta?: { maskRegion?: string } }).meta?.maskRegion).toBe('1,2,3,4');
    expect(snapshotContainsBlob(sanitized)).toBe(false);
  });
});
