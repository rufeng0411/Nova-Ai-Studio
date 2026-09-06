// PD-SAAS-FORK: HyperFrames task path helpers (browser-safe; no node:fs)
import { normalizeArtifactPath } from './artifactPaths';
import {
  HF_PROJECT_RE,
  resolveHfProjectDirFromPath,
  resolvePromoPathForTaskDir,
  resolveTaskDirFromHfPath,
} from './hfStudioSupport';

export function resolveHfProjectDir(taskArtifactDir: string): string {
  const dir = normalizeArtifactPath(taskArtifactDir).replace(/\/+$/, '');
  if (HF_PROJECT_RE.test(`${dir}/`)) {
    if (dir.endsWith('/hf-project')) return dir;
    return `${dir}/hf-project`;
  }
  return `${dir}/hf-project`;
}

export { resolvePromoPathForTaskDir, resolveTaskDirFromHfPath };

export function resolvePromoPathFromApiPath(apiPath: string): string | undefined {
  const taskDir = resolveTaskDirFromHfPath(apiPath);
  if (!taskDir) return undefined;
  return resolvePromoPathForTaskDir(taskDir);
}

export function resolveHfProjectDirFromApiPath(apiPath: string): string | undefined {
  const fromPath = resolveHfProjectDirFromPath(apiPath);
  if (fromPath) return fromPath;
  const taskDir = resolveTaskDirFromHfPath(apiPath);
  if (taskDir) return `${taskDir}/hf-project`;
  return undefined;
}

/** Hint for cloud-storage split: prefer explicit hintDir over project API fullPath. */
export function resolveHfHintDir(apiPath: string, hintDir?: string): string | undefined {
  if (hintDir) return normalizeArtifactPath(hintDir);
  return resolveTaskDirFromHfPath(apiPath);
}
