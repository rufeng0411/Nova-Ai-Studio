// PD-SAAS-FORK: left page rail with strip / grid thumbnails
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import type { DocumentAdapter } from './types';

export type DocumentRailMode = 'strip' | 'grid';

export type DocumentPageRailProps = {
  adapter: DocumentAdapter;
  pageCount: number;
  pageIndex: number;
  railMode: DocumentRailMode;
  onSelectPage: (pageIndex: number) => void;
};

type ThumbnailSlotProps = {
  adapter: DocumentAdapter;
  pageIndex: number;
  selected: boolean;
  railMode: DocumentRailMode;
  onSelect: () => void;
};

function ThumbnailSlot({
  adapter,
  pageIndex,
  selected,
  railMode,
  onSelect,
}: ThumbnailSlotProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const renderTargetRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const usesCanvas = typeof adapter.renderThumbnail === 'function';
  const frameStyle = useMemo<CSSProperties>(() => {
    const dimensions = adapter.getPageDimensions(pageIndex);
    const width = Math.max(dimensions.width, 1);
    const height = Math.max(dimensions.height, 1);
    return { aspectRatio: `${width} / ${height}` };
  }, [adapter, pageIndex]);

  useEffect(() => {
    let cancelled = false;
    const renderTarget = renderTargetRef.current;
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    const fallbackWidth = railMode === 'grid' ? 140 : 108;

    const resolveThumbnailScale = (frameWidth: number, frameHeight: number): number => {
      const dimensions = adapter.getPageDimensions(pageIndex);
      const pageWidth = Math.max(dimensions.width, 1);
      const pageHeight = Math.max(dimensions.height, 1);
      const pad = 6;
      const availableWidth = Math.max(frameWidth - pad, 48);
      const availableHeight = Math.max(
        frameHeight > 16 ? frameHeight - pad : availableWidth * (pageHeight / pageWidth),
        48,
      );
      const scaleByWidth = availableWidth / pageWidth;
      const scaleByHeight = availableHeight / pageHeight;
      return Math.max(Math.min(scaleByWidth, scaleByHeight), 0.05);
    };

    const load = async (frameWidth: number, frameHeight: number) => {
      setLoading(true);
      setFailed(false);
      try {
        if (usesCanvas && canvas && adapter.renderThumbnail) {
          const maxWidthPx = Math.max(frameWidth - 6, 48);
          await adapter.renderThumbnail(pageIndex, canvas, maxWidthPx);
        } else if (renderTarget) {
          const scale = resolveThumbnailScale(frameWidth, frameHeight);
          await adapter.renderPage(pageIndex, renderTarget, scale);
        }
        if (!cancelled) setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const tryLoad = () => {
      if (frame && frame.clientWidth < 16) return false;
      const width = Math.max(frame.clientWidth, fallbackWidth);
      const dimensions = adapter.getPageDimensions(pageIndex);
      const ratio = dimensions.height / Math.max(dimensions.width, 1);
      const height = Math.max(frame.clientHeight, Math.round(width * ratio));
      void load(width, height);
      return true;
    };

    if (tryLoad()) {
      return () => {
        cancelled = true;
        renderTarget?.replaceChildren();
      };
    }

    if (typeof ResizeObserver === 'undefined') {
      void load(fallbackWidth, Math.round(fallbackWidth * 1.414));
      return () => {
        cancelled = true;
        renderTarget?.replaceChildren();
      };
    }

    const observer = new ResizeObserver(() => {
      if (cancelled || !tryLoad()) return;
      observer.disconnect();
    });
    if (frame) observer.observe(frame);

    return () => {
      cancelled = true;
      observer.disconnect();
      renderTarget?.replaceChildren();
    };
  }, [adapter, pageIndex, railMode, usesCanvas]);

  useEffect(() => {
    if (!selected) return;
    buttonRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected]);

  return (
    <button
      ref={buttonRef}
      type="button"
      data-testid={`document-canvas-thumb-${pageIndex}`}
      data-document-canvas-thumb-selected={selected ? 'true' : 'false'}
      onClick={onSelect}
      className={cn(
        'group relative w-full shrink-0 overflow-hidden rounded-lg border bg-card text-left transition hover:border-primary/50',
        selected ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border',
        railMode === 'grid' ? 'p-1' : 'p-1.5',
      )}
      aria-label={`第 ${pageIndex + 1} 页`}
      aria-current={selected ? 'page' : undefined}
    >
      <div
        ref={frameRef}
        data-testid={`document-canvas-thumb-frame-${pageIndex}`}
        style={frameStyle}
        className={cn(
          'relative mx-auto flex w-full shrink-0 items-center justify-center overflow-hidden rounded bg-white',
          railMode === 'grid' ? 'max-w-none' : 'max-w-[7.5rem]',
        )}
      >
        {usesCanvas ? (
          <canvas ref={canvasRef} className="block max-h-full max-w-full shrink-0 object-contain" />
        ) : (
          <div
            ref={renderTargetRef}
            data-testid={`document-canvas-thumb-render-target-${pageIndex}`}
            className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden p-0.5"
          />
        )}
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/60">
            <div className="h-3 w-3 animate-spin rounded-full border border-border border-t-primary" />
          </div>
        ) : null}
        {failed ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted text-[10px] text-muted-foreground">
            {pageIndex + 1}
          </div>
        ) : null}
      </div>
      <div className="mt-1 truncate px-0.5 text-center text-[10px] tabular-nums text-muted-foreground">
        {pageIndex + 1}
      </div>
    </button>
  );
}

export default function DocumentPageRail({
  adapter,
  pageCount,
  pageIndex,
  railMode,
  onSelectPage,
}: DocumentPageRailProps) {
  const { t } = useTranslation('common');
  if (pageCount <= 0) return null;

  return (
    <aside
      data-testid="document-canvas-page-rail"
      data-document-canvas-rail-mode={railMode}
      className={cn(
        'flex min-h-0 shrink-0 flex-col border-r border-border bg-muted/30',
        railMode === 'grid' ? 'w-[min(22rem,38vw)]' : 'w-[min(11rem,28vw)]',
      )}
      aria-label={t('documentCanvas.pageRail', { defaultValue: '页面导航' })}
    >
      <div
        className={cn(
          'min-h-0 flex-1 overflow-auto p-2',
          railMode === 'grid' ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2',
        )}
      >
        {Array.from({ length: pageCount }, (_, index) => (
          <ThumbnailSlot
            key={index}
            adapter={adapter}
            pageIndex={index}
            selected={index === pageIndex}
            railMode={railMode}
            onSelect={() => onSelectPage(index)}
          />
        ))}
      </div>
    </aside>
  );
}
