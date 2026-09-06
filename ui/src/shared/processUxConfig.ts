// PD-SAAS-FORK: client-side process UX feature flags

export type ProcessUxConfig = {
  enabled: boolean;
  deadManGuidance: boolean;
  staleTurnWarnSec: number;
  staleTurnFallbackSec: number;
};

export function resolveClientProcessUxConfig(): ProcessUxConfig {
  if (typeof window !== 'undefined' && window.localStorage?.getItem('pilotdeck:processUx') === '0') {
    return { enabled: false, deadManGuidance: false, staleTurnWarnSec: 0, staleTurnFallbackSec: 0 };
  }
  return {
    enabled: true,
    deadManGuidance: true,
    staleTurnWarnSec: 90,
    staleTurnFallbackSec: 180,
  };
}
