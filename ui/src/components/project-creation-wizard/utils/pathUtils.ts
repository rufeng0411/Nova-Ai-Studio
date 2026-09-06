import type { WorkspaceType } from '../types';

export {
  BROWSE_ROOTS_TOKEN,
  buildPathBreadcrumbs,
  getParentPath,
  getSuggestionRootPath,
  joinFolderPath,
} from '../../../shared/path-picker/pathNormalize';

const SSH_PREFIXES = ['git@', 'ssh://'];

export const isSshGitUrl = (url: string): boolean => {
  const trimmedUrl = url.trim();
  return SSH_PREFIXES.some((prefix) => trimmedUrl.startsWith(prefix));
};

export const shouldShowGithubAuthentication = (
  workspaceType: WorkspaceType,
  githubUrl: string,
): boolean => workspaceType === 'new' && githubUrl.trim().length > 0 && !isSshGitUrl(githubUrl);

export const isCloneWorkflow = (workspaceType: WorkspaceType, githubUrl: string): boolean =>
  workspaceType === 'new' && githubUrl.trim().length > 0;

