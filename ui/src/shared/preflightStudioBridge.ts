// PD-SAAS-FORK: Preflight Studio bridge — open right-rail Preflight from Hub/SDM
import type { PreflightStudioRequest } from './preflightSelection';
import { isPreflightStudioEnabled } from './preflightStudioGate';
import { shouldOpenLaunchSheet, type LaunchRoutingInput } from './launchRouting';

const PREFLIGHT_OPEN_EVENT = 'pilotdeck:open-preflight-studio';

export type PreflightOpenRequest = PreflightStudioRequest & {
  fallbackPrompt?: string;
  /** Hub try vs composer natural-language intercept. */
  source?: 'hub' | 'composer';
  /** After confirm, auto-submit composer (conversation intercept path). */
  autoSubmitAfterConfirm?: boolean;
};

const PREFLIGHT_COMPOSER_SUBMIT_EVENT = 'pilotdeck:preflight-composer-submit';

export function dispatchPreflightComposerSubmit(): void {
  window.dispatchEvent(new CustomEvent(PREFLIGHT_COMPOSER_SUBMIT_EVENT));
}

export function subscribePreflightComposerSubmit(handler: () => void): () => void {
  const listener = () => handler();
  window.addEventListener(PREFLIGHT_COMPOSER_SUBMIT_EVENT, listener);
  return () => window.removeEventListener(PREFLIGHT_COMPOSER_SUBMIT_EVENT, listener);
}

export function dispatchOpenPreflightStudio(request: PreflightOpenRequest): void {
  window.dispatchEvent(new CustomEvent(PREFLIGHT_OPEN_EVENT, { detail: request }));
}

export function subscribePreflightStudio(
  handler: (request: PreflightOpenRequest) => void,
): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<PreflightOpenRequest>).detail;
    if (detail?.slug) handler(detail);
  };
  window.addEventListener(PREFLIGHT_OPEN_EVENT, listener);
  return () => window.removeEventListener(PREFLIGHT_OPEN_EVENT, listener);
}

export type PreflightRoutingResult = {
  openPreflight: boolean;
  openSheet: boolean;
  mode: 'skip' | 'choice' | 'visual';
};

export function resolvePreflightRouting(input: LaunchRoutingInput): PreflightRoutingResult {
  const base = shouldOpenLaunchSheet(input);
  if (!base.open) {
    return { openPreflight: false, openSheet: false, mode: base.mode };
  }
  const preflightOn = isPreflightStudioEnabled();
  const odPpt = input.slug === 'open-design' || input.slug === 'ppt-master';
  if (preflightOn && odPpt && base.mode === 'visual') {
    return { openPreflight: true, openSheet: false, mode: base.mode };
  }
  // Preflight 关闭时 open-design / ppt-master 不再回退旧版 LaunchSheet，直接走「试一下」预填
  if (!preflightOn && odPpt && base.mode === 'visual') {
    return { openPreflight: false, openSheet: false, mode: 'skip' };
  }
  if (!preflightOn && base.mode === 'visual') {
    return { openPreflight: false, openSheet: true, mode: base.mode };
  }
  return { openPreflight: false, openSheet: base.open, mode: base.mode };
}

export function maybeOpenPreflightOrSheet(
  request: PreflightOpenRequest & { launchMode?: string; sessionHasArtifactForSlug?: boolean },
): 'preflight' | 'sheet' | 'none' {
  const routing = resolvePreflightRouting({
    slug: request.slug,
    launchMode: request.launchMode,
    sessionHasArtifactForSlug: request.sessionHasArtifactForSlug,
  });
  if (routing.openPreflight) {
    dispatchOpenPreflightStudio(request);
    return 'preflight';
  }
  return 'none';
}
