import { describe, expect, it } from 'vitest';
import { shouldPulseDeliverableCompletion } from './deliverableCompletionPulse';

describe('shouldPulseDeliverableCompletion', () => {
  it('does not pulse on first baseline', () => {
    expect(shouldPulseDeliverableCompletion(null, 2, 4)).toBe(false);
  });

  it('pulses when done increases', () => {
    expect(shouldPulseDeliverableCompletion(1, 2, 4)).toBe(true);
  });

  it('does not pulse when done unchanged or decreases', () => {
    expect(shouldPulseDeliverableCompletion(2, 2, 4)).toBe(false);
    expect(shouldPulseDeliverableCompletion(3, 2, 4)).toBe(false);
  });

  it('does not pulse when total is zero', () => {
    expect(shouldPulseDeliverableCompletion(0, 1, 0)).toBe(false);
  });
});
