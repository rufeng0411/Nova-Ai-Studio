import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../components/chat/types/types';
import { collectSessionVerifiedDeliverables } from './collectSessionVerifiedDeliverables';

describe('collectSessionVerifiedDeliverables', () => {
  it('aggregates verified paths across assistant turns in order', () => {
    const sessionMessages: ChatMessage[] = [
      {
        id: 'a1',
        type: 'assistant',
        content: 'phase 1 done',
        verifiedDeliverablePaths: ['artifacts/wuyutai/01-research.md'],
        turnArtifactDir: 'artifacts/wuyutai',
      } as ChatMessage,
      { id: 'u1', type: 'user', content: 'continue' },
      {
        id: 'a2',
        type: 'assistant',
        content: 'phase 2 done',
        verifiedDeliverablePaths: ['artifacts/wuyutai/report.html'],
        turnArtifactDir: 'artifacts/wuyutai',
      } as ChatMessage,
    ];

    const items = collectSessionVerifiedDeliverables(sessionMessages);
    expect(items.map((item) => item.path)).toEqual([
      'artifacts/wuyutai/01-research.md',
      'artifacts/wuyutai/report.html',
    ]);
  });
});
