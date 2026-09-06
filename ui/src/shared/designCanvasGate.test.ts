import { describe, expect, it, beforeEach } from 'vitest';
import {
  isDesignCanvasBuildDisabled,
  isDesignCanvasEnabled,
  setDesignCanvasEnabled,
} from './designCanvasGate';

describe('designCanvasGate', () => {
  beforeEach(() => {
    window.localStorage.removeItem('pilotdeck-design-canvas-enabled');
  });

  it('defaults to enabled when unset', () => {
    expect(isDesignCanvasEnabled()).toBe(true);
  });

  it('persists enabled flag', () => {
    setDesignCanvasEnabled(true);
    expect(isDesignCanvasEnabled()).toBe(true);
    setDesignCanvasEnabled(false);
    expect(isDesignCanvasEnabled()).toBe(false);
  });

  it('respects build disable env', () => {
    const original = import.meta.env.VITE_PILOTDECK_DESIGN_CANVAS;
    import.meta.env.VITE_PILOTDECK_DESIGN_CANVAS = '0';
    setDesignCanvasEnabled(true);
    expect(isDesignCanvasBuildDisabled()).toBe(true);
    expect(isDesignCanvasEnabled()).toBe(false);
    import.meta.env.VITE_PILOTDECK_DESIGN_CANVAS = original;
  });
});
