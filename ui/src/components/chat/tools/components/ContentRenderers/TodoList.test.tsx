// @vitest-environment jsdom
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../../../../test/renderWithProviders';
import TodoList from './TodoList';

afterEach(() => {
 cleanup();
});

describe('TodoList', () => {
 it('renders only status badges and omits priority badges', () => {
 renderWithProviders(
 <TodoList
 todos={[
 { id: 'a', content: 'Keep visible status', status: 'in_progress', priority: 'low' },
 { id: 'b', content: 'Hide priority badges', status: 'pending', priority: 'high' },
 { id: 'c', content: 'Finished work', status: 'completed', priority: 'medium' },
 ]}
 />
 );

 expect(screen.getByText(/in progress|进行中/)).toBeTruthy();
 expect(screen.getByText(/pending|待处理/)).toBeTruthy();
 expect(screen.getByText(/completed|已完成/)).toBeTruthy();
 expect(screen.queryByText('low')).toBeNull();
 expect(screen.queryByText('high')).toBeNull();
 expect(screen.queryByText('medium')).toBeNull();
 });
});
