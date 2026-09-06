import { describe, expect, it } from 'vitest';
import { StageHintDedup } from './stageHintDedup.js';

describe('StageHintDedup', () => {
  it('emits memory_retrieve only once per turn', () => {
    const dedup = new StageHintDedup();
    expect(dedup.shouldEmit('memory_retrieve')).toBe(true);
    expect(dedup.shouldEmit('memory_retrieve')).toBe(false);
    expect(dedup.shouldEmit('router_judge')).toBe(true);
  });

  it('reset allows hints again', () => {
    const dedup = new StageHintDedup();
    dedup.shouldEmit('compact');
    dedup.reset();
    expect(dedup.shouldEmit('compact')).toBe(true);
  });
});
