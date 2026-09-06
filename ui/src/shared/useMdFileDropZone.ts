// PD-SAAS-FORK: 全区域 Markdown 文件拖放（编辑器页载入 / 工作台新窗外开）
import { useCallback, useEffect, useRef, useState, type DragEvent as ReactDragEvent } from 'react';
import { isMarkdownFile } from './mdBrowserOpen';

function listFilesFromDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  if (dt.files?.length) return Array.from(dt.files);
  const items = dt.items ? Array.from(dt.items) : [];
  const files: File[] = [];
  for (const item of items) {
    if (item.kind !== 'file') continue;
    const file = item.getAsFile();
    if (file) files.push(file);
  }
  return files;
}

function dataTransferLooksLikeFiles(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  if (dt.types?.includes('Files')) return true;
  return Array.from(dt.types || []).some((t) => t === 'application/x-moz-file');
}

export type UseMdFileDropZoneOptions = {
  enabled?: boolean;
  /** Return true if the drop was handled (prevents further default). */
  onMarkdownFiles: (files: File[]) => void | Promise<void>;
};

export function useMdFileDropZone(options: UseMdFileDropZoneOptions) {
  const { enabled = true, onMarkdownFiles } = options;
  const [isDragActive, setIsDragActive] = useState(false);
  const depthRef = useRef(0);
  const onFilesRef = useRef(onMarkdownFiles);
  onFilesRef.current = onMarkdownFiles;

  const reset = useCallback(() => {
    depthRef.current = 0;
    setIsDragActive(false);
  }, []);

  const onDragEnter = useCallback(
    (event: ReactDragEvent | DragEvent) => {
      if (!enabled) return;
      if (!dataTransferLooksLikeFiles(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      depthRef.current += 1;
      setIsDragActive(true);
    },
    [enabled],
  );

  const onDragOver = useCallback(
    (event: ReactDragEvent | DragEvent) => {
      if (!enabled) return;
      if (!dataTransferLooksLikeFiles(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      try {
        event.dataTransfer.dropEffect = 'copy';
      } catch {
        // ignore
      }
      if (!isDragActive) setIsDragActive(true);
    },
    [enabled, isDragActive],
  );

  const onDragLeave = useCallback(
    (event: ReactDragEvent | DragEvent) => {
      if (!enabled) return;
      event.preventDefault();
      event.stopPropagation();
      depthRef.current = Math.max(0, depthRef.current - 1);
      if (depthRef.current === 0) setIsDragActive(false);
    },
    [enabled],
  );

  const onDrop = useCallback(
    (event: ReactDragEvent | DragEvent) => {
      if (!enabled) return;
      event.preventDefault();
      event.stopPropagation();
      reset();
      const files = listFilesFromDataTransfer(event.dataTransfer);
      const mdFiles = files.filter((f) => isMarkdownFile(f));
      if (mdFiles.length === 0) return;
      void onFilesRef.current(mdFiles);
    },
    [enabled, reset],
  );

  const dropBind = {
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
  };

  return { isDragActive, dropBind, reset };
}

/** Document-level capture so the whole window is a drop target (workbench). */
export function useDocumentMdFileDrop(options: UseMdFileDropZoneOptions) {
  const { enabled = true, onMarkdownFiles } = options;
  const [isDragActive, setIsDragActive] = useState(false);
  const depthRef = useRef(0);
  const onFilesRef = useRef(onMarkdownFiles);
  onFilesRef.current = onMarkdownFiles;

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    const onDragEnter = (event: DragEvent) => {
      if (!dataTransferLooksLikeFiles(event.dataTransfer)) return;
      event.preventDefault();
      depthRef.current += 1;
      setIsDragActive(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (!dataTransferLooksLikeFiles(event.dataTransfer)) return;
      // 允许 drop；是否 md 在 drop 时再分流（dragover 常读不到文件名）
      event.preventDefault();
      try {
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      } catch {
        // ignore
      }
    };
    const onDragLeave = () => {
      depthRef.current = Math.max(0, depthRef.current - 1);
      if (depthRef.current === 0) setIsDragActive(false);
    };
    const onDrop = (event: DragEvent) => {
      const files = listFilesFromDataTransfer(event.dataTransfer);
      const mdFiles = files.filter((f) => isMarkdownFile(f));
      depthRef.current = 0;
      setIsDragActive(false);
      if (mdFiles.length === 0) {
        // 非 md（如图片）不拦截，交给 Composer 附件 dropzone
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void onFilesRef.current(mdFiles);
    };

    // capture：盖过 CodeMirror/Cherry 内部拖放，保证全窗可 drop
    document.addEventListener('dragenter', onDragEnter, true);
    document.addEventListener('dragover', onDragOver, true);
    document.addEventListener('dragleave', onDragLeave, true);
    document.addEventListener('drop', onDrop, true);
    return () => {
      document.removeEventListener('dragenter', onDragEnter, true);
      document.removeEventListener('dragover', onDragOver, true);
      document.removeEventListener('dragleave', onDragLeave, true);
      document.removeEventListener('drop', onDrop, true);
    };
  }, [enabled]);

  return { isDragActive };
}
