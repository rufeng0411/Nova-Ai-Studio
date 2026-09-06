import { describe, expect, it } from 'vitest';
import {
  createEmptyCanvasManifest,
  resolveCanvasNodePath,
  seedActiveAssetOnCanvas,
  viewportCenteredOnNode,
} from './designCanvasManifest';

describe('seedActiveAssetOnCanvas', () => {
  it('adds the opened image as a node when manifest is empty', () => {
    const empty = createEmptyCanvasManifest('board-1', 'Board');
    const { manifest, seededNodeId, didSeed } = seedActiveAssetOnCanvas(
      empty,
      'artifacts/campaign/hero.png',
      'artifacts/campaign',
      { title: 'hero.png' },
    );
    expect(didSeed).toBe(true);
    expect(seededNodeId).toBeTruthy();
    expect(manifest.nodes).toHaveLength(1);
    expect(manifest.nodes[0]?.type).toBe('image');
    expect(resolveCanvasNodePath('artifacts/campaign', manifest.nodes[0]?.path)).toBe(
      'artifacts/campaign/hero.png',
    );
    expect(manifest.viewport).toBeDefined();
  });

  it('does not duplicate when the same asset is already on the canvas', () => {
    const empty = createEmptyCanvasManifest('board-1', 'Board');
    const first = seedActiveAssetOnCanvas(empty, 'artifacts/a.png', 'artifacts');
    const second = seedActiveAssetOnCanvas(first.manifest, 'artifacts/a.png', 'artifacts');
    expect(second.didSeed).toBe(false);
    expect(second.manifest.nodes).toHaveLength(1);
    expect(second.seededNodeId).toBe(first.seededNodeId);
  });

  it('does not seed slides deck images', () => {
    const empty = createEmptyCanvasManifest('board-1', 'Board');
    const { didSeed } = seedActiveAssetOnCanvas(
      empty,
      'artifacts/slides-deck/slide-01.png',
      'artifacts/canvas-1',
    );
    expect(didSeed).toBe(false);
  });
});
