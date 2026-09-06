import { describe, expect, it } from 'vitest';
import {
  shouldBlockWriteForPreflight,
  markSlotPreflightAwaiting,
  resolveSlotPreflight,
} from './preflightGate.js';

describe('preflightGate', () => {
  const baseSlot = {
    id: 'landing',
    label: '落地页',
    required: true,
    needsPreflight: true,
    preflightProfileRef: 'open-design',
    preflightStatus: 'awaiting' as const,
  };

  it('blocks write when awaiting', () => {
    process.env.PILOTDECK_PREFLIGHT_STUDIO = 'shadow';
    expect(shouldBlockWriteForPreflight(baseSlot)).toBe(true);
  });

  it('allows write after resolved', () => {
    process.env.PILOTDECK_PREFLIGHT_STUDIO = 'shadow';
    const resolved = resolveSlotPreflight(baseSlot, {
      catalogId: 'linear-app',
      surface: 'linear-app',
      confirmedAt: new Date().toISOString(),
    });
    expect(shouldBlockWriteForPreflight(resolved)).toBe(false);
  });

  it('mark awaiting sets profile ref', () => {
    const slot = markSlotPreflightAwaiting(
      { id: 'ppt', label: 'PPT', required: true },
      'ppt-master',
    );
    expect(slot.needsPreflight).toBe(true);
    expect(slot.preflightStatus).toBe('awaiting');
  });
});
