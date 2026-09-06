import { useCallback, useEffect, useRef, useState } from 'react';
// PD-SAAS-FORK: optimistic prune + awaitable refresh after file/folder delete.
import { api } from '../../../utils/api';
import type { Project } from '../../../types/app';
import type { FileTreeNode } from '../types/types';
import { pruneFileTreeNodes } from '../../../shared/pruneFileTree';
import { filterProcessArtifactsFromFileTree } from '../../../shared/filterProcessArtifactsFromFileTree';

type UseFileTreeDataResult = {
  files: FileTreeNode[];
  loading: boolean;
  refreshFiles: () => Promise<void>;
  /** Optimistically remove paths (folder deletes all descendants). */
  prunePaths: (paths: string[]) => void;
};

export function useFileTreeData(selectedProject: Project | null): UseFileTreeDataResult {
  const [files, setFiles] = useState<FileTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const refreshWaitersRef = useRef<Array<() => void>>([]);

  const resolveRefreshWaiters = useCallback(() => {
    const waiters = refreshWaitersRef.current;
    refreshWaitersRef.current = [];
    for (const resolve of waiters) {
      resolve();
    }
  }, []);

  const refreshFiles = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      refreshWaitersRef.current.push(resolve);
      setRefreshKey((prev) => prev + 1);
    });
  }, []);

  const prunePaths = useCallback((paths: string[]) => {
    if (paths.length === 0) return;
    setFiles((prev) => pruneFileTreeNodes(prev, paths));
  }, []);

  useEffect(() => {
    const projectName = selectedProject?.name;

    if (!projectName) {
      setFiles([]);
      setLoading(false);
      resolveRefreshWaiters();
      return;
    }

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Track mount state so aborted or late responses do not enqueue stale state updates.
    let isActive = true;

    const fetchFiles = async () => {
      if (isActive) {
        setLoading(true);
      }
      try {
        const response = await api.getFiles(projectName, { signal: abortControllerRef.current!.signal });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('File fetch failed:', response.status, errorText);
          if (isActive) {
            setFiles([]);
          }
          return;
        }

        const data = (await response.json()) as FileTreeNode[];
        if (isActive) {
          setFiles(filterProcessArtifactsFromFileTree(data));
        }
      } catch (error) {
        if ((error as { name?: string }).name === 'AbortError') {
          return;
        }

        console.error('Error fetching files:', error);
        if (isActive) {
          setFiles([]);
        }
      } finally {
        if (isActive) {
          setLoading(false);
          resolveRefreshWaiters();
        }
      }
    };

    void fetchFiles();

    return () => {
      isActive = false;
      abortControllerRef.current?.abort();
      resolveRefreshWaiters();
    };
  }, [resolveRefreshWaiters, selectedProject?.name, refreshKey]);

  return {
    files,
    loading,
    refreshFiles,
    prunePaths,
  };
}
