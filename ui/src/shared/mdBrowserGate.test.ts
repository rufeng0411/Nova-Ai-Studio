// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isMdBrowserToolEnabled } from './mdBrowserGate';
import { applyRuntimeFeatureFlags, resetRuntimeFeatureFlagsForTests } from './runtimeFeatureFlags';

describe('mdBrowserGate', () => {
  const prevPilot = process.env.PILOTDECK_MD_BROWSER_TOOL;
  const prevVite = process.env.VITE_MD_BROWSER_TOOL;

  afterEach(() => {
    process.env.PILOTDECK_MD_BROWSER_TOOL = prevPilot;
    process.env.VITE_MD_BROWSER_TOOL = prevVite;
    resetRuntimeFeatureFlagsForTests();
  });

  beforeEach(() => {
    delete process.env.PILOTDECK_MD_BROWSER_TOOL;
    delete process.env.VITE_MD_BROWSER_TOOL;
    resetRuntimeFeatureFlagsForTests();
  });

  it('defaults to off before runtime hydrate', () => {
    expect(isMdBrowserToolEnabled()).toBe(false);
  });

  it('respects runtime feature flags', () => {
    applyRuntimeFeatureFlags({
      deliverableCertificateUi: false,
      exportSnapshotV2: false,
      exportUserAuditModes: false,
      deliverableSettledAcceptanceAuthority: true,
      deliverableTrustCopyV2: true,
      uiStrictCompletionGate: true,
      hyperframesHubV2: true,
      marketingSite: false,
      preflightStudioMode: 'off',
      bentoDeckEditor: false,
      mdBrowserTool: true,
    });
    expect(isMdBrowserToolEnabled()).toBe(true);
  });

  it('explicit env disable wins before runtime hydrate', () => {
    process.env.PILOTDECK_MD_BROWSER_TOOL = '0';
    expect(isMdBrowserToolEnabled()).toBe(false);
  });
});
