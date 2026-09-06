import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const fixtureDir = path.resolve(
  process.cwd(),
  '../artifacts/media-smoke/document-canvas',
);

describe('PptxDocumentAdapter fixtures', () => {
  it('declares three slides in manifest', () => {
    const manifestPath = path.join(fixtureDir, 'manifest.json');
    if (!existsSync(manifestPath)) {
      return;
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      files: Array<{ name: string; pages: number }>;
    };
    const pptx = manifest.files.find((file) => file.name === 'sample-3s.pptx');
    expect(pptx?.pages).toBe(3);
  });

  it('ships a non-empty pptx fixture blob', () => {
    const fixturePath = path.join(fixtureDir, 'sample-3s.pptx');
    if (!existsSync(fixturePath)) {
      return;
    }
    const file = readFileSync(fixturePath);
    expect(file.byteLength).toBeGreaterThan(100);
  });
});
