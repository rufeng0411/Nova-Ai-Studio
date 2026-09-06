import { describe, expect, it } from 'vitest';
import { ImageGenerationGate } from './imageGenerationGate.js';

describe('ImageGenerationGate', () => {
  it('limits concurrent executions', async () => {
    const gate = new ImageGenerationGate(1);
    let active = 0;
    let maxActive = 0;
    const task = async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 30));
      active -= 1;
      return 'done';
    };
    await Promise.all([gate.run(task), gate.run(task)]);
    expect(maxActive).toBe(1);
  });

  it('passes through when maxConcurrent is 0', async () => {
    const gate = new ImageGenerationGate(0);
    const result = await gate.run(async () => 42);
    expect(result).toBe(42);
  });
});
