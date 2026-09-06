/**
 * PD-SAAS-FORK: gate sidebar tail prefetch so primary session loads win over hover storms.
 */
let primarySessionLoads = 0;
let prefetchGeneration = 0;
let activePrimarySessionId: string | null = null;

export function beginPrimarySessionMessageLoad(sessionId?: string): void {
  primarySessionLoads += 1;
  prefetchGeneration += 1;
  if (sessionId) activePrimarySessionId = sessionId;
}

export function endPrimarySessionMessageLoad(): void {
  primarySessionLoads = Math.max(0, primarySessionLoads - 1);
  if (primarySessionLoads === 0) activePrimarySessionId = null;
}

export function getActivePrimarySessionId(): string | null {
  return primarySessionLoads > 0 ? activePrimarySessionId : null;
}

export function shouldAllowSidebarTailPrefetch(): boolean {
  if (primarySessionLoads > 0) return false;
  if (typeof navigator !== 'undefined') {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (conn?.saveData === true) return false;
    const effectiveType = conn?.effectiveType;
    if (effectiveType === '2g' || effectiveType === 'slow-2g') return false;
  }
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches) {
    return false;
  }
  return true;
}

export function bumpPrefetchGeneration(): number {
  prefetchGeneration += 1;
  return prefetchGeneration;
}

export function getPrefetchGeneration(): number {
  return prefetchGeneration;
}
