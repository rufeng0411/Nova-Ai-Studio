// PD-SAAS-FORK: pending launch context for first user message
import type { CapabilityBindingContext } from './capabilityBinding';

export const LAUNCH_CONTEXT_STORAGE_KEY = 'pilotdeck-launch-context';

export type LaunchCompileResult = {
  compiledPrompt: string;
  launchContext: string;
  capability?: CapabilityBindingContext;
};

export function storePendingLaunchContext(launchContext: string): void {
  const trimmed = launchContext.trim();
  if (!trimmed) {
    localStorage.removeItem(LAUNCH_CONTEXT_STORAGE_KEY);
    return;
  }
  localStorage.setItem(LAUNCH_CONTEXT_STORAGE_KEY, trimmed);
}

export function readPendingLaunchContext(): string | null {
  const raw = localStorage.getItem(LAUNCH_CONTEXT_STORAGE_KEY);
  if (!raw?.trim()) return null;
  return raw.trim();
}

export function clearPendingLaunchContext(): void {
  localStorage.removeItem(LAUNCH_CONTEXT_STORAGE_KEY);
}

/** Parse capability slug from stored `<launch-context capability="…">`. */
export function parseLaunchContextCapability(launchContext: string | null | undefined): string | null {
  if (!launchContext?.trim()) return null;
  const match = launchContext.match(/<launch-context\s+capability="([^"]+)"/i);
  return match?.[1]?.trim() ?? null;
}

/**
 * Drop stale pending launch-context when the user pivots to a different capability
 * (e.g. confirmed open-design then says「做个 ppt」).
 */
export function reconcilePendingLaunchContextForIntent(
  message: string,
  intentSlug: string | null,
): string | null {
  const pending = readPendingLaunchContext();
  if (!pending) return null;
  if (!intentSlug) return pending;
  const pendingCap = parseLaunchContextCapability(pending);
  if (pendingCap && pendingCap !== intentSlug) {
    clearPendingLaunchContext();
    return null;
  }
  return pending;
}

export function appendLaunchContextToMessage(message: string, launchContext: string | null): string {
  const base = message.trim();
  if (!launchContext?.trim()) return base;
  if (base.includes('<launch-context')) return base;
  return `${base}\n\n${launchContext.trim()}`;
}
