import { useMemo } from 'react';
import type { Project } from '../../../../types/app';
import { api } from '../../../../utils/api';

function buildPreviewSrc(
  project: Project | null,
  filePath: string,
  cacheKey: number,
): string {
  if (!project?.name || !filePath) return '';
  const base = api.projectPreviewUrl(
    project.name,
    filePath,
    project.fullPath || project.path || '',
  );
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}_t=${cacheKey}`;
}

export function useDesignHtmlPreviewUrl(
  selectedProject: Project | null,
  filePath: string,
  refreshKey = 0,
): string {
  return useMemo(
    () => buildPreviewSrc(selectedProject, filePath, refreshKey),
    [selectedProject, filePath, refreshKey],
  );
}
