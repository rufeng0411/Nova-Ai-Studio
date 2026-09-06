import { cleanup, render, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import DocumentPageRail from './DocumentPageRail';
import type { DocumentAdapter } from './types';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
});

describe('DocumentPageRail', () => {
  it('uses adapter page dimensions for thumbnail aspect ratio', () => {
    const adapter: DocumentAdapter = {
      pageCount: 1,
      load: vi.fn(),
      getPageDimensions: () => ({ width: 400, height: 200 }),
      renderPage: vi.fn(),
      renderThumbnail: vi.fn(),
      destroy: vi.fn(),
    };

    const { getByTestId } = render(
      <DocumentPageRail
        adapter={adapter}
        pageCount={1}
        pageIndex={0}
        railMode="strip"
        onSelectPage={vi.fn()}
      />,
    );

    const thumbnail = getByTestId('document-canvas-thumb-frame-0') as HTMLElement;
    expect(thumbnail.style.aspectRatio).toBe('400 / 200');
  });

  it('centers docx rail host content for word thumbnails', () => {
    const adapter: DocumentAdapter = {
      pageCount: 1,
      load: vi.fn(),
      getPageDimensions: () => ({ width: 794, height: 1123 }),
      renderPage: vi.fn(),
      destroy: vi.fn(),
    };

    const { getByTestId } = render(
      <DocumentPageRail
        adapter={adapter}
        pageCount={1}
        pageIndex={0}
        railMode="strip"
        onSelectPage={vi.fn()}
      />,
    );

    const host = getByTestId('document-canvas-thumb-render-target-0');
    expect(host.className).toContain('items-center');
    expect(host.className).toContain('justify-center');
    expect(host.className).toContain('absolute');
    expect(host.className).not.toContain('items-start');
  });

  it('keeps thumbnail slots from flex-shrinking in long strip lists', () => {
    const adapter: DocumentAdapter = {
      pageCount: 86,
      load: vi.fn(),
      getPageDimensions: () => ({ width: 612, height: 792 }),
      renderPage: vi.fn(),
      renderThumbnail: vi.fn(),
      destroy: vi.fn(),
    };

    const { getByTestId } = render(
      <DocumentPageRail
        adapter={adapter}
        pageCount={86}
        pageIndex={0}
        railMode="strip"
        onSelectPage={vi.fn()}
      />,
    );

    const rail = getByTestId('document-canvas-page-rail');
    const thumbButton = within(rail).getByTestId('document-canvas-thumb-0');
    expect(thumbButton.className).toContain('shrink-0');
  });
});
