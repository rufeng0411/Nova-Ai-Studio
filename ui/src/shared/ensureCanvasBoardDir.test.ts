import { describe, expect, it } from 'vitest';
import { isSlidesArtifactPath, proposeCanvasBoardDir } from './designCanvasManifest';
import { resolveCanvasBoardEditContext } from './ensureCanvasBoardDir';

describe('ensureCanvasBoardDir', () => {
  it('rejects slides deck paths', () => {
    expect(
      resolveCanvasBoardEditContext({ activePath: 'artifacts/slides-deck/slide-01.png' }),
    ).toBeNull();
  });

  it('proposes artifacts/canvas-* for loose images', () => {
    const ctx = resolveCanvasBoardEditContext({ activePath: 'artifacts/campaign/hero.png' });
    expect(ctx?.boardDir).toMatch(/^artifacts\/canvas-/);
    expect(ctx?.needsAssetCopy).toBe(true);
    expect(ctx?.activeAssetRelative).toMatch(/^assets\//);
  });

  it('reuses existing canvas board directory', () => {
    const ctx = resolveCanvasBoardEditContext({
      activePath: 'artifacts/canvas-abc/assets/hero.png',
    });
    expect(ctx?.boardDir).toBe('artifacts/canvas-abc');
    expect(ctx?.needsAssetCopy).toBe(false);
  });

  it('isSlidesArtifactPath matches slides dirs only', () => {
    expect(isSlidesArtifactPath('artifacts/slides-x/slide-01.png')).toBe(true);
    expect(isSlidesArtifactPath('artifacts/canvas-x/assets/a.png')).toBe(false);
  });

  it('proposeCanvasBoardDir prefers hint turn dir when already canvas', () => {
    expect(
      proposeCanvasBoardDir({ turnArtifactDir: 'artifacts/canvas-existing/assets' }),
    ).toBe('artifacts/canvas-existing');
  });
});
