// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { resolvePreflightRouting } from './preflightStudioBridge';
import { applyRuntimeFeatureFlags, resetRuntimeFeatureFlagsForTests } from './runtimeFeatureFlags';

const BASE_RUNTIME = {
  deliverableCertificateUi: false,
  exportSnapshotV2: false,
  exportUserAuditModes: false,
  deliverableSettledAcceptanceAuthority: true,
  deliverableTrustCopyV2: true,
  uiStrictCompletionGate: true,
  hyperframesHubV2: true,
  marketingSite: false,
  bentoDeckEditor: false,
  mdBrowserTool: false,
} as const;

describe('resolvePreflightRouting', () => {
  afterEach(() => {
    resetRuntimeFeatureFlagsForTests();
  });

  beforeEach(() => {
    applyRuntimeFeatureFlags({ ...BASE_RUNTIME, preflightStudioMode: 'shadow' });
  });

  it('routes open-design visual to preflight rail', () => {
    const r = resolvePreflightRouting({ slug: 'open-design', launchMode: 'visual' });
    expect(r.openPreflight).toBe(true);
    expect(r.openSheet).toBe(false);
  });

  it('routes ppt-master visual to preflight rail', () => {
    const r = resolvePreflightRouting({ slug: 'ppt-master', launchMode: 'visual' });
    expect(r.openPreflight).toBe(true);
  });

  it('skips launch sheet for od/ppt when preflight off', () => {
    applyRuntimeFeatureFlags({ ...BASE_RUNTIME, preflightStudioMode: 'off' });
    const r = resolvePreflightRouting({ slug: 'open-design', launchMode: 'visual' });
    expect(r.openPreflight).toBe(false);
    expect(r.openSheet).toBe(false);
    expect(r.mode).toBe('skip');
  });

  it('html-ppt stays on sheet not preflight', () => {
    const r = resolvePreflightRouting({ slug: 'html-ppt', launchMode: 'visual' });
    expect(r.openPreflight).toBe(false);
    expect(r.openSheet).toBe(true);
  });
});
