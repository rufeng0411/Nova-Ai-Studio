import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../components/chat/types/types';
import { collectTurnAllArtifacts } from './collectDeliverables';

describe('collectDeliverables', () => {
  it('collects paths from tool results and assistant text', () => {
    const toolMessages: ChatMessage[] = [
      {
        id: 't1',
        type: 'assistant',
        content: '',
        timestamp: '2026-06-02T00:00:00.000Z',
        isToolUse: true,
        toolName: 'write_file',
        toolId: 't1',
        toolInput: JSON.stringify({ file_path: 'artifacts/demo/page.html' }),
        toolResult: {
          isError: false,
          content: 'ok',
          writtenFilePath: 'artifacts/demo/page.html',
        },
      },
    ];
    const items = collectTurnAllArtifacts({
      assistantText: '已保存到 `drafts/brief.md`',
      toolMessages,
      projectRoot: 'C:/proj',
    });
    const paths = items.map((item) => item.path);
    expect(paths.some((p) => p.includes('page.html'))).toBe(true);
    expect(paths.some((p) => p.includes('brief.md'))).toBe(true);
  });

  it('classifies canvas-manifest as design_canvas when gate is on', () => {
    localStorage.setItem('pilotdeck-design-canvas-enabled', '1');
    const toolMessages: ChatMessage[] = [
      {
        id: 't2',
        type: 'assistant',
        content: '',
        timestamp: '2026-06-02T00:00:00.000Z',
        isToolUse: true,
        toolName: 'write_file',
        toolId: 't2',
        toolInput: JSON.stringify({ file_path: 'artifacts/canvas-1/canvas-manifest.json' }),
        toolResult: {
          isError: false,
          content: 'ok',
          writtenFilePath: 'artifacts/canvas-1/canvas-manifest.json',
        },
      },
    ];
    const items = collectTurnAllArtifacts({ assistantText: '', toolMessages });
    expect(items[0]?.kind).toBe('design_canvas');
    expect(items[0]?.turnArtifactDir).toBe('artifacts/canvas-1');
    localStorage.setItem('pilotdeck-design-canvas-enabled', '0');
  });

  it('collects deliverables from sanitized tool_result with writtenFilePath only', () => {
    const toolMessages: ChatMessage[] = [
      {
        id: 't3',
        type: 'assistant',
        content: '',
        timestamp: '2026-06-02T00:00:00.000Z',
        isToolUse: true,
        toolName: 'write_file',
        toolId: 't3',
        toolInput: JSON.stringify({ file_path: 'artifacts/demo/page.html' }),
        toolResult: {
          isError: false,
          content: '[truncated]',
          writtenFilePath: 'artifacts/demo/page.html',
        },
      },
    ];
    const items = collectTurnAllArtifacts({ assistantText: '', toolMessages });
    expect(items.some((item) => item.path.includes('page.html'))).toBe(true);
  });

  it('skips deliverables from failed tool writes', () => {
    const toolMessages: ChatMessage[] = [
      {
        id: 't4',
        type: 'assistant',
        content: '',
        timestamp: '2026-06-02T00:00:00.000Z',
        isToolUse: true,
        toolName: 'write_file',
        toolId: 't4',
        toolInput: JSON.stringify({ file_path: 'artifacts/demo/fail.pdf' }),
        toolResult: {
          isError: true,
          content: 'failed',
        },
      },
    ];
    const items = collectTurnAllArtifacts({ assistantText: '', toolMessages });
    expect(items).toHaveLength(0);
  });

  it('does not collect root-level slash markdown paths as user deliverables', () => {
    const items = collectTurnAllArtifacts({
      assistantText: [
        '交付文件汇总',
        '使用方法 Markdown /01-topic.md',
        '可重复使用 Markdown /02-topic-template.md',
      ].join('\n'),
      toolMessages: [],
    });

    expect(items.map((item) => item.path)).toEqual([]);
  });
});
