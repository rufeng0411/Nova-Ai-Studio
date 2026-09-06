import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isDeliverableCertificateUiEnabled,
  isDeferDeliverablesWhileStreamingEnabled,
  isExportSnapshotV2Enabled,
  isExportUserAuditModesEnabled,
  isMessageRowSessionScopeEnabled,
  isProcessGroupingIncrementalEnabled,
  messageVirtualizationThreshold,
} from './perfFeatureFlags';
import {
  applyRuntimeFeatureFlags,
  resetRuntimeFeatureFlagsForTests,
} from './runtimeFeatureFlags';

describe('perfFeatureFlags', () => {
  beforeEach(() => {
    resetRuntimeFeatureFlagsForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetRuntimeFeatureFlagsForTests();
  });

  it('defaults performance flags to enabled', () => {
    expect(isMessageRowSessionScopeEnabled()).toBe(true);
    expect(isDeferDeliverablesWhileStreamingEnabled()).toBe(true);
    expect(isProcessGroupingIncrementalEnabled()).toBe(true);
    expect(messageVirtualizationThreshold()).toBe(80);
  });

  it('uses fetched runtime false values ahead of enabled Vite build values', () => {
    vi.stubEnv('VITE_PILOTDECK_DELIVERABLE_CERTIFICATE_UI', '1');
    vi.stubEnv('VITE_EXPORT_SNAPSHOT_V2', '1');
    vi.stubEnv('VITE_EXPORT_USER_AUDIT_MODES', '1');
    applyRuntimeFeatureFlags({
      deliverableCertificateUi: false,
      exportSnapshotV2: false,
      exportUserAuditModes: false,
    });

    expect(isDeliverableCertificateUiEnabled()).toBe(false);
    expect(isExportSnapshotV2Enabled()).toBe(false);
    expect(isExportUserAuditModesEnabled()).toBe(false);
  });

  it('uses fetched runtime true values ahead of disabled Vite build values', () => {
    vi.stubEnv('VITE_PILOTDECK_DELIVERABLE_CERTIFICATE_UI', '0');
    vi.stubEnv('VITE_EXPORT_SNAPSHOT_V2', '0');
    vi.stubEnv('VITE_EXPORT_USER_AUDIT_MODES', '0');
    applyRuntimeFeatureFlags({
      deliverableCertificateUi: true,
      exportSnapshotV2: true,
      exportUserAuditModes: true,
    });

    expect(isDeliverableCertificateUiEnabled()).toBe(true);
    expect(isExportSnapshotV2Enabled()).toBe(true);
    expect(isExportUserAuditModesEnabled()).toBe(true);
  });
});
