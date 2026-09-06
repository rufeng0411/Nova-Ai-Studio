import { describe, expect, it, vi, beforeEach } from 'vitest';
import { enableDesignCanvasForTesting } from './designCanvasGateSync';

vi.mock('../saas/api/saasApi', () => ({
  saasApi: {
    updatePreferences: vi.fn().mockResolvedValue({ ok: true }),
    getPreferences: vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ preferences: { designCanvasEnabled: true } }),
    }),
  },
}));

describe('designCanvasGateSync', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('enableDesignCanvasForTesting sets localStorage gate', () => {
    enableDesignCanvasForTesting();
    expect(localStorage.getItem('pilotdeck-design-canvas-enabled')).toBe('1');
  });
});
