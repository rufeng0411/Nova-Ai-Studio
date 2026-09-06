import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  adjustAssistantWorkingForInteractionMode,
  resolveEffectiveTurnInteractionMode,
  resolveLatestTurnInteractionModeFromMessages,
  shouldShowLiveProcessDock,
  shouldShowLiveToolProcessInDock,
  shouldSuppressSessionRepairUi,
} from './turnInteractionUiPolicy';

describe('turnInteractionUiPolicy', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_PILOTDECK_BINARY_INTENT_GATE', '1');
  });

  it('reads latest turn interaction mode from message payload', () => {
    const mode = resolveLatestTurnInteractionModeFromMessages([
      { payload: { turnInteractionMode: 'dialogue' } },
      { payload: { turnInteractionMode: 'execute' } },
    ]);
    expect(mode).toBe('execute');
  });

  it('shows live dock for dialogue turns but hides tool chrome', () => {
    expect(shouldShowLiveProcessDock({
      latestTurnInteractionMode: 'dialogue',
      isAssistantWorking: true,
    })).toBe(true);
    expect(shouldShowLiveToolProcessInDock('dialogue')).toBe(false);
    expect(shouldShowLiveToolProcessInDock('execute')).toBe(true);
  });

  it('suppresses repair chrome after dialogue turn', () => {
    expect(shouldSuppressSessionRepairUi('clarify')).toBe(true);
    expect(shouldSuppressSessionRepairUi('execute')).toBe(false);
  });

  it('keeps assistant working while dialogue turn is loading', () => {
    expect(adjustAssistantWorkingForInteractionMode({
      isAssistantWorking: true,
      latestTurnInteractionMode: 'dialogue',
      isLoading: true,
    })).toBe(true);
  });

  it('infers dialogue mode from greeting while turn is loading', () => {
    expect(resolveEffectiveTurnInteractionMode({
      messages: [{ type: 'user', content: '你好' }],
      isLoading: true,
    })).toBe('dialogue');
  });

  it('does not inherit dialogue mode from a previous turn', () => {
    expect(resolveEffectiveTurnInteractionMode({
      messages: [
        { type: 'user', content: '你好' },
        { type: 'assistant', payload: { turnInteractionMode: 'dialogue' } },
        { type: 'user', content: '帮我深度查询最新的ai agent趋势' },
      ],
      isLoading: true,
    })).toBe('execute');
  });

  it('shows live dock when current turn mode is execute', () => {
    expect(shouldShowLiveProcessDock({
      latestTurnInteractionMode: 'execute',
      isAssistantWorking: true,
    })).toBe(true);
  });
});
