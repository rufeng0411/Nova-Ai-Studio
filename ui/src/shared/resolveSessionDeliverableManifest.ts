/**
 * PD-SAAS-FORK: Goal Loop Phase 3 — resolve current session deliverable manifest from chat messages.
 */
import type { ChatMessage } from '../components/chat/types/types';
import type { ExpectedManifestEntry } from './buildDeliverableSummaryRows';
import type { DeliverableItem } from './collectDeliverables';
import { sanitizePollutedPathHints } from '../../../src/saas/deliverables/deliverablePathHintSanitize.js';
import { slotSatisfiedByValidation } from '../../../src/saas/deliverables/sdmSlotMatching';
import {
  resolveSessionDeliverableContract,
} from './resolveSessionDeliverableContract';

export type SessionDeliverableSlotUi = {
  id: string;
  label: string;
  kind?: string;
  required?: boolean;
  count?: number;
  pathHint?: string;
  pathHints?: string[];
  stageId?: string;
  stageOrder?: number;
  status?: 'pending' | 'active' | 'done' | 'removed';
  resolvedPath?: string;
};

export type SessionDeliverableManifestUi = {
  manifestVersion: number;
  goalVersion: number;
  sessionGoalAnchor: string;
  slots: SessionDeliverableSlotUi[];
  profileId?: string;
  capabilitySlug?: string;
  compiledAtTurnId?: string;
  currentStageId?: string;
  /** PD-SAAS-FORK STDA: current frozen contract scope. */
  taskArtifactDir?: string;
  taskDirKey?: string;
};

function isValidManifest(raw: unknown): SessionDeliverableManifestUi | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const manifest = raw as SessionDeliverableManifestUi;
  if (!Array.isArray(manifest.slots) || manifest.slots.length === 0) return undefined;
  return manifest;
}

function readManifestFromPayload(payload: unknown): SessionDeliverableManifestUi | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  return isValidManifest((payload as Record<string, unknown>).sessionDeliverableManifest);
}

function readManifestFromMessage(message: ChatMessage): SessionDeliverableManifestUi | undefined {
  const flat = isValidManifest(
    (message as Record<string, unknown>).sessionDeliverableManifest,
  );
  if (flat) return flat;
  const fromPayload = readManifestFromPayload(message.payload);
  if (fromPayload) return fromPayload;
  return readManifestFromPayload(
    message.metadata && typeof message.metadata === 'object'
      ? { sessionDeliverableManifest: (message.metadata as Record<string, unknown>).sessionDeliverableManifest }
      : undefined,
  );
}

export function resolveCurrentSessionManifest(
  messages: ChatMessage[],
): SessionDeliverableManifestUi | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const manifest = readManifestFromMessage(messages[i]);
    if (manifest) return manifest;
  }
  return undefined;
}

/** First SDM snapshot in the session — frozen baseline for slot count/labels at task start. */
export function resolveInitialSessionManifest(
  messages: ChatMessage[],
): SessionDeliverableManifestUi | undefined {
  for (let i = 0; i < messages.length; i += 1) {
    const manifest = readManifestFromMessage(messages[i]);
    if (manifest) return manifest;
  }
  return undefined;
}

export function shouldLockDeliverableBaseline(
  manifest: SessionDeliverableManifestUi | undefined,
): boolean {
  if (!manifest?.slots?.length) return false;
  if (manifest.slots.some((slot) => slot.stageId)) return true;
  return manifest.slots.length >= 2;
}

function sanitizeManifestSlots(
  manifest: SessionDeliverableManifestUi | undefined,
): SessionDeliverableManifestUi | undefined {
  if (!manifest?.slots?.length) return manifest;
  return {
    ...manifest,
    slots: sanitizePollutedPathHints(manifest.slots as Parameters<typeof sanitizePollutedPathHints>[0]),
  };
}

/** Frozen baseline: initial compile, unless user explicitly bumped goalVersion (add/replace). */
export function resolveFrozenSessionManifest(
  messages: ChatMessage[],
): SessionDeliverableManifestUi | undefined {
  const initial = resolveInitialSessionManifest(messages);
  const latest = resolveCurrentSessionManifest(messages);
  if (!initial) return sanitizeManifestSlots(latest);
  if (!latest) return sanitizeManifestSlots(initial);
  if ((latest.goalVersion ?? 1) > (initial.goalVersion ?? 1)) {
    return sanitizeManifestSlots(latest);
  }
  return sanitizeManifestSlots(initial);
}

export function sessionManifestToExpectedEntries(
  manifest: SessionDeliverableManifestUi | undefined,
): ExpectedManifestEntry[] | undefined {
  if (!manifest?.slots?.length) return undefined;
  return manifest.slots
    .filter((slot) => slot.status !== 'removed')
    .map((slot) => ({
      id: slot.id,
      label: slot.label,
      kind: slot.kind,
      path: slot.pathHint,
      pathHints: slot.pathHints,
      status: slot.status,
      count: slot.count,
      required: slot.required,
    })) as ExpectedManifestEntry[];
}

/** Count deliverable slots for progress denominator (expands SDM `count` fields). */
export function countActiveDeliverableSlots(
  manifest?: SessionDeliverableManifestUi,
  expectedEntries?: ExpectedManifestEntry[] | null,
): number {
  if (manifest?.slots?.length) {
    return manifest.slots
      .filter((slot) => slot.status !== 'removed' && slot.required !== false)
      .reduce((sum, slot) => sum + (typeof slot.count === 'number' && slot.count > 0 ? slot.count : 1), 0);
  }
  if (expectedEntries?.length) {
    return expectedEntries.reduce(
      (sum, entry) => sum + (typeof entry.count === 'number' && entry.count > 0 ? entry.count : 1),
      0,
    );
  }
  return 0;
}

/**
 * Dock / composer chrome authoritative expected manifest — session SDM slots win over
 * per-turn partial expectedManifest so the deliverable count stays stable from task start.
 * Falls back to the largest expected manifest seen in the session (accumulation baseline).
 */
export function resolveDockExpectedManifest(input: {
  messages: ChatMessage[];
  sessionManifest?: SessionDeliverableManifestUi;
  sessionDeliverables?: DeliverableItem[];
  sessionVerifiedPaths?: string[];
}): ExpectedManifestEntry[] | undefined {
  const contract = resolveSessionDeliverableContract(input);
  return contract.expectedEntries.length > 0 ? contract.expectedEntries : undefined;
}

export {
  resolveDeliverableSummaryExpectedManifest,
} from './resolveSessionDeliverableContract';

export function computeSdmProgressUi(
  manifest: SessionDeliverableManifestUi | undefined,
  verifiedPaths: string[] = [],
): { done: number; total: number; currentLabel?: string } {
  if (!manifest?.slots?.length) return { done: 0, total: 0 };
  const active = manifest.slots.filter((s) => s.status !== 'removed' && s.required !== false);
  const total = countActiveDeliverableSlots(manifest);
  let done = 0;
  let currentLabel: string | undefined;
  for (const slot of active) {
    if (slotSatisfiedByValidation(slot, verifiedPaths)) {
      done += typeof slot.count === 'number' && slot.count > 0 ? slot.count : 1;
    } else if (!currentLabel) {
      currentLabel = slot.label;
    }
  }
  return { done, total, currentLabel };
}
