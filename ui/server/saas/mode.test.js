import { describe, expect, it } from 'vitest';
import { isSaasMode } from './mode.js';

describe('isSaasMode', () => {
  it('is false by default', () => {
    expect(isSaasMode({})).toBe(false);
    expect(isSaasMode({ PILOTDECK_SAAS_MODE: '0' })).toBe(false);
  });

  it('is true for 1 or true', () => {
    expect(isSaasMode({ PILOTDECK_SAAS_MODE: '1' })).toBe(true);
    expect(isSaasMode({ PILOTDECK_SAAS_MODE: 'true' })).toBe(true);
  });
});
