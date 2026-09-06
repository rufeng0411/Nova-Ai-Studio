import { useSyncExternalStore } from 'react';
import {
  getRuntimeFeatureFlags,
  subscribeRuntimeFeatureFlags,
  type RuntimeFeatureFlags,
} from './runtimeFeatureFlags';

export function useRuntimeFeatureFlags(): RuntimeFeatureFlags | null {
  return useSyncExternalStore(
    subscribeRuntimeFeatureFlags,
    getRuntimeFeatureFlags,
    getRuntimeFeatureFlags,
  );
}
