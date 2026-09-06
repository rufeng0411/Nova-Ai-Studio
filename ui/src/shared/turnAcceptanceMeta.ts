// PD-SAAS-FORK: UI-facing turn acceptance meta helpers.
import type { ChatMessage } from '../components/chat/types/types';
import type {
  DeliverableAcceptanceRow,
} from '../components/chat/deliverables/DeliverableSummaryTable';
import { classifyDeliverablePath, compileDeliverableSlotPath, getArtifactFileName, normalizeArtifactPath } from './artifactPaths';
import { reanchorSdmPathToTaskDir } from '../../../src/saas/deliverables/sdmSlotMatching';

export type TurnContinuationOwner =
  | 'none'
  | 'deliverable_repair'
  | 'auto_continue_engine'
  | 'ui_fallback';

export type DeliverableCompletionStateUi =
  | 'complete'
  | 'accepted_partial'
  | 'incomplete'
  | 'blocked';

export type DeliverableQualityCompletionUi =
  | 'not_applicable'
  | 'passed'
  | 'needs_repair'
  | 'degraded_acceptable'
  | 'blocked';

export type DeliverablePartialReasonUi =
  | 'user_acknowledged'
  | 'official_media_degraded';

export type DeliverableBlockedReasonTypeUi =
  | 'user_action_required'
  | 'system_exhausted';

export type DeliverableQualityFailureUi = {
  checkId: string;
  domain: 'content' | 'official_media' | 'tool_policy' | 'composite';
  reason: string;
  repairable: boolean;
  path?: string;
  slotId?: string;
  expected?: number | string;
  actual?: number | string;
};

export type AssetProvenanceSummaryUi = {
  totalEntries: number;
  validEntries: number;
  officialEntries: number;
  invalidEntries: number;
  placeholderCount: number;
  sourceLevelCounts: Partial<Record<'L0' | 'L1' | 'L2' | 'L3', number>>;
  sourceTierCounts: Partial<Record<
    'brand_official' | 'authorized_partner_official' | 'platform_verified_official',
    number
  >>;
  ledgerEvidenceHash?: string;
};

export type DeliverableQualityStatusUi = {
  completionState: DeliverableCompletionStateUi;
  partialReason?: DeliverablePartialReasonUi;
  blockedReasonType?: DeliverableBlockedReasonTypeUi;
  qualityCompletion?: DeliverableQualityCompletionUi;
  qualityContractHash?: string;
  qualityEvidenceHash?: string;
};

type TurnAcceptanceMetaLike = {
  verifiedPaths?: unknown;
  missingPaths?: unknown;
  brokenPaths?: unknown;
  hiddenByPolicyPaths?: unknown;
  resolvedPathMap?: unknown;
  acceptanceStatus?: unknown;
  expectedManifest?: unknown;
  turnArtifactDir?: unknown;
  taskArtifactDir?: unknown;
  scopeId?: unknown;
  continuationOwner?: unknown;
  circuitBreakerTripped?: unknown;
  acceptanceCertificate?: unknown;
  compositeSlotQuality?: unknown;
  slotBindings?: unknown;
  contractSnapshot?: unknown;
  finality?: unknown;
  qualityContractHashVersion?: unknown;
  qualityContractHash?: unknown;
  qualityEvidenceHashVersion?: unknown;
  qualityEvidenceHash?: unknown;
  qualityCompletion?: unknown;
  completionState?: unknown;
  partialReason?: unknown;
  blockedReasonType?: unknown;
  qualityFailures?: unknown;
  assetProvenanceSummary?: unknown;
};

type AcceptanceCertificateBaseUi = {
  contractHash: string;
  evidenceHash: string;
  goalVersion?: number;
  scopeDir?: string | null;
  requiredDone: number;
  requiredTotal: number;
  completionState: DeliverableCompletionStateUi;
  acceptanceStatus?: string;
  compositeSlotQuality?: CompositeSlotQualityAssessmentUi[];
};

export type CompositeSlotQualityAssessmentUi = {
  profileId?: string;
  slotId: string;
  complete: boolean;
  reason?: 'composite_directory_incomplete' | 'composite_directory_degraded';
  observedPaths: string[];
  requiredBasenames: string[];
  missingBasenames: string[];
  degraded?: boolean;
  degradedReason?: string;
};

export type AcceptanceCertificateSlotUi = {
  slotId: string;
  label?: string;
  required?: boolean;
  status: 'pending' | 'done' | 'missing' | 'broken';
  resolvedPath?: string;
  requiredCount?: number;
  matchedCount?: number;
  resolvedPaths?: string[];
};

export type AcceptanceCertificateUnitUi = {
  unitId: string;
  slotId: string;
  slotLabel: string;
  expectedPath: string;
  expectedBasename: string;
  kind?: string;
  required: boolean;
};

export type AcceptanceCertificateV1Ui = AcceptanceCertificateBaseUi & {
  certificateVersion: 1;
  slots?: AcceptanceCertificateSlotUi[];
};

export type AcceptanceCertificateV2Ui = AcceptanceCertificateBaseUi & {
  certificateVersion: 2;
  contractHashVersion: 2;
  legacyContractHash: string;
  legacyAcceptanceStatus: string;
  strictAcceptanceStatus: string;
  units: AcceptanceCertificateUnitUi[];
  slots: AcceptanceCertificateSlotUi[];
  qualityContractHashVersion?: 1;
  qualityContractHash?: string;
  qualityEvidenceHashVersion?: 1;
  qualityEvidenceHash?: string;
  qualityCompletion?: DeliverableQualityCompletionUi;
  partialReason?: DeliverablePartialReasonUi;
  blockedReasonType?: DeliverableBlockedReasonTypeUi;
  qualityFailures?: DeliverableQualityFailureUi[];
  assetProvenanceSummary?: AssetProvenanceSummaryUi;
};

export type AcceptanceCertificateUi =
  | AcceptanceCertificateV1Ui
  | AcceptanceCertificateV2Ui;

export type AcceptanceCertificateResolution =
  | { state: 'valid_v2'; certificate: AcceptanceCertificateV2Ui }
  | { state: 'valid_v1'; certificate: AcceptanceCertificateV1Ui }
  | { state: 'missing'; reason: 'certificate_missing' }
  | { state: 'corrupt_v2'; reason: string }
  | { state: 'stale'; reason: string; certificateVersion: 1 | 2 };

export const DELIVERABLE_CERTIFICATE_TELEMETRY_EVENT =
  'pilotdeck:deliverable-certificate-telemetry';

export type DeliverableCertificateTelemetryDetail = {
  event: 'deliverable_certificate_ui';
  case: 'missing' | 'corrupt_v2' | 'stale' | 'shadow_diff';
  reason: string;
  certificateVersion?: 1 | 2;
  contractHashVersion?: 2;
  contractHash?: string;
  legacyAcceptanceStatus?: string;
  strictAcceptanceStatus?: string;
};

export type DeliverableCertificateObservation =
  Omit<DeliverableCertificateTelemetryDetail, 'event'> & {
    stableKey: string;
  };

export function createDeliverableCertificateObservation(
  detail: Omit<DeliverableCertificateTelemetryDetail, 'event'>,
): DeliverableCertificateObservation {
  return {
    ...detail,
    stableKey: [
      detail.case,
      detail.reason,
      detail.certificateVersion ?? '',
      detail.contractHashVersion ?? '',
      detail.contractHash ?? '',
      detail.legacyAcceptanceStatus ?? '',
      detail.strictAcceptanceStatus ?? '',
    ].join('|'),
  };
}

/** PD-SAAS-FORK: lightweight observable telemetry; no network write and never affects rendering. */
export function recordDeliverableCertificateTelemetry(
  detail: Omit<DeliverableCertificateTelemetryDetail, 'event'>,
): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent<DeliverableCertificateTelemetryDetail>(
    DELIVERABLE_CERTIFICATE_TELEMETRY_EVENT,
    {
      detail: {
        event: 'deliverable_certificate_ui',
        ...detail,
      },
    },
  ));
}

/** Emits an observation once per stable key; callers own the bounded key set. */
export function recordDeliverableCertificateObservationOnce(
  observation: DeliverableCertificateObservation | null | undefined,
  seenKeys: Set<string>,
): boolean {
  if (!observation || seenKeys.has(observation.stableKey)) return false;
  if (seenKeys.size >= 128) {
    const oldest = seenKeys.values().next().value;
    if (typeof oldest === 'string') seenKeys.delete(oldest);
  }
  seenKeys.add(observation.stableKey);
  const { stableKey: _stableKey, ...detail } = observation;
  recordDeliverableCertificateTelemetry(detail);
  return true;
}

export type SanitizedTurnAcceptanceMeta = {
  verifiedPaths: string[];
  missingPaths: string[];
  brokenPaths: string[];
  hiddenByPolicyPaths: string[];
  resolvedPathMap: Record<string, string>;
  acceptanceStatus?: string;
  expectedManifest?: Array<Record<string, unknown>>;
  turnArtifactDir?: string;
  taskArtifactDir?: string;
  scopeId?: string;
  continuationOwner?: TurnContinuationOwner;
  circuitBreakerTripped?: boolean;
  acceptanceCertificate?: AcceptanceCertificateUi;
  compositeSlotQuality?: CompositeSlotQualityAssessmentUi[];
  slotBindings?: Array<Record<string, unknown>>;
  finality?: 'draft' | 'final';
  qualityContractHashVersion?: 1;
  qualityContractHash?: string;
  qualityEvidenceHashVersion?: 1;
  qualityEvidenceHash?: string;
  qualityCompletion?: DeliverableQualityCompletionUi;
  completionState?: DeliverableCompletionStateUi;
  partialReason?: DeliverablePartialReasonUi;
  blockedReasonType?: DeliverableBlockedReasonTypeUi;
  qualityFailures?: DeliverableQualityFailureUi[];
  assetProvenanceSummary?: AssetProvenanceSummaryUi;
  goalVersion?: number;
};

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function parseCompletionState(value: unknown): DeliverableCompletionStateUi | undefined {
  if (
    value === 'complete'
    || value === 'accepted_partial'
    || value === 'incomplete'
    || value === 'blocked'
  ) {
    return value;
  }
  return undefined;
}

function parseQualityCompletion(value: unknown): DeliverableQualityCompletionUi | undefined {
  if (
    value === 'not_applicable'
    || value === 'passed'
    || value === 'needs_repair'
    || value === 'degraded_acceptable'
    || value === 'blocked'
  ) {
    return value;
  }
  return undefined;
}

function parsePartialReason(value: unknown): DeliverablePartialReasonUi | undefined {
  return value === 'user_acknowledged' || value === 'official_media_degraded'
    ? value
    : undefined;
}

function parseBlockedReasonType(value: unknown): DeliverableBlockedReasonTypeUi | undefined {
  return value === 'user_action_required' || value === 'system_exhausted'
    ? value
    : undefined;
}

function boundedText(value: unknown, maxLength = 240): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function parseQualityFailures(value: unknown): DeliverableQualityFailureUi[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const failures = value.slice(0, 40).flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
    const row = candidate as Record<string, unknown>;
    const checkId = boundedText(row.checkId, 160);
    const reason = boundedText(row.reason, 240);
    const domain = row.domain;
    if (
      !checkId
      || !reason
      || typeof row.repairable !== 'boolean'
      || (
        domain !== 'content'
        && domain !== 'official_media'
        && domain !== 'tool_policy'
        && domain !== 'composite'
      )
    ) {
      return [];
    }
    const expected = typeof row.expected === 'number' || typeof row.expected === 'string'
      ? row.expected
      : undefined;
    const actual = typeof row.actual === 'number' || typeof row.actual === 'string'
      ? row.actual
      : undefined;
    return [{
      checkId,
      domain,
      reason,
      repairable: row.repairable,
      ...(typeof row.path === 'string'
        ? { path: normalizeArtifactPath(row.path).slice(0, 512) }
        : {}),
      ...(boundedText(row.slotId, 120) ? { slotId: boundedText(row.slotId, 120) } : {}),
      ...(expected !== undefined
        ? { expected: typeof expected === 'string' ? expected.slice(0, 240) : expected }
        : {}),
      ...(actual !== undefined
        ? { actual: typeof actual === 'string' ? actual.slice(0, 240) : actual }
        : {}),
    }];
  });
  return failures.length > 0 ? failures : undefined;
}

function parseCountMap<T extends string>(
  value: unknown,
  keys: readonly T[],
): Partial<Record<T, number>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const result: Partial<Record<T, number>> = {};
  for (const key of keys) {
    const count = nonNegativeInteger(record[key]);
    if (count !== undefined) result[key] = count;
  }
  return result;
}

function parseAssetProvenanceSummary(value: unknown): AssetProvenanceSummaryUi | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const totalEntries = nonNegativeInteger(record.totalEntries);
  const validEntries = nonNegativeInteger(record.validEntries);
  const officialEntries = nonNegativeInteger(record.officialEntries);
  const invalidEntries = nonNegativeInteger(record.invalidEntries);
  const placeholderCount = nonNegativeInteger(record.placeholderCount);
  if (
    totalEntries === undefined
    || validEntries === undefined
    || officialEntries === undefined
    || invalidEntries === undefined
    || placeholderCount === undefined
  ) {
    return undefined;
  }
  return {
    totalEntries,
    validEntries,
    officialEntries,
    invalidEntries,
    placeholderCount,
    sourceLevelCounts: parseCountMap(record.sourceLevelCounts, ['L0', 'L1', 'L2', 'L3']),
    sourceTierCounts: parseCountMap(record.sourceTierCounts, [
      'brand_official',
      'authorized_partner_official',
      'platform_verified_official',
    ]),
    ...(boundedText(record.ledgerEvidenceHash, 256)
      ? { ledgerEvidenceHash: boundedText(record.ledgerEvidenceHash, 256) }
      : {}),
  };
}

function parseCompositeSlotQuality(value: unknown): CompositeSlotQualityAssessmentUi[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const parsed = value.slice(0, 20).flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
    const row = candidate as Record<string, unknown>;
    if (
      typeof row.slotId !== 'string'
      || !row.slotId.trim()
      || typeof row.complete !== 'boolean'
    ) {
      return [];
    }
    const reason = row.reason === 'composite_directory_incomplete'
      || row.reason === 'composite_directory_degraded'
      ? row.reason
      : undefined;
    const assessment: CompositeSlotQualityAssessmentUi = {
      profileId: typeof row.profileId === 'string' ? row.profileId.slice(0, 80) : undefined,
      slotId: row.slotId.slice(0, 120),
      complete: row.complete,
      reason,
      observedPaths: stringList(row.observedPaths)
        .slice(0, 40)
        .map((filePath) => normalizeArtifactPath(filePath))
        .filter(Boolean),
      requiredBasenames: stringList(row.requiredBasenames).slice(0, 20),
      missingBasenames: stringList(row.missingBasenames).slice(0, 20),
      degraded: row.degraded === true ? true : undefined,
      degradedReason: typeof row.degradedReason === 'string'
        ? row.degradedReason.replace(/\s+/g, ' ').trim().slice(0, 160)
        : undefined,
    };
    return [assessment];
  });
  return parsed.length > 0 ? parsed : undefined;
}

function normalizeKey(path: string): string {
  return (normalizeArtifactPath(path) || path).replace(/\\/g, '/').toLowerCase();
}

function pathsEqual(a: string, b: string): boolean {
  return normalizeKey(a) === normalizeKey(b);
}

function basenameKey(path: string): string {
  return getArtifactFileName(path).toLowerCase();
}

export function extractTurnAcceptanceMeta(message: ChatMessage): SanitizedTurnAcceptanceMeta | null {
  const nested = message.turnAcceptanceMeta && typeof message.turnAcceptanceMeta === 'object'
    ? message.turnAcceptanceMeta as TurnAcceptanceMetaLike
    : {};
  const verifiedPaths = stringList(message.verifiedDeliverablePaths).length > 0
    ? stringList(message.verifiedDeliverablePaths)
    : stringList(nested.verifiedPaths);
  const missingPaths = stringList(message.missingPaths).length > 0
    ? stringList(message.missingPaths)
    : stringList(nested.missingPaths);
  const brokenPaths = stringList(message.brokenPaths).length > 0
    ? stringList(message.brokenPaths)
    : stringList(nested.brokenPaths);
  const hiddenByPolicyPaths = stringList(message.hiddenByPolicyPaths).length > 0
    ? stringList(message.hiddenByPolicyPaths)
    : stringList(nested.hiddenByPolicyPaths);
  const resolvedPathMap = (message.resolvedPathMap ?? nested.resolvedPathMap) as Record<string, string> | undefined;
  const expectedManifest = Array.isArray(message.expectedManifest)
    ? message.expectedManifest as Array<Record<string, unknown>>
    : Array.isArray(nested.expectedManifest)
      ? nested.expectedManifest as Array<Record<string, unknown>>
      : undefined;
  const turnArtifactDir = typeof message.turnArtifactDir === 'string'
    ? message.turnArtifactDir
    : typeof nested.turnArtifactDir === 'string'
      ? nested.turnArtifactDir
      : typeof nested.taskArtifactDir === 'string'
        ? nested.taskArtifactDir
        : undefined;
  const taskArtifactDir = typeof nested.taskArtifactDir === 'string'
    ? nested.taskArtifactDir
    : turnArtifactDir;
  const scopeId = typeof nested.scopeId === 'string' ? nested.scopeId : undefined;

  const continuationOwner = nested.continuationOwner !== undefined
    ? parseContinuationOwner(nested.continuationOwner)
    : parseContinuationOwner(message.continuationOwner);

  const circuitBreakerTripped = nested.circuitBreakerTripped === true
    || message.circuitBreakerTripped === true
    || nested.circuitBreakerTripped === 'true';

  const acceptanceCertificate = parseAcceptanceCertificate(nested.acceptanceCertificate)
    ?? parseAcceptanceCertificate(
      (message.turnAcceptanceMeta as TurnAcceptanceMetaLike | undefined)?.acceptanceCertificate,
    );
  const compositeSlotQuality = parseCompositeSlotQuality(nested.compositeSlotQuality);
  const slotBindings = Array.isArray(nested.slotBindings)
    ? nested.slotBindings.filter((row): row is Record<string, unknown> => (
      Boolean(row) && typeof row === 'object' && !Array.isArray(row)
    ))
    : undefined;
  const finality = nested.finality === 'draft' || nested.finality === 'final'
    ? nested.finality
    : undefined;
  const qualityContractHashVersion = nested.qualityContractHashVersion === 1 ? 1 : undefined;
  const qualityContractHash = boundedText(nested.qualityContractHash, 256);
  const qualityEvidenceHashVersion = nested.qualityEvidenceHashVersion === 1 ? 1 : undefined;
  const qualityEvidenceHash = boundedText(nested.qualityEvidenceHash, 256);
  const qualityCompletion = parseQualityCompletion(nested.qualityCompletion);
  const completionState = parseCompletionState(nested.completionState);
  const partialReason = parsePartialReason(nested.partialReason);
  const blockedReasonType = parseBlockedReasonType(nested.blockedReasonType);
  const qualityFailures = parseQualityFailures(nested.qualityFailures);
  const assetProvenanceSummary = parseAssetProvenanceSummary(nested.assetProvenanceSummary);
  const goalVersion = typeof nested.goalVersion === 'number' && Number.isInteger(nested.goalVersion)
    ? nested.goalVersion
    : undefined;

  if (
    verifiedPaths.length === 0
    && missingPaths.length === 0
    && brokenPaths.length === 0
    && hiddenByPolicyPaths.length === 0
    && !expectedManifest?.length
    && !continuationOwner
    && !circuitBreakerTripped
    && !turnArtifactDir
    && !taskArtifactDir
    && !acceptanceCertificate
    && !compositeSlotQuality?.length
    && !slotBindings?.length
    && !finality
    && !qualityContractHash
    && !qualityEvidenceHash
    && !qualityCompletion
    && !completionState
    && !partialReason
    && !blockedReasonType
    && !qualityFailures?.length
    && !assetProvenanceSummary
    && goalVersion === undefined
  ) {
    return null;
  }

  return {
    verifiedPaths,
    missingPaths,
    brokenPaths,
    hiddenByPolicyPaths,
    resolvedPathMap: resolvedPathMap && typeof resolvedPathMap === 'object' ? resolvedPathMap : {},
    acceptanceStatus: typeof message.acceptanceStatus === 'string'
      ? message.acceptanceStatus
      : typeof nested.acceptanceStatus === 'string'
        ? nested.acceptanceStatus
        : undefined,
    expectedManifest,
    turnArtifactDir: taskArtifactDir ?? turnArtifactDir,
    ...(taskArtifactDir ? { taskArtifactDir } : {}),
    ...(scopeId ? { scopeId } : {}),
    ...(continuationOwner ? { continuationOwner } : {}),
    ...(circuitBreakerTripped ? { circuitBreakerTripped: true } : {}),
    ...(acceptanceCertificate ? { acceptanceCertificate } : {}),
    ...(compositeSlotQuality?.length ? { compositeSlotQuality } : {}),
    ...(slotBindings?.length ? { slotBindings } : {}),
    ...(finality ? { finality } : {}),
    ...(qualityContractHashVersion ? { qualityContractHashVersion } : {}),
    ...(qualityContractHash ? { qualityContractHash } : {}),
    ...(qualityEvidenceHashVersion ? { qualityEvidenceHashVersion } : {}),
    ...(qualityEvidenceHash ? { qualityEvidenceHash } : {}),
    ...(qualityCompletion ? { qualityCompletion } : {}),
    ...(completionState ? { completionState } : {}),
    ...(partialReason ? { partialReason } : {}),
    ...(blockedReasonType ? { blockedReasonType } : {}),
    ...(qualityFailures?.length ? { qualityFailures } : {}),
    ...(assetProvenanceSummary ? { assetProvenanceSummary } : {}),
    ...(goalVersion !== undefined ? { goalVersion } : {}),
  };
}

type ParsedCertificateBase = AcceptanceCertificateBaseUi & {
  slots?: AcceptanceCertificateSlotUi[];
};

function nonNegativeInteger(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseCertificateSlot(
  value: unknown,
  requireV2Counts: boolean,
): AcceptanceCertificateSlotUi | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  if (typeof row.slotId !== 'string' || !row.slotId.trim()) return undefined;
  const status = row.status;
  if (status !== 'pending' && status !== 'done' && status !== 'missing' && status !== 'broken') {
    return undefined;
  }
  const requiredCount = nonNegativeInteger(row.requiredCount);
  const matchedCount = nonNegativeInteger(row.matchedCount);
  if (
    requireV2Counts
    && (
      requiredCount === undefined
      || requiredCount < 1
      || matchedCount === undefined
      || matchedCount > requiredCount
      || !Array.isArray(row.resolvedPaths)
    )
  ) {
    return undefined;
  }
  const resolvedPaths = Array.isArray(row.resolvedPaths)
    ? row.resolvedPaths
      .filter((path): path is string => typeof path === 'string' && path.trim().length > 0)
      .map((path) => normalizeArtifactPath(path))
      .filter(Boolean)
    : undefined;
  if (requireV2Counts) {
    const rawResolvedPaths = row.resolvedPaths as unknown[];
    const uniqueResolvedPathKeys = new Set(
      resolvedPaths!.map((path) => path.replace(/\\/g, '/').toLowerCase()),
    );
    if (
      resolvedPaths!.length !== rawResolvedPaths.length
      || uniqueResolvedPathKeys.size !== resolvedPaths!.length
      || resolvedPaths!.length !== matchedCount
    ) {
      return undefined;
    }
  }
  return {
    slotId: row.slotId.trim(),
    label: typeof row.label === 'string' ? row.label : undefined,
    required: typeof row.required === 'boolean' ? row.required : undefined,
    status,
    resolvedPath: typeof row.resolvedPath === 'string'
      ? normalizeArtifactPath(row.resolvedPath)
      : undefined,
    ...(requiredCount !== undefined ? { requiredCount } : {}),
    ...(matchedCount !== undefined ? { matchedCount } : {}),
    ...(resolvedPaths ? { resolvedPaths } : {}),
  };
}

function parseCertificateUnit(value: unknown): AcceptanceCertificateUnitUi | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const unit = value as Record<string, unknown>;
  if (
    typeof unit.unitId !== 'string'
    || !unit.unitId.trim()
    || typeof unit.slotId !== 'string'
    || !unit.slotId.trim()
    || typeof unit.slotLabel !== 'string'
    || typeof unit.expectedPath !== 'string'
    || typeof unit.expectedBasename !== 'string'
    || typeof unit.required !== 'boolean'
  ) {
    return undefined;
  }
  return {
    unitId: unit.unitId.trim(),
    slotId: unit.slotId.trim(),
    slotLabel: unit.slotLabel,
    expectedPath: normalizeArtifactPath(unit.expectedPath),
    expectedBasename: normalizeArtifactPath(unit.expectedBasename),
    kind: typeof unit.kind === 'string' ? unit.kind : undefined,
    required: unit.required,
  };
}

function parseCertificateBase(record: Record<string, unknown>): ParsedCertificateBase | undefined {
  if (
    typeof record.contractHash !== 'string'
    || !record.contractHash.trim()
    || typeof record.evidenceHash !== 'string'
    || !record.evidenceHash.trim()
  ) {
    return undefined;
  }
  const requiredDone = nonNegativeInteger(record.requiredDone);
  const requiredTotal = nonNegativeInteger(record.requiredTotal);
  if (
    requiredDone === undefined
    || requiredTotal === undefined
    || requiredDone > requiredTotal
  ) {
    return undefined;
  }
  const completionState = record.completionState;
  if (
    completionState !== 'complete'
    && completionState !== 'accepted_partial'
    && completionState !== 'incomplete'
    && completionState !== 'blocked'
  ) {
    return undefined;
  }
  const slots = Array.isArray(record.slots)
    ? record.slots
      .map((row) => parseCertificateSlot(row, false))
      .filter((row): row is AcceptanceCertificateSlotUi => Boolean(row))
    : undefined;
  return {
    contractHash: record.contractHash,
    evidenceHash: record.evidenceHash,
    goalVersion: typeof record.goalVersion === 'number' ? record.goalVersion : undefined,
    scopeDir: typeof record.scopeDir === 'string'
      ? normalizeArtifactPath(record.scopeDir).replace(/\/+$/, '')
      : null,
    requiredDone,
    requiredTotal,
    completionState,
    acceptanceStatus: typeof record.acceptanceStatus === 'string' ? record.acceptanceStatus : undefined,
    compositeSlotQuality: parseCompositeSlotQuality(record.compositeSlotQuality),
    slots,
  };
}

function inspectAcceptanceCertificate(value: unknown): AcceptanceCertificateResolution {
  if (!value || typeof value !== 'object') {
    return { state: 'missing', reason: 'certificate_missing' };
  }
  const record = value as Record<string, unknown>;
  const version = record.certificateVersion;
  if (version !== 1 && version !== 2) {
    return { state: 'missing', reason: 'certificate_missing' };
  }
  const base = parseCertificateBase(record);
  if (!base) {
    return version === 2
      ? { state: 'corrupt_v2', reason: 'v2_base_invalid' }
      : { state: 'missing', reason: 'certificate_missing' };
  }
  if (version === 1) {
    return {
      state: 'valid_v1',
      certificate: {
        ...base,
        certificateVersion: 1,
      },
    };
  }
  if (record.contractHashVersion !== 2) {
    return { state: 'corrupt_v2', reason: 'v2_contract_hash_version_invalid' };
  }
  if (!Array.isArray(record.units)) {
    return { state: 'corrupt_v2', reason: 'v2_units_missing' };
  }
  if (!Array.isArray(record.slots)) {
    return { state: 'corrupt_v2', reason: 'v2_slots_missing' };
  }
  const units = record.units.map(parseCertificateUnit);
  if (units.some((unit) => !unit)) {
    return { state: 'corrupt_v2', reason: 'v2_unit_invalid' };
  }
  const strictUnits = units as AcceptanceCertificateUnitUi[];
  if (new Set(strictUnits.map((unit) => unit.unitId)).size !== strictUnits.length) {
    return { state: 'corrupt_v2', reason: 'v2_unit_duplicate' };
  }
  const slots = record.slots.map((slot) => parseCertificateSlot(slot, true));
  if (slots.some((slot) => !slot)) {
    const duplicateEvidence = record.slots.some((slot) => {
      if (!slot || typeof slot !== 'object') return false;
      const resolvedPaths = (slot as Record<string, unknown>).resolvedPaths;
      if (!Array.isArray(resolvedPaths)) return false;
      const normalized = resolvedPaths
        .filter((path): path is string => typeof path === 'string' && path.trim().length > 0)
        .map((path) => normalizeArtifactPath(path).replace(/\\/g, '/').toLowerCase())
        .filter(Boolean);
      return new Set(normalized).size !== normalized.length;
    });
    if (duplicateEvidence) {
      return { state: 'corrupt_v2', reason: 'v2_slot_evidence_duplicate' };
    }
    return { state: 'corrupt_v2', reason: 'v2_slot_invalid' };
  }
  const strictSlots = slots as AcceptanceCertificateSlotUi[];
  const allResolvedPathKeys = strictSlots.flatMap((slot) => (
    (slot.resolvedPaths ?? []).map((path) => path.replace(/\\/g, '/').toLowerCase())
  ));
  if (new Set(allResolvedPathKeys).size !== allResolvedPathKeys.length) {
    return { state: 'corrupt_v2', reason: 'v2_slot_evidence_duplicate' };
  }
  const slotById = new Map(strictSlots.map((slot) => [slot.slotId, slot]));
  if (
    slotById.size !== strictSlots.length
    || strictUnits.some((unit) => !slotById.has(unit.slotId))
  ) {
    return { state: 'corrupt_v2', reason: 'v2_unit_slot_mismatch' };
  }
  const unitCountBySlot = new Map<string, number>();
  for (const unit of strictUnits) {
    unitCountBySlot.set(
      unit.slotId,
      (unitCountBySlot.get(unit.slotId) ?? 0) + 1,
    );
  }
  if (strictSlots.some((slot) => (
    slot.requiredCount !== (unitCountBySlot.get(slot.slotId) ?? 0)
    || (slot.matchedCount ?? 0) > (unitCountBySlot.get(slot.slotId) ?? 0)
  ))) {
    return { state: 'corrupt_v2', reason: 'v2_unit_slot_count_mismatch' };
  }
  const requiredUnits = strictUnits.filter((unit) => unit.required);
  const matchedUnits = strictSlots.reduce((total, slot) => (
    total + (slot.required === false ? 0 : (slot.matchedCount ?? 0))
  ), 0);
  if (
    requiredUnits.length !== base.requiredTotal
    || matchedUnits !== base.requiredDone
  ) {
    return { state: 'corrupt_v2', reason: 'v2_progress_mismatch' };
  }
  if (
    typeof record.legacyContractHash !== 'string'
    || !record.legacyContractHash
    || typeof record.legacyAcceptanceStatus !== 'string'
    || typeof record.strictAcceptanceStatus !== 'string'
  ) {
    return { state: 'corrupt_v2', reason: 'v2_shadow_fields_missing' };
  }
  return {
    state: 'valid_v2',
    certificate: {
      ...base,
      certificateVersion: 2,
      contractHashVersion: 2,
      legacyContractHash: record.legacyContractHash,
      legacyAcceptanceStatus: record.legacyAcceptanceStatus,
      strictAcceptanceStatus: record.strictAcceptanceStatus,
      units: strictUnits,
      slots: strictSlots,
      ...(record.qualityContractHashVersion === 1
        ? { qualityContractHashVersion: 1 as const }
        : {}),
      ...(boundedText(record.qualityContractHash, 256)
        ? { qualityContractHash: boundedText(record.qualityContractHash, 256) }
        : {}),
      ...(record.qualityEvidenceHashVersion === 1
        ? { qualityEvidenceHashVersion: 1 as const }
        : {}),
      ...(boundedText(record.qualityEvidenceHash, 256)
        ? { qualityEvidenceHash: boundedText(record.qualityEvidenceHash, 256) }
        : {}),
      ...(parseQualityCompletion(record.qualityCompletion)
        ? { qualityCompletion: parseQualityCompletion(record.qualityCompletion) }
        : {}),
      ...(parsePartialReason(record.partialReason)
        ? { partialReason: parsePartialReason(record.partialReason) }
        : {}),
      ...(parseBlockedReasonType(record.blockedReasonType)
        ? { blockedReasonType: parseBlockedReasonType(record.blockedReasonType) }
        : {}),
      ...(parseQualityFailures(record.qualityFailures)
        ? { qualityFailures: parseQualityFailures(record.qualityFailures) }
        : {}),
      ...(parseAssetProvenanceSummary(record.assetProvenanceSummary)
        ? { assetProvenanceSummary: parseAssetProvenanceSummary(record.assetProvenanceSummary) }
        : {}),
    },
  };
}

/** Parse top-level history metadata without appending a synthetic chat message. */
export function sanitizeTurnAcceptanceMetaRecord(
  value: Record<string, unknown> | null | undefined,
): SanitizedTurnAcceptanceMeta | null {
  if (!value) return null;
  const parsed = extractTurnAcceptanceMeta({
    type: 'assistant',
    timestamp: 0,
    turnAcceptanceMeta: value,
  });
  if (parsed) return parsed;
  if (typeof value.acceptanceStatus !== 'string' || !value.acceptanceStatus.trim()) {
    return null;
  }
  return {
    verifiedPaths: [],
    missingPaths: [],
    brokenPaths: [],
    hiddenByPolicyPaths: [],
    resolvedPathMap: {},
    acceptanceStatus: value.acceptanceStatus,
    ...(typeof value.goalVersion === 'number' && Number.isInteger(value.goalVersion)
      ? { goalVersion: value.goalVersion }
      : {}),
  };
}

/** Resolve a certificate carried by the history response envelope. */
export function resolveAcceptanceCertificateStateFromTurnMeta(
  value: Record<string, unknown> | null | undefined,
): AcceptanceCertificateResolution {
  return inspectAcceptanceCertificate(value?.acceptanceCertificate);
}

function parseAcceptanceCertificate(value: unknown): AcceptanceCertificateUi | undefined {
  const resolution = inspectAcceptanceCertificate(value);
  return resolution.state === 'valid_v1' || resolution.state === 'valid_v2'
    ? resolution.certificate
    : undefined;
}

/** Certificate v2 is the only UI authority for final quality/completion status. */
export function resolveDeliverableQualityStatus(
  certificate: AcceptanceCertificateUi | null | undefined,
): DeliverableQualityStatusUi | undefined {
  if (certificate?.certificateVersion !== 2) return undefined;
  return {
    completionState: certificate.completionState,
    ...(certificate.partialReason ? { partialReason: certificate.partialReason } : {}),
    ...(certificate.blockedReasonType
      ? { blockedReasonType: certificate.blockedReasonType }
      : {}),
    ...(certificate.qualityCompletion
      ? { qualityCompletion: certificate.qualityCompletion }
      : {}),
    ...(certificate.qualityContractHash
      ? { qualityContractHash: certificate.qualityContractHash }
      : {}),
    ...(certificate.qualityEvidenceHash
      ? { qualityEvidenceHash: certificate.qualityEvidenceHash }
      : {}),
  };
}

function parseContinuationOwner(value: unknown): TurnContinuationOwner | undefined {
  if (value === 'none' || value === 'deliverable_repair' || value === 'auto_continue_engine' || value === 'ui_fallback') {
    return value;
  }
  return undefined;
}

export function resolveContinuationOwnerFromMessage(message: ChatMessage): TurnContinuationOwner {
  const nested = message.turnAcceptanceMeta && typeof message.turnAcceptanceMeta === 'object'
    ? message.turnAcceptanceMeta as TurnAcceptanceMetaLike
    : {};
  if (nested.continuationOwner !== undefined) {
    return parseContinuationOwner(nested.continuationOwner) ?? 'none';
  }
  const meta = extractTurnAcceptanceMeta(message);
  return meta?.continuationOwner ?? parseContinuationOwner(message.continuationOwner) ?? 'none';
}

function scopeAcceptancePathToTurnDir(rawPath: string, turnArtifactDir?: string): string {
  if (!turnArtifactDir || !rawPath) return rawPath;
  const compiled = compileDeliverableSlotPath(rawPath, turnArtifactDir);
  if (compiled) return compiled;
  return reanchorSdmPathToTaskDir(rawPath, turnArtifactDir);
}

/**
 * Sanitize persisted acceptance meta for display without rewriting JSONL.
 * Promotes missing paths that have resolvedPathMap entries or known verified disk paths.
 */
export function sanitizeAcceptanceMetaForDisplay(
  meta: SanitizedTurnAcceptanceMeta,
  options?: {
    turnArtifactDir?: string;
    knownVerifiedPaths?: string[];
  },
): SanitizedTurnAcceptanceMeta {
  const resolvedPathMap = { ...meta.resolvedPathMap };
  if (options?.turnArtifactDir) {
    for (const [key, value] of Object.entries(resolvedPathMap)) {
      if (typeof value === 'string') {
        resolvedPathMap[key] = scopeAcceptancePathToTurnDir(value, options.turnArtifactDir);
      }
    }
  }
  const verifiedKeys = new Set(meta.verifiedPaths.map(normalizeKey));
  const knownVerified = (options?.knownVerifiedPaths ?? []).map(normalizeKey);
  const knownBasenames = new Set(knownVerified.map(basenameKey));

  const promotedVerified: string[] = [];
  const missingFiltered: string[] = [];

  for (const raw of meta.missingPaths) {
    if (raw.includes('*')) continue;
    const key = normalizeKey(raw);
    if (verifiedKeys.has(key)) continue;

    const resolved = resolvedPathMap[raw] ?? resolvedPathMap[normalizeArtifactPath(raw) || raw];
    if (resolved) {
      promotedVerified.push(resolved);
      verifiedKeys.add(normalizeKey(resolved));
      continue;
    }

    if (knownVerified.includes(key) || knownBasenames.has(basenameKey(raw))) {
      promotedVerified.push(raw);
      verifiedKeys.add(key);
      continue;
    }

    missingFiltered.push(raw);
  }

  const verifiedPaths = [...meta.verifiedPaths].map((path) => (
    options?.turnArtifactDir ? scopeAcceptancePathToTurnDir(path, options.turnArtifactDir) : path
  ));
  for (const path of promotedVerified) {
    if (!verifiedPaths.some((existing) => pathsEqual(existing, path))) {
      verifiedPaths.push(path);
    }
  }

  for (const path of options?.knownVerifiedPaths ?? []) {
    if (!path) continue;
    if (!verifiedPaths.some((existing) => pathsEqual(existing, path))) {
      verifiedPaths.push(path);
    }
  }

  const missingPaths = missingFiltered.filter(
    (missing) => !verifiedPaths.some((verified) => pathsEqual(verified, missing)),
  );

  const acceptanceStatus = missingPaths.length === 0 && meta.brokenPaths.length === 0
    ? 'passed'
    : meta.acceptanceStatus;

  return {
    ...meta,
    verifiedPaths,
    missingPaths,
    acceptanceStatus,
    resolvedPathMap,
  };
}

function metaFromMessage(message: ChatMessage): TurnAcceptanceMetaLike {
  const extracted = extractTurnAcceptanceMeta(message);
  if (!extracted) {
    return {};
  }
  return extracted;
}

function displayLabel(path: string): string {
  const normalized = normalizeArtifactPath(path) || path;
  if (normalized.startsWith('external:')) {
    return normalized.replace(/^external:/, '');
  }
  return getArtifactFileName(normalized) || normalized;
}

function rowForPath(
  status: DeliverableAcceptanceRow['status'],
  rawPath: string,
  resolvedPathMap: Record<string, string> = {},
): DeliverableAcceptanceRow {
  const logical = normalizeArtifactPath(rawPath) || rawPath;
  const normalized = normalizeArtifactPath(resolvedPathMap[rawPath] ?? resolvedPathMap[logical] ?? logical) || logical;
  return {
    id: `${status}:${normalized}`,
    label: displayLabel(logical),
    path: normalized,
    kind: classifyDeliverablePath(normalized),
    status,
  };
}

export function buildAcceptanceRowsFromMessage(message: ChatMessage): DeliverableAcceptanceRow[] {
  const meta = metaFromMessage(message);
  const verified = stringList(meta.verifiedPaths);
  const missing = stringList(meta.missingPaths);
  const broken = stringList(meta.brokenPaths);
  const hidden = stringList(meta.hiddenByPolicyPaths);
  const resolvedPathMap = meta.resolvedPathMap && typeof meta.resolvedPathMap === 'object'
    ? meta.resolvedPathMap as Record<string, string>
    : {};
  if (verified.length === 0 && missing.length === 0 && broken.length === 0 && hidden.length === 0) {
    return [];
  }
  return [
    ...verified.map((path) => rowForPath('delivered', path, resolvedPathMap)),
    ...broken.map((path) => rowForPath('broken', path, resolvedPathMap)),
    ...missing.map((path) => rowForPath('missing', path, resolvedPathMap)),
    ...hidden.map((path) => rowForPath('hidden', path, resolvedPathMap)),
  ];
}

export function buildSanitizedAcceptanceRowsFromMessage(
  message: ChatMessage,
  options?: {
    turnArtifactDir?: string;
    knownVerifiedPaths?: string[];
  },
): DeliverableAcceptanceRow[] {
  const raw = extractTurnAcceptanceMeta(message);
  if (!raw) return [];
  const sanitized = sanitizeAcceptanceMetaForDisplay(raw, options);
  return buildAcceptanceRowsFromMessage({
    ...message,
    verifiedDeliverablePaths: sanitized.verifiedPaths,
    missingPaths: sanitized.missingPaths,
    brokenPaths: sanitized.brokenPaths,
    hiddenByPolicyPaths: sanitized.hiddenByPolicyPaths,
    resolvedPathMap: sanitized.resolvedPathMap,
    acceptanceStatus: sanitized.acceptanceStatus,
    expectedManifest: sanitized.expectedManifest,
    turnAcceptanceMeta: sanitized,
  });
}

/**
 * Aggregate sanitized acceptance rows across the session so Dock / Composer
 * stay aligned with per-turn DeliverableSummaryTable (e.g. brief slot delivered).
 */
export function collectSessionAcceptanceRows(
  messages: ChatMessage[],
  options?: {
    knownVerifiedPaths?: string[];
  },
): DeliverableAcceptanceRow[] {
  const byKey = new Map<string, DeliverableAcceptanceRow>();
  const knownVerified = [...(options?.knownVerifiedPaths ?? [])];

  for (const message of messages) {
    if (message.type !== 'assistant' || message.isThinking || message.isStreaming) {
      continue;
    }
    const turnArtifactDir = typeof message.turnArtifactDir === 'string'
      ? message.turnArtifactDir
      : undefined;
    const rows = buildSanitizedAcceptanceRowsFromMessage(message, {
      turnArtifactDir,
      knownVerifiedPaths: knownVerified,
    });
    for (const row of rows) {
      const key = (row.resolvedPath || row.path || `${row.id}:${row.label}`).toLowerCase();
      byKey.set(key, row);
      if (row.status === 'delivered') {
        const path = row.resolvedPath || row.path;
        if (path && !knownVerified.some((existing) => pathsEqual(existing, path))) {
          knownVerified.push(path);
        }
      }
    }
  }

  return [...byKey.values()];
}

export function hasIncompleteAcceptance(message: ChatMessage): boolean {
  const meta = metaFromMessage(message);
  return meta.acceptanceStatus === 'needs_repair'
    || stringList(meta.missingPaths).length > 0
    || stringList(meta.brokenPaths).length > 0;
}

/** Latest assistant turn certificate state; a corrupt newest v2 never falls back to an older certificate. */
export function resolveLatestAcceptanceCertificateState(
  messages: ChatMessage[],
): AcceptanceCertificateResolution {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.type !== 'assistant' || message.isThinking || message.isStreaming) continue;
    const nested = message.turnAcceptanceMeta && typeof message.turnAcceptanceMeta === 'object'
      ? message.turnAcceptanceMeta as TurnAcceptanceMetaLike
      : null;
    if (nested && Object.prototype.hasOwnProperty.call(nested, 'acceptanceCertificate')) {
      return inspectAcceptanceCertificate(nested.acceptanceCertificate);
    }
    if (
      nested?.acceptanceStatus !== undefined
      || nested?.verifiedPaths !== undefined
      || nested?.missingPaths !== undefined
      || nested?.brokenPaths !== undefined
      || message.acceptanceStatus !== undefined
      || message.verifiedDeliverablePaths !== undefined
      || message.missingPaths !== undefined
      || message.brokenPaths !== undefined
    ) {
      return { state: 'missing', reason: 'certificate_missing' };
    }
  }
  return { state: 'missing', reason: 'certificate_missing' };
}

/** Latest assistant turn acceptance certificate in session (legacy convenience wrapper). */
export function resolveLatestAcceptanceCertificate(messages: ChatMessage[]): AcceptanceCertificateUi | null {
  const resolution = resolveLatestAcceptanceCertificateState(messages);
  if (resolution.state === 'valid_v1' || resolution.state === 'valid_v2') {
    return resolution.certificate;
  }
  return null;
}

export function resolveLatestTurnAcceptanceMeta(messages: ChatMessage[]): SanitizedTurnAcceptanceMeta | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.type !== 'assistant' || message.isThinking || message.isStreaming) continue;
    const meta = extractTurnAcceptanceMeta(message);
    if (meta) return meta;
  }
  return null;
}

function itemPathKey(path: string): string {
  return (normalizeArtifactPath(path) || path).replace(/\\/g, '/').toLowerCase();
}

/**
 * When engine meta is authoritative (passed / circuit tripped), map items without Bridge POST validate.
 */
export function canTrustEngineAcceptanceMeta(meta: SanitizedTurnAcceptanceMeta | null | undefined): boolean {
  if (!meta) return false;
  return meta.acceptanceStatus === 'passed' || meta.circuitBreakerTripped === true;
}

export function mapDeliverableItemsFromEngineMeta(
  items: Array<{ id: string; path: string; apiPath?: string; source?: string; kind?: string; label?: string }>,
  meta: SanitizedTurnAcceptanceMeta,
): Array<{ id: string; path: string; apiPath?: string; source?: string; kind?: string; label?: string; validationStatus: 'verified' | 'pending' | 'broken'; resolvedPath?: string }> | null {
  if (!canTrustEngineAcceptanceMeta(meta)) return null;
  const verifiedKeys = new Set(meta.verifiedPaths.map(itemPathKey));
  const resolvedPathMap = meta.resolvedPathMap ?? {};
  return items.map((item) => {
    const logical = item.apiPath || item.path;
    const resolved = resolvedPathMap[logical]
      ?? resolvedPathMap[normalizeArtifactPath(logical) || logical]
      ?? logical;
    const verified = verifiedKeys.has(itemPathKey(logical))
      || verifiedKeys.has(itemPathKey(resolved))
      || meta.acceptanceStatus === 'passed';
    return {
      ...item,
      validationStatus: verified ? 'verified' as const : 'pending' as const,
      ...(resolved ? { resolvedPath: resolved } : {}),
    };
  });
}
