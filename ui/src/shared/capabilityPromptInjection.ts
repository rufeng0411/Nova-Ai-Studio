// PD-SAAS-FORK: Hub「试一下」待注入提示词与能力绑定上下文（localStorage + 事件）
import type { CapabilityBindingContext, CapabilityPromptPayload } from './capabilityBinding';

export const CAPABILITY_PROMPT_STORAGE_KEY = 'pilotdeck-capability-prompt';
export const CAPABILITY_CONTEXT_STORAGE_KEY = 'pilotdeck-capability-context';
export const CAPABILITY_PROMPT_EVENT = 'pilotdeck:capability-prompt';

/** 写入待注入提示词与能力绑定上下文，供已挂载的对话页即时填入输入框。 */
export function injectCapabilityPrompt(
  prompt: string,
  capability?: CapabilityBindingContext,
  options?: { deferComposerApply?: boolean },
): void {
  const trimmed = prompt.trim();
  if (!trimmed) return;
  localStorage.setItem(CAPABILITY_PROMPT_STORAGE_KEY, trimmed);
  if (capability?.slug) {
    localStorage.setItem(CAPABILITY_CONTEXT_STORAGE_KEY, JSON.stringify(capability));
  } else {
    localStorage.removeItem(CAPABILITY_CONTEXT_STORAGE_KEY);
  }
  if (options?.deferComposerApply) {
    return;
  }
  const detail: CapabilityPromptPayload = {
    prompt: trimmed,
    capability: capability ?? { slug: '', displayName: '' },
  };
  window.dispatchEvent(new CustomEvent(CAPABILITY_PROMPT_EVENT, { detail }));
}

export function readPendingCapabilityPrompt(): string | null {
  const value = localStorage.getItem(CAPABILITY_PROMPT_STORAGE_KEY);
  if (!value?.trim()) return null;
  return value.trim();
}

export function readPendingCapabilityContext(): CapabilityBindingContext | null {
  const raw = localStorage.getItem(CAPABILITY_CONTEXT_STORAGE_KEY);
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as CapabilityBindingContext;
    if (!parsed?.slug?.trim()) return null;
    return {
      slug: parsed.slug.trim(),
      displayName: (parsed.displayName || parsed.slug).trim(),
      ...(parsed.packMemberPrefix?.trim()
        ? { packMemberPrefix: parsed.packMemberPrefix.trim() }
        : {}),
    };
  } catch {
    return null;
  }
}

/** 清除输入框预填文本（保留能力绑定上下文直至首次发送）。 */
export function clearPendingCapabilityPrompt(): void {
  localStorage.removeItem(CAPABILITY_PROMPT_STORAGE_KEY);
}

export function clearPendingCapabilityContext(): void {
  localStorage.removeItem(CAPABILITY_CONTEXT_STORAGE_KEY);
}

export function clearAllPendingCapability(): void {
  clearPendingCapabilityPrompt();
  clearPendingCapabilityContext();
}
