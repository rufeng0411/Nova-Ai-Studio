// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ChatMessage, ChatRunMode } from '../chat/types/types';
import MessagesPaneV2 from './MessagesPaneV2';

vi.mock('../../shared/validateDeliverables', async (importOriginal) => {
 const mod = await importOriginal<typeof import('../../shared/validateDeliverables')>();
 return {
  ...mod,
  validateDeliverablesClient: vi.fn(async (_projectName, items) =>
    items.map((item) => ({
      ...item,
      validationStatus: 'verified' as const,
      resolvedPath: item.resolvedPath || item.apiPath || item.path,
    }))),
 };
});

beforeAll(() => {
 class ResizeObserverMock {
 observe() {}
 disconnect() {}
 }

 vi.stubGlobal('ResizeObserver', ResizeObserverMock);
 vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
 return window.setTimeout(() => callback(performance.now()), 0);
 });
 vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
});

afterEach(() => {
 cleanup();
});

function makeMessage(index: number): ChatMessage {
 return {
 id: `m-${index}`,
 type: index % 2 === 0 ? 'user' : 'assistant',
 content: `Message ${index}`,
 timestamp: `2026-05-13T09:${String(index % 60).padStart(2, '0')}:00.000Z`,
 };
}

function createPaneElement({
 messages,
 activityMessages = [],
 isAssistantWorking = false,
 runMode = 'agent',
 selectedProject = null,
}: {
 messages: ChatMessage[];
 activityMessages?: ChatMessage[];
 isAssistantWorking?: boolean;
 runMode?: ChatRunMode;
 selectedProject?: import('../../types/app').Project | null;
}) {
 const scrollContainerRef = React.createRef<HTMLDivElement>();

 return (
 <MessagesPaneV2
 scrollContainerRef={scrollContainerRef}
 onWheel={() => {}}
 onTouchMove={() => {}}
 isLoadingSessionMessages={false}
 chatMessages={messages}
 activityMessages={activityMessages}
 visibleMessages={messages}
 visibleMessageCount={messages.length}
 isLoadingMoreMessages={false}
 hasMoreMessages={false}
 totalMessages={messages.length}
 loadEarlierMessages={() => {}}
 loadAllMessages={() => {}}
 allMessagesLoaded
 isLoadingAllMessages={false}
 provider="pilotdeck"
 selectedProject={selectedProject}
 selectedSession={null}
 createDiff={() => []}
 setInput={() => {}}
 isAssistantWorking={isAssistantWorking}
 runMode={runMode}
 />
 );
}

function renderPane(options: {
 messages: ChatMessage[];
 activityMessages?: ChatMessage[];
 isAssistantWorking?: boolean;
 runMode?: ChatRunMode;
 selectedProject?: import('../../types/app').Project | null;
}) {
 return renderWithProviders(createPaneElement(options));
}

describe('MessagesPaneV2 render behavior', () => {
 it('renders only the viewport window for large conversations', () => {
 const messages = Array.from({ length: 220 }, (_, index) => makeMessage(index));

 renderPane({ messages });

 const container = screen.getByText('Message 0').closest('[data-total-message-count]');
 expect(container?.getAttribute('data-virtualized-messages')).toBe('true');
 expect(container?.getAttribute('data-total-message-count')).toBe('220');
 expect(Number(container?.getAttribute('data-rendered-message-count'))).toBeLessThan(220);
 });

 it('renders live processing time above the active assistant turn with activity status', () => {
 const messages = [
 {
 id: 'u-1',
 type: 'user',
 content: '继续优化',
 timestamp: new Date().toISOString(),
 },
 {
 id: 'a-1',
 type: 'assistant',
 content: 'I will inspect the current UI.',
 timestamp: new Date().toISOString(),
 },
 ];
 const activityMessages: ChatMessage[] = [
 {
 id: 'activity-1',
 type: 'system',
 content: 'Searching files',
 timestamp: new Date().toISOString(),
 isAgentActivity: true,
 activityId: 'activity-1',
 phase: 'rag',
 state: 'running',
 title: 'Searching files',
 detail: 'MessagesPaneV2.tsx',
 startedAt: new Date(Date.now() - 2000).toISOString(),
 },
 ];

 renderPane({ messages, activityMessages, isAssistantWorking: true });

 const dock = screen.getByTestId('live-process-progress-dock');
 const phaseRail = screen.getByTestId('process-phase-rail');
 const userText = screen.getByText('继续优化');
 const assistantText = screen.getByText('I will inspect the current UI.');
 expect(dock).toBeTruthy();
 expect(phaseRail).toBeTruthy();
 expect(dock.textContent).toMatch(/进行中/);
 const dockTimeline = dock.querySelector('[data-testid="process-timeline"]');
 if (dockTimeline) {
  expect(Boolean(phaseRail.compareDocumentPosition(dockTimeline) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
 }
 expect(dock.className).not.toContain('sticky');
 expect(dock.className).not.toContain('bottom-0');
 expect(userText.closest('.chat-message')?.className).toContain('pb-4');
 expect(Boolean(assistantText.compareDocumentPosition(dock) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
 });

 it('keeps deliverables on the final assistant reply when a system summary follows', async () => {
 const now = '2026-06-23T00:00:00.000Z';
 const messages: ChatMessage[] = [
 {
 id: 'u-razer',
 type: 'user',
 content: '做雷蛇 2026 官网落地页，5页',
 timestamp: now,
 },
 {
 id: 'a-razer',
 type: 'assistant',
content: '✅ 交付完成',
 timestamp: now,
 verifiedDeliverablePaths: ['artifacts/razer-landing/index.html'],
 resolvedPathMap: { 'artifacts/razer-landing/index.html': 'artifacts/razer-landing/index.html' },
 turnArtifactDir: 'artifacts/razer-landing',
 },
 {
 id: 'summary-razer',
 type: 'system',
 content: 'Process summary',
 timestamp: now,
 isAgentActivitySummary: true,
 durationMs: 720000,
 state: 'completed',
 },
 ];

 renderPane({
   messages,
   selectedProject: {
     name: 'general',
     displayName: 'general',
     fullPath: '/workspace/general',
     path: 'general',
   },
 });

 expect(screen.getByTestId('deliverable-summary-table')).toBeTruthy();
 await waitFor(() => {
  expect(screen.getByTitle(/razer-landing\/index\.html/i)).toBeTruthy();
 });
 });

 it('keeps the processed duration visible after the active turn completes', () => {
 const now = '2026-05-18T08:00:00.000Z';
 const messages: ChatMessage[] = [
 {
 id: 'u-1',
 type: 'user',
 content: '继续优化',
 timestamp: now,
 },
 {
 id: 'tool-read-1',
 type: 'assistant',
 content: '',
 timestamp: now,
 isToolUse: true,
 toolName: 'Read',
 toolId: 'tool-read-1',
 toolInput: '{"file_path":"src/App.tsx"}',
 toolResult: { content: 'ok', isError: false },
 },
 {
 id: 'a-1',
 type: 'assistant',
 content: 'I finished the changes.',
 timestamp: '2026-05-18T08:01:20.000Z',
 },
 {
 id: 'summary-1',
 type: 'system',
 content: 'Process summary',
 timestamp: '2026-05-18T08:01:20.000Z',
 isAgentActivitySummary: true,
 durationMs: 80000,
 state: 'completed',
 },
 ];

 renderPane({ messages });

 const durationLabel = screen.getByText(/1m 20s/);
 const userText = screen.getByText('继续优化');
 const assistantText = screen.getByText('I finished the changes.');
 const informalStack = screen.getByTestId('informal-process-stack');

 expect(durationLabel).toBeTruthy();
 expect(Boolean(userText.compareDocumentPosition(informalStack) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
 expect(Boolean(informalStack.compareDocumentPosition(assistantText) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
 });

 it('shows live timeline steps with masked file basename', () => {
 const now = new Date().toISOString();
 const messages: ChatMessage[] = [
 {
 id: 'u-1',
 type: 'user',
 content: '检查文件',
 timestamp: now,
 },
 {
 id: 'a-1',
 type: 'assistant',
 content: 'I will inspect the current file.',
 timestamp: now,
 },
 {
 id: 'tool-read-1',
 type: 'assistant',
 content: '',
 timestamp: now,
 isToolUse: true,
 toolName: 'Read',
 toolId: 'tool-read-1',
 toolInput: '{"file_path":"src/HiddenTool.tsx"}',
 },
 ];
 const activityMessages: ChatMessage[] = [
 {
 id: 'activity-1',
 type: 'system',
 content: 'Reading file',
 timestamp: now,
 isAgentActivity: true,
 activityId: 'activity-1',
 phase: 'tool',
 state: 'running',
 title: 'Reading file',
 startedAt: now,
 },
 ];

 renderPane({ messages, activityMessages, isAssistantWorking: true });

 const timelines = screen.getAllByTestId('process-timeline');
 expect(timelines.length).toBe(1);
 expect(screen.getAllByText(/HiddenTool\.tsx/i).length).toBeGreaterThan(0);
 expect(document.querySelector('.process-live-status')).toBeNull();
 });

 it('renders plan-mode bash denials in completed informal stack without red borders', () => {
 const now = new Date().toISOString();
 const messages: ChatMessage[] = [
 {
 id: 'u-1',
 type: 'user',
 content: '列一下文件',
 timestamp: now,
 },
 {
 id: 'a-1',
 type: 'assistant',
 content: 'I will inspect the current directory.',
 timestamp: now,
 },
 {
 id: 'tool-bash-1',
 type: 'assistant',
 content: '',
 timestamp: now,
 isToolUse: true,
 toolName: 'bash',
 toolId: 'tool-bash-1',
 toolInput: '{"command":"find . -maxdepth 1 -type f","description":"List files"}',
 toolResult: {
 content: 'Plan mode denies side-effecting tool bash.',
 isError: true,
 errorCode: 'permission_denied',
 },
 },
 {
 id: 'a-2',
 type: 'assistant',
 content: 'I will use a read-only approach instead.',
 timestamp: now,
 },
 ];

 const { container } = renderPane({ messages, runMode: 'plan' });

 const informalStack = screen.getByTestId('informal-process-stack');
 const button = informalStack.querySelector('button');
 expect(button).not.toBeNull();
 fireEvent.click(button as HTMLButtonElement);

 expect(screen.getAllByText(/find \. -maxdepth 1 -type f/).length).toBeGreaterThan(0);
 expect(screen.queryByText('Parameters')).toBeNull();
 expect(container.querySelector('.border-l-red-500')).toBeNull();
 expect(screen.queryByRole('button', { name: /permissions\.grant|Grant Bash for this chat/ })).toBeNull();
 });

 it('appends new steps to live timeline as tools stream', () => {
 const now = new Date().toISOString();
 const baseMessages: ChatMessage[] = [
 {
 id: 'u-1',
 type: 'user',
 content: '检查文件',
 timestamp: now,
 },
 {
 id: 'a-1',
 type: 'assistant',
 content: 'I will inspect the current file.',
 timestamp: now,
 },
 {
 id: 'tool-read-1',
 type: 'assistant',
 content: '',
 timestamp: now,
 isToolUse: true,
 toolName: 'Read',
 toolId: 'tool-read-1',
 toolInput: '{"file_path":"src/ReadHidden.tsx"}',
 },
 ];
 const { rerender } = renderPane({ messages: baseMessages, isAssistantWorking: true });

 expect(screen.getAllByTestId('process-timeline')).toHaveLength(1);
 expect(screen.getAllByText(/ReadHidden\.tsx/i).length).toBeGreaterThan(0);

 const nextMessages: ChatMessage[] = [
 ...baseMessages,
 {
 id: 'tool-grep-1',
 type: 'assistant',
 content: '',
 timestamp: now,
 isToolUse: true,
 toolName: 'Grep',
 toolId: 'tool-grep-1',
 toolInput: '{"pattern":"Footer"}',
 },
 ];
 rerender(createPaneElement({ messages: nextMessages, isAssistantWorking: true }));

 expect(screen.getAllByTestId('process-timeline')).toHaveLength(1);
 expect(screen.getAllByText(/ReadHidden\.tsx/i).length).toBeGreaterThan(0);
 });

 it('transitions from live timeline to informal stack on completion', () => {
 const now = new Date().toISOString();
 const baseMessages: ChatMessage[] = [
 {
 id: 'u-1',
 type: 'user',
 content: '检查文件',
 timestamp: now,
 },
 {
 id: 'a-1',
 type: 'assistant',
 content: 'I will inspect first.',
 timestamp: now,
 },
 {
 id: 'tool-read-1',
 type: 'assistant',
 content: '',
 timestamp: now,
 isToolUse: true,
 toolName: 'Read',
 toolId: 'tool-read-1',
 toolInput: '{"file_path":"src/ReadHidden.tsx"}',
 },
 ];
 renderPane({ messages: baseMessages, isAssistantWorking: true });
 expect(screen.getAllByTestId('process-timeline')).toHaveLength(1);

 const completedMessages: ChatMessage[] = [
 { ...baseMessages[0] },
 { ...baseMessages[1] },
 {
 ...baseMessages[2],
 toolResult: { content: 'ok', isError: false },
 },
 {
 id: 'a-2',
 type: 'assistant',
 content: 'Done.',
 timestamp: now,
 },
 ];
 const { rerender } = renderPane({ messages: baseMessages, isAssistantWorking: true });
 rerender(createPaneElement({ messages: completedMessages }));

 const informalStack = screen.getByTestId('informal-process-stack');
 const informalButton = informalStack.querySelector('button');
 expect(informalButton).not.toBeNull();
 fireEvent.click(informalButton as HTMLButtonElement);
 expect(screen.getAllByText(/ReadHidden\.tsx/i).length).toBeGreaterThan(0);
 });

it('keeps live timeline in the inline process dock while intermediate narration stays hidden', () => {
 const now = new Date().toISOString();
 const messages: ChatMessage[] = [
 {
 id: 'u-1',
 type: 'user',
 content: '继续检查',
 timestamp: now,
 },
 {
 id: 'a-1',
 type: 'assistant',
 content: 'I will inspect files first.',
 timestamp: now,
 },
 {
 id: 'tool-read-1',
 type: 'assistant',
 content: '',
 timestamp: now,
 isToolUse: true,
 toolName: 'Read',
 toolId: 'tool-read-1',
 toolInput: '{"file_path":"src/FirstHidden.tsx"}',
 toolResult: { content: 'ok', isError: false },
 },
 {
 id: 'a-2',
 type: 'assistant',
 content: 'Now I will verify the build.',
 timestamp: now,
 },
 {
 id: 'tool-bash-1',
 type: 'assistant',
 content: '',
 timestamp: now,
 isToolUse: true,
 toolName: 'Bash',
 toolId: 'tool-bash-1',
 toolInput: '{"command":"npm run build"}',
 },
 ];

 renderPane({ messages, isAssistantWorking: true });

 expect(screen.getByText('I will inspect files first.')).toBeTruthy();
 expect(screen.queryByText('Now I will verify the build.')).toBeNull();
 expect(screen.getAllByTestId('process-timeline')).toHaveLength(1);
 expect(screen.getByTestId('live-process-progress-dock').querySelector('[data-testid="process-timeline"]')).toBeTruthy();
 expect(screen.getAllByText(/FirstHidden\.tsx/i).length).toBeGreaterThan(0);
 });

 it('merges completed process rows onto the final assistant after the turn finishes', () => {
 const now = new Date().toISOString();
 const messages: ChatMessage[] = [
 {
 id: 'u-1',
 type: 'user',
 content: '继续优化',
 timestamp: now,
 },
 {
 id: 'a-1',
 type: 'assistant',
 content: 'I will inspect first.',
 timestamp: now,
 },
 {
 id: 'tool-read-1',
 type: 'assistant',
 content: '',
 timestamp: now,
 isToolUse: true,
 toolName: 'Read',
 toolId: 'tool-read-1',
 toolInput: '{"file_path":"src/FirstHidden.tsx"}',
 toolResult: { content: 'ok', isError: false },
 },
 {
 id: 'a-2',
 type: 'assistant',
 content: 'Now I will run checks.',
 timestamp: now,
 },
 {
 id: 'tool-bash-1',
 type: 'assistant',
 content: '',
 timestamp: now,
 isToolUse: true,
 toolName: 'Bash',
 toolId: 'tool-bash-1',
 toolInput: '{"command":"npm test"}',
 toolResult: { content: 'ok', isError: false },
 },
 {
 id: 'a-3',
 type: 'assistant',
 content: 'All done.',
 timestamp: now,
 },
 ];

 renderPane({ messages });

 const finalAssistant = screen.getByText('All done.');
 const informalStack = screen.getByTestId('informal-process-stack');

 expect(screen.queryByText('I will inspect first.')).toBeNull();
 expect(screen.queryByText('Now I will run checks.')).toBeNull();
 expect(Boolean(informalStack.compareDocumentPosition(finalAssistant) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
 });

 it('shows generating status after a closed live tool group while the assistant continues', () => {
 const now = new Date().toISOString();
 const messages: ChatMessage[] = [
 {
 id: 'u-1',
 type: 'user',
 content: '继续优化',
 timestamp: now,
 },
 {
 id: 'a-1',
 type: 'assistant',
 content: 'I inspected the file.',
 timestamp: now,
 },
 {
 id: 'tool-read-1',
 type: 'assistant',
 content: '',
 timestamp: now,
 isToolUse: true,
 toolName: 'Read',
 toolId: 'tool-read-1',
 toolInput: '{"file_path":"src/ClosedTool.tsx"}',
 toolResult: { content: 'ok', isError: false },
 },
 {
 id: 'a-2',
 type: 'assistant',
 content: 'Now I am writing the response.',
 timestamp: now,
 },
 ];
 const activityMessages: ChatMessage[] = [
 {
 id: 'activity-1',
 type: 'system',
 content: 'Reading file',
 timestamp: now,
 isAgentActivity: true,
 activityId: 'activity-1',
 phase: 'tool',
 state: 'completed',
 title: 'Reading file',
 },
 ];

 renderPane({ messages, activityMessages, isAssistantWorking: true });

 expect(screen.getAllByTestId('process-timeline').length).toBeGreaterThanOrEqual(1);
 expect(screen.getByTestId('live-process-progress-dock').textContent).toMatch(/进行中|思考与制作/);
 });

 it('shows contextual task acknowledgment until the model first reply appears', () => {
 const now = new Date().toISOString();
 const messages: ChatMessage[] = [
 {
 id: 'u-1',
 type: 'user',
 content: '帮我做一份吴裕泰暑期营销 PPT',
 timestamp: now,
 },
 {
 id: 'tool-read-1',
 type: 'assistant',
 content: '',
 timestamp: now,
 isToolUse: true,
 toolName: 'Read',
 toolId: 'tool-read-1',
 toolInput: '{"file_path":"src/App.tsx"}',
 toolResult: { content: 'ok', isError: false },
 },
 ];

 renderPane({ messages, isAssistantWorking: true });

 expect(screen.getByTestId('task-acknowledgment').textContent).toMatch(/人工智能努力中/);
 const dock = screen.getByTestId('live-process-progress-dock');
 expect(dock).toBeTruthy();
 expect(dock.contains(screen.getByTestId('task-acknowledgment'))).toBe(true);
 });

 it('shows live process status when the turn has no tool rows yet', () => {
 const now = new Date().toISOString();
 const messages: ChatMessage[] = [
 {
 id: 'u-1',
 type: 'user',
 content: '对 deepseek 官网做 GEO 快检',
 timestamp: now,
 },
 ];

 renderPane({ messages, isAssistantWorking: true });

 const dock = screen.getByTestId('live-process-progress-dock');
 expect(dock.querySelector('[data-testid="live-process-status"]')).toBeTruthy();
 expect(dock.textContent).toMatch(/思考|整理|进行中|人工智能努力/);
 });

it('keeps phase rail above live process steps in the inline process dock', () => {
 const now = new Date().toISOString();
 const messages: ChatMessage[] = [
 {
 id: 'u-1',
 type: 'user',
 content: '检查文件',
 timestamp: now,
 },
 {
 id: 'a-1',
 type: 'assistant',
 content: 'I will inspect.',
 timestamp: now,
 },
 {
 id: 'tool-read-1',
 type: 'assistant',
 content: '',
 timestamp: now,
 isToolUse: true,
 toolName: 'Read',
 toolId: 'tool-read-1',
 toolInput: '{"file_path":"src/InlineOnly.tsx"}',
 },
 ];

 renderPane({ messages, isAssistantWorking: true });

 expect(screen.getAllByTestId('process-timeline')).toHaveLength(1);
 const dock = screen.getByTestId('live-process-progress-dock');
 const phaseRail = screen.getByTestId('process-phase-rail');
 const dockTimeline = dock.querySelector('[data-testid="process-timeline"]');
 expect(dockTimeline).toBeTruthy();
 expect(Boolean(phaseRail.compareDocumentPosition(dockTimeline!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
 expect(dock.textContent).toMatch(/进行中/);
 expect(dock.className).not.toContain('sticky');
 expect(dock.querySelector('[data-testid="process-timeline-live-viewport"]')).toBeNull();
 });

 it('expands live process inline in the conversation without collapse while running', () => {
 const now = new Date().toISOString();
 const messages: ChatMessage[] = [
 {
 id: 'u-1',
 type: 'user',
 content: '检查多个文件',
 timestamp: now,
 },
 ...Array.from({ length: 10 }, (_, index) => ({
 id: `tool-read-${index}`,
 type: 'assistant' as const,
 content: '',
 timestamp: now,
 isToolUse: true,
 toolName: 'Read',
 toolId: `tool-read-${index}`,
 toolInput: `{"file_path":"src/File${index}.tsx"}`,
 toolResult: { content: 'ok', isError: false },
 })),
 ];

 renderPane({ messages, isAssistantWorking: true });

 const dock = screen.getByTestId('live-process-progress-dock');
 expect(screen.queryByTestId('live-process-expanded-inline')).toBeNull();
 expect(screen.queryByText('查看全部过程')).toBeTruthy();

 fireEvent.click(screen.getByText('查看全部过程'));

 const inline = screen.getByTestId('live-process-expanded-inline');
 expect(inline).toBeTruthy();
 expect(dock.contains(inline)).toBe(true);
 expect(inline.className).not.toContain('overflow-y-auto');
 expect(inline.className).not.toContain('max-h-');
 expect(dock.querySelector('[data-testid="process-timeline-live-viewport"]')).toBeNull();
 expect(screen.getByText('全部过程')).toBeTruthy();
 expect(screen.queryByText('收起过程')).toBeNull();
 });

 it('folds ordinary failed tools into a compact process row with error count', () => {
 const now = new Date().toISOString();
 const failedResult = {
 content: '<tool_use_error>InputValidationError: missing file_path</tool_use_error>',
 isError: true,
 errorCode: 'tool_execution_failed',
 };
 const messages: ChatMessage[] = [
 {
 id: 'u-1',
 type: 'user',
 content: '修一下页面',
 timestamp: now,
 },
 {
 id: 'tool-edit-1',
 type: 'assistant',
 content: '',
 timestamp: now,
 isToolUse: true,
 toolName: 'write_file',
 toolId: 'tool-edit-1',
 toolInput: '{"file_path":"src/FailedTool.tsx","content":"export const failed = true;"}',
 toolResult: failedResult,
 },
 {
 id: 'tool-grep-1',
 type: 'assistant',
 content: '',
 timestamp: now,
 isToolUse: true,
 toolName: 'Grep',
 toolId: 'tool-grep-1',
 toolInput: '{"pattern":"Footer"}',
 toolResult: failedResult,
 },
 {
 id: 'a-1',
 type: 'assistant',
 content: 'I will retry with corrected inputs.',
 timestamp: now,
 },
 ];

 const { container } = renderPane({ messages });

 expect(screen.queryByText('Tool error')).toBeNull();

 const informalStack = screen.getByTestId('informal-process-stack');
 const expandButton = informalStack.querySelector('button');
 expect(expandButton).not.toBeNull();
 fireEvent.click(expandButton as HTMLButtonElement);

 expect(screen.getAllByText(/FailedTool\.tsx|已生成/i).length).toBeGreaterThan(0);
 expect(screen.getAllByText(/Footer|搜索代码/i).length).toBeGreaterThan(0);

 expect(screen.getAllByText(/FailedTool\.tsx/i).length).toBeGreaterThan(0);
 expect(screen.getAllByText(/已完成|Completed|已处理|Processed/i).length).toBeGreaterThan(0);
 expect(container.querySelector('.border-l-red-500')).toBeNull();
 });

 it('does not render a completed compact boundary as a plan-mode process row', () => {
 const now = new Date().toISOString();
 const messages: ChatMessage[] = [
 {
 id: 'u-1',
 type: 'user',
 content: '先规划一下',
 timestamp: now,
 },
 {
 id: 'compact-1',
 type: 'system',
 content: 'Context compacted',
 timestamp: now,
 isCompactBoundary: true,
 },
 {
 id: 'a-1',
 type: 'assistant',
 content: 'I will make a plan first.',
 timestamp: now,
 },
 ];

 renderPane({ messages, isAssistantWorking: true, runMode: 'plan' });

 expect(screen.getByText('I will make a plan first.')).toBeTruthy();
 expect(screen.queryByText('Compacted context')).toBeNull();
 });

 it('uses compact message spacing instead of the old large row gap', () => {
 const messages = [
 {
 id: 'u-1',
 type: 'user',
 content: '调整一下',
 timestamp: new Date().toISOString(),
 },
 {
 id: 'a-1',
 type: 'assistant',
 content: 'First assistant line.',
 timestamp: new Date().toISOString(),
 },
 {
 id: 'a-2',
 type: 'assistant',
 content: 'Second assistant line.',
 timestamp: new Date().toISOString(),
 },
 ];

 renderPane({ messages });

 expect(screen.getByText('First assistant line.').closest('.chat-message')?.className).toContain('pb-4');
 expect(screen.getByText('First assistant line.').closest('.chat-message')?.className).not.toContain('pb-8');
 });
});
