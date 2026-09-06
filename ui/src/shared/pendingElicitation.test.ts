import { describe, expect, it } from 'vitest';
import type { NormalizedMessage } from '../stores/useSessionStore';
import {
 extractOutstandingElicitations,
 isMessageForActiveChatView,
 mergePendingPermissionRequests,
} from './pendingElicitation';

describe('pendingElicitation', () => {
  it('matches active view when gateway session id lands before sidebar placeholder swaps', () => {
    expect(isMessageForActiveChatView('sess-real', {
      currentSessionId: 'new-session-123',
      selectedSessionId: 'new-session-123',
      pendingViewSessionId: 'sess-real',
    })).toBe(true);
  });

  it('restores outstanding ask_user_question permission_request from transcript', () => {
    const messages: NormalizedMessage[] = [
      {
        id: 'tool-1',
        sessionId: 'sess-1',
        timestamp: '2026-06-11T10:00:00.000Z',
        provider: 'pilotdeck',
        kind: 'tool_use',
        toolName: 'ask_user_question',
        toolId: 'call-1',
        toolInput: {
          questions: [{ question: '公司名称？', header: '公司信息', options: [] }],
        },
      },
      {
        id: 'perm-1',
        sessionId: 'sess-1',
        timestamp: '2026-06-11T10:00:01.000Z',
        provider: 'pilotdeck',
        kind: 'permission_request',
        requestId: 'req-1',
        toolCallId: 'call-1',
        toolName: 'AskUserQuestion',
        input: {
          questions: [{ question: '公司名称？', header: '公司信息', options: [] }],
        },
        isElicitation: true,
      } as NormalizedMessage,
    ];

    const restored = extractOutstandingElicitations(messages, 'sess-1');
    expect(restored).toHaveLength(1);
    expect(restored[0]?.requestId).toBe('req-1');
    expect(restored[0]?.toolCallId).toBe('call-1');
  });

  it('does not restore elicitation after tool_result (including skip/error)', () => {
    const messages: NormalizedMessage[] = [
      {
        id: 'tool-1',
        sessionId: 'sess-1',
        timestamp: '2026-06-11T10:00:00.000Z',
        provider: 'pilotdeck',
        kind: 'tool_use',
        toolName: 'ask_user_question',
        toolId: 'call-1',
        toolInput: {
          questions: [{ question: '公司名称？', header: '公司信息', options: [] }],
        },
      },
      {
        id: 'perm-1',
        sessionId: 'sess-1',
        timestamp: '2026-06-11T10:00:01.000Z',
        provider: 'pilotdeck',
        kind: 'permission_request',
        requestId: 'req-1',
        toolCallId: 'wrong-turn-id',
        toolName: 'AskUserQuestion',
        input: {
          questions: [{ question: '公司名称？', header: '公司信息', options: [] }],
        },
        isElicitation: true,
      } as NormalizedMessage,
      {
        id: 'result-1',
        sessionId: 'sess-1',
        timestamp: '2026-06-11T10:00:02.000Z',
        provider: 'pilotdeck',
        kind: 'tool_result',
        toolId: 'call-1',
        content: 'User declined to answer questions (skipped)',
        isError: true,
      },
    ];

    expect(extractOutstandingElicitations(messages, 'sess-1')).toHaveLength(0);
  });

  it('resolves toolCallId from preceding ask_user_question tool_use when mismatched', () => {
    const messages: NormalizedMessage[] = [
      {
        id: 'tool-1',
        sessionId: 'sess-1',
        timestamp: '2026-06-11T10:00:00.000Z',
        provider: 'pilotdeck',
        kind: 'tool_use',
        toolName: 'ask_user_question',
        toolId: 'call-1',
        toolInput: {
          questions: [{ question: 'Pick one', options: [{ label: 'A', description: '' }] }],
        },
      },
      {
        id: 'perm-1',
        sessionId: 'sess-1',
        timestamp: '2026-06-11T10:00:01.000Z',
        provider: 'pilotdeck',
        kind: 'permission_request',
        requestId: 'req-1',
        toolCallId: 'turn-not-call',
        toolName: 'AskUserQuestion',
        input: {
          questions: [{ question: 'Pick one', options: [{ label: 'A', description: '' }] }],
        },
        isElicitation: true,
      } as NormalizedMessage,
    ];

    const restored = extractOutstandingElicitations(messages, 'sess-1');
    expect(restored).toHaveLength(1);
    expect(restored[0]?.toolCallId).toBe('call-1');
  });

  it('merges restored requests without duplicating live websocket state', () => {
    const merged = mergePendingPermissionRequests(
      [{ requestId: 'req-1', toolName: 'AskUserQuestion' }],
      [{ requestId: 'req-1', toolName: 'AskUserQuestion' }, { requestId: 'req-2', toolName: 'AskUserQuestion' }],
    );
    expect(merged).toHaveLength(2);
  });
});
