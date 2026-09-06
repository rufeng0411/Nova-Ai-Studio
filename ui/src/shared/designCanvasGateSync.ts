// PD-SAAS-FORK: sync design canvas UI gate with server user preferences
import { saasApi } from '../saas/api/saasApi';
import { isDesignCanvasBuildDisabled, setDesignCanvasEnabled } from './designCanvasGate';

export async function persistDesignCanvasEnabledToServer(enabled: boolean): Promise<void> {
  if (isDesignCanvasBuildDisabled()) return;
  try {
    await saasApi.updatePreferences({ designCanvasEnabled: enabled });
  } catch {
    // non-fatal — localStorage remains source of truth for UI
  }
}

export async function hydrateDesignCanvasFromServerPreferences(): Promise<void> {
  if (isDesignCanvasBuildDisabled() || typeof window === 'undefined') return;
  try {
    const res = await saasApi.getPreferences();
    if (!res.ok) return;
    const data = (await res.json()) as { preferences?: { designCanvasEnabled?: boolean } };
    if (data.preferences?.designCanvasEnabled === true) {
      setDesignCanvasEnabled(true);
    }
  } catch {
    // ignore
  }
}

/** E2E / dev: enable both UI gate and document that Gateway needs PILOTDECK_DESIGN_CANVAS=1 */
export function enableDesignCanvasForTesting(): void {
  setDesignCanvasEnabled(true);
}
