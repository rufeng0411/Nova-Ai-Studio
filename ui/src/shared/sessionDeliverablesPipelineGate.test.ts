import { describe, expect, it } from 'vitest';
import {
  resolveSessionSwitchDeferMs,
  shouldRunSessionDeliverablesPipeline,
} from './sessionDeliverablesPipelineGate';

describe('resolveSessionSwitchDeferMs', () => {
  it('defaults to 300ms', () => {
    expect(resolveSessionSwitchDeferMs()).toBe(300);
  });

  it('clamps below minimum to 150', () => {
    const prev = import.meta.env.VITE_SESSION_SWITCH_DEFER_MS;
    import.meta.env.VITE_SESSION_SWITCH_DEFER_MS = '50';
    expect(resolveSessionSwitchDeferMs()).toBe(150);
    import.meta.env.VITE_SESSION_SWITCH_DEFER_MS = prev;
  });

  it('clamps above maximum to 800', () => {
    const prev = import.meta.env.VITE_SESSION_SWITCH_DEFER_MS;
    import.meta.env.VITE_SESSION_SWITCH_DEFER_MS = '1200';
    expect(resolveSessionSwitchDeferMs()).toBe(800);
    import.meta.env.VITE_SESSION_SWITCH_DEFER_MS = prev;
  });
});

describe('shouldRunSessionDeliverablesPipeline', () => {
  it('defers when assistant work is in flight', () => {
    expect(shouldRunSessionDeliverablesPipeline({
      pipelineReady: true,
      isLoadingSessionMessages: false,
      messageCount: 12,
      deferWhileAssistantWorking: true,
      isAssistantWorking: true,
    })).toBe(false);
  });

  it('runs when defer gate is off', () => {
    expect(shouldRunSessionDeliverablesPipeline({
      pipelineReady: true,
      isLoadingSessionMessages: false,
      messageCount: 12,
      deferWhileAssistantWorking: false,
      isAssistantWorking: true,
    })).toBe(true);
  });

  it('waits for pipeline ready and first paint messages', () => {
    expect(shouldRunSessionDeliverablesPipeline({
      pipelineReady: false,
      isLoadingSessionMessages: true,
      messageCount: 0,
    })).toBe(false);
    expect(shouldRunSessionDeliverablesPipeline({
      pipelineReady: true,
      isLoadingSessionMessages: false,
      messageCount: 3,
    })).toBe(true);
  });
});
