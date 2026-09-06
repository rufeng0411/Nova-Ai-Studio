import { useEffect, useMemo, useState } from 'react';
import { cn } from '../../../../lib/utils';
import { classifyDeliverablePath, getArtifactFileName, normalizeArtifactPath, type DeliverableKind } from '../../../../shared/artifactPaths';
import FallbackPreviewAdapter from '../fallback/FallbackPreviewAdapter';
import CollectionEntryThumb from './CollectionEntryThumb';
import CollectionMainPreview from './CollectionMainPreview';
import { filterCollectionPreviewPaths } from './collectionPreviewPaths';

type CollectionPreviewAdapterProps = {
  projectName: string;
  projectRoot?: string;
  paths: string[];
  /** Prefer this file when opening from deliverable overlay / sidebar. */
  activePath?: string;
};

type FilterId = DeliverableKind | 'all';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'image', label: '图片' },
  { id: 'html', label: '网页' },
  { id: 'document', label: '文档' },
  { id: 'spreadsheet', label: '表格' },
  { id: 'video', label: '媒体' },
];

function resolveInitialPath(paths: string[], activePath?: string): string {
  const normalizedActive = activePath ? normalizeArtifactPath(activePath) : '';
  if (normalizedActive) {
    const match = paths.find((path) => normalizeArtifactPath(path) === normalizedActive);
    if (match) return match;
  }
  return paths[0] ?? '';
}

export default function CollectionPreviewAdapter({
  projectName,
  projectRoot,
  paths,
  activePath,
}: CollectionPreviewAdapterProps) {
  const [filter, setFilter] = useState<FilterId>('all');
  const visiblePaths = useMemo(() => filterCollectionPreviewPaths(paths), [paths]);
  const [selectedPath, setSelectedPath] = useState(() => resolveInitialPath(filterCollectionPreviewPaths(paths), activePath));

  useEffect(() => {
    setSelectedPath(resolveInitialPath(visiblePaths, activePath));
  }, [activePath, visiblePaths]);

  const entries = useMemo(
    () => visiblePaths.map((path) => ({ path, kind: classifyDeliverablePath(path) })),
    [visiblePaths],
  );
  const filtered = filter === 'all' ? entries : entries.filter((entry) => entry.kind === filter);

  useEffect(() => {
    if (filtered.length === 0) return;
    const stillVisible = filtered.some((entry) => entry.path === selectedPath);
    if (!stillVisible) {
      setSelectedPath(filtered[0]?.path ?? '');
    }
  }, [filtered, selectedPath]);

  const activeIndex = filtered.findIndex((entry) => entry.path === selectedPath);
  const active = activeIndex >= 0 ? filtered[activeIndex] : filtered[0];

  if (entries.length === 0) {
    return <FallbackPreviewAdapter message="该合集暂无可浏览的用户成果文件。" />;
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(9rem,15rem)_1fr] bg-background">
      <div className="flex min-h-0 flex-col border-r border-border">
        <div className="flex shrink-0 flex-wrap gap-1 border-b border-border p-2">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                'rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground',
                filter === item.id && 'bg-muted text-foreground',
              )}
              onClick={() => {
                setFilter(item.id);
                setSelectedPath((current) => {
                  const nextFiltered = item.id === 'all'
                    ? entries
                    : entries.filter((entry) => entry.kind === item.id);
                  if (nextFiltered.some((entry) => entry.path === current)) return current;
                  return nextFiltered[0]?.path ?? '';
                });
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {filtered.map((entry) => {
            const isActive = active?.path === entry.path;
            return (
              <button
                key={entry.path}
                type="button"
                className={cn(
                  'mb-2 block w-full rounded-lg border bg-card p-1 text-left transition hover:border-primary/50',
                  isActive ? 'border-primary/60' : 'border-border',
                )}
                onClick={() => setSelectedPath(entry.path)}
              >
                <CollectionEntryThumb
                  projectName={projectName}
                  projectRoot={projectRoot}
                  path={entry.path}
                  kind={entry.kind}
                />
                <div className="mt-1 truncate px-1 text-[11px] text-muted-foreground">
                  {getArtifactFileName(entry.path)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex min-h-0 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
          <div className="truncate text-sm font-medium">
            {active ? getArtifactFileName(active.path) : '合集'}
          </div>
          <div className="text-xs tabular-nums text-muted-foreground">
            {filtered.length > 0 ? `${Math.max(activeIndex, 0) + 1} / ${filtered.length}` : '0 项'}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden bg-background">
          {active ? (
            <CollectionMainPreview
              projectName={projectName}
              projectRoot={projectRoot}
              path={active.path}
              kind={active.kind}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              当前筛选暂无可预览文件。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
