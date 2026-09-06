import { describe, expect, it } from 'vitest';
import { computeExportPollMaxAttempts, exportPollTimeoutMs } from './exportPollTimeout';

describe('exportPollTimeout', () => {
  it('keeps 3-minute default for single-page local export', () => {
    expect(exportPollTimeoutMs(1, 'compose_images')).toBe(180_000);
  });

  it('allows at least 5 minutes for 8-slide OCR deck', () => {
    const attempts = computeExportPollMaxAttempts(8, 'ocr_editable_pptx', 1200);
    expect(attempts * 1200).toBeGreaterThanOrEqual(520_000);
  });

  it('allows about 11 minutes for 11-slide OCR deck', () => {
    const ms = exportPollTimeoutMs(11, 'ocr_editable_pptx');
    expect(ms).toBeGreaterThanOrEqual(750_000);
    expect(ms).toBeLessThanOrEqual(1_200_000);
  });

  it('allows 12 minutes before HTML OCR page count is known', () => {
    expect(exportPollTimeoutMs(undefined, 'ocr_editable_pptx')).toBe(720_000);
  });

  it('extends timeout for 8-slide compose PDF', () => {
    expect(exportPollTimeoutMs(8, 'compose_images')).toBeGreaterThanOrEqual(250_000);
  });
});
