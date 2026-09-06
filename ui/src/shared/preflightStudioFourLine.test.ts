// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { shouldBlockWriteForPreflight } from '../../../src/saas/preflight/preflightGate.js';

describe('preflight four-line gate', () => {
  it('unconfirmed visual slot is not write-complete', () => {
    process.env.PILOTDECK_PREFLIGHT_STUDIO = 'enforce';
    const slot = {
      id: 'html',
      label: '落地页',
      required: true,
      needsPreflight: true,
      preflightStatus: 'awaiting' as const,
    };
    expect(shouldBlockWriteForPreflight(slot)).toBe(true);
  });
});
