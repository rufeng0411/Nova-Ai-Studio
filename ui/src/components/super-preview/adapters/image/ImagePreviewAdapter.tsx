import { useEffect, type ReactNode } from 'react';
import { cn } from '../../../../lib/utils';
import ProgressiveProjectImage from '../../../shared/ProgressiveProjectImage';
import ImagePreviewToolbar from './ImagePreviewToolbar';
import { useImagePreviewControls } from './useImagePreviewControls';

type ImagePreviewAdapterProps = {
  previewUrl: string;
  fileName: string;
  projectName?: string;
  apiPath?: string;
  projectRoot?: string;
  /** Unified sidebar chrome owns the top row — register zoom/save controls there. */
  embedInChrome?: boolean;
  onRegisterToolbar?: (toolbar: ReactNode | null) => void;
};

export default function ImagePreviewAdapter({
  previewUrl,
  fileName,
  projectName,
  apiPath,
  projectRoot,
  embedInChrome = false,
  onRegisterToolbar,
}: ImagePreviewAdapterProps) {
  const controls = useImagePreviewControls({
    projectName,
    apiPath,
    fileName,
    previewUrl,
  });

  useEffect(() => {
    if (!onRegisterToolbar) return undefined;
    onRegisterToolbar(<ImagePreviewToolbar controls={controls} />);
    return () => onRegisterToolbar(null);
  }, [controls.scaleLabel, controls.darkBackground, onRegisterToolbar, controls]);

  const showInlineToolbar = !embedInChrome && !onRegisterToolbar;

  return (
    <div className={cn('flex h-full min-h-0 flex-col', controls.darkBackground ? 'bg-neutral-950' : 'bg-muted')}>
      {showInlineToolbar ? (
        <div className="flex h-9 shrink-0 items-center justify-end border-b border-border/50 px-2">
          <ImagePreviewToolbar controls={controls} />
        </div>
      ) : null}
      <div
        className={cn(
          'relative min-h-0 flex-1 overflow-hidden',
          controls.canPan ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
        )}
        onPointerDown={controls.onPointerDown}
        onPointerMove={controls.onPointerMove}
        onPointerUp={controls.onPointerUp}
        onPointerCancel={controls.onPointerUp}
        onWheel={controls.onWheel}
        onDoubleClick={controls.resetView}
      >
        <div className="flex h-full w-full items-center justify-center p-4">
          <div
            className="flex max-h-full max-w-full items-center justify-center transition-transform duration-75 will-change-transform"
            style={controls.transformStyle}
          >
            <ProgressiveProjectImage
              projectName={projectName}
              projectRoot={projectRoot}
              filePath={apiPath}
              fullSrc={previewUrl || undefined}
              fullMode="content"
              alt={fileName}
              className="max-h-full max-w-full bg-transparent"
              imageClassName="max-h-[calc(100vh-12rem)] max-w-full select-none object-contain"
              thumbnailMax={640}
              loading="eager"
              preloadFull
            />
          </div>
        </div>
      </div>
    </div>
  );
}
