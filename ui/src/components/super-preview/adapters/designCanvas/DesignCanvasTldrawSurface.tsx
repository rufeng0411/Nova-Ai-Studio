// PD-SAAS-FORK: tldraw surface for design canvas (lazy-loaded)
import { lazy, Suspense } from 'react';
import type { Editor } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import './designCanvasChrome.css';
import { cn } from '../../../../lib/utils';

const TldrawLazy = lazy(async () => {
  const mod = await import('@tldraw/tldraw');
  return { default: mod.Tldraw };
});

type DesignCanvasTldrawSurfaceProps = {
  onEditorMount: (editor: Editor) => void;
  onUserChange: (editor: Editor) => void;
  className?: string;
  /** When true, tldraw ignores pointer so mask brush overlay receives strokes. */
  maskBrushActive?: boolean;
};

export default function DesignCanvasTldrawSurface({
  onEditorMount,
  onUserChange,
  className,
  maskBrushActive = false,
}: DesignCanvasTldrawSurfaceProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center bg-muted">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      }
    >
      <div
        className={cn(className ?? 'h-full w-full', maskBrushActive && 'pointer-events-none')}
        data-testid="design-canvas-tldraw-root"
      >
        <TldrawLazy
          inferDarkMode
          onMount={(editor) => {
            onEditorMount(editor);
            editor.store.listen(
              () => onUserChange(editor),
              { source: 'user', scope: 'document' },
            );
          }}
        />
      </div>
    </Suspense>
  );
}
