// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { isBentoDeckEnabled } from './bentoStudioGate';
import { applyRuntimeFeatureFlags, resetRuntimeFeatureFlagsForTests } from './runtimeFeatureFlags';

describe('bentoStudioGate', () => {
  const prevBento = process.env.VITE_BENTO_DECK_PREVIEW;
  const prevPilot = process.env.PILOTDECK_BENTO_DECK_EDITOR;

  afterEach(() => {
    process.env.VITE_BENTO_DECK_PREVIEW = prevBento;
    process.env.PILOTDECK_BENTO_DECK_EDITOR = prevPilot;
    resetRuntimeFeatureFlagsForTests();
  });

  beforeEach(() => {
    delete process.env.VITE_BENTO_DECK_PREVIEW;
    delete process.env.PILOTDECK_BENTO_DECK_EDITOR;
    resetRuntimeFeatureFlagsForTests();
  });

  it('defaults to off when unset', () => {
    expect(isBentoDeckEnabled()).toBe(false);
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
      bentoDeckEditor: true,
      mdBrowserTool: false,
    });
    expect(isBentoDeckEnabled()).toBe(true);
  });

  it('runtime flags win over vite bake enable', () => {
    process.env.VITE_BENTO_DECK_PREVIEW = '1';
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
      mdBrowserTool: false,
    });
    expect(isBentoDeckEnabled()).toBe(false);
  });

  it('explicit env disable still kills bento before runtime hydrate', () => {
    process.env.VITE_BENTO_DECK_PREVIEW = '0';
    expect(isBentoDeckEnabled()).toBe(false);
  });
});
