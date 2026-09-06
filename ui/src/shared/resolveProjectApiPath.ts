import { resolveEditorApiPath } from '../components/code-editor/utils/resolveEditorApiPath';
import { resolveProjectFilePath } from './resolveProjectFilePath';

/** Expand deliverable paths client-side, then resolve to the real project-relative path. */
export async function resolveProjectApiPath(
  projectName: string,
  filePath: string,
  projectRoot?: string,
  options?: { hintDir?: string; skipResolve?: boolean },
): Promise<string> {
  if (!projectName || !filePath) {
    return filePath || '';
  }
  const apiPath = resolveEditorApiPath(filePath, projectRoot);
  const resolved = await resolveProjectFilePath(projectName, apiPath, projectRoot, options);
  return resolved?.relativePath || apiPath;
}
