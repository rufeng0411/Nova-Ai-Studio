// PD-SAAS-FORK: path normalization for folder picker UI
export const BROWSE_ROOTS_TOKEN = '@roots';

const WINDOWS_DRIVE_PATTERN = /^[A-Za-z]:\\?$/;

export function getParentPath(currentPath: string): string | null {
  if (currentPath === BROWSE_ROOTS_TOKEN) {
    return null;
  }
  if (currentPath === '/' || WINDOWS_DRIVE_PATTERN.test(currentPath)) {
    return BROWSE_ROOTS_TOKEN;
  }
  if (currentPath === '~') {
    return BROWSE_ROOTS_TOKEN;
  }

  const lastSeparatorIndex = Math.max(currentPath.lastIndexOf('/'), currentPath.lastIndexOf('\\'));
  if (lastSeparatorIndex <= 0) {
    return BROWSE_ROOTS_TOKEN;
  }

  if (lastSeparatorIndex === 2 && /^[A-Za-z]:/.test(currentPath)) {
    return `${currentPath.slice(0, 2)}\\`;
  }

  return currentPath.slice(0, lastSeparatorIndex);
}

export function joinFolderPath(basePath: string, folderName: string): string {
  const normalizedBasePath = basePath.trim().replace(/[\\/]+$/, '');
  const separator =
    normalizedBasePath.includes('\\') && !normalizedBasePath.includes('/') ? '\\' : '/';
  return `${normalizedBasePath}${separator}${folderName.trim()}`;
}

export function getSuggestionRootPath(inputPath: string): string {
  const trimmedPath = inputPath.trim();
  if (!trimmedPath || trimmedPath === BROWSE_ROOTS_TOKEN) {
    return BROWSE_ROOTS_TOKEN;
  }
  const lastSeparatorIndex = Math.max(trimmedPath.lastIndexOf('/'), trimmedPath.lastIndexOf('\\'));
  if (lastSeparatorIndex === 2 && /^[A-Za-z]:/.test(trimmedPath)) {
    return `${trimmedPath.slice(0, 2)}\\`;
  }

  return lastSeparatorIndex > 0 ? trimmedPath.slice(0, lastSeparatorIndex) : BROWSE_ROOTS_TOKEN;
}

export type PathBreadcrumb = {
  label: string;
  path: string;
};

export function buildPathBreadcrumbs(currentPath: string): PathBreadcrumb[] {
  if (!currentPath || currentPath === BROWSE_ROOTS_TOKEN) {
    return [{ label: BROWSE_ROOTS_TOKEN, path: BROWSE_ROOTS_TOKEN }];
  }

  const crumbs: PathBreadcrumb[] = [];
  let cursor: string | null = currentPath;
  while (cursor) {
    const label = cursor === BROWSE_ROOTS_TOKEN
      ? BROWSE_ROOTS_TOKEN
      : pathBasename(cursor) || cursor;
    crumbs.unshift({ label, path: cursor });
    cursor = getParentPath(cursor);
  }
  return crumbs;
}

function pathBasename(value: string): string {
  const normalized = value.replace(/[\\/]+$/, '');
  const index = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));
  return index >= 0 ? normalized.slice(index + 1) : normalized;
}

export function normalizePathInput(value: string): string {
  return value.trim();
}
