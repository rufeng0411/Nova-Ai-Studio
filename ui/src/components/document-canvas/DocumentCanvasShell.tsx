// PD-SAAS-FORK: unified document preview chrome
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import DocumentCanvasToolbar from './DocumentCanvasToolbar';
import DocumentPageRail, { type DocumentRailMode } from './DocumentPageRail';
import { useDocumentPages } from './hooks/useDocumentPages';
import type { DocumentAdapter, DocumentCanvasVariant, PageDimensions, ZoomMode } from './types';
import { usePreviewSession } from '../../shared/previewSessionStore';

const PAGE_HOST_MAX_WIDTH = 1152;
const VIEWPORT_PADDING_PX = 32;

export type DocumentCanvasShellProps = {
  adapter: DocumentAdapter;
  variant?: DocumentCanvasVariant;
  largeFileHint?: boolean;
  /** Same URL as「新标签」— used when canvas render fails (overlay layout churn, etc.). */
  fallbackPreviewUrl?: string;
  toolbarTrailing?: ReactNode;
  toolbarPinnedTrailing?: ReactNode;
  toolbarTitle?: string;
  previewSessionKey?: string;
};

function isRenderCancelledError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = (error as { name?: string }).name;
  return name === 'RenderingCancelledException' || name === 'AbortException';
}

function resolveScale(
  zoomMode: ZoomMode,
  container: HTMLElement,
  page: PageDimensions,
): number {
  if (zoomMode === '100') return 1;
  if (zoomMode === '125') return 1.25;
  if (zoomMode === '150') return 1.5;
  const width = Math.max(Math.min((container.clientWidth || 800) - VIEWPORT_PADDING_PX, PAGE_HOST_MAX_WIDTH), 320);
  const height = Math.max((container.clientHeight || 600) - VIEWPORT_PADDING_PX, 240);
  const refW = Math.max(page.width, 1);
  const refH = Math.max(page.height, 1);
  if (zoomMode === 'fitWidth') return Math.max(Math.min(width / refW, 3), 0.25);
  return Math.min(width / refW, height / refH, 2);
}

async function waitForReadyViewport(viewport: HTMLElement): Promise<boolean> {
  if (viewport.clientWidth > 0 && viewport.clientHeight > 0) return true;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (viewport.clientWidth > 0 && viewport.clientHeight > 0) return true;
  }
  return false;
}

export default function DocumentCanvasShell({
  adapter,
  variant = 'overlay',
  largeFileHint = false,
  fallbackPreviewUrl = '',
  toolbarTrailing,
  toolbarPinnedTrailing,
  toolbarTitle,
  previewSessionKey,
}: DocumentCanvasShellProps) {
  const { t } = useTranslation('common');
  const viewportRef = useRef<HTMLDivElement>(null);
  const pageHostRef = useRef<HTMLDivElement>(null);
  const { state: previewSession, update: updatePreviewSession } = usePreviewSession(previewSessionKey);
  const [zoomMode, setZoomMode] = useState<ZoomMode>(previewSession.zoomMode);
  const [railMode, setRailMode] = useState<DocumentRailMode>(previewSession.railMode);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState(false);

  const pageCount = adapter.pageCount;
  const handlePageChange = useCallback((nextPageIndex: number) => {
    updatePreviewSession({ pageIndex: nextPageIndex });
  }, [updatePreviewSession]);
  const {
    pageIndex,
    goNext,
    goPrev,
    canGoNext,
    canGoPrev,
    goToPage,
  } = useDocumentPages({
    pageCount,
    initialPageIndex: previewSession.pageIndex,
    onPageChange: handlePageChange,
    enableKeyboard: true,
  });

  useEffect(() => {
    setZoomMode(previewSession.zoomMode);
    setRailMode(previewSession.railMode);
  }, [previewSession.railMode, previewSession.zoomMode]);

  const handleZoomChange = useCallback((nextZoomMode: ZoomMode) => {
    setZoomMode(nextZoomMode);
    updatePreviewSession({ zoomMode: nextZoomMode });
  }, [updatePreviewSession]);

  const handleRailModeChange = useCallback((nextRailMode: DocumentRailMode) => {
    setRailMode(nextRailMode);
    updatePreviewSession({ railMode: nextRailMode });
  }, [updatePreviewSession]);

  const renderCurrentPage = useCallback(async () => {
    const host = pageHostRef.current;
    const viewport = viewportRef.current;
    if (!host || !viewport || pageCount <= 0) return;
    setRendering(true);
    setRenderError(false);
    try {
      const viewportReady = await waitForReadyViewport(viewport);
      if (!viewportReady) return;
      const scale = resolveScale(zoomMode, viewport, adapter.getPageDimensions(pageIndex));
      await adapter.renderPage(pageIndex, host, scale);
      setRenderError(false);
    } catch (error) {
      if (!isRenderCancelledError(error)) {
        setRenderError(true);
      }
    } finally {
      setRendering(false);
    }
  }, [adapter, pageCount, pageIndex, zoomMode]);

  useLayoutEffect(() => {
    void renderCurrentPage();
  }, [renderCurrentPage]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const observer = new ResizeObserver(() => {
      void renderCurrentPage();
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [renderCurrentPage]);

  useEffect(() => {
    if (pageCount > 0) goToPage(previewSession.pageIndex);
  }, [adapter, goToPage, pageCount, previewSession.pageIndex]);

  return (
    <div
      data-testid="document-canvas"
      data-document-canvas-variant={variant}
      className="flex h-full w-full min-h-0 flex-col overflow-hidden bg-muted"
    >
      <DocumentCanvasToolbar
        pageIndex={pageIndex}
        pageCount={pageCount}
        zoomMode={zoomMode}
        railMode={railMode}
        showRailToggle={pageCount > 0}
        onPrev={goPrev}
        onNext={goNext}
        onZoomChange={handleZoomChange}
        onRailModeChange={handleRailModeChange}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        toolbarTrailing={toolbarTrailing}
        toolbarPinnedTrailing={toolbarPinnedTrailing}
        toolbarTitle={toolbarTitle}
      />

      {largeFileHint ? (
        <div className="shrink-0 px-3 py-1.5 text-center text-[11px] text-muted-foreground">
          {t('documentCanvas.largeFileHint', { defaultValue: '文件较大，预览可能需要几秒' })}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {pageCount > 0 ? (
          <DocumentPageRail
            adapter={adapter}
            pageCount={pageCount}
            pageIndex={pageIndex}
            railMode={railMode}
            onSelectPage={goToPage}
          />
        ) : null}

        <div
          ref={viewportRef}
          data-testid="document-canvas-viewport"
          className="relative min-h-0 min-w-0 flex-1 overflow-auto p-4"
        >
        {renderError && fallbackPreviewUrl ? (
          <iframe
            title="document-preview-fallback"
            src={fallbackPreviewUrl}
            className="absolute inset-0 h-full w-full border-0 bg-white"
          />
        ) : null}
        {rendering && !(renderError && fallbackPreviewUrl) ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-muted/40">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        ) : null}
        {renderError && !fallbackPreviewUrl ? (
          <div className="absolute inset-0 z-[1] flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {t('documentCanvas.loadFailed', { defaultValue: '预览加载失败，请下载后查看。' })}
          </div>
        ) : null}
        {/* Keep host mounted so ResizeObserver retries after overlay layout settles. */}
        <div
          ref={pageHostRef}
          className={`mx-auto flex w-max max-w-none items-start justify-center ${
            renderError && fallbackPreviewUrl ? 'invisible h-0 overflow-hidden' : ''
          }`}
        />
        </div>
      </div>
    </div>
  );
}
