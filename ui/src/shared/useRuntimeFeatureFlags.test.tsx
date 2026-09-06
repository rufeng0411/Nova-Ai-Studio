import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyRuntimeFeatureFlags,
  resetRuntimeFeatureFlagsForTests,
} from './runtimeFeatureFlags';
import { useRuntimeFeatureFlags } from './useRuntimeFeatureFlags';

describe('useRuntimeFeatureFlags', () => {
  afterEach(() => {
    resetRuntimeFeatureFlagsForTests();
  });

  it('updates consumers immediately when the runtime certificate flag changes', () => {
    const { result } = renderHook(() => useRuntimeFeatureFlags());
    expect(result.current).toBeNull();

    act(() => {
      applyRuntimeFeatureFlags({
        deliverableCertificateUi: true,
        exportSnapshotV2: false,
        exportUserAuditModes: false,
      });
    });

    expect(result.current?.deliverableCertificateUi).toBe(true);
  });
});
