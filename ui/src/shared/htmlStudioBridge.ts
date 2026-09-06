// PD-SAAS-FORK: Composer ↔ HTML Studio bridge (prefill @ refs + html-edit)
import { normalizeArtifactPath } from './artifactPaths';
import { isHtmlStudioEnabled } from './htmlStudioGate';

const PREFILL_EVENT = 'pilotdeck:html-studio-prefill';
const UPDATED_EVENT = 'pilotdeck:html-deliverable-updated';

export type HtmlStudioPrefillDetail = {
  htmlPath: string;
  instruction: string;
  selectedFieldId?: string;
  force?: boolean;
};

export type HtmlDeliverableUpdatedDetail = {
  htmlPath: string;
  projectName?: string;
};

export function dispatchHtmlStudioPrefill(detail: HtmlStudioPrefillDetail): void {
  if (typeof window === 'undefined' || !isHtmlStudioEnabled()) return;
  window.dispatchEvent(new CustomEvent(PREFILL_EVENT, { detail }));
}

export function subscribeHtmlStudioPrefill(
  handler: (detail: HtmlStudioPrefillDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    const custom = event as CustomEvent<HtmlStudioPrefillDetail>;
    if (custom.detail?.htmlPath) handler(custom.detail);
  };
  window.addEventListener(PREFILL_EVENT, listener);
  return () => window.removeEventListener(PREFILL_EVENT, listener);
}

export function buildHtmlEditPrompt(paths: string[], instruction: string, fieldId?: string): string {
  const refs = paths.map((path) => `@${normalizeArtifactPath(path)}`).join(' ');
  const fieldAttr = fieldId ? ` field="${fieldId}"` : '';
  return `${refs}\n<html-edit${fieldAttr}>${instruction}</html-edit>`;
}

export function dispatchHtmlDeliverableUpdated(detail: HtmlDeliverableUpdatedDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(UPDATED_EVENT, { detail }));
}

export function subscribeHtmlDeliverableUpdated(
  handler: (detail: HtmlDeliverableUpdatedDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    const custom = event as CustomEvent<HtmlDeliverableUpdatedDetail>;
    if (custom.detail?.htmlPath) handler(custom.detail);
  };
  window.addEventListener(UPDATED_EVENT, listener);
  return () => window.removeEventListener(UPDATED_EVENT, listener);
}
