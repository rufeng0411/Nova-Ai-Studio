import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CodeEditorFile } from '../../types/types';
import { classifyDeliverablePath } from '../../../../shared/artifactPaths';
import { resolveProjectInlineMediaUrl } from '../../../../shared/projectInlineMediaUrl';
import { api } from '../../../../utils/api';
import { resolveEditorApiPath } from '../../utils/resolveEditorApiPath';
import { isMarkdownEditorFile } from '../../utils/previewableFile';
import DocumentExportActionBar from '../../../shared/DocumentExportActionBar';
import { buildPreviewChromeActions, buildPreviewChromeTrailing, buildPreviewSessionKey, buildSidebarDocumentPreviewChrome } from '../../../shared/buildPreviewChromeActions';
import {
  PreviewChromeDivider,
  PreviewChromeGroup,
  PreviewChromeIconButton,
} from '../../../super-preview/PreviewChromeBar';
import { shouldUseSuperPreview } from '../../../super-preview/superPreviewRouting';
import { canPreviewBinaryFile, BinaryFilePreviewContent } from './BinaryFilePreviewContent';
import PreviewPanelFooter from '../../../shared/PreviewPanelFooter';
import { useResolvedProjectApiPath } from '../../../../shared/hooks/useResolvedProjectApiPath';
import {
  isDesignCanvasEnabled,
  subscribeDesignCanvasEnabled,
} from '../../../../shared/designCanvasGate';
import { supportsDesignCanvasEdit } from '../../../../shared/designCanvasSupport';

// PD-SAAS-FORK: binary preview (video/pdf/docx/pptx/csv/xlsx) in editor sidebar
type CodeEditorBinaryFileProps = {
 file: CodeEditorFile;
 projectName?: string;
 projectRoot?: string;
 isSidebar: boolean;
 isFullscreen: boolean;
 onClose: () => void;
 onToggleFullscreen: () => void;
 onPopOut?: (() => void) | null;
 onEditDockRequest?: () => void;
 title: string;
 message: string;
};

export default function CodeEditorBinaryFile({
 file,
 projectName,
 projectRoot,
 isSidebar,
 isFullscreen,
 onClose,
 onToggleFullscreen,
 onPopOut,
 onEditDockRequest,
 title,
 message,
}: CodeEditorBinaryFileProps) {
 const { t } = useTranslation('codeEditor');
 const [designCanvasGateOn, setDesignCanvasGateOn] = useState(() => isDesignCanvasEnabled());
 const [detached, setDetached] = useState(false);
 useEffect(() => subscribeDesignCanvasEnabled(() => setDesignCanvasGateOn(isDesignCanvasEnabled())), []);

 const iconBtn =
 'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ';

 const apiPath = useMemo(() => resolveEditorApiPath(file.path, projectRoot), [file.path, projectRoot]);
 const { resolvedApiPath } = useResolvedProjectApiPath(projectName, apiPath, projectRoot);
 const fetchPath = resolvedApiPath || apiPath;
 const previewUrl = useMemo(() => {
 if (!projectName || !fetchPath) return null;
 const kind = classifyDeliverablePath(file.name);
 return resolveProjectInlineMediaUrl(projectName, fetchPath, file.name, projectRoot || '', kind);
 }, [fetchPath, file.name, projectName, projectRoot]);
 const downloadUrl = useMemo(() => {
 if (!projectName || !fetchPath) return null;
 return api.fileDownloadUrl(projectName, fetchPath, projectRoot || '');
 }, [fetchPath, projectName, projectRoot]);
 const fileKind = useMemo(() => classifyDeliverablePath(file.name), [file.name]);
 const markdownShare = useMemo(() => {
   if (!projectName || !fetchPath || !isMarkdownEditorFile(file.name)) return null;
   return {
     projectName,
     apiPath: fetchPath,
     fileName: file.name,
   };
 }, [fetchPath, file.name, projectName]);

 const canPreview = canPreviewBinaryFile(file.name);
 const unifiedPreviewChrome = canPreview && shouldUseSuperPreview(file.name, fileKind);
 const previewSessionKey = useMemo(() => {
   if (!projectName || !fetchPath) return undefined;
   return buildPreviewSessionKey(projectName, fetchPath, file.name);
 }, [fetchPath, file.name, projectName]);

 const exportActionsEl = useMemo(() => {
   if (!projectName || !fetchPath) return null;
   return (
     <DocumentExportActionBar
       variant="editor"
       projectName={projectName}
       sourcePath={fetchPath}
       projectRoot={projectRoot || ''}
     />
   );
 }, [fetchPath, projectName, projectRoot]);

 const previewChromeActions = useMemo(() => {
   if (!unifiedPreviewChrome) return null;
   return (
     <>
       {buildSidebarDocumentPreviewChrome({
         fileName: file.name,
         kind: fileKind,
         previewUrl,
         downloadUrl,
         showDownload: true,
         exportActions: exportActionsEl,
         markdownShare,
       })}
       {isSidebar && onPopOut ? (
         <>
           <PreviewChromeDivider />
           <PreviewChromeGroup aria-label="弹窗">
             <PreviewChromeIconButton
               data-testid="binary-preview-popout"
               title={t('actions.openInNewWindow', { defaultValue: '弹窗打开' })}
               aria-label={t('actions.openInNewWindow', { defaultValue: '弹窗打开' })}
               onClick={() => setDetached(true)}
             >
               <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.75} />
             </PreviewChromeIconButton>
           </PreviewChromeGroup>
         </>
       ) : null}
     </>
   );
 }, [downloadUrl, exportActionsEl, file.name, fileKind, isSidebar, markdownShare, onPopOut, previewUrl, t, unifiedPreviewChrome]);

 const previewChromeTrailing = useMemo(() => {
   if (!unifiedPreviewChrome) return null;
   return buildPreviewChromeTrailing(onClose, t('actions.close'));
 }, [onClose, t, unifiedPreviewChrome]);

 const detachedPreviewChromeTrailing = useMemo(() => {
   if (!unifiedPreviewChrome) return null;
   return buildPreviewChromeTrailing(() => setDetached(false), t('actions.close'));
 }, [t, unifiedPreviewChrome]);
 const showDesignCanvasHint =
   designCanvasGateOn && supportsDesignCanvasEdit(file.name, fetchPath || file.path);
 const previewTitle = canPreview
 ? t('binaryFile.previewTitle', { defaultValue: '文件预览' })
 : title;
 const previewMessage = canPreview
 ? t('binaryFile.previewMessage', { defaultValue: '该文件类型暂不支持内联预览。' })
 : message;

 const previewContent = (
 <BinaryFilePreviewContent
 projectName={projectName}
 projectRoot={projectRoot}
 file={file}
 title={previewTitle}
 message={previewMessage}
 onClose={onClose}
 surface={unifiedPreviewChrome || isSidebar ? 'sidebar' : 'overlay'}
 previewChromeActions={previewChromeActions ?? undefined}
 previewChromeTrailing={previewChromeTrailing ?? undefined}
 previewSessionKey={previewSessionKey}
 />
 );
 const handleDetachedEditDock = useMemo(() => {
   if (!onEditDockRequest) return undefined;
   return () => {
     setDetached(false);
     onEditDockRequest();
   };
 }, [onEditDockRequest]);

 const detachedPreviewContent = (
 <BinaryFilePreviewContent
 projectName={projectName}
 projectRoot={projectRoot}
 file={file}
 title={previewTitle}
 message={previewMessage}
 onClose={() => setDetached(false)}
 surface="overlay"
 previewChromeActions={previewChromeActions ?? undefined}
 previewChromeTrailing={detachedPreviewChromeTrailing ?? undefined}
 previewSessionKey={previewSessionKey}
 onEditDockRequest={handleDetachedEditDock}
 />
 );

 const headerTopBar = unifiedPreviewChrome ? null : (
 <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-card px-4 py-2">
 <div className="flex min-w-0 flex-1 items-center gap-2">
 <h3 className="truncate text-[13px] font-medium text-foreground">
 {file.name}
 </h3>
 {canPreview ? (
 <span className="shrink-0 rounded border border-border bg-sidebar px-1.5 py-0.5 text-xxs text-muted-foreground">
 {t('binaryFile.previewBadge', { defaultValue: '预览' })}
 </span>
 ) : null}
 {showDesignCanvasHint ? (
 <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:inline">
 {t('binaryFile.designCanvasHint', { defaultValue: '下方可切换 查看/编辑' })}
 </span>
 ) : null}
 </div>
 <div className="flex shrink-0 items-center gap-0.5">
 {canPreview ? (
 buildPreviewChromeActions({
 fileName: file.name,
 kind: fileKind,
 previewUrl,
 downloadUrl,
 showDownload: true,
 showOpenInPanel: false,
 markdownShare,
 exportActions:
 projectName && fetchPath ? (
 <DocumentExportActionBar variant="editor" projectName={projectName} sourcePath={fetchPath} projectRoot={projectRoot || ''} />
 ) : null,
 })
 ) : null}
 {isSidebar && onPopOut ? (
 <button
 type="button"
 onClick={() => setDetached(true)}
 data-testid="binary-preview-popout"
 className={iconBtn}
 title={t('actions.openInNewWindow', { defaultValue: '弹窗打开' })}
 aria-label={t('actions.openInNewWindow', { defaultValue: '弹窗打开' })}
 >
 <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.75} />
 </button>
 ) : null}
 {!isSidebar && (
 <button
 type="button"
 onClick={onToggleFullscreen}
 className={iconBtn}
 title={isFullscreen ? t('actions.exitFullscreen') : t('actions.fullscreen')}
 >
 {isFullscreen ? (
 <Minimize2 className="h-3.5 w-3.5" strokeWidth={1.75} />
 ) : (
 <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.75} />
 )}
 </button>
 )}
 <button type="button" onClick={onClose} className={iconBtn} title={t('actions.close')}>
 <X className="h-3.5 w-3.5" strokeWidth={1.75} />
 </button>
 </div>
 </div>
 );

 if (isSidebar) {
 return (
 <>
 <div className="flex h-full w-full flex-col bg-background">
 {headerTopBar}
 <div className="min-h-0 flex-1 overflow-hidden">{previewContent}</div>
 {unifiedPreviewChrome ? (
   <PreviewPanelFooter onClose={onClose} closeLabel={t('actions.close')} />
 ) : null}
 </div>
 {detached && typeof document !== 'undefined' ? createPortal(
 <div className="fixed inset-0 z-[9999] bg-black/40 p-4 backdrop-blur-sm" onClick={() => setDetached(false)}>
 <div
 className="mx-auto flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl"
 onClick={(event) => event.stopPropagation()}
 >
 {unifiedPreviewChrome ? null : (
 <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-card px-4 py-2">
 <div className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{file.name}</div>
 <button
 type="button"
 data-testid="binary-preview-detached-close"
 onClick={() => setDetached(false)}
 className={iconBtn}
 title={t('actions.close')}
 >
 <X className="h-3.5 w-3.5" strokeWidth={1.75} />
 </button>
 </div>
 )}
 <div className="min-h-0 flex-1 overflow-hidden">{detachedPreviewContent}</div>
 </div>
 </div>,
 document.body,
 ) : null}
 </>
 );
 }

 const containerClassName = isFullscreen
 ? 'fixed inset-0 z-[9999] bg-background flex flex-col'
 : 'fixed inset-0 z-[9999] md:bg-black/40 md:backdrop-blur-sm md:flex md:items-center md:justify-center md:p-4';

 const innerClassName = isFullscreen
 ? 'bg-background flex flex-col w-full h-full'
 : `bg-background flex flex-col w-full h-full md:rounded-xl md:border md:border-border dark:md:border-primary/30 md:shadow-xl ${
 canPreview
 ? 'md:w-full md:max-w-5xl md:h-[85vh] md:max-h-[85vh]'
 : 'md:w-full md:max-w-2xl md:h-auto md:max-h-[60vh]'
 }`;

 return (
 <div className={containerClassName}>
 <div className={innerClassName}>
 {headerTopBar}
 <div className="min-h-0 flex-1 overflow-hidden">{previewContent}</div>
 </div>
 </div>
 );
}
