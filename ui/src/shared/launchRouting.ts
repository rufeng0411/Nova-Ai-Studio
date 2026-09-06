// PD-SAAS-FORK: Launch Sheet routing — registry gate before Hub try
import bundledCatalog from '../generated/capabilities.catalog.json';
import launchRegistry from '../generated/launch-registry.json';

export type LaunchMode = 'skip' | 'choice' | 'visual';

const launchModeBySlug = new Map<string, string>();
for (const skill of (bundledCatalog as { skills?: Array<{ slug?: string; launch_mode?: string }> }).skills || []) {
  if (skill.slug && skill.launch_mode) {
    launchModeBySlug.set(skill.slug, skill.launch_mode);
  }
}

const registryLaunchModeBySlug = new Map<string, string>();
const registryCaps = (launchRegistry as { capabilities?: Record<string, { launch_mode?: string }> }).capabilities ?? {};
for (const [slug, entry] of Object.entries(registryCaps)) {
  if (entry?.launch_mode) registryLaunchModeBySlug.set(slug, entry.launch_mode);
}

/** Resolve launch_mode: registry overrides stale API/catalog `skip`; explicit visual/choice wins. */
export function resolveLaunchModeForSlug(slug: string, launchMode?: string): LaunchMode {
  const fromRegistry = registryLaunchModeBySlug.get(slug);
  const fromCatalog = launchModeBySlug.get(slug);
  if (launchMode === 'visual' || launchMode === 'choice') {
    return normalizeLaunchMode(launchMode);
  }
  if (fromRegistry === 'visual' || fromRegistry === 'choice') {
    return normalizeLaunchMode(fromRegistry);
  }
  return normalizeLaunchMode(launchMode || fromCatalog);
}

export type LaunchRoutingInput = {
  slug: string;
  launchMode?: LaunchMode | string;
  source?: 'capability' | 'process_template' | 'slash';
  sessionHasArtifactForSlug?: boolean;
  userMessagePrefilled?: boolean;
  userSkipVisual?: boolean;
};

export type LaunchRoutingResult = {
  open: boolean;
  mode: LaunchMode;
};

export function shouldOpenLaunchSheet(input: LaunchRoutingInput): LaunchRoutingResult {
  const mode = resolveLaunchModeForSlug(input.slug, input.launchMode);
  if (mode === 'skip') {
    return { open: false, mode: 'skip' };
  }

  if (input.userSkipVisual) {
    return { open: false, mode: 'skip' };
  }

  if (input.sessionHasArtifactForSlug) {
    return { open: false, mode: 'skip' };
  }

  if (input.userMessagePrefilled && input.slug === 'html-ppt') {
    return { open: false, mode: 'skip' };
  }

  if (isLaunchSheetGloballyDisabled()) {
    return { open: false, mode: 'skip' };
  }

  return { open: true, mode };
}

function isLaunchSheetGloballyDisabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PILOTDECK_LAUNCH_SHEET === '0') {
    return true;
  }
  if (typeof process !== 'undefined' && process.env?.PILOTDECK_LAUNCH_SHEET === '0') {
    return true;
  }
  return false;
}

function normalizeLaunchMode(value?: string): LaunchMode {
  if (value === 'visual' || value === 'choice') return value;
  return 'skip';
}
