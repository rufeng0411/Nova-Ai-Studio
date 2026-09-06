// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('preflight catalog index', () => {
  it('OD catalog has entries without markdown bodies', () => {
    const p = path.join(ROOT, 'config/preflight-catalog-od.json');
    expect(existsSync(p)).toBe(true);
    const catalog = JSON.parse(readFileSync(p, 'utf8'));
    expect(catalog.count).toBeGreaterThanOrEqual(150);
    expect(catalog.entries.length).toBe(catalog.count);
    for (const e of catalog.entries.slice(0, 20)) {
      expect(e.id).toBeTruthy();
      expect(e.label).toBeTruthy();
      expect(JSON.stringify(e).includes('## ')).toBe(false);
      expect(Array.isArray(e.colors)).toBe(true);
      expect(e.colors.length).toBeGreaterThanOrEqual(5);
      expect(e.accent).toMatch(/^#[0-9a-f]{6}$/);
      expect(e.previewUrl).toMatch(/^\/api\/launch\/static\/open-design\/.+\.html$/);
      for (const c of e.colors) {
        expect(c).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
    expect(catalog.recommend.some((id: string) => catalog.entries.some((e: { id: string }) => e.id === id))).toBe(true);
    for (const row of catalog.entries.filter((e: { heroPreview?: boolean }) => e.heroPreview)) {
      expect(row.previewThumbUrl).toMatch(/^\/api\/launch\/static\/open-design\/thumbs\/.+\.webp$/);
      expect(row.previewImageUrl).toMatch(/^\/api\/launch\/static\/open-design\/detail\/.+\.webp$/);
    }
    expect(catalog.heroPreviewIds?.length).toBeGreaterThanOrEqual(20);
  });

  it('PPT catalog has canvas/styles/modes', () => {
    const p = path.join(ROOT, 'config/preflight-catalog-ppt.json');
    const catalog = JSON.parse(readFileSync(p, 'utf8'));
    expect(catalog.counts.canvas).toBe(8);
    expect(catalog.counts.styles).toBe(18);
    expect(catalog.counts.modes).toBeGreaterThanOrEqual(5);
    expect(catalog.recommend.style).toBe('swiss-minimal');
    for (const row of [...catalog.canvas, ...catalog.modes, ...catalog.styles]) {
      expect(Array.isArray(row.colors)).toBe(true);
      expect(row.colors.length).toBeGreaterThanOrEqual(4);
      for (const c of row.colors) {
        expect(c).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
    for (const row of [...catalog.modes, ...catalog.styles]) {
      expect(row.previewImageUrl).toMatch(/^\/api\/launch\/static\/preflight-raster\/ppt\/detail\/.+\.webp$/);
    }
    for (const row of catalog.canvas) {
      expect(row.previewThumbUrl).toMatch(/^\/api\/launch\/static\/preflight-raster\/ppt\/thumbs\/canvas\/.+\.webp$/);
    }
    for (const row of catalog.styles) {
      expect(row.previewThumbUrl).toMatch(/^\/api\/launch\/static\/preflight-raster\/ppt\/thumbs\/styles\/.+\.webp$/);
    }
    for (const row of catalog.modes) {
      expect(row.previewThumbUrl).toMatch(/^\/api\/launch\/static\/preflight-raster\/ppt\/thumbs\/modes\/.+\.webp$/);
    }
  });
});
