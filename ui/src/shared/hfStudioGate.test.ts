import { describe, expect, it } from 'vitest';
import { isHfStudioBuildDisabled, isHfStudioEnabled } from './hfStudioGate';

describe('hfStudioGate', () => {
  it('enabled by default in test env', () => {
    expect(isHfStudioBuildDisabled()).toBe(false);
    expect(isHfStudioEnabled()).toBe(true);
  });
});
