import React, { useMemo, useState } from 'react';
import {
 ExternalLink,
 Maximize2,
 Play,
} from 'lucide-react';
import type { Project } from '../../../types/app';
import type { DeliverableItem } from '../../../shared/collectDeliverables';
import { getArtifactFileName, isImageArtifactPath, type DeliverableKind } from '../../../shared/artifactPaths';
import { resolvePreviewKind } from '../../../shared/projectPreviewCapabilities';
import { resolveProjectInlineMediaUrl } from '../../../shared/projectInlineMediaUrl';
import ProgressiveProjectImage from '../../shared/ProgressiveProjectImage';
import { resolveDeliverableFileIcon } from '../../../shared/deliverableFileIcon';
import { isAudioFile } from '../../code-editor/utils/binaryFile';

function kindLabel(kind: DeliverableKind, fileName = ''): string {
 if (isAudioFile(fileName)) return '音频';
 switch (kind) {
 case 'html':
 return '网页';
 case 'image':
 return '图片';
 case 'video':
 return '视频';
 case 'pdf':
 return 'PDF';
 case 'document':
 return '文档';
 case 'spreadsheet':
 return '表格';
 case 'presentation':
 return 'PPT';
 case 'archive':
 return '压缩包';
 case 'code':
 return '代码';
 case 'url':
 return '链接';
 default:
 return '文件';
 }
}

export type DeliverableThumbVisualProps = {
 item: DeliverableItem;
 selectedProject?: Project | null;
 /** When false, HTML/video render an icon tile instead of a live frame (perf). */
 allowFrame?: boolean;
 badge?: string;
 /** Inline chat strip uses fixed small tiles; overlay/modal uses default. */
 size?: 'default' | 'compact';
};

/** Presentational thumbnail surface (no interactivity). */
export function DeliverableThumbVisual({
 item,
 selectedProject,
 allowFrame = true,
 badge,
 size = 'default',
}: DeliverableThumbVisualProps) {
 const compact = size === 'compact';
 const [imageFailed, setImageFailed] = useState(false);
 const projectRoot = selectedProject?.fullPath || selectedProject?.path || '';
 const apiPath = item.apiPath || item.path;
 const fileName = item.kind === 'url' ? item.path.replace(/^https?:\/\//i, '') : getArtifactFileName(apiPath);
 const { Icon, colorClass: iconColorClass } = useMemo(
 () => resolveDeliverableFileIcon(fileName, item.kind),
 [fileName, item.kind],
 );

 const resolvedKind = resolvePreviewKind(fileName, item.kind);
 const isImage = resolvedKind === 'image' || isImageArtifactPath(apiPath);

 const previewUrl = useMemo(() => {
 if (item.kind === 'url') return '';
 if (!selectedProject?.name || !apiPath) return '';
 return resolveProjectInlineMediaUrl(selectedProject.name, apiPath, fileName, projectRoot, resolvedKind);
 }, [apiPath, fileName, item.kind, projectRoot, resolvedKind, selectedProject?.name]);

 const thumbMax = compact ? 163 : 240;

 const renderSurface = () => {
 if (isImage && previewUrl && !imageFailed) {
 return (
 <ProgressiveProjectImage
 projectName={selectedProject?.name}
 projectRoot={projectRoot}
 filePath={apiPath}
 fullMode="content"
 alt={fileName}
 className="h-full w-full"
 imageClassName="h-full w-full object-cover"
 thumbnailMax={thumbMax}
 preloadFull={false}
 onError={() => setImageFailed(true)}
 />
 );
 }
 if (item.kind === 'html' && previewUrl && allowFrame) {
 return (
 <div className="pointer-events-none absolute inset-0 overflow-hidden">
 <iframe
 title={`thumb-${fileName}`}
 src={previewUrl}
 loading="lazy"
 sandbox="allow-scripts allow-same-origin"
 className="absolute left-0 top-0 h-[200%] w-[200%] origin-top-left scale-50 border-0 bg-card"
 />
 </div>
 );
 }
 if (item.kind === 'video' && previewUrl && allowFrame) {
 return <video src={previewUrl} preload="metadata" muted className="h-full w-full bg-black object-cover" />;
 }
 return (
 <div className={`flex h-full w-full flex-col items-center justify-center bg-muted text-center ${compact ? 'gap-1 px-1.5 py-1.5' : 'gap-1.5 px-2'}`}>
 <Icon
 className={compact ? `h-9 w-9 ${iconColorClass}` : `h-6 w-6 ${iconColorClass}`}
 strokeWidth={compact ? 1.65 : 2}
 />
 {!compact ? (
 <span className="line-clamp-2 break-all text-[10px] leading-tight text-muted-foreground">
 {fileName}
 </span>
 ) : null}
 </div>
 );
 };

 const overlayLabel = item.kind === 'url' ? <ExternalLink className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />;

 if (compact) {
 return (
 <div className="w-full">
 <div className="aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-card p-1.5 shadow-sm transition group-hover:shadow-md">
 <div className="relative h-full w-full overflow-hidden rounded-[0.45rem] bg-muted/90">
 {renderSurface()}
 {item.kind === 'video' || isAudioFile(fileName) ? (
 <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
 <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-primary-foreground">
 <Play className="h-3.5 w-3.5" />
 </span>
 </span>
 ) : null}
 <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[9px] font-medium text-primary-foreground">
 {badge || kindLabel(item.kind, fileName)}
 </span>
 </div>
 </div>
 <p className="mt-1 line-clamp-2 break-all px-0.5 text-[10px] leading-snug text-foreground/85" title={fileName}>
 {fileName}
 </p>
 </div>
 );
 }

 return (
 <div className="group relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-card shadow-sm transition group-hover:shadow-md">
 {renderSurface()}
 {item.kind === 'video' || isAudioFile(fileName) ? (
 <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
 <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-primary-foreground">
 <Play className="h-4 w-4" />
 </span>
 </span>
 ) : null}
 <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
 {badge || kindLabel(item.kind, fileName)}
 </span>
 <span className="pointer-events-none absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-primary-foreground opacity-0 transition group-hover:opacity-100">
 {overlayLabel}
 </span>
 <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 py-1 text-[10px] text-primary-foreground/90">
 {fileName}
 </span>
 </div>
 );
}

export type DeliverableThumbProps = DeliverableThumbVisualProps & {
 onActivate: () => void;
};

export function DeliverableThumb({ onActivate, ...visual }: DeliverableThumbProps) {
 return (
 <button
 type="button"
 onClick={onActivate}
 data-testid="deliverable-thumb"
 className={`block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${visual.size === 'compact' ? 'rounded-lg' : 'rounded-lg'}`}
 title={getArtifactFileName(visual.item.apiPath || visual.item.path)}
 >
 <DeliverableThumbVisual {...visual} />
 </button>
 );
}

export default DeliverableThumb;
