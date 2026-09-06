import { cn } from '../../../../lib/utils';
import { useWebPreviewControls } from './webPreviewControls';
import WebPreviewToolbar from './WebPreviewToolbar';

type WebPreviewFrameProps = {
  src: string;
  title: string;
  className?: string;
  sandbox?: string;
};

export function WebPreviewFrame({
  src,
  title,
  className,
  sandbox = 'allow-scripts allow-same-origin allow-popups',
}: WebPreviewFrameProps) {
  if (!src) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border border-dashed border-border bg-sidebar text-xs text-muted-foreground',
          className,
        )}
      >
        预览不可用
      </div>
    );
  }

  return (
    <iframe
      title={title}
      src={src}
      className={cn('border-0 bg-white', className)}
      sandbox={sandbox}
      loading="lazy"
    />
  );
}

type WebPreviewAdapterProps = {
  previewUrl: string;
  fileName: string;
  showToolbar?: boolean;
};

/** Standalone web preview (outside unified chrome). Prefer WebPreviewEmbedded in SuperPreview. */
export default function WebPreviewAdapter({
  previewUrl,
  fileName,
  showToolbar = true,
}: WebPreviewAdapterProps) {
  const controls = useWebPreviewControls(previewUrl);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {showToolbar ? (
        <div className="flex h-9 shrink-0 items-center justify-end border-b border-border px-2">
          <WebPreviewToolbar controls={controls} />
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto bg-sidebar p-3">
        <div
          className={cn(
            'mx-auto h-full overflow-hidden rounded-lg border border-border bg-white shadow-sm',
            controls.deviceClassName,
          )}
        >
          <WebPreviewFrame src={controls.src} title={fileName} className="h-full w-full" />
        </div>
      </div>
    </div>
  );
}

export { useWebPreviewControls } from './webPreviewControls';
