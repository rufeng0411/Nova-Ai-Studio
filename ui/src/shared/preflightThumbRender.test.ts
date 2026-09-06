// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  buildOdThumbSvg,
  buildPreflightThumbSvg,
  buildPptCanvasThumbSvg,
  buildPptModeThumbSvg,
  buildPptStyleThumbSvg,
  normalizePreflightHex,
  resolvePreviewColors,
} from './preflightThumbRender';
import type { PreflightCatalogEntry } from './preflightSelection';

describe('preflightThumbRender', () => {
  it('normalizes hex without hash', () => {
    expect(normalizePreflightHex('FF5701')).toBe('#ff5701');
    expect(normalizePreflightHex('#6366f1')).toBe('#6366f1');
  });

  it('builds non-empty SVG for OD and PPT kinds', () => {
    const item: PreflightCatalogEntry = {
      id: 'linear-app',
      label: 'Linear',
      colors: ['#5e6ad2', '#0f1115', '#f7f8f8', '#8a8f98', '#d0d4dc'],
    };
    expect(buildOdThumbSvg(item.colors!, item.label)).toContain('<svg');
    expect(buildPptStyleThumbSvg(item.colors!, item.label)).toContain('<svg');
    expect(buildPptCanvasThumbSvg(item.colors!, '16/9')).toContain('<svg');
    expect(buildPptModeThumbSvg(item.colors!, 'pyramid')).toContain('<polygon');
    expect(buildPreflightThumbSvg('od', item)).toContain('Linear');
    expect(buildPreflightThumbSvg('ppt-style', item)).toContain('<svg');
  });

  it('falls back when colors missing', () => {
    const colors = resolvePreviewColors({ id: 'x', label: 'X', accent: 'FF5701' });
    expect(colors[0]).toBe('#ff5701');
    expect(colors.length).toBeGreaterThanOrEqual(3);
  });
});
