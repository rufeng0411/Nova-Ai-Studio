import { useEffect, type ReactNode } from 'react';
import { cn } from '../../../../lib/utils';
import { normalizeArtifactPath } from '../../../../shared/artifactPaths';
import { subscribeHtmlDeliverableUpdated } from '../../../../shared/htmlStudioBridge';
import { WebPreviewFrame } from './WebPreviewAdapter';
import { useWebPreviewControls } from './webPreviewControls';
import WebPreviewToolbar from './WebPreviewToolbar';
import WebPreviewRefreshButton from './WebPreviewRefreshButton';

type WebPreviewEmbeddedProps = {
  previewUrl: string;
  fileName: string;
  apiPath?: string;
  onRegisterToolbar: (toolbar: ReactNode | null) => void;
  onRegisterRefresh?: (refresh: ReactNode | null) => void;
};

export default function WebPreviewEmbedded({
  previewUrl,
  fileName,
  apiPath,
  onRegisterToolbar,
  onRegisterRefresh,
}: WebPreviewEmbeddedProps) {
  const controls = useWebPreviewControls(previewUrl);

  useEffect(() => {
    if (!apiPath) return undefined;
    const normalized = normalizeArtifactPath(apiPath);
    return subscribeHtmlDeliverableUpdated((detail) => {
      if (normalizeArtifactPath(detail.htmlPath) === normalized) {
        controls.refresh();
      }
    });
  }, [apiPath, controls.refresh]);

  useEffect(() => {
    onRegisterToolbar(<WebPreviewToolbar controls={controls} />);
    return () => onRegisterToolbar(null);
  }, [controls.deviceId, onRegisterToolbar]);

  useEffect(() => {
    if (!onRegisterRefresh) return undefined;
    onRegisterRefresh(<WebPreviewRefreshButton controls={controls} />);
    return () => onRegisterRefresh(null);
  }, [onRegisterRefresh]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
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
