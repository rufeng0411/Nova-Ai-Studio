import { describe, expect, it } from 'vitest';
import {
  filterNonReferenceableDeliverablePaths,
  filterPathsForCapabilityTry,
  isFreshCreateCapabilityTry,
} from './capabilityTryReferences';

describe('filterPathsForCapabilityTry', () => {
  it('passes deliverable paths through for continuation capabilities', () => {
    const paths = ['artifacts/campaign/report.md', 'artifacts/design/foo/index.html'];
    expect(filterPathsForCapabilityTry(paths, 'od-saas-landing')).toEqual([
      'artifacts/campaign/report.md',
      'artifacts/design/foo/index.html',
    ]);
  });

  it('excludes prior slide deck artifacts for Nova to prevent cross-deck @', () => {
    const paths = [
      'artifacts/slides-miyazaki/outline.json',
      'artifacts/slides-miyazaki/slide-01.png',
      'artifacts/slides-miyazaki/slide-manifest.json',
    ];
    expect(filterPathsForCapabilityTry(paths, 'nova-ppt-aesthetic-slides')).toEqual([]);
  });

  it('drops unrelated index.html and design README for Nova', () => {
    const paths = [
      'artifacts/design/chang-tiao/index.html',
      'artifacts/design/chang-tiao/README.md',
      'index.html',
    ];
    expect(filterPathsForCapabilityTry(paths, 'nova-ppt-aesthetic-slides')).toEqual([]);
  });

  it('keeps research md/pdf/docx/pptx for Nova reference attachments', () => {
    const paths = [
      'artifacts/nio-es9-review/蔚来ES9复盘报告.pdf',
      'artifacts/geo/campaign/竞品分析.md',
      '沧海文字大纲.docx',
      'artifacts/reference/原稿24页.pptx',
    ];
    expect(filterPathsForCapabilityTry(paths, 'nova-ppt-aesthetic-slides')).toEqual(paths);
  });

  it('image-generation: never auto-@ even when session has poster artifacts', () => {
    const paths = [
      'artifacts/task-20260717-e8104d0d/world-cup-final-poster-arg-vs-esp.png',
      'artifacts/task-20260717-e8104d0d/canvas-manifest.json',
      'artifacts/task-20260717-e8104d0d/layout.md',
    ];
    expect(filterPathsForCapabilityTry(paths, 'image-generation')).toEqual([]);
    expect(filterPathsForCapabilityTry(paths, 'df-image-generation')).toEqual([]);
  });

  it('strips canvas-manifest and layout.md for non-fresh capabilities', () => {
    const paths = [
      'artifacts/task-20260717-e8104d0d/canvas-manifest.json',
      'artifacts/task-20260717-e8104d0d/layout.md',
      'artifacts/task-20260717-e8104d0d/report.md',
    ];
    expect(filterPathsForCapabilityTry(paths, 'anth-docx')).toEqual([
      'artifacts/task-20260717-e8104d0d/report.md',
    ]);
  });
});

describe('filterNonReferenceableDeliverablePaths', () => {
  it('removes canvas process files globally', () => {
    expect(
      filterNonReferenceableDeliverablePaths([
        'artifacts/canvas-1/canvas-manifest.json',
        'artifacts/canvas-1/layout.md',
        'artifacts/canvas-1/hero.png',
      ]),
    ).toEqual(['artifacts/canvas-1/hero.png']);
  });
});

describe('isFreshCreateCapabilityTry', () => {
  it('detects image generation slugs', () => {
    expect(isFreshCreateCapabilityTry('image-generation')).toBe(true);
    expect(isFreshCreateCapabilityTry('df-image-generation')).toBe(true);
    expect(isFreshCreateCapabilityTry('anth-docx')).toBe(false);
  });
});
