// PD-SAAS-FORK: pdf.js document adapter
import type { DocumentAdapter, PageDimensions } from '../types';
// Vite resolves the worker asset to a stable URL (import.meta.url relative paths break in dev).
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let pdfJsModule: PdfJsModule | null = null;

function hasDestroy(value: unknown): value is { destroy: () => Promise<void> | void } {
  return Boolean(value && typeof value === 'object' && 'destroy' in value && typeof value.destroy === 'function');
}

async function getPdfJs(): Promise<PdfJsModule> {
  if (!pdfJsModule) {
    pdfJsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
    if (!pdfJsModule.GlobalWorkerOptions.workerSrc) {
      pdfJsModule.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    }
  }
  return pdfJsModule;
}

/** pdf.js 同一文档并发 render 易失败，缩略图限流排队。 */
class PdfRenderQueue {
  private active = 0;

  private pending: Array<() => void> = [];

  constructor(private readonly maxConcurrent = 3) {}

  run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const exec = () => {
        this.active += 1;
        task()
          .then(resolve, reject)
          .finally(() => {
            this.active -= 1;
            const next = this.pending.shift();
            if (next) next();
          });
      };
      if (this.active < this.maxConcurrent) exec();
      else this.pending.push(exec);
    });
  }
}

export class PdfDocumentAdapter implements DocumentAdapter {
  private pdfDoc: import('pdfjs-dist').PDFDocumentProxy | null = null;

  private activeRender: import('pdfjs-dist').RenderTask | null = null;

  private readonly thumbnailQueue = new PdfRenderQueue(3);

  private pageDimensions: PageDimensions = { width: 612, height: 792 };

  private pageDimensionsByIndex: PageDimensions[] = [];

  get pageCount(): number {
    return this.pdfDoc?.numPages ?? 0;
  }

  getPageDimensions(pageIndex = 0): PageDimensions {
    return this.pageDimensionsByIndex[pageIndex] ?? this.pageDimensions;
  }

  async load(buffer: ArrayBuffer): Promise<void> {
    const pdfjs = await getPdfJs();
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
    this.pdfDoc = await loadingTask.promise;
    this.pageDimensionsByIndex = [];
    for (let index = 0; index < this.pdfDoc.numPages; index += 1) {
      const page = await this.pdfDoc.getPage(index + 1);
      const viewport = page.getViewport({ scale: 1 });
      const dimensions = { width: viewport.width, height: viewport.height };
      this.pageDimensionsByIndex[index] = dimensions;
      if (index === 0) this.pageDimensions = dimensions;
    }
  }

  async renderPage(pageIndex: number, container: HTMLElement, scale: number): Promise<void> {
    if (!this.pdfDoc) return;
    this.activeRender?.cancel();
    const page = await this.pdfDoc.getPage(pageIndex + 1);
    const baseViewport = page.getViewport({ scale: 1 });
    this.pageDimensions = { width: baseViewport.width, height: baseViewport.height };
    this.pageDimensionsByIndex[pageIndex] = this.pageDimensions;
    const viewport = page.getViewport({ scale: Math.max(scale, 0.1) });
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
    const canvas = document.createElement('canvas');
    canvas.className = 'block shrink-0 max-w-full shadow-sm';
    canvas.width = Math.max(Math.round(viewport.width * dpr), 1);
    canvas.height = Math.max(Math.round(viewport.height * dpr), 1);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    container.replaceChildren(canvas);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(dpr, dpr);
    const renderTask = page.render({ canvasContext: context, viewport, canvas });
    this.activeRender = renderTask;
    await renderTask.promise;
  }

  async renderThumbnail(pageIndex: number, canvas: HTMLCanvasElement, maxWidthPx = 120): Promise<void> {
    if (!this.pdfDoc) return;
    await this.thumbnailQueue.run(async () => {
      const page = await this.pdfDoc!.getPage(pageIndex + 1);
      const baseViewport = page.getViewport({ scale: 1 });
      this.pageDimensionsByIndex[pageIndex] = { width: baseViewport.width, height: baseViewport.height };
      const targetWidth = Math.max(Math.min(maxWidthPx, baseViewport.width), 48);
      const scale = targetWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });
      const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
      const displayWidth = Math.max(Math.round(viewport.width), 1);
      const displayHeight = Math.max(Math.round(viewport.height), 1);
      canvas.className = 'block max-h-full max-w-full shrink-0';
      canvas.width = Math.max(Math.round(displayWidth * dpr), 1);
      canvas.height = Math.max(Math.round(displayHeight * dpr), 1);
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
      canvas.style.maxWidth = '100%';
      canvas.style.maxHeight = '100%';
      const context = canvas.getContext('2d');
      if (!context) throw new Error('PDF thumbnail canvas 2d context unavailable');
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.scale(dpr, dpr);
      await page.render({ canvasContext: context, viewport, canvas }).promise;
    });
  }

  destroy(): void {
    this.activeRender?.cancel();
    this.activeRender = null;
    if (hasDestroy(this.pdfDoc)) {
      void this.pdfDoc.destroy();
    }
    this.pdfDoc = null;
    this.pageDimensions = { width: 612, height: 792 };
    this.pageDimensionsByIndex = [];
  }
}
