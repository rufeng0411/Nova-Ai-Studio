import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../components/chat/types/types';
import {
  dedupeConsecutiveUserMessages,
  hasEquivalentVisibleUserMessage,
  shouldHideUserFacingUserMessage,
} from './userMessageDisplayDedup';

describe('userMessageDisplayDedup', () => {
  it('hides task-resume infra user rows', () => {
    expect(
      shouldHideUserFacingUserMessage(
        '<task-resume context="infra_interrupt"><user_goal>hello</user_goal></task-resume>',
      ),
    ).toBe(true);
  });

  it('dedupes consecutive identical user bubbles', () => {
    const messages: ChatMessage[] = [
      { id: 'a', type: 'user', content: 'same prompt', timestamp: 1 },
      { id: 'b', type: 'user', content: 'same prompt', timestamp: 2 },
      { id: 'c', type: 'assistant', content: 'ok', timestamp: 3 },
    ];
    expect(dedupeConsecutiveUserMessages(messages).map((m) => m.id)).toEqual(['a', 'c']);
  });

  it('treats equivalent user text as visible even when ids differ', () => {
    const anchor: ChatMessage = {
      id: 'server-user',
      type: 'user',
      content: 'Generate the social matrix pack',
      timestamp: 1,
    };
    const visible: ChatMessage[] = [
      { type: 'user', content: 'Generate the social matrix pack', timestamp: 2 },
      { id: 'a1', type: 'assistant', content: '好的', timestamp: 3 },
    ];
    expect(hasEquivalentVisibleUserMessage(visible, anchor)).toBe(true);
  });
});
