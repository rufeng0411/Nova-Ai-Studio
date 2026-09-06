import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DocxDocumentAdapter,
  getSectionPadding,
  parseCssLength,
  splitDocxSectionsIntoPages,
  type DocxVirtualPage,
} from './docxDocumentAdapter';

const fixturePath = path.resolve(
  process.cwd(),
  '../artifacts/media-smoke/document-canvas/sample-2p.docx',
);
const longFixturePath = path.resolve(
  process.cwd(),
  '../artifacts/media-smoke/document-canvas/sample-long.docx',
);

function mockSectionWithBlocks(blockCount: number, blockHeight: number, paddingPx = 0): HTMLElement {
  const section = document.createElement('section');
  section.className = 'docx';
  section.style.width = '794px';
  section.style.minHeight = '1123px';
  if (paddingPx > 0) {
    section.style.padding = `${paddingPx}px`;
  }
  const article = document.createElement('article');
  for (let index = 0; index < blockCount; index += 1) {
    const paragraph = document.createElement('p');
    paragraph.textContent = `Block ${index + 1}`;
    Object.defineProperty(paragraph, 'offsetHeight', { configurable: true, value: blockHeight });
    Object.defineProperty(paragraph, 'scrollHeight', { configurable: true, value: blockHeight });
    article.appendChild(paragraph);
  }
  section.appendChild(article);
  return section;
}

describe('docx pagination helpers', () => {
  it('parses css lengths used by docx-preview page sizes', () => {
    expect(parseCssLength('794px', 0)).toBe(794);
    expect(parseCssLength('1123pt', 0)).toBeCloseTo(1497.33, 1);
    expect(parseCssLength('8.27in', 0)).toBeCloseTo(793.92, 1);
  });

  it('applies default page margins when section padding is missing', () => {
    const section = document.createElement('section');
    expect(getSectionPadding(section)).toEqual({
      top: 96,
      right: 96,
      bottom: 96,
      left: 96,
    });
  });

  it('splits overflow sections by content blocks instead of hard pixel slices', () => {
    const pages = splitDocxSectionsIntoPages([mockSectionWithBlocks(5, 220, 96)]);
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages[0]?.root.style.paddingTop).toBe('96px');
    expect(pages[1]?.root.style.paddingTop).toBe('96px');
  });

  it('keeps short sections as a single page', () => {
    const pages = splitDocxSectionsIntoPages([mockSectionWithBlocks(2, 80, 96)]);
    expect(pages.length).toBe(1);
  });
});

describe('DocxDocumentAdapter', () => {
  it('parses fixture page count when available', async () => {
    if (!existsSync(fixturePath)) {
      return;
    }
    const adapter = new DocxDocumentAdapter();
    const file = readFileSync(fixturePath);
    const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    await adapter.load(buffer);
    expect(adapter.pageCount).toBeGreaterThanOrEqual(2);
    adapter.destroy();
  });

  it('virtual-paginates long fixture without explicit page breaks', async () => {
    if (!existsSync(longFixturePath)) {
      return;
    }
    const adapter = new DocxDocumentAdapter();
    const file = readFileSync(longFixturePath);
    const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    await adapter.load(buffer);
    expect(adapter.pageCount).toBeGreaterThanOrEqual(3);
    adapter.destroy();
  });

  it('renders composed page sections for rail thumbnails via renderPage', async () => {
    const adapter = new DocxDocumentAdapter();
    const root = document.createElement('section');
    root.className = 'docx';
    root.textContent = 'Page 1';
    root.style.width = '794px';
    root.style.height = '1123px';
    root.style.padding = '96px';
    const pages: DocxVirtualPage[] = [{
      root,
      pageWidth: 794,
      pageHeight: 1123,
    }];
    (adapter as unknown as { pages: DocxVirtualPage[] }).pages = pages;
    const host = document.createElement('div');

    await adapter.renderPage(0, host, 0.5);
    const centerWrap = host.firstElementChild as HTMLElement | null;
    const pageFrame = centerWrap?.firstElementChild as HTMLElement | null;
    const scaleSlot = pageFrame?.firstElementChild as HTMLElement | null;

    expect(pageFrame?.style.width).toBe('397px');
    expect(scaleSlot?.style.height).toBe('562px');
    expect(pageFrame?.className).toContain('shadow-sm');
    expect(centerWrap?.className).toContain('justify-center');
    expect(host.textContent).toContain('Page 1');
  });

  it('does not expose placeholder-only canvas thumbnails', () => {
    const adapter = new DocxDocumentAdapter();
    expect(adapter.renderThumbnail).toBeUndefined();
  });
});
