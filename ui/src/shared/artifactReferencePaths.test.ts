import { describe, expect, it } from 'vitest';
import { resolveArtifactReferencePaths } from './artifactReferencePaths';
import { resolveArtifactScope } from './artifactScope';

describe('resolveArtifactReferencePaths', () => {
  it('references manifest and slide pages for png decks (capped)', () => {
    const scope = resolveArtifactScope({
      activePath: 'artifacts/slides-demo/slide-02.png',
      siblings: [
        'artifacts/slides-demo/slide-manifest.json',
        'artifacts/slides-demo/slide-01.png',
        'artifacts/slides-demo/slide-02.png',
        'artifacts/slides-demo/slide-03.png',
      ],
    });

    expect(resolveArtifactReferencePaths(scope)).toEqual([
      'artifacts/slides-demo/slide-manifest.json',
      'artifacts/slides-demo/slide-01.png',
      'artifacts/slides-demo/slide-02.png',
      'artifacts/slides-demo/slide-03.png',
    ]);
  });

  it('references a single office document path', () => {
    const scope = resolveArtifactScope({ activePath: 'docs/report.pdf' });
    expect(resolveArtifactReferencePaths(scope)).toEqual(['docs/report.pdf']);
  });

  it('falls back to siblings for collections without bundle metadata', () => {
    const siblings = ['artifacts/bundle/index.html', 'artifacts/bundle/style.css'];
    const scope = resolveArtifactScope({
      activePath: 'artifacts/bundle/index.html',
      siblings,
    });
    expect(resolveArtifactReferencePaths(scope, { siblings })).toEqual([
      'artifacts/bundle/index.html',
      'artifacts/bundle/style.css',
    ]);
  });
});
