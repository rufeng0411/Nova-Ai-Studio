// PD-SAAS-FORK: file tree expands ancestor folders, scrolls to and highlights primary deliverable
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
 AtSign,
 ChevronDown,
 ChevronRight,
 ChevronsDownUp,
 ClipboardCopy,
 Download,
 Eye,
 FilePlus,
 Folder,
 FolderOpen,
 FolderPlus,
 Loader2,
 Pencil,
 RefreshCw,
 Trash2,
 Upload,
 X,
} from 'lucide-react';
import type { Project } from '../../types/app';
import { useFileTreeData } from '../file-tree/hooks/useFileTreeData';
import type { FileTreeNode } from '../file-tree/types/types';
import { getFileIconData } from '../file-tree/constants/fileIcons';
import { cn } from '../../lib/utils.js';
import { api } from '../../utils/api';
import { copyTextToClipboard } from '../../utils/clipboard';
import { isImeEnterEvent } from '../../utils/ime';
import { findFileTreeNode } from '../../shared/fileTreeNavigation';
import { resolveFilesTabRootLabel } from '../../shared/projectLabels';
import { requestFileReferences } from '../../shared/fileReferenceBridge';
// PD-SAAS-FORK: mobile files is read-only — no context menu / mutation actions.
import { useMobileShell } from '../../hooks/useMobileShell';
import { useAuth } from '../auth/context/AuthContext';
import { isSaasAdmin } from '../../saas/auth/roles';
import { IS_SAAS_MODE } from '../../constants/config';
export type FilesNavigationTarget = {
 filePath: string;
 folderPath?: string;
 id: number;
 /** PD-SAAS-FORK: disambiguate bare filenames in file tree navigation */
 hintDir?: string;
};

type FilesV2Props = {
 selectedProject: Project | null;
 onFileOpen?: (filePath: string) => void;
 navigationTarget?: FilesNavigationTarget | null;
 onClose?: () => void;
};

type FlattenedNode = {
 node: FileTreeNode;
 depth: number;
 parentPath: string;
};

type FileContextMenu = {
 node: FileTreeNode | null;
 x: number;
 y: number;
};

type InlineEdit =
 | { kind: 'rename'; path: string; currentName: string; depth: number }
 | { kind: 'create'; parentPath: string; type: 'file' | 'directory'; depth: number };

const CONTEXT_MENU_WIDTH = 180;
const CONTEXT_MENU_HEIGHT = 248;
const CONTEXT_MENU_MARGIN = 8;

function clampMenuPosition(x: number, y: number) {
 const maxX = window.innerWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_MARGIN;
 const maxY = window.innerHeight - CONTEXT_MENU_HEIGHT - CONTEXT_MENU_MARGIN;
 return {
 x: Math.max(CONTEXT_MENU_MARGIN, Math.min(x, maxX)),
 y: Math.max(CONTEXT_MENU_MARGIN, Math.min(y, maxY)),
 };
}

function flatten(
 nodes: FileTreeNode[],
 expanded: Set<string>,
 depth = 0,
 parentPath = '',
): FlattenedNode[] {
 const out: FlattenedNode[] = [];
 for (const node of nodes) {
 out.push({ node, depth, parentPath });
 if (node.type === 'directory' && expanded.has(node.path) && node.children) {
 out.push(...flatten(node.children, expanded, depth + 1, node.path));
 }
 }
 return out;
}

/** Collect project-relative paths for every file under a tree node (folder → all descendants). */
function collectFilePathsUnderNode(node: FileTreeNode): string[] {
 if (node.type === 'file') {
 return [node.path];
 }
 const paths: string[] = [];
 for (const child of node.children ?? []) {
 paths.push(...collectFilePathsUnderNode(child));
 }
 return paths;
}

export default function FilesV2({ selectedProject, onFileOpen, navigationTarget, onClose }: FilesV2Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isMobile = useMobileShell();
  const saasReadOnlyFiles = IS_SAAS_MODE && !isSaasAdmin(user);
  const { files, loading, refreshFiles, prunePaths } = useFileTreeData(selectedProject);
 const [expanded, setExpanded] = useState<Set<string>>(new Set());
 const [activePath, setActivePath] = useState<string | null>(null);
 const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set());
 const [focusPath, setFocusPath] = useState<string | null>(null);
 const [contextMenu, setContextMenu] = useState<FileContextMenu | null>(null);
 const [inlineEdit, setInlineEdit] = useState<InlineEdit | null>(null);
 const [uploadingProject, setUploadingProject] = useState(false);
 const [downloadingProject, setDownloadingProject] = useState(false);
 const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
 const inlineInputRef = useRef<HTMLInputElement>(null);
 const escapePressedRef = useRef(false);
 const fileInputRef = useRef<HTMLInputElement | null>(null);
 const folderInputRef = useRef<HTMLInputElement | null>(null);
 const navRefreshRef = useRef<number | null>(null);
 const selectionAnchorRef = useRef<number | null>(null);

 useEffect(() => {
 if (!navigationTarget?.id) return;
 if (navRefreshRef.current === navigationTarget.id) return;
 navRefreshRef.current = navigationTarget.id;
 refreshFiles();
 }, [navigationTarget?.id, refreshFiles]);

 useEffect(() => {
 setExpanded(new Set());
 setActivePath(null);
 setSelectedPaths(new Set());
 setFocusPath(null);
 setContextMenu(null);
 setInlineEdit(null);
 setUploadMenuOpen(false);
 }, [selectedProject?.name]);

 useEffect(() => {
 if (!navigationTarget?.filePath || loading || files.length === 0) return;

 // Raw node paths (absolute + backslashes on Windows) must be used for
 // expanded/activePath — normalized strings never match `node.path`.
 const match = findFileTreeNode(files, navigationTarget.filePath, navigationTarget.hintDir);
 if (!match) return;

 setExpanded((prev) => {
 const next = new Set(prev);
 for (const folderPath of match.ancestorPaths) {
 next.add(folderPath);
 }
 return next;
 });
 setActivePath(match.path);
 setFocusPath(match.path);

 const scrollTimer = window.setTimeout(() => {
 const row = document.querySelector(
 `[data-file-tree-path="${CSS.escape(match.path)}"]`,
 );
 row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
 }, 120);

 const clearFocusTimer = window.setTimeout(() => {
 setFocusPath((current) => (current === match.path ? null : current));
 }, 8000);

 return () => {
 window.clearTimeout(scrollTimer);
 window.clearTimeout(clearFocusTimer);
 };
 }, [files, loading, navigationTarget?.filePath, navigationTarget?.id]);

 const setFolderInputRef = useCallback((el: HTMLInputElement | null) => {
 folderInputRef.current = el;
 if (el) {
 el.setAttribute('webkitdirectory', '');
 el.setAttribute('directory', '');
 }
 }, []);

 useEffect(() => {
 if (!uploadMenuOpen) return;
 const dismiss = () => setUploadMenuOpen(false);
 window.addEventListener('click', dismiss);
 return () => window.removeEventListener('click', dismiss);
 }, [uploadMenuOpen]);

 const flat = useMemo(() => flatten(files, expanded), [files, expanded]);

 const projectName = selectedProject?.name ?? '';

 const toggle = useCallback((path: string) => {
 setExpanded((prev) => {
 const next = new Set(prev);
 if (next.has(path)) next.delete(path);
 else next.add(path);
 return next;
 });
 }, []);

 const collapseAll = useCallback(() => {
 setExpanded(new Set());
 }, []);

 const handleClick = useCallback(
 (node: FileTreeNode, event: ReactMouseEvent) => {
 const rowIndex = flat.findIndex((entry) => entry.node.path === node.path);
 setActivePath(node.path);
 setFocusPath(null);

 if (node.type === 'directory') {
 if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
 setSelectedPaths(new Set());
 selectionAnchorRef.current = rowIndex >= 0 ? rowIndex : null;
 }
 toggle(node.path);
 return;
 }

 if (event.shiftKey && selectionAnchorRef.current != null && rowIndex >= 0) {
 const start = Math.min(selectionAnchorRef.current, rowIndex);
 const end = Math.max(selectionAnchorRef.current, rowIndex);
 const rangePaths = flat
 .slice(start, end + 1)
 .filter((entry) => entry.node.type === 'file')
 .map((entry) => entry.node.path);
 setSelectedPaths(new Set(rangePaths));
 } else if (event.ctrlKey || event.metaKey) {
 setSelectedPaths((previous) => {
 const next = new Set(previous);
 if (next.has(node.path)) {
 next.delete(node.path);
 } else {
 next.add(node.path);
 }
 return next;
 });
 selectionAnchorRef.current = rowIndex >= 0 ? rowIndex : selectionAnchorRef.current;
 } else {
 setSelectedPaths(new Set([node.path]));
 selectionAnchorRef.current = rowIndex >= 0 ? rowIndex : null;
 onFileOpen?.(node.path);
 }
 },
 [flat, onFileOpen, toggle],
 );

 // --- Context menu ---

 const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleContextMenu = useCallback(
    (event: ReactMouseEvent, node: FileTreeNode) => {
      event.preventDefault();
      event.stopPropagation();
      // PD-SAAS-FORK: long-press would open the mutation menu — mobile is read-only.
      if (isMobile) return;
      if (node.type === 'file') {
        setSelectedPaths((previous) => {
          if (previous.has(node.path)) {
            return previous;
          }
          return new Set([node.path]);
        });
        setActivePath(node.path);
      }
      const pos = clampMenuPosition(event.clientX, event.clientY);
      setContextMenu({ node, x: pos.x, y: pos.y });
    },
    [isMobile],
  );

  const handleBlankContextMenu = useCallback(
    (event: ReactMouseEvent) => {
      if ((event.target as HTMLElement).closest('li')) return;
      event.preventDefault();
      if (isMobile) return;
      const pos = clampMenuPosition(event.clientX, event.clientY);
      setContextMenu({ node: null, x: pos.x, y: pos.y });
    },
    [isMobile],
  );

 useEffect(() => {
 if (!contextMenu) return;
 const dismiss = () => closeContextMenu();
 const onKey = (event: KeyboardEvent) => {
 if (event.key === 'Escape') dismiss();
 };
 window.addEventListener('click', dismiss);
 window.addEventListener('resize', dismiss);
 window.addEventListener('scroll', dismiss, true);
 window.addEventListener('keydown', onKey);
 return () => {
 window.removeEventListener('click', dismiss);
 window.removeEventListener('resize', dismiss);
 window.removeEventListener('scroll', dismiss, true);
 window.removeEventListener('keydown', onKey);
 };
 }, [contextMenu, closeContextMenu]);

 // --- Inline edit ---

 useEffect(() => {
 if (inlineEdit && inlineInputRef.current) {
 inlineInputRef.current.focus();
 if (inlineEdit.kind === 'rename') {
 const dotIdx = inlineEdit.currentName.lastIndexOf('.');
 const end = dotIdx > 0 ? dotIdx : inlineEdit.currentName.length;
 inlineInputRef.current.setSelectionRange(0, end);
 } else {
 inlineInputRef.current.select();
 }
 }
 }, [inlineEdit]);

 const commitInlineEdit = useCallback(
 async (value: string) => {
 if (!selectedProject || !inlineEdit) return;
 const trimmed = value.trim();
 if (!trimmed) {
 setInlineEdit(null);
 return;
 }

 try {
 if (inlineEdit.kind === 'rename') {
 if (trimmed === inlineEdit.currentName) {
 setInlineEdit(null);
 return;
 }
 await api.renameFile(projectName, {
 oldPath: inlineEdit.path,
 newName: trimmed,
 });
 } else {
 const parentPath = inlineEdit.parentPath || '';
 await api.createFile(projectName, {
 path: parentPath || undefined,
 type: inlineEdit.type,
 name: trimmed,
 });
 if (parentPath) {
 setExpanded((prev) => {
 const next = new Set(prev);
 next.add(parentPath);
 return next;
 });
 }
 }
 await refreshFiles();
 } catch (error) {
 console.error('File operation failed:', error);
 }
 setInlineEdit(null);
 },
 [inlineEdit, projectName, refreshFiles, selectedProject],
 );

 const handleInlineKeyDown = useCallback(
 (event: React.KeyboardEvent<HTMLInputElement>) => {
 if (event.key === 'Enter') {
 if (isImeEnterEvent(event)) {
 return;
 }
 event.preventDefault();
 commitInlineEdit(event.currentTarget.value);
 } else if (event.key === 'Escape') {
 event.preventDefault();
 escapePressedRef.current = true;
 setInlineEdit(null);
 }
 },
 [commitInlineEdit],
 );

 const handleInlineBlur = useCallback(
 (event: React.FocusEvent<HTMLInputElement>) => {
 if (escapePressedRef.current) {
 escapePressedRef.current = false;
 setInlineEdit(null);
 return;
 }
 commitInlineEdit(event.currentTarget.value);
 },
 [commitInlineEdit],
 );

 // --- Menu actions ---

 const handleNewFile = useCallback(
 (parentPath: string, depth: number) => {
 closeContextMenu();
 if (parentPath) {
 setExpanded((prev) => {
 const next = new Set(prev);
 next.add(parentPath);
 return next;
 });
 }
 setInlineEdit({ kind: 'create', parentPath, type: 'file', depth });
 },
 [closeContextMenu],
 );

 const handleNewFolder = useCallback(
 (parentPath: string, depth: number) => {
 closeContextMenu();
 if (parentPath) {
 setExpanded((prev) => {
 const next = new Set(prev);
 next.add(parentPath);
 return next;
 });
 }
 setInlineEdit({ kind: 'create', parentPath, type: 'directory', depth });
 },
 [closeContextMenu],
 );

 const handleRename = useCallback(
 (node: FileTreeNode, depth: number) => {
 closeContextMenu();
 setInlineEdit({ kind: 'rename', path: node.path, currentName: node.name, depth });
 },
 [closeContextMenu],
 );

 const handleDelete = useCallback(
 async (node: FileTreeNode) => {
 closeContextMenu();
 if (!selectedProject) return;
 const confirmed = window.confirm(
 `Delete "${node.name}"?${node.type === 'directory' ? ' This will delete all contents.' : ''}`,
 );
 if (!confirmed) return;
 prunePaths([node.path]);
 try {
 await api.deleteFile(projectName, {
 path: node.path,
 type: node.type === 'directory' ? 'directory' : 'file',
 });
 await refreshFiles();
 } catch (error) {
 console.error('Delete failed:', error);
 await refreshFiles();
 }
 },
 [closeContextMenu, projectName, prunePaths, refreshFiles, selectedProject],
 );

 const handleCopyPath = useCallback(
 (node: FileTreeNode) => {
 closeContextMenu();
 void copyTextToClipboard(node.path);
 },
 [closeContextMenu],
 );

 const handleOpen = useCallback(
 (node: FileTreeNode) => {
 closeContextMenu();
 onFileOpen?.(node.path);
 },
 [closeContextMenu, onFileOpen],
 );

 const handleReference = useCallback(
 (node: FileTreeNode | null) => {
 closeContextMenu();
 if (!node) return;

 let targets: string[];
 if (node.type === 'file') {
 targets = selectedPaths.has(node.path)
 ? Array.from(selectedPaths)
 : [node.path];
 } else {
 const fromSelection = Array.from(selectedPaths);
 targets = fromSelection.length > 0 ? fromSelection : collectFilePathsUnderNode(node);
 }

 if (targets.length > 0) {
 requestFileReferences(targets);
 }
 },
 [closeContextMenu, selectedPaths],
 );

 // --- Upload / Download / Preview ---

 const projectRoot = selectedProject?.fullPath || selectedProject?.path || '';

 const uploadSelectedFiles = useCallback(
 async (fileList: FileList | null) => {
 if (!selectedProject?.name || !fileList || fileList.length === 0) return;

 const fileArray = Array.from(fileList);
 const relativePaths = fileArray.map((file) => {
 const withDir = file as File & { webkitRelativePath?: string };
 return withDir.webkitRelativePath || file.name;
 });

 const formData = new FormData();
 formData.append('targetPath', '');
 formData.append('relativePaths', JSON.stringify(relativePaths));
 for (const file of fileArray) {
 formData.append('files', file);
 }

 try {
 setUploadingProject(true);
 setUploadMenuOpen(false);
 const response = await api.uploadFiles(selectedProject.name, formData);
 if (!response.ok) {
 const errorText = await response.text().catch(() => '');
 throw new Error(errorText || `Upload failed: ${response.status}`);
 }
 await refreshFiles();
 } catch (error) {
 console.error('Failed to upload files:', error);
 } finally {
 setUploadingProject(false);
 }
 },
 [refreshFiles, selectedProject?.name],
 );

 const handleDownloadProject = useCallback(async () => {
 if (!selectedProject?.name || downloadingProject) return;

 try {
 setDownloadingProject(true);
 const response = await api.downloadProjectZip(selectedProject.name);
 if (!response.ok) {
 throw new Error(`Download failed: ${response.status}`);
 }

 const blob = await response.blob();
 const url = URL.createObjectURL(blob);
 const anchor = document.createElement('a');
 anchor.href = url;
 anchor.download = `${selectedProject.displayName || selectedProject.name}.zip`;
 document.body.appendChild(anchor);
 anchor.click();
 document.body.removeChild(anchor);
 URL.revokeObjectURL(url);
 } catch (error) {
 console.error('Failed to download project archive:', error);
 } finally {
 setDownloadingProject(false);
 }
 }, [downloadingProject, selectedProject?.displayName, selectedProject?.name]);

 const handleOpenHtmlPreview = useCallback(
 (event: ReactMouseEvent<HTMLButtonElement>, node: FileTreeNode) => {
 event.stopPropagation();
 if (!selectedProject?.name) return;

 const previewUrl = api.projectPreviewUrl(selectedProject.name, node.path, projectRoot);
 window.open(previewUrl, '_blank', 'noopener');
 },
 [projectRoot, selectedProject?.name],
 );

 const handleDownloadFile = useCallback(
 (event: ReactMouseEvent<HTMLButtonElement> | null, node: FileTreeNode) => {
 event?.stopPropagation();
 if (!selectedProject?.name || node.type === 'directory') return;

 const url = api.fileDownloadUrl(selectedProject.name, node.path);
 const anchor = document.createElement('a');
 anchor.href = url;
 anchor.download = node.name;
 document.body.appendChild(anchor);
 anchor.click();
 document.body.removeChild(anchor);
 },
 [selectedProject?.name],
 );

 const handleDeleteActive = useCallback(() => {
 if (!activePath) return;
 const activeNode = flat.find((f) => f.node.path === activePath);
 if (activeNode) handleDelete(activeNode.node);
 }, [activePath, flat, handleDelete]);

 // --- Depth lookup for context menu target ---

 const depthByPath = useMemo(() => {
 const map = new Map<string, number>();
 for (const { node, depth } of flat) {
 map.set(node.path, depth);
 }
 return map;
 }, [flat]);

 // --- Render ---

 if (!selectedProject) {
 return (
 <div className="flex h-full items-center justify-center bg-card text-[13px] text-muted-foreground">
 {t('fileTree.selectProject', { defaultValue: 'Pick a project to browse files.' })}
 </div>
 );
 }

 const folderLabel = resolveFilesTabRootLabel(selectedProject, t);
 const hasExpanded = expanded.size > 0;

 const menuItemClass = cn(
 'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors',
 'text-foreground hover:bg-muted',
 );
 const menuIconClass = 'h-3.5 w-3.5 shrink-0 text-muted-foreground';

 const renderInlineInput = (depth: number) => (
 <li
 key="__inline_edit__"
 style={{ marginLeft: `${depth * 20}px` }}
 className="flex items-center gap-2 rounded-md px-1.5 py-0.5"
 >
 <span className="w-3.5" />
 {inlineEdit?.kind === 'create' && inlineEdit.type === 'directory' ? (
 <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
 ) : inlineEdit?.kind === 'create' ? (
 <FilePlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
 ) : null}
 <input
 ref={inlineInputRef}
 defaultValue={inlineEdit?.kind === 'rename' ? inlineEdit.currentName : ''}
 onKeyDown={handleInlineKeyDown}
 onBlur={handleInlineBlur}
 className={cn(
 'min-w-0 flex-1 rounded border px-1.5 py-0.5 text-[13px] outline-none',
 'border-blue-400 bg-card text-foreground focus:ring-1 focus:ring-blue-400',
 'dark:border-blue-500 dark:focus:ring-blue-500',
 )}
 />
 </li>
 );

 const findInsertIndex = (parentPath: string): number => {
 if (!parentPath) return flat.length;
 const parentIdx = flat.findIndex((f) => f.node.path === parentPath);
 if (parentIdx === -1) return flat.length;
 const parentDepth = flat[parentIdx].depth;
 let i = parentIdx + 1;
 while (i < flat.length && flat[i].depth > parentDepth) i++;
 return i;
 };

 return (
 <div className="flex h-full flex-col bg-background">
 <div className="shrink-0 border-b border-border">
 <div className="flex h-7 min-w-0 items-center gap-1.5 px-3 pt-1">
 <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
 <span className="truncate text-xs font-medium text-foreground">
 {folderLabel}
 </span>
 </div>
 <div className="flex items-center gap-1 px-3 pb-1">
        {/* PD-SAAS-FORK: SaaS + mobile — read-only file tree (download only). */}
        {!saasReadOnlyFiles ? (
        <>
        <button
          type="button"
          onClick={() => handleNewFile('', 0)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted max-md:hidden dark:hover:bg-primary"
          title={t('fileTree.context.newFile', { defaultValue: 'New File' }) as string}
          aria-label={t('fileTree.context.newFile', { defaultValue: 'New File' }) as string}
        >
          <FilePlus className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => handleNewFolder('', 0)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted max-md:hidden dark:hover:bg-primary"
          title={t('fileTree.context.newFolder', { defaultValue: 'New Folder' }) as string}
          aria-label={t('fileTree.context.newFolder', { defaultValue: 'New Folder' }) as string}
        >
          <FolderPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
        <div className="relative max-md:hidden">
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); setUploadMenuOpen((open) => !open); }}
 disabled={uploadingProject}
 className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted disabled:opacity-50 dark:hover:bg-primary"
 title={t('fileTree.upload', { defaultValue: 'Upload files or folder' }) as string}
 aria-label={t('fileTree.upload', { defaultValue: 'Upload files or folder' }) as string}
 >
 {uploadingProject ? (
 <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
 ) : (
 <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
 )}
 </button>
 {uploadMenuOpen ? (
 <div className="absolute left-0 top-8 z-20 w-36 rounded-md border border-border bg-card py-1 text-[12px] shadow-lg">
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); setUploadMenuOpen(false); fileInputRef.current?.click(); }}
 className="block w-full px-3 py-1.5 text-left text-foreground hover:bg-muted dark:hover:bg-primary"
 >
 {t('fileTree.uploadFiles', { defaultValue: 'Upload files' })}
 </button>
 <button
 type="button"
 onClick={(e) => { e.stopPropagation(); setUploadMenuOpen(false); folderInputRef.current?.click(); }}
 className="block w-full px-3 py-1.5 text-left text-foreground hover:bg-muted dark:hover:bg-primary"
 >
 {t('fileTree.uploadFolder', { defaultValue: 'Upload folder' })}
 </button>
 </div>
 ) : null}
 <input
 ref={fileInputRef}
 type="file"
 multiple
 className="hidden"
 onChange={(event) => {
 void uploadSelectedFiles(event.currentTarget.files);
 event.currentTarget.value = '';
 }}
 />
 <input
 ref={setFolderInputRef}
 type="file"
 multiple
 className="hidden"
 onChange={(event) => {
 void uploadSelectedFiles(event.currentTarget.files);
 event.currentTarget.value = '';
 }}
 />
 </div>
        </>
        ) : null}
 <button
 type="button"
 onClick={handleDownloadProject}
 disabled={downloadingProject}
 className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted disabled:opacity-50 dark:hover:bg-primary"
 title={t('fileTree.downloadProject', { defaultValue: 'Download project as zip' }) as string}
 aria-label={t('fileTree.downloadProject', { defaultValue: 'Download project as zip' }) as string}
 >
 {downloadingProject ? (
 <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
 ) : (
 <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
 )}
 </button>
        {!saasReadOnlyFiles ? (
        <button
          type="button"
          onClick={handleDeleteActive}
          disabled={!activePath}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted disabled:opacity-40 max-md:hidden dark:hover:bg-primary"
          title={t('fileTree.deleteSelected', { defaultValue: 'Delete selected' }) as string}
 aria-label={t('fileTree.deleteSelected', { defaultValue: 'Delete selected' }) as string}
 >
 <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
 </button>
        ) : null}
 <button
 type="button"
 onClick={refreshFiles}
 disabled={loading}
 className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted disabled:opacity-50 dark:hover:bg-primary"
 title={t('fileTree.refresh', { defaultValue: 'Refresh' }) as string}
 aria-label={t('fileTree.refresh', { defaultValue: 'Refresh' }) as string}
 >
 <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} strokeWidth={1.75} />
 </button>
 <button
 type="button"
 onClick={collapseAll}
 disabled={!hasExpanded}
 className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted disabled:opacity-40 dark:hover:bg-primary"
 title={t('fileTree.collapseAll', { defaultValue: 'Collapse all' }) as string}
 aria-label={t('fileTree.collapseAll', { defaultValue: 'Collapse all' }) as string}
 >
 <ChevronsDownUp className="h-3.5 w-3.5" strokeWidth={1.75} />
 </button>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted max-md:hidden dark:hover:bg-primary"
            title={t('fileTree.close', { defaultValue: 'Close file tree' }) as string}
 aria-label={t('fileTree.close', { defaultValue: 'Close file tree' }) as string}
 >
 <X className="h-3.5 w-3.5" strokeWidth={1.75} />
 </button>
 ) : null}
 </div>
 </div>

 <div
 className="min-h-0 flex-1 overflow-y-auto py-2 text-[13px]"
 onContextMenu={handleBlankContextMenu}
 >
 {loading && files.length === 0 ? (
 <div className="flex items-center justify-center gap-2 py-6 text-xxs text-muted-foreground">
 <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
 <span>{t('loading', { defaultValue: 'Loading…' })}</span>
 </div>
 ) : flat.length === 0 ? (
 <div className="py-4">
 {saasReadOnlyFiles ? (
 <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
 {t('fileTree.saasReadOnlyHint', {
 defaultValue: '云端只读浏览。可在对话成果或此处下载文件到本机。',
 })}
 </p>
 ) : null}
 <div className="py-6 text-center text-xxs text-muted-foreground">
 {t('fileTree.empty', { defaultValue: 'This project is empty.' })}
 </div>
 </div>
 ) : (
 <ul className="space-y-0.5 px-4 max-md:px-3.5">
 {flat.map(({ node, depth }, idx) => {
 const isDir = node.type === 'directory';
 const isOpen = isDir && expanded.has(node.path);
 const isActive = activePath === node.path;
 const isSelected = !isDir && selectedPaths.has(node.path);
 const isFocused = focusPath === node.path;
 const isRenaming = inlineEdit?.kind === 'rename' && inlineEdit.path === node.path;
 const isHtmlFile = !isDir && /\.html?$/i.test(node.name);

 let Icon = Folder;
 let color = 'text-muted-foreground';
 if (isDir) {
 Icon = isOpen ? FolderOpen : Folder;
 } else {
 const iconData = getFileIconData(node.name);
 Icon = iconData.icon;
 color = iconData.color;
 }

 const showCreateAfter =
 inlineEdit?.kind === 'create' &&
 findInsertIndex(inlineEdit.parentPath) === idx + 1;

 return (
 <li
 key={node.path}
 data-file-tree-path={node.path}
 onContextMenu={(event) => handleContextMenu(event, node)}
 >
 {isRenaming ? (
 <div
 style={{ marginLeft: `${depth * 20}px` }}
 className="flex items-center gap-2 rounded-md px-1.5 py-0.5"
 >
 {isDir ? (
 <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
 ) : (
 <span className="w-3.5" />
 )}
 <Icon className={cn('h-3.5 w-3.5 shrink-0', color)} strokeWidth={1.75} />
 <input
 ref={inlineInputRef}
 defaultValue={inlineEdit.currentName}
 onKeyDown={handleInlineKeyDown}
 onBlur={handleInlineBlur}
 className={cn(
 'min-w-0 flex-1 rounded border px-1.5 py-0.5 text-[13px] outline-none',
 'border-blue-400 bg-card text-foreground focus:ring-1 focus:ring-blue-400',
 'dark:border-blue-500 dark:focus:ring-blue-500',
 )}
 />
 </div>
 ) : (
 <div
 onClick={(event) => handleClick(node, event)}
 style={{ marginLeft: `${depth * 20}px` }}
                      className={cn(
                        'group/row flex cursor-pointer items-center gap-3 rounded-md px-1.5 py-1 transition-colors max-md:min-h-[48px] max-md:gap-3 max-md:px-1 max-md:py-2.5',
                        isActive
                          ? 'bg-muted'
                          : 'hover:bg-sidebar dark:hover:bg-primary/60',
                        isSelected && !isActive && 'bg-blue-50/80 dark:bg-blue-950/25',
                        isFocused && 'ring-2 ring-emerald-500/45 ring-inset',
                      )}
 >
 {isDir ? (
 isOpen ? (
 <ChevronDown
 className="h-3.5 w-3.5 text-muted-foreground"
 strokeWidth={1.75}
 />
 ) : (
 <ChevronRight
 className="h-3.5 w-3.5 text-muted-foreground"
 strokeWidth={1.75}
 />
 )
 ) : (
 <span className="w-3.5" />
 )}
 <Icon className={cn('h-3.5 w-3.5 shrink-0', color)} strokeWidth={1.75} />
 <span
 className={cn(
 'min-w-0 flex-1 truncate',
 isActive
 ? 'font-medium text-foreground'
 : 'text-foreground',
 )}
 >
 {node.name}
 </span>
 {!isDir && (
 <button
 type="button"
 onClick={(event) => handleDownloadFile(event, node)}
 className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition group-hover/row:opacity-100 hover:bg-border hover:text-foreground"
 title={t('fileTree.downloadFile', { defaultValue: 'Download file' }) as string}
 aria-label={t('fileTree.downloadFile', { defaultValue: 'Download file' }) as string}
 >
 <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
 </button>
 )}
 {isHtmlFile ? (
 <button
 type="button"
 onClick={(event) => handleOpenHtmlPreview(event, node)}
 className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-border hover:text-foreground"
 title={t('fileTree.openHtmlPreview', { defaultValue: 'Open HTML preview in new tab' }) as string}
 aria-label={t('fileTree.openHtmlPreview', { defaultValue: 'Open HTML preview in new tab' }) as string}
 >
 <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
 </button>
 ) : null}
 </div>
 )}
 {showCreateAfter ? renderInlineInput(inlineEdit.depth) : null}
 </li>
 );
 })}
 {inlineEdit?.kind === 'create' && flat.length === 0
 ? renderInlineInput(inlineEdit.depth)
 : null}
 </ul>
 )}
 </div>

 {contextMenu ? (
 <div
 role="menu"
 aria-label={t('fileTree.context.menuLabel', { defaultValue: 'File context menu' }) as string}
 onClick={(event) => event.stopPropagation()}
 onContextMenu={(event) => event.preventDefault()}
 className={cn(
 'fixed z-50 w-44 rounded-lg border bg-card p-1 shadow-lg',
 'border-border',
 )}
 style={{ left: contextMenu.x, top: contextMenu.y }}
 >
 {contextMenu.node ? (
 <>
 {/* PD-SAAS-FORK: 引用是只读操作，云端只读文件树也须保留（勿与 saasReadOnlyFiles 绑定） */}
 <button
 type="button"
 role="menuitem"
 onClick={() => handleReference(contextMenu.node!)}
 className={menuItemClass}
 >
 <AtSign className={menuIconClass} strokeWidth={1.75} />
 {t('fileTree.context.reference', { defaultValue: '引用' })}
 </button>
 {contextMenu.node.type === 'directory' && !saasReadOnlyFiles ? (
 <>
 <div className="my-1 border-t border-border" />
 <button
 type="button"
 role="menuitem"
 onClick={() =>
 handleNewFile(
 contextMenu.node!.path,
 (depthByPath.get(contextMenu.node!.path) ?? 0) + 1,
 )
 }
 className={menuItemClass}
 >
 <FilePlus className={menuIconClass} strokeWidth={1.75} />
 {t('fileTree.context.newFile', { defaultValue: 'New File' })}
 </button>
 <button
 type="button"
 role="menuitem"
 onClick={() =>
 handleNewFolder(
 contextMenu.node!.path,
 (depthByPath.get(contextMenu.node!.path) ?? 0) + 1,
 )
 }
 className={menuItemClass}
 >
 <FolderPlus className={menuIconClass} strokeWidth={1.75} />
 {t('fileTree.context.newFolder', { defaultValue: 'New Folder' })}
 </button>
 </>
 ) : null}
 {contextMenu.node.type === 'file' ? (
 <>
 <div className="my-1 border-t border-border" />
 <button
 type="button"
 role="menuitem"
 onClick={() => handleOpen(contextMenu.node!)}
 className={menuItemClass}
 >
 <FilePlus className={menuIconClass} strokeWidth={1.75} />
 Open
 </button>
 <button
 type="button"
 role="menuitem"
 onClick={() => handleDownloadFile(null, contextMenu.node!)}
 className={menuItemClass}
 >
 <Download className={menuIconClass} strokeWidth={1.75} />
 {t('fileTree.context.download', { defaultValue: 'Download' })}
 </button>
 </>
 ) : null}
 <div className="my-1 border-t border-border" />
 {!saasReadOnlyFiles ? (
 <button
 type="button"
 role="menuitem"
 onClick={() =>
 handleRename(
 contextMenu.node!,
 depthByPath.get(contextMenu.node!.path) ?? 0,
 )
 }
 className={menuItemClass}
 >
 <Pencil className={menuIconClass} strokeWidth={1.75} />
 {t('fileTree.context.rename', { defaultValue: 'Rename' })}
 </button>
 ) : null}
 <button
 type="button"
 role="menuitem"
 onClick={() => handleCopyPath(contextMenu.node!)}
 className={menuItemClass}
 >
 <ClipboardCopy className={menuIconClass} strokeWidth={1.75} />
 {t('fileTree.context.copyPath', { defaultValue: 'Copy Path' })}
 </button>
 {!saasReadOnlyFiles ? (
 <>
 <div className="my-1 border-t border-border" />
 <button
 type="button"
 role="menuitem"
 onClick={() => handleDelete(contextMenu.node!)}
 className={cn(menuItemClass, 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30')}
 >
 <Trash2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
 {t('fileTree.context.delete', { defaultValue: 'Delete' })}
 </button>
 </>
 ) : null}
 </>
 ) : !saasReadOnlyFiles ? (
 <>
 <button
 type="button"
 role="menuitem"
 onClick={() => handleNewFile('', 0)}
 className={menuItemClass}
 >
 <FilePlus className={menuIconClass} strokeWidth={1.75} />
 {t('fileTree.context.newFile', { defaultValue: 'New File' })}
 </button>
 <button
 type="button"
 role="menuitem"
 onClick={() => handleNewFolder('', 0)}
 className={menuItemClass}
 >
 <FolderPlus className={menuIconClass} strokeWidth={1.75} />
 {t('fileTree.context.newFolder', { defaultValue: 'New Folder' })}
 </button>
 </>
 ) : null}
 </div>
 ) : null}
 </div>
 );
}
