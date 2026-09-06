import { describe, expect, it } from 'vitest';
import { resolveSessionDeliverableContract } from './resolveSessionDeliverableContract';
import type { ChatMessage } from '../components/chat/types/types';

function userMessage(id: string, content: string): ChatMessage {
  return { id, type: 'user', content };
}

function assistantMessage(id: string, content: string, extra?: Partial<ChatMessage>): ChatMessage {
  return { id, type: 'assistant', content, turnId: id, ...extra };
}

describe('resolveSessionDeliverableContract', () => {
  it('accumulates HTML after markdown SDM (0707-3 jl3)', () => {
    const messages: ChatMessage[] = [
      userMessage('u1', '用「深度调研」围绕【中国潜射导弹巨浪-3世界舆情】做多源调研'),
      assistantMessage('a1', '报告已生成', {
        sessionDeliverableManifest: {
          manifestVersion: 1,
          goalVersion: 1,
          sessionGoalAnchor: 'jl3 research',
          slots: [{
            id: 'required_markdown_1',
            label: '调研报告',
            kind: 'markdown',
            pathHint: 'jl3-world-opinion-deep-dive-20260707.md',
            status: 'done',
          }],
        },
        verifiedDeliverablePaths: ['artifacts/jl3-world-opinion-deep-dive-20260707.md'],
      }),
      userMessage('u2', '给我配色高级，带图表的HTML'),
      assistantMessage('a2', '已完成 index.html', {
        verifiedDeliverablePaths: [
          'artifacts/jl3-world-opinion-deep-dive-20260707.md',
          'artifacts/index.html',
        ],
      }),
    ];

    const contract = resolveSessionDeliverableContract({
      messages,
      sessionDeliverables: [
        {
          id: 'md',
          path: 'artifacts/jl3-world-opinion-deep-dive-20260707.md',
          apiPath: 'artifacts/jl3-world-opinion-deep-dive-20260707.md',
          kind: 'document',
          source: 'tool',
        },
        {
          id: 'html',
          path: 'artifacts/index.html',
          apiPath: 'artifacts/index.html',
          kind: 'html',
          source: 'tool',
        },
      ],
      sessionVerifiedPaths: [
        'artifacts/jl3-world-opinion-deep-dive-20260707.md',
        'artifacts/index.html',
      ],
    });

    expect(contract.totalSlots).toBe(2);
    expect(contract.expectedEntries).toHaveLength(2);
    expect(contract.expectedEntries.some((e) => e.path?.includes('index.html'))).toBe(true);
  });

  it('reflects SDM add after 改为 HTML (ROG 0613)', () => {
    const messages: ChatMessage[] = [
      userMessage('u1', '写 markdown 报告 report.md'),
      assistantMessage('a1', '完成', {
        sessionDeliverableManifest: {
          manifestVersion: 1,
          goalVersion: 1,
          sessionGoalAnchor: 'report',
          slots: [{
            id: 'md1',
            label: 'report',
            kind: 'markdown',
            pathHint: 'report.md',
            status: 'done',
          }],
        },
        verifiedDeliverablePaths: ['artifacts/report.md'],
      }),
      userMessage('u2', '改为 HTML'),
      assistantMessage('a2', 'HTML 完成', {
        sessionDeliverableManifest: {
          manifestVersion: 2,
          goalVersion: 2,
          sessionGoalAnchor: 'report',
          slots: [
            {
              id: 'md1',
              label: 'report',
              kind: 'markdown',
              pathHint: 'report.md',
              status: 'done',
            },
            {
              id: 'added_html',
              label: 'HTML 网页',
              kind: 'html',
              pathHint: 'index.html',
              status: 'active',
            },
          ],
        },
        verifiedDeliverablePaths: ['artifacts/report.md', 'artifacts/index.html'],
      }),
    ];

    const contract = resolveSessionDeliverableContract({
      messages,
      sessionVerifiedPaths: ['artifacts/report.md', 'artifacts/index.html'],
    });

    expect(contract.totalSlots).toBe(2);
    expect(contract.expectedEntries.filter((e) => e.kind === 'html' || e.path?.includes('html'))).toHaveLength(1);
  });
});
