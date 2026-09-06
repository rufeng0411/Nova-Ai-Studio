// PD-SAAS-FORK: Preflight in Super Preview split column (not folder rail)
import { lazy, Suspense, useEffect, useRef } from 'react';
import type { MouseEvent, MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { PreflightConfirmPayload } from '../../../shared/preflightSelection';
import type { PreflightOpenRequest } from '../../../shared/preflightStudioBridge';
import { shouldEditorSidebarFlexFill } from '../../code-editor/view/editorSidebarLayout';

const PreflightStudioAdapter = lazy(
  () => import('../../super-preview/adapters/preflightStudio'),
);

const MIN_EDITOR_WIDTH = 280;

type PreflightPreviewPanelProps = {
  request: PreflightOpenRequest;
  panelWidth: number;
  hasManualWidth: boolean;
  resizeHandleRef: MutableRefObject<HTMLDivElement | null>;
  onResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
  onClose: () => void;
  onConfirmed: (payload: PreflightConfirmPayload) => void;
  fillSpace?: boolean;
};

function PreflightLoading() {
  return (
    <div className="flex h-full items-center justify-center bg-card">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}

export default function PreflightPreviewPanel({
  request,
  panelWidth,
  hasManualWidth,
  resizeHandleRef,
  onResizeStart,
  onClose,
  onConfirmed,
  fillSpace = true,
}: PreflightPreviewPanelProps) {
  const { t } = useTranslation('chat');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [request.slug]);

  const useFlexFill = shouldEditorSidebarFlexFill({
    fillSpace: Boolean(fillSpace),
    editorExpanded: false,
    hasManualWidth,
    workspaceDrawerOpen: false,
  });

  const widthStyle = useFlexFill
    ? { minWidth: `${MIN_EDITOR_WIDTH}px` }
    : {
      width: `${Math.max(panelWidth, MIN_EDITOR_WIDTH)}px`,
      minWidth: `${MIN_EDITOR_WIDTH}px`,
      maxWidth: `${Math.max(panelWidth, MIN_EDITOR_WIDTH)}px`,
    };

  return (
    <div
      ref={containerRef}
      className="flex h-full min-w-0 flex-1 basis-0"
      style={widthStyle}
      data-testid="preflight-preview-panel"
    >
      <div
        ref={resizeHandleRef}
        onMouseDown={onResizeStart}
        className="group relative z-10 w-px flex-shrink-0 cursor-col-resize bg-border transition-colors hover:bg-muted-foreground/50"
        title={t('resize.dragToResizePanel', { defaultValue: '拖动调整宽度' })}
      >
        <div className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2" />
      </div>
      <div className="h-full min-w-0 flex-1 overflow-hidden border-l border-border bg-card">
        <Suspense fallback={<PreflightLoading />}>
          <PreflightStudioAdapter
            slug={request.slug}
            displayName={request.displayName}
            sessionId={request.sessionId}
            slotId={request.slotId}
            fallbackPrompt={request.fallbackPrompt}
            onClose={onClose}
            onConfirmed={onConfirmed}
          />
        </Suspense>
      </div>
    </div>
  );
}
