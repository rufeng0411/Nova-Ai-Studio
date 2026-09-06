// PD-SAAS-FORK: document canvas adapter contract
export type ZoomMode = 'fitWidth' | 'fitPage' | '100' | '125' | '150';

export type DocumentCanvasVariant = 'overlay' | 'sidebar';

export type PageDimensions = { width: number; height: number };

export type DocumentAdapter = {
  load(buffer: ArrayBuffer): Promise<void>;
  readonly pageCount: number;
  /** Logical page size at scale 1 — used for fit-width / fit-page zoom. */
  getPageDimensions(pageIndex?: number): PageDimensions;
  renderPage(pageIndex: number, container: HTMLElement, scale: number): Promise<void>;
  renderThumbnail?(pageIndex: number, canvas: HTMLCanvasElement, maxWidthPx?: number): Promise<void>;
  destroy(): void;
};

export type DocumentFormat = 'pdf' | 'docx' | 'pptx';
