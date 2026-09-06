// PD-SAAS-FORK: workbench beta 1.1 feature flags (shell on|off; UX off|shadow|enforce)

import { getRuntimeFeatureFlags } from '../../../shared/runtimeFeatureFlags';

export type GrayMode = 'off' | 'shadow' | 'enforce';

function readEnv(key: string): string | undefined {
  try {
    const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
    return env?.[key];
  } catch {
    return undefined;
  }
}

export function parseOnOff(raw: string | undefined | null, fallback = false): boolean {
  if (raw == null || raw === '') return fallback;
  const v = String(raw).trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'off') return false;
  return fallback;
}

export function parseGrayMode(raw: string | undefined | null, fallback: GrayMode = 'off'): GrayMode {
  if (raw == null || raw === '') return fallback;
  const v = String(raw).trim().toLowerCase();
  if (v === 'off' || v === '0' || v === 'false') return 'off';
  if (v === 'shadow') return 'shadow';
  if (v === 'enforce' || v === '1' || v === 'true' || v === 'on') return 'enforce';
  return fallback;
}

/** Shell route enabled (dev default on via Vite env; pack default off). */
export function isWorkbenchBeta11Enabled(): boolean {
  const rt = getRuntimeFeatureFlags();
  if (rt && typeof rt.workbenchBeta11 === 'boolean') return rt.workbenchBeta11;
  return parseOnOff(readEnv('VITE_WORKBENCH_BETA_11'), false);
}

export function getWorkbenchTourMode(): GrayMode {
  const rt = getRuntimeFeatureFlags();
  if (rt?.workbenchTourMode) return rt.workbenchTourMode;
  return parseGrayMode(readEnv('VITE_WORKBENCH_TOUR'), 'off');
}

export function getTurnUsageFooterMode(): GrayMode {
  const rt = getRuntimeFeatureFlags();
  if (rt?.turnUsageFooterMode) return rt.turnUsageFooterMode;
  return parseGrayMode(readEnv('VITE_TURN_USAGE_FOOTER'), 'off');
}

export function getPostDeliverableNextMode(): GrayMode {
  const rt = getRuntimeFeatureFlags();
  if (rt?.postDeliverableNextMode) return rt.postDeliverableNextMode;
  return parseGrayMode(readEnv('VITE_POST_DELIVERABLE_NEXT'), 'off');
}
