// PD-SAAS-FORK: Hub「试一下」在已有对话中续用 vs 新建对话
import type { CapabilityBindingContext } from './capabilityBinding';
import { injectCapabilityPrompt } from './capabilityPromptInjection';
import { maybeOpenLaunchSheet } from './launchSheetBridge';
import { dispatchOpenPreflightStudio, resolvePreflightRouting } from './preflightStudioBridge';

export type CapabilityTryHost = {
  hasActiveConversation: () => boolean;
  /** 空对话 / 欢迎态：直接把模板预填进输入框 */
  applyPrompt: (prompt: string) => void;
  /** 已有对话：预填并 @ 引用本回合成果（按能力过滤，见 capabilityTryReferences） */
  applyWithDeliverableReferences: (prompt: string, capability?: CapabilityBindingContext) => void;
  focusComposer: () => void;
};

let host: CapabilityTryHost | null = null;

export function registerCapabilityTryHost(next: CapabilityTryHost | null): void {
  host = next;
}

export type CapabilityTryHandlers = {
  onNeedNewSession?: () => void;
  onSwitchToChat?: () => void;
};

/** PD-SAAS-FORK: N2 Bot overlay capture — only while same-tab HUD overlay is open. */
let n2OverlayCapture: ((prompt: string, capability?: CapabilityBindingContext) => boolean) | null = null;

export function registerN2BotOverlayCapabilityCapture(
  next: ((prompt: string, capability?: CapabilityBindingContext) => boolean) | null,
): void {
  n2OverlayCapture = next;
}

/**
 * 能力/流程「试一下」统一入口：对话页已挂载时直接预填输入框；
 * 仅当 host 未注册（如纯能力中心页）时才走新建对话兜底。
 */
export function requestCapabilityTry(
  prompt: string,
  capability?: CapabilityBindingContext,
  handlers?: CapabilityTryHandlers,
): void {
  const trimmed = prompt.trim();
  if (!trimmed) return;

  if (n2OverlayCapture?.(trimmed, capability)) {
    return;
  }

  const continueInSession = Boolean(host?.hasActiveConversation());

  injectCapabilityPrompt(trimmed, capability, { deferComposerApply: Boolean(host) });

  if (host) {
    if (continueInSession) {
      host.applyWithDeliverableReferences(trimmed, capability);
    } else {
      host.applyPrompt(trimmed);
    }
    host.focusComposer();
    handlers?.onSwitchToChat?.();
    return;
  }

  handlers?.onSwitchToChat?.();
  handlers?.onNeedNewSession?.();
}

export type CapabilityLaunchInput = {
  slug: string;
  displayName: string;
  launchMode?: string;
  prompt: string;
  capability?: CapabilityBindingContext;
  handlers?: CapabilityTryHandlers;
  sessionHasArtifactForSlug?: boolean;
};

/** Hub「试一下」：registry 命中则开 LaunchSheet，否则走原 try。 */
export function requestCapabilityLaunch(input: CapabilityLaunchInput): void {
  const trimmed = input.prompt.trim();
  if (!trimmed || !input.capability) {
    requestCapabilityTry(trimmed, input.capability, input.handlers);
    return;
  }

  const routing = resolvePreflightRouting({
    slug: input.slug,
    launchMode: input.launchMode,
    sessionHasArtifactForSlug: input.sessionHasArtifactForSlug,
  });

  if (routing.openPreflight) {
    dispatchOpenPreflightStudio({
      slug: input.slug,
      displayName: input.displayName,
      fallbackPrompt: trimmed,
    });
    return;
  }

  const opened = routing.openSheet && maybeOpenLaunchSheet({
    slug: input.slug,
    displayName: input.displayName,
    launchMode: input.launchMode,
    fallbackPrompt: trimmed,
    capability: input.capability,
    handlers: input.handlers,
    sessionHasArtifactForSlug: input.sessionHasArtifactForSlug,
  });

  if (!opened) {
    requestCapabilityTry(trimmed, input.capability, input.handlers);
  }
}
