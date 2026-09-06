import { describe, expect, it } from 'vitest';
import poolData from '../generated/welcome-prompt-pool.json';
import { pickRandomWelcomePrompts, getWelcomePromptPoolSize } from './welcomePromptPool';

describe('welcomePromptPool', () => {
  it('has at least 30 prompts in inventory', () => {
    expect(getWelcomePromptPoolSize()).toBeGreaterThanOrEqual(30);
  });

  it('picks 5 unique random prompts by default', () => {
    const picked = pickRandomWelcomePrompts();
    expect(picked).toHaveLength(5);
    expect(new Set(picked).size).toBe(5);
    for (const item of picked) {
      expect(item.trim().length).toBeGreaterThan(8);
    }
  });

  it('generated pool json matches display_count', () => {
    const file = poolData as { display_count?: number; prompts?: string[] };
    expect(file.display_count).toBe(5);
    expect(Array.isArray(file.prompts)).toBe(true);
  });
});
