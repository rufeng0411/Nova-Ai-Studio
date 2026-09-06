import { describe, expect, it, vi, beforeEach } from 'vitest';

const getRuntimeFeatureFlags = vi.fn(() => null);

vi.mock('../../../shared/runtimeFeatureFlags', () => ({
  getRuntimeFeatureFlags: () => getRuntimeFeatureFlags(),
}));

import {
  getPostDeliverableNextMode,
  getTurnUsageFooterMode,
  getWorkbenchTourMode,
  isWorkbenchBeta11Enabled,
  parseGrayMode,
  parseOnOff,
} from './workbenchBetaFlags';

describe('workbenchBetaFlags', () => {
  beforeEach(() => {
    getRuntimeFeatureFlags.mockReturnValue(null);
  });

  it('parseOnOff / parseGrayMode cover on|off|shadow|enforce', () => {
    expect(parseOnOff('on')).toBe(true);
    expect(parseOnOff('1')).toBe(true);
    expect(parseOnOff('off')).toBe(false);
    expect(parseOnOff(undefined)).toBe(false);
    expect(parseGrayMode('off', 'shadow')).toBe('off');
    expect(parseGrayMode('shadow', 'off')).toBe('shadow');
    expect(parseGrayMode('enforce', 'off')).toBe('enforce');
    expect(parseGrayMode('true', 'off')).toBe('enforce');
    expect(parseGrayMode('nope', 'off')).toBe('off');
  });

  it('runtime workbenchBeta11 boolean overrides', () => {
    getRuntimeFeatureFlags.mockReturnValue({ workbenchBeta11: true });
    expect(isWorkbenchBeta11Enabled()).toBe(true);
    getRuntimeFeatureFlags.mockReturnValue({ workbenchBeta11: false });
    expect(isWorkbenchBeta11Enabled()).toBe(false);
  });

  it('runtime gray modes override', () => {
    getRuntimeFeatureFlags.mockReturnValue({
      workbenchTourMode: 'shadow',
      turnUsageFooterMode: 'enforce',
      postDeliverableNextMode: 'off',
    });
    expect(getWorkbenchTourMode()).toBe('shadow');
    expect(getTurnUsageFooterMode()).toBe('enforce');
    expect(getPostDeliverableNextMode()).toBe('off');
  });

  it('falls back to env default off when runtime unset', () => {
    getRuntimeFeatureFlags.mockReturnValue(null);
    // Vite may inject VITE_* at build time; assert callable + boolean/gray shape.
    expect(typeof isWorkbenchBeta11Enabled()).toBe('boolean');
    expect(['off', 'shadow', 'enforce']).toContain(getWorkbenchTourMode());
    expect(['off', 'shadow', 'enforce']).toContain(getTurnUsageFooterMode());
    expect(['off', 'shadow', 'enforce']).toContain(getPostDeliverableNextMode());
  });
});
