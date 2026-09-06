// PD-SAAS-FORK: HyperFrames Studio edit surface resolution + gate helpers
import { normalizeArtifactPath } from './artifactPaths';
import type { ArtifactContract } from './artifactContract';
import { isHfStudioEnabled } from './hfStudioGate';
import { isMobilePreviewSurface } from './htmlStudioSupport';

export const HF_PROJECT_RE = /(?:^|\/)artifacts\/task-[^/]+\/hf-project(?:\/|$)/i;
const PROMO_MP4_RE = /(?:^|\/)artifacts\/task-[^/]+\/promo\.mp4$/i;
const HF_PROJECT_INDEX = /(?:^|\/)hf-project\/index\.html?$/i;

export type HfStudioPreviewSurface = 'overlay' | 'sidebar';

export function isHfProjectPath(apiPath?: string): boolean {
  const path = normalizeArtifactPath(apiPath || '');
  return HF_PROJECT_RE.test(path);
}

export function isPromoMp4Path(apiPath?: string): boolean {
  const path = normalizeArtifactPath(apiPath || '');
  return PROMO_MP4_RE.test(path);
}

export function resolveHfProjectDirFromPath(apiPath: string): string | undefined {
  const path = normalizeArtifactPath(apiPath);
  const match = path.match(/^(.*\/hf-project)(?:\/|$)/i);
  return match?.[1];
}

export function resolveTaskDirFromHfPath(apiPath: string): string | undefined {
  const path = normalizeArtifactPath(apiPath);
  const match = path.match(/^(artifacts\/task-[^/]+)/i);
  return match?.[1];
}

export function hasHfProjectSibling(siblings: string[] | undefined, taskDir?: string): boolean {
  if (!siblings?.length) return false;
  const prefix = taskDir ? `${normalizeArtifactPath(taskDir)}/` : '';
  return siblings.some((s) => {
    const n = normalizeArtifactPath(s);
    if (taskDir && !n.startsWith(prefix)) return false;
    return HF_PROJECT_INDEX.test(n) || n.endsWith('/hf-project/index.html');
  });
}

export function supportsHyperframesStudioView(
  fileName: string,
  apiPath?: string,
  siblings?: string[],
): boolean {
  if (!isHfStudioEnabled()) return false;
  const path = normalizeArtifactPath(apiPath || fileName);
  if (isHfProjectPath(path)) return true;
  if (isPromoMp4Path(path)) {
    const taskDir = resolveTaskDirFromHfPath(path);
    if (taskDir && /\/task-/i.test(taskDir)) return true;
    return hasHfProjectSibling(siblings, taskDir);
  }
  if (/\.html?$/i.test(fileName) && HF_PROJECT_RE.test(path)) return true;
  return false;
}

export function supportsHyperframesStudioEdit(
  fileName: string,
  apiPath?: string,
  siblings?: string[],
): boolean {
  if (!isHfStudioEnabled()) return false;
  if (isMobilePreviewSurface()) return false;
  return supportsHyperframesStudioView(fileName, apiPath, siblings);
}

export function supportsHyperframesStudioEditContract(
  contract: ArtifactContract,
  fileName: string,
  apiPath?: string,
  siblings?: string[],
): boolean {
  if (contract.carrierScope === 'hyperframes_project') {
    return supportsHyperframesStudioEdit(fileName, apiPath, siblings);
  }
  return supportsHyperframesStudioEdit(fileName, apiPath, siblings);
}

export function canEnterHfStudioEditMode(surface: HfStudioPreviewSurface): boolean {
  return surface === 'sidebar' && !isMobilePreviewSurface();
}

export function resolveHfProjectIndexPath(apiPath: string, siblings?: string[]): string {
  const path = normalizeArtifactPath(apiPath);
  if (HF_PROJECT_INDEX.test(path) || path.endsWith('/hf-project/index.html')) return path;
  const taskDir = resolveTaskDirFromHfPath(path);
  if (taskDir) return `${taskDir}/hf-project/index.html`;
  if (isHfProjectPath(path)) {
    return path.endsWith('/hf-project') ? `${path}/index.html` : path;
  }
  const sibling = siblings?.find((s) => HF_PROJECT_INDEX.test(normalizeArtifactPath(s)));
  if (sibling) return normalizeArtifactPath(sibling);
  return `${taskDir ?? 'artifacts/task-unknown'}/hf-project/index.html`;
}

export function resolvePromoPathForTaskDir(taskDir: string): string {
  return `${normalizeArtifactPath(taskDir)}/promo.mp4`;
}
