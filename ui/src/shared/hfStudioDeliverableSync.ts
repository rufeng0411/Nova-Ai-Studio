// PD-SAAS-FORK: HF re-render → four-line cache invalidate (Dock/footer/export/folder)
import { invalidateDeliverableValidationForProject } from './deliverableValidationCache';
import { clearSuperPreviewSiblingCache } from './superPreviewSiblingCache';
import { invalidateSessionPipelineCache } from './sessionDeliverablePipelineCache';
import { subscribeHfDeliverableUpdated } from './hfStudioBridge';

let installed = false;

export function installHfStudioDeliverableSync(
  resolveContext?: () => { projectName?: string; sessionId?: string } | undefined,
): () => void {
  if (installed) {
    return subscribeHfDeliverableUpdated(() => undefined);
  }
  installed = true;
  return subscribeHfDeliverableUpdated((detail) => {
    const ctx = resolveContext?.();
    const projectName = ctx?.projectName;
    const sessionId = ctx?.sessionId ?? detail.sessionId;
    if (projectName) {
      invalidateDeliverableValidationForProject(projectName);
    }
    if (sessionId) {
      invalidateSessionPipelineCache(sessionId);
    }
    clearSuperPreviewSiblingCache();
    if (typeof window !== 'undefined' && detail.promoPath) {
      window.dispatchEvent(
        new CustomEvent('pilotdeck:files-changed', {
          detail: { projectName, paths: [detail.promoPath] },
        }),
      );
    }
  });
}
