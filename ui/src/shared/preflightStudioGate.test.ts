// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  isPreflightStudioEnabled,
  normalizePreflightStudioMode,
  shouldSuppressPptFlaskConfirm,
} from './preflightStudioGate';
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

describe('preflightStudioGate', () => {
  const prevStudio = process.env.PILOTDECK_PREFLIGHT_STUDIO;
  const prevFlask = process.env.PILOTDECK_PPT_SUPPRESS_FLASK_CONFIRM;

  afterEach(() => {
    process.env.PILOTDECK_PREFLIGHT_STUDIO = prevStudio;
    process.env.PILOTDECK_PPT_SUPPRESS_FLASK_CONFIRM = prevFlask;
    resetRuntimeFeatureFlagsForTests();
  });

  it('normalizes shadow/enforce/off', () => {
    expect(normalizePreflightStudioMode('shadow')).toBe('shadow');
    expect(normalizePreflightStudioMode('enforce')).toBe('enforce');
    expect(normalizePreflightStudioMode('off')).toBe('off');
    expect(normalizePreflightStudioMode(undefined)).toBe('off');
  });

  it('defaults to off when unset', () => {
    delete process.env.PILOTDECK_PREFLIGHT_STUDIO;
    expect(isPreflightStudioEnabled()).toBe(false);
  });

  it('shadow enables preflight via runtime flags', () => {
    applyRuntimeFeatureFlags({ ...BASE_RUNTIME, preflightStudioMode: 'shadow' });
    expect(isPreflightStudioEnabled()).toBe(true);
  });

  it('ignores vite bake shadow before runtime hydrate', () => {
    process.env.PILOTDECK_PREFLIGHT_STUDIO = 'shadow';
    expect(isPreflightStudioEnabled()).toBe(false);
  });

  it('suppresses Flask when preflight on', () => {
    applyRuntimeFeatureFlags({ ...BASE_RUNTIME, preflightStudioMode: 'shadow' });
    process.env.PILOTDECK_PPT_SUPPRESS_FLASK_CONFIRM = '';
    expect(shouldSuppressPptFlaskConfirm()).toBe(true);
  });
});
