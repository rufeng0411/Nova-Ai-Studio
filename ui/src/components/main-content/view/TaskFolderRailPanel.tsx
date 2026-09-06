// PD-SAAS-FORK: compact read-only file tree for right workspace rail (task folder)
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Folder, FolderOpen, Loader2 } from 'lucide-react';
import type { Project } from '../../../types/app';
import type { TaskFolderNavigationTarget } from '../../../shared/resolveTaskFolderNavigation';
import { useFileTreeData } from '../../file-tree/hooks/useFileTreeData';
import type { FileTreeNode } from '../../file-tree/types/types';
import { getFileIconData } from '../../file-tree/constants/fileIcons';
import { findFileTreeDirectoryMatch, findFileTreeDirectoryNode, findFileTreeNode } from '../../../shared/fileTreeNavigation';
import { getArtifactDirectory } from '../../../shared/artifactPaths';
import { supportsUnifiedFilePreview } from '../../../shared/projectPreviewCapabilities';
import { cn } from '../../../lib/utils';
import type { DeliverableDockRow } from '../../../shared/buildDeliverableDockRows';
import { deliverableStatusLabel } from '../../../shared/deliverableStatusUi';
import type { SummaryRowStatus } from '../../../shared/buildDeliverableSummaryRows';

import type { FileOpenOptions } from '../../code-editor/utils/fileOpen';

type TaskFolderRailPanelProps = {
  selectedProject: Project;
  navigationTarget: TaskFolderNavigationTarget | null;
  onFileOpen?: (filePath: string, options?: FileOpenOptions | null) => void;
  processFilePaths?: string[];
  /** PD-SAAS-FORK Razer RCA: read-only deliverable status badges from Dock rows. */
  dockRows?: DeliverableDockRow[];
};

function mapDockStatusToSummaryStatus(status: DeliverableDockRow['status']): SummaryRowStatus | null {
  switch (status) {
    case 'delivered':
      return 'delivered';
    case 'checking':
      return 'checking';
    case 'broken':
      return 'broken';
    case 'needContinue':
      return 'needContinue';
    case 'missing':
      return 'missing';
    case 'hidden':
      return null;
    default: {
      const _exhaustive: never = status;
      return null;
    }
  }
}

function resolveDockRowForFilePath(rows: DeliverableDockRow[], filePath: string): DeliverableDockRow | null {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const basename = normalized.split('/').pop() ?? normalized;
  for (const row of rows) {
    const candidates = [row.resolvedPath, row.path, row.apiPath].filter(Boolean) as string[];
    for (const candidate of candidates) {
      const candidateNorm = candidate.replace(/\\/g, '/').toLowerCase();
      if (candidateNorm === normalized || candidateNorm.endsWith(`/${basename}`)) {
        return row;
      }
      if ((candidateNorm.split('/').pop() ?? candidateNorm) === basename) {
        return row;
      }
    }
  }
  return null;
}

type FlattenedNode = {
  node: FileTreeNode;
  depth: number;
};

function normalizeScopePath(navigationTarget: TaskFolderNavigationTarget | null): string {
  if (!navigationTarget) return '';
  const folderPath = navigationTarget.folderPath?.replace(/\\/g, '/').trim();
  if (folderPath) return folderPath.replace(/\/+$/, '');
  const filePath = navigationTarget.filePath?.replace(/\\/g, '/').trim() ?? '';
  if (!filePath) return '';
  return getArtifactDirectory(filePath) || filePath.replace(/\/+$/, '');
}

function flattenTree(nodes: FileTreeNode[], expanded: Set<string>, depth = 0): FlattenedNode[] {
  const out: FlattenedNode[] = [];
  for (const node of nodes) {
    out.push({ node, depth });
    if (node.type === 'directory' && expanded.has(node.path) && node.children) {
      out.push(...flattenTree(node.children, expanded, depth + 1));
    }
  }
  return out;
}

export default function TaskFolderRailPanel({
  selectedProject,
  navigationTarget,
  onFileOpen,
  processFilePaths = [],
  dockRows = [],
}: TaskFolderRailPanelProps) {
  const { t } = useTranslation();
  const processPathSet = useMemo(
    () => new Set(processFilePaths.map((p) => p.replace(/\\/g, '/').toLowerCase())),
    [processFilePaths],
  );
  const { files, loading, refreshFiles } = useFileTreeData(selectedProject);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activePath, setActivePath] = useState<string | null>(null);
  const [focusPath, setFocusPath] = useState<string | null>(null);

  useEffect(() => {
    if (!navigationTarget?.id) return;
    refreshFiles();
  }, [navigationTarget?.id, refreshFiles]);

  useEffect(() => {
    setExpanded(new Set());
    setActivePath(null);
    setFocusPath(null);
  }, [selectedProject.name, navigationTarget?.id]);

  useEffect(() => {
    const scopePath = normalizeScopePath(navigationTarget);
    if (!scopePath || loading || files.length === 0) return;

    const dirMatch = findFileTreeDirectoryMatch(files, scopePath, navigationTarget?.hintDir);
    const dirNode = dirMatch?.node ?? null;
    const filePath = navigationTarget?.filePath?.replace(/\\/g, '/').trim() ?? '';
    const fileMatch = filePath && filePath !== scopePath
      ? findFileTreeNode(files, filePath, navigationTarget?.hintDir)
      : null;
    const match = fileMatch ?? (dirMatch
      ? { path: dirMatch.node.path, ancestorPaths: dirMatch.ancestorPaths }
      : null);

    if (!match) return;

    setExpanded((prev) => {
      const next = new Set(prev);
      for (const folderPath of match.ancestorPaths) {
        next.add(folderPath);
      }
      if (dirNode?.path) {
        next.add(dirNode.path);
      }
      return next;
    });
    setActivePath(match.path);
    setFocusPath(match.path);

    const scrollTimer = window.setTimeout(() => {
      const row = document.querySelector(
        `[data-rail-file-tree-path="${CSS.escape(match.path)}"]`,
      );
      row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 160);

    const clearFocusTimer = window.setTimeout(() => {
      setFocusPath((current) => (current === match.path ? null : current));
    }, 6000);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearFocusTimer);
    };
  }, [files, loading, navigationTarget, navigationTarget?.filePath, navigationTarget?.folderPath, navigationTarget?.hintDir, navigationTarget?.id]);

  const scopedFolderPath = normalizeScopePath(navigationTarget);

  const scopedRoot = useMemo(() => {
    if (!scopedFolderPath || loading || files.length === 0) return null;
    return findFileTreeDirectoryNode(files, scopedFolderPath, navigationTarget?.hintDir);
  }, [files, loading, navigationTarget, scopedFolderPath]);

  const treeRoots = useMemo(() => {
    if (!scopedFolderPath) {
      // PD-SAAS-FORK: never show the whole project — only the current session task folder.
      return [];
    }
    if (scopedRoot) return [scopedRoot];
    // Scoped navigation requested but tree not resolved yet — never fall back to full project tree.
    return [];
  }, [scopedFolderPath, scopedRoot]);

  const awaitingScopedTree = Boolean(
    navigationTarget && scopedFolderPath && !scopedRoot && (loading || files.length === 0),
  );

  const flat = useMemo(() => flattenTree(treeRoots, expanded), [expanded, treeRoots]);

  const toggleDirectory = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleNodeClick = useCallback((node: FileTreeNode) => {
    if (node.type === 'directory') {
      toggleDirectory(node.path);
      setActivePath(node.path);
      return;
    }
    setActivePath(node.path);
    const fileName = node.name;
    onFileOpen?.(
      node.path,
      supportsUnifiedFilePreview(fileName)
        ? { initialPreview: true, hintDir: navigationTarget?.hintDir }
        : navigationTarget?.hintDir
          ? { hintDir: navigationTarget.hintDir }
          : undefined,
    );
  }, [navigationTarget?.hintDir, onFileOpen, toggleDirectory]);

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="task-folder-rail-panel">
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 text-[13px]">
        {awaitingScopedTree || (loading && files.length === 0) ? (
          <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
            <span>{t('loading', { defaultValue: '加载中…' })}</span>
          </div>
        ) : flat.length === 0 ? (
          <div className="px-2 py-6 text-center text-[12px] text-muted-foreground">
            {scopedFolderPath
              ? t('deliverables.taskFolderLoading', { defaultValue: '正在加载任务文件夹…' })
              : t('deliverables.taskFolderAwaitSession', { defaultValue: '当前对话的任务文件夹准备中…' })}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {flat.map(({ node, depth }) => {
              const isDir = node.type === 'directory';
              const isOpen = isDir && expanded.has(node.path);
              const isActive = activePath === node.path;
              const isFocused = focusPath === node.path;

              let Icon = Folder;
              let color = 'text-muted-foreground';
              if (isDir) {
                Icon = isOpen ? FolderOpen : Folder;
              } else {
                const iconData = getFileIconData(node.name);
                Icon = iconData.icon;
                color = iconData.color;
              }

              const isProcessFile = !isDir && processPathSet.has(node.path.replace(/\\/g, '/').toLowerCase());
              const dockRow = !isDir && dockRows.length > 0
                ? resolveDockRowForFilePath(dockRows, node.path)
                : null;
              const dockStatus = dockRow ? mapDockStatusToSummaryStatus(dockRow.status) : null;

              return (
                <li key={node.path} data-rail-file-tree-path={node.path}>
                  <button
                    type="button"
                    onClick={() => handleNodeClick(node)}
                    className={cn(
                      'flex w-full min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-left transition',
                      isActive ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/60',
                      isFocused && 'ring-1 ring-primary/30',
                      isProcessFile && 'text-muted-foreground/80',
                    )}
                    style={{ paddingLeft: `${depth * 14 + 6}px` }}
                    title={isProcessFile ? t('deliverables.processFile', { defaultValue: '过程文件' }) : undefined}
                  >
                    {isDir ? (
                      <ChevronRight
                        className={cn(
                          'h-3 w-3 shrink-0 text-muted-foreground transition-transform',
                          isOpen && 'rotate-90',
                        )}
                        strokeWidth={1.75}
                      />
                    ) : (
                      <span className="inline-block h-3 w-3 shrink-0" />
                    )}
                    <Icon className={cn('h-3.5 w-3.5 shrink-0', color)} strokeWidth={1.75} />
                    <span className="min-w-0 flex-1 truncate">{node.name}</span>
                    {dockStatus ? (
                      <span
                        className="shrink-0 rounded px-1 py-0.5 text-[10px] text-muted-foreground"
                        data-testid="task-folder-dock-badge"
                        data-dock-status={dockStatus}
                      >
                        {deliverableStatusLabel(dockStatus, t)}
                      </span>
                    ) : null}
                    {isProcessFile ? (
                      <span className="shrink-0 text-[10px] text-muted-foreground/70">
                        {t('deliverables.processFile', { defaultValue: '过程文件' })}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
