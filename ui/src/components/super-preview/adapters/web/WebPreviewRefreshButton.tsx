import { RefreshCw } from 'lucide-react';
import { PreviewChromeIconButton } from '../../PreviewChromeBar';
import type { WebPreviewControls } from './webPreviewControls';

export default function WebPreviewRefreshButton({ controls }: { controls: WebPreviewControls }) {
  return (
    <PreviewChromeIconButton
      title="刷新预览"
      aria-label="刷新预览"
      onClick={controls.refresh}
    >
      <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
    </PreviewChromeIconButton>
  );
}
