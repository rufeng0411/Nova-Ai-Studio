import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { PdfDocumentAdapter } from './pdfDocumentAdapter';

beforeAll(async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.resolve(process.cwd(), '../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
  ).href;
});

const fixturePath = path.resolve(
  process.cwd(),
  '../artifacts/media-smoke/document-canvas/sample-2p.pdf',
);

describe('PdfDocumentAdapter', () => {
  it('parses fixture page count when available', async () => {
    if (!existsSync(fixturePath)) {
      return;
    }
    const adapter = new PdfDocumentAdapter();
    const file = readFileSync(fixturePath);
    const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    await adapter.load(buffer);
    expect(adapter.pageCount).toBe(2);
    adapter.destroy();
  });

  it('keeps rendered canvas CSS size proportional to the PDF viewport', async () => {
    if (!existsSync(fixturePath)) {
      return;
    }
    const adapter = new PdfDocumentAdapter();
    const file = readFileSync(fixturePath);
    const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    await adapter.load(buffer);

    const host = document.createElement('div');
    await adapter.renderPage(0, host, 0.5);
    const canvas = host.querySelector('canvas');

    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas?.style.width).not.toBe('');
    expect(canvas?.style.height).not.toBe('');
    const cssRatio = parseFloat(canvas?.style.width ?? '0') / parseFloat(canvas?.style.height ?? '1');
    const bitmapRatio = (canvas?.width ?? 0) / (canvas?.height ?? 1);
    expect(Math.abs(cssRatio - bitmapRatio) / bitmapRatio).toBeLessThan(0.03);
    expect(canvas?.className).toContain('shrink-0');

    adapter.destroy();
  });

  it('renders thumbnail canvas with explicit CSS pixel dimensions', async () => {
    if (!existsSync(fixturePath)) {
      return;
    }
    const adapter = new PdfDocumentAdapter();
    const file = readFileSync(fixturePath);
    const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    await adapter.load(buffer);

    const canvas = document.createElement('canvas');
    if (!canvas.getContext('2d')) {
      adapter.destroy();
      return;
    }
    await adapter.renderThumbnail(0, canvas, 108);

    expect(canvas.style.width).not.toBe('100%');
    expect(parseFloat(canvas.style.width)).toBeGreaterThan(0);
    expect(parseFloat(canvas.style.height)).toBeGreaterThan(0);
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);

    adapter.destroy();
  });
});
