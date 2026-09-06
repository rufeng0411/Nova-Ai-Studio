/**
 * PD-SAAS-FORK: UDC single kernel — summary table, Dock, Composer, HTML export.
 */
import { computeStableContractHashV2 } from '../../../src/saas/deliverables/deliverableContractHash';
import { pathSatisfiesSdmSlot } from '../../../src/saas/deliverables/sdmSlotMatching';
import type { ChatMessage } from '../components/chat/types/types';
import type { DeliverableItem } from './collectDeliverables';
import type { DeliverableValidationStatus } from './validateDeliverables';
import { collectDeliverablesFromMessages, collectDeliverablesFromMessagesInScope } from './collectDeliverables';
import {
  buildDeliverableDockRows,
  mergeFolderItemsIntoDockRows,
  type DeliverableDockRow,
} from './buildDeliverableDockRows';
import {
  collectSessionFolderItems,
  resolveSessionFolderPath,
} from './collectSessionFolderItems';
import type { DeliverableSummaryRow } from './buildDeliverableSummaryRows';
import { resolveSessionDeliverableContract } from './resolveSessionDeliverableContract';
import { resolveContractScopeDir } from './resolveContractScopeDir';
import type { SessionTaskDirectoryUi } from './resolveContractScopeDir';
import { resolveCurrentSessionTaskDirectory } from './resolveSessionTaskDirectory';
import {
  computeSdmProgressUi,
  countActiveDeliverableSlots,
  resolveCurrentSessionManifest,
  resolveFrozenSessionManifest,
  type SessionDeliverableManifestUi,
} from './resolveSessionDeliverableManifest';
import {
  collectSessionAcceptanceRows,
  createDeliverableCertificateObservation,
  extractTurnAcceptanceMeta,
  resolveAcceptanceCertificateStateFromTurnMeta,
  resolveDeliverableQualityStatus,
  resolveLatestAcceptanceCertificateState,
  resolveLatestTurnAcceptanceMeta,
  sanitizeTurnAcceptanceMetaRecord,
  type AcceptanceCertificateResolution,
  type AcceptanceCertificateSlotUi,
  type AcceptanceCertificateV1Ui,
  type AcceptanceCertificateV2Ui,
  type DeliverableCertificateObservation,
  type DeliverableQualityStatusUi,
} from './turnAcceptanceMeta';
import {
  expandExpectedManifestSlideCount,
  inferNovaSlidePagesFromPaths,
} from './slideManifestExpand';
import { isDocumentDeliverableProfile, isSlideDeliverableProfile } from './slideDeliverableProfile';
import { isDeliverableCertificateUiEnabled, isDeliverableSettledAcceptanceAuthorityEnabled, isDeliverableCertificateEnforceEnabled, isUiStrictCompletionGateEnabled } from './perfFeatureFlags';
import {
  isAcceptancePassedForSettled,
  resolvePipelineValidationSettled,
} from './resolvePipelineValidationSettled';
import { isDeliverableQualityUiEnabled } from './runtimeFeatureFlags';
import { classifyDeliverablePath, normalizeArtifactPath } from './artifactPaths';
import { isNonUserDeliverablePath } from './nonDeliverablePaths';

export type TaskFolderSnapshotFile = {
  path: string;
  basename: string;
  inContract?: boolean;
  slotId?: string;
  unitId?: string;
  isProcessFile?: boolean;
  resultClass?: 'contract' | 'useful_extra';
  snapshotState?: 'verified' | 'inconclusive';
};

export type TaskFolderSnapshotBindingInput = {
  requiredCount: number;
  matchedCount: number;
  complete: boolean;
  incompleteReason?: string;
};

export type UnifiedDeliverableProgress = {
  done: number;
  total: number;
  currentLabel?: string;
  currentStageId?: string;
};

export type UnifiedDeliverableView = {
  rows: DeliverableDockRow[];
  summaryRows: DeliverableSummaryRow[];
  progress: UnifiedDeliverableProgress;
  contractHash: string;
  folderPath: string | null;
  folderItems: DeliverableItem[];
  scopeDir: string | null;
  totalSlots: number;
  expectedManifest: ReturnType<typeof resolveSessionDeliverableContract>['expectedEntries'];
  sessionManifest?: SessionDeliverableManifestUi;
  certificateObservation?: DeliverableCertificateObservation;
  qualityStatus?: DeliverableQualityStatusUi;
  diskSnapshotBinding?: TaskFolderSnapshotBindingInput;
};

export type BuildUnifiedDeliverableViewInput = {
  messages: ChatMessage[];
  projectRoot: string;
  sessionManifest?: SessionDeliverableManifestUi;
  diskSnapshot?: TaskFolderSnapshotFile[];
  /** PD-SAAS-FORK: v2 files carry authoritative one-file-one-unit bindings. */
  diskSnapshotVersion?: number;
  /** PD-SAAS-FORK: false means the global scope scan was truncated/inconclusive. */
  diskSnapshotComplete?: boolean;
  diskSnapshotBinding?: TaskFolderSnapshotBindingInput;
  validationSettled?: boolean;
  turnDeliverables?: DeliverableItem[];
  turnArtifactDir?: string | null;
  sessionTaskDirectory?: SessionTaskDirectoryUi | null;
  /** Top-level history metadata used when the loaded page has no assistant message. */
  latestTurnAcceptanceMeta?: Record<string, unknown> | null;
  verifiedPathsOverride?: string[];
  /** PD-SAAS-FORK: precomputed from pipeline — skips O(n) collect. */
  sessionWideItems?: DeliverableItem[];
  sessionVerifiedPaths?: string[];
  scopeDir?: string | null;
  sessionRepairActive?: boolean;
  isAssistantWorking?: boolean;
};

function collectSessionVerifiedPaths(messages: ChatMessage[]): string[] {
  const paths = new Set<string>();
  for (const message of messages) {
    if (message.type !== 'assistant') continue;
    const meta = extractTurnAcceptanceMeta(message);
    for (const path of meta?.verifiedPaths ?? []) {
      const normalized = typeof path === 'string' ? normalizeArtifactPath(path) : '';
      if (normalized && !isNonUserDeliverablePath(normalized)) paths.add(normalized);
    }
    if (Array.isArray(message.verifiedDeliverablePaths)) {
      for (const path of message.verifiedDeliverablePaths) {
        const normalized = typeof path === 'string' ? normalizeArtifactPath(path) : '';
        if (normalized && !isNonUserDeliverablePath(normalized)) paths.add(normalized);
      }
    }
  }
  return [...paths];
}

function collectLatestTurnVerifiedPaths(messages: ChatMessage[]): string[] {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.type !== 'assistant') continue;
    const meta = extractTurnAcceptanceMeta(msg);
    if (meta?.verifiedPaths?.length) {
      return meta.verifiedPaths
        .map((path) => normalizeArtifactPath(path))
        .filter((path) => path.length > 0 && !isNonUserDeliverablePath(path));
    }
  }
  return [];
}

export function computeContractHash(rows: DeliverableSummaryRow[]): string {
  const payload = rows
    .map((row) => `${row.id}|${row.status}|${row.resolvedPath ?? ''}|${row.path ?? ''}`)
    .join(';');
  let hash = 5381;
  for (let i = 0; i < payload.length; i += 1) {
    hash = ((hash << 5) + hash) ^ payload.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function diskSnapshotToDeliverableItems(
  snapshot: TaskFolderSnapshotFile[] | undefined,
  strictBindings: boolean,
): DeliverableItem[] {
  if (!snapshot?.length || strictBindings) return [];
  return snapshot.map((file, index) => ({
    id: `disk:${index}:${file.path}`,
    path: file.path,
    apiPath: file.path,
    resolvedPath: file.path,
    kind: 'file' as const,
    source: 'text' as const,
    validationStatus: 'verified' as const,
  }));
}

function isStrictSnapshotV2(
  snapshot: TaskFolderSnapshotFile[] | undefined,
  snapshotVersion: number | undefined,
): boolean {
  return (snapshotVersion ?? 0) >= 2
    || Boolean(snapshot?.some((file) => file.unitId || file.snapshotState));
}

function strictUnitMatchesRow(file: TaskFolderSnapshotFile, row: DeliverableDockRow): boolean {
  if (!file.inContract || !file.slotId || !file.unitId) return false;
  if (row.id === file.unitId) return true;
  if (file.unitId === file.slotId) return row.id === file.slotId;

  const unitPrefix = `${file.slotId}__`;
  if (!file.unitId.startsWith(unitPrefix)) return false;
  const suffix = file.unitId.slice(unitPrefix.length);
  if (/^\d+$/.test(suffix)) {
    return row.id === `${file.slotId}_${suffix}`;
  }
  const slideMatch = /^slide_(\d+)$/.exec(suffix);
  if (!slideMatch) return false;
  const page = String(Number(slideMatch[1]));
  return row.id === `expected-slide-${page}`
    || row.id === `slide-${page}`
    || row.id === `${file.slotId}_${page}`;
}

function enrichRowsWithDiskSnapshot(
  rows: DeliverableDockRow[],
  snapshot: TaskFolderSnapshotFile[] | undefined,
  manifestSlots?: SessionDeliverableManifestUi['slots'],
  strictBindings = false,
  scopeDir: string | null = null,
  validationSettled = true,
): DeliverableDockRow[] {
  if (!snapshot?.length) return rows;

  const consumedEvidence = new Set<string>();
  const slotById = new Map((manifestSlots ?? []).map((slot) => [slot.id, slot]));
  const slotByLabel = new Map(
    (manifestSlots ?? []).map((slot) => [slot.label.trim().toLowerCase(), slot]),
  );
  const nextStatus = validationSettled ? 'delivered' : 'checking';

  return rows.map((row) => {
    if (row.status === 'delivered' && row.resolvedPath && validationSettled) return row;

    for (const file of snapshot) {
      const evidencePath = safeDeliverablePath(file.path, scopeDir);
      if (!evidencePath) continue;
      const evidenceKey = `${evidencePath.toLowerCase()}|${file.unitId ?? ''}`;
      if (strictBindings && consumedEvidence.has(evidenceKey)) continue;
      if (strictBindings) {
        if (!strictUnitMatchesRow(file, row)) continue;
        consumedEvidence.add(evidenceKey);
        return {
          ...row,
          status: nextStatus,
          resolvedPath: evidencePath,
          path: evidencePath,
          linkable: true,
          previewable: true,
        };
      }
      const slot = slotById.get(row.id)
        ?? slotByLabel.get(row.label.trim().toLowerCase());
      const slotLike = {
        id: row.id,
        label: row.label,
        kind: slot?.kind,
        pathHint: slot?.pathHint ?? row.path,
        pathHints: slot?.pathHints,
      };
      if (!pathSatisfiesSdmSlot(evidencePath, slotLike)) continue;
      return {
        ...row,
        status: nextStatus,
        resolvedPath: evidencePath,
        path: evidencePath,
        linkable: true,
        previewable: true,
      };
    }
    return row;
  });
}

function pathUnderScopeDir(filePath: string, scopeDir: string | null): boolean {
  if (!scopeDir) return true;
  const normalized = normalizeArtifactPath(filePath).toLowerCase();
  const scope = normalizeArtifactPath(scopeDir).replace(/\/+$/, '').toLowerCase();
  return normalized === scope || normalized.startsWith(`${scope}/`);
}

function normalizeScopeIdentity(path: string | null | undefined): string {
  return normalizeArtifactPath(path ?? '').replace(/\/+$/, '').toLowerCase();
}

function safeDeliverablePath(path: string | undefined, scopeDir: string | null): string | undefined {
  const normalized = normalizeArtifactPath(path ?? '');
  if (!normalized || isNonUserDeliverablePath(normalized)) return undefined;
  if (!pathUnderScopeDir(normalized, scopeDir)) return undefined;
  return normalized;
}

function sanitizeDeliverableItemForScope(
  item: DeliverableItem,
  scopeDir: string | null,
): DeliverableItem | null {
  const primary = safeDeliverablePath(
    item.resolvedPath || item.apiPath || item.path,
    scopeDir,
  );
  if (!primary) return null;
  const path = safeDeliverablePath(item.path, scopeDir) ?? primary;
  const apiPath = safeDeliverablePath(item.apiPath, scopeDir) ?? path;
  const resolvedPath = item.resolvedPath
    ? safeDeliverablePath(item.resolvedPath, scopeDir)
    : undefined;
  return {
    ...item,
    path,
    apiPath,
    ...(resolvedPath ? { resolvedPath } : {}),
  };
}

function certificateV2EvidenceIssue(
  certificate: AcceptanceCertificateV2Ui,
  scopeDir: string | null,
): string | null {
  for (const slot of certificate.slots) {
    const matchedCount = slot.matchedCount ?? 0;
    for (const rawPath of (slot.resolvedPaths ?? []).slice(0, matchedCount)) {
      const normalized = normalizeArtifactPath(rawPath);
      if (isNonUserDeliverablePath(normalized)) return 'v2_evidence_non_deliverable';
      if (!pathUnderScopeDir(normalized, scopeDir)) return 'v2_evidence_outside_scope';
    }
  }
  return null;
}

function rowStatusFromCertificateSlot(
  slot: AcceptanceCertificateSlotUi,
  matched: boolean,
  validationSettled: boolean,
): DeliverableDockRow['status'] {
  if (matched) return 'delivered';
  if (!validationSettled) return 'checking';
  if (slot.status === 'broken') return 'broken';
  return 'missing';
}

function certificatePathIsPreviewable(path: string): boolean {
  const kind = classifyDeliverablePath(path);
  return kind !== 'archive' && kind !== 'file';
}

function buildRowsFromV2Certificate(input: {
  certificate: AcceptanceCertificateV2Ui;
  manifestSlots?: SessionDeliverableManifestUi['slots'];
  scopeDir: string | null;
  validationSettled: boolean;
}): DeliverableDockRow[] {
  const slotById = new Map(input.certificate.slots.map((slot) => [slot.slotId, slot]));
  const manifestById = new Map((input.manifestSlots ?? []).map((slot) => [slot.id, slot]));
  const occurrenceBySlot = new Map<string, number>();

  return input.certificate.units
    .filter((unit) => unit.required)
    .map((unit) => {
      const occurrence = occurrenceBySlot.get(unit.slotId) ?? 0;
      occurrenceBySlot.set(unit.slotId, occurrence + 1);
      const certificateSlot = slotById.get(unit.slotId);
      const manifestSlot = manifestById.get(unit.slotId);
      const resolvedPath = safeDeliverablePath(
        certificateSlot?.resolvedPaths?.[occurrence]
          ?? (occurrence === 0 ? certificateSlot?.resolvedPath : undefined),
        input.scopeDir,
      );
      const matched = Boolean(
        certificateSlot
        && occurrence < (certificateSlot.matchedCount ?? 0)
        && resolvedPath,
      );
      const status = certificateSlot
        ? rowStatusFromCertificateSlot(certificateSlot, matched, input.validationSettled)
        : input.validationSettled
          ? 'missing'
          : 'checking';
      const expectedPath = safeDeliverablePath(unit.expectedPath, input.scopeDir);
      const path = resolvedPath ?? expectedPath ?? unit.slotLabel;
      return {
        id: unit.unitId,
        label: unit.slotLabel,
        path,
        status,
        ...(resolvedPath ? { resolvedPath, apiPath: resolvedPath } : {}),
        previewable: status === 'delivered'
          && Boolean(resolvedPath)
          && certificatePathIsPreviewable(resolvedPath!),
        linkable: status === 'delivered' && Boolean(resolvedPath),
        ...(manifestSlot?.stageId ? {
          stageId: manifestSlot.stageId,
          stageOrder: manifestSlot.stageOrder,
        } : {}),
      };
    });
}

function applyV1CertificateToRows(input: {
  rows: DeliverableDockRow[];
  certificate: AcceptanceCertificateV1Ui;
  scopeDir: string | null;
  validationSettled: boolean;
}): DeliverableDockRow[] {
  const slotById = new Map((input.certificate.slots ?? []).map((slot) => [slot.slotId, slot]));
  return input.rows.map((row) => {
    const slot = slotById.get(row.id);
    if (!slot) {
      return {
        ...row,
        status: 'checking',
        resolvedPath: undefined,
        apiPath: undefined,
        previewable: false,
        linkable: false,
      };
    }
    const resolvedPath = safeDeliverablePath(slot.resolvedPath, input.scopeDir);
    const matched = slot.status === 'done' && Boolean(resolvedPath);
    const status = rowStatusFromCertificateSlot(slot, matched, input.validationSettled);
    return {
      ...row,
      path: resolvedPath ?? row.path,
      status,
      ...(resolvedPath ? { resolvedPath, apiPath: resolvedPath } : {
        resolvedPath: undefined,
        apiPath: undefined,
      }),
      previewable: status === 'delivered'
        && Boolean(resolvedPath)
        && certificatePathIsPreviewable(resolvedPath!),
      linkable: status === 'delivered' && Boolean(resolvedPath),
    };
  });
}

function checkingRows(rows: DeliverableDockRow[]): DeliverableDockRow[] {
  // PD-SAAS-FORK Razer RCA: only pending/missing rows enter checking — keep delivered paths.
  return rows.map((row) => {
    if (row.status === 'delivered' || row.status === 'checking') return row;
    if (row.status !== 'missing' && row.status !== 'needContinue' && row.status !== 'pending') {
      return row;
    }
    return {
      ...row,
      status: 'checking',
      resolvedPath: undefined,
      apiPath: undefined,
      previewable: false,
      linkable: false,
    };
  });
}

export function buildUnifiedDeliverableView(
  input: BuildUnifiedDeliverableViewInput,
): UnifiedDeliverableView {
  const {
    messages,
    projectRoot,
    validationSettled = true,
    diskSnapshot,
  } = input;
  const certificateUi = isDeliverableCertificateUiEnabled();
  const qualityUi = isDeliverableQualityUiEnabled();
  const detachedAcceptanceMeta = sanitizeTurnAcceptanceMetaRecord(input.latestTurnAcceptanceMeta);
  let certificateResolution: AcceptanceCertificateResolution =
    input.latestTurnAcceptanceMeta !== undefined
      ? resolveAcceptanceCertificateStateFromTurnMeta(input.latestTurnAcceptanceMeta)
      : resolveLatestAcceptanceCertificateState(messages);
  const strictDiskBindings = isStrictSnapshotV2(diskSnapshot, input.diskSnapshotVersion);
  const sessionManifest = input.sessionManifest ?? resolveCurrentSessionManifest(messages);
  const frozenManifest = resolveFrozenSessionManifest(messages) ?? sessionManifest;
  const sessionTaskDirectory = input.sessionTaskDirectory ?? resolveCurrentSessionTaskDirectory(messages);
  const resolvedContractScopeDir = input.scopeDir ?? resolveContractScopeDir({
    messages,
    sessionTaskDirectory,
    sessionManifest: frozenManifest,
    turnArtifactDir: input.turnArtifactDir,
    pathHints: frozenManifest?.slots?.map((slot) => slot.pathHint).filter(Boolean) as string[] | undefined,
  });
  const scopeDir = resolvedContractScopeDir;
  let certificateObservation: DeliverableCertificateObservation | undefined;

  if (certificateResolution.state === 'valid_v2') {
    const certificate = certificateResolution.certificate;
    const currentScope = normalizeScopeIdentity(scopeDir);
    const certificateScope = normalizeScopeIdentity(certificate.scopeDir);
    const expectedContractHash = frozenManifest
      ? computeStableContractHashV2(frozenManifest, scopeDir)
      : null;
    let staleReason: string | null = null;
    if (!frozenManifest) {
      staleReason = 'certificate_manifest_missing';
    } else if (certificate.goalVersion !== frozenManifest.goalVersion) {
      staleReason = 'certificate_goal_version_mismatch';
    } else if (!currentScope || certificateScope !== currentScope) {
      staleReason = 'certificate_scope_mismatch';
    } else if (certificate.contractHash !== expectedContractHash) {
      staleReason = 'certificate_contract_hash_mismatch';
    }
    if (staleReason) {
      certificateObservation = createDeliverableCertificateObservation({
        case: 'stale',
        reason: staleReason,
        certificateVersion: 2,
        contractHashVersion: 2,
        contractHash: certificate.contractHash,
      });
      certificateResolution = {
        state: 'stale',
        reason: staleReason,
        certificateVersion: 2,
      };
    } else {
      const evidenceIssue = certificateV2EvidenceIssue(certificate, scopeDir);
      if (evidenceIssue) {
        certificateObservation = createDeliverableCertificateObservation({
          case: 'corrupt_v2',
          reason: evidenceIssue,
          certificateVersion: 2,
          contractHashVersion: 2,
        });
        certificateResolution = {
          state: 'corrupt_v2',
          reason: evidenceIssue,
        };
      } else if (
        certificate.legacyAcceptanceStatus
        !== certificate.strictAcceptanceStatus
      ) {
        certificateObservation = createDeliverableCertificateObservation({
          case: 'shadow_diff',
          reason: 'legacy_strict_status_diff',
          certificateVersion: 2,
          contractHashVersion: 2,
          contractHash: certificate.contractHash,
          legacyAcceptanceStatus: certificate.legacyAcceptanceStatus,
          strictAcceptanceStatus: certificate.strictAcceptanceStatus,
        });
      }
    }
  } else if (certificateResolution.state === 'valid_v1') {
    const certificate = certificateResolution.certificate;
    const manifestGoalVersion = frozenManifest?.goalVersion;
    const currentScope = normalizeScopeIdentity(scopeDir);
    const certificateScope = normalizeScopeIdentity(certificate.scopeDir);
    const staleReason = manifestGoalVersion !== undefined
      && certificate.goalVersion !== undefined
      && certificate.goalVersion !== manifestGoalVersion
      ? 'certificate_goal_version_mismatch'
      : currentScope && certificateScope && certificateScope !== currentScope
        ? 'certificate_scope_mismatch'
        : null;
    if (staleReason) {
      certificateObservation = createDeliverableCertificateObservation({
        case: 'stale',
        reason: staleReason,
        certificateVersion: 1,
      });
      certificateResolution = {
        state: 'stale',
        reason: staleReason,
        certificateVersion: 1,
      };
    }
  }

  if (certificateUi && certificateResolution.state === 'missing') {
    certificateObservation = createDeliverableCertificateObservation({
      case: 'missing',
      reason: certificateResolution.reason,
    });
  } else if (certificateUi && certificateResolution.state === 'corrupt_v2') {
    certificateObservation ??= createDeliverableCertificateObservation({
      case: 'corrupt_v2',
      reason: certificateResolution.reason,
      certificateVersion: 2,
      contractHashVersion: 2,
    });
  }

  const hasValidCertificate = certificateResolution.state === 'valid_v1'
    || certificateResolution.state === 'valid_v2';
  const certificateComplete = certificateResolution.state === 'valid_v2'
    ? certificateResolution.certificate.complete === true
    : hasValidCertificate;
  const settledAcceptanceAuthority = isDeliverableSettledAcceptanceAuthorityEnabled();
  const effectiveValidationSettled = settledAcceptanceAuthority
    ? resolvePipelineValidationSettled({
      latestTurnAcceptanceMeta: detachedAcceptanceMeta,
      diskSnapshotComplete: input.diskSnapshotComplete,
      sessionRepairActive: input.sessionRepairActive,
      isAssistantWorking: input.isAssistantWorking,
      settledAcceptanceAuthority,
      certificateUiEnabled: certificateUi,
      certificateComplete,
      certificateEnforce: isDeliverableCertificateEnforceEnabled(),
    })
    : (validationSettled && input.diskSnapshotComplete !== false);

  let sessionWideItems = input.sessionWideItems;
  if (!sessionWideItems) {
    sessionWideItems = scopeDir
      ? collectDeliverablesFromMessagesInScope(messages, projectRoot, scopeDir)
      : collectDeliverablesFromMessages(messages, projectRoot);
  }
  sessionWideItems = sessionWideItems
    .map((item) => sanitizeDeliverableItemForScope(item, scopeDir))
    .filter((item): item is DeliverableItem => Boolean(item));
  const turnDeliverables = (input.turnDeliverables ?? [])
    .map((item) => sanitizeDeliverableItemForScope(item, scopeDir))
    .filter((item): item is DeliverableItem => Boolean(item));
  const sessionVerifiedPaths = (
    input.sessionVerifiedPaths
    ?? detachedAcceptanceMeta?.verifiedPaths
    ?? collectSessionVerifiedPaths(messages)
  )
    .map((path) => (
      certificateUi
        ? safeDeliverablePath(path, scopeDir)
        : normalizeArtifactPath(path)
    ))
    .filter((path) => !isNonUserDeliverablePath(path))
    .filter((path): path is string => Boolean(path));
  const provisionalPaths = certificateUi ? [] : sessionWideItems
    .map((item) => item.resolvedPath || item.apiPath || item.path)
    .filter((p): p is string => typeof p === 'string' && p.includes('artifacts/'))
    .filter((p) => pathUnderScopeDir(p, scopeDir));
  const certificateVerifiedPaths = certificateResolution.state === 'valid_v2'
    ? certificateResolution.certificate.slots.flatMap((slot) => (
      (slot.resolvedPaths ?? []).slice(0, slot.matchedCount ?? 0)
    ))
    : certificateResolution.state === 'valid_v1'
      ? (certificateResolution.certificate.slots ?? [])
        .filter((slot) => slot.status === 'done')
        .map((slot) => slot.resolvedPath)
        .filter((path): path is string => typeof path === 'string')
      : [];
  const legacyVerifiedPaths = [
    ...sessionVerifiedPaths,
    ...(
      input.verifiedPathsOverride
      ?? detachedAcceptanceMeta?.verifiedPaths
      ?? collectLatestTurnVerifiedPaths(messages)
    ),
    ...provisionalPaths,
  ];
  const effectiveVerifiedPaths = [...new Set(
    (certificateUi ? certificateVerifiedPaths : legacyVerifiedPaths)
      .map((path) => (
        certificateUi
          ? safeDeliverablePath(path, scopeDir)
          : normalizeArtifactPath(path)
      ))
      .filter((path) => !isNonUserDeliverablePath(path))
      .filter((path): path is string => Boolean(path)),
  )];

  const contract = resolveSessionDeliverableContract({
    messages,
    sessionManifest,
    sessionDeliverables: certificateUi ? undefined : sessionWideItems,
    sessionVerifiedPaths: effectiveVerifiedPaths,
  });
  const expectedManifest = contract.expectedEntries.length > 0 ? contract.expectedEntries : undefined;
  const hasAuthoritativeBaseline = countActiveDeliverableSlots(frozenManifest, expectedManifest) > 0;
  const validatedItemsForRows = certificateUi
    ? []
    : sessionWideItems.length > 0
      ? sessionWideItems
      : turnDeliverables;

  const knownVerifiedForAcceptance = [
    ...effectiveVerifiedPaths,
    ...validatedItemsForRows.map((item) => item.resolvedPath || item.apiPath || item.path).filter(Boolean),
    ...turnDeliverables.map((item) => item.resolvedPath || item.apiPath || item.path).filter(Boolean),
  ];
  const acceptanceRows = certificateUi
    ? []
    : collectSessionAcceptanceRows(messages, {
      knownVerifiedPaths: knownVerifiedForAcceptance,
    });

  const profileId = frozenManifest?.profileId ?? sessionManifest?.profileId;
  const slideScopeDir = scopeDir ?? input.turnArtifactDir ?? null;
  const slideProfile = isSlideDeliverableProfile(profileId)
    && !isDocumentDeliverableProfile(profileId);
  let slideManifestPages: ReturnType<typeof inferNovaSlidePagesFromPaths> = [];
  if (slideProfile && slideScopeDir) {
    slideManifestPages = inferNovaSlidePagesFromPaths(slideScopeDir, effectiveVerifiedPaths);
    if (slideManifestPages.length === 0 && expectedManifest?.length) {
      slideManifestPages = expandExpectedManifestSlideCount(expectedManifest, slideScopeDir);
    }
  }

  let rows = buildDeliverableDockRows({
    expectedManifest: expectedManifest ?? undefined,
    acceptanceRows,
    validatedItems: validatedItemsForRows.map((item) => {
      const path = (item.resolvedPath || item.apiPath || item.path || "").replace(/\\/g, "/");
      const pathLower = path.toLowerCase();
      const engineVerified = pathLower.length > 0 && effectiveVerifiedPaths.some((verified) => {
        const v = verified.replace(/\\/g, "/").toLowerCase();
        return v === pathLower || v.endsWith(`/${pathLower}`) || pathLower.endsWith(`/${v}`) || v.includes(pathLower);
      });
      const status = engineVerified
        ? "verified" as const
        : ((item as DeliverableItem & {
          validationStatus?: DeliverableValidationStatus;
        }).validationStatus ?? "pending");
      return { ...item, validationStatus: status };
    }),
    verifiedPaths: effectiveVerifiedPaths,
    turnArtifactDir: scopeDir ?? input.turnArtifactDir ?? null,
    validationSettled: effectiveValidationSettled,
    manifestSlots: frozenManifest?.slots ?? sessionManifest?.slots,
    slideManifestPages: slideManifestPages.length > 0 ? slideManifestPages : undefined,
  });

  if (certificateUi && certificateResolution.state === 'valid_v2') {
    rows = buildRowsFromV2Certificate({
      certificate: certificateResolution.certificate,
      manifestSlots: frozenManifest?.slots ?? sessionManifest?.slots,
      scopeDir,
      validationSettled: effectiveValidationSettled,
    });
  } else if (certificateUi && certificateResolution.state === 'valid_v1') {
    rows = applyV1CertificateToRows({
      rows,
      certificate: certificateResolution.certificate,
      scopeDir,
      validationSettled: effectiveValidationSettled,
    });
  } else if (certificateUi && !hasValidCertificate) {
    const acceptancePassed = isAcceptancePassedForSettled(detachedAcceptanceMeta);
    const certificateForceChecking = certificateResolution.state === 'stale'
      || certificateResolution.state === 'corrupt_v2'
      || !(settledAcceptanceAuthority && acceptancePassed);
    if (certificateForceChecking) {
      rows = checkingRows(rows);
    }
  } else if (!effectiveValidationSettled) {
    rows = rows.map((row) => (
      row.status === 'missing' || row.status === 'needContinue'
        ? { ...row, status: 'checking' }
        : row
    ));
  }

  const folderPath = resolveSessionFolderPath({
    messages,
    projectRoot,
    turnDeliverables,
    turnArtifactDir: scopeDir ?? input.turnArtifactDir ?? null,
  });

  const folderItems = collectSessionFolderItems({
    messages,
    projectRoot,
    turnDeliverables,
    turnArtifactDir: scopeDir ?? input.turnArtifactDir ?? null,
  })
    .map((item) => sanitizeDeliverableItemForScope(item, scopeDir))
    .filter((item): item is DeliverableItem => Boolean(item));

  const diskItems = diskSnapshotToDeliverableItems(diskSnapshot, strictDiskBindings);
  const syncItems = [...folderItems];
  const seenSync = new Set(syncItems.map((item) => (
    normalizeArtifactPath(item.resolvedPath || item.apiPath || item.path).toLowerCase()
  )));
  for (const rawItem of [...turnDeliverables, ...sessionWideItems, ...diskItems]) {
    const item = sanitizeDeliverableItemForScope(rawItem, scopeDir);
    if (!item) continue;
    const key = normalizeArtifactPath(item.resolvedPath || item.apiPath || item.path).toLowerCase();
    if (seenSync.has(key)) continue;
    seenSync.add(key);
    syncItems.push(item);
  }

  const certificateForceChecking = certificateUi && (
    certificateResolution.state === 'stale'
    || certificateResolution.state === 'corrupt_v2'
    || (!hasValidCertificate
      && !(settledAcceptanceAuthority && isAcceptancePassedForSettled(detachedAcceptanceMeta)))
  );
  const certificateBlocksEnrich = certificateForceChecking;
  const strictCompletionGate = isUiStrictCompletionGateEnabled();
  const terminalAcceptanceComplete = detachedAcceptanceMeta?.completionState === 'complete'
    && isAcceptancePassedForSettled(detachedAcceptanceMeta);
  if (!certificateForceChecking && (!certificateUi || !hasValidCertificate || !certificateBlocksEnrich)) {
    const baselineLocked = Boolean(frozenManifest?.baselineLocked);
    rows = mergeFolderItemsIntoDockRows(rows, syncItems, {
      allowExtraRows: baselineLocked
        ? false
        : (certificateUi && !certificateBlocksEnrich ? false : !hasAuthoritativeBaseline),
      manifestSlots: frozenManifest?.slots ?? sessionManifest?.slots,
      expectedEntries: expectedManifest,
      scopeDir,
      validationSettled: certificateBlocksEnrich ? false : effectiveValidationSettled,
      folderPromoteRequiresVerified: strictCompletionGate && !terminalAcceptanceComplete,
      verifiedPaths: certificateBlocksEnrich ? [] : effectiveVerifiedPaths,
    });
  }

  if (
    !certificateUi
    || certificateBlocksEnrich
    || (!hasValidCertificate && strictDiskBindings)
  ) {
    rows = enrichRowsWithDiskSnapshot(
      rows,
      diskSnapshot,
      frozenManifest?.slots ?? sessionManifest?.slots,
      strictDiskBindings,
      scopeDir,
      !input.sessionRepairActive
        && !input.isAssistantWorking
        && (
          input.validationSettled !== false
          || input.diskSnapshotComplete === false
        ),
    );
  }

  const progressBase = computeSdmProgressUi(
    frozenManifest ?? sessionManifest,
    effectiveVerifiedPaths,
  );
  const currentStageSlot = sessionManifest?.slots?.find(
    (slot) => slot.status !== 'removed'
      && slot.status !== 'done'
      && slot.stageId === sessionManifest?.currentStageId,
  );

  const requiredSlots = (frozenManifest?.slots ?? sessionManifest?.slots ?? [])
    .filter((slot) => slot.status !== 'removed' && slot.required !== false);
  const acceptanceCertificate = certificateUi
    && (
      certificateResolution.state === 'valid_v1'
      || certificateResolution.state === 'valid_v2'
    )
    ? certificateResolution.certificate
    : null;
  const requiredTotal = acceptanceCertificate
    ? acceptanceCertificate.requiredTotal
    : contract.totalSlots > 0
      ? contract.totalSlots
      : (requiredSlots.length > 0
        ? requiredSlots.length
        : countActiveDeliverableSlots(undefined, expectedManifest));

  const deliveredCount = rows.filter((row) => row.status === 'delivered').length;
  const progress: UnifiedDeliverableProgress = acceptanceCertificate
    ? {
      done: acceptanceCertificate.requiredDone,
      total: acceptanceCertificate.requiredTotal,
      currentLabel: progressBase.currentLabel,
      currentStageId: currentStageSlot?.stageId ?? sessionManifest?.currentStageId,
    }
    : {
      done: requiredTotal > 0
        ? Math.min(
          requiredTotal,
          certificateUi ? deliveredCount : Math.max(progressBase.done, deliveredCount),
        )
        : deliveredCount,
      total: requiredTotal > 0 ? requiredTotal : rows.length,
      currentLabel: progressBase.currentLabel,
      currentStageId: currentStageSlot?.stageId ?? sessionManifest?.currentStageId,
    };

  const contractHash = acceptanceCertificate?.contractHash ?? computeContractHash(rows);
  const latestAcceptanceMeta = detachedAcceptanceMeta ?? resolveLatestTurnAcceptanceMeta(messages);
  const qualityStatus = qualityUi
    && latestAcceptanceMeta?.finality !== 'draft'
    && certificateResolution.state === 'valid_v2'
    ? resolveDeliverableQualityStatus(certificateResolution.certificate)
    : undefined;

  return {
    rows,
    summaryRows: rows,
    progress,
    contractHash,
    folderPath,
    folderItems,
    scopeDir: scopeDir ?? folderPath,
    totalSlots: requiredTotal,
    expectedManifest: contract.expectedEntries,
    sessionManifest,
    ...(certificateObservation ? { certificateObservation } : {}),
    ...(qualityStatus ? { qualityStatus } : {}),
    ...(input.diskSnapshotBinding ? { diskSnapshotBinding: input.diskSnapshotBinding } : {}),
  };
}

export function exportStatusLabelForRow(
  status: DeliverableSummaryRow['status'],
): string {
  switch (status) {
    case 'delivered':
      return '已交付';
    case 'checking':
      return '校验中';
    case 'needContinue':
      return '需继续';
    case 'missing':
    default:
      return '未完成';
  }
}
