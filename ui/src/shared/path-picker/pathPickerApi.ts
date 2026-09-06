// PD-SAAS-FORK: API client for server-side folder picker
import { api } from '../../utils/api';
import { BROWSE_ROOTS_TOKEN } from './pathNormalize';

export type FolderSuggestion = {
  path: string;
  name: string;
  type?: string;
  kind?: string;
};

export type BrowseFilesystemResponse = {
  path: string;
  kind?: 'roots' | 'directory';
  parentPath?: string | null;
  suggestions?: FolderSuggestion[];
  error?: string;
};

export type EnsurePathResponse = {
  success?: boolean;
  path?: string;
  existed?: boolean;
  created?: boolean;
  error?: string;
};

const parseJson = async <T>(response: Response): Promise<T> => {
  return (await response.json()) as T;
};

export async function browseFilesystemFolders(pathToBrowse: string = BROWSE_ROOTS_TOKEN) {
  const endpoint = `/browse-filesystem?path=${encodeURIComponent(pathToBrowse)}`;
  const response = await api.get(endpoint);
  const data = await parseJson<BrowseFilesystemResponse>(response);

  if (!response.ok) {
    throw new Error(data.error || 'Failed to browse filesystem');
  }

  return {
    path: data.path || pathToBrowse,
    kind: data.kind || (pathToBrowse === BROWSE_ROOTS_TOKEN ? 'roots' : 'directory'),
    parentPath: data.parentPath ?? null,
    suggestions: (data.suggestions || []) as FolderSuggestion[],
  };
}

export async function createFolderInFilesystem(folderPath: string) {
  const response = await api.createFolder(folderPath);
  const data = await parseJson<{ path?: string; error?: string }>(response);

  if (!response.ok) {
    throw new Error(data.error || 'Failed to create folder');
  }

  return data.path || folderPath;
}

export async function ensureFilesystemPath(folderPath: string, createMissing: boolean) {
  const response = await api.post('/ensure-path', { path: folderPath, createMissing });
  const data = await parseJson<EnsurePathResponse>(response);

  if (!response.ok) {
    throw new Error(data.error || 'Failed to ensure path');
  }

  return {
    path: data.path || folderPath,
    existed: Boolean(data.existed),
    created: Boolean(data.created),
  };
}

export async function createFileInFilesystem(dir: string, name: string, content = '') {
  const response = await api.post('/create-file', { dir, name, content });
  const data = await parseJson<{ path?: string; error?: string }>(response);

  if (!response.ok) {
    throw new Error(data.error || 'Failed to create file');
  }

  return data.path || '';
}
