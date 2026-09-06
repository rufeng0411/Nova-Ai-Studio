import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FolderOpen, Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Project } from '../../../types/app';
import type { DeliverableItem } from '../../../shared/collectDeliverables';
import { sortDeliverables } from '../../../shared/collectDeliverables';
import { classifyDeliverablePath, expandAmbiguousDeliverablePath, getArtifactFileName, normalizeArtifactPath, toProjectApiPath } from '../../../shared/artifactPaths';
import { cn } from '../../../lib/utils';
import { api } from '../../../utils/api';
import { isAudioFile } from '../../code-editor/utils/binaryFile';
import DeliverableThumb from './DeliverableThumb';
import DeliverablePreviewOverlay from './DeliverablePreviewOverlay';

type DeliverableFolderModalProps = {
 folderPath: string;
 folderName: string;
 selectedProject?: Project | null;
 onFileOpen?: (filePath: string) => void;
 fallbackItems: DeliverableItem[];
 onClose: () => void;
};

const FRAME_THUMB_LIMIT = 6;
type FolderFilter = 'all' | 'image' | 'html' | 'document' | 'spreadsheet' | 'media';

const FOLDER_FILTERS: { id: FolderFilter; label: string }[] = [
 { id: 'all', label: '全部' },
 { id: 'image', label: '图片' },
 { id: 'html', label: '网页' },
 { id: 'document', label: '文档' },
 { id: 'spreadsheet', label: '表格' },
 { id: 'media', label: '媒体' },
];

function buildItemFromRelativePath(relativePath: string, projectRoot?: string): DeliverableItem {
 const normalized = expandAmbiguousDeliverablePath(normalizeArtifactPath(relativePath));
 const kind = classifyDeliverablePath(normalized);
 const apiPath = toProjectApiPath(normalized, projectRoot) || normalized;
 return {
 id: `${kind}:${normalized.toLowerCase()}`,
 path: normalized,
 apiPath,
 kind,
 source: 'tool',
 };
}

export function DeliverableFolderModal({
 folderPath,
 folderName,
 selectedProject,
 onFileOpen,
 fallbackItems,
 onClose,
}: DeliverableFolderModalProps) {
 const { t } = useTranslation('chat');
 const projectRoot = selectedProject?.fullPath || selectedProject?.path || '';
 const [items, setItems] = useState<DeliverableItem[]>(fallbackItems);
 const [loading, setLoading] = useState(true);
 const [overlayIndex, setOverlayIndex] = useState<number | null>(null);
 const [filter, setFilter] = useState<FolderFilter>('all');

 useEffect(() => {
 let cancelled = false;
 const projectName = selectedProject?.name;
 if (!projectName || !folderPath) {
 setLoading(false);
 return;
 }
 setLoading(true);
 api
 .listProjectFolder(projectName, folderPath)
 .then((response) => response.json())
 .then((data) => {
 if (cancelled) return;
 const entries = Array.isArray(data?.entries) ? data.entries : [];
 const fileItems = entries
 .filter((entry: { type?: string }) => entry.type === 'file')
 .map((entry: { relativePath: string }) => buildItemFromRelativePath(entry.relativePath, projectRoot));
 setItems(sortDeliverables(fileItems.length > 0 ? fileItems : fallbackItems));
 })
 .catch(() => {
 if (!cancelled) setItems(sortDeliverables(fallbackItems));
 })
 .finally(() => {
 if (!cancelled) setLoading(false);
 });
 return () => {
 cancelled = true;
 };
 }, [fallbackItems, folderPath, projectRoot, selectedProject?.name]);

 useEffect(() => {
 const onKeyDown = (event: KeyboardEvent) => {
 if (event.key === 'Escape' && overlayIndex === null) {
 event.preventDefault();
 onClose();
 }
 };
 document.addEventListener('keydown', onKeyDown);
 return () => document.removeEventListener('keydown', onKeyDown);
 }, [onClose, overlayIndex]);

 useEffect(() => {
 const original = document.body.style.overflow;
 document.body.style.overflow = 'hidden';
 return () => {
 document.body.style.overflow = original;
 };
 }, []);

 const filteredItems = useMemo(() => {
 if (filter === 'all') return items;
 return items.filter((item) => {
 const fileName = getArtifactFileName(item.apiPath || item.path);
 if (filter === 'media') return item.kind === 'video' || isAudioFile(fileName);
 return item.kind === filter;
 });
 }, [filter, items]);

 const frameAllowance = useMemo(() => {
 let used = 0;
 return filteredItems.map((item) => {
 const wantsFrame = item.kind === 'html' || item.kind === 'video';
 if (wantsFrame && used < FRAME_THUMB_LIMIT) {
 used += 1;
 return true;
 }
 return !wantsFrame;
 });
 }, [filteredItems]);

 if (typeof document === 'undefined') return null;

 const handleReveal = () => {
 if (!selectedProject?.name || !folderPath) return;
 void api.revealProjectPath(selectedProject.name, folderPath, 'folder').catch(() => {});
 };

 return createPortal(
 <div
 role="dialog"
 aria-modal="true"
 aria-label={folderName}
 data-testid="deliverable-folder-modal"
 className="fixed inset-0 z-[2147483646] flex flex-col bg-black/70 p-3 sm:p-5"
 onClick={onClose}
 >
 <div
 className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-sidebar shadow-2xl"
 onClick={(event) => event.stopPropagation()}
 >
 <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
 <div className="flex min-w-0 items-center gap-2">
 <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
 <span className="min-w-0 truncate text-sm font-medium text-foreground" title={folderPath}>
 {folderName}
 </span>
 <span className="shrink-0 rounded-full bg-border px-2 py-0.5 text-[11px] text-muted-foreground">
 {t('deliverables.folderFiles', { defaultValue: '{{count}} 个文件', count: items.length })}
 </span>
 </div>
 <div className="flex shrink-0 items-center gap-1">
 <button
 type="button"
 onClick={handleReveal}
 disabled={!selectedProject?.name}
 className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-border disabled:opacity-50"
 >
 <FolderOpen className="h-3.5 w-3.5" />
 {t('deliverables.openFolderSystem', { defaultValue: '在系统中打开' })}
 </button>
 <button
 type="button"
 onClick={onClose}
 className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-border"
 aria-label={t('deliverables.closePreview', { defaultValue: '关闭预览' })}
 >
 <X className="h-4 w-4" />
 </button>
 </div>
 </div>

 <div className="flex shrink-0 flex-wrap gap-1 border-b border-border px-4 py-2">
 {FOLDER_FILTERS.map((item) => (
 <button
 key={item.id}
 type="button"
 className={cn(
 'rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-border hover:text-foreground',
 filter === item.id && 'bg-border text-foreground',
 )}
 onClick={() => {
 setFilter(item.id);
 setOverlayIndex(null);
 }}
 >
 {item.label}
 </button>
 ))}
 </div>

 <div className="min-h-0 flex-1 overflow-auto p-4">
 {loading ? (
 <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
 <Loader2 className="h-4 w-4 animate-spin" />
 {t('deliverables.loadingFolder', { defaultValue: '正在读取文件夹…' })}
 </div>
 ) : filteredItems.length === 0 ? (
 <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
 {t('deliverables.emptyFolder', { defaultValue: '该文件夹暂无可预览的文件' })}
 </div>
 ) : (
 <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
 {filteredItems.map((item, idx) => (
 <DeliverableThumb
 key={item.id}
 item={item}
 selectedProject={selectedProject}
 allowFrame={frameAllowance[idx]}
 onActivate={() => setOverlayIndex(idx)}
 />
 ))}
 </div>
 )}
 </div>
 </div>

 {overlayIndex !== null ? (
 <DeliverablePreviewOverlay
items={filteredItems}
 index={overlayIndex}
 onIndexChange={setOverlayIndex}
 selectedProject={selectedProject}
 onFileOpen={onFileOpen}
 onClose={() => setOverlayIndex(null)}
 />
 ) : null}
 </div>,
 document.body,
 );
}

export default DeliverableFolderModal;
