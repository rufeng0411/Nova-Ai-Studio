import React, { useState } from 'react';
import { Folder } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Project } from '../../../types/app';
import type { DeliverableFolderNode } from '../../../shared/groupDeliverables';
import { DeliverableThumbVisual } from './DeliverableThumb';
import DeliverableFolderModal from './DeliverableFolderModal';

type DeliverableFolderCardProps = {
 node: DeliverableFolderNode;
 selectedProject?: Project | null;
 onFileOpen?: (filePath: string) => void;
 allowFrame?: boolean;
};

export function DeliverableFolderCard({ node, selectedProject, onFileOpen, allowFrame = true }: DeliverableFolderCardProps) {
 const { t } = useTranslation('chat');
 const [open, setOpen] = useState(false);

 return (
 <>
 <button
 type="button"
 onClick={() => setOpen(true)}
 data-testid="deliverable-folder-card"
 className="block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
 title={node.folderPath}
 >
 <div className="relative">
 <DeliverableThumbVisual
 item={node.cover}
 selectedProject={selectedProject}
 allowFrame={allowFrame}
 badge={t('deliverables.folderBadge', { defaultValue: '文件夹' })}
 />
 <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent px-2 py-1 text-[11px] text-primary-foreground">
 <span className="flex min-w-0 items-center gap-1">
 <Folder className="h-3 w-3 shrink-0" />
 <span className="truncate">{node.folderName}</span>
 </span>
 <span className="shrink-0 rounded bg-card/20 px-1.5 py-0.5 text-[10px] tabular-nums">
 {t('deliverables.folderFiles', { defaultValue: '{{count}} 个文件', count: node.items.length })}
 </span>
 </span>
 </div>
 </button>

 {open ? (
 <DeliverableFolderModal
 folderPath={node.folderPath}
 folderName={node.folderName}
 selectedProject={selectedProject}
 onFileOpen={onFileOpen}
 fallbackItems={node.items}
 onClose={() => setOpen(false)}
 />
 ) : null}
 </>
 );
}

export default DeliverableFolderCard;
