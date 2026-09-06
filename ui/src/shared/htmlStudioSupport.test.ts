import { describe, expect, it } from 'vitest';
import {
  isMobilePreviewSurface,
  resolveHtmlEditAdapter,
  supportsHtmlStudioEdit,
} from './htmlStudioSupport';
import type { ArtifactContract } from './artifactContract';

describe('htmlStudioSupport', () => {
  it('supports artifacts html when gate would be on', () => {
    expect(supportsHtmlStudioEdit('report.html', 'artifacts/geo/report.html', 0)).toBe(true);
  });

  it('resolveHtmlEditAdapter prefers html studio for report html', () => {
    const contract = { carrierScope: 'report_html', pages: [] } as unknown as ArtifactContract;
    expect(resolveHtmlEditAdapter(contract, 'report.html', 'artifacts/geo/report.html')).toBe('htmlStudio');
  });

  it('resolveHtmlEditAdapter returns none for png deck with pages', () => {
    const contract = {
      carrierScope: 'slide_deck_png',
      pages: [{ pageId: '1', index: 0, points: [], status: 'completed' }],
    } as unknown as ArtifactContract;
    expect(
      resolveHtmlEditAdapter(contract, 'slide-01.png', 'artifacts/slides-x/slide-01.png'),
    ).toBe('none');
  });

  it('mobile surface helper returns boolean', () => {
    expect(typeof isMobilePreviewSurface()).toBe('boolean');
  });
});
