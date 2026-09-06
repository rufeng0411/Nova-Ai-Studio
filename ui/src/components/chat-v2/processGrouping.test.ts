import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../chat/types/types';
import {
  buildRenderableMessageItems,
  formatToolDisplayName,
  getLiveProcessGroups,
  getRunningProcessTitle,
  type LiveProcessGroup,
  type RenderableMessageItem,
} from './processGrouping';

const baseTime = Date.parse('2026-05-18T08:00:00.000Z');

function timestamp(offsetMs: number): string {
  return new Date(baseTime + offsetMs).toISOString();
}

function user(id: string, content = 'Do the work'): ChatMessage {
  return {
    id,
    type: 'user',
    content,
    timestamp: timestamp(0),
  };
}

function assistant(id: string, content: string, offsetMs = 1000): ChatMessage {
  return {
    id,
    type: 'assistant',
    content,
    timestamp: timestamp(offsetMs),
  };
}

function tool(
  id: string,
  toolName: string,
  input: Record<string, unknown> = {},
  offsetMs = 500,
  toolResult: ChatMessage['toolResult'] = { content: 'ok' },
): ChatMessage {
  return {
    id,
    type: 'assistant',
    content: '',
    timestamp: timestamp(offsetMs),
    isToolUse: true,
    toolName,
    toolId: id,
    toolInput: JSON.stringify(input),
    toolResult,
  };
}

function processAttachments(item: RenderableMessageItem | undefined) {
  return [
    ...(item?.mergedProcessAttachments || []),
    ...(item?.beforeProcessAttachments || []),
    ...(item?.afterProcessAttachments || []),
  ];
}

describe('processGrouping', () => {
  it('attaches the whole turn to the final assistant reply via turnMessages', () => {
    const messages = [
      user('u1'),
      assistant('a1', '我先看看技能框架。', 100),
      tool('edit-1', 'write_file', { file_path: 'artifacts/research/发烧硬件用户研究报告.md' }, 200),
      assistant('a2', 'The 发烧硬件用户研究报告.md file has been written.', 300),
      tool('edit-2', 'edit_file', { file_path: 'artifacts/research/发烧硬件用户研究报告.md' }, 400),
      assistant('a3', '文件已生成并清理完毕。', 500),
    ];

    const items = buildRenderableMessageItems(messages);
    const finalItem = items.find((item) => item.message.id === 'a3');
    const middleItem = items.find((item) => item.message.id === 'a2');

    expect(finalItem?.turnMessages.map((message) => message.id)).toEqual([
      'u1', 'a1', 'edit-1', 'a2', 'edit-2', 'a3',
    ]);
    expect(middleItem).toBeUndefined();
  });

  it('uses turnContextMessages so deliverables stay correct when only a tail slice is rendered', () => {
    const fullTurn = [
      user('u1', 'Generate slides'),
      tool('html-1', 'write_file', { file_path: 'artifacts/deck/presentation.html' }, 200),
      assistant('a-final', 'Open `artifacts/deck/presentation.html` when ready.', 500),
    ];
    const filler = Array.from({ length: 8 }, (_, index) =>
      user(`filler-${index}`, `older turn ${index}`),
    ).flatMap((message, index) => [
      message,
      assistant(`filler-a-${index}`, 'done', (index + 1) * 1000),
    ]);
    const fullMessages = [...filler, ...fullTurn];
    const visibleTail = fullMessages.slice(-4);

    const items = buildRenderableMessageItems(visibleTail, {
      turnContextMessages: fullMessages,
    });
    const finalItem = items.find((item) => item.message.id === 'a-final');

    expect(finalItem?.turnMessages.map((message) => message.id)).toEqual([
      'u1',
      'html-1',
      'a-final',
    ]);
  });

  it('keeps the live-turn user anchor visible when tail pagination drops it', () => {
    const liveTurn = [
      user('u-live', 'Generate the social matrix pack'),
      assistant('a1', '好的，我来整理社媒矩阵。', 100),
      tool('tool-1', 'write_file', { file_path: 'social-matrix/copy.md' }, 200),
      tool('tool-2', 'write_file', { file_path: 'social-matrix/post-1.md' }, 300),
    ];
    const filler = Array.from({ length: 130 }, (_, index) =>
      tool(`tail-tool-${index}`, 'bash', { command: `echo ${index}` }, (index + 1) * 10),
    );
    const fullMessages = [...liveTurn, ...filler];
    const visibleTail = fullMessages.slice(-120);

    const items = buildRenderableMessageItems(visibleTail, {
      isAssistantWorking: true,
      turnContextMessages: fullMessages,
    });
    const groups = getLiveProcessGroups(visibleTail, {
      isAssistantWorking: true,
      turnContextMessages: fullMessages,
    });

    expect(items.map((item) => item.message.id)).toEqual(['u-live', 'a1']);
    expect(groups).toHaveLength(1);
    expect(groups[0].afterOriginalIndex).toBe(1);
  });

  it('does not duplicate the user anchor when visible tail already has equivalent text without id', () => {
    const prompt = 'Generate the social matrix pack for YETI co-brand launch';
    const liveTurn = [
      user('u-server', prompt),
      assistant('a1', '好的，我来整理社媒矩阵。', 100),
    ];
    const visibleTail: ReturnType<typeof user>[] = [
      { type: 'user', content: prompt, timestamp: 50 },
      liveTurn[1],
    ];

    const items = buildRenderableMessageItems(visibleTail, {
      isAssistantWorking: true,
      turnContextMessages: liveTurn,
    });

    expect(items.filter((item) => item.message.type === 'user')).toHaveLength(1);
    expect(items.map((item) => item.message.content)).toEqual([prompt, '好的，我来整理社媒矩阵。']);
  });

  it('keeps the first pre-tool acknowledgment visible while hiding later narration during a live turn', () => {
    const messages = [
      user('u1'),
      assistant('a1', 'I will inspect the files.', 100),
      tool('read-1', 'Read', { file_path: '/repo/src/App.tsx' }, 200),
      tool('grep-1', 'Grep', { pattern: 'ProcessTrace' }, 300),
    ];

    const items = buildRenderableMessageItems(messages, { isAssistantWorking: true });
    const groups = getLiveProcessGroups(messages, { isAssistantWorking: true });

    expect(items.map((item) => item.message.id)).toEqual(['u1', 'a1']);
    expect(groups).toHaveLength(1);
    expect(groups[0].afterOriginalIndex).toBe(1);
    expect(groups[0].detailMessages.map((message) => message.toolName)).toEqual(['Read', 'Grep']);
  });

  it('hides truncated restart apologies during a live turn even as the first pre-tool bubble', () => {
    const messages = [
      user('u1'),
      assistant('a1', '抱歉刚才的回复被截断了，我需要重新开始写完整 HTML。', 100),
      tool('prep-1', 'session_prepare', {}, 200),
      tool('mem-1', 'memory_retrieve', {}, 300),
    ];

    const items = buildRenderableMessageItems(messages, { isAssistantWorking: true });

    expect(items.map((item) => item.message.id)).toEqual(['u1']);
    const groups = getLiveProcessGroups(messages, { isAssistantWorking: true });
    expect(groups).toHaveLength(1);
    expect(groups[0].afterOriginalIndex).toBe(0);
  });

  it('still hides later intermediate narration between tools during a live turn', () => {
    const messages = [
      user('u1'),
      assistant('a1', 'I will inspect the files.', 100),
      tool('read-1', 'Read', { file_path: '/repo/src/App.tsx' }, 200),
      assistant('a2', 'Now let me verify the build output.', 250),
      tool('grep-1', 'Grep', { pattern: 'ProcessTrace' }, 300),
    ];

    const items = buildRenderableMessageItems(messages, { isAssistantWorking: true });

    expect(items.map((item) => item.message.id)).toEqual(['u1', 'a1']);
  });

  it('hides degenerate quantifier fragments like 两个 even before the next tool arrives', () => {
    const messages = [
      user('u1'),
      assistant('a1', '好的，我来整理竞品 GEO 报告，标准成果清单如下…', 50),
      assistant('a2', '两个', 100),
    ];

    const items = buildRenderableMessageItems(messages, { isAssistantWorking: true });

    expect(items.map((item) => item.message.id)).toEqual(['u1', 'a1']);
  });

  it('hides later intermediate narration hosts while the turn is still running', () => {
    const messages = [
      user('u1'),
      assistant('a1', '好的，我先梳理需求。', 50),
      assistant('plan-1', 'Now let me fetch product images from the official site.', 100),
      tool('search-1', 'web_search', { query: 'NIO ES9' }, 200),
    ];

    const items = buildRenderableMessageItems(messages, { isAssistantWorking: true });

    expect(items.map((item) => item.message.id)).toEqual(['u1', 'a1']);
    const groups = getLiveProcessGroups(messages, { isAssistantWorking: true });
    expect(groups).toHaveLength(1);
    expect(groups[0].afterOriginalIndex).toBe(1);
    expect(groups[0].detailMessages.map((message) => message.id)).toEqual(['search-1']);
  });

  it('summarizes Read and Grep tools as explored files and searches', () => {
    const messages = [
      user('u1'),
      tool('read-1', 'Read', { file_path: '/repo/src/App.tsx' }, 100),
      tool('read-2', 'Read', { file_path: '/repo/src/index.tsx' }, 200),
      tool('grep-1', 'Grep', { pattern: 'MessagesPaneV2' }, 300),
      assistant('a1', 'Here is what I found.', 400),
    ];

    const items = buildRenderableMessageItems(messages);
    const assistantItem = items.find((item) => item.message.id === 'a1');

    expect(items.map((item) => item.message.id)).toEqual(['u1', 'a1']);
    const attachment = processAttachments(assistantItem)[0];
    expect(attachment?.processDetailMessages.map((message) => message.id)).toEqual([
      'read-1',
      'read-2',
      'grep-1',
    ]);
    expect(attachment?.processSummary.exploredFileCount).toBe(2);
    expect(attachment?.processSummary.ragSearchCount).toBe(1);
    expect(attachment?.processSummary.toolCallCount).toBe(3);
    expect(attachment?.inlineImages).toEqual([]);
  });

  it('surfaces tool-result images outside the collapsed trace', () => {
    const imageDataUrl = 'data:image/jpeg;base64,/9j/4AAQ';
    const messages = [
      user('u1'),
      tool(
        'read-1',
        'Read',
        { file_path: '/Users/me/Downloads/3D.jpg' },
        100,
        {
          content: '[Image file]',
          images: [{ data: imageDataUrl, name: '3D.jpg', mimeType: 'image/jpeg' }],
        } as ChatMessage['toolResult'],
      ),
      assistant('a1', 'This is a 3D surface plot.', 200),
    ];

    const items = buildRenderableMessageItems(messages);
    const attachment = processAttachments(items.find((item) => item.message.id === 'a1'))[0];

    expect(attachment?.inlineImages).toEqual([
      {
        data: imageDataUrl,
        name: '3D.jpg',
        mimeType: 'image/jpeg',
        source: 'tool_result',
        toolId: 'read-1',
      },
    ]);
  });

  it('summarizes edit tools with unique edited file count', () => {
    const messages = [
      user('u1'),
      tool('edit-1', 'Edit', { file_path: '/repo/src/App.tsx' }, 100),
      tool('write-1', 'Write', { file_path: '/repo/src/App.tsx' }, 200),
      tool('patch-1', 'ApplyPatch', { file_path: '/repo/src/styles.css' }, 300),
      assistant('a1', 'Updated the UI.', 400),
    ];

    const items = buildRenderableMessageItems(messages);
    const summary = processAttachments(items.find((item) => item.message.id === 'a1'))[0]?.processSummary;

    expect(summary?.editedFileCount).toBe(2);
    expect(summary?.toolCallCount).toBe(3);
  });

  it('summarizes Bash tools as command activity', () => {
    const messages = [
      user('u1'),
      tool('bash-1', 'Bash', { command: 'npm test' }, 100),
      tool('bash-2', 'Bash', { command: 'npm run lint' }, 200),
      assistant('a1', 'Checks are done.', 300),
    ];

    const items = buildRenderableMessageItems(messages);
    const summary = processAttachments(items.find((item) => item.message.id === 'a1'))[0]?.processSummary;

    expect(summary?.commandCount).toBe(2);
    expect(summary?.toolCallCount).toBe(2);
  });

  it('folds ordinary failed tools into process summaries and counts errors', () => {
    const failedResult = {
      content: '<tool_use_error>InputValidationError: missing file_path</tool_use_error>',
      isError: true,
      errorCode: 'tool_execution_failed',
    };
    const messages = [
      user('u1'),
      tool('edit-1', 'Edit', { file_path: '/repo/src/App.tsx' }, 100, failedResult),
      tool('grep-1', 'Grep', { pattern: 'Footer' }, 200, failedResult),
      tool('bash-1', 'Bash', { command: 'npm run build' }, 300, failedResult),
      assistant('a1', 'I will retry with corrected inputs.', 400),
    ];

    const items = buildRenderableMessageItems(messages);
    const assistantItem = items.find((item) => item.message.id === 'a1');
    const attachment = processAttachments(assistantItem)[0];

    expect(items.map((item) => item.message.id)).toEqual(['u1', 'a1']);
    expect(attachment?.processDetailMessages.map((message) => message.id)).toEqual([
      'edit-1',
      'grep-1',
      'bash-1',
    ]);
    expect(attachment?.processSummary.toolCallCount).toBe(3);
    expect(attachment?.processSummary.toolErrorCount).toBe(0);
    expect(attachment?.processSummary.state).toBe('completed');
    expect(attachment?.processSummary.editedFileCount).toBe(1);
    expect(attachment?.processSummary.ragSearchCount).toBe(1);
    expect(attachment?.processSummary.commandCount).toBe(1);
  });

  it('merges completed process segments onto the final assistant host', () => {
    const messages = [
      user('u1'),
      assistant('a1', 'First I will inspect files.', 100),
      tool('read-1', 'Read', { file_path: '/repo/src/App.tsx' }, 200),
      assistant('a2', 'Now I will run checks.', 300),
      tool('bash-1', 'Bash', { command: 'npm test' }, 400),
      assistant('a3', 'Done.', 500),
    ];

    const items = buildRenderableMessageItems(messages);
    const thirdAssistant = items.find((item) => item.message.id === 'a3');

    expect(items.map((item) => item.message.id)).toEqual(['u1', 'a3']);
    expect(thirdAssistant?.mergedProcessAttachments).toHaveLength(2);
    expect(thirdAssistant?.mergedProcessAttachments[0].processSummary.exploredFileCount).toBe(1);
    expect(thirdAssistant?.mergedProcessAttachments[1].processSummary.commandCount).toBe(1);
    expect(thirdAssistant?.beforeProcessAttachments).toHaveLength(0);
    expect(thirdAssistant?.afterProcessAttachments).toHaveLength(0);
  });

  it('attaches completed run meta to the final assistant host', () => {
    const messages: ChatMessage[] = [
      user('u1'),
      assistant('a1', 'I finished the work.', 5000),
      {
        id: 'summary-1',
        type: 'system',
        content: 'Process summary',
        timestamp: timestamp(81000),
        isAgentActivitySummary: true,
        durationMs: 80000,
        state: 'completed',
      },
    ];

    const items = buildRenderableMessageItems(messages);
    const assistantItem = items.find((item) => item.message.id === 'a1');
    const userItem = items.find((item) => item.message.id === 'u1');

    expect(items.map((item) => item.message.id)).toEqual(['u1', 'a1']);
    expect(userItem?.afterRunAttachment).toBeNull();
    expect(assistantItem?.turnRunMeta?.durationMs).toBe(80000);
  });

  it('attaches a leading completed process segment before the next assistant message', () => {
    const messages = [
      user('u1'),
      tool('read-1', 'Read', { file_path: '/repo/src/App.tsx' }, 100),
      assistant('a1', 'Here is what I found.', 200),
    ];

    const items = buildRenderableMessageItems(messages);
    const assistantItem = items.find((item) => item.message.id === 'a1');

    expect(items.map((item) => item.message.id)).toEqual(['u1', 'a1']);
    expect(assistantItem?.mergedProcessAttachments).toHaveLength(1);
    expect(assistantItem?.mergedProcessAttachments[0].processSummary.exploredFileCount).toBe(1);
    expect(assistantItem?.afterProcessAttachments).toHaveLength(0);
  });

  it('does not hide user-visible prompts, plan exits, permissions, or errors', () => {
    const permissionError = {
      content: 'Permission required',
      isError: true,
      errorCode: 'permission_required',
    };
    const messages = [
      user('u1'),
      tool('ask-1', 'AskUserQuestion', {
        questions: [{
          question: 'Continue?',
          header: 'Continue',
          options: [{ label: 'Yes', description: '' }, { label: 'No', description: '' }],
        }],
      }, 100, {
        toolUseResult: {
          answers: { 'Continue?': 'Yes' },
        },
      }),
      tool('plan-1', 'ExitPlanMode', { plan: 'Do it' }, 200),
      tool('denied-1', 'Bash', { command: 'rm file' }, 300, permissionError),
      {
        id: 'error-1',
        type: 'error',
        content: 'Something failed',
        timestamp: timestamp(400),
      },
      assistant('a1', 'Waiting on you.', 500),
    ];

    const items = buildRenderableMessageItems(messages);

    expect(items.map((item) => item.message.id)).toEqual([
      'u1',
      'ask-1',
      'plan-1',
      'denied-1',
      'error-1',
      'a1',
    ]);
    expect(processAttachments(items.find((item) => item.message.id === 'a1'))).toHaveLength(0);
  });

  it('hides unanswered ask_user_question tool rows from the transcript', () => {
    const messages = [
      user('u1'),
      tool('ask-1', 'AskUserQuestion', {
        questions: [{
          header: '替代方案',
          options: [
            { label: '使用占位符', description: '使用占位符文件代替实际生成的图片' },
            { label: '等待重试', description: '等待图片生成服务恢复后重试' },
          ],
        }],
      }, 100),
      assistant('a1', '继续生成配图。', 200),
    ];

    const items = buildRenderableMessageItems(messages);
    expect(items.map((item) => item.message.id)).toEqual(['u1', 'a1']);
  });

  it('folds plan-mode side-effect denials into the process row', () => {
    const planModeDeny = {
      content: 'Plan mode denies side-effecting tool bash.',
      isError: true,
      errorCode: 'permission_denied',
    };
    const messages = [
      user('u1'),
      tool('plan-deny-1', 'bash', { command: 'cd .' }, 100, planModeDeny),
      assistant('a1', 'I will continue with a plan.', 200),
    ];

    const items = buildRenderableMessageItems(messages);
    const assistantItem = items.find((item) => item.message.id === 'a1');
    const attachments = processAttachments(assistantItem);

    expect(items.map((item) => item.message.id)).toEqual(['u1', 'a1']);
    expect(attachments).toHaveLength(1);
    expect(attachments[0].processDetailMessages.map((message) => message.id)).toEqual(['plan-deny-1']);
    expect(attachments[0].processSummary.toolErrorCount).toBe(0);
  });

  it('treats recoverable network tool errors as completed process state', () => {
    const recoverableError = {
      isError: true,
      errorCode: 'tool_execution_failed',
      content: 'web_fetch failed: fetch failed',
    };
    const messages = [
      user('u1'),
      tool('fetch-1', 'web_fetch', { url: 'https://example.com' }, 200, recoverableError),
      assistant('a1', 'Trying another approach.', 300),
    ];

    const items = buildRenderableMessageItems(messages);
    const assistantItem = items.find((item) => item.message.id === 'a1');
    const attachments = processAttachments(assistantItem);

    expect(attachments).toHaveLength(1);
    expect(attachments[0].processSummary.toolErrorCount).toBe(0);
    expect(attachments[0].processSummary.state).toBe('completed');
  });

  it('formatToolDisplayName maps fetch_page_images via i18n', () => {
    const t = ((key: string, opts?: { defaultValue?: string }) => {
      if (key === 'process.tool.fetchPageImages') return '抓取页面图片';
      if (key === 'process.tool.read') return '读取';
      return opts?.defaultValue ?? key;
    }) as import('i18next').TFunction<'chat'>;
    expect(formatToolDisplayName('fetch_page_images', t)).toBe('抓取页面图片');
    expect(formatToolDisplayName('Read', t)).toBe('读取');
  });

  it('retains thinking in keySteps when processDetailLevel is standard', () => {
    const messages = [
      user('u1'),
      {
        id: 'think-1',
        type: 'assistant',
        content: '先梳理报告结构再开始搜索',
        timestamp: timestamp(100),
        isThinking: true,
      } as ChatMessage,
      tool('search-1', 'web_search', { query: 'test' }, 200),
      assistant('a1', '报告已完成。', 300),
    ];

    const items = buildRenderableMessageItems(messages, { processDetailLevel: 'standard' });
    const assistantItem = items.find((item) => item.message.id === 'a1');
    const attachment = processAttachments(assistantItem)[0];
    const keySteps = attachment?.processSummary.keySteps as Array<{ kind?: string }> | undefined;

    expect(keySteps?.some((step) => step.kind === 'thinking')).toBe(true);
  });

  it('omits thinking from keySteps when processDetailLevel is minimal', () => {
    const messages = [
      user('u1'),
      {
        id: 'think-1',
        type: 'assistant',
        content: '思考内容',
        timestamp: timestamp(100),
        isThinking: true,
      } as ChatMessage,
      tool('search-1', 'web_search', { query: 'test' }, 200),
      assistant('a1', '完成。', 300),
    ];

    const items = buildRenderableMessageItems(messages, { processDetailLevel: 'minimal' });
    const assistantItem = items.find((item) => item.message.id === 'a1');
    const attachment = processAttachments(assistantItem)[0];
    const keySteps = attachment?.processSummary.keySteps as Array<{ kind?: string }> | undefined;

    expect(keySteps?.some((step) => step.kind === 'thinking')).toBe(false);
  });

  it('getRunningProcessTitle uses Chinese for read tool', () => {
    const t = ((key: string, opts?: { defaultValue?: string }) =>
      opts?.defaultValue ?? key) as import('i18next').TFunction<'chat'>;
    const group: LiveProcessGroup = {
      id: 'live-1',
      afterOriginalIndex: 1,
      beforeOriginalIndex: 0,
      startIndex: 0,
      endIndex: 0,
      messages: [tool('r1', 'Read', { file_path: 'src/a.ts' })],
      detailMessages: [],
      isRunning: true,
    };
    const title = getRunningProcessTitle(group, t);
    expect(title).toMatch(/读取/);
    expect(title).not.toMatch(/Reading file/i);
  });
});
