import { describe, expect, it } from 'vitest';
import { suggestPostDeliverableActions } from './suggestPostDeliverableActions';

describe('suggestPostDeliverableActions', () => {
  it('suggests GEO dual HTML when trio present without html', () => {
    const actions = suggestPostDeliverableActions({
      basenames: ['audit-checklist.md', 'keywords.md', 'optimized.md'],
    });
    expect(actions[0]?.id).toBe('geo_dual_html');
    expect(actions.some((a) => a.id === 'export_pdf')).toBe(true);
  });

  it('does not suggest md_to_html when html exists', () => {
    const actions = suggestPostDeliverableActions({
      basenames: ['report.md', 'report.html'],
    });
    expect(actions.some((a) => a.id === 'md_to_html')).toBe(false);
    expect(actions.some((a) => a.id === 'export_pdf')).toBe(true);
  });

  it('caps at 3 actions', () => {
    const actions = suggestPostDeliverableActions({
      basenames: ['a.md', 'b.md', 'c.md', 'd.md', 'e.md'],
      profileId: 'brand-campaign-full',
    });
    expect(actions.length).toBeLessThanOrEqual(3);
  });

  it('skips pdf when already present', () => {
    const actions = suggestPostDeliverableActions({
      basenames: ['report.md', 'report.pdf'],
    });
    expect(actions.some((a) => a.id === 'export_pdf')).toBe(false);
  });

  it('suggests md_to_html for lone md without geo trio', () => {
    const actions = suggestPostDeliverableActions({
      basenames: ['notes.md'],
    });
    expect(actions[0]?.id).toBe('md_to_html');
  });

  it('suggests campaign social/ppt when profile campaign and many md', () => {
    const actions = suggestPostDeliverableActions({
      basenames: ['01.md', '02.md', '03.md', '04.md', '05.md'],
      profileId: 'brand-campaign-full',
    });
    expect(actions.some((a) => a.id === 'campaign_social' || a.id === 'campaign_ppt' || a.id === 'to_pptx')).toBe(
      true,
    );
  });
});
