/**
 * PD-SAAS-FORK: Session-level deliverable contract — single kernel for Dock, summary (latest), and composer badge.
 */
import type { ChatMessage } from '../components/chat/types/types';
import type { ExpectedManifestEntry } from './buildDeliverableSummaryRows';
import type { DeliverableItem } from './collectDeliverables';
import { extractDeliverablePathsFromText } from './artifactPaths';
import {
  accumulateDockExpectedManifest,
} from './accumulateDockExpectedManifest';
import {
  countActiveDeliverableSlots,
  resolveCurrentSessionManifest,
  resolveInitialSessionManifest,
  resolveFrozenSessionManifest,
  sessionManifestToExpectedEntries,
  shouldLockDeliverableBaseline,
  type SessionDeliverableManifestUi,
} from './resolveSessionDeliverableManifest';
import type { SanitizedTurnAcceptanceMeta } from './turnAcceptanceMeta';
import { extractTurnAcceptanceMeta } from './turnAcceptanceMeta';

export type SessionDeliverableContract = {
  expectedEntries: ExpectedManifestEntry[];
  totalSlots: number;
  sessionManifest?: SessionDeliverableManifestUi;
};

function readManifestFromPayload(payload: unknown): SessionDeliverableManifestUi | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const raw = (payload as Record<string, unknown>).sessionDeliverableManifest;
  if (!raw || typeof raw !== 'object') return undefined;
  const manifest = raw as SessionDeliverableManifestUi;
  if (!Array.isArray(manifest.slots) || manifest.slots.length === 0) return undefined;
  return manifest;
}

function itemKindFromPath(path: string): DeliverableItem['kind'] {
  const ext = path.split('/').pop()?.split('.').pop()?.toLowerCase() ?? '';
  if (['md', 'markdown'].includes(ext)) return 'document';
  if (['html', 'htm'].includes(ext)) return 'html';
  if (ext === 'pdf') return 'pdf';
  if (['pptx', 'ppt'].includes(ext)) return 'presentation';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  return 'file';
}

/** I1-bis: when SDM baseline exists, only engine verified paths may add contract rows. */
function collectBodyPathDeliverables(
  messages: ChatMessage[],
  hasAuthoritativeBaseline: boolean,
): DeliverableItem[] {
  if (hasAuthoritativeBaseline) return [];
  const seen = new Set<string>();
  const items: DeliverableItem[] = [];
  for (const message of messages) {
    if (message.type !== 'assistant' && message.type !== 'user') continue;
    if (message.isThinking) continue;
    for (const raw of extractDeliverablePathsFromText(String(message.content ?? ''))) {
      const path = raw.replace(/\\/g, '/').trim();
      const key = path.toLowerCase();
      if (!path || seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: `body:${key}`,
        path,
        apiPath: path,
        kind: itemKindFromPath(path),
        source: 'text',
      });
    }
  }
  return items;
}

function resolveBaselineExpectedEntries(input: {
  messages: ChatMessage[];
  sessionManifest?: SessionDeliverableManifestUi;
}): ExpectedManifestEntry[] | undefined {
  // Caller passes resolveFrozenSessionManifest — authoritative baseline (initial, or latest after goalVersion bump).
  const fromFrozen = sessionManifestToExpectedEntries(input.sessionManifest);
  if (fromFrozen?.length) return fromFrozen;

  const initial = resolveInitialSessionManifest(input.messages);
  if (initial?.slots?.length) {
    return sessionManifestToExpectedEntries(initial);
  }

  let best: ExpectedManifestEntry[] | undefined;
  let bestCount = 0;

  for (const message of input.messages) {
    const payloadManifest = readManifestFromPayload(message.payload)
      ?? readManifestFromPayload(message.metadata);
    const flatManifest = message.sessionDeliverableManifest as SessionDeliverableManifestUi | undefined;
    const manifest = flatManifest?.slots?.length ? flatManifest : payloadManifest;
    if (manifest) {
      const entries = sessionManifestToExpectedEntries(manifest);
      const count = countActiveDeliverableSlots(manifest, entries);
      if (count > bestCount) {
        bestCount = count;
        best = entries;
      }
    }

    if (message.type !== 'assistant') continue;

    const meta = extractTurnAcceptanceMeta(message);
    const turnExpected = meta?.expectedManifest as ExpectedManifestEntry[] | undefined;
    if (turnExpected?.length) {
      const count = countActiveDeliverableSlots(undefined, turnExpected);
      if (count > bestCount) {
        bestCount = count;
        best = turnExpected;
      }
    }

    const flatExpected = Array.isArray((message as Record<string, unknown>).expectedManifest)
      ? (message as Record<string, unknown>).expectedManifest as ExpectedManifestEntry[]
      : undefined;
    if (flatExpected?.length) {
      const count = countActiveDeliverableSlots(undefined, flatExpected);
      if (count > bestCount) {
        bestCount = count;
        best = flatExpected;
      }
    }
  }

  return best;
}

export function resolveSessionDeliverableContract(input: {
  messages: ChatMessage[];
  sessionManifest?: SessionDeliverableManifestUi;
  /** @deprecated I1-bis: ignored — use verified + body paths only for row expansion. */
  sessionDeliverables?: DeliverableItem[];
  sessionVerifiedPaths?: string[];
}): SessionDeliverableContract {
  const sessionManifest = input.sessionManifest ?? resolveCurrentSessionManifest(input.messages);
  const frozenManifest = resolveFrozenSessionManifest(input.messages) ?? sessionManifest;
  const base = resolveBaselineExpectedEntries({ messages: input.messages, sessionManifest: frozenManifest });
  const lockBaseline = shouldLockDeliverableBaseline(frozenManifest);
  const hasAuthoritativeBaseline = countActiveDeliverableSlots(frozenManifest, base) > 0;
  const bodyPathItems = collectBodyPathDeliverables(input.messages, hasAuthoritativeBaseline);
  const accumulated = accumulateDockExpectedManifest(
    base,
    bodyPathItems,
    input.sessionVerifiedPaths ?? [],
    { lockBaseline },
  );
  const expectedEntries = accumulated.length > 0 ? accumulated : [];
  const totalSlots = lockBaseline
    ? countActiveDeliverableSlots(frozenManifest)
    : Math.max(
      countActiveDeliverableSlots(sessionManifest),
      countActiveDeliverableSlots(undefined, expectedEntries),
    );

  return {
    expectedEntries,
    totalSlots,
    sessionManifest,
  };
}

/**
 * Latest-turn summary manifest: session contract wins over per-turn partial expectedManifest.
 * Historical turns must call resolveDeliverableSummaryExpectedManifest instead.
 */
export function resolveLatestDeliverableSummaryManifest(input: {
  messages: ChatMessage[];
  sessionManifest?: SessionDeliverableManifestUi;
  sessionDeliverables?: DeliverableItem[];
  sessionVerifiedPaths?: string[];
}): ExpectedManifestEntry[] | undefined {
  const contract = resolveSessionDeliverableContract(input);
  return contract.expectedEntries.length > 0 ? contract.expectedEntries : undefined;
}

export type ResolveDeliverableSummaryExpectedManifestOptions = {
  turnMeta: SanitizedTurnAcceptanceMeta | null;
  sessionManifest?: SessionDeliverableManifestUi;
  isLatestAssistantInSession: boolean;
  /** Required when isLatestAssistantInSession — full session context for contract. */
  messages?: ChatMessage[];
  sessionDeliverables?: DeliverableItem[];
  sessionVerifiedPaths?: string[];
};

function turnHasAcceptancePathMeta(meta: SanitizedTurnAcceptanceMeta | null | undefined): boolean {
  if (!meta) return false;
  return (
    (meta.verifiedPaths?.length ?? 0) > 0
    || (meta.missingPaths?.length ?? 0) > 0
    || (meta.brokenPaths?.length ?? 0) > 0
  );
}

/**
 * Per-turn engine manifest for frozen historical rows; latest turn uses session contract.
 */
export function resolveDeliverableSummaryExpectedManifest(
  options: ResolveDeliverableSummaryExpectedManifestOptions,
): ExpectedManifestEntry[] | undefined {
  if (options.isLatestAssistantInSession && options.messages?.length) {
    return resolveLatestDeliverableSummaryManifest({
      messages: options.messages,
      sessionManifest: options.sessionManifest,
      sessionDeliverables: options.sessionDeliverables,
      sessionVerifiedPaths: options.sessionVerifiedPaths,
    });
  }

  const turnExpected = options.turnMeta?.expectedManifest;
  if (Array.isArray(turnExpected) && turnExpected.length > 0) {
    return turnExpected as ExpectedManifestEntry[];
  }
  if (turnHasAcceptancePathMeta(options.turnMeta)) {
    return undefined;
  }
  if (!options.isLatestAssistantInSession) {
    return undefined;
  }
  return sessionManifestToExpectedEntries(options.sessionManifest);
}
