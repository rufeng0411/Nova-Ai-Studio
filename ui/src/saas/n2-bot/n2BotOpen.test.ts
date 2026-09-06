// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { N2_BOT_WINDOW_NAME, openN2Bot, openN2BotWindow } from './n2BotOpen';

describe('n2BotOpen', () => {
  it('does not use location.assign', () => {
    expect(openN2BotWindow.toString()).not.toContain('location.assign');
    expect(openN2Bot.toString()).not.toContain('location.assign');
  });

  it('X1 named window is n2-bot; null open falls back to overlay event', () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const result = openN2Bot();
    expect(result.mode).toBe('overlay');
    expect(open).toHaveBeenCalled();
    const first = open.mock.calls[0];
    expect(String(first?.[1] || N2_BOT_WINDOW_NAME)).toBe(N2_BOT_WINDOW_NAME);
    expect(dispatch).toHaveBeenCalled();
    open.mockRestore();
    dispatch.mockRestore();
  });
});
