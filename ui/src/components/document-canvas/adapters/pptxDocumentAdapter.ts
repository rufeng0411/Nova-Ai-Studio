// PD-SAAS-FORK: pptxviewjs canvas adapter (no Chart.js)
import { PPTXViewer } from 'pptxviewjs';
import type { DocumentAdapter, PageDimensions } from '../types';
import { DocumentRenderQueue } from './documentRenderQueue';

const DEFAULT_SLIDE_PX: PageDimensions = { width: 960, height: 540 };

type PptxProcessor = {
  getSlideDimensions?: () => { cx: number; cy: number };
};

type MainViewState = {
  pageIndex: number;
  canvas: HTMLCanvasElement;
};

function emuToPx(emu: number): number {
  return (emu / 914400) * 96;
}

function readSlideDimensionsPx(viewer: PPTXViewer): PageDimensions {
  const processor = (viewer as unknown as { processor?: PptxProcessor }).processor;
  const slideSize = processor?.getSlideDimensions?.();
  if (!slideSize?.cx || !slideSize?.cy) {
    return DEFAULT_SLIDE_PX;
  }
  return {
    width: emuToPx(slideSize.cx),
    height: emuToPx(slideSize.cy),
  };
}

export class PptxDocumentAdapter implements DocumentAdapter {
  private viewer: PPTXViewer;

  private slideCount = 0;

  private slideDimensionsPx: PageDimensions = DEFAULT_SLIDE_PX;

  private canvas: HTMLCanvasElement | null = null;

  private mainView: MainViewState | null = null;

  private readonly renderQueue = new DocumentRenderQueue(1);

  constructor() {
    this.viewer = new PPTXViewer({ slideSizeMode: 'fit' });
  }

  get pageCount(): number {
    return this.slideCount;
  }

  getPageDimensions(): PageDimensions {
    return this.slideDimensionsPx;
  }

  async load(buffer: ArrayBuffer): Promise<void> {
    await this.viewer.loadFile(new Uint8Array(buffer));
    this.slideCount = this.viewer.getSlideCount();
    this.slideDimensionsPx = readSlideDimensionsPx(this.viewer);
  }

  private async restoreMainView(): Promise<void> {
    if (!this.mainView) return;
    const { pageIndex, canvas } = this.mainView;
    this.viewer.setCanvas(canvas);
    await this.viewer.renderSlide(pageIndex, canvas);
  }

  async renderPage(pageIndex: number, container: HTMLElement, scale: number): Promise<void> {
    await this.renderQueue.run(async () => {
      const canvas = document.createElement('canvas');
      canvas.className = 'block max-w-none shadow-sm';
      container.replaceChildren(canvas);
      this.canvas = canvas;
      this.mainView = { pageIndex, canvas };
      this.viewer.setCanvas(canvas);

      const slide = this.slideDimensionsPx;
      const safeScale = Math.max(scale, 0.25);
      const logicalWidth = Math.max(Math.round(slide.width * safeScale), 160);
      const logicalHeight = Math.max(Math.round(slide.height * safeScale), 90);
      canvas.style.width = `${logicalWidth}px`;
      canvas.style.height = `${logicalHeight}px`;

      await this.viewer.renderSlide(pageIndex, canvas);
    });
  }

  async renderThumbnail(pageIndex: number, canvas: HTMLCanvasElement, maxWidthPx = 120): Promise<void> {
    await this.renderQueue.run(async () => {
      const slide = this.slideDimensionsPx;
      const thumbScale = Math.max(Math.min(maxWidthPx / Math.max(slide.width, 1), 0.35), 0.08);
      const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
      const displayWidth = Math.max(Math.round(slide.width * thumbScale), 48);
      const displayHeight = Math.max(Math.round(slide.height * thumbScale), 27);
      canvas.className = 'block max-h-full max-w-full shrink-0';
      canvas.width = Math.max(Math.round(displayWidth * dpr), 1);
      canvas.height = Math.max(Math.round(displayHeight * dpr), 1);
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
      canvas.style.maxWidth = '100%';
      canvas.style.maxHeight = '100%';

      const context = canvas.getContext('2d');
      if (context) {
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }

      this.viewer.setCanvas(canvas);
      await this.viewer.renderSlide(pageIndex, canvas, { scale: thumbScale, quality: 'low' });
      await this.restoreMainView();
    });
  }

  destroy(): void {
    this.viewer.destroy();
    this.canvas = null;
    this.mainView = null;
    this.slideCount = 0;
    this.slideDimensionsPx = DEFAULT_SLIDE_PX;
  }
}
