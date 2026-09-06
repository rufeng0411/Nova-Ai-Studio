// PD-SAAS-FORK: Preflight Studio write gate + slot status
import type { SessionDeliverableSlot } from '../taskState/sessionDeliverableManifest.js';
import { isPreflightStudioEnabled } from './preflightFlags.js';

export type PreflightSlotStatus = 'none' | 'awaiting' | 'resolved' | 'skipped';

export type PreflightResolved = {
  catalogId: string;
  surface?: string;
  canvas?: string;
  mode?: string;
  style?: string;
  confirmedAt: string;
};

export function slotNeedsPreflight(slot: SessionDeliverableSlot): boolean {
  return Boolean(slot.needsPreflight);
}

export function slotPreflightAwaiting(slot: SessionDeliverableSlot): boolean {
  if (!isPreflightStudioEnabled()) return false;
  if (!slotNeedsPreflight(slot)) return false;
  const status = slot.preflightStatus ?? 'none';
  return status === 'awaiting' || (status === 'none' && !slot.preflightResolved);
}

export function shouldBlockWriteForPreflight(slot: SessionDeliverableSlot): boolean {
  if (!isPreflightStudioEnabled()) return false;
  if (!slotNeedsPreflight(slot)) return false;
  const status = slot.preflightStatus ?? 'none';
  if (status === 'resolved' || status === 'skipped') return false;
  if (slot.preflightResolved?.catalogId) return false;
  return true;
}

export function markSlotPreflightAwaiting(
  slot: SessionDeliverableSlot,
  profileRef: string,
): SessionDeliverableSlot {
  return {
    ...slot,
    needsPreflight: true,
    preflightProfileRef: profileRef,
    preflightStatus: 'awaiting',
  };
}

export function resolveSlotPreflight(
  slot: SessionDeliverableSlot,
  resolved: PreflightResolved,
): SessionDeliverableSlot {
  return {
    ...slot,
    preflightStatus: 'resolved',
    preflightResolved: resolved,
  };
}

export function skipSlotPreflight(slot: SessionDeliverableSlot, catalogId: string): SessionDeliverableSlot {
  return {
    ...slot,
    preflightStatus: 'skipped',
    preflightResolved: {
      catalogId,
      confirmedAt: new Date().toISOString(),
    },
  };
}

export function anySlotAwaitingPreflight(slots: SessionDeliverableSlot[]): boolean {
  return slots.some((s) => slotPreflightAwaiting(s));
}

export function inferPreflightProfileForSlug(slug?: string): string | undefined {
  if (!slug) return undefined;
  if (slug === 'open-design' || slug.startsWith('od-')) return 'open-design';
  if (slug === 'ppt-master' || slug.includes('ppt')) return 'ppt-master';
  return undefined;
}
