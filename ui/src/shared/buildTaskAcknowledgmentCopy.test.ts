import { describe, expect, it } from 'vitest';
import { buildTaskAcknowledgmentMessage } from './buildTaskAcknowledgmentCopy';

describe('buildTaskAcknowledgmentCopy', () => {
  it('returns a short zh acknowledgment', () => {
    expect(buildTaskAcknowledgmentMessage(true)).toBe('人工智能努力中...');
  });

  it('returns a short en acknowledgment', () => {
    expect(buildTaskAcknowledgmentMessage(false)).toBe('OK, one moment.');
  });
});
