import { describe, expect, it, vi } from 'vitest';
import {
  buildCanvasEditPrompt,
  dispatchCanvasAssetAdded,
  subscribeCanvasAssetAdded,
} from './designCanvasBridge';

describe('designCanvasBridge', () => {
  it('buildCanvasEditPrompt includes region when provided', () => {
    const prompt = buildCanvasEditPrompt(['artifacts/canvas-1/assets/a.png'], '继续编辑', '10,20,100,80');
    expect(prompt).toContain('@artifacts/canvas-1/assets/a.png');
    expect(prompt).toContain('region="10,20,100,80"');
  });

  it('canvas-asset-added event delivers board and asset paths', () => {
    localStorage.setItem('pilotdeck-design-canvas-enabled', '1');
    const handler = vi.fn();
    const unsub = subscribeCanvasAssetAdded(handler);
    dispatchCanvasAssetAdded({
      boardPath: 'artifacts/canvas-1/canvas-manifest.json',
      assetPath: 'artifacts/canvas-1/assets/new.png',
    });
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ assetPath: 'artifacts/canvas-1/assets/new.png' }),
    );
    unsub();
  });
});
