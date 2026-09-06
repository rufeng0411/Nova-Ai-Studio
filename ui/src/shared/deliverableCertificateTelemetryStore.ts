/**
 * PD-SAAS-FORK: bounded, path-free local audit for certificate UI observations.
 */
import {
  recordDeliverableCertificateTelemetry,
  type DeliverableCertificateObservation,
} from './turnAcceptanceMeta';

export const CERTIFICATE_OBSERVATION_AUDIT_STORAGE_KEY =
  'pilotdeck:deliverable-certificate-audit:v1';
export const CERTIFICATE_OBSERVATION_AUDIT_LIMIT = 128;

type AuditStorage = Pick<Storage, 'getItem' | 'setItem'>;

export type DeliverableCertificateAuditRecord = {
  sessionKeyHash: string;
  timestamp: number;
  reason: string;
  certificateVersion?: 1 | 2;
  contractHashVersion?: 2;
  legacyAcceptanceStatus?: string;
  strictAcceptanceStatus?: string;
  stableKey: string;
};

function localHash(prefix: string, value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return `${prefix}-${(hash >>> 0).toString(16)}`;
}

function anonymousSessionKey(sessionId: string): string {
  return localHash('ds', sessionId);
}

function anonymousStableKey(sessionKeyHash: string, stableKey: string): string {
  return localHash('dc', `${sessionKeyHash}|${stableKey}`);
}

function resolveAuditStorage(storage?: AuditStorage): AuditStorage | null {
  if (storage) return storage;
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function sanitizeStoredRecord(value: unknown): DeliverableCertificateAuditRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.sessionKeyHash !== 'string'
    || typeof record.timestamp !== 'number'
    || !Number.isFinite(record.timestamp)
    || typeof record.reason !== 'string'
    || typeof record.stableKey !== 'string'
  ) {
    return null;
  }
  return {
    sessionKeyHash: record.sessionKeyHash,
    timestamp: record.timestamp,
    reason: record.reason,
    ...(record.certificateVersion === 1 || record.certificateVersion === 2
      ? { certificateVersion: record.certificateVersion }
      : {}),
    ...(record.contractHashVersion === 2 ? { contractHashVersion: 2 as const } : {}),
    ...(typeof record.legacyAcceptanceStatus === 'string'
      ? { legacyAcceptanceStatus: record.legacyAcceptanceStatus }
      : {}),
    ...(typeof record.strictAcceptanceStatus === 'string'
      ? { strictAcceptanceStatus: record.strictAcceptanceStatus }
      : {}),
    stableKey: record.stableKey,
  };
}

function readAuditRecords(storage: AuditStorage): DeliverableCertificateAuditRecord[] {
  try {
    const raw = storage.getItem(CERTIFICATE_OBSERVATION_AUDIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitizeStoredRecord)
      .filter((record): record is DeliverableCertificateAuditRecord => record !== null)
      .slice(-CERTIFICATE_OBSERVATION_AUDIT_LIMIT);
  } catch {
    return [];
  }
}

export function persistDeliverableCertificateObservation(input: {
  sessionId: string;
  observation: DeliverableCertificateObservation;
  storage?: AuditStorage;
  now?: number;
}): 'recorded' | 'duplicate' | 'failed' {
  const sessionId = input.sessionId.trim();
  const storage = resolveAuditStorage(input.storage);
  if (!sessionId || !storage) return 'failed';

  try {
    const records = readAuditRecords(storage);
    const sessionKeyHash = anonymousSessionKey(sessionId);
    const stableKey = anonymousStableKey(sessionKeyHash, input.observation.stableKey);
    if (records.some((record) => (
      record.sessionKeyHash === sessionKeyHash && record.stableKey === stableKey
    ))) {
      return 'duplicate';
    }
    const record: DeliverableCertificateAuditRecord = {
      sessionKeyHash,
      timestamp: input.now ?? Date.now(),
      reason: input.observation.reason,
      ...(input.observation.certificateVersion
        ? { certificateVersion: input.observation.certificateVersion }
        : {}),
      ...(input.observation.contractHashVersion === 2
        ? { contractHashVersion: 2 as const }
        : {}),
      ...(input.observation.legacyAcceptanceStatus
        ? { legacyAcceptanceStatus: input.observation.legacyAcceptanceStatus }
        : {}),
      ...(input.observation.strictAcceptanceStatus
        ? { strictAcceptanceStatus: input.observation.strictAcceptanceStatus }
        : {}),
      stableKey,
    };
    storage.setItem(
      CERTIFICATE_OBSERVATION_AUDIT_STORAGE_KEY,
      JSON.stringify([...records, record].slice(-CERTIFICATE_OBSERVATION_AUDIT_LIMIT)),
    );
    return 'recorded';
  } catch {
    return 'failed';
  }
}

export function recordDeliverableCertificateObservationEffect(input: {
  sessionId?: string | null;
  observation?: DeliverableCertificateObservation | null;
  seenKeys: Set<string>;
  storage?: AuditStorage;
  now?: number;
}): boolean {
  const sessionId = input.sessionId?.trim();
  const observation = input.observation;
  if (!sessionId || !observation || input.seenKeys.has(observation.stableKey)) return false;
  if (input.seenKeys.size >= CERTIFICATE_OBSERVATION_AUDIT_LIMIT) {
    const oldest = input.seenKeys.values().next().value;
    if (typeof oldest === 'string') input.seenKeys.delete(oldest);
  }
  input.seenKeys.add(observation.stableKey);
  const persistence = persistDeliverableCertificateObservation({
    sessionId,
    observation,
    storage: input.storage,
    now: input.now,
  });
  if (persistence === 'duplicate') return false;
  const { stableKey: _stableKey, ...detail } = observation;
  recordDeliverableCertificateTelemetry(detail);
  return true;
}
