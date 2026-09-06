import { normalizeArtifactPath, toProjectApiPath } from '../../../shared/artifactPaths';
import { parseSkillAssetEditorPath } from '../../../shared/skillResourcePaths';

/** Normalize editor file paths for project content/preview APIs. */
export function resolveEditorApiPath(filePath: string, projectRoot?: string): string {
  if (parseSkillAssetEditorPath(filePath)) return filePath;
  const root = projectRoot || '';
  const apiPath = toProjectApiPath(filePath, root);
  if (apiPath) return apiPath;
  return normalizeArtifactPath(filePath, root);
}
