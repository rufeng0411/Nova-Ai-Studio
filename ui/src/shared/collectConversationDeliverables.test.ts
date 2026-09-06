import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../components/chat/types/types';
import { collectConversationMainDeliverablePaths } from './collectConversationDeliverables';

describe('collectConversationMainDeliverablePaths', () => {
  it('returns primary deliverable paths from assistant text', () => {
    const messages: ChatMessage[] = [
      {
        id: 'u1',
        type: 'user',
        content: '写报告',
        timestamp: 1,
      },
      {
        id: 'a1',
        type: 'assistant',
        content: '已保存到 artifacts/nio-es9-review/蔚来ES9复盘报告.pdf',
        timestamp: 2,
      },
    ];

    const paths = collectConversationMainDeliverablePaths(messages);
    expect(paths).toContain('artifacts/nio-es9-review/蔚来ES9复盘报告.pdf');
  });

  it('drops bare filenames and prefers canonical artifacts paths', () => {
    const messages: ChatMessage[] = [
      {
        id: 'a1',
        type: 'assistant',
        content: [
          'artifacts/nio-es9-review/report.html',
          'artifacts/geo/nio-es9-review/report.html',
          'report.html',
        ].join(' '),
        timestamp: 1,
      },
    ];

    const paths = collectConversationMainDeliverablePaths(messages);
    expect(paths).not.toContain('report.html');
    expect(paths.filter((path) => path.endsWith('report.html'))).toHaveLength(1);
    expect(paths[0]).toBe('artifacts/nio-es9-review/report.html');
  });
});
