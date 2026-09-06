/**
 * PD-SAAS-FORK: In-memory FIFO turn queue per user (catalog is durable source).
 */
import { sessionKeysMatch } from '../conversation/normalizeSessionId.js';

/** @typedef {{
 *   itemId: string;
 *   sessionKey: string;
 *   tenantId: string;
 *   userId: number;
 *   role?: string | null;
 *   command: string;
 *   options: Record<string, unknown>;
 *   providerHint: string;
 *   enqueuedAt: number;
 *   sessionCreatedAtMs?: number;
 *   acceptedInputRef?: {
 *     entryId: string;
 *     turnId: string;
 *     sequence: number;
 *     createdAt: string;
 *   };
 *   acceptedInputFingerprint?: string;
 *   acceptedInputAttachmentDescriptors?: Array<Record<string, unknown>>;
 *   transcriptRelPath?: string;
 *   clientIdempotencyKey?: string;
 *   retryCount?: number;
 *   retryAvailableAt?: number;
 *   retryExhausted?: boolean;
 * }} QueueItem */

/** @type {Map<string, QueueItem[]>} */
const queues = new Map();

/** @type {Set<string>} */
const pumpingLocks = new Set();

function queueKey(tenantId, userId) {
  return `${tenantId}:${userId}`;
}

/**
 * @param {QueueItem} item
 */
export function enqueueTurn(item) {
  const key = queueKey(item.tenantId, item.userId);
  const list = queues.get(key) ?? [];
  const itemId = resolveQueueItemId(item);
  const normalized = { ...item, itemId };
  const existingIdx = list.findIndex((queued) => queued.itemId === itemId);
  if (existingIdx >= 0) {
    return existingIdx + 1;
  } else {
    list.push(normalized);
  }
  queues.set(key, list);
  return list.length;
}

/**
 * @param {{ tenantId: string, userId: number, sessionKey: string }} input
 */
export function cancelQueuedTurn(input) {
  const key = queueKey(input.tenantId, input.userId);
  const list = queues.get(key);
  if (!list) return false;
  const next = list.filter((q) => !sessionKeysMatch(q.sessionKey, input.sessionKey));
  if (next.length === list.length) return false;
  queues.set(key, next);
  return true;
}

/**
 * @param {{ tenantId: string, userId: number }} input
 */
export function peekQueuedTurn(input) {
  const list = queues.get(queueKey(input.tenantId, input.userId));
  return list?.[0] ?? null;
}

/**
 * @param {{ tenantId: string, userId: number }} input
 */
export function dequeueTurn(input) {
  const key = queueKey(input.tenantId, input.userId);
  const list = queues.get(key);
  if (!list || list.length === 0) return null;
  const [head, ...rest] = list;
  if (rest.length === 0) queues.delete(key);
  else queues.set(key, rest);
  return head;
}

/**
 * @param {{ tenantId: string, userId: number, itemId: string }} input
 */
export function dequeueTurnByItemId(input) {
  const key = queueKey(input.tenantId, input.userId);
  const list = queues.get(key);
  if (!list) return null;
  const index = list.findIndex((item) => item.itemId === input.itemId);
  if (index < 0) return null;
  const [item] = list.splice(index, 1);
  if (list.length === 0) queues.delete(key);
  else queues.set(key, list);
  return item ?? null;
}

/**
 * @param {{ tenantId: string, userId: number, itemId: string }} input
 */
export function getQueuedTurnByItemId(input) {
  const list = queues.get(queueKey(input.tenantId, input.userId));
  const item = list?.find((candidate) => candidate.itemId === input.itemId);
  return item ? { ...item, options: { ...item.options } } : null;
}

/**
 * @param {{ tenantId: string, userId: number, itemId: string, now?: number, maxRetries?: number }} input
 */
export function markQueuedTurnFailed(input) {
  const list = queues.get(queueKey(input.tenantId, input.userId));
  const item = list?.find((candidate) => candidate.itemId === input.itemId);
  if (!item) return null;
  const retryCount = (item.retryCount ?? 0) + 1;
  const maxRetries = input.maxRetries ?? 3;
  const retryExhausted = retryCount >= maxRetries;
  const delayMs = Math.min(30_000, 5_000 * (2 ** Math.max(0, retryCount - 1)));
  item.retryCount = retryCount;
  item.retryExhausted = retryExhausted;
  item.hardFailed = false;
  item.retryAvailableAt = retryExhausted
    ? undefined
    : (input.now ?? Date.now()) + delayMs;
  return { ...item, options: { ...item.options } };
}

/**
 * PD-SAAS-FORK: non-recoverable turn failure — do not retry or auto-revive in pump reconcile.
 * @param {{ tenantId: string, userId: number, itemId: string }} input
 */
export function markQueuedTurnHardFailed(input) {
  const list = queues.get(queueKey(input.tenantId, input.userId));
  const item = list?.find((candidate) => candidate.itemId === input.itemId);
  if (!item) return null;
  item.retryCount = (item.retryCount ?? 0) + 1;
  item.retryExhausted = true;
  item.hardFailed = true;
  item.retryAvailableAt = undefined;
  return { ...item, options: { ...item.options } };
}

/**
 * @param {{ tenantId: string, userId: number, itemId: string }} input
 */
export function resetQueuedTurnRetry(input) {
  const list = queues.get(queueKey(input.tenantId, input.userId));
  const item = list?.find((candidate) => candidate.itemId === input.itemId);
  if (!item) return null;
  item.retryCount = 0;
  item.retryAvailableAt = undefined;
  item.retryExhausted = false;
  return { ...item, options: { ...item.options } };
}

/**
 * @param {{ tenantId: string, userId: number }} input
 * @returns {QueueItem[]}
 */
export function listQueuedTurns(input) {
  return (queues.get(queueKey(input.tenantId, input.userId)) ?? [])
    .map((item) => ({ ...item, options: { ...item.options } }));
}

/** PD-SAAS-FORK: sort key — older conversations first, then FIFO within session. */
export function compareQueueItemsForPump(a, b) {
  const sessionMsA = resolveSessionCreatedAtSortKey(a);
  const sessionMsB = resolveSessionCreatedAtSortKey(b);
  if (sessionMsA !== sessionMsB) return sessionMsA - sessionMsB;
  if (a.sessionKey !== b.sessionKey) {
    return String(a.sessionKey).localeCompare(String(b.sessionKey));
  }
  return (a.enqueuedAt ?? 0) - (b.enqueuedAt ?? 0);
}

function resolveSessionCreatedAtSortKey(item) {
  if (typeof item.sessionCreatedAtMs === 'number' && Number.isFinite(item.sessionCreatedAtMs)) {
    return item.sessionCreatedAtMs;
  }
  return item.enqueuedAt ?? Number.MAX_SAFE_INTEGER;
}

export function sortQueueItemsForPump(items) {
  return [...items].sort(compareQueueItemsForPump);
}

/** Pump candidates ordered by conversation created_at ASC (focus older dialogs first). */
export function listQueuedTurnsForPump(input) {
  return sortQueueItemsForPump(listQueuedTurns(input));
}

/** 1-based position in session-created-at order (for user-facing queue notice). */
export function resolveQueuePosition(input, itemId) {
  const sorted = listQueuedTurnsForPump(input);
  const index = sorted.findIndex((item) => item.itemId === itemId);
  return index >= 0 ? index + 1 : sorted.length;
}

/**
 * @param {{ tenantId: string, userId: number }} input
 */
export function getQueueLength(input) {
  return queues.get(queueKey(input.tenantId, input.userId))?.length ?? 0;
}

/**
 * @param {{ tenantId: string, userId: number, sessionKey: string }} input
 * @param {() => Promise<void>} fn
 */
export async function withPumpLock(input, fn) {
  const lockKey = `${input.tenantId}:${input.userId}:${input.itemId ?? input.sessionKey}`;
  if (pumpingLocks.has(lockKey)) return;
  pumpingLocks.add(lockKey);
  try {
    await fn();
  } finally {
    pumpingLocks.delete(lockKey);
  }
}

export function resetTurnQueueForTests() {
  queues.clear();
  pumpingLocks.clear();
}

/**
 * @param {{ tenantId: string, userId: number }} input
 */
export function clearUserQueue(input) {
  queues.delete(queueKey(input.tenantId, input.userId));
}

export function hydrateQueueFromCatalogRows(rows) {
  const stats = { hydrated: 0, invalid: 0, skipped: 0 };
  for (const row of rows) {
    if (row.executionStatus !== 'queued' && row.executionStatus !== 'running') {
      stats.skipped += 1;
      continue;
    }
    const parsed = parseRowPayload(row);
    if (parsed.invalid) stats.invalid += 1;
    for (const payload of parsed.items) {
      const item = normalizeQueuePayload(row, payload);
      if (!item) {
        stats.invalid += 1;
        continue;
      }
      enqueueTurn(item);
      stats.hydrated += 1;
    }
  }
  return stats;
}

export function parseQueueItemsFromCatalogRow(row) {
  const parsed = parseRowPayload(row);
  return parsed.items
    .map((payload) => normalizeQueuePayload(row, payload))
    .filter(Boolean);
}

/**
 * @param {{ tenantId: string, userId: number, sessionKey: string }} input
 * @returns {QueueItem[]}
 */
export function listQueuedTurnsForSession(input) {
  return (queues.get(queueKey(input.tenantId, input.userId)) ?? [])
    .filter((item) => sessionKeysMatch(item.sessionKey, input.sessionKey))
    .map((item) => ({ ...item, options: { ...item.options } }));
}

/** @param {QueueItem[]} items */
export function buildQueuedPayloadEnvelope(items) {
  return {
    version: 2,
    items: items.map((item) => serializeQueueItem(item)),
  };
}

/** @param {QueueItem} item */
export function serializeQueueItem(item) {
  return {
    itemId: item.itemId,
    command: item.command,
    options: item.options,
    providerHint: item.providerHint,
    role: item.role ?? null,
    enqueuedAt: item.enqueuedAt,
    ...(typeof item.sessionCreatedAtMs === 'number'
      ? { sessionCreatedAtMs: item.sessionCreatedAtMs }
      : {}),
    ...(item.acceptedInputRef ? { acceptedInputRef: item.acceptedInputRef } : {}),
    ...(item.acceptedInputFingerprint
      ? { acceptedInputFingerprint: item.acceptedInputFingerprint }
      : {}),
    ...(item.acceptedInputAttachmentDescriptors
      ? { acceptedInputAttachmentDescriptors: item.acceptedInputAttachmentDescriptors }
      : {}),
    ...(item.transcriptRelPath ? { transcriptRelPath: item.transcriptRelPath } : {}),
    ...(item.clientIdempotencyKey ? { clientIdempotencyKey: item.clientIdempotencyKey } : {}),
    ...(item.retryCount ? { retryCount: item.retryCount } : {}),
    ...(item.retryAvailableAt ? { retryAvailableAt: item.retryAvailableAt } : {}),
    ...(item.retryExhausted ? { retryExhausted: true } : {}),
  };
}

/** @param {Partial<QueueItem>} item */
function resolveQueueItemId(item) {
  if (typeof item.itemId === 'string' && item.itemId.trim()) return item.itemId.trim();
  if (isAcceptedInputRef(item.acceptedInputRef)) return item.acceptedInputRef.entryId;
  return `${item.sessionKey ?? 'session'}:legacy`;
}

function parseRowPayload(row) {
  let payload = row.queuedPayload ?? null;
  if (!payload && row.queuedPayloadJson) {
    try {
      payload = JSON.parse(row.queuedPayloadJson);
    } catch {
      return { items: [], invalid: true };
    }
  }
  if (!isRecord(payload)) return { items: [], invalid: true };
  if (payload.version === 2 && Array.isArray(payload.items)) {
    return { items: payload.items, invalid: false };
  }
  return { items: [payload], invalid: false };
}

function normalizeSessionCreatedAtMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const ms = Date.parse(value);
    if (Number.isFinite(ms)) return ms;
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.getTime();
  }
  return undefined;
}

function normalizeQueuePayload(row, payload) {
  if (
    !isRecord(payload)
    || typeof payload.command !== 'string'
    || !isRecord(payload.options)
  ) {
    return null;
  }
  const acceptedInputRef = isAcceptedInputRef(payload.acceptedInputRef)
    ? payload.acceptedInputRef
    : undefined;
  const transcriptRelPath = typeof row.transcriptRelPath === 'string'
    && isSafeTranscriptRelPath(row.transcriptRelPath)
    ? row.transcriptRelPath
    : undefined;
  return {
    itemId: typeof payload.itemId === 'string' && payload.itemId.trim()
      ? payload.itemId.trim()
      : acceptedInputRef?.entryId ?? `${row.sessionId}:legacy`,
    sessionKey: row.sessionId,
    tenantId: row.tenantId,
    userId: row.userId,
    role: typeof payload.role === 'string' ? payload.role : null,
    command: payload.command,
    options: buildAllowedQueueOptions(row.sessionId, payload.options),
    providerHint: typeof payload.providerHint === 'string'
      ? payload.providerHint
      : 'pilotdeck',
    enqueuedAt: typeof payload.enqueuedAt === 'number'
      ? payload.enqueuedAt
      : Date.now(),
    sessionCreatedAtMs: normalizeSessionCreatedAtMs(
      payload.sessionCreatedAtMs ?? row.createdAt,
    ),
    acceptedInputRef,
    acceptedInputFingerprint: typeof payload.acceptedInputFingerprint === 'string'
      ? payload.acceptedInputFingerprint
      : undefined,
    acceptedInputAttachmentDescriptors: Array.isArray(payload.acceptedInputAttachmentDescriptors)
      ? payload.acceptedInputAttachmentDescriptors
      : undefined,
    transcriptRelPath,
    clientIdempotencyKey: normalizeStableString(payload.clientIdempotencyKey, 256),
    retryCount: normalizeNonNegativeInteger(payload.retryCount),
    retryAvailableAt: normalizePositiveNumber(payload.retryAvailableAt),
    retryExhausted: payload.retryExhausted === true,
  };
}

const QUEUE_OPTION_ALLOWLIST = [
  'projectPath',
  'cwd',
  'projectName',
  'project',
  'workspaceCwd',
  'images',
  'attachments',
  'permissionMode',
  'mode',
  'basePermissionMode',
  'capabilityContext',
  'promptLanguage',
  'remember',
  'reason',
  'resumeKind',
  'isBackgroundTask',
];

export function buildAllowedQueueOptions(sessionId, source) {
  const options = {
    sessionId,
    sessionKey: sessionId,
  };
  for (const key of QUEUE_OPTION_ALLOWLIST) {
    const value = normalizeQueueOption(key, source[key]);
    if (value !== undefined) options[key] = value;
  }
  return options;
}

function normalizeQueueOption(key, value) {
  switch (key) {
    case 'projectPath':
    case 'cwd':
    case 'projectName':
    case 'project':
    case 'workspaceCwd':
    case 'permissionMode':
    case 'mode':
    case 'basePermissionMode':
    case 'promptLanguage':
    case 'reason':
    case 'resumeKind':
      return normalizeStableString(value, 8_192);
    case 'remember':
    case 'isBackgroundTask':
      return typeof value === 'boolean' ? value : undefined;
    case 'images':
      return normalizeAttachmentOptions(value, true);
    case 'attachments':
      return normalizeAttachmentOptions(value, false);
    case 'capabilityContext':
      return normalizeCapabilityContext(value);
    default:
      return undefined;
  }
}

function normalizeAttachmentOptions(value, image) {
  if (!Array.isArray(value)) return undefined;
  return value.slice(0, 10).flatMap((attachment) => {
    if (!isRecord(attachment)) return [];
    const normalized = {};
    const name = normalizeStableString(attachment.name, 1_024);
    const mimeType = normalizeStableString(attachment.mimeType, 256);
    const filePath = normalizeStableString(attachment.path, 8_192);
    const data = image ? normalizeStableString(attachment.data, 30 * 1024 * 1024) : undefined;
    const metadata = isRecord(attachment.metadata) ? attachment.metadata : null;
    const hash = normalizeStableString(
      attachment.sha256 ?? attachment.hash ?? metadata?.sha256 ?? metadata?.hash,
      80,
    );
    if (name) normalized.name = name;
    if (mimeType) normalized.mimeType = mimeType;
    if (filePath) normalized.path = filePath;
    if (data) normalized.data = data;
    if (typeof attachment.size === 'number' && Number.isFinite(attachment.size) && attachment.size >= 0) {
      normalized.size = attachment.size;
    }
    if (hash) normalized.sha256 = hash;
    return [normalized];
  });
}

function normalizeCapabilityContext(value) {
  if (!isRecord(value)) return undefined;
  const slug = normalizeStableString(value.slug, 512);
  const displayName = normalizeStableString(value.displayName, 1_024);
  if (!slug || !displayName) return undefined;
  const normalized = { slug, displayName };
  for (const key of ['packMemberPrefix', 'majorCategory']) {
    const field = normalizeStableString(value[key], 512);
    if (field) normalized[key] = field;
  }
  return normalized;
}

function isSafeTranscriptRelPath(value) {
  const normalized = value.replace(/\\/g, '/').trim();
  return Boolean(
    normalized
    && !normalized.startsWith('/')
    && !/^[A-Za-z]:\//.test(normalized)
    && !normalized.split('/').includes('..')
    && normalized.startsWith('projects/')
    && normalized.includes('/chats/')
    && normalized.endsWith('.jsonl'),
  );
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeStableString(value, maxLength) {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : undefined;
}

function normalizeNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function normalizePositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function isAcceptedInputRef(value) {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === 4
    && keys[0] === 'createdAt'
    && keys[1] === 'entryId'
    && keys[2] === 'sequence'
    && keys[3] === 'turnId'
    && typeof value.entryId === 'string'
    && value.entryId.length > 0
    && typeof value.turnId === 'string'
    && value.turnId.length > 0
    && typeof value.sequence === 'number'
    && Number.isSafeInteger(value.sequence)
    && value.sequence > 0
    && typeof value.createdAt === 'string'
    && Number.isFinite(Date.parse(value.createdAt));
}
