import { useEffect } from 'react';
import ProcessTemplateGallery from './ProcessTemplateGallery.js';
import type { Project } from '../../types/app';

type ProcessTemplateDialogProps = {
 open: boolean;
 selectedProject: Project | null;
 onTryTemplate: (prompt: string) => void;
 onClose: () => void;
};

export default function ProcessTemplateDialog({
 open,
 selectedProject,
 onTryTemplate,
 onClose,
}: ProcessTemplateDialogProps) {
 useEffect(() => {
 if (!open) return;
 const onKeyDown = (event: KeyboardEvent) => {
 if (event.key === 'Escape') onClose();
 };
 document.addEventListener('keydown', onKeyDown);
 return () => document.removeEventListener('keydown', onKeyDown);
 }, [open, onClose]);

 if (!open) return null;

 return (
 <div
 className="fixed inset-0 z-[100] flex items-end justify-center bg-black/30 p-4 backdrop-blur-[2px] sm:items-center"
 role="dialog"
 aria-modal="true"
 onMouseDown={(event) => {
 if (event.target === event.currentTarget) onClose();
 }}
 >
 <div className="flex w-full max-w-[960px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
 <ProcessTemplateGallery
 selectedProject={selectedProject}
 onTryTemplate={onTryTemplate}
 onClose={onClose}
 />
 </div>
 </div>
 );
}
