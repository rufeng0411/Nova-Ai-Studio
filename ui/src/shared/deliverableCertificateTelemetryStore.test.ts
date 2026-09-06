import { beforeEach, describe, expect, it } from 'vitest';
import {
  CERTIFICATE_OBSERVATION_AUDIT_LIMIT,
  CERTIFICATE_OBSERVATION_AUDIT_STORAGE_KEY,
  persistDeliverableCertificateObservation,
  recordDeliverableCertificateObservationEffect,
} from './deliverableCertificateTelemetryStore';
import {
  DELIVERABLE_CERTIFICATE_TELEMETRY_EVENT,
  type DeliverableCertificateObservation,
  type DeliverableCertificateTelemetryDetail,
} from './turnAcceptanceMeta';

function observation(stableKey: string): DeliverableCertificateObservation {
  return {
    case: 'shadow_diff',
    reason: 'legacy_strict_status_diff',
    certificateVersion: 2,
    contractHashVersion: 2,
    contractHash: 'sensitive-contract-hash',
    legacyAcceptanceStatus: 'needs_repair',
    strictAcceptanceStatus: 'passed',
    stableKey,
  };
}

describe('deliverableCertificateTelemetryStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists only bounded anonymous audit fields and deduplicates across refresh', () => {
    expect(persistDeliverableCertificateObservation({
      sessionId: 'session-audit',
      observation: observation('raw-key|artifacts/private/report.md'),
      now: 1234,
    })).toBe('recorded');
    expect(persistDeliverableCertificateObservation({
      sessionId: 'session-audit',
      observation: observation('raw-key|artifacts/private/report.md'),
      now: 5678,
    })).toBe('duplicate');

    const raw = localStorage.getItem(CERTIFICATE_OBSERVATION_AUDIT_STORAGE_KEY) ?? '';
    const records = JSON.parse(raw) as Array<Record<string, unknown>>;
    expect(records).toEqual([{
      sessionKeyHash: expect.stringMatching(/^ds-[a-f0-9]+$/),
      timestamp: 1234,
      reason: 'legacy_strict_status_diff',
      certificateVersion: 2,
      contractHashVersion: 2,
      legacyAcceptanceStatus: 'needs_repair',
      strictAcceptanceStatus: 'passed',
      stableKey: expect.stringMatching(/^dc-[a-f0-9]+$/),
    }]);
    expect(raw).not.toContain('sensitive-contract-hash');
    expect(raw).not.toContain('artifacts/private/report.md');
    expect(raw).not.toContain('session-audit');
    expect(raw).not.toContain('"sessionId"');
    expect(raw).not.toContain('"case"');
  });

  it('caps the persistent audit log at the configured limit', () => {
    for (let index = 0; index < CERTIFICATE_OBSERVATION_AUDIT_LIMIT + 3; index += 1) {
      persistDeliverableCertificateObservation({
        sessionId: 'session-cap',
        observation: observation(`observation-${index}`),
        now: index,
      });
    }

    const records = JSON.parse(
      localStorage.getItem(CERTIFICATE_OBSERVATION_AUDIT_STORAGE_KEY) ?? '[]',
    ) as Array<{ timestamp: number }>;
    expect(records).toHaveLength(CERTIFICATE_OBSERVATION_AUDIT_LIMIT);
    expect(records[0]?.timestamp).toBe(3);
  });

  it('deduplicates effect dispatches across rerenders and refreshed key sets', () => {
    const detail: DeliverableCertificateTelemetryDetail[] = [];
    const listener = (event: Event) => {
      detail.push((event as CustomEvent<DeliverableCertificateTelemetryDetail>).detail);
    };
    const currentRenderKeys = new Set<string>();
    window.addEventListener(DELIVERABLE_CERTIFICATE_TELEMETRY_EVENT, listener);

    try {
      expect(recordDeliverableCertificateObservationEffect({
        sessionId: 'session-effect',
        observation: observation('effect-key'),
        seenKeys: currentRenderKeys,
      })).toBe(true);
      expect(recordDeliverableCertificateObservationEffect({
        sessionId: 'session-effect',
        observation: observation('effect-key'),
        seenKeys: currentRenderKeys,
      })).toBe(false);
      expect(recordDeliverableCertificateObservationEffect({
        sessionId: 'session-effect',
        observation: observation('effect-key'),
        seenKeys: new Set<string>(),
      })).toBe(false);
      expect(detail).toHaveLength(1);
      expect(detail[0]).toMatchObject({
        event: 'deliverable_certificate_ui',
        case: 'shadow_diff',
      });
    } finally {
      window.removeEventListener(DELIVERABLE_CERTIFICATE_TELEMETRY_EVENT, listener);
    }
  });
});
