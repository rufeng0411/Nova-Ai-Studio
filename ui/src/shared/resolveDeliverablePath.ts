// PD-SAAS-FORK: unified deliverable resolve with turn-scoped hintDir
import { compileDeliverableSlotPath } from '../../shared/deliverablePathResolve.mjs';
import { resolveProjectFilePath, type ResolvedProjectFile } from './resolveProjectFilePath';

export type ResolveDeliverablePathInput = {
  projectName: string;
  path: string;
  turnArtifactDir?: string;
  projectRoot?: string;
  skipResolve?: boolean;
};

/** Single client entry for body links, deliverable panel, sidebar preview, and go-folder. */
export async function resolveDeliverablePath(
  input: ResolveDeliverablePathInput,
): Promise<ResolvedProjectFile | null> {
  const { projectName, path, turnArtifactDir, projectRoot } = input;
  if (!projectName || !path) {
    return null;
  }

  const scopedPath = turnArtifactDir
    ? compileDeliverableSlotPath(path, turnArtifactDir) || path
    : path;

  return resolveProjectFilePath(projectName, scopedPath, projectRoot, {
    hintDir: turnArtifactDir,
    skipResolve: input.skipResolve,
  });
}
