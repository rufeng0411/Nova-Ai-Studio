// PD-SAAS-FORK: Bento deck edit surface resolution
import { normalizeArtifactPath } from './artifactPaths';
import type { ArtifactContract } from './artifactContract';
import { isBentoDeckEnabled } from './bentoStudioGate';
import { isMobilePreviewSurface } from './htmlStudioSupport';

export type BentoStudioPreviewSurface = 'sidebar' | 'overlay';

export function isBentoDeckFile(fileName: string, apiPath?: string): boolean {
  const path = normalizeArtifactPath(apiPath || fileName);
  return /\.bento\.html$/i.test(path);
}

export function supportsBentoDeckEdit(
  fileName: string,
  apiPath?: string,
): boolean {
  if (!isBentoDeckEnabled()) return false;
  if (isMobilePreviewSurface()) return false;
  return isBentoDeckFile(fileName, apiPath);
}

export function supportsBentoDeckEditContract(
  contract: ArtifactContract,
  fileName: string,
  apiPath?: string,
): boolean {
  if (contract.carrierScope === 'bento_deck') {
    return supportsBentoDeckEdit(fileName, apiPath);
  }
  return supportsBentoDeckEdit(fileName, apiPath);
}

export function canEnterBentoStudioEditMode(surface: BentoStudioPreviewSurface): boolean {
  return surface === 'sidebar' && !isMobilePreviewSurface();
}

export function defaultBentoStudioMode(_fileName: string, _apiPath?: string): 'view' | 'edit' {
  // PD-SAAS-FORK: 默认网页预览保留原版式；用户手动切「编辑」再进 Bento
  if (isMobilePreviewSurface()) return 'view';
  return 'view';
}

export function resolveStaticDeckBackupPath(apiPath: string): string {
  return normalizeArtifactPath(apiPath).replace(/deck\.bento\.html$/i, 'deck.static.html');
}
