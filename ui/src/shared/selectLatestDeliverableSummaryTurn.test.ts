import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../components/chat/types/types';
import {
  resolveValidationPolicyForMessage,
  selectLatestDeliverableSummaryTurn,
} from './selectLatestDeliverableSummaryTurn';

function assistant(id: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    type: 'assistant',
    id,
    timestamp: Date.now(),
    content: 'done',
    ...extra,
  };
}

function user(id: string, content = '帮我做 GEO 报告并交付 html 和 md'): ChatMessage {
  return { type: 'user', id, timestamp: Date.now(), content };
}

describe('selectLatestDeliverableSummaryTurn', () => {
  it('picks latest deliverable turn and marks earlier tables frozen', () => {
    const messages: ChatMessage[] = [
      user('u1'),
      assistant('a1', {
        turnAcceptanceMeta: {
          expectedManifest: [{ id: 'brief', kind: 'md', required: true }],
          verifiedPaths: ['artifacts/task1/brief.md'],
        },
        verifiedDeliverablePaths: ['artifacts/task1/brief.md'],
      }),
      user('u2'),
      assistant('a2', {
        turnAcceptanceMeta: {
          expectedManifest: [{ id: 'report', kind: 'html', required: true }],
          verifiedPaths: ['artifacts/task2/index.html'],
        },
        verifiedDeliverablePaths: ['artifacts/task2/index.html'],
      }),
    ];

    const latest = selectLatestDeliverableSummaryTurn({
      messages,
      projectRoot: '/proj',
      hasMoreMessages: false,
    });

    expect(latest.messageId).toBe('a2');
    expect(resolveValidationPolicyForMessage('a2', latest)).toBe('active');
    expect(resolveValidationPolicyForMessage('a1', latest)).toBe('frozen');
  });

  it('anchors repair turn while streaming (candidate without mount hide)', () => {
    const messages: ChatMessage[] = [
      user('u1'),
      assistant('a1', {
        isStreaming: true,
        turnAcceptanceMeta: {
          expectedManifest: [{ id: 'deck', kind: 'png', count: 6, required: true }],
          verifiedPaths: ['artifacts/slides/slide-01.png'],
          missingPaths: ['artifacts/slides/slide-02.png'],
          continuationOwner: 'deliverable_repair',
        },
      }),
    ];

    const latest = selectLatestDeliverableSummaryTurn({
      messages,
      projectRoot: '/proj',
      hasMoreMessages: false,
    });

    expect(latest.messageId).toBe('a1');
    expect(resolveValidationPolicyForMessage('a1', latest)).toBe('active');
  });
});
