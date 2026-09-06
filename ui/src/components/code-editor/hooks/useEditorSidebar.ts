import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { Project } from '../../../types/app';
import { normalizeArtifactPath, toProjectApiPath, scopeDeliverablePathToTurnDir } from '../../../shared/artifactPaths';
import { shouldSkipDeliverablePathResolve } from '../../../shared/deliverablePreviewFastPath';
import { resolveProjectFilePath } from '../../../shared/resolveProjectFilePath';
import { buildBentoFileOpenOptions } from '../../../shared/bentoStudioDock';
import type { CodeEditorDiffInfo, CodeEditorFile } from '../types/types';
import {
  buildEditorFile,
  parseFileOpenArgs,
  resolveInitialPreview,
  type FileOpenOptions,
} from '../utils/fileOpen';

type UseEditorSidebarOptions = {
  selectedProject: Project | null;
  isMobile: boolean;
  initialWidth?: number;
};

/** Width of the drag handle between chat and preview (px). */
export const SPLIT_PREVIEW_HANDLE_WIDTH = 1;
const MIN_CHAT_PANE_WIDTH = 320;
const MIN_EDITOR_PANE_WIDTH = 300;

export const useEditorSidebar = ({
  selectedProject,
  isMobile,
  initialWidth = 600,
}: UseEditorSidebarOptions) => {
  const [editingFile, setEditingFile] = useState<CodeEditorFile | null>(null);
  const [editorWidth, setEditorWidth] = useState(initialWidth);
  const [splitChatWidth, setSplitChatWidth] = useState<number | null>(null);
  const [editorExpanded, setEditorExpanded] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [hasManualWidth, setHasManualWidth] = useState(false);
  const resizeHandleRef = useRef<HTMLDivElement | null>(null);

  const handleFileOpen = useCallback(
    (filePath: string, diffInfoOrOptions?: CodeEditorDiffInfo | FileOpenOptions | null) => {
      const projectRoot = selectedProject?.fullPath || selectedProject?.path || '';
      const normalizedPath =
        toProjectApiPath(filePath, projectRoot) || normalizeArtifactPath(filePath, projectRoot);
      const fileName = normalizedPath.split('/').pop() || normalizedPath;
      const explicitProvided = Boolean(
        diffInfoOrOptions && typeof diffInfoOrOptions === 'object' && 'initialPreview' in diffInfoOrOptions,
      );
      const { diffInfo, initialPreview: explicitPreview, designCanvasMode, htmlStudioMode, hfStudioMode, bentoStudioMode: parsedBentoMode, hintDir, skipResolve: explicitSkipResolve } = parseFileOpenArgs(diffInfoOrOptions);
      const scopedPath = scopeDeliverablePathToTurnDir(normalizedPath, hintDir);
      const bentoFallback = buildBentoFileOpenOptions(
        scopedPath.split('/').pop() || fileName,
        scopedPath,
        { hintDir },
      );
      const bentoStudioMode = parsedBentoMode ?? bentoFallback?.bentoStudioMode;
      const initialPreview = resolveInitialPreview(
        scopedPath.split('/').pop() || scopedPath,
        diffInfo,
        explicitPreview,
        explicitProvided,
      );

      const openWithPath = (resolvedPath: string, skipResolve?: boolean) => {
        setEditingFile(
          buildEditorFile(resolvedPath, selectedProject?.name, diffInfo, initialPreview, {
            designCanvasMode,
            htmlStudioMode,
            hfStudioMode,
            bentoStudioMode,
            hintDir,
            skipResolve: skipResolve ?? explicitSkipResolve,
          }),
        );
      };

      if (!selectedProject?.name) {
        openWithPath(scopedPath, explicitSkipResolve);
        return;
      }

      const skipResolve = explicitSkipResolve ?? shouldSkipDeliverablePathResolve(scopedPath, hintDir);
      if (skipResolve) {
        openWithPath(scopedPath, true);
        return;
      }

      // PD-SAAS-FORK: resolve to the on-disk path before opening so readFile does not 404 on
      // agent-cited folders (e.g. assets/dashboard.html) when the file lives at workspace root.
      // Forward the turn-scoped hintDir so a bare deliverable name resolves to the SAME file the
      // body link / acceptance table / overlay resolve to (five-entry consistency).
      void resolveProjectFilePath(
        selectedProject.name,
        scopedPath,
        projectRoot,
        hintDir ? { hintDir } : undefined,
      )
        .then((resolved) => {
          const nextPath =
            resolved?.relativePath && !resolved.ambiguous ? resolved.relativePath : scopedPath;
          openWithPath(nextPath, true);
        })
        .catch(() => {
          openWithPath(scopedPath, shouldSkipDeliverablePathResolve(scopedPath, hintDir));
        });
    },
    [selectedProject?.fullPath, selectedProject?.name, selectedProject?.path],
  );

  const handleCloseEditor = useCallback(() => {
    setEditingFile(null);
    setEditorExpanded(false);
    setHasManualWidth(false);
    setSplitChatWidth(null);
  }, []);

  // Close any open file tab when the user switches to a different project so
  // we don't carry a Project A file across into Project B's view. Switching
  // sessions within the same project keeps the editor open because
  // `selectedProject?.name` stays the same.
  useEffect(() => {
    setEditingFile(null);
    setEditorExpanded(false);
    setHasManualWidth(false);
    setSplitChatWidth(null);
  }, [selectedProject?.name]);

  const handleToggleEditorExpand = useCallback(() => {
    setEditorExpanded((previous) => !previous);
  }, []);

  const handleResizeStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (isMobile) {
        return;
      }

      const editorContainer = resizeHandleRef.current?.parentElement;
      const mainContainer = editorContainer?.parentElement;
      const chatPane = mainContainer?.firstElementChild;
      if (editorContainer instanceof HTMLElement) {
        setEditorWidth(editorContainer.getBoundingClientRect().width);
      }
      if (chatPane instanceof HTMLElement) {
        setSplitChatWidth(chatPane.getBoundingClientRect().width);
      }

      setHasManualWidth(true);
      setIsResizing(true);
      event.preventDefault();
    },
    [isMobile],
  );

  useEffect(() => {
    const handleMouseMove = (event: globalThis.MouseEvent) => {
      if (!isResizing) {
        return;
      }

      // Resize within chat + preview workspace only — exclude far-right workspace drawer.
      const editorContainer = resizeHandleRef.current?.parentElement;
      const mainContainer = editorContainer?.parentElement;
      if (!mainContainer) {
        return;
      }

      const containerRect = mainContainer.getBoundingClientRect();
      const railEl = mainContainer.parentElement?.querySelector('[data-testid="right-workspace-rail"]');
      const railWidth = railEl?.getBoundingClientRect().width ?? 0;
      const contentLeft = containerRect.left;
      const contentRight = containerRect.right - railWidth;
      const availableWidth = contentRight - contentLeft;

      const newEditorWidth = contentRight - event.clientX;
      const newChatWidth = event.clientX - contentLeft - SPLIT_PREVIEW_HANDLE_WIDTH;

      if (
        newEditorWidth >= MIN_EDITOR_PANE_WIDTH
        && newChatWidth >= MIN_CHAT_PANE_WIDTH
        && newEditorWidth + newChatWidth + SPLIT_PREVIEW_HANDLE_WIDTH <= availableWidth + 1
      ) {
        setEditorWidth(newEditorWidth);
        setSplitChatWidth(newChatWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  return {
    editingFile,
    editorWidth,
    splitChatWidth,
    editorExpanded,
    hasManualWidth,
    resizeHandleRef,
    handleFileOpen,
    handleCloseEditor,
    handleToggleEditorExpand,
    handleResizeStart,
  };
};
