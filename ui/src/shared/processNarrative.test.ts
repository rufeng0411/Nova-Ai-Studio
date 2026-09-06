import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../components/chat/types/types';
import {
  buildKeySteps,
  buildProcessClues,
  inferProcessPhase,
  parseSearchSourcesFromText,
} from './processNarrative';

function toolMessage(
  toolName: string,
  toolInput: Record<string, unknown>,
  toolResult?: { content?: string; isError?: boolean; writtenFilePath?: string },
): ChatMessage {
  return {
    id: `tool-${toolName}`,
    type: 'assistant',
    content: '',
    timestamp: new Date().toISOString(),
    isToolUse: true,
    toolName,
    toolInput: JSON.stringify(toolInput),
    toolId: `id-${toolName}`,
    toolResult: toolResult
      ? {
          content: toolResult.content ?? '',
          isError: Boolean(toolResult.isError),
          ...(toolResult.writtenFilePath ? { writtenFilePath: toolResult.writtenFilePath } : {}),
        }
      : null,
  };
}

describe('processNarrative', () => {
  it('infers gather phase after web_search', () => {
    const messages = [toolMessage('web_search', { query: 'ROG NUC 市场' })];
    expect(inferProcessPhase(messages)).toBe('gather');
  });

  it('builds search clue from tool input', () => {
    const messages = [toolMessage('web_search', { query: '发烧硬件用户' })];
    const clues = buildProcessClues(messages);
    expect(clues).toHaveLength(1);
    expect(clues[0]?.kind).toBe('search');
    expect(clues[0]?.label).toBe('发烧硬件用户');
  });

  it('builds milestone clue from writtenFilePath', () => {
    const messages = [
      toolMessage('write_file', { file_path: 'report.md' }, {
        writtenFilePath: 'artifacts/geo/campaign/report.md',
      }),
    ];
    const clues = buildProcessClues(messages);
    expect(clues[0]?.kind).toBe('milestone');
    expect(clues[0]?.filePath).toContain('report.md');
  });

  it('builds structured key steps for tool chain', () => {
    const messages = [
      toolMessage('web_search', { query: 'a' }, { content: 'ok' }),
      toolMessage('read_file', { file_path: 'x.md' }, { content: 'body' }),
      toolMessage('write_file', { file_path: 'out.md' }, { writtenFilePath: 'out.md' }),
    ];
    const steps = buildKeySteps(messages);
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps[0]?.kind).toBe('search');
    expect(steps[0]?.target).toBe('a');
    expect(steps[0]?.title).toBeUndefined();
  });

  it('includes thinking in key steps when enabled', () => {
    const messages: ChatMessage[] = [
      {
        id: 'think-1',
        type: 'assistant',
        content: '需要先确认用户关注的健康指标',
        timestamp: new Date().toISOString(),
        isThinking: true,
      },
      toolMessage('web_search', { query: 'test' }),
    ];
    const steps = buildKeySteps(messages, [], { includeThinkingInSteps: true });
    expect(steps.some((step) => step.kind === 'thinking')).toBe(true);
  });

  it('parses urls from search preview text', () => {
    const sources = parseSearchSourcesFromText('See https://example.com/a and https://test.org/b');
    expect(sources.length).toBe(2);
    expect(sources[0]?.url).toContain('example.com');
  });
});
