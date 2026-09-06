/**
 * PD-SAAS-FORK: single O(n) session deliverable pipeline — one collect path per switch.
 */
import type { ChatMessage } from '../components/chat/types/types';
import type { DeliverableItem } from './collectDeliverables';
import {
  buildUnifiedDeliverableView,
  type TaskFolderSnapshotFile,
  type UnifiedDeliverableView,
} from './buildUnifiedDeliverableView';
import {
  deriveDeliverablesDockState,
  type DeliverablesDockState,
} from './deriveDeliverablesDockState';
import { extractUserGoalFromSessionMessages } from './deliverableDisplayPolicy';
import {
  extractTurnAcceptanceMeta,
  resolveLatestAcceptanceCertificateState,
  resolveLatestTurnAcceptanceMeta,
  sanitizeTurnAcceptanceMetaRecord,
} from './turnAcceptanceMeta';
import {
  resolveCurrentSessionManifest,
  resolveFrozenSessionManifest,
  computeSdmProgressUi,
  type SessionDeliverableManifestUi,
} from './resolveSessionDeliverableManifest';
import { resolveCurrentSessionTaskDirectory } from './resolveSessionTaskDirectory';
import { resolveContractScopeDir, type SessionTaskDirectoryUi } from './resolveContractScopeDir';
import { collectDeliverablesFromMessagesInScope } from './collectDeliverables';
import {
  selectLatestDeliverableSummaryTurn,
  type LatestDeliverableSummarySelection,
} from './selectLatestDeliverableSummaryTurn';
import type { SessionDeliverableContract } from './resolveSessionDeliverableContract';
import type { ExpectedManifestEntry } from './buildDeliverableSummaryRows';
import type { DeliverableValidationSessionValue } from './DeliverableValidationSessionContext';
import type { TaskFolderSnapshotBinding } from './fetchTaskFolderSnapshot';
import { isDeliverableCertificateUiEnabled } from './perfFeatureFlags';
import { isDeliverableQualityUiEnabled } from './runtimeFeatureFlags';
import {
  coSourceSessionHistoryDeliverableEnvelope,
  resolveSessionHistoryDeliverableContext,
} from './sessionHistoryDeliverableEnvelope';

export type SessionDeliverablePipelineInput = {
  sessionId?: string;
  messages: ChatMessage[];
  projectRoot: string;
  hasMoreMessages: boolean;
  sessionTaskDirectory?: SessionTaskDirectoryUi | null;
  diskSnapshot?: TaskFolderSnapshotFile[];
  diskSnapshotVersion?: number;
  diskSnapshotContractIdentity?: string;
  diskSnapshotBinding?: TaskFolderSnapshotBinding;
  /** PD-SAAS-FORK: global task-folder scan completeness participates in cache identity. */
  diskSnapshotComplete?: boolean;
  validationSettled?: boolean;
  deliverableCertificateUiEnabled?: boolean;
  deliverableQualityUiEnabled?: boolean;
  sessionRepairActive?: boolean;
  isAssistantWorking?: boolean;
  /** Cache-bust signal from turn boundary (turn complete / acceptance change). */
  turnBoundaryKey?: string;
  /** PD-SAAS-FORK: response-envelope co-source for tail-paginated history. */
  latestTurnAcceptanceMeta?: Record<string, unknown>;
  sessionDeliverableManifest?: SessionDeliverableManifestUi | null;
};

export type ProcessRailProgress = {
  done: number;
  total: number;
  currentLabel?: string;
};

export type SessionDeliverablePipelineBundle = {
  fingerprint: string;
  frozenManifest?: SessionDeliverableManifestUi;
  scopeDir: string | null;
  sessionItems: DeliverableItem[];
  verifiedPaths: string[];
  contract: SessionDeliverableContract;
  latest: LatestDeliverableSummarySelection;
  unifiedView: UnifiedDeliverableView;
  dockState: DeliverablesDockState;
  validationSession: Pick<
    DeliverableValidationSessionValue,
    'currentManifest' | 'expectedEntries' | 'sdmSlotPaths' | 'latestAcceptanceMeta'
  >;
  processRailProgress: ProcessRailProgress | null;
};

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function stableFingerprintValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableFingerprintValue);
  }
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, stableFingerprintValue(record[key])]),
  );
}

function fingerprintUnknown(value: unknown): string {
  if (typeof value === 'string') return hashString(value);
  if (value === undefined) return '';
  try {
    return hashString(JSON.stringify(stableFingerprintValue(value)) ?? '');
  } catch {
    return hashString(String(value));
  }
}

function buildDeliverableMessageFingerprint(messages: ChatMessage[]): string {
  const records = messages.map((message) => [
    message.id ?? '',
    message.type,
    message.isToolUse ? 'tool' : '',
    message.toolName ?? '',
    fingerprintUnknown(message.content),
    fingerprintUnknown(message.toolInput),
    fingerprintUnknown(message.toolResult),
    fingerprintUnknown(message.outputFile),
    fingerprintUnknown(message.taskResult),
    fingerprintUnknown(message.deliverables),
    fingerprintUnknown(message.files),
    fingerprintUnknown(message.turnArtifactDir),
    fingerprintUnknown(message.taskArtifactDir),
    fingerprintUnknown(message.scopeId),
    fingerprintUnknown(message.sessionTaskDirectory),
  ].join('|'));
  return hashString(records.join(';'));
}

function pathUnderScopeDir(filePath: string, scopeDir: string | null): boolean {
  if (!scopeDir) return true;
  const normalized = filePath.replace(/\\/g, '/');
  const scope = scopeDir.replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized === scope || normalized.startsWith(`${scope}/`);
}

export function collectSessionVerifiedPaths(messages: ChatMessage[]): string[] {
  const paths = new Set<string>();
  for (const message of messages) {
    if (message.type !== 'assistant') continue;
    const meta = extractTurnAcceptanceMeta(message);
    for (const path of meta?.verifiedPaths ?? []) {
      if (typeof path === 'string' && path.trim()) paths.add(path.trim());
    }
    if (Array.isArray(message.verifiedDeliverablePaths)) {
      for (const path of message.verifiedDeliverablePaths) {
        if (typeof path === 'string' && path.trim()) paths.add(path.trim());
      }
    }
  }
  return [...paths];
}

function buildAcceptanceFingerprint(messages: ChatMessage[]): string {
  const certificateResolution = resolveLatestAcceptanceCertificateState(messages);
  const acceptanceRecords = messages
    .filter((message) => message.type === 'assistant')
    .map((message) => {
      const meta = extractTurnAcceptanceMeta(message);
      const rawMeta = message.turnAcceptanceMeta && typeof message.turnAcceptanceMeta === 'object'
        ? message.turnAcceptanceMeta as Record<string, unknown>
        : {};
      return {
        id: message.id ?? '',
        acceptanceStatus: meta?.acceptanceStatus ?? '',
        verifiedPaths: [...(meta?.verifiedPaths ?? [])].sort(),
        missingPaths: [...(meta?.missingPaths ?? [])].sort(),
        brokenPaths: [...(meta?.brokenPaths ?? [])].sort(),
        slotBindings: stableFingerprintValue(meta?.slotBindings ?? rawMeta.slotBindings ?? []),
        acceptanceCertificate: stableFingerprintValue(rawMeta.acceptanceCertificate ?? null),
      };
    })
    .filter((record) => (
      record.acceptanceStatus
      || record.verifiedPaths.length > 0
      || record.missingPaths.length > 0
      || record.brokenPaths.length > 0
      || (Array.isArray(record.slotBindings) && record.slotBindings.length > 0)
      || record.acceptanceCertificate !== null
    ));
  return hashString(JSON.stringify({
    resolution: stableFingerprintValue(certificateResolution),
    records: acceptanceRecords,
  }));
}

export function buildPipelineFingerprint(input: {
  sessionId?: string;
  messages: ChatMessage[];
  projectRoot?: string;
  hasMoreMessages?: boolean;
  sessionTaskDirectory?: SessionTaskDirectoryUi | null;
  sessionRepairActive?: boolean;
  isAssistantWorking?: boolean;
  turnBoundaryKey?: string;
  diskSnapshotLen?: number;
  diskSnapshot?: TaskFolderSnapshotFile[];
  diskSnapshotVersion?: number;
  diskSnapshotContractIdentity?: string;
  diskSnapshotBinding?: TaskFolderSnapshotBinding;
  diskSnapshotComplete?: boolean;
  validationSettled?: boolean;
  deliverableCertificateUiEnabled?: boolean;
  deliverableQualityUiEnabled?: boolean;
  latestTurnAcceptanceMeta?: Record<string, unknown>;
  sessionDeliverableManifest?: SessionDeliverableManifestUi | null;
}): string {
  const lastMsgId = input.messages[input.messages.length - 1]?.id ?? '';
  const goalHash = hashString(extractUserGoalFromSessionMessages(input.messages).slice(0, 240));
  const acceptanceHash = buildAcceptanceFingerprint(input.messages);
  const messageHash = buildDeliverableMessageFingerprint(input.messages);
  const manifest = resolveFrozenSessionManifest(input.messages)
    ?? resolveCurrentSessionManifest(input.messages);
  const manifestHash = hashString(JSON.stringify(stableFingerprintValue(manifest ?? null)));
  const projectRootHash = hashString(input.projectRoot ?? '');
  const taskDirectoryHash = fingerprintUnknown(input.sessionTaskDirectory ?? null);
  const historyEnvelopeHash = fingerprintUnknown({
    latestTurnAcceptanceMeta: input.latestTurnAcceptanceMeta ?? null,
    sessionDeliverableManifest: input.sessionDeliverableManifest ?? null,
  });
  const boundary = input.turnBoundaryKey ?? '';
  const diskEntries = (input.diskSnapshot ?? [])
    .map((file) => [
      file.path.replace(/\\/g, '/').toLowerCase(),
      file.unitId ?? '',
      file.slotId ?? '',
      file.inContract === true ? 'contract' : file.inContract === false ? 'extra' : 'unknown',
      file.snapshotState ?? '',
    ].join('|'))
    .sort();
  const disk = input.diskSnapshot
    ? hashString(diskEntries.join(';'))
    : String(input.diskSnapshotLen ?? 0);
  const contractIdentity = hashString(input.diskSnapshotContractIdentity ?? '');
  const binding = input.diskSnapshotBinding;
  const bindingFingerprint = binding
    ? [
      binding.requiredCount,
      binding.matchedCount,
      binding.complete ? 'complete' : 'incomplete',
      binding.incompleteReason ?? '',
    ].join('|')
    : 'none';
  const diskCompleteness = input.diskSnapshotComplete === true
    ? 'complete'
    : input.diskSnapshotComplete === false
      ? 'inconclusive'
      : 'unknown';
  return [
    input.sessionId ?? '',
    projectRootHash,
    input.hasMoreMessages === true ? 'has-more' : 'history-complete',
    taskDirectoryHash,
    historyEnvelopeHash,
    input.sessionRepairActive === true ? 'repair-active' : 'repair-idle',
    input.isAssistantWorking === true ? 'assistant-working' : 'assistant-idle',
    (input.deliverableCertificateUiEnabled ?? isDeliverableCertificateUiEnabled())
      ? 'certificate-ui'
      : 'legacy-ui',
    (input.deliverableQualityUiEnabled ?? isDeliverableQualityUiEnabled())
      ? 'quality-ui'
      : 'quality-hidden',
    input.messages.length,
    lastMsgId,
    messageHash,
    acceptanceHash,
    manifestHash,
    goalHash,
    boundary,
    contractIdentity,
    bindingFingerprint,
    disk,
    input.diskSnapshotVersion ?? 'legacy',
    diskCompleteness,
    input.validationSettled === true
      ? 'validation-settled'
      : input.validationSettled === false
        ? 'validation-pending'
        : 'validation-unknown',
  ].join(':');
}

export function computeProcessRailProgress(input: {
  manifest?: SessionDeliverableManifestUi;
  verifiedPaths: string[];
  contract: SessionDeliverableContract;
}): ProcessRailProgress | null {
  if (input.contract.totalSlots <= 0) return null;
  const progressBase = computeSdmProgressUi(input.manifest, input.verifiedPaths);
  return {
    done: Math.min(input.contract.totalSlots, progressBase.done),
    total: input.contract.totalSlots,
    currentLabel: progressBase.currentLabel,
  };
}

export function isSessionPipelineBundleEnabled(): boolean {
  return import.meta.env.VITE_SESSION_PIPELINE_BUNDLE !== '0';
}

export function coSourceLatestTurnAcceptanceMeta(
  messages: ChatMessage[],
  latestTurnAcceptanceMeta: Record<string, unknown> | null | undefined,
): ChatMessage[] {
  return coSourceSessionHistoryDeliverableEnvelope(messages, {
    latestTurnAcceptanceMeta,
  });
}

export function buildSessionDeliverablePipeline(
  input: SessionDeliverablePipelineInput,
): SessionDeliverablePipelineBundle {
  const {
    projectRoot,
    hasMoreMessages,
    sessionTaskDirectory,
    diskSnapshot,
    diskSnapshotVersion,
    diskSnapshotContractIdentity,
    diskSnapshotBinding,
    diskSnapshotComplete,
    validationSettled = true,
    sessionRepairActive = false,
    isAssistantWorking = false,
    sessionId,
    turnBoundaryKey,
  } = input;
  const sanitizedHistoryAcceptanceMeta = sanitizeTurnAcceptanceMetaRecord(
    input.latestTurnAcceptanceMeta,
  );
  const historyContext = resolveSessionHistoryDeliverableContext(input.messages, {
    latestTurnAcceptanceMeta: sanitizedHistoryAcceptanceMeta
      ? { ...sanitizedHistoryAcceptanceMeta }
      : undefined,
    sessionDeliverableManifest: input.sessionDeliverableManifest,
    sessionTaskDirectory,
  });
  const messages = historyContext.messages;
  const detachedEnvelope = historyContext.detachedEnvelope;
  const detachedAcceptanceMeta = sanitizeTurnAcceptanceMetaRecord(
    detachedEnvelope?.latestTurnAcceptanceMeta,
  );

  const fingerprint = buildPipelineFingerprint({
    sessionId,
    messages,
    turnBoundaryKey,
    diskSnapshot,
    diskSnapshotVersion,
    diskSnapshotContractIdentity,
    diskSnapshotBinding,
    diskSnapshotComplete,
    validationSettled,
    projectRoot,
    hasMoreMessages,
    sessionTaskDirectory,
    sessionRepairActive,
    isAssistantWorking,
    deliverableCertificateUiEnabled: input.deliverableCertificateUiEnabled,
    deliverableQualityUiEnabled: input.deliverableQualityUiEnabled,
    latestTurnAcceptanceMeta: sanitizedHistoryAcceptanceMeta
      ? { ...sanitizedHistoryAcceptanceMeta }
      : undefined,
    sessionDeliverableManifest: input.sessionDeliverableManifest,
  });

  const sessionManifest = resolveCurrentSessionManifest(messages)
    ?? detachedEnvelope?.sessionDeliverableManifest
    ?? undefined;
  const frozenManifest = resolveFrozenSessionManifest(messages) ?? sessionManifest;
  const resolvedTaskDirectory = sessionTaskDirectory ?? resolveCurrentSessionTaskDirectory(messages);
  const scopeDir = resolveContractScopeDir({
    messages,
    sessionTaskDirectory: resolvedTaskDirectory,
    sessionManifest: frozenManifest,
    pathHints: frozenManifest?.slots?.map((slot) => slot.pathHint).filter(Boolean) as string[] | undefined,
  });

  let sessionItems: DeliverableItem[] = [];
  if (projectRoot && scopeDir) {
    sessionItems = collectDeliverablesFromMessagesInScope(messages, projectRoot, scopeDir);
    sessionItems = sessionItems.filter((item) => {
      const path = item.resolvedPath || item.apiPath || item.path;
      return typeof path === 'string' && pathUnderScopeDir(path, scopeDir);
    });
  }

  const verifiedPaths = [...new Set([
    ...collectSessionVerifiedPaths(messages),
    ...(detachedAcceptanceMeta?.verifiedPaths ?? []),
  ])];

  const latest = selectLatestDeliverableSummaryTurn({
    messages,
    projectRoot,
    hasMoreMessages,
  });

  const unifiedView = buildUnifiedDeliverableView({
    messages,
    projectRoot,
    sessionManifest,
    sessionTaskDirectory: resolvedTaskDirectory,
    diskSnapshot,
    diskSnapshotVersion,
    diskSnapshotComplete,
    diskSnapshotBinding,
    validationSettled,
    scopeDir,
    sessionWideItems: sessionItems,
    sessionVerifiedPaths: verifiedPaths,
    latestTurnAcceptanceMeta: detachedEnvelope?.latestTurnAcceptanceMeta,
  });
  const contract: SessionDeliverableContract = {
    expectedEntries: unifiedView.expectedManifest,
    totalSlots: unifiedView.totalSlots,
    sessionManifest: unifiedView.sessionManifest,
  };

  const dockState = deriveDeliverablesDockState({
    messages,
    projectRoot,
    hasMoreMessages,
    sessionRepairActive,
    isAssistantWorking,
    sessionManifest,
    sessionTaskDirectory: resolvedTaskDirectory,
    diskSnapshot,
    diskSnapshotVersion,
    diskSnapshotComplete,
    validationSettled,
    prebuiltView: unifiedView,
    prebuiltLatest: latest,
    prebuiltScopeDir: scopeDir,
  });

  const expectedEntries: ExpectedManifestEntry[] | undefined =
    contract.expectedEntries.length > 0 ? contract.expectedEntries : undefined;

  const sdmSlotPaths = (sessionManifest?.slots ?? [])
    .filter((slot) => slot.status !== 'removed' && typeof slot.pathHint === 'string' && slot.pathHint.trim())
    .map((slot) => slot.pathHint!.trim());

  const processRailProgress = unifiedView.progress.total > 0
    ? unifiedView.progress
    : null;

  const bundle: SessionDeliverablePipelineBundle = {
    fingerprint,
    frozenManifest,
    scopeDir,
    sessionItems,
    verifiedPaths,
    contract,
    latest,
    unifiedView,
    dockState,
    validationSession: {
      currentManifest: sessionManifest,
      expectedEntries,
      sdmSlotPaths,
      latestAcceptanceMeta: resolveLatestTurnAcceptanceMeta(messages) ?? detachedAcceptanceMeta,
    },
    processRailProgress,
  };

  return bundle;
}
