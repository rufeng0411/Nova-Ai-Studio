// PD-SAAS-FORK: document canvas toolbar
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Grid3x3, LayoutList, ZoomIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import type { DocumentRailMode } from './DocumentPageRail';
import type { ZoomMode } from './types';
import { PreviewChromeDivider } from '../super-preview/PreviewChromeBar';

export type DocumentCanvasToolbarProps = {
  pageIndex: number;
  pageCount: number;
  zoomMode: ZoomMode;
  railMode: DocumentRailMode;
  showRailToggle: boolean;
  onPrev: () => void;
  onNext: () => void;
  onZoomChange: (mode: ZoomMode) => void;
  onRailModeChange: (mode: DocumentRailMode) => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  toolbarTrailing?: ReactNode;
  /** Always visible on the right — never scrolls away with toolbar overflow. */
  toolbarPinnedTrailing?: ReactNode;
  toolbarTitle?: string;
};

const ZOOM_MODES: ZoomMode[] = ['fitWidth', 'fitPage', '100', '125', '150'];

export default function DocumentCanvasToolbar({
  pageIndex,
  pageCount,
  zoomMode,
  railMode,
  showRailToggle,
  onPrev,
  onNext,
  onZoomChange,
  onRailModeChange,
  canGoPrev,
  canGoNext,
  toolbarTrailing,
  toolbarPinnedTrailing,
  toolbarTitle,
}: DocumentCanvasToolbarProps) {
  const { t } = useTranslation('common');
  const hasScrollRegion = Boolean(
    toolbarTitle || showRailToggle || pageCount > 0 || toolbarTrailing || toolbarPinnedTrailing,
  );

  return (
    <div className="flex h-9 w-full min-w-0 shrink-0 flex-nowrap items-stretch border-b border-border bg-card/95 backdrop-blur-sm">
      {hasScrollRegion ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {toolbarTitle ? (
            <span
              className="w-[min(28%,8.5rem)] shrink-0 truncate text-xs font-medium text-foreground"
              title={toolbarTitle}
            >
              {toolbarTitle}
            </span>
          ) : null}
          {toolbarTitle && (showRailToggle || pageCount > 0) ? <PreviewChromeDivider /> : null}
          {showRailToggle ? (
            <div
              className="flex shrink-0 items-center rounded-md border border-border bg-background p-0.5"
              role="group"
              aria-label={t('documentCanvas.railView', { defaultValue: '缩略图视图' })}
            >
              <button
                type="button"
                data-testid="document-canvas-rail-strip"
                onClick={() => onRailModeChange('strip')}
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm transition-colors ${
                  railMode === 'strip'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
                aria-label={t('documentCanvas.railStrip', { defaultValue: '列表缩略图' })}
                aria-pressed={railMode === 'strip' ? 'true' : 'false'}
              >
                <LayoutList className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                data-testid="document-canvas-rail-grid"
                onClick={() => onRailModeChange('grid')}
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm transition-colors ${
                  railMode === 'grid'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
                aria-label={t('documentCanvas.railGrid', { defaultValue: '网格缩略图' })}
                aria-pressed={railMode === 'grid' ? 'true' : 'false'}
              >
                <Grid3x3 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
          <div className="flex shrink-0 flex-nowrap items-center gap-0.5">
            <button
              type="button"
              data-testid="document-canvas-prev"
              onClick={onPrev}
              disabled={!canGoPrev}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
              aria-label={t('documentCanvas.prev', { defaultValue: '上一页' })}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span
              data-testid="document-canvas-page-indicator"
              className="min-w-[3.25rem] shrink-0 text-center text-xs tabular-nums text-foreground"
            >
              {pageCount > 0 ? `${pageIndex + 1} / ${pageCount}` : '—'}
            </span>
            <button
              type="button"
              data-testid="document-canvas-next"
              onClick={onNext}
              disabled={!canGoNext}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
              aria-label={t('documentCanvas.next', { defaultValue: '下一页' })}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <span className="min-w-2 flex-1 shrink" aria-hidden />

          <div className="flex shrink-0 flex-nowrap items-center gap-1">
            <ZoomIn className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <select
              data-testid="document-canvas-zoom"
              value={zoomMode}
              onChange={(event) => onZoomChange(event.target.value as ZoomMode)}
              className="h-7 w-[6.25rem] shrink-0 rounded-md border border-border bg-background px-1.5 text-xs text-foreground"
              aria-label={t('documentCanvas.zoom', { defaultValue: '缩放' })}
            >
              {ZOOM_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {t(`documentCanvas.zoomModes.${mode}`, {
                    defaultValue: mode === 'fitWidth' ? '适应宽度' : mode === 'fitPage' ? '适应页面' : `${mode}%`,
                  })}
                </option>
              ))}
            </select>
          </div>

          {toolbarTrailing ? (
            <>
              <PreviewChromeDivider />
              <div className="flex shrink-0 flex-nowrap items-center gap-0.5">{toolbarTrailing}</div>
            </>
          ) : null}
        </div>
      ) : null}
      {toolbarPinnedTrailing ? (
        <div
          className={cn(
            'flex shrink-0 items-center bg-card/95 px-1.5',
            hasScrollRegion && 'border-l border-border/80',
          )}
          data-testid="document-canvas-pinned-trailing"
        >
          {toolbarPinnedTrailing}
        </div>
      ) : null}
    </div>
  );
}
