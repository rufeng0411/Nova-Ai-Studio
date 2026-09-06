/** PD-SAAS-FORK: capability selected from Hub "试一下" — carried to first turn only. */
import { resolveLaunchModeForSlug } from './launchRouting';

export type CapabilityBindingContext = {
  slug: string;
  displayName: string;
  /** Hub pack member slug prefix, e.g. mkt-brand- */
  packMemberPrefix?: string;
  /** Client-only: creation launcher mode from catalog (not sent to gateway). */
  launchMode?: string;
  /** brainstorming / marketing / … — sent to gateway for chat-first binding */
  majorCategory?: string;
  /** PD-SAAS-FORK workbench yield: hub try vs free-text infer (hub never overwritten). */
  source?: 'hub' | 'inferred';
};

export type CapabilityPromptPayload = {
  prompt: string;
  capability: CapabilityBindingContext;
};

export function buildCapabilityBindingFromItem(item: {
  slug: string;
  display_name?: string;
  hub_pack?: boolean;
  pack_member_prefix?: string;
  launch_mode?: string;
  major_category?: string;
}, localizedDisplayName?: string): CapabilityBindingContext {
  const launchMode = resolveLaunchModeForSlug(item.slug, item.launch_mode);
  return {
    slug: item.slug,
    displayName: (localizedDisplayName || item.display_name || item.slug).trim(),
    source: 'hub',
    ...(item.hub_pack && item.pack_member_prefix?.trim()
      ? { packMemberPrefix: item.pack_member_prefix.trim() }
      : {}),
    ...(launchMode !== 'skip' ? { launchMode } : {}),
    ...(item.major_category?.trim()
      ? { majorCategory: item.major_category.trim() }
      : {}),
  };
}

export function isCapabilityPromptPayload(value: unknown): value is CapabilityPromptPayload {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (typeof record.prompt !== 'string' || !record.prompt.trim()) return false;
  const cap = record.capability;
  if (!cap || typeof cap !== 'object') return false;
  const c = cap as Record<string, unknown>;
  return typeof c.slug === 'string' && c.slug.trim().length > 0
    && typeof c.displayName === 'string' && c.displayName.trim().length > 0;
}
