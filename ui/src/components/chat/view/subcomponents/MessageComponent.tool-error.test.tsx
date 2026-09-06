// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/renderWithProviders';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../types/types';
import MessageComponent from './MessageComponent';

afterEach(() => {
 cleanup();
});

function renderToolMessage(message: ChatMessage) {
 return renderWithProviders(
 <MessageComponent
 message={message}
 prevMessage={null}
 createDiff={() => []}
 provider="pilotdeck"
 onShowSettings={() => {}}
 />,
 );
}

describe('MessageComponent tool errors', () => {
 it('renders recoverable write_file errors as one-line gray notice with expand', () => {
 const { container } = renderToolMessage({
 id: 'tool-1',
 type: 'assistant',
 content: '',
 timestamp: '2026-05-18T08:00:00.000Z',
 isToolUse: true,
 toolName: 'write_file',
 toolId: 'tool-1',
 toolInput: '{"file_path":"src/new-page.html","content":"<html></html>"}',
 toolResult: {
 isError: true,
 content: '<tool_use_error>InputValidationError: write_file failed: invalid args</tool_use_error>',
 errorCode: 'tool_execution_failed',
 },
 });

  expect(screen.getAllByText('new-page.html').length).toBeGreaterThan(0);
  expect(screen.getByRole('status').textContent).toMatch(/可能需要些时间，请稍后|This may take a moment/i);
 expect(container.querySelector('[class*="text-red"]')).toBeNull();
 const notice = container.querySelector('[role="status"]');
 expect(notice?.className.includes('amber')).toBe(false);

 fireEvent.click(screen.getByText(/Details|查看详情/));
 expect(screen.getByText(/写入文件未成功|invalid args/i)).toBeTruthy();
 });

 it('keeps permission errors actionable with gray styling', () => {
 const { container } = renderToolMessage({
 id: 'tool-2',
 type: 'assistant',
 content: '',
 timestamp: '2026-05-18T08:00:00.000Z',
 isToolUse: true,
 toolName: 'Bash',
 toolId: 'tool-2',
 toolInput: '{"command":"npm test"}',
 toolResult: {
 isError: true,
 content: '<tool_use_error>Permission denied: requires grant</tool_use_error>',
 errorCode: 'permission_required',
 },
 });

 expect(screen.queryByText('Tool error')).toBeNull();
 expect(container.querySelector('[class*="text-red"]')).toBeNull();
  expect(screen.getByRole('button', { name: /在本聊天中授权 Bash|Grant Bash for this chat/ })).toBeTruthy();
  expect(screen.getByRole('button', { name: /打开设置|Open settings/ })).toBeTruthy();
 });

 it('renders plan-mode tool denials as one-line notice without permission actions', () => {
 const { container } = renderToolMessage({
 id: 'tool-3',
 type: 'assistant',
 content: '',
 timestamp: '2026-05-18T08:00:00.000Z',
 isToolUse: true,
 toolName: 'bash',
 toolId: 'tool-3',
 toolInput: '{"command":"cd .","description":"List files"}',
 toolResult: {
 isError: true,
 content: 'Plan mode denies side-effecting tool bash.',
 errorCode: 'permission_denied',
 },
 });

 expect(screen.queryByText('Parameters')).toBeNull();
 expect(container.querySelector('[class*="text-red"]')).toBeNull();
 expect(screen.queryByRole('button', { name: /permissions\.grant|Grant Bash for this chat/ })).toBeNull();

 fireEvent.click(screen.getByText(/Details|查看详情/));
 expect(screen.getByText(/Plan mode denies side-effecting tool bash/)).toBeTruthy();
 });

 it('hides recovery boilerplate in tool errors', () => {
 const recoveryText =
 'Several tools failed in a row. Failed tools: read_file. Use fetch_page_images on the brand product URL.';
 renderToolMessage({
 id: 'tool-recovery',
 type: 'assistant',
 content: '',
 timestamp: '2026-06-02T08:00:00.000Z',
 isToolUse: true,
 toolName: 'write_file',
 toolId: 'tool-recovery',
 toolInput: '{"file_path":"src/page.html","content":"<html></html>"}',
 toolResult: {
 isError: true,
 content: recoveryText,
 errorCode: 'tool_execution_failed',
 },
 });

  expect(screen.queryByText(/Several tools failed/i)).toBeNull();
  expect(screen.queryByText(/fetch_page_images/i)).toBeNull();
  expect(screen.getByRole('status').textContent).toMatch(/可能需要些时间，请稍后|This may take a moment/i);
 });
});
