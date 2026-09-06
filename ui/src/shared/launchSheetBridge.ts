// PD-SAAS-FORK: open LaunchSheet from Hub try
import type { CapabilityBindingContext } from './capabilityBinding';
import type { CapabilityTryHandlers } from './capabilityTryBridge';
import { shouldOpenLaunchSheet } from './launchRouting';

export type LaunchSheetRequest = {
  slug: string;
  displayName: string;
  launchMode?: string;
  fallbackPrompt: string;
  capability: CapabilityBindingContext;
  handlers?: CapabilityTryHandlers;
  sessionHasArtifactForSlug?: boolean;
};

const LAUNCH_SHEET_EVENT = 'pilotdeck:open-launch-sheet';

export function dispatchOpenLaunchSheet(request: LaunchSheetRequest): void {
  window.dispatchEvent(new CustomEvent(LAUNCH_SHEET_EVENT, { detail: request }));
}

export function subscribeLaunchSheet(
  handler: (request: LaunchSheetRequest) => void,
): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<LaunchSheetRequest>).detail;
    if (detail?.slug) handler(detail);
  };
  window.addEventListener(LAUNCH_SHEET_EVENT, listener);
  return () => window.removeEventListener(LAUNCH_SHEET_EVENT, listener);
}

export function maybeOpenLaunchSheet(request: LaunchSheetRequest): boolean {
  const routing = shouldOpenLaunchSheet({
    slug: request.slug,
    launchMode: request.launchMode ?? request.capability?.launchMode,
    sessionHasArtifactForSlug: request.sessionHasArtifactForSlug,
  });
  if (!routing.open) return false;
  dispatchOpenLaunchSheet(request);
  return true;
}
