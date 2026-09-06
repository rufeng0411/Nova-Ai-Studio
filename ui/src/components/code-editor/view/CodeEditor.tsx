import { EditorView } from '@codemirror/view';
import { unifiedMergeView } from '@codemirror/merge';
// PD-SAAS-FORK: EditorState for mobile read-only mode.
import { EditorState, type Extension } from '@codemirror/state';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCodeEditorDocument } from '../hooks/useCodeEditorDocument';
import { useCodeEditorSettings } from '../hooks/useCodeEditorSettings';
import { useEditorKeyboardShortcuts } from '../hooks/useEditorKeyboardShortcuts';
import type { CodeEditorFile } from '../types/types';
import { createMinimapExtension, createScrollToFirstChunkExtension, getLanguageExtensions } from '../utils/editorExtensions';
import { getEditorStyles } from '../utils/editorStyles';
import { createEditorToolbarPanelExtension } from '../utils/editorToolbarPanel';
import { isHtmlEditorFile, isMarkdownEditorFile, isPreviewableEditorFile } from '../utils/previewableFile';
import { api } from '../../../utils/api';
import { classifyDeliverablePath } from '../../../shared/artifactPaths';
import { supportsBrowserNewTabForFile } from '../../../shared/projectPreviewCapabilities';
import { resolveEditorApiPath } from '../utils/resolveEditorApiPath';
import { isImageFile } from '../utils/binaryFile';
import CodeEditorBinaryFile from './subcomponents/CodeEditorBinaryFile';
import CodeEditorFooter from './subcomponents/CodeEditorFooter';
import CodeEditorHeader from './subcomponents/CodeEditorHeader';
import CodeEditorLoadError from './subcomponents/CodeEditorLoadError';
import CodeEditorLoadingState from './subcomponents/CodeEditorLoadingState';
import CodeEditorSurface from './subcomponents/CodeEditorSurface';
import { shouldUseSuperPreview } from '../../super-preview/superPreviewRouting';
import PreviewEditorChromeActions from './subcomponents/PreviewEditorChromeActions';
import { PreviewChromeCloseButton } from '../../super-preview/PreviewChromeBar';
import DocumentExportActionBar from '../../shared/DocumentExportActionBar';
// PD-SAAS-FORK: phones + SaaS cloud get read-only browsing (no CodeMirror editing).
import { useMobileShell } from '../../../hooks/useMobileShell';
import { IS_SAAS_MODE } from '../../../constants/config';

type CodeEditorProps = {
 file: CodeEditorFile;
 onClose: () => void;
 projectPath?: string;
 isSidebar?: boolean;
 isExpanded?: boolean;
 onToggleExpand?: (() => void) | null;
 onPopOut?: (() => void) | null;
 onEditDockRequest?: () => void;
};

export default function CodeEditor({
 file,
 onClose,
 projectPath,
 isSidebar = false,
 isExpanded = false,
 onToggleExpand = null,
 onPopOut = null,
 onEditDockRequest,
}: CodeEditorProps) {
  const { t } = useTranslation('codeEditor');
  // PD-SAAS-FORK: mobile + SaaS cloud are read-only — no editing, no save (use download/export).
  const isMobile = useMobileShell();
  const isReadOnlyBrowsing = isMobile || IS_SAAS_MODE;
  const [isFullscreen, setIsFullscreen] = useState(false);
 const [showDiff, setShowDiff] = useState(Boolean(file.diffInfo));
 const isMarkdownFile = useMemo(() => isMarkdownEditorFile(file.name), [file.name]);
 const isHtmlFileEarly = useMemo(() => isHtmlEditorFile(file.name), [file.name]);
 const prefersRenderedPreview = isMarkdownFile || isHtmlFileEarly;

 const [previewMode, setPreviewMode] = useState(
 () => Boolean(file.initialPreview) || prefersRenderedPreview,
 );

 useEffect(() => {
 setPreviewMode(prefersRenderedPreview || Boolean(file.initialPreview));
 setShowDiff(Boolean(file.diffInfo));
 }, [file.path, file.initialPreview, file.diffInfo, prefersRenderedPreview]);

 const {
 isDarkMode,
 wordWrap,
 minimapEnabled,
 showLineNumbers,
 fontSize,
 } = useCodeEditorSettings();

 const {
 content,
 setContent,
 loading,
 loadError,
 reload,
 saving,
 saveSuccess,
 saveError,
 isBinary,
 projectName,
 handleSave,
 handleDownload,
 } = useCodeEditorDocument({
 file,
 projectPath,
 });

 const isHtmlFile = useMemo(() => isHtmlEditorFile(file.name), [file.name]);
 const fileKind = useMemo(() => classifyDeliverablePath(file.name), [file.name]);
 const supportsSuperPreview = useMemo(
   () => shouldUseSuperPreview(file.name, fileKind),
   [file.name, fileKind],
 );
 const unifiedPreviewChrome =
   previewMode && isSidebar && Boolean(projectName) && supportsSuperPreview;
 const isPreviewableFile = useMemo(
 () => isPreviewableEditorFile(file.name) && !isMarkdownFile,
 [file.name, isMarkdownFile],
 );
 const editorApiPath = useMemo(
 () => resolveEditorApiPath(file.path, projectPath || ''),
 [file.path, projectPath],
 );

 const previewOpenUrl = useMemo(() => {
 if (!previewMode || !projectName) return null;
 const kind = classifyDeliverablePath(file.name);
 if (isImageFile(file.name) || kind === 'image') {
 return api.fileContentUrl(projectName, editorApiPath);
 }
 if (!supportsBrowserNewTabForFile(file.name, kind) && !isHtmlFile) return null;
 return api.projectPreviewUrl(projectName, editorApiPath, projectPath || '');
 }, [editorApiPath, file.name, isHtmlFile, previewMode, projectName, projectPath]);

 const exportActions = useMemo(() => {
 if (!projectName || !editorApiPath || isBinary) return null;
 const kind = classifyDeliverablePath(file.name);
 if (kind !== 'document' && kind !== 'html' && kind !== 'spreadsheet') return null;
 return (
 <DocumentExportActionBar variant="editor" projectName={projectName} sourcePath={editorApiPath} projectRoot={projectPath || ''} />
 );
 }, [editorApiPath, file.name, isBinary, projectName, projectPath]);

 const previewChromeActions = unifiedPreviewChrome ? (
   <PreviewEditorChromeActions
     previewOpenUrl={previewOpenUrl}
     showExternalLink={Boolean(previewOpenUrl)}
     showEditToggle={isPreviewableFile}
     previewMode={previewMode}
     onTogglePreview={() => setPreviewMode((previous) => !previous)}
     onDownload={handleDownload}
     onToggleExpand={onToggleExpand}
     isExpanded={isExpanded}
     exportActions={exportActions}
     labels={{
       editSource: t('actions.editSource', { defaultValue: '编辑源码' }),
       previewContent: t('actions.previewContent', { defaultValue: '预览' }),
       download: t('actions.download'),
       openInNewWindow: t('actions.openInNewWindow', { defaultValue: '新窗口打开' }),
       expand: t('actions.expand', { defaultValue: 'Expand to full width' }),
       collapse: t('actions.collapse', { defaultValue: 'Collapse to split view' }),
     }}
     markdownShare={
       isMarkdownFile && previewMode && projectName
         ? {
             projectName,
             apiPath: editorApiPath,
             fileName: file.name,
           }
         : null
     }
   />
 ) : null;

 const previewChromeTrailing = unifiedPreviewChrome ? (
   <PreviewChromeCloseButton
     onClose={onClose}
     label={t('actions.close')}
   />
 ) : null;

 const minimapExtension = useMemo(
 () => (
 createMinimapExtension({
 file,
 showDiff,
 minimapEnabled,
 isDarkMode,
 })
 ),
 [file, isDarkMode, minimapEnabled, showDiff],
 );

 const scrollToFirstChunkExtension = useMemo(
 () => createScrollToFirstChunkExtension({ file, showDiff }),
 [file, showDiff],
 );

 const toolbarPanelExtension = useMemo(
 () => (
 createEditorToolbarPanelExtension({
 file,
 showDiff,
 isSidebar,
 isExpanded,
 onToggleDiff: () => setShowDiff((previous) => !previous),
 onPopOut,
 onToggleExpand,
 labels: {
 changes: t('toolbar.changes'),
 previousChange: t('toolbar.previousChange'),
 nextChange: t('toolbar.nextChange'),
 hideDiff: t('toolbar.hideDiff'),
 showDiff: t('toolbar.showDiff'),
 collapse: t('toolbar.collapse'),
 expand: t('toolbar.expand'),
 },
 })
 ),
 [file, isExpanded, isSidebar, onPopOut, onToggleExpand, showDiff, t],
 );

 const extensions = useMemo(() => {
 const allExtensions: Extension[] = [
 ...getLanguageExtensions(file.name),
 ...toolbarPanelExtension,
 ];

 if (file.diffInfo && showDiff && file.diffInfo.old_string !== undefined) {
 allExtensions.push(
 unifiedMergeView({
 original: file.diffInfo.old_string,
 mergeControls: false,
 highlightChanges: true,
 syntaxHighlightDeletions: false,
 gutter: true,
 }),
 );
 allExtensions.push(...minimapExtension);
 allExtensions.push(...scrollToFirstChunkExtension);
 }

    if (wordWrap) {
      allExtensions.push(EditorView.lineWrapping);
    }

    // PD-SAAS-FORK: read-only browsing on phones and SaaS cloud workspaces.
    if (isReadOnlyBrowsing) {
      allExtensions.push(EditorState.readOnly.of(true));
      allExtensions.push(EditorView.editable.of(false));
    }

    return allExtensions;
  }, [
    file.diffInfo,
    file.name,
    isReadOnlyBrowsing,
    minimapExtension,
    scrollToFirstChunkExtension,
    showDiff,
    toolbarPanelExtension,
    wordWrap,
  ]);

 useEditorKeyboardShortcuts({
 onSave: handleSave,
 onClose,
 dependency: content,
 enableSave: !isReadOnlyBrowsing,
 });

 if (loading) {
 return (
 <CodeEditorLoadingState
 isDarkMode={isDarkMode}
 isSidebar={isSidebar}
 loadingText={t('loading', { fileName: file.name })}
 />
 );
 }

 if (loadError) {
 return (
 <CodeEditorLoadError
 file={file}
 isDarkMode={isDarkMode}
 isSidebar={isSidebar}
 errorMessage={loadError}
 onRetry={reload}
 onClose={onClose}
 labels={{
 title: t('loadError.title'),
 description: t('loadError.description', { fileName: file.name }),
 retry: t('loadError.retry'),
 close: t('actions.close'),
 }}
 />
 );
 }

 if (isBinary) {
 return (
 <CodeEditorBinaryFile
 file={file}
 projectName={projectName}
 projectRoot={projectPath}
 isSidebar={isSidebar}
 isFullscreen={isFullscreen}
 onClose={onClose}
 onToggleFullscreen={() => setIsFullscreen((previous) => !previous)}
 onPopOut={onPopOut}
 onEditDockRequest={onEditDockRequest}
 title={t('binaryFile.title', 'Binary File')}
 message={t('binaryFile.message', 'The file "{{fileName}}" cannot be displayed in the text editor because it is a binary file.', { fileName: file.name })}
 />
 );
 }

 const outerContainerClassName = isSidebar
 ? 'w-full h-full flex flex-col'
 : `fixed inset-0 z-[9999] md:bg-black/40 md:backdrop-blur-sm md:flex md:items-center md:justify-center md:p-4 ${isFullscreen ? 'md:p-0' : ''}`;

 const innerContainerClassName = isSidebar
 ? 'bg-background flex flex-col w-full h-full'
 : `bg-background flex flex-col w-full h-full md:rounded-xl md:border md:border-border dark:md:border-primary/30${
 isFullscreen
 ? ' md:w-full md:h-full md:rounded-none md:border-0'
 : ' md:w-full md:max-w-6xl md:h-[80vh] md:max-h-[80vh] md:shadow-xl'
 }`;

 return (
 <>
 <style>{getEditorStyles(isDarkMode)}</style>
 <div className={outerContainerClassName}>
 <div className={innerContainerClassName}>
 {!unifiedPreviewChrome ? (
 <CodeEditorHeader
 file={file}
 isSidebar={isSidebar}
 isFullscreen={isFullscreen}
 isPreviewableFile={isPreviewableFile}
 previewMode={previewMode}
 saving={saving}
 saveSuccess={saveSuccess}
          isExpanded={isExpanded}
          onToggleExpand={onToggleExpand}
          readOnly={isReadOnlyBrowsing}
          onTogglePreview={
 isMarkdownFile
 ? undefined
 : () => setPreviewMode((previous) => !previous)
 }
 onDownload={handleDownload}
 onSave={handleSave}
 onToggleFullscreen={() => setIsFullscreen((previous) => !previous)}
 onClose={onClose}
 previewOpenUrl={previewOpenUrl}
 exportActions={exportActions}
 labels={{
 showingChanges: t('header.showingChanges'),
 editSource: t('actions.editSource', { defaultValue: '编辑源码' }),
 previewContent: t('actions.previewContent', { defaultValue: '预览' }),
 download: t('actions.download'),
 save: t('actions.save'),
 saving: t('actions.saving'),
 saved: t('actions.saved'),
 fullscreen: t('actions.fullscreen'),
 exitFullscreen: t('actions.exitFullscreen'),
 expand: t('actions.expand', { defaultValue: 'Expand to full width' }),
 collapse: t('actions.collapse', { defaultValue: 'Collapse to split view' }),
 close: t('actions.close'),
 openInNewWindow: t('actions.openInNewWindow', { defaultValue: '新窗口打开' }),
 }}
 />
 ) : null}

 {saveError && (
 <div className="border-b border-red-200/60 bg-red-50 px-4 py-1.5 text-xxs text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300">
 {saveError}
 </div>
 )}

 <div className="flex-1 overflow-hidden">
 <CodeEditorSurface
 content={content}
 onChange={setContent}
 previewMode={previewMode}
 fileName={file.name}
 isMarkdownFile={isMarkdownFile}
 isHtmlFile={isHtmlFile}
 htmlPreviewPath={file.path}
 hintDir={file.hintDir}
 projectName={projectName}
 projectPath={projectPath}
 isDarkMode={isDarkMode}
 fontSize={fontSize}
 showLineNumbers={showLineNumbers}
 extensions={extensions}
 previewChromeActions={previewChromeActions}
 previewChromeTrailing={previewChromeTrailing}
 />
 </div>

 <CodeEditorFooter
 content={content}
 linesLabel={t('footer.lines')}
 charactersLabel={t('footer.characters')}
 onClose={unifiedPreviewChrome ? onClose : undefined}
 closeLabel={t('actions.close')}
 shortcutsLabel={
 unifiedPreviewChrome
 ? undefined
 : isReadOnlyBrowsing
 ? t('footer.shortcutsReadOnly', { defaultValue: '按 Esc 关闭' })
 : t('footer.shortcuts')
 }
 />
 </div>
 </div>
 </>
 );
}
