import { describe, expect, it } from 'vitest';
import { collectTurnFinalDeliverables } from './collectFinalDeliverables';
import type { ChatMessage } from '../components/chat/types/types';

function tool(id: string, name: string, filePath: string): ChatMessage {
  return {
    id,
    type: 'assistant',
    content: '',
    timestamp: '2026-06-23T10:00:00.000Z',
    isToolUse: true,
    toolName: name,
    toolId: id,
    toolInput: JSON.stringify({ file_path: filePath }),
    toolResult: { isError: false, content: 'ok' },
  };
}

describe('collectTurnFinalDeliverables verifiedPathsOverride', () => {
  it('prefers ledger verified paths over weak bare numeric html body anchors', () => {
    const dir = 'artifacts/wuyutai-campaign-20260623';
    const toolMessages = [
      tool('w1', 'write_file', `${dir}/01-research.md`),
      tool('w2', 'write_file', `${dir}/report.html`),
      tool('w3', 'write_file', `${dir}/38928.html`),
    ];
    const final = collectTurnFinalDeliverables({
      assistantText: 'Executive deck ready: 38928.html',
      toolMessages,
      userGoalText: '吴裕泰 HTML 幻灯',
      verifiedPathsOverride: [
        `${dir}/01-research.md`,
        `${dir}/report.html`,
        `${dir}/38928.html`,
      ],
    });

    expect(final.map((item) => item.path).sort()).toEqual([
      `${dir}/01-research.md`,
      `${dir}/38928.html`,
      `${dir}/report.html`,
    ]);
  });
});
