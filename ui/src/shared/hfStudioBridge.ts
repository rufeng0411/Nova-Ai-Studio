// PD-SAAS-FORK: HyperFrames Studio ↔ Composer bridge events
import { normalizeArtifactPath } from './artifactPaths';
import { resolveHfProjectDirFromApiPath } from './hfStudioPathResolve';

export const HF_DELIVERABLE_UPDATED_EVENT = 'pilotdeck:hf-deliverable-updated';
export const HF_STUDIO_PREFILL_EVENT = 'pilotdeck:hf-studio-prefill';

export type HfDeliverableUpdatedDetail = {
  promoPath?: string;
  taskArtifactDir?: string;
  sessionId?: string;
};

export function dispatchHfDeliverableUpdated(detail: HfDeliverableUpdatedDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(HF_DELIVERABLE_UPDATED_EVENT, { detail }));
}

export function subscribeHfDeliverableUpdated(
  handler: (detail: HfDeliverableUpdatedDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    handler((event as CustomEvent<HfDeliverableUpdatedDetail>).detail ?? {});
  };
  window.addEventListener(HF_DELIVERABLE_UPDATED_EVENT, listener);
  return () => window.removeEventListener(HF_DELIVERABLE_UPDATED_EVENT, listener);
}

export function buildHfEditPrompt(apiPath: string, instruction?: string): string {
  const projectDir = resolveHfProjectDirFromApiPath(apiPath) ?? apiPath;
  const path = normalizeArtifactPath(projectDir);
  const indexPath = path.endsWith('/hf-project') ? `${path}/index.html` : path;
  const body = instruction?.trim() || '请协助调整 HyperFrames 工程（分镜/GSAP/时长）。';
  return `@${indexPath}\n\n<hf-edit>\n${body}\n</hf-edit>`;
}

export function dispatchHfStudioPrefill(prompt: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(HF_STUDIO_PREFILL_EVENT, { detail: { prompt } }));
}

export function subscribeHfStudioPrefill(handler: (prompt: string) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    const prompt = (event as CustomEvent<{ prompt?: string }>).detail?.prompt ?? '';
    if (prompt) handler(prompt);
  };
  window.addEventListener(HF_STUDIO_PREFILL_EVENT, listener);
  return () => window.removeEventListener(HF_STUDIO_PREFILL_EVENT, listener);
}
