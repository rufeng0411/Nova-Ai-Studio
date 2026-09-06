// PD-SAAS-FORK: 工作台全 UI Markdown 拖放 → 新窗打开浏览器
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { isMdBrowserToolEnabled, subscribeMdBrowserToolEnabled } from '../../shared/mdBrowserGate';
import { openMdBrowserWithFiles, readRememberedMdBrowserProject } from '../../shared/mdBrowserOpen';
import { useDocumentMdFileDrop } from '../../shared/useMdFileDropZone';
import MdDropOverlay from './MdDropOverlay';

export default function WorkbenchMdDropHost() {
  const [enabled, setEnabled] = useState(() => isMdBrowserToolEnabled());

  useEffect(() => {
    setEnabled(isMdBrowserToolEnabled());
    return subscribeMdBrowserToolEnabled(() => setEnabled(isMdBrowserToolEnabled()));
  }, []);

  const onMarkdownFiles = useCallback(async (files: File[]) => {
    await openMdBrowserWithFiles(files, {
      project: readRememberedMdBrowserProject(),
    });
  }, []);

  const { isDragActive } = useDocumentMdFileDrop({
    enabled,
    onMarkdownFiles,
  });

  if (!enabled || typeof document === 'undefined') return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[90]">
      <MdDropOverlay active={isDragActive} mode="openWindow" />
    </div>,
    document.body,
  );
}
