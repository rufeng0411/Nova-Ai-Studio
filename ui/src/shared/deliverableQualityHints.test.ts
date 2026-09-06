import { describe, expect, it } from 'vitest';
import {
  resolveDeliverableQualityHint,
  shouldSuppressDeliverableRepairForQualityHint,
} from './deliverableQualityHints';

describe('deliverableQualityHints', () => {
  it('returns office hint when preview fails for pptx', () => {
    const hint = resolveDeliverableQualityHint('artifacts/campaign/deck.pptx', { previewFailed: true });
    expect(hint?.id).toBe('office_open');
    expect(shouldSuppressDeliverableRepairForQualityHint(hint)).toBe(true);
  });

  it('returns null for markdown paths', () => {
    expect(resolveDeliverableQualityHint('artifacts/report.md')).toBeNull();
  });
});
