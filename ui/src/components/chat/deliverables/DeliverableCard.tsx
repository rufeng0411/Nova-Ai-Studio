// PD-SAAS-FORK: deliverable card opens overlay for md/pdf/media with unified actions
import React, { useCallback, useMemo, useState } from 'react';
import {
 Archive,
 Download,
 ExternalLink,
 FileCode2,
 FileSpreadsheet,
 FileText,
 FileType2,
 FolderOpen,
 Globe,
 Image as ImageIcon,
 PanelRight,
 Play,
 Presentation,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Project } from '../../../types/app';
import type { DeliverableItem } from '../../../shared/collectDeliverables';
import {
 classifyDeliverablePath,
 getArtifactDirectory,
 getArtifactFileName,
 isHtmlArtifactPath,
 isImageArtifactPath,
 isVideoArtifactPath,
 normalizeArtifactPath,
 toProjectApiPath,
 type DeliverableKind,
} from '../../../shared/artifactPaths';
import { resolveProjectInlineMediaUrl } from '../../../shared/projectInlineMediaUrl';
import { api } from '../../../utils/api';
import {
  supportsBrowserNewTabForFile,
  supportsOverlayPreview,
  supportsUnifiedFilePreview,
} from '../../../shared/projectPreviewCapabilities';
import DesignHtmlPreview from '../view/subcomponents/DesignHtmlPreview';
import DeliverablePreviewOverlay from './DeliverablePreviewOverlay';

export type DeliverableCardProps = {
 path: string;
 apiPath?: string;
 kind?: DeliverableKind;
 selectedProject?: Project | null;
 onFileOpen?: (filePath: string) => void;
 title?: string;
 compact?: boolean;
 showInlineHtmlPreview?: boolean;
 showInlineImagePreview?: boolean;
 className?: string;
};

function kindIcon(kind: DeliverableKind) {
 switch (kind) {
 case 'html':
 return FileCode2;
 case 'image':
 return ImageIcon;
 case 'video':
 return Play;
 case 'pdf':
 return FileType2;
 case 'document':
 return FileText;
 case 'spreadsheet':
 return FileSpreadsheet;
 case 'presentation':
 return Presentation;
 case 'archive':
 return Archive;
 case 'code':
 return FileCode2;
 case 'url':
 return Globe;
 default:
 return FileText;
 }
}

export function DeliverableCard({
 path,
 apiPath: apiPathProp,
 kind: kindProp,
 selectedProject,
 onFileOpen,
 title,
 compact = false,
 showInlineHtmlPreview = true,
 showInlineImagePreview = true,
 className = '',
}: DeliverableCardProps) {
 const { t } = useTranslation('chat');
 const [revealing, setRevealing] = useState(false);
 const [revealError, setRevealError] = useState<string | null>(null);
 const [imagePreviewFailed, setImagePreviewFailed] = useState(false);
 const [overlayOpen, setOverlayOpen] = useState(false);

 const projectRoot = selectedProject?.fullPath || selectedProject?.path || '';
 const displayPath = normalizeArtifactPath(path);
 const kind = kindProp || classifyDeliverablePath(displayPath);
 const apiPath = useMemo(
 () => apiPathProp || toProjectApiPath(displayPath, projectRoot),
 [apiPathProp, displayPath, projectRoot],
 );

 if (!displayPath) return null;

 const fileName = kind === 'url' ? displayPath.replace(/^https?:\/\//i, '').slice(0, 48) : getArtifactFileName(displayPath);
 const folderPath = kind === 'url' ? '' : getArtifactDirectory(apiPath || displayPath) || '.';
 const Icon = kindIcon(kind);
 const isHtml = kind === 'html' || isHtmlArtifactPath(displayPath);
 const isImage = kind === 'image' || isImageArtifactPath(displayPath);
 const isVideo = kind === 'video' || isVideoArtifactPath(displayPath);
 const isExternal = kind === 'url';

 const previewUrl = useMemo(() => {
 if (!selectedProject?.name || !apiPath || isExternal) return '';
 return resolveProjectInlineMediaUrl(selectedProject.name, apiPath, fileName, projectRoot, kind);
 }, [apiPath, fileName, isExternal, kind, projectRoot, selectedProject?.name]);

 const downloadUrl = useMemo(() => {
 if (!selectedProject?.name || !apiPath || isExternal) return '';
 return api.fileDownloadUrl(selectedProject.name, apiPath, projectRoot);
 }, [apiPath, isExternal, projectRoot, selectedProject?.name]);

 const canOverlayPreview = !isExternal && supportsOverlayPreview(fileName, kind);
 const canNewTab = isExternal || supportsBrowserNewTabForFile(fileName, kind);

 const handleRevealFolder = useCallback(async () => {
 if (!selectedProject?.name) {
 setRevealError(t('deliverables.needProject', { defaultValue: '请先选择项目后再打开文件夹' }));
 return;
 }
 if (!apiPath) {
 setRevealError(t('deliverables.invalidPath', { defaultValue: '无法解析文件路径' }));
 return;
 }
 setRevealing(true);
 setRevealError(null);
 try {
 const response = await api.revealProjectPath(selectedProject.name, apiPath, 'folder');
 const data = await response.json();
 if (!response.ok || data.success === false) {
 throw new Error(data.error || t('deliverables.revealFailed', { defaultValue: '无法打开文件夹' }));
 }
 } catch (error) {
 setRevealError(error instanceof Error ? error.message : t('deliverables.revealFailed', { defaultValue: '无法打开文件夹' }));
 } finally {
 setRevealing(false);
 }
 }, [apiPath, selectedProject?.name, t]);

 const handleOpenPreviewTab = useCallback(() => {
 if (isExternal) {
 window.open(displayPath, '_blank', 'noopener');
 return;
 }
 if (!selectedProject?.name || !apiPath) return;
 const url = previewUrl || resolveProjectInlineMediaUrl(selectedProject.name, apiPath, fileName, projectRoot, kind);
 window.open(url, '_blank', 'noopener');
 }, [apiPath, displayPath, isExternal, previewUrl, projectRoot, selectedProject?.name]);

 const handleOpenFile = useCallback(() => {
 if (isExternal) {
 window.open(displayPath, '_blank', 'noopener');
 return;
 }
 if (!onFileOpen) return;
 onFileOpen(
 apiPath || displayPath,
 supportsUnifiedFilePreview(fileName, kind) ? { initialPreview: true } : undefined,
 );
 }, [apiPath, displayPath, fileName, isExternal, onFileOpen]);

 const overlayItem = useMemo<DeliverableItem>(
 () => ({
 id: `${kind}:${displayPath.toLowerCase()}`,
 path: displayPath,
 apiPath: apiPath || displayPath,
 kind,
 source: 'tool',
 }),
 [apiPath, displayPath, kind],
 );

 const handlePrimary = useCallback(() => {
 if (canOverlayPreview) {
 setOverlayOpen(true);
 return;
 }
 handleOpenFile();
 }, [canOverlayPreview, handleOpenFile]);

 const actionButtonClass =
 'inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-sidebar disabled:cursor-not-allowed disabled:opacity-50 ';

 const primaryButtonClass =
 'inline-flex max-w-full items-center gap-1 rounded-md border border-blue-200 bg-blue-50/80 px-2 py-1 font-mono text-[11px] text-info transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-900/60 dark:bg-blue-950/30 dark:hover:bg-blue-950/50';

 return (
 <div className={`space-y-2 ${className}`.trim()}>
 {title ? <div className="text-[11px] text-muted-foreground">{title}</div> : null}
 <div className={`flex flex-wrap items-center gap-2 ${compact ? 'gap-1.5' : ''}`}>
 <button
 type="button"
 onClick={handlePrimary}
 disabled={!isExternal && !onFileOpen && !canOverlayPreview}
 className={primaryButtonClass}
 title={displayPath}
 >
 <Icon className="h-3 w-3 shrink-0" />
 <span className="truncate">{fileName}</span>
 </button>
 {!isExternal && onFileOpen ? (
 <button type="button" onClick={handleOpenFile} className={actionButtonClass}>
 <PanelRight className="h-3 w-3" />
 {t('deliverables.openInPanel', { defaultValue: '在右栏打开' })}
 </button>
 ) : null}
 {!isExternal ? (
 <button
 type="button"
 onClick={() => void handleRevealFolder()}
 disabled={revealing || !selectedProject?.name || !apiPath}
 className={actionButtonClass}
 title={folderPath}
 >
 <FolderOpen className="h-3 w-3" />
 {revealing
 ? t('deliverables.openingFolder', { defaultValue: '正在打开…' })
 : t('deliverables.openFolder', { defaultValue: '打开文件夹' })}
 </button>
 ) : null}
 {canNewTab ? (
 <button
 type="button"
 onClick={handleOpenPreviewTab}
 disabled={!isExternal && (!selectedProject?.name || !apiPath)}
 className={actionButtonClass}
 >
 <ExternalLink className="h-3 w-3" />
 {isExternal
 ? t('deliverables.openLink', { defaultValue: '打开链接' })
 : t('deliverables.newTab', { defaultValue: '新标签' })}
 </button>
 ) : null}
 {downloadUrl ? (
 <a href={downloadUrl} download className={actionButtonClass}>
 <Download className="h-3 w-3" />
 {t('deliverables.download', { defaultValue: '下载' })}
 </a>
 ) : null}
 </div>
 {revealError ? (
 <div className="text-[11px] text-red-600 dark:text-red-400">{revealError}</div>
 ) : null}
 {!compact && isImage && showInlineImagePreview && previewUrl ? (
 imagePreviewFailed ? (
 <div className="text-[11px] text-muted-foreground">
 {t('deliverables.imagePreviewFailed', { defaultValue: '预览加载失败，请用「打开文件夹」查看文件。' })}
 </div>
 ) : (
 <button
 type="button"
 onClick={() => setOverlayOpen(true)}
 className="block max-w-full overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
 title={t('deliverables.enlargePreview', { defaultValue: '放大预览' })}
 >
 <img
 src={previewUrl}
 alt={fileName}
 className="block h-auto max-h-56 w-full max-w-full cursor-zoom-in object-contain"
 loading="lazy"
 onError={() => setImagePreviewFailed(true)}
 />
 </button>
 )
 ) : null}
 {!compact && isHtml && showInlineHtmlPreview && selectedProject && apiPath ? (
 <DesignHtmlPreview filePath={apiPath} selectedProject={selectedProject} />
 ) : null}
 {overlayOpen ? (
 <DeliverablePreviewOverlay
 items={[overlayItem]}
 index={0}
 onIndexChange={() => {}}
 selectedProject={selectedProject}
 onFileOpen={onFileOpen}
 onClose={() => setOverlayOpen(false)}
 />
 ) : null}
 </div>
 );
}

export default DeliverableCard;
