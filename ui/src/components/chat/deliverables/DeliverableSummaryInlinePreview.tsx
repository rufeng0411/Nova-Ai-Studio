// PD-SAAS-FORK: compact inline preview for deliverable summary table rows
import React, { useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import type { Project } from '../../../types/app';
import type { DeliverableItem } from '../../../shared/collectDeliverables';
import { getArtifactFileName, isImageArtifactPath } from '../../../shared/artifactPaths';
import { resolvePreviewKind } from '../../../shared/projectPreviewCapabilities';
import { resolveProjectInlineMediaUrl } from '../../../shared/projectInlineMediaUrl';
import ProgressiveProjectImage from '../../shared/ProgressiveProjectImage';

type DeliverableSummaryInlinePreviewProps = {
  item: DeliverableItem;
  selectedProject?: Project | null;
  onActivate: () => void;
  ariaLabel: string;
};

export function DeliverableSummaryInlinePreview({
  item,
  selectedProject,
  onActivate,
  ariaLabel,
}: DeliverableSummaryInlinePreviewProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [htmlFailed, setHtmlFailed] = useState(false);
  const projectRoot = selectedProject?.fullPath || selectedProject?.path || '';
  const apiPath = item.resolvedPath || item.apiPath || item.path;
  const fileName = getArtifactFileName(apiPath) || apiPath;
  const resolvedKind = resolvePreviewKind(fileName, item.kind);
  const isImage = resolvedKind === 'image' || isImageArtifactPath(apiPath);
  const isVideo = resolvedKind === 'video';
  const isHtml = resolvedKind === 'html' || /\.html?$/i.test(fileName);

  const previewUrl = useMemo(() => {
    if (!selectedProject?.name || !apiPath) return '';
    return resolveProjectInlineMediaUrl(selectedProject.name, apiPath, fileName, projectRoot, resolvedKind);
  }, [apiPath, fileName, projectRoot, resolvedKind, selectedProject?.name]);

  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label={ariaLabel}
      className="group relative h-11 w-[4.25rem] shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid="deliverable-summary-inline-preview"
    >
      {isHtml && previewUrl && !htmlFailed ? (
        <iframe
          title={fileName}
          src={previewUrl}
          sandbox="allow-scripts allow-same-origin"
          className="pointer-events-none h-full w-full scale-[0.35] origin-top-left"
          style={{ width: '285%', height: '285%' }}
          onError={() => setHtmlFailed(true)}
        />
      ) : isImage && previewUrl && !imageFailed ? (
        <ProgressiveProjectImage
          projectName={selectedProject?.name}
          projectRoot={projectRoot}
          filePath={apiPath}
          fullMode="content"
          alt={fileName}
          className="h-full w-full"
          imageClassName="h-full w-full object-cover transition group-hover:scale-[1.03]"
          thumbnailMax={120}
          preloadFull={false}
          onError={() => setImageFailed(true)}
        />
      ) : isVideo && previewUrl ? (
        <video
          src={previewUrl}
          preload="metadata"
          muted
          playsInline
          className="h-full w-full bg-black object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-muted text-[10px] text-muted-foreground">
          {isHtml ? 'HTML' : isVideo ? '视频' : '图片'}
        </span>
      )}
      {isVideo ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-primary-foreground">
            <Play className="h-3 w-3" />
          </span>
        </span>
      ) : null}
    </button>
  );
}

export default DeliverableSummaryInlinePreview;
