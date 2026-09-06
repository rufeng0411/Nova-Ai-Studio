import { describe, expect, it } from 'vitest';
import {
  formatDeliverableFileTypeLabel,
  formatSummaryTableLinkLabel,
  resolveSummaryTableLinkDisplay,
  supportsSummaryInlineMediaPreview,
} from './deliverableFileTypeLabel';

describe('deliverableFileTypeLabel', () => {
  it('maps extensions to type labels', () => {
    expect(formatDeliverableFileTypeLabel('artifacts/geo/x/audit-checklist.md', 'document')).toBe('Markdown');
    expect(formatDeliverableFileTypeLabel('artifacts/geo/x/schema.jsonld', 'document')).toBe('JSON-LD');
    expect(formatDeliverableFileTypeLabel('artifacts/slide-01.png', 'image')).toBe('PNG');
  });

  it('detects inline media preview support', () => {
    expect(supportsSummaryInlineMediaPreview('artifacts/out.png', 'image')).toBe(true);
    expect(supportsSummaryInlineMediaPreview('artifacts/out.mp4', 'video')).toBe(true);
    expect(supportsSummaryInlineMediaPreview('artifacts/out.md', 'document')).toBe(false);
  });

  it('shows project link for all delivered files including images', () => {
    expect(resolveSummaryTableLinkDisplay('artifacts/geo/x/audit-checklist.md', 'document')).toEqual({
      mode: 'project',
      href: '/artifacts/geo/x/audit-checklist.md',
    });
    expect(resolveSummaryTableLinkDisplay('artifacts/out.png', 'image')).toEqual({
      mode: 'project',
      href: '/artifacts/out.png',
    });
    expect(resolveSummaryTableLinkDisplay('https://example.com/report.pdf', 'url')).toEqual({
      mode: 'external',
      href: 'https://example.com/report.pdf',
    });
  });

  it('formats link column labels as basename only', () => {
    expect(formatSummaryTableLinkLabel('artifacts/geo/x/audit-checklist.md', 'document')).toBe('audit-checklist.md');
    expect(formatSummaryTableLinkLabel('artifacts/out.png', 'image')).toBe('out.png');
    expect(formatSummaryTableLinkLabel('https://example.com/report.pdf', 'url')).toContain('example.com');
  });
});
