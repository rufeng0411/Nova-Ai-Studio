import { Download, Maximize2, Moon, Sun, ZoomIn, ZoomOut } from 'lucide-react';
import type { ImagePreviewControls } from './useImagePreviewControls';
import { PreviewChromeGroup, PreviewChromeIconButton } from '../../PreviewChromeBar';

type ImagePreviewToolbarProps = {
  controls: ImagePreviewControls;
};

export default function ImagePreviewToolbar({ controls }: ImagePreviewToolbarProps) {
  return (
    <PreviewChromeGroup aria-label="图片预览">
      <PreviewChromeIconButton
        title={controls.darkBackground ? '切换浅色背景' : '切换深色背景'}
        aria-label={controls.darkBackground ? '切换浅色背景' : '切换深色背景'}
        onClick={controls.toggleBackground}
      >
        {controls.darkBackground ? <Sun className="h-3.5 w-3.5" strokeWidth={1.75} /> : <Moon className="h-3.5 w-3.5" strokeWidth={1.75} />}
      </PreviewChromeIconButton>
      <PreviewChromeIconButton title="缩小" aria-label="缩小" onClick={controls.zoomOut}>
        <ZoomOut className="h-3.5 w-3.5" strokeWidth={1.75} />
      </PreviewChromeIconButton>
      <span className="min-w-[2.75rem] px-1 text-center text-[11px] tabular-nums text-muted-foreground">
        {controls.scaleLabel}
      </span>
      <PreviewChromeIconButton title="放大" aria-label="放大" onClick={controls.zoomIn}>
        <ZoomIn className="h-3.5 w-3.5" strokeWidth={1.75} />
      </PreviewChromeIconButton>
      <PreviewChromeIconButton title="适应窗口" aria-label="适应窗口" onClick={controls.resetView}>
        <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.75} />
      </PreviewChromeIconButton>
      <PreviewChromeIconButton title="另存为" aria-label="另存为" onClick={() => void controls.saveImage()}>
        <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
      </PreviewChromeIconButton>
    </PreviewChromeGroup>
  );
}
