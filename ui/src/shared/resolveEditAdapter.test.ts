import { describe, expect, it } from 'vitest';
import { resolveEditAdapter } from './resolveEditAdapter';
import type { ArtifactContract } from './artifactContract';

describe('resolveEditAdapter', () => {
  it('prefers hyperframesStudio for hf-project', () => {
    const contract = { carrierScope: 'hyperframes_project', pages: [] } as unknown as import('./artifactContract').ArtifactContract;
    expect(
      resolveEditAdapter({
        contract,
        fileName: 'index.html',
        apiPath: 'artifacts/task-20260726-abc12345/hf-project/index.html',
      }),
    ).toBe('hyperframesStudio');
  });

  it('prefers bentoDeck for .bento.html', () => {
    const contract = { carrierScope: 'bento_deck', pages: [] } as unknown as ArtifactContract;
    expect(
      resolveEditAdapter({
        contract,
        fileName: 'deck.bento.html',
        apiPath: 'artifacts/task-20260728-abc/deck.bento.html',
      }),
    ).toBe('bentoDeck');
  });

  it('html studio for non-hf artifacts html', () => {
    const contract = { carrierScope: 'report_html', pages: [] } as unknown as ArtifactContract;
    expect(
      resolveEditAdapter({
        contract,
        fileName: 'report.html',
        apiPath: 'artifacts/geo/report.html',
      }),
    ).toBe('htmlStudio');
  });
});
