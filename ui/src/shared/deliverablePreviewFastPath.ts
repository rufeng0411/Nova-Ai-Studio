/**
 * PD-SAAS-FORK: skip Bridge file/resolve when dock row already carries a scoped artifact path.
 */
import { extractTaskArtifactDirectory } from '../../shared/deliverablePathResolve.mjs';
import { isPromoMp4Path, isHfProjectPath } from './hfStudioSupport';

export function shouldSkipDeliverablePathResolve(apiPath: string, hintDir?: string): boolean {
  const normalized = apiPath.replace(/\\/g, '/').trim();
  if (!normalized) return false;
  if (isHfProjectPath(normalized) || isPromoMp4Path(normalized)) return true;

  const hint = hintDir?.replace(/\\/g, '/').trim();
  if (hint) {
    const pathTask = extractTaskArtifactDirectory(normalized);
    const hintTask = extractTaskArtifactDirectory(hint)
      ?? (hint.startsWith('artifacts/task-') ? hint.replace(/\/+$/, '') : null);
    if (pathTask && hintTask && pathTask.toLowerCase() !== hintTask.toLowerCase()) {
      return false;
    }
  }

  if (normalized.startsWith('artifacts/')) return true;
  if (normalized.includes('/')) return true;
  return Boolean(hint?.startsWith('artifacts/'));
}
