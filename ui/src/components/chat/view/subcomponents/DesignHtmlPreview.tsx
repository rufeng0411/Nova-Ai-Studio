import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Maximize2, X } from 'lucide-react';
import type { Project } from '../../../../types/app';
import { WebPreviewFrame } from '../../../super-preview/adapters/web/WebPreviewAdapter';
import { useDesignHtmlPreviewUrl } from './designHtmlPreviewUrl';

type DesignHtmlPreviewProps = {
 filePath: string;
 selectedProject: Project | null;
 variant?: 'inline' | 'modal-only';
 modalOpen?: boolean;
 onModalOpenChange?: (open: boolean) => void;
};

export function DesignHtmlPreviewModal({
 open,
 onClose,
 filePath,
 selectedProject: _selectedProject,
 previewSrc,
}: {
 open: boolean;
 onClose: () => void;
 filePath: string;
 selectedProject: Project | null;
 previewSrc: string;
}) {
 if (!open) return null;

 const fileName = filePath.split('/').pop() || filePath;

 return createPortal(
 <div
 className="fixed inset-0 z-[120] flex flex-col bg-black/70 p-3 sm:p-5"
 role="dialog"
 aria-modal="true"
 aria-label={`预览 ${fileName}`}
 onClick={onClose}
 >
 <div
 className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-neutral-950 shadow-2xl"
 onClick={(event) => event.stopPropagation()}
 >
 <div className="flex shrink-0 items-center justify-between gap-3 border-b border-primary/30 px-4 py-2.5">
 <div className="min-w-0 truncate font-mono text-xs text-neutral-200" title={filePath}>
 {fileName}
 </div>
 <div className="flex shrink-0 items-center gap-1">
 {previewSrc ? (
 <a
 href={previewSrc}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-neutral-800 hover:text-primary-foreground"
 >
 <ExternalLink className="h-3.5 w-3.5" />
 新标签
 </a>
 ) : null}
 <button
 type="button"
 onClick={onClose}
 className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-neutral-800 hover:text-primary-foreground"
 aria-label="关闭预览"
 >
 <X className="h-4 w-4" />
 </button>
 </div>
 </div>
 <div className="min-h-0 flex-1 bg-card">
 <WebPreviewFrame
 src={previewSrc}
 title={fileName}
 className="h-full w-full border-0 bg-card"
sandbox="allow-scripts allow-same-origin"
 />
 </div>
 </div>
 </div>,
 document.body,
 );
}

export default function DesignHtmlPreview({
 filePath,
 selectedProject,
 variant = 'inline',
 modalOpen: controlledModalOpen,
 onModalOpenChange,
}: DesignHtmlPreviewProps) {
 const [internalModalOpen, setInternalModalOpen] = useState(false);
 const modalOpen = controlledModalOpen ?? internalModalOpen;
 const setModalOpen = onModalOpenChange ?? setInternalModalOpen;
 const previewSrc = useDesignHtmlPreviewUrl(selectedProject, filePath, 0);
 const fileName = filePath.split('/').pop() || filePath;

 if (variant === 'modal-only') {
 return (
 <DesignHtmlPreviewModal
 open={modalOpen}
 onClose={() => setModalOpen(false)}
 filePath={filePath}
 selectedProject={selectedProject}
 previewSrc={previewSrc}
 />
 );
 }

 return (
<div className="my-2 w-full min-w-0 max-w-full">
 <div className="mb-1.5 flex flex-wrap items-center gap-2">
 <span className="text-[11px] text-muted-foreground">页面预览</span>
 <button
 type="button"
 onClick={() => setModalOpen(true)}
 className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[11px] text-foreground transition-colors hover:bg-sidebar"
 >
 <Maximize2 className="h-3 w-3" />
 放大预览
 </button>
 {previewSrc ? (
 <a
 href={previewSrc}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline dark:text-blue-400"
 >
 <ExternalLink className="h-3 w-3" />
 新标签打开
 </a>
 ) : null}
 </div>
<div className="w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-border bg-card shadow-sm">
 <div className="relative aspect-[16/10] max-h-[min(72vh,520px)] w-full max-w-full">
<WebPreviewFrame
 src={previewSrc}
 title={fileName}
 className="absolute inset-0 h-full w-full max-w-full border-0"
sandbox="allow-scripts allow-same-origin"
 />
 </div>
 </div>
 <DesignHtmlPreviewModal
 open={modalOpen}
 onClose={() => setModalOpen(false)}
 filePath={filePath}
 selectedProject={selectedProject}
 previewSrc={previewSrc}
 />
 </div>
 );
}
