// PD-SAAS-FORK: session-level Hub capability binding (persists across turns)

import type { CapabilityBindingContext } from './capabilityBinding';
import { readCapabilityHubCacheFingerprint } from './capabilityHubCache';
import {
  inferCapabilityContextFromUserText,
  resolveInferredCapabilityForTurn,
} from '../../../src/saas/deliverables/inferCapabilityContext';
import { inferCapabilityContextMode } from '../../../src/saas/resilience/stabilityFlags';

const STORAGE_PREFIX = 'pilotdeck:session-capability:';

function storageKey(sessionId: string): string {
  const fingerprint = readCapabilityHubCacheFingerprint();
  return `${STORAGE_PREFIX}${sessionId.trim()}:${fingerprint}`;
}

export function persistSessionCapability(
  sessionId: string,
  binding: CapabilityBindingContext,
): void {
  if (!sessionId?.trim() || !binding?.slug?.trim()) return;
  try {
    sessionStorage.setItem(storageKey(sessionId), JSON.stringify(binding));
  } catch {
    // ignore quota / private mode
  }
}

export function readSessionCapability(sessionId: string): CapabilityBindingContext | null {
  if (!sessionId?.trim()) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CapabilityBindingContext;
    if (!parsed?.slug?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSessionCapability(sessionId: string): void {
  if (!sessionId?.trim()) return;
  try {
    sessionStorage.removeItem(storageKey(sessionId));
  } catch {
    // ignore
  }
}

/** Clear only inferred bindings (Hub bindings stay). */
export function clearInferredSessionCapability(sessionId: string): void {
  const existing = readSessionCapability(sessionId);
  if (!existing) return;
  if (existing.source === 'inferred') {
    clearSessionCapability(sessionId);
  }
}

export function resolveCapabilityContextForSend(
  sessionId: string,
  pending: CapabilityBindingContext | null | undefined,
  userText?: string,
): CapabilityBindingContext | undefined {
  if (pending?.slug?.trim()) {
    const stored = readSessionCapability(sessionId);
    // Hub pending never loses to stored inferred
    const pendingWithSource: CapabilityBindingContext = {
      ...pending,
      source: pending.source ?? 'hub',
    };
    if (stored?.source === 'hub' && stored.slug === pendingWithSource.slug) {
      const merged: CapabilityBindingContext = {
        ...stored,
        ...pendingWithSource,
        slug: pendingWithSource.slug,
        source: 'hub',
      };
      persistSessionCapability(sessionId, merged);
      return merged;
    }
    // Never let inferred pending overwrite hub stored
    if (stored?.source === 'hub' && pendingWithSource.source === 'inferred') {
      return stored;
    }
    persistSessionCapability(sessionId, pendingWithSource);
    return pendingWithSource;
  }

  const text = String(userText ?? '').trim();
  const stored = readSessionCapability(sessionId);
  // Pivot / capability switch: drop inferred so a new high-conf match can bind
  if (stored?.source === 'inferred' && text) {
    const nextInfer = inferCapabilityContextFromUserText(text);
    if (nextInfer && nextInfer.slug !== stored.slug) {
      clearSessionCapability(sessionId);
    } else if (stored?.slug?.trim()) {
      return stored;
    }
  } else if (stored?.slug?.trim()) {
    return stored;
  }

  // PD-SAAS-FORK workbench yield P0-B: client-side high-confidence infer (enforce only)
  if (!text) return undefined;
  const mode = inferCapabilityContextMode();
  const result = resolveInferredCapabilityForTurn({
    userText: text,
    mode,
  });
  if (!result.apply || !result.inferred) {
    // shadow: do not persist; engine still records telemetry
    return undefined;
  }
  const inferred: CapabilityBindingContext = {
    slug: result.inferred.slug,
    displayName: result.inferred.displayName,
    ...(result.inferred.majorCategory
      ? { majorCategory: result.inferred.majorCategory }
      : {}),
    source: 'inferred',
  };
  persistSessionCapability(sessionId, inferred);
  return inferred;
}

export { inferCapabilityContextFromUserText };
