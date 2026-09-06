import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { MouseEvent, MutableRefObject } from 'react';
import type { CodeEditorFile } from '../types/types';
import CodeEditor from './CodeEditor';
import { shouldEditorSidebarFlexFill } from './editorSidebarLayout';

type EditorSidebarProps = {
 editingFile: CodeEditorFile | null;
 isMobile: boolean;
 editorExpanded: boolean;
 editorWidth: number;
 hasManualWidth: boolean;
 resizeHandleRef: MutableRefObject<HTMLDivElement | null>;
 onResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
 onCloseEditor: () => void;
 onToggleEditorExpand: () => void;
 onEditDockRequest?: () => void;
 projectPath?: string;
 fillSpace?: boolean;
 /** Width reserved by siblings to the right (e.g. workspace drawer). */
 reservedRightWidth?: number;
 /** Far-right workspace drawer (成果清单) is open — manual preview width stays fixed. */
 workspaceDrawerOpen?: boolean;
};

// Keep enough of the Files split visible so the editor cannot cover the chat
// and file tree when CodeMirror reports wide virtualized content.
const MIN_LEFT_CONTENT_WIDTH = 420;
// Minimum width for the editor sidebar
const MIN_EDITOR_WIDTH = 280;
const AUTO_EDITOR_WIDTH_RATIO = 0.5;

export default function EditorSidebar({
 editingFile,
 isMobile,
 editorExpanded,
 editorWidth,
 hasManualWidth,
 resizeHandleRef,
 onResizeStart,
 onCloseEditor,
 onToggleEditorExpand,
 onEditDockRequest,
 projectPath,
 fillSpace,
 reservedRightWidth = 0,
 workspaceDrawerOpen = false,
}: EditorSidebarProps) {
 const { t } = useTranslation();
 const [poppedOut, setPoppedOut] = useState(false);
 const containerRef = useRef<HTMLDivElement>(null);
 const [effectiveWidth, setEffectiveWidth] = useState(editorWidth);

 // Adjust editor width when container size changes to ensure buttons are always visible.
 // In the Files tab's default mode, this intentionally produces a stable
 // measured width rather than letting the editor's content influence flex
 // sizing while CodeMirror virtualizes long lines during scroll.
 useEffect(() => {
 if (!editingFile || isMobile || poppedOut) return;

 const updateWidth = () => {
 if (!containerRef.current) return;
 const parentElement = containerRef.current.parentElement;
 if (!parentElement) return;

 const containerWidth = parentElement.clientWidth;
 const paddingRight = Number.parseFloat(getComputedStyle(parentElement).paddingRight) || 0;
 const usableWidth = Math.max(0, containerWidth - paddingRight);

 // Calculate maximum allowed editor width (account for chat minimum + right drawer)
 const maxEditorWidth = usableWidth - MIN_LEFT_CONTENT_WIDTH - reservedRightWidth;

 if (maxEditorWidth < MIN_EDITOR_WIDTH) {
 // Not enough space - pop out the editor so user can still see everything
 setPoppedOut(true);
 } else {
 const requestedWidth = fillSpace && !hasManualWidth && !editorExpanded
 ? Math.min(editorWidth, Math.floor(usableWidth * AUTO_EDITOR_WIDTH_RATIO))
 : editorWidth;
 setEffectiveWidth(Math.min(requestedWidth, maxEditorWidth));
 }
 };

 updateWidth();
 window.addEventListener('resize', updateWidth);

 // Also use ResizeObserver for more accurate detection
 const resizeObserver = new ResizeObserver(updateWidth);
 const parentEl = containerRef.current?.parentElement;
 if (parentEl) {
 resizeObserver.observe(parentEl);
 }

 return () => {
 window.removeEventListener('resize', updateWidth);
 resizeObserver.disconnect();
 };
 }, [editingFile, fillSpace, hasManualWidth, isMobile, poppedOut, editorExpanded, editorWidth, reservedRightWidth, workspaceDrawerOpen]);

 if (!editingFile) {
 return null;
 }

 if (isMobile || poppedOut) {
 return (
 <CodeEditor
 file={editingFile}
 onClose={() => {
 setPoppedOut(false);
 onCloseEditor();
 }}
 projectPath={projectPath}
 isSidebar={false}
 onEditDockRequest={onEditDockRequest}
 />
 );
 }

 // When the workspace drawer is closed, flex-fill the preview so no dead strip remains
 // on the right after collapsing 成果清单 (manual resize widths stay fixed while open).
 const useFlexFill = shouldEditorSidebarFlexFill({
   fillSpace: Boolean(fillSpace),
   editorExpanded,
   hasManualWidth,
   workspaceDrawerOpen,
 });
 const containerClassName = editorExpanded || useFlexFill
   ? 'flex h-full min-w-0 flex-1 basis-0'
   : 'flex h-full min-w-0 flex-shrink-0';
 const containerStyle = editorExpanded || useFlexFill
   ? { minWidth: `${MIN_EDITOR_WIDTH}px` }
   : {
     width: `${effectiveWidth}px`,
     minWidth: `${MIN_EDITOR_WIDTH}px`,
     maxWidth: `${effectiveWidth}px`,
   };

 return (
 <div ref={containerRef} className={containerClassName} style={containerStyle}>
 {!editorExpanded && (
 <div
 ref={resizeHandleRef}
 onMouseDown={onResizeStart}
 className="group relative z-10 w-px flex-shrink-0 cursor-col-resize bg-border transition-colors hover:bg-muted-foreground/50"
 title={t('resize.dragToResizePanel')}
 >
 <div className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2" />
 <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" />
 </div>
 )}

 <div
 className="h-full min-w-0 flex-1 overflow-hidden border-l border-border"
 >
 <CodeEditor
 file={editingFile}
 onClose={onCloseEditor}
 projectPath={projectPath}
 isSidebar
 isExpanded={editorExpanded}
 onToggleExpand={onToggleEditorExpand}
 onPopOut={() => setPoppedOut(true)}
 onEditDockRequest={onEditDockRequest}
 />
 </div>
 </div>
 );
}
