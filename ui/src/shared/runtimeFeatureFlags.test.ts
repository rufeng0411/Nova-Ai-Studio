import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticatedFetch } from '../utils/api';
import { DEFAULT_MCP_FEATURES } from './platformFeatures';
import {
  fetchRuntimeFeatureFlags,
  getRuntimeFeatureFlags,
  resetRuntimeFeatureFlagsForTests,
} from './runtimeFeatureFlags';

vi.mock('../utils/api', () => ({
  authenticatedFetch: vi.fn(),
}));

function response(input: { ok: boolean; body?: unknown }): Response {
  return {
    ok: input.ok,
    json: async () => input.body,
  } as Response;
}

const SAFE_DEFAULTS = {
  deliverableCertificateUi: false,
  deliverableQualityUi: false,
  exportSnapshotV2: false,
  exportUserAuditModes: false,
  deliverableSettledAcceptanceAuthority: true,
  deliverableTrustCopyV2: true,
  uiStrictCompletionGate: true,
  hyperframesHubV2: true,
  marketingSite: false,
  preflightStudioMode: 'off' as const,
  bentoDeckEditor: false,
  mdBrowserTool: true,
  mcpFeatures: { ...DEFAULT_MCP_FEATURES },
  n2BotMode: 'off',
};

describe('runtimeFeatureFlags', () => {
  beforeEach(() => {
    resetRuntimeFeatureFlagsForTests();
    vi.mocked(authenticatedFetch).mockReset();
  });

  it('fails safe with every runtime UI flag off when the endpoint fails', async () => {
    vi.mocked(authenticatedFetch).mockRejectedValueOnce(new Error('bridge unavailable'));

    await expect(fetchRuntimeFeatureFlags()).resolves.toEqual(SAFE_DEFAULTS);
    expect(getRuntimeFeatureFlags()).toEqual(SAFE_DEFAULTS);
  });

  it('fails safe with every runtime UI flag off on a non-ok response', async () => {
    vi.mocked(authenticatedFetch).mockResolvedValueOnce(response({
      ok: false,
      body: {
        PILOTDECK_UI_DELIVERABLE_CERTIFICATE: true,
        PILOTDECK_UI_DELIVERABLE_QUALITY: true,
        PILOTDECK_UI_EXPORT_SNAPSHOT_V2: true,
        PILOTDECK_UI_EXPORT_USER_AUDIT_MODES: true,
      },
    }));

    await expect(fetchRuntimeFeatureFlags()).resolves.toEqual(SAFE_DEFAULTS);
  });

  it('accepts only explicit boolean true values from the Bridge', async () => {
    vi.mocked(authenticatedFetch).mockResolvedValueOnce(response({
      ok: true,
      body: {
        PILOTDECK_UI_DELIVERABLE_CERTIFICATE: true,
        PILOTDECK_UI_DELIVERABLE_QUALITY: true,
        PILOTDECK_UI_EXPORT_SNAPSHOT_V2: '1',
        PILOTDECK_UI_EXPORT_USER_AUDIT_MODES: false,
        PILOTDECK_MARKETING_SITE: true,
        PILOTDECK_PREFLIGHT_STUDIO: 'shadow',
      },
    }));

    await expect(fetchRuntimeFeatureFlags()).resolves.toMatchObject({
      ...SAFE_DEFAULTS,
      deliverableCertificateUi: true,
      deliverableQualityUi: true,
      marketingSite: true,
      preflightStudioMode: 'shadow',
    });
  });

  it('parses PILOTDECK_N2_BOT shadow and aliases the old key', async () => {
    vi.mocked(authenticatedFetch).mockResolvedValueOnce(response({
      ok: true,
      body: { PILOTDECK_N2_BOT: 'shadow' },
    }));
    await expect(fetchRuntimeFeatureFlags()).resolves.toMatchObject({ n2BotMode: 'shadow' });
  });
});
