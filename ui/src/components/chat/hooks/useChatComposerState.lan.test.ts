// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  isComposerSocketReady,
  useChatComposerState,
} from './useChatComposerState';

vi.mock('../../../contexts/WebSocketContext', () => ({
  useWebSocket: () => ({
    isConnected: false,
    ws: { readyState: WebSocket.CLOSED },
    sendMessage: vi.fn(),
  }),
}));

vi.mock('../../../utils/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/api')>();
  return {
    ...actual,
    authenticatedFetch: vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ commands: [] }),
    }),
  };
});

function makeArgs() {
  return {
    selectedProject: { name: 'general', path: '/p/general', fullPath: '/p/general' },
    selectedSession: null,
    currentSessionId: null,
    model: 'test-model',
    permissionMode: 'default',
    cycleRunMode: vi.fn(),
    isLoading: false,
    canAbortSession: false,
    tokenBudget: null,
    sendMessage: vi.fn(),
    pendingViewSessionRef: { current: null },
    scrollToBottom: vi.fn(),
    addMessage: vi.fn(),
    clearMessages: vi.fn(),
    rewindMessages: vi.fn(),
    setIsLoading: vi.fn(),
    setCanAbortSession: vi.fn(),
    setIsAborting: vi.fn(),
    setClaudeStatus: vi.fn(),
    setPilotDeckStatus: vi.fn(),
    setIsUserScrolledUp: vi.fn(),
    pendingPermissionRequests: [],
    setPendingPermissionRequests: vi.fn(),
  };
}

describe('useChatComposerState LAN guards', () => {
  it('isComposerSocketReady is false when disconnected', () => {
    expect(isComposerSocketReady(false, WebSocket.CLOSED)).toBe(false);
    expect(isComposerSocketReady(false, WebSocket.CONNECTING)).toBe(false);
    expect(isComposerSocketReady(true, WebSocket.CLOSED)).toBe(true);
    expect(isComposerSocketReady(false, WebSocket.OPEN)).toBe(true);
  });

  it('does not set loading when websocket is not ready', async () => {
    const args = makeArgs();
    const { result } = renderHook(() => useChatComposerState(args as never));

    act(() => {
      result.current.setInput('局域网连通性测试');
    });

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: () => undefined,
      } as never);
    });

    expect(args.setIsLoading).not.toHaveBeenCalled();
    expect(args.addMessage).toHaveBeenCalled();
    expect(args.sendMessage).not.toHaveBeenCalled();
  });
});
