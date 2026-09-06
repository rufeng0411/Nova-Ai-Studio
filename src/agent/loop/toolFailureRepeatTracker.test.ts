import { describe, expect, it } from 'vitest';
import { ToolFailureRepeatTracker } from './toolFailureRepeatTracker.js';

describe('ToolFailureRepeatTracker', () => {
  it('detects repeated identical tool failures', () => {
    const tracker = new ToolFailureRepeatTracker();
    const fail = {
      type: 'error' as const,
      toolCallId: 'tc1',
      toolName: 'bash',
      error: { code: 'tool_execution_failed' as const, message: 'fail' },
      content: [{ type: 'text' as const, text: 'python parse.py' }],
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    expect(tracker.record([fail])).toBeNull();
    expect(tracker.record([fail])).toBe('bash:python parse.py');
  });

  it('ignores successful results', () => {
    const tracker = new ToolFailureRepeatTracker();
    const ok = {
      type: 'success' as const,
      toolCallId: 'tc2',
      toolName: 'bash',
      content: [{ type: 'text' as const, text: 'ok' }],
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    expect(tracker.record([ok])).toBeNull();
  });
});
