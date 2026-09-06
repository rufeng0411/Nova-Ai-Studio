import { afterEach, describe, expect, it, vi } from 'vitest';
// @vitest-environment jsdom

import {
  registerCapabilityTryHost,
  registerN2BotOverlayCapabilityCapture,
  requestCapabilityTry,
  type CapabilityTryHost,
} from './capabilityTryBridge';
import { CAPABILITY_PROMPT_STORAGE_KEY } from './capabilityPromptInjection';

describe('requestCapabilityTry', () => {
  afterEach(() => {
    registerCapabilityTryHost(null);
    registerN2BotOverlayCapabilityCapture(null);
    localStorage.removeItem(CAPABILITY_PROMPT_STORAGE_KEY);
  });

  it('uses applyPrompt on host when conversation is empty', () => {
    const applyPrompt = vi.fn();
    const applyWithDeliverableReferences = vi.fn();
    const focusComposer = vi.fn();
    const onNeedNewSession = vi.fn();

    const host: CapabilityTryHost = {
      hasActiveConversation: () => false,
      applyPrompt,
      applyWithDeliverableReferences,
      focusComposer,
    };
    registerCapabilityTryHost(host);

    requestCapabilityTry('流程模板提示词', undefined, {
      onNeedNewSession,
    });

    expect(applyPrompt).toHaveBeenCalledWith('流程模板提示词');
    expect(applyWithDeliverableReferences).not.toHaveBeenCalled();
    expect(focusComposer).toHaveBeenCalled();
    expect(onNeedNewSession).not.toHaveBeenCalled();
  });

  it('passes capability slug when continuing in session', () => {
    const applyPrompt = vi.fn();
    const applyWithDeliverableReferences = vi.fn();
    const focusComposer = vi.fn();
    const capability = { slug: 'nova-ppt-aesthetic-slides', displayName: 'Nova 美学幻灯' };

    registerCapabilityTryHost({
      hasActiveConversation: () => true,
      applyPrompt,
      applyWithDeliverableReferences,
      focusComposer,
    });

    requestCapabilityTry('做 4 页幻灯', capability);

    expect(applyWithDeliverableReferences).toHaveBeenCalledWith('做 4 页幻灯', capability);
    expect(applyPrompt).not.toHaveBeenCalled();
  });

  it('uses deliverable references when conversation already started', () => {
    const applyPrompt = vi.fn();
    const applyWithDeliverableReferences = vi.fn();
    const focusComposer = vi.fn();

    registerCapabilityTryHost({
      hasActiveConversation: () => true,
      applyPrompt,
      applyWithDeliverableReferences,
      focusComposer,
    });

    requestCapabilityTry('续写上一段', undefined);

    expect(applyWithDeliverableReferences).toHaveBeenCalledWith('续写上一段', undefined);
    expect(applyPrompt).not.toHaveBeenCalled();
    expect(focusComposer).toHaveBeenCalled();
  });

  it('falls back to onNeedNewSession when host is not mounted', () => {
    const onNeedNewSession = vi.fn();
    const onSwitchToChat = vi.fn();

    requestCapabilityTry('离线预填', undefined, {
      onNeedNewSession,
      onSwitchToChat,
    });

    expect(onSwitchToChat).toHaveBeenCalled();
    expect(onNeedNewSession).toHaveBeenCalled();
    expect(localStorage.getItem(CAPABILITY_PROMPT_STORAGE_KEY)).toBe('离线预填');
  });

  it('H2 overlay capture swallows try-prompt; H3 unregister restores host', () => {
    const applyPrompt = vi.fn();
    registerCapabilityTryHost({
      hasActiveConversation: () => false,
      applyPrompt,
      applyWithDeliverableReferences: vi.fn(),
      focusComposer: vi.fn(),
    });
    const captured = vi.fn(() => true);
    registerN2BotOverlayCapabilityCapture(captured);
    requestCapabilityTry('试一下周会', { slug: 'ppt-master', displayName: 'PPT' });
    expect(captured).toHaveBeenCalled();
    expect(applyPrompt).not.toHaveBeenCalled();

    registerN2BotOverlayCapabilityCapture(null);
    requestCapabilityTry('试一下周会', { slug: 'ppt-master', displayName: 'PPT' });
    expect(applyPrompt).toHaveBeenCalledTimes(1);
  });
});
