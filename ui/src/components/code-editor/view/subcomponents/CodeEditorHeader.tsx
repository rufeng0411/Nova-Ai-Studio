import type { ReactNode } from 'react';
import { ChevronsLeftRight, ChevronsRightLeft, Code2, Download, ExternalLink, Eye, Maximize2, Minimize2, Save, X } from 'lucide-react';
import type { CodeEditorFile } from '../../types/types';
import { PreviewChromeDivider, PreviewChromeGroup } from '../../../super-preview/PreviewChromeBar';

type CodeEditorHeaderProps = {
 file: CodeEditorFile;
 isSidebar: boolean;
 isFullscreen: boolean;
 isPreviewableFile: boolean;
 previewMode: boolean;
 saving: boolean;
 saveSuccess: boolean;
 // Only relevant in sidebar (split-pane) mode: lets the user toggle between
 // a left-tree+right-editor split and a full-width editor that occupies the
 // whole main area. Both must be defined for the toggle to render — when
 // they're omitted (e.g. modal mode) the slot is skipped.
  isExpanded?: boolean;
  onToggleExpand?: (() => void) | null;
  // PD-SAAS-FORK: hides save on mobile + SaaS cloud read-only browsing.
  readOnly?: boolean;
  onTogglePreview?: () => void;
 onDownload: () => void;
 onSave: () => void;
 onToggleFullscreen: () => void;
 onClose: () => void;
 previewOpenUrl?: string | null;
 /** PD-SAAS-FORK: office export buttons (md/html reports) */
 exportActions?: ReactNode;
 labels: {
 showingChanges: string;
 editSource: string;
 previewContent: string;
 download: string;
 save: string;
 saving: string;
 saved: string;
 fullscreen: string;
 exitFullscreen: string;
 expand: string;
 collapse: string;
 close: string;
 openInNewWindow?: string;
 };
};

export default function CodeEditorHeader({
 file,
 isSidebar,
 isFullscreen,
 isPreviewableFile,
 previewMode,
 saving,
 saveSuccess,
  isExpanded = false,
  onToggleExpand = null,
  readOnly = false,
  onTogglePreview,
 onDownload,
 onSave,
 onToggleFullscreen,
 onClose,
 previewOpenUrl = null,
 exportActions = null,
 labels,
}: CodeEditorHeaderProps) {
 const saveTitle = saveSuccess ? labels.saved : saving ? labels.saving : labels.save;

 const iconBtn =
 'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ';

 return (
 <div className="flex min-w-0 flex-shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-4 py-1.5">
 <div className="flex min-w-0 flex-1 shrink items-center gap-2">
 <div className="min-w-0 shrink">
 <div className="flex min-w-0 items-center gap-2">
 <h3 className="truncate text-[13px] font-medium text-foreground">
 {file.name}
 </h3>
 {file.diffInfo && (
 <span className="shrink-0 whitespace-nowrap rounded border border-border bg-sidebar px-1.5 py-0.5 text-xxs text-muted-foreground">
 {labels.showingChanges}
 </span>
 )}
 </div>
 {previewMode ? null : (
 <p className="truncate font-mono text-xxs text-muted-foreground">
 {file.path}
 </p>
 )}
 </div>
 </div>

 <div className="flex shrink-0 flex-nowrap items-center gap-0.5">
 {previewMode && previewOpenUrl ? (
 <>
 <PreviewChromeGroup aria-label="外部打开">
 <a
 href={previewOpenUrl}
 target="_blank"
 rel="noopener noreferrer"
 className={iconBtn}
 title={labels.openInNewWindow || '新窗口打开'}
 aria-label={labels.openInNewWindow || '新窗口打开'}
 >
 <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
 </a>
 </PreviewChromeGroup>
 {(isPreviewableFile && onTogglePreview) || exportActions || !readOnly || !isSidebar || onToggleExpand ? (
 <PreviewChromeDivider />
 ) : null}
 </>
 ) : null}

 {(isPreviewableFile && onTogglePreview) || exportActions ? (
 <PreviewChromeGroup aria-label="视图与导出">
 {isPreviewableFile && onTogglePreview && (
 <button
 type="button"
 onClick={onTogglePreview}
 data-testid="editor-preview-toggle"
 className={
 previewMode
 ? 'flex h-7 w-7 items-center justify-center rounded-md bg-muted text-foreground '
 : iconBtn
 }
 title={previewMode ? labels.editSource : labels.previewContent}
 aria-label={previewMode ? labels.editSource : labels.previewContent}
 >
 {previewMode ? (
 <Code2 className="h-3.5 w-3.5" strokeWidth={1.75} />
 ) : (
 <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
 )}
 </button>
 )}
 {exportActions}
 </PreviewChromeGroup>
 ) : null}

 {(isPreviewableFile && onTogglePreview) || exportActions ? (
 !readOnly || !isSidebar || onToggleExpand ? <PreviewChromeDivider /> : null
 ) : previewMode && previewOpenUrl ? (
 !readOnly || !isSidebar || onToggleExpand ? <PreviewChromeDivider /> : null
 ) : null}

 <PreviewChromeGroup aria-label="文件">
 <button type="button" onClick={onDownload} className={iconBtn} title={labels.download}>
 <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
 </button>

        {!readOnly ? (
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className={
            saveSuccess
              ? 'flex h-7 w-7 items-center justify-center rounded-md bg-muted text-foreground '
              : `${iconBtn} disabled:opacity-50`
          }
          title={saveTitle}
        >
 {saveSuccess ? (
 <svg
 className="h-3.5 w-3.5"
 fill="none"
 stroke="currentColor"
 strokeWidth={2}
 viewBox="0 0"
 >
 <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
 </svg>
          ) : (
            <Save className="h-3.5 w-3.5" strokeWidth={1.75} />
          )}
        </button>
        ) : null}
 </PreviewChromeGroup>

        {!isSidebar && onToggleExpand ? <PreviewChromeDivider /> : null}

        {!isSidebar && (
 <PreviewChromeGroup aria-label="窗口">
 <button
 type="button"
 onClick={onToggleFullscreen}
 className={iconBtn}
 title={isFullscreen ? labels.exitFullscreen : labels.fullscreen}
 >
 {isFullscreen ? (
 <Minimize2 className="h-3.5 w-3.5" strokeWidth={1.75} />
 ) : (
 <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.75} />
 )}
 </button>
 </PreviewChromeGroup>
 )}

 {isSidebar && onToggleExpand ? (
 <>
 <PreviewChromeDivider />
 <PreviewChromeGroup aria-label="布局">
 <button
 type="button"
 onClick={onToggleExpand}
 className={iconBtn}
 title={isExpanded ? labels.collapse : labels.expand}
 aria-label={isExpanded ? labels.collapse : labels.expand}
 >
 {isExpanded ? (
 <ChevronsRightLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
 ) : (
 <ChevronsLeftRight className="h-3.5 w-3.5" strokeWidth={1.75} />
 )}
 </button>
 </PreviewChromeGroup>
 </>
 ) : null}

 <PreviewChromeDivider />
 <PreviewChromeGroup aria-label="面板">
 <button type="button" onClick={onClose} className={iconBtn} title={labels.close}>
 <X className="h-3.5 w-3.5" strokeWidth={1.75} />
 </button>
 </PreviewChromeGroup>
 </div>
 </div>
 );
}
