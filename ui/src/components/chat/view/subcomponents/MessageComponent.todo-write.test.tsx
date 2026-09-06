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

describe('MessageComponent todo_write rendering', () => {
 it('renders markdown checklist details for lowercase todo_write tool calls', () => {
 renderToolMessage({
 id: 'todo-tool-1',
 type: 'assistant',
 content: '',
 timestamp: '2026-05-18T08:00:00.000Z',
 isToolUse: true,
 toolName: 'todo_write',
 toolId: 'todo-tool-1',
 toolInput: {
 markdown: ['- [x] Create project directory structure', '- [ ] Implement game constants'].join('\n'),
 },
 });

 const summary = screen.getByText(/Updating todo list|正在更新待办清单/).closest('summary');
 expect(summary).not.toBeNull();
 fireEvent.click(summary as HTMLElement);

 expect(screen.getByText('Create project directory structure')).toBeTruthy();
 expect(screen.getByText('Implement game constants')).toBeTruthy();
 expect(screen.getByText(/completed|已完成/)).toBeTruthy();
 expect(screen.getByText(/in progress|进行中/)).toBeTruthy();
 });

 it('renders TodoWrite success result message', () => {
 renderToolMessage({
 id: 'todo-tool-2',
 type: 'assistant',
 content: '',
 timestamp: '2026-05-18T08:00:00.000Z',
 isToolUse: true,
 toolName: 'TodoWrite',
 toolId: 'todo-tool-2',
 toolInput: {
 markdown: '- [ ] Create project directory structure',
 },
 toolResult: {
 isError: false,
 content: 'Todo list updated',
 },
 });

 expect(screen.getAllByText(/Todo list updated|待办清单已更新/).length).toBeGreaterThan(0);
 });
});
