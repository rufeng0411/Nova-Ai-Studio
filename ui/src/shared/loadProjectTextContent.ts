// PD-SAAS-FORK: same text load path as sidebar editor (resolve + api.readFile JSON)
import { api } from '../utils/api';
import { resolveProjectApiPath } from './resolveProjectApiPath';
import { readCachedProjectText, writeCachedProjectText } from './superPreviewSiblingCache';

export async function loadProjectTextContent(
  projectName: string,
  filePath: string,
  projectRoot?: string,
  options?: { hintDir?: string; skipResolve?: boolean },
): Promise<string> {
  const cached = readCachedProjectText(projectName, filePath);
  if (cached !== null) return cached;

  const apiPath = await resolveProjectApiPath(projectName, filePath, projectRoot, {
    hintDir: options?.hintDir,
    skipResolve: options?.skipResolve ?? shouldSkipResolveTextPath(filePath),
  });

  const response = await api.readFile(projectName, apiPath);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = (await response.json()) as { content?: string };
  const content = typeof data.content === 'string' ? data.content : '';
  writeCachedProjectText(projectName, filePath, content);
  return content;
}

function shouldSkipResolveTextPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').trim();
  return normalized.startsWith('artifacts/') || normalized.includes('/');
}
