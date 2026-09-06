import { api } from '../../../utils/api';
import type {
  CloneProgressEvent,
  CreateWorkspacePayload,
  CreateWorkspaceResponse,
  CredentialsResponse,
  TokenMode,
} from '../types';

export type { BrowseFilesystemResponse, FolderSuggestion } from '../../../shared/path-picker/pathPickerApi';

export {
  browseFilesystemFolders,
  createFolderInFilesystem,
  createFileInFilesystem,
  ensureFilesystemPath,
} from '../../../shared/path-picker/pathPickerApi';

type CloneWorkspaceParams = {
  workspacePath: string;
  githubUrl: string;
  tokenMode: TokenMode;
  selectedGithubToken: string;
  newGithubToken: string;
};

type CloneProgressHandlers = {
  onProgress: (message: string) => void;
};

const parseJson = async <T>(response: Response): Promise<T> => {
  const data = (await response.json()) as T;
  return data;
};

export const fetchGithubTokenCredentials = async () => {
  const response = await api.get('/settings/credentials?type=github_token');
  const data = await parseJson<CredentialsResponse>(response);

  if (!response.ok) {
    throw new Error(data.error || 'Failed to load GitHub tokens');
  }

  return (data.credentials || []).filter((credential) => credential.is_active);
};

export const createWorkspaceRequest = async (payload: CreateWorkspacePayload) => {
  const response = await api.createWorkspace(payload);
  const data = await parseJson<CreateWorkspaceResponse>(response);

  if (!response.ok) {
    throw new Error(data.details || data.error || 'Failed to create workspace');
  }

  return data.project;
};

const buildCloneProgressQuery = ({
  workspacePath,
  githubUrl,
  tokenMode,
  selectedGithubToken,
  newGithubToken,
}: CloneWorkspaceParams) => {
  const query = new URLSearchParams({
    path: workspacePath.trim(),
    githubUrl: githubUrl.trim(),
  });

  if (tokenMode === 'stored' && selectedGithubToken) {
    query.set('githubTokenId', selectedGithubToken);
  }

  if (tokenMode === 'new' && newGithubToken.trim()) {
    query.set('newGithubToken', newGithubToken.trim());
  }

  const authToken = localStorage.getItem('auth-token');
  if (authToken) {
    query.set('token', authToken);
  }

  return query.toString();
};

export const cloneWorkspaceWithProgress = (
  params: CloneWorkspaceParams,
  handlers: CloneProgressHandlers,
) =>
  new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
    const query = buildCloneProgressQuery(params);
    const eventSource = new EventSource(`/api/projects/clone-progress?${query}`);
    let settled = false;

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      eventSource.close();
      callback();
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as CloneProgressEvent;

        if (payload.type === 'progress' && payload.message) {
          handlers.onProgress(payload.message);
          return;
        }

        if (payload.type === 'complete') {
          settle(() => resolve(payload.project));
          return;
        }

        if (payload.type === 'error') {
          settle(() => reject(new Error(payload.message || 'Failed to clone repository')));
        }
      } catch (error) {
        console.error('Error parsing clone progress event:', error);
      }
    };

    eventSource.onerror = () => {
      settle(() => reject(new Error('Connection lost during clone')));
    };
  });
